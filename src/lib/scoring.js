import {clamp, round, sha1} from './utils.js';

const HOOK_TERMS = [
  'no sabes', 'nadie', 'nunca', 'siempre', 'error', 'secreto', 'truco', 'problema',
  'cuidado', 'atencion', 'atención', 'mira', 'imagina', 'lo que pasa', 'la verdad',
  'dinero', 'viral', 'peor', 'mejor', 'gratis', 'fallo', 'riesgo', 'increible',
  'increíble', 'this is why', 'mistake', 'secret', 'never', 'always', 'watch', 'money'
];

const EMOTION_TERMS = [
  'odio', 'amo', 'miedo', 'sorpresa', 'brutal', 'loco', 'locura', 'ridiculo',
  'ridículo', 'injusto', 'peligro', 'dramático', 'wow', 'crazy', 'insane',
  'shocking', 'love', 'hate', 'fear'
];

const PAYOFF_TERMS = [
  'por eso', 'asi que', 'así que', 'entonces', 'resultado', 'conclusion',
  'conclusión', 'la clave', 'en resumen', 'therefore', 'so the point', 'the result'
];

const AI_TERMS = [
  'ia', 'inteligencia artificial', 'machine learning', 'aprendizaje automatico',
  'aprendizaje automático', 'ml', 'modelo', 'modelos', 'llm', 'rag', 'agente',
  'agentes', 'razonamiento', 'tokens', 'prompt', 'chatbot', 'openai', 'claude',
  'gemini', 'minimax', 'nemotron', 'whisper', 'faster whisper', 'faster-whisper',
  'codex', 'cursor', 'warp', 'vibe coding', 'contexto', 'inferencia'
];

const MODEL_OPINION_TERMS = [
  'recomiendo', 'no recomiendo', 'me gusta', 'no me gusta', 'me mola',
  'no me mola', 'funciona mejor', 'funciona peor', 'es mejor', 'es peor',
  'me quedo con', 'prefiero', 'no merece la pena', 'merece la pena',
  'cuidado con', 'problema de', 'fallo de', 'limitacion', 'limitación',
  'comparado con', 'versus', 'vs', 'critica', 'crítica', 'recomendacion',
  'recomendación', 'review', 'benchmark', 'latencia', 'calidad', 'precio',
  'coste', 'caro', 'barato', 'alucino', 'brutal', 'flojo', 'potente'
];

const RECOMMENDATION_VERBS = [
  'usar', 'probar', 'cambiar', 'evitar', 'descartar', 'mantener', 'elegir',
  'comparar', 'validar', 'medir', 'automatizar', 'integrar', 'quitar', 'meter'
];

const PYTHON_DATA_TERMS = [
  'python', 'pandas', 'numpy', 'scikit', 'sklearn', 'pytorch', 'tensorflow',
  'jupyter', 'notebook', 'datos', 'dataset', 'backtest', 'backtesting',
  'pipeline', 'automatizar', 'automatizacion', 'automatización'
];

const FINANCE_TERMS = [
  'inversion', 'inversión', 'trading', 'bolsa', 'acciones', 'accion',
  'acción', 'cotizacion', 'cotización', 'mercado', 'mercados', 'portfolio',
  'cartera', 'riesgo', 'rentabilidad', 'rendimiento', 'precio', 'precios',
  'señal', 'senal', 'estrategia', 'estrategias'
];

const WEAK_START_TERMS = [
  'y', 'que', 'entonces', 'bueno', 'pues', 'eh', 'este', 'esto', 'o sea',
  'so', 'and', 'but'
];

const DANGLING_END_TERMS = [
  'un', 'una', 'unos', 'unas', 'el', 'la', 'los', 'las', 'de', 'del', 'en',
  'con', 'por', 'para', 'que', 'y', 'o', 'pero', 'como', 'al', 'a'
];

