/**
 * Automatic first cut for a horizontal video from raw takes.
 *
 * Every numeric choice comes from a measured style profile (editorial-memory),
 * never from a constant here; each decision carries the profile field it used so
 * a correction can be traced back to the habit that produced it. An optional
 * `intents` object (LLM or agent) only chooses *where* among valid candidates.
 */

import {CAPCUT_STICKER_BASE} from './render-plan.js';

const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const FPS = 30;
const HOOK_SECONDS = 20;
const SENTENCE_PAUSE = 0.6;
const PHRASE_PAUSE = 0.12;
const FALSE_START_SILENCE = 1;
const FALSE_START_WORDS = 8;
const FALSE_START_SHARE = 0.4;
const norm = (w) => String(w.text ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}]+/gu, '');

/** Numbered recordings (1.mkv, 2.mkv...) are takes in order; anything else is a resource. */
export function orderTakes(clips) {
  const number = (c) => Number(/^(\d+)\.[a-z0-9]+$/i.exec(c.sourceName ?? '')?.[1]);
  const takes = clips.filter((c) => Number.isFinite(number(c))).sort((a, b) => number(a) - number(b));
  return {takes, resources: clips.filter((c) => !takes.includes(c))};
}

/**
 * Keep the last attempt of a restarted opening and the speech span, with pads
 * from the profile; drop inner silences longer than maxPause.
 */
export function trimTake(words, {headPad, tailPad, maxPause, silences = []}) {
  const spoken = words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && norm(w));
  if (!spoken.length) return null;
  let first = 0;
  const opening = spoken.slice(0, 3).map(norm).join(' ');
  const limit = spoken.at(-1).end * 0.6;
  for (let i = 3; i + 2 < spoken.length && spoken[i].start <= limit; i++) {
    if (spoken.slice(i, i + 3).map(norm).join(' ') === opening) first = i;
  }
  // A false start: a few words, a long silence, then the take begins again. The
  // transcriber often merges the repeated words, so the silence is the evidence.
  let restartAt = null;
  const early = spoken.at(-1).end * FALSE_START_SHARE;
  for (const s of silences) {
    const before = spoken.filter((w, i) => i >= first && w.start < s.start).length;
    if (s.end - s.start >= FALSE_START_SILENCE && s.start > spoken[first].start && s.end < early && before > 0 && before <= FALSE_START_WORDS) {
      restartAt = s.end;
      first = spoken.findIndex((w) => w.end > s.end);
    }
  }
  const kept = spoken.slice(Math.max(0, first));
  // Transcribers stretch a word over the silence before it; the audio says when speech starts and stops.
  const onset = (t) => silences.find((s) => s.start <= t + 0.05 && s.end > t)?.end ?? t;
  const offset = (t) => silences.find((s) => s.start < t && s.end >= t - 0.05)?.start ?? t;
  const pieces = [];
  let start = Math.max(0, onset(restartAt ?? kept[0].start) - headPad);
  for (let i = 1; i < kept.length; i++) {
    if (kept[i].start - kept[i - 1].end > maxPause) {
      pieces.push({in: round(start), out: round(offset(kept[i - 1].end) + tailPad)});
      start = onset(kept[i].start) - headPad;
    }
  }
  pieces.push({in: round(start), out: round(offset(kept.at(-1).end) + tailPad)});
  return {pieces, restartWord: first || null, restartAt, firstWord: first};
}

function sentenceStarts(words) {
  const starts = [0];
  for (let i = 1; i < words.length; i++) {
    const endsSentence = /[.!?]$/.test(String(words[i - 1].text ?? '').trim());
    if (endsSentence || words[i].start - words[i - 1].end > SENTENCE_PAUSE) starts.push(i);
  }
  return starts;
}

const top = (counts) => Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
const median = (q, fallback) => (Number.isFinite(q?.median) ? q.median : fallback);

