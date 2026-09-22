/**
 * Asks a language model *where* the edit should react, never *how much*: the
 * amounts come from the measured profile. The model only returns references to
 * sentences that exist; anything else is dropped by validateIntents.
 */

const SENTENCE_PAUSE = 0.6;

export function sentencesOf(clip) {
  const words = clip.words ?? [];
  const out = [];
  let start = 0;
  for (let i = 1; i <= words.length; i++) {
    const end = i === words.length || /[.!?]$/.test(String(words[i - 1].text ?? '').trim()) || words[i].start - words[i - 1].end > SENTENCE_PAUSE;
    if (end) {
      out.push({clipId: clip.id, atWord: start, text: words.slice(start, i).map((w) => String(w.text ?? '').trim()).join(' ')});
      start = i;
    }
  }
  return out;
}

const tokens = (text) => new Set(String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9ñ]+/).filter((t) => t.length > 3));

/** Examples whose words overlap most with this video, balanced across decision types. */
export function retrieveExamples(bank, text, {perType = 3} = {}) {
  const query = tokens(text);
  const score = (e) => {
    const own = tokens(`${e.context.before} ${e.context.during}`);
    let hits = 0;
    for (const t of own) if (query.has(t)) hits++;
    return own.size ? hits / Math.sqrt(own.size) : 0;
  };
  const byType = {};
  for (const e of bank) (byType[e.type] ??= []).push(e);
  return Object.values(byType).flatMap((list) => list.sort((a, b) => score(b) - score(a)).slice(0, perType));
}

export function buildIntentMessages({takes, examples}) {
  const lines = takes.flatMap((clip, take) => sentencesOf(clip).map((s) => `[toma ${take} | ${s.clipId}:${s.atWord}] ${s.text}`));
  const shots = examples.map((e) => `- ${e.type} ${JSON.stringify(e.params)} | antes: "${e.context.before.slice(-120)}" | durante: "${e.context.during.slice(0, 120)}"`);
  return [
    {role: 'system', content: 'Eres el montador habitual de este canal de YouTube. Decides en que frases reacciona el montaje. Devuelves solo JSON valido.'},
    {role: 'user', content: [
      'Decisiones reales del autor en videos anteriores (tipo, parametros y palabras alrededor):',
      ...shots,
      '',
      'Frases del video nuevo, con su referencia clip:palabra:',
      ...lines,
      '',
      'Devuelve {"emphasis":[{"ref":"clip:palabra","why":"..."}],"topicShiftTakes":[numero de toma],"hookPunchRefs":["clip:palabra"]}.',
      '- emphasis: frases de opinion fuerte, dato sorprendente o remate donde el autor se acercaria con la camara (maximo una cada 90 s).',
      '- topicShiftTakes: tomas que empiezan un tema nuevo; ahi el autor pone un whoosh.',
      '- hookPunchRefs: dentro de la primera toma, inicios de frase donde cortar con zoom fijo para el gancho.',
      'Usa solo referencias que aparecen arriba.'
    ].join('\n')}
  ];
}

export function validateIntents(raw, takes) {
  const valid = new Set(takes.flatMap((clip) => sentencesOf(clip).map((s) => `${s.clipId}:${s.atWord}`)));
  const ref = (r) => {
    const [clipId, atWord] = String(r ?? '').split(':');
    return valid.has(`${clipId}:${Number(atWord)}`) ? {clipId, atWord: Number(atWord)} : null;
  };
  return {
    emphasis: (raw?.emphasis ?? []).map((e) => ref(e?.ref ?? e)).filter(Boolean),
    topicShiftTakes: (raw?.topicShiftTakes ?? []).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n < takes.length),
    hookPunchRefs: (raw?.hookPunchRefs ?? []).map(ref).filter((r) => r && r.clipId === takes[0]?.id),
    source: 'llm'
  };
}
