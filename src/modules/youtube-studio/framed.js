/**
 * "Escritorio" style for a full long video: a wallpaper fills the canvas, the
 * recording sits on top as a rounded card, the webcam floats in a bubble and the
 * whole stage zooms now and then onto what the author is talking about.
 *
 * It does not replace the automatic first cut: takes, trims, sounds on cuts,
 * music, sticker, outro and resources still come from `planEdit`. This module
 * only swaps the face punch-ins for screen zooms the agent anchored to words
 * (where) and turns them into a stage camera with the measured curve (how much,
 * from `framed-profiles.json`).
 */

import {compileEditPlan} from './autoplan.js';
import {cameraAt, cameraCrop} from '../video-studio/camera-track.js';
import profiles from './framed-profiles.json' with {type: 'json'};

export const CANVAS = Object.freeze({width: 1920, height: 1080, fps: 30});
const round = (v, d = 3) => Math.round(v * 10 ** d) / 10 ** d;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const SENTENCE_PAUSE = 0.6;
const CAMERA_FACE_RATIO = 0.32;

export function framedProfile(id = 'escritorio-v1') {
  const profile = profiles[id];
  if (!profile) throw Error(`Perfil desconocido: ${id}. Disponibles: ${Object.keys(profiles).join(', ')}`);
  return {id, ...structuredClone(profile)};
}

/**
 * A take is `camera` when the face fills the frame, `screen` otherwise. A screen
 * take keeps the webcam panel the recording already carries (OBS overlay), so the
 * bubble can be cut from the same file.
 */
export function classifyTake(clip, detection) {
  const panel = detection?.sourceBox ?? (detection && detection.method !== 'talking-head-face' && Number.isFinite(detection.w) ? detection : null);
  const webcam = panel ? {x: Math.round(panel.x), y: Math.round(panel.y), w: Math.round(panel.w), h: Math.round(panel.h)} : null;
  const faceFills = (clip.focus?.faceHeightRatio ?? 0) >= CAMERA_FACE_RATIO;
  if (faceFills && !webcam) return {kind: 'camera', webcam: null};
  return {kind: 'screen', webcam};
}

/** Card rectangle on the canvas: the clip contained in the canvas, then scaled and centred. */
export function cardRect(profile, clip) {
  const fit = Math.min(CANVAS.width / clip.width, CANVAS.height / clip.height) * profile.card.scale;
  const w = clip.width * fit, h = clip.height * fit;
  return {x: (CANVAS.width - w) / 2, y: (CANVAS.height - h) / 2, w, h, k: fit};
}

export function toCanvas(box, card) {
  return {x: card.x + box.x * card.k, y: card.y + box.y * card.k, w: box.w * card.k, h: box.h * card.k};
}

/** Where the webcam bubble sits. `embedded` covers the panel the recording already has. */
export function bubbleRect(profile, card, webcam) {
  const b = profile.bubble;
  if (b.placement === 'embedded') {
    const r = toCanvas(webcam, card);
    const padded = {x: r.x - b.pad, y: r.y - b.pad, w: r.w + 2 * b.pad, h: r.h + 2 * b.pad};
    // Grows from its outer corner, so it keeps covering the embedded panel.
    const s = b.scale ?? 1, o = bubbleOrigin(padded);
    return {x: padded.x - (s - 1) * padded.w * (1 - o.x), y: padded.y - (s - 1) * padded.h * (1 - o.y), w: padded.w * s, h: padded.h * s};
  }
  if (b.placement !== 'corner') throw Error('bubble.placement debe ser embedded o corner');
  const w = b.width, h = w * webcam.h / webcam.w;
  const right = b.corner.endsWith('right'), bottom = b.corner.startsWith('bottom');
  return {x: right ? CANVAS.width - b.margin - w : b.margin, y: bottom ? CANVAS.height - b.margin - h : b.margin, w, h};
}

/** The bubble shrinks towards the canvas corner nearest to it. */
export function bubbleOrigin(rect) {
  return {x: rect.x + rect.w / 2 > CANVAS.width / 2 ? 1 : 0, y: rect.y + rect.h / 2 > CANVAS.height / 2 ? 1 : 0};
}

/** Stage camera that frames a canvas box with the profile's fill, inside the canvas. */
export function zoomFor(box, profile) {
  const z = profile.zoom;
  const raw = z.fill * Math.min(CANVAS.width / box.w, CANVAS.height / box.h);
  const zoom = round(Math.min(z.maxZoom, raw), 4);
  const half = 1 / (2 * zoom);
  return {zoom, x: round(clamp((box.x + box.w / 2) / CANVAS.width, half, 1 - half), 5), y: round(clamp((box.y + box.h / 2) / CANVAS.height, half, 1 - half), 5), raw: round(raw, 3)};
}