export function planEdit({clips, profile, kit = {}, intents = {}}) {
  const {takes} = orderTakes(clips);
  if (!takes.length) throw Error('No hay tomas numeradas (1.mkv, 2.mkv...)');
  const p = profile;
  const warnings = [];
  const pads = {headPad: Math.max(0, median(p.speech?.leadSeconds, 0.05)), tailPad: Math.max(0, median(p.speech?.tailSeconds, 0.1)), maxPause: 2};
  const atLeast = (s, fraction) => s.of > 0 && s.count / s.of >= fraction - 1e-9;
  const segments = [];
  const decisions = [];
  let clock = 0;

  // 1. Takes, trims and hook punch-ins, in timeline order.
  const hookZoom = median(p.hook.punchInZoom, 1.2);
  const hookSpacing = median(p.hook.punchInSpacingSeconds, 2);
  const useHook = atLeast(p.hook.videosWithPunchIns, 1 / 3);
  for (const [index, clip] of takes.entries()) {
    const trim = trimTake(clip.words ?? [], {...pads, silences: clip.silences ?? []});
    if (!trim) {warnings.push(`Toma ${clip.sourceName} sin palabras: se omite`); continue;}
    if (trim.restartWord) decisions.push({type: 'trim-restart', clipId: clip.id, atWord: trim.restartWord, atSource: trim.restartAt,
      reason: trim.restartAt != null ? 'Arranque fallido: pocas palabras y un silencio largo; se empieza tras el silencio' : 'La toma repite su arranque; se conserva el ultimo intento'});
    for (const piece of trim.pieces) {
      const refs = (intents.hookPunchRefs ?? []).filter((r) => r.clipId === clip.id).map((r) => clip.words[r.atWord]?.start).filter(Number.isFinite);
      const parts = index === 0 && useHook ? splitHook(clip.words, piece, hookSpacing, refs) : [piece];
      parts.forEach((part, i) => {
        const zoom = index === 0 && useHook && i % 2 === 1 ? hookZoom : 1;
        segments.push({clipId: clip.id, sourceName: clip.sourceName, in: part.in, out: part.out, at: round(clock), zoom, take: index});
        if (zoom > 1) decisions.push({type: 'punch-in', at: round(clock), clipId: clip.id, zoom,
          sound: top(p.hook.punchInSound), lead: 0, reason: `Gancho: punch-in cada ~${hookSpacing} s (hook.punchInSpacingSeconds)`});
        clock += part.out - part.in;
      });
    }
  }
  const bodyEnd = clock;

  // 2. Sounds on take changes: a measured share, on topic shifts when known.
  const changes = segments.filter((s, i) => i > 0 && s.take !== segments[i - 1].take);
  const soundFamily = top(p.cuts.soundFamily) ?? 'whoosh';
  const lead = median(p.sound.leadSecondsByEvent?.['take-change'], 0.15);
  const wanted = Math.round(changes.length * median(p.cuts.soundShare, 0.2));
  const byLength = [...changes].sort((a, b) => takeLength(segments, b.take - 1) - takeLength(segments, a.take - 1));
  const chosen = new Set((intents.topicShiftTakes ?? []).map((t) => changes.find((c) => c.take === t)).filter(Boolean));
  if (changes.length) chosen.add(changes.at(-1));
  for (const change of byLength) if (chosen.size < wanted) chosen.add(change);
  for (const change of chosen) decisions.push({type: 'sfx', at: round(change.at - lead), event: 'take-change', family: soundFamily, lead,
    reason: `Cambio de toma con sonido en ${Math.round(median(p.cuts.soundShare, 0) * 100)} % de cortes (cuts.soundShare)`});

  // 3. Camera pushes on sentence starts, at the measured rate and length.
  const perMinute = median(p.camera.movesPerMinute, 0.3);
  const seconds = median(p.camera.moveSeconds, 10);
  const peak = median(p.camera.peakZoom, 1.12);
  const easing = (p.camera.curveShare.share ?? 0) >= 0.5 ? 'curve' : 'linear';
  const candidates = [];
  for (const seg of segments.filter((s) => s.zoom === 1)) {
    const clip = takes.find((c) => c.id === seg.clipId);
    for (const i of sentenceStarts(clip.words ?? [])) {
      const w = clip.words[i];
      if (w.start >= seg.in && w.start < seg.out - seconds) candidates.push({at: round(seg.at + w.start - seg.in), clipId: clip.id, atWord: i, seg});
    }
  }
  const moves = [];
  const emphasis = new Set((intents.emphasis ?? []).map((e) => `${e.clipId}:${e.atWord}`));
  const pick = (c) => {
    if (moves.some((m) => Math.abs(m.at - c.at) < seconds * 2)) return;
    moves.push(c);
  };
  for (const c of candidates) if (emphasis.has(`${c.clipId}:${c.atWord}`)) pick(c);
  const target = Math.max(1, Math.round(bodyEnd / 60 * perMinute));
  if (atLeast(p.hook.videosWithEarlyMoves, 0.5)) {
    const early = candidates.find((c) => c.at > (useHook ? takeLength(segments, 0) : 0) && c.at < 30);
    if (early) pick(early);
  }
  const step = bodyEnd / (target + 1);
  for (let k = 1; moves.length < target && k <= target; k++) {
    const near = candidates.filter((c) => !moves.includes(c)).sort((a, b) => Math.abs(a.at - k * step) - Math.abs(b.at - k * step))[0];
    if (near) pick(near);
  }
  for (const m of moves.sort((a, b) => a.at - b.at)) {
    decisions.push({type: 'push', at: m.at, clipId: m.clipId, atWord: m.atWord, from: 1, to: peak, seconds, easing,
      reason: emphasis.has(`${m.clipId}:${m.atWord}`) ? 'Frase marcada como enfasis' : `Ritmo ${perMinute}/min (camera.movesPerMinute)`});
    decisions.push({type: 'push', at: round(m.at + seconds), clipId: m.clipId, from: peak, to: 1, seconds: Math.min(seconds, 3), easing, reason: 'Vuelta al plano'});
  }

  // 4. Breathing zoom over the last take when the closing habit exists.
  const lastTake = segments.filter((s) => s.take === segments.at(-1)?.take);
  if (atLeast(p.outro.videosWithMoves, 0.5) && lastTake.length) {
    const outroSeconds = median(p.outro.moveSeconds, 10);
    let at = lastTake[0].at, up = true;
    const end = lastTake.at(-1).at + lastTake.at(-1).out - lastTake.at(-1).in;
    while (at + outroSeconds <= end) {
      decisions.push({type: 'push', at: round(at), clipId: lastTake[0].clipId, from: up ? 1 : peak, to: up ? peak : 1, seconds: outroSeconds, easing: 'curve',
        reason: `Cierre con zoom de respiracion (outro.videosWithMoves ${p.outro.videosWithMoves.count}/${p.outro.videosWithMoves.of})`});
      at += outroSeconds; up = !up;
    }
  }

  // 5. Brand: opening sticker, music bed, closing asset.
  if (kit.sticker && atLeast(p.brand.openingSticker, 1 / 3)) decisions.push({type: 'sticker', at: 0, seconds: kit.sticker.seconds, reason: 'Sticker de apertura (brand.openingSticker)'});
  if (kit.outro && atLeast(p.brand.closingAsset, 0.5)) {
    decisions.push({type: 'outro', at: round(bodyEnd), seconds: kit.outro.duration, reason: 'Cierre propio (brand.closingAsset)'});
    decisions.push({type: 'sfx', at: round(bodyEnd - lead), event: 'outro-in', family: soundFamily, lead, reason: 'Entrada al cierre'});
  }
  const total = bodyEnd + (decisions.some((d) => d.type === 'outro') ? kit.outro.duration : 0);
  if (kit.music && atLeast(p.sound.musicVideos, 0.5)) decisions.push({type: 'music', at: 0, until: round(total),
    volume: median(p.sound.musicVolume, 0.04), outroVolume: p.sound.musicVolume.p90 ?? 0.15, reason: 'Cama musical (sound.musicVolume)'});

  if (!kit.music) warnings.push('Sin musica en el kit');
  return {version: 1, kind: 'youtube-edit-plan', profile: {projects: p.projects, excluded: p.excluded ?? [], recent: p.recent ?? null},
    duration: round(total), segments, decisions: decisions.sort((a, b) => a.at - b.at), warnings, review: {editorial: 'pending'}};
}

