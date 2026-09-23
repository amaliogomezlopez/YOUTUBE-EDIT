/**
 * Aggregates normalized edits into measurable habits. Every figure keeps its
 * sample size so a planner can tell a habit (many videos) from an accident (one).
 */

const round = (v, d = 3) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);

export function quantiles(values) {
  const list = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!list.length) return {n: 0, p25: null, median: null, p75: null, p90: null};
  const at = (q) => {
    const i = (list.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
    return round(list[lo] + (list[hi] - list[lo]) * (i - lo));
  };
  return {n: list.length, p25: at(0.25), median: at(0.5), p75: at(0.75), p90: at(0.9)};
}

function share(count, total) {
  return {count, of: total, share: total ? round(count / total, 2) : null};
}

function tally(items, key) {
  const counts = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1]));
}

function perMinute(edits, pick) {
  return quantiles(edits.map((e) => pick(e).length / (e.duration / 60)));
}

function layoutShare(edit) {
  const seconds = {full: 0, right: 0, left: 0, pip: 0};
  for (const take of edit.takes) seconds[take.layout] = (seconds[take.layout] ?? 0) + take.duration;
  const total = Object.values(seconds).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(seconds).map(([k, v]) => [k, v / total]));
}

export function buildStyleProfile(edits, {format}) {
  const set = edits.filter((e) => e.format === format && e.duration > 0);
  const moves = set.flatMap((e) => e.cameraMoves);
  const takes = set.flatMap((e) => e.takes);
  const inserts = set.flatMap((e) => e.inserts);
  const sounds = set.flatMap((e) => e.sounds);
  const music = set.flatMap((e) => e.music);
  const stickers = set.flatMap((e) => e.stickers);
  const layouts = set.map(layoutShare);
  const opening = (e) => e.stickers.some((s) => s.at < 5);
  const lastIsBrand = (e) => {
    const end = [...e.takes, ...e.inserts].sort((a, b) => (b.at + b.duration) - (a.at + a.duration))[0];
    return end ? end.at + end.duration >= e.duration - 0.5 && end.duration < 15 : false;
  };
  const eventsOfSounds = {};
  for (const s of sounds) {
    eventsOfSounds[s.event] ??= {};
    eventsOfSounds[s.event][s.family] = (eventsOfSounds[s.event][s.family] ?? 0) + 1;
  }
  const HOOK_SECONDS = 20, OUTRO_SECONDS = 60;
  const hookPunches = set.map((e) => e.takes.filter((t) => t.at < HOOK_SECONDS && t.staticZoom > 1.03));
  const spacing = hookPunches.flatMap((list) => list.slice(1).map((t, i) => t.at - list[i].at));
  const cutsWithSound = set.map((e) => {
    const cuts = e.takes.slice(1).filter((t) => t.jumpCutGap == null).length;
    return cuts ? e.sounds.filter((x) => x.event === 'take-change').length / cuts : null;
  });
  return {
    version: 1,
    kind: 'editorial-style-profile',
    format,
    videos: set.length,
    minutes: round(set.reduce((a, e) => a + e.duration, 0) / 60, 1),
    status: 'measured-not-approved',
    takes: {
      seconds: quantiles(takes.map((t) => t.duration)),
      perMinute: perMinute(set, (e) => e.takes),
      headTrimSeconds: quantiles(takes.filter((t) => t.jumpCutGap == null).map((t) => t.sourceIn)),
      jumpCutsPerMinute: perMinute(set, (e) => e.takes.filter((t) => t.jumpCutGap != null)),
      jumpCutGapSeconds: quantiles(takes.map((t) => t.jumpCutGap).filter((g) => g != null && g >= 0))
    },
    camera: {
      movesPerMinute: perMinute(set, (e) => e.cameraMoves),
      moveSeconds: quantiles(moves.map((m) => m.duration)),
      peakZoom: quantiles(moves.map((m) => Math.max(m.from, m.to))),
      amplitude: quantiles(moves.map((m) => Math.abs(m.to - m.from))),
      curveShare: share(moves.filter((m) => m.easing === 'curve').length, moves.length),
      staticPunchIn: share(takes.filter((t) => t.staticZoom > 1.03).length, takes.length),
      videosWithMoves: share(set.filter((e) => e.cameraMoves.length).length, set.length)
    },
    hook: {
      videosWithPunchIns: share(hookPunches.filter((list) => list.length).length, set.length),
      punchInsPerVideo: quantiles(hookPunches.map((list) => list.length)),
      punchInZoom: quantiles(hookPunches.flat().map((t) => t.staticZoom)),
      punchInSpacingSeconds: quantiles(spacing),
      punchInSound: tally(set.flatMap((e) => e.sounds.filter((x) => x.at < HOOK_SECONDS && x.event === 'jump-cut')), (x) => x.family),
      videosWithEarlyMoves: share(set.filter((e) => e.cameraMoves.some((m) => m.track === 0 && m.at < 30)).length, set.length),
      // Hook zooms are short and stacked, unlike the slow pushes of the body.
      zoomsPerVideo: quantiles(set.map((e) => e.cameraMoves.filter((m) => m.to > m.from && m.at < HOOK_SECONDS).length)),
      zoomSeconds: quantiles(set.flatMap((e) => e.cameraMoves.filter((m) => m.to > m.from && m.at < HOOK_SECONDS).map((m) => m.duration))),
      zoomPeak: quantiles(set.flatMap((e) => e.cameraMoves.filter((m) => m.to > m.from && m.at < HOOK_SECONDS).map((m) => m.to))),
      videosZoomingAtStart: share(set.filter((e) => e.cameraMoves.some((m) => m.to > m.from && m.at < 1)).length, set.length),
      // The news capture flashed while the hook names it (a still over the speaker, not a backdrop).
      videosWithImage: share(set.filter((e) => e.inserts.some((i) => i.photo && i.at < HOOK_SECONDS && i.duration < 15)).length, set.length),
      imageSeconds: quantiles(set.flatMap((e) => e.inserts.filter((i) => i.photo && i.at < HOOK_SECONDS && i.duration < 15).map((i) => i.duration)))
    },
    outro: {
      videosWithMoves: share(set.filter((e) => e.cameraMoves.some((m) => m.track === 0 && m.at > e.duration - OUTRO_SECONDS)).length, set.length),
      moveSeconds: quantiles(set.flatMap((e) => e.cameraMoves.filter((m) => m.track === 0 && m.at > e.duration - OUTRO_SECONDS)).map((m) => m.duration))
    },
    cuts: {
      soundShare: quantiles(cutsWithSound.filter((x) => x != null)),
      soundFamily: tally(sounds.filter((x) => x.event === 'take-change'), (x) => x.family)
    },
    layout: {
      fullShare: quantiles(layouts.map((l) => l.full)),
      sideShare: quantiles(layouts.map((l) => l.left + l.right)),
      pipShare: quantiles(layouts.map((l) => l.pip)),
      cameraSide: tally(takes.filter((t) => t.layout === 'left' || t.layout === 'right'), (t) => t.layout)
    },
    inserts: {
      perMinute: perMinute(set, (e) => e.inserts.filter((i) => i.role === 'insert')),
      seconds: quantiles(inserts.filter((i) => i.role === 'insert').map((i) => i.duration)),
      muted: share(inserts.filter((i) => i.role === 'insert' && i.volume === 0).length, inserts.filter((i) => i.role === 'insert').length),
      fullscreen: share(inserts.filter((i) => i.role === 'insert' && i.layout === 'full' && i.scale >= 0.95).length, inserts.filter((i) => i.role === 'insert').length),
      screensPerVideo: quantiles(set.map((e) => e.inserts.filter((i) => i.role === 'screen').length))
    },
    sound: {
      sfxPerMinute: perMinute(set, (e) => e.sounds),
      sfxVolume: quantiles(sounds.map((s) => s.volume)),
      familyByEvent: eventsOfSounds,
      unmappedNames: tally(sounds.filter((s) => s.family === 'unmapped'), (s) => s.name),
      eventCoverage: tally(sounds, (s) => s.event),
      leadSecondsByEvent: Object.fromEntries(Object.keys(eventsOfSounds).filter((k) => k !== 'none')
        .map((k) => [k, quantiles(sounds.filter((s) => s.event === k).map((s) => s.lead))])),
      musicVideos: share(set.filter((e) => e.music.length).length, set.length),
      musicVolume: quantiles(music.map((m) => m.volume)),
      musicTracks: tally(music, (m) => m.name)
    },
    brand: {
      openingSticker: share(set.filter(opening).length, set.length),
      stickerSeconds: quantiles(stickers.map((s) => s.duration)),
      stickers: tally(stickers, (s) => s.name),
      closingAsset: share(set.filter(lastIsBrand).length, set.length),
      textsPerVideo: quantiles(set.map((e) => e.texts.length)),
      cameraEffects: tally(takes.flatMap((t) => t.effects.map((name) => ({name}))), (x) => x.name),
      transitions: tally(set.flatMap((e) => e.transitions), (t) => t.name)
    }
  };
}