/** Share of the canvas where the patched webcam area shows outside the bubble at a given camera. */
export function patchReveal(webcamCanvas, bubble, camera) {
  const crop = cameraCrop({x: 0, y: 0, w: CANVAS.width, h: CANVAS.height}, camera);
  const s = CANVAS.width / crop.w;
  const r = {x: (webcamCanvas.x - crop.x) * s, y: (webcamCanvas.y - crop.y) * s, w: webcamCanvas.w * s, h: webcamCanvas.h * s};
  const area = (a) => Math.max(0, a.w) * Math.max(0, a.h);
  const cut = (a, b) => ({x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), w: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)});
  const visible = cut(r, {x: 0, y: 0, w: CANVAS.width, h: CANVAS.height});
  if (visible.w <= 0 || visible.h <= 0) return 0;
  const hidden = cut(visible, bubble);
  return round((area(visible) - (hidden.w > 0 && hidden.h > 0 ? area(hidden) : 0)) / (CANVAS.width * CANVAS.height), 4);
}

/** Without untilWord: the sentence end, or the word that completes the default hold if that comes first. */
export function defaultUntil(words, index, z) {
  const end = sentenceEnd(words, index);
  for (let j = index; j < end; j++) if (words[j].end - words[index].start >= z.inSeconds + z.defaultHoldSeconds) return j;
  return end;
}

/** Last word of the sentence that holds `index`. */
export function sentenceEnd(words, index) {
  for (let i = index; i < words.length - 1; i++) {
    if (/[.!?]$/.test(String(words[i].text ?? '').trim()) || words[i + 1].start - words[i].end > SENTENCE_PAUSE) return i;
  }
  return words.length - 1;
}

const NUMBER = /\d|%|€|\$/;
const NUMBER_WORDS = /^(cero|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|cien|ciento|mil|millon|millones|billon|billones|doble|triple|mitad|porcentaje|euros|dolares)$/;
const POINTERS = /^(aqui|fijaos|mirad|veis|vemos|podeis|fijate|mira|grafica|tabla|precio|precios|benchmark|dato|datos|puntuacion|resultado|resultados|columna|boton|captura|pantalla)$/;
const plain = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N}%€$]+/gu, '');

/**
 * Moments worth a look: numbers and pointing words in screen takes, on the edit
 * clock. Only a suggestion list for the agent; it decides after seeing the frame.
 */
export function zoomCandidates(plan, clips, takes) {
  const out = [];
  for (const seg of plan.segments) {
    const info = takes[seg.clipId];
    if (info?.kind !== 'screen') continue;
    const words = clips.find((c) => c.id === seg.clipId)?.words ?? [];
    let last = -Infinity;
    words.forEach((w, i) => {
      if (!(w.start >= seg.in && w.start < seg.out)) return;
      const t = plain(w.text);
      const kind = NUMBER.test(t) || NUMBER_WORDS.test(t) ? 'numero' : POINTERS.test(t) ? 'senala' : null;
      if (!kind || w.start - last < 4) return;
      last = w.start;
      let s = i;
      while (s > 0 && !/[.!?]$/.test(String(words[s - 1].text ?? '').trim()) && words[s].start - words[s - 1].end <= SENTENCE_PAUSE) s--;
      const e = Math.min(sentenceEnd(words, i), i + 12);
      out.push({clipId: seg.clipId, atWord: i, word: String(w.text).trim(), kind, at: round(seg.at + w.start - seg.in), sourceSeconds: round(w.start),
        context: words.slice(Math.max(s, i - 12), e + 1).map((x, k) => (Math.max(s, i - 12) + k === i ? '[' : '') + String(x.text ?? '').trim() + (Math.max(s, i - 12) + k === i ? ']' : '')).join(' ')});
    });
  }
  return out;
}

/** Face crop of a camera take for the corner bubble: the bubble's aspect, the face at faceShare of its height. */
export function faceCrop(clip, cam) {
  const f = clip.faceBox ?? {x: clip.width * 0.4, y: clip.height * 0.25, w: clip.width * 0.2, h: clip.height * 0.4};
  const aspect = cam.bubble.aspect;
  let h = Math.min(clip.height, f.h / cam.bubble.faceShare), w = h * aspect;
  if (w > clip.width) {w = clip.width; h = w / aspect;}
  const cx = f.x + f.w / 2, cy = f.y + f.h / 2 + h * 0.08;
  return {x: round(clamp(cx - w / 2, 0, clip.width - w), 1), y: round(clamp(cy - h / 2, 0, clip.height - h), 1), w: round(w, 1), h: round(h, 1)};
}