function stripAccents(text) {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function countMatches(text, terms) {
  const normalized = stripAccents(text.toLowerCase());
  return terms.reduce((sum, term) => sum + (normalized.includes(stripAccents(term.toLowerCase())) ? 1 : 0), 0);
}

function durationScore(duration) {
  if (duration < 12) return 30 + duration * 2;
  if (duration <= 45) return 100;
  if (duration <= 75) return 100 - (duration - 45) * 1.3;
  return 40;
}

function densityScore(wordCount, duration) {
  const wordsPerMinute = (wordCount / Math.max(1, duration)) * 60;
  if (wordsPerMinute < 90) return 45;
  if (wordsPerMinute <= 190) return 100;
  if (wordsPerMinute <= 260) return 82;
  return 55;
}

function uniqueHits(text, terms) {
  const normalized = stripAccents(text.toLowerCase());
  return terms.filter((term) => normalized.includes(stripAccents(term.toLowerCase()))).length;
}

function topicScore(text) {
  const aiHits = uniqueHits(text, AI_TERMS);
  const dataHits = uniqueHits(text, PYTHON_DATA_TERMS);
  const financeHits = uniqueHits(text, FINANCE_TERMS);
  const crossDomainBonus = aiHits > 0 && financeHits > 0 ? 18 : 0;
  const implementationBonus = dataHits > 0 && (aiHits > 0 || financeHits > 0) ? 10 : 0;
  return clamp(
    28 +
      Math.min(aiHits, 3) * 12 +
      Math.min(dataHits, 2) * 10 +
      Math.min(financeHits, 3) * 14 +
      crossDomainBonus +
      implementationBonus,
    0,
    100
  );
}

function editorialScore(text) {
  const aiHits = uniqueHits(text, AI_TERMS);
  const opinionHits = uniqueHits(text, MODEL_OPINION_TERMS);
  const actionHits = uniqueHits(text, RECOMMENDATION_VERBS);
  const hasQuestion = /[?¿]/.test(text);
  const hasNegation = /\b(no|nunca|tampoco|sin)\b/i.test(stripAccents(text));
  return clamp(
    30 +
      Math.min(aiHits, 4) * 9 +
      Math.min(opinionHits, 4) * 14 +
      Math.min(actionHits, 3) * 6 +
      (hasQuestion ? 6 : 0) +
      (hasNegation && aiHits > 0 ? 8 : 0),
    0,
    100
  );
}

function repetitionPenalty(words) {
  if (words.length < 12) return 0;
  const normalized = words.map((word) => stripAccents(word.toLowerCase()).replace(/[^\p{L}\p{N}]/gu, '')).filter(Boolean);
  const unique = new Set(normalized);
  const uniqueRatio = unique.size / Math.max(1, normalized.length);
  return uniqueRatio < 0.56 ? Math.round((0.56 - uniqueRatio) * 90) : 0;
}

function boundaryScore(candidate, words) {
  const first = stripAccents(String(words[0] ?? '').toLowerCase());
  const last = stripAccents(String(words.at(-1) ?? '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase());
  const startsWeak = WEAK_START_TERMS.includes(first);
  const startsMidSentence = candidate.cleanStart === false;
  const endsDangling = DANGLING_END_TERMS.includes(last);
  const endsCleanly = candidate.cleanEnd === true || /[.!?]["')\]]?$/.test(candidate.text.trim());
  const hasLatePayoff = /[.!?]/.test(words.slice(-45).join(' '));
  const score = clamp(
    72 +
      (endsCleanly ? 16 : -10) +
      (hasLatePayoff ? 8 : 0) -
      (startsWeak ? 16 : 0) -
      (startsMidSentence ? 28 : 0) -
      (endsDangling ? 24 : 0),
    0,
    100
  );
  return startsMidSentence ? Math.min(score, 68) : score;
}

export function scoreCandidate(candidate) {
  const text = candidate.text;
  const duration = candidate.end - candidate.start;
  const words = text.split(/\s+/).filter(Boolean);
  const firstWords = words.slice(0, 32).join(' ');
  const lastWords = words.slice(-36).join(' ');
  const hookHits = countMatches(firstWords, HOOK_TERMS);
  const emotionHits = countMatches(text, EMOTION_TERMS);
  const payoffHits = countMatches(lastWords, PAYOFF_TERMS);
  const questionBonus = /[?¿]/.test(firstWords) ? 8 : 0;
  const numberBonus = /\b\d+[%x]?\b/.test(firstWords) ? 6 : 0;
  const weakStartPenalty = WEAK_START_TERMS.includes(stripAccents(String(words[0] ?? '').toLowerCase())) ? 8 : 0;
  const rawHook = clamp(45 + hookHits * 18 + questionBonus + numberBonus - weakStartPenalty, 0, 100);
  const hook = candidate.cleanStart === false ? Math.min(rawHook, 64) : rawHook;

  const components = {
    hook,
    density: densityScore(words.length, duration),
    emotion: clamp(45 + emotionHits * 15, 0, 100),
    payoff: clamp(50 + payoffHits * 18, 0, 100),
    duration: durationScore(duration),
    boundary: boundaryScore(candidate, words),
    topic: topicScore(text),
    editorial: editorialScore(text)
  };
  const repeatPenalty = repetitionPenalty(words);

  const score =
    components.hook * 0.2 +
    components.density * 0.12 +
    components.emotion * 0.1 +
    components.payoff * 0.1 +
    components.duration * 0.12 +
    components.boundary * 0.14 +
    components.topic * 0.16 +
    components.editorial * 0.16 -
    repeatPenalty;

  const reasons = [];
  if (components.hook >= 70) reasons.push('hook fuerte en el arranque');
  if (components.density >= 85) reasons.push('alta densidad de informacion');
  if (components.emotion >= 70) reasons.push('lenguaje emocional');
  if (components.payoff >= 70) reasons.push('cierre con payoff');
  if (components.duration >= 85) reasons.push('duracion adecuada para Shorts');
  if (components.boundary >= 78) reasons.push('corte de inicio y cierre solido');
  if (components.topic >= 75) reasons.push('alineado con IA/ML aplicado a inversion y mercados');
  if (components.editorial >= 75) reasons.push('opinion o recomendacion clara sobre modelos/IA');
  if (repeatPenalty > 0) reasons.push('penalizado por repeticion de transcripcion');
  if (reasons.length === 0) reasons.push('clip entendible y compacto');

  return {
    ...candidate,
    viralScore: Math.round(clamp(score, 0, 100)),
    scoreComponents: Object.fromEntries(Object.entries(components).map(([key, value]) => [key, Math.round(value)])),
    reasons
  };
}

function buildWindow(captions, startIndex, minDuration, maxDuration) {
  const selected = [];
  const start = captions[startIndex].start;
  let end = start;
  for (let i = startIndex; i < captions.length; i += 1) {
    selected.push(captions[i]);
    end = captions[i].end;
    const duration = end - start;
    if (duration >= minDuration && (duration >= maxDuration || /[.!?]$/.test(captions[i].text.trim()))) {
      break;
    }
    if (duration >= maxDuration) break;
  }
  if (end - start < minDuration * 0.65) return null;
  const text = selected.map((caption) => caption.text).join(' ').replace(/\s+/g, ' ').trim();
  const previous = captions[startIndex - 1]?.text?.trim() ?? '';
  const firstText = captions[startIndex].text.trim();
  const lastText = selected.at(-1)?.text?.trim() ?? '';
  const cleanStart = !previous || /[.!?]["')\]]?$/.test(previous) || /^[A-ZÁÉÍÓÚÜÑ¿¡"']/.test(firstText);
  const cleanEnd = /[.!?]["')\]]?$/.test(lastText);
  return {
    id: `clip-${sha1(`${round(start, 2)}-${round(end, 2)}-${text}`).slice(0, 8)}`,
    start: round(start, 3),
    end: round(end, 3),
    text,
    sourceCaptionIds: selected.map((caption) => caption.id),
    cleanStart,
    cleanEnd
  };
}

function overlapRatio(a, b) {
  const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const minDuration = Math.min(a.end - a.start, b.end - b.start);
  return overlap / Math.max(0.001, minDuration);
}

export function findCandidates(captions, options = {}) {
  const minDuration = Number(options.minDuration ?? 18);
  const maxDuration = Number(options.maxDuration ?? 60);
  const stride = Number(options.stride ?? 3);
  const raw = [];
  for (let i = 0; i < captions.length; i += stride) {
    const window = buildWindow(captions, i, minDuration, maxDuration);
    if (window) raw.push(scoreCandidate(window));
  }
  const ranked = raw.sort((a, b) => b.viralScore - a.viralScore || a.start - b.start);
  const deduped = [];
  for (const candidate of ranked) {
    if (deduped.every((existing) => overlapRatio(candidate, existing) < 0.55)) {
      deduped.push(candidate);
    }
  }
  return deduped.map((candidate, index) => ({
    ...candidate,
    rank: index + 1,
    duration: round(candidate.end - candidate.start, 2),
    suggestedTitle: suggestTitle(candidate.text)
  }));
}

export function suggestTitle(text) {
  const words = text.replace(/[^\p{L}\p{N}\s¿?]/gu, '').split(/\s+/).filter(Boolean);
  const first = words.slice(0, 9).join(' ');
  const title = first.length > 52 ? `${first.slice(0, 49)}...` : first;
  return title || 'Clip destacado';
}