const top = (counts, n = 3) => Object.entries(counts ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} (${v})`).join(', ') || '—';

/** Plain-language summary for the editor to confirm or correct; numbers stay in the JSON. */
export function summarizeStyle(p) {
  const s = p.sound, c = p.camera, t = p.takes, b = p.brand, i = p.inserts;
  const eventLines = Object.entries(s.familyByEvent).filter(([e]) => e !== 'none')
    .map(([event, families]) => `- ${event}: ${top(families)}; empieza ${s.leadSecondsByEvent[event]?.median ?? 0} s antes`);
  return [
    `# Estilo medido: ${p.format} (${p.videos} videos, ${p.minutes} min)`,
    '',
    `Estado: ${p.status}. Confirmar o corregir antes de usarlo como regla.`,
    '',
    '## Tomas y cortes',
    `- Toma tipica: ${t.seconds.median} s (p25 ${t.seconds.p25} / p75 ${t.seconds.p75}); ${t.perMinute.median} cambios por minuto.`,
    `- Recorte al inicio de cada toma: ${t.headTrimSeconds.median} s. Jump cuts dentro de una toma: ${t.jumpCutsPerMinute.median}/min.`,
    '',
    '## Camara',
    `- Movimientos de zoom: ${c.movesPerMinute.median}/min en ${c.videosWithMoves.count} de ${c.videosWithMoves.of} videos.`,
    `- Duracion ${c.moveSeconds.median} s, zoom maximo ${c.peakZoom.median} (p90 ${c.peakZoom.p90}), ${Math.round((c.curveShare.share ?? 0) * 100)} % con curva.`,
    `- Zoom fijo (punch-in) en ${Math.round((c.staticPunchIn.share ?? 0) * 100)} % de las tomas.`,
    '',
    '## Recursos',
    `- Inserciones: ${i.perMinute.median}/min, ${i.seconds.median} s; ${Math.round((i.fullscreen.share ?? 0) * 100)} % a pantalla completa.`,
    '',
    '## Sonido',
    `- Efectos: ${s.sfxPerMinute.median}/min, volumen ${s.sfxVolume.median}.`,
    ...eventLines,
    `- Musica en ${s.musicVideos.count} de ${s.musicVideos.of} videos, volumen ${s.musicVolume.median} (p90 ${s.musicVolume.p90}). Mas usadas: ${top(s.musicTracks)}.`,
    '',
    '## Marca',
    `- Sticker al abrir en ${b.openingSticker.count} de ${b.openingSticker.of}; stickers: ${top(b.stickers)}.`,
    `- Cierre con recurso propio en ${b.closingAsset.count} de ${b.closingAsset.of}.`,
    `- Transiciones: ${top(b.transitions, 4)}.`,
    ''
  ].join('\n');
}