export function cameraBubbleRect(cam) {
  const b = cam.bubble, w = b.width, h = w / b.aspect;
  const right = b.corner.endsWith('right'), bottom = b.corner.startsWith('bottom');
  return {x: right ? CANVAS.width - b.margin - w : b.margin, y: bottom ? CANVAS.height - b.margin - h : b.margin, w, h};
}

export const SHOT_LAYOUTS = Object.freeze(['corner', 'cover']);

/**
 * Shots over camera takes: an asset in a card with the face in the corner bubble
 * (corner), or covering everything while the voice goes on (cover). The agent says
 * where and which asset; the profile says how long at most and how it enters.
 */
export function frameShots(plan, {clips, takes, shots = [], assets = {}, profile, kit = {}}) {
  const sh = profile.camera.shots;
  const errors = [], warnings = [], decisions = [];
  const inserts = plan.decisions.filter((d) => d.type === 'insert');
  const resolved = [];
  for (const [n, cue] of shots.entries()) {
    const label = `plano ${n + 1} (${cue.clipId}:${cue.atWord})`;
    const clip = clips.find((x) => x.id === cue.clipId), info = takes[cue.clipId];
    const words = clip?.words ?? [], word = words[cue.atWord];
    if (!clip || !info) {errors.push(`${label}: la toma no existe`); continue;}
    if (info.kind !== 'camera') {errors.push(`${label}: los planos son para tomas a camara; en una toma de pantalla usa zooms`); continue;}
    if (!Number.isInteger(cue.atWord) || !Number.isFinite(word?.start)) {errors.push(`${label}: atWord no es una palabra de la transcripcion`); continue;}
    if (!SHOT_LAYOUTS.includes(cue.layout)) {errors.push(`${label}: layout debe ser ${SHOT_LAYOUTS.join(' o ')}`); continue;}
    const asset = assets[cue.asset];
    if (!asset) {errors.push(`${label}: el recurso "${cue.asset}" no existe (disponibles: ${Object.keys(assets).join(', ') || 'ninguno; ejecutar assets'})`); continue;}
    if (!cue.reason || String(cue.reason).trim().length < 8) errors.push(`${label}: falta reason (que frase lo pide)`);
    const seg = plan.segments.find((x) => x.clipId === cue.clipId && word.start >= x.in && word.start < x.out);
    if (!seg) {errors.push(`${label}: esa palabra cae en un trozo recortado del montaje`); continue;}
    const segEnd = seg.at + seg.out - seg.in;
    const at = round(Math.max(seg.at, seg.at + word.start - seg.in - sh.leadSeconds));
    let untilWord = cue.untilWord;
    if (untilWord == null) {
      untilWord = sentenceEnd(words, cue.atWord);
      for (let j = cue.atWord; j < untilWord; j++) if (words[j].end - word.start >= sh.defaultSeconds) {untilWord = j; break;}
    }
    if (!Number.isInteger(untilWord) || untilWord < cue.atWord || !Number.isFinite(words[untilWord]?.end)) {errors.push(`${label}: untilWord invalido`); continue;}
    let until = Math.min(seg.at + words[untilWord].end - seg.in, segEnd);
    if (until - at > sh.maxSeconds) {until = at + sh.maxSeconds; warnings.push(`${label}: dura ${sh.maxSeconds} s como maximo (camera.shots.maxSeconds)`);}
    until = round(until);
    if (until - at < sh.minSeconds) {errors.push(`${label}: solo duraria ${round(until - at, 2)} s (minimo ${sh.minSeconds}); alargar untilWord (el trozo acaba en ${round(segEnd, 2)} s)`); continue;}
    const clash = inserts.find((d) => at < d.until && until > d.at);
    if (clash) {errors.push(`${label}: coincide con el recurso ${clash.names?.join(' + ')} (${clash.at}-${clash.until} s)`); continue;}
    resolved.push({...cue, untilWord, at, until, kind: asset.kind});
  }
  resolved.sort((a, b) => a.at - b.at);
  for (let i = 1; i < resolved.length; i++) if (resolved[i].at < resolved[i - 1].until) errors.push(`plano en ${resolved[i].at} s: se solapa con el anterior (acaba en ${resolved[i - 1].until} s)`);
  let missingSound = false;
  for (const r of resolved) {
    decisions.push({type: 'insert', shot: true, at: r.at, until: r.until, layout: r.layout, resources: [r.asset], names: [r.asset], kinds: [r.kind],
      clipId: r.clipId, atWord: r.atWord, untilWord: r.untilWord, reason: r.reason});
    if (sh.sound && r.sound !== false) {
      if (kit.sounds?.[sh.sound]?.length) decisions.push({type: 'sfx', at: r.at, event: 'shot-in', family: sh.sound, lead: 0, gain: sh.soundGain ?? 1, reason: `Entrada de plano (camera.shots.sound ${sh.sound})`});
      else missingSound = true;
    }
  }
  if (missingSound) warnings.push(`El kit no tiene sonidos de la familia ${sh.sound}: planos sin sonido`);
  // Floor of visible change: a long stretch with only the face asks for a shot.
  const spans = plan.segments.filter((x) => takes[x.clipId]?.kind === 'camera').map((x) => [x.at, x.at + x.out - x.in]);
  const covered = [...resolved.map((r) => [r.at, r.until]), ...inserts.map((d) => [d.at, d.until])];
  let run = null;
  const flush = (end) => {
    if (run !== null && end - run > sh.maxFaceOnlySeconds) warnings.push(`${round(end - run, 1)} s seguidos solo con tu cara (${round(run, 1)}-${round(end, 1)} s): anadir un plano con un recurso (camera.shots.maxFaceOnlySeconds)`);
    run = null;
  };
  for (let t = 0; t < plan.duration; t = round(t + 0.25)) {
    const face = spans.some(([a, b]) => t >= a && t < b) && !covered.some(([a, b]) => t >= a && t < b);
    if (face && run === null) run = t;
    if (!face) flush(t);
  }
  flush(plan.duration);
  const cover = resolved.filter((r) => r.layout === 'cover').reduce((sum, r) => sum + r.until - r.at, 0);
  if (plan.duration && cover / plan.duration > sh.maxCoverShare) warnings.push(`Los recursos tapan tu cara el ${Math.round(cover / plan.duration * 100)} % del video (camera.shots.maxCoverShare ${sh.maxCoverShare * 100} %)`);
  return {errors, warnings, decisions, shots: resolved};
}