function takeLength(segments, take) {
  return segments.filter((s) => s.take === take).reduce((sum, s) => sum + s.out - s.in, 0);
}

/** Split the hook at chosen sentence starts, or at phrase pauses every `spacing` seconds of speech. */
function splitHook(words, piece, spacing, chosen = []) {
  const limit = Math.min(piece.out, piece.in + HOOK_SECONDS);
  if (chosen.length) {
    const cuts = [...new Set(chosen.filter((t) => t > piece.in + 0.3 && t < limit).map((t) => round(t - 0.05)))].sort((a, b) => a - b);
    const bounds = [piece.in, ...cuts, piece.out];
    return bounds.slice(1).map((out, i) => ({in: bounds[i], out}));
  }
  const cuts = [];
  for (let i = 1; i < words.length; i++) {
    const gap = words[i].start - words[i - 1].end, at = words[i].start;
    if (at <= piece.in || at >= limit || gap < PHRASE_PAUSE && !/[,.!?]$/.test(String(words[i - 1].text ?? ''))) continue;
    const last = cuts.at(-1) ?? piece.in;
    if (at - last >= spacing * 0.8) cuts.push(round(at - Math.min(0.05, gap / 2)));
  }
  const bounds = [piece.in, ...cuts, piece.out];
  return bounds.slice(1).map((out, i) => ({in: bounds[i], out}));
}

