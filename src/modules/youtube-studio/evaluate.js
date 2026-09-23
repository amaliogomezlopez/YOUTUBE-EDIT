/**
 * Scores an automatic plan against the editor's real edit of the same takes.
 * Both are compared on each take's own clock (take name + source seconds), so a
 * different trim earlier in the video does not shift every later event.
 */

const round = (v, d = 3) => (Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const TOLERANCE = {punch: 0.6, move: 3, sound: 0.6, insert: 3};

function locate(pieces, t) {
  const piece = pieces.find((p) => t >= p.at - 1e-6 && t < p.at + (p.out - p.in) - 1e-6);
  return piece ? {name: piece.name, source: piece.in + (t - piece.at)} : null;
}

function match(planned, actual, tolerance) {
  const used = new Set();
  let hits = 0;
  const errors = [];
  for (const p of planned) {
    const best = actual.map((a, i) => ({a, i, d: Math.abs(a.source - p.source)}))
      .filter((x) => !used.has(x.i) && x.a.name === p.name && x.d <= tolerance).sort((x, y) => x.d - y.d)[0];
    if (best) {used.add(best.i); hits++; errors.push(best.d);}
  }
  return {planned: planned.length, actual: actual.length, matched: hits,
    precision: planned.length ? round(hits / planned.length, 2) : null,
    recall: actual.length ? round(hits / actual.length, 2) : null,
    meanError: errors.length ? round(errors.reduce((a, b) => a + b, 0) / errors.length) : null};
}

export function evaluatePlan(plan, edit) {
  const actualPieces = edit.takes.map((t) => ({name: t.name, in: t.sourceIn, out: t.sourceIn + t.duration, at: t.at, zoom: t.staticZoom}));
  const planPieces = plan.segments.map((s) => ({name: s.sourceName, in: s.in, out: s.out, at: s.at, zoom: s.zoom}));
  const names = [...new Set(planPieces.map((p) => p.name))];
  const trims = names.map((name) => {
    const a = actualPieces.filter((p) => p.name === name), b = planPieces.filter((p) => p.name === name);
    if (!a.length) return {name, missingInEdit: true};
    const span = (list) => ({in: Math.min(...list.map((p) => p.in)), out: Math.max(...list.map((p) => p.out)), kept: list.reduce((s, p) => s + p.out - p.in, 0)});
    const x = span(a), y = span(b);
    return {name, headError: round(y.in - x.in), tailError: round(y.out - x.out), keptRatio: round(y.kept / x.kept, 2)};
  });
  const matched = trims.filter((t) => !t.missingInEdit);
  const absMedian = (key) => {
    const list = matched.map((t) => Math.abs(t[key])).sort((a, b) => a - b);
    return list.length ? round(list[Math.floor((list.length - 1) / 2)]) : null;
  };
  const onClock = (pieces, events) => events.map((t) => locate(pieces, t + 0.01)).filter(Boolean);
  const punchPlan = onClock(planPieces, plan.decisions.filter((d) => d.type === 'punch-in').map((d) => d.at));
  const punchActual = onClock(actualPieces, edit.takes.filter((t) => t.staticZoom > 1.03).map((t) => t.at));
  const movePlan = onClock(planPieces, plan.decisions.filter((d) => d.type === 'push' && d.to > d.from).map((d) => d.at));
  const moveActual = onClock(actualPieces, edit.cameraMoves.filter((m) => m.track === 0 && m.to > m.from).map((m) => m.at));
  const soundPlan = onClock(planPieces, plan.decisions.filter((d) => d.type === 'sfx' || (d.type === 'punch-in' && d.sound)).map((d) => d.at + (d.lead ?? 0)));
  const soundActual = onClock(actualPieces, edit.sounds.filter((s) => s.event !== 'start').map((s) => s.at + (s.lead ?? 0)));
  // Inserts compare on the edit clock by resource name: during a composition the main track may be a backdrop.
  // Stills match by kind and time: the editor's capture files have arbitrary names (Capt22ura.PNG).
  const plannedInserts = plan.decisions.filter((d) => d.type === 'insert')
    .flatMap((d) => (d.names ?? []).map((name, i) => ({name: d.kinds?.[i] === 'image' ? 'image' : name, source: d.at})));
  const firstUse = new Map();
  for (const i of edit.inserts ?? []) if (!firstUse.has(i.name) || i.at < firstUse.get(i.name).at) firstUse.set(i.name, i);
  const actualInserts = [...firstUse.values()].map((i) => ({name: i.photo ? 'image' : i.name, source: i.at}));
  const has = (type) => plan.decisions.some((d) => d.type === type);
  return {
    version: 1,
    kind: 'autoplan-evaluation',
    duration: {plan: round(plan.duration, 1), edit: round(edit.duration, 1)},
    takes: {planned: names.length, inEdit: [...new Set(actualPieces.map((p) => p.name))].length,
      headErrorMedian: absMedian('headError'), tailErrorMedian: absMedian('tailError'),
      keptRatioMedian: matched.length ? round(matched.map((t) => t.keptRatio).sort((a, b) => a - b)[Math.floor((matched.length - 1) / 2)], 2) : null, byTake: trims},
    punchIns: match(punchPlan, punchActual, TOLERANCE.punch),
    moves: match(movePlan, moveActual, TOLERANCE.move),
    sounds: match(soundPlan, soundActual, TOLERANCE.sound),
    inserts: match(plannedInserts, actualInserts, TOLERANCE.insert),
    brand: {
      music: {plan: has('music'), edit: edit.music.length > 0, planVolume: plan.decisions.find((d) => d.type === 'music')?.volume ?? null,
        editVolume: edit.music[0]?.volume ?? null},
      sticker: {plan: has('sticker'), edit: edit.stickers.some((s) => s.at < 5)},
      outro: {plan: has('outro'), edit: edit.takes.at(-1)?.duration < 15}
    },
    tolerances: TOLERANCE
  };
}

export function summarizeEvaluation(e) {
  const pr = (m) => `${m.matched}/${m.actual} acertados (precision ${m.precision ?? '—'}, recall ${m.recall ?? '—'})`;
  return [
    `Duracion: plan ${e.duration.plan} s, edicion real ${e.duration.edit} s.`,
    `Recortes de toma: error mediano inicio ${e.takes.headErrorMedian} s, final ${e.takes.tailErrorMedian} s; conservado ${e.takes.keptRatioMedian}x.`,
    `Punch-ins: ${pr(e.punchIns)}.`,
    `Zooms: ${pr(e.moves)}.`,
    `Sonidos: ${pr(e.sounds)}.`,
    `Recursos: ${pr(e.inserts)}.`,
    `Musica ${e.brand.music.plan ? 'si' : 'no'} (real ${e.brand.music.edit ? 'si' : 'no'}), sticker ${e.brand.sticker.plan ? 'si' : 'no'} (real ${e.brand.sticker.edit ? 'si' : 'no'}), cierre ${e.brand.outro.plan ? 'si' : 'no'} (real ${e.brand.outro.edit ? 'si' : 'no'}).`
  ].join('\n');
}