/**
 * Shots drafted from the asset requests themselves: an asset that says where it
 * belongs (`at: "toma:palabra"`, optional `until`, optional `layout`) becomes a shot.
 * Video covers by default; images, pages and posts go in the corner card.
 */
export function draftShots(requests, catalog) {
  const ref = (s) => {
    const m = /^(\w+):(\d+)$/.exec(String(s ?? '').trim());
    return m ? {clipId: m[1], word: Number(m[2])} : null;
  };
  return (requests.assets ?? []).filter((a) => ref(a.at) && catalog[a.id]).map((a) => {
    const at = ref(a.at), until = ref(a.until);
    return {clipId: at.clipId, atWord: at.word, ...(until && until.clipId === at.clipId ? {untilWord: until.word} : {}),
      layout: a.layout ?? (catalog[a.id].kind === 'video' ? 'cover' : 'corner'), asset: a.id, reason: a.reason};
  });
}

/**
 * What the agent reads to find assets and anchor shots: kept speech only, in
 * phrases, with the edit time and the `clipId:word` range of each phrase.
 */
export function transcriptMarkdown(plan, clips, takes) {
  const clock = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const lines = ['# Transcripcion del montaje', '', 'Cada linea: minuto del montaje · `toma:primera-ultima palabra` · texto. Los planos y zooms se anclan con esos indices.', ''];
  for (const seg of plan.segments) {
    const words = clips.find((c) => c.id === seg.clipId)?.words ?? [];
    const kind = takes[seg.clipId]?.kind ?? '?';
    let phrase = [];
    const flush = () => {
      if (!phrase.length) return;
      const [a, b] = [phrase[0], phrase.at(-1)];
      lines.push(`- ${clock(seg.at + words[a].start - seg.in)} · \`${seg.clipId}:${a}-${b}\` · ${kind === 'camera' ? '' : '(pantalla) '}${phrase.map((i) => String(words[i].text ?? '').trim()).join(' ')}`);
      phrase = [];
    };
    words.forEach((w, i) => {
      if (!(w.start >= seg.in && w.start < seg.out)) return;
      if (phrase.length && (w.start - words[phrase.at(-1)].end > 0.5 || phrase.length >= 16)) flush();
      phrase.push(i);
      if (/[.!?]$/.test(String(w.text ?? '').trim())) flush();
    });
    flush();
  }
  return lines.join('\n') + '\n';
}