/** Zoom value over the edit clock from the push decisions. */
export function zoomAt(pushes, t) {
  let value = 1;
  for (const m of pushes) {
    if (t < m.at) break;
    const k = Math.min(1, (t - m.at) / m.seconds);
    const eased = m.easing === 'curve' ? k * k * (3 - 2 * k) : k;
    value = m.from + (m.to - m.from) * eased;
  }
  return value;
}

/**
 * Offset (CapCut units: centre-normalised, y up) that keeps the face still while
 * scaling about the frame centre; it never exposes a border because |offset| <= zoom - 1.
 */
export function anchor(clip, zoom) {
  const fx = clip.focus?.x ?? 0.5, fy = clip.focus?.y ?? 0.5;
  return {x: round(-(fx - 0.5) * 2 * (zoom - 1), 4) + 0, y: round((fy - 0.5) * 2 * (zoom - 1), 4) + 0};
}

/** Translate the edit plan into the renderer's layer plan. */
export function compileEditPlan(plan, {clips, kit = {}}) {
  const frame = (s) => Math.round(s * FPS);
  const byId = new Map(clips.map((c) => [c.id, c]));
  const pushes = plan.decisions.filter((d) => d.type === 'push').sort((a, b) => a.at - b.at);
  const layers = [];
  for (const [i, seg] of plan.segments.entries()) {
    const clip = byId.get(seg.clipId);
    const length = seg.out - seg.in;
    const curves = {};
    if (seg.zoom === 1) {
      const times = [0, length, ...pushes.flatMap((m) => [m.at - seg.at, m.at + m.seconds - seg.at]).filter((t) => t > 0 && t < length)].sort((a, b) => a - b);
      const keys = [...new Set(times.map((t) => round(t)))].map((t) => ({time: t, value: round(zoomAt(pushes, seg.at + t), 4), easing: pushes.some((m) => m.easing === 'curve' && seg.at + t > m.at && seg.at + t <= m.at + m.seconds + 1e-6) ? 'smooth' : 'linear'}));
      if (keys.some((k) => k.value !== 1)) {
        curves.scaleX = keys;
        curves.scaleY = structuredClone(keys);
        curves.x = keys.map((k) => ({...k, value: anchor(clip, k.value).x}));
        curves.y = keys.map((k) => ({...k, value: anchor(clip, k.value).y}));
      }
    }
    layers.push({id: `seg-${i + 1}`, type: 'video', file: clip.file, from: frame(seg.at), duration: frame(seg.at + length) - frame(seg.at),
      sourceIn: seg.in, volume: 1, width: clip.width, height: clip.height,
      transform: {...anchor(clip, seg.zoom), scaleX: seg.zoom, scaleY: seg.zoom, rotation: 0, opacity: 1}, curves, z: 0, trackIndex: 0, name: seg.sourceName});
  }
  const sfxCount = {};
  for (const d of plan.decisions) {
    if (d.type === 'sfx' || (d.type === 'punch-in' && d.sound)) {
      const family = d.family ?? d.sound, options = kit.sounds?.[family] ?? [];
      if (!options.length) throw Error(`El kit no tiene sonidos de la familia ${family}`);
      const sound = options[(sfxCount[family] = (sfxCount[family] ?? -1) + 1) % options.length];
      layers.push({id: `sfx-${layers.length}`, type: 'audio', file: sound.file, from: frame(Math.max(0, d.at)), duration: Math.max(1, frame(sound.duration)),
        sourceIn: 0, volume: sound.volume ?? 1, width: 1, height: 1, transform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1}, curves: {}, z: 0, trackIndex: 20, name: family});
    }
    if (d.type === 'outro') layers.push({id: 'outro', type: 'video', file: kit.outro.file, from: frame(d.at), duration: frame(d.at + d.seconds) - frame(d.at),
      sourceIn: 0, volume: 1, width: kit.outro.width, height: kit.outro.height, transform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1}, curves: {}, z: 0, trackIndex: 1, name: 'outro'});
    if (d.type === 'sticker') layers.push({id: 'sticker', type: 'gif', file: kit.sticker.file, from: 0, duration: frame(d.seconds), sourceIn: 0, volume: 0,
      width: kit.sticker.width, height: kit.sticker.height, transform: {x: kit.sticker.capcut.x, y: kit.sticker.capcut.y,
        scaleX: kit.sticker.capcut.scale * CAPCUT_STICKER_BASE, scaleY: kit.sticker.capcut.scale * CAPCUT_STICKER_BASE, rotation: 0, opacity: 1}, curves: {}, z: 0, trackIndex: 10, name: 'sticker'});
    if (d.type === 'music') {
      const outroAt = plan.decisions.find((x) => x.type === 'outro')?.at ?? Infinity;
      for (let at = 0, n = 0; at < d.until; at += kit.music.duration, n++) {
        const end = Math.min(d.until, at + kit.music.duration);
        for (const [from, to, volume] of [[at, Math.min(end, outroAt), d.volume], [Math.max(at, outroAt), end, d.outroVolume]]) {
          if (to - from < 1 / FPS) continue;
          layers.push({id: `music-${n}-${from}`, type: 'audio', file: kit.music.file, from: frame(from), duration: frame(to) - frame(from), sourceIn: round(from - at),
            volume, width: 1, height: 1, transform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1}, curves: {}, z: 0, trackIndex: 30, name: 'music'});
        }
      }
    }
  }
  layers.sort((a, b) => a.trackIndex - b.trackIndex || a.from - b.from);
  return {version: 1, kind: 'youtube-render-plan', format: {width: 1920, height: 1080, fps: FPS}, durationInFrames: frame(plan.duration), layers,
    warnings: plan.warnings.map((message) => ({message})), provenance: {editPlan: true, profile: plan.profile},
    review: {visual: 'pending', audio: 'pending', editorial: 'pending'}};
}