/**
 * Turn the agent's zooms into stage camera keys and push decisions, enforcing the
 * profile's rhythm. Errors stop the build; warnings go to the review.
 */
export function frameEditPlan(plan, {clips, takes, zooms, shots = [], assets = {}, profile, kit = {}}) {
  const z = profile.zoom;
  const segments = plan.segments.map(({zoom, layout, ...s}) => s);
  const framedShots = frameShots({...plan, segments}, {clips, takes, shots, assets, profile, kit});
  const errors = [...framedShots.errors], warnings = [...framedShots.warnings];
  const decisions = [...plan.decisions.filter((d) => d.type !== 'push' && d.type !== 'punch-in'), ...framedShots.decisions];
  const inserts = decisions.filter((d) => d.type === 'insert');
  const resolved = [];
  for (const [n, cue] of (zooms ?? []).entries()) {
    const label = `zoom ${n + 1} (${cue.clipId}:${cue.atWord})`;
    const clip = clips.find((c) => c.id === cue.clipId);
    const info = takes[cue.clipId];
    const words = clip?.words ?? [];
    const word = words[cue.atWord];
    if (!clip || !info) {errors.push(`${label}: la toma no existe`); continue;}
    if (info.kind === 'camera') {errors.push(`${label}: en una toma a camara no hay pantalla que ampliar; usar un plano con un recurso (planos.json)`); continue;}
    if (!Number.isInteger(cue.atWord) || !Number.isFinite(word?.start)) {errors.push(`${label}: atWord no es una palabra de la transcripcion`); continue;}
    if (!cue.reason || String(cue.reason).trim().length < 8) errors.push(`${label}: falta reason (que se ve y por que importa)`);
    const box = cue.box;
    if (!box || !['x', 'y', 'w', 'h'].every((k) => Number.isFinite(box[k])) || box.w < 16 || box.h < 16 || box.x < 0 || box.y < 0 || box.x + box.w > clip.width + 1 || box.y + box.h > clip.height + 1) {
      errors.push(`${label}: box {x,y,w,h} debe estar dentro de la toma (${clip.width}x${clip.height} px)`); continue;
    }
    const seg = segments.find((s) => s.clipId === cue.clipId && word.start >= s.in && word.start < s.out);
    if (!seg) {errors.push(`${label}: esa palabra cae en un trozo recortado del montaje`); continue;}
    const until = cue.untilWord ?? defaultUntil(words, cue.atWord, z);
    if (!Number.isInteger(until) || until < cue.atWord || !Number.isFinite(words[until]?.end)) {errors.push(`${label}: untilWord invalido`); continue;}
    const segEnd = seg.at + seg.out - seg.in;
    const at = round(Math.max(seg.at, seg.at + word.start - seg.in - z.leadSeconds));
    let holdEnd = Math.min(seg.at + words[until].end - seg.in, segEnd - z.outSeconds);
    if (holdEnd - (at + z.inSeconds) > z.maxHoldSeconds) {
      holdEnd = at + z.inSeconds + z.maxHoldSeconds;
      warnings.push(`${label}: se mantiene ${z.maxHoldSeconds} s como maximo (zoom.maxHoldSeconds); usar untilWord para soltar antes`);
    }
    if (holdEnd - (at + z.inSeconds) < z.minHoldSeconds) {
      errors.push(`${label}: solo quedaria ${round(holdEnd - at - z.inSeconds, 2)} s quieto (minimo ${z.minHoldSeconds}); alargar untilWord o elegir otra palabra (el trozo acaba en ${round(segEnd, 2)} s)`);
      continue;
    }
    holdEnd = round(holdEnd);
    const card = cardRect(profile, clip);
    const target = zoomFor(toCanvas(box, card), profile);
    if (target.raw < z.minZoom) {errors.push(`${label}: la caja es casi toda la pantalla (zoom ${target.raw}); un zoom asi no destaca nada`); continue;}
    if (target.zoom * card.k > z.maxSourceUpscale) warnings.push(`${label}: amplia los pixeles de la grabacion ${round(target.zoom * card.k, 2)}x; revisar nitidez o usar una caja mayor`);
    if (target.raw > z.maxZoom) warnings.push(`${label}: la caja pediria ${target.raw}x; se limita a ${z.maxZoom}x (zoom.maxZoom)`);
    const outEnd = round(holdEnd + z.outSeconds);
    const clash = inserts.find((d) => at < d.until && outEnd > d.at);
    if (clash) {errors.push(`${label}: coincide con el recurso ${clash.names?.join(' + ') ?? clash.resources} (${clash.at}-${clash.until} s)`); continue;}
    resolved.push({...cue, untilWord: until, at, inEnd: round(at + z.inSeconds), holdEnd, outEnd, target, card, webcam: info.webcam, kind: info.kind});
  }
  resolved.sort((a, b) => a.at - b.at);
  for (let i = 1; i < resolved.length; i++) {
    const gap = resolved[i].at - resolved[i - 1].outEnd;
    if (gap < z.minGapSeconds) errors.push(`zoom en ${resolved[i].at} s: empieza ${round(gap, 2)} s despues del anterior (minimo ${z.minGapSeconds}, zoom.minGapSeconds)`);
  }
  for (const r of resolved) {
    const inWindow = resolved.filter((x) => x.at >= r.at && x.at < r.at + 60).length;
    if (inWindow > z.maxPerMinute) {errors.push(`demasiados zooms: ${inWindow} en el minuto que empieza en ${r.at} s (maximo ${z.maxPerMinute}, zoom.maxPerMinute)`); break;}
  }

  const keys = [{time: 0, zoom: 1, x: 0.5, y: 0.5}];
  let missingSound = false;
  for (const r of resolved) {
    const hold = r.holdEnd - r.inEnd;
    const {raw, ...target} = r.target;
    const drift = {...target, zoom: round(target.zoom * (1 + z.driftPerSecond * hold), 4)};
    if (r.at > keys.at(-1).time) keys.push({time: r.at, zoom: 1, x: 0.5, y: 0.5});
    keys.push({time: r.inEnd, ...target, ease: z.ease}, {time: r.holdEnd, ...drift, ease: 'linear'}, {time: r.outEnd, zoom: 1, x: 0.5, y: 0.5, ease: z.ease});
    if (r.kind === 'screen' && r.webcam) {
      const bubble = bubbleRect(profile, r.card, r.webcam), o = bubbleOrigin(bubble), s = profile.bubble.zoomedScale ?? 1;
      const shrunk = {x: bubble.x + (bubble.w - bubble.w * s) * o.x, y: bubble.y + (bubble.h - bubble.h * s) * o.y, w: bubble.w * s, h: bubble.h * s};
      const reveal = patchReveal(toCanvas(r.webcam, r.card), shrunk, drift);
      if (reveal > z.patchRevealWarn) warnings.push(`zoom en ${r.at} s: deja ver ${round(reveal * 100, 1)} % del parche que tapa la webcam incrustada; revisar el fotograma`);
    }
    decisions.push({type: 'push', at: r.at, clipId: r.clipId, atWord: r.atWord, untilWord: r.untilWord, from: 1, to: target.zoom, seconds: z.inSeconds, easing: z.ease, box: r.box, target,
      reason: r.reason});
    decisions.push({type: 'push', at: r.holdEnd, clipId: r.clipId, from: drift.zoom, to: 1, seconds: z.outSeconds, easing: z.ease, reason: 'Vuelta al plano'});
    if (z.sound && r.sound !== false) {
      if (kit.sounds?.[z.sound]?.length) decisions.push({type: 'sfx', at: round(Math.max(0, r.at)), event: 'zoom-in', family: z.sound, lead: 0, gain: z.soundGain ?? 1, reason: `Zoom con sonido (zoom.sound ${z.sound})`});
      else missingSound = true;
    }
  }
  if (missingSound) warnings.push(`El kit no tiene sonidos de la familia ${z.sound}: zooms sin sonido`);
  return {
    errors,
    plan: {...plan, style: 'escritorio', profileId: profile.id, segments, decisions: decisions.sort((a, b) => a.at - b.at), warnings: [...plan.warnings, ...warnings],
      stage: {camera: {keys}}, zooms: resolved.map(({card, ...r}) => r), shots: framedShots.shots}
  };
}

/** Canvas-pixel layer: placed in `rect`, the (optionally cropped) media fitted inside it. */
function rectLayer({id, type, file, from, duration, sourceIn = 0, volume = 0, width, height, rect, fit = 'cover', crop, frame, patches, stage, name, trackIndex, enter}) {
  return {id, type, file, from, duration, sourceIn, volume, width, height, rect: roundRect(rect), fit, ...(crop ? {crop} : {}), ...(frame ? {frame} : {}), ...(patches?.length ? {patches} : {}),
    ...(enter ? {enter: {...enter, ...(enter.from ? {from: roundRect(enter.from)} : {})}} : {}),
    ...(stage ? {stage: true} : {}), transform: {x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, opacity: 1}, curves: {}, z: 0, trackIndex, name};
}
const roundRect = (r) => ({x: round(r.x, 2), y: round(r.y, 2), w: round(r.w, 2), h: round(r.h, 2)});

/** Render plan for the stage: wallpaper, cards, bubble, resources; audio and brand from the base compiler. */
export function compileFramedPlan(plan, {clips, takes, profile, wallpaper, kit = {}, assets = []}) {
  const frameOf = (s) => Math.round(s * CANVAS.fps);
  const byId = new Map([...clips, ...assets].map((c) => [c.id, c]));
  const base = compileEditPlan({...plan, segments: [], decisions: plan.decisions.filter((d) => ['sfx', 'sticker', 'outro', 'music'].includes(d.type))}, {clips, kit, assets});
  const total = base.durationInFrames;
  const outroAt = plan.decisions.find((d) => d.type === 'outro')?.at;
  const stageFrames = Number.isFinite(outroAt) ? frameOf(outroAt) : total;
  const cardFrame = {radius: profile.card.radius, shadow: profile.card.shadow};
  const b = profile.bubble;
  const layers = [rectLayer({id: 'wallpaper', type: 'image', file: wallpaper.file, from: 0, duration: stageFrames, width: wallpaper.width, height: wallpaper.height,
    rect: {x: 0, y: 0, w: CANVAS.width, h: CANVAS.height}, fit: 'cover', stage: true, name: 'wallpaper', trackIndex: -2})];
  const full = {x: 0, y: 0, w: CANVAS.width, h: CANVAS.height};
  const cam = profile.camera, camBubble = cameraBubbleRect(cam);
  const shotDecisions = plan.decisions.filter((d) => d.type === 'insert' && d.shot);
  for (const [i, seg] of plan.segments.entries()) {
    const clip = byId.get(seg.clipId), info = takes[seg.clipId];
    const from = frameOf(seg.at), duration = frameOf(seg.at + seg.out - seg.in) - from;
    if (info?.kind === 'camera') {
      // Face pieces: full screen, or the bubble while a corner shot runs; the voice never stops.
      const segEnd = seg.at + seg.out - seg.in;
      const bounds = [...new Set([seg.at, ...shotDecisions.flatMap((d) => [d.at, d.until]).filter((t) => t > seg.at && t < segEnd), segEnd])].sort((a, b) => a - b);
      let previous = null;
      bounds.slice(0, -1).forEach((a, k) => {
        const b = bounds[k + 1], shot = shotDecisions.find((d) => a >= d.at - 1e-6 && a < d.until - 1e-6);
        const layout = shot?.layout === 'corner' ? 'corner' : 'full';
        const f0 = frameOf(a), f1 = frameOf(b);
        if (f1 <= f0) return;
        // The face shrinks from full screen into the bubble and grows back; after a cover it simply reappears.
        const enter = layout === 'corner' && previous === 'full' ? {seconds: cam.enterSeconds, from: full}
          : layout === 'full' && !shot && previous === 'corner' ? {seconds: cam.enterSeconds, from: camBubble} : undefined;
        layers.push(rectLayer({id: `face-${i + 1}-${k + 1}`, type: 'video', file: clip.file, from: f0, duration: f1 - f0, sourceIn: round(seg.in + a - seg.at, 4), volume: 1,
          width: clip.width, height: clip.height, rect: layout === 'corner' ? camBubble : full, fit: 'cover', ...(layout === 'corner' ? {crop: faceCrop(clip, cam)} : {}),
          frame: layout === 'corner' ? {radius: cam.bubble.radius, shadow: cam.bubble.shadow, border: cam.bubble.border, borderColor: cam.bubble.borderColor} : undefined,
          enter, name: seg.sourceName, trackIndex: layout === 'corner' ? 5 : 1}));
        previous = shot?.layout === 'cover' ? 'cover' : layout;
      });
      continue;
    }
    const card = cardRect(profile, clip);
    const webcam = info?.kind === 'screen' ? info.webcam : null;
    layers.push(rectLayer({id: `card-${i + 1}`, type: 'video', file: clip.file, from, duration, sourceIn: seg.in, volume: 1, width: clip.width, height: clip.height,
      rect: card, fit: 'contain', frame: cardFrame, stage: true, name: seg.sourceName, trackIndex: -1,
      patches: webcam ? [{...webcam, color: info.patchColor ?? '#111111'}] : []}));
    if (webcam) layers.push(rectLayer({id: `cam-${i + 1}`, type: 'video', file: clip.file, from, duration, sourceIn: seg.in, volume: 0, width: clip.width, height: clip.height,
      rect: bubbleRect(profile, card, webcam), fit: 'cover', crop: webcam, frame: {radius: b.radius, shadow: b.shadow, border: b.border, borderColor: b.borderColor},
      name: 'webcam', trackIndex: 5}));
    // While the stage is zoomed the bubble steps aside towards its corner instead of covering what is shown.
    if (webcam && b.zoomedScale < 1) Object.assign(layers.at(-1), {stageShrink: {scale: b.zoomedScale, originX: bubbleOrigin(layers.at(-1).rect).x, originY: bubbleOrigin(layers.at(-1).rect).y, fullAtZoom: b.shrinkFullAtZoom}});
  }
  for (const d of shotDecisions) {
    const item = byId.get(d.resources[0]);
    const card = cardRect(profile, {width: CANVAS.width, height: CANVAS.height});
    const shrink = {x: card.x + card.w * 0.04, y: card.y + card.h * 0.04, w: card.w * 0.92, h: card.h * 0.92};
    const length = item.kind === 'image' ? d.until - d.at : item.durationSeconds;
    // A clip shorter than the shot starts again, as with the other resources.
    // A corner card stays under the face while it grows back, so the bare wallpaper never shows.
    const until = d.layout === 'corner' ? Math.min(plan.duration, d.until + cam.enterSeconds) : d.until;
    for (let at = d.at, k = 0; at < until - 1 / CANVAS.fps; at += length, k++) {
      layers.push(rectLayer({id: `shot-${d.resources[0]}-${k}-${d.at}`, type: item.kind === 'image' ? 'image' : 'video', file: item.file, from: frameOf(at),
        duration: frameOf(Math.min(until, at + length)) - frameOf(at), width: item.width, height: item.height,
        ...(d.layout === 'cover' ? {rect: full, fit: 'cover', trackIndex: 4, enter: k ? undefined : {seconds: 0.25, fade: true}}
          : {rect: card, fit: 'contain', frame: {...cardFrame, background: '#0d0f14'}, stage: true, trackIndex: 2, enter: k ? undefined : {seconds: cam.enterSeconds, from: shrink, fade: true}}),
        name: item.name ?? d.resources[0]}));
    }
  }
  for (const d of plan.decisions.filter((x) => x.type === 'insert' && !x.shot)) {
    const card = cardRect(profile, {width: CANVAS.width, height: CANVAS.height});
    const gap = 28, n = d.resources.length;
    d.resources.forEach((id, i) => {
      const item = byId.get(id);
      const slot = {x: card.x + i * (card.w + gap) / n, y: card.y, w: (card.w - gap * (n - 1)) / n, h: card.h};
      const span = d.until - d.at, length = item.kind === 'image' ? span : item.durationSeconds;
      for (let at = d.at, k = 0; at < d.until - 1 / CANVAS.fps; at += length, k++) {
        layers.push(rectLayer({id: `ins-${id}-${k}-${d.at}`, type: item.kind === 'image' ? 'image' : 'video', file: item.file, from: frameOf(at),
          duration: frameOf(Math.min(d.until, at + length)) - frameOf(at), width: item.width, height: item.height, rect: slot, fit: 'contain',
          frame: {...cardFrame, background: '#0d0f14'}, stage: true, name: item.sourceName ?? item.name ?? id, trackIndex: 2 + i}));
      }
    });
  }
  layers.push(...base.layers);
  layers.sort((a, b) => a.trackIndex - b.trackIndex || a.from - b.from);
  // Editorial notes stay in the edit plan; render-plan warnings are reserved for what the renderer cannot reproduce.
  return {...base, layers, warnings: [], stage: {camera: plan.stage.camera},
    provenance: {...base.provenance, style: 'escritorio', profile: profile.id, wallpaper: wallpaper.file, editorialNotes: plan.warnings}};
}

/** Camera sample used by previews and tests (same evaluator as the renderer). */
export function stageCameraAt(plan, seconds) {
  return cameraAt(plan.stage.camera, seconds);
}
