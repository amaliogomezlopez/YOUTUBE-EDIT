/**
 * Minería automática de cues desde la transcripción por palabras.
 *
 * ANM-B01 · ANM-B02 — «Cuando digo algo, pasa algo» deja de depender del autor.
 * Cada candidato nace con `anchorWordIndex`, tipo, confianza y prioridad; jamás
 * con un segundo escrito a mano.
 */
import {buildWordIndex, normalizeToken, resolveWordRange, tokenizeAnchor} from './word-index.js';
import {
  CURRENCY_WORDS,
  MAGNITUDE_WORDS,
  MONTH_WORDS,
  NEGATIVE_CONTEXT,
  NUMBER_WORDS,
  PERIOD_WORDS,
  POSITIVE_CONTEXT,
  mergeLexiconOverrides
} from './cue-lexicon.js';

const CONTEXT_WINDOW = 4;

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function slugify(value, fallback = 'cue') {
  const slug = normalizeToken(value).replace(/[^a-z0-9]/g, '');
  return slug || fallback;
}

function phraseMatchesAt(index, cursor, phraseTokens) {
  return phraseTokens.every(
    (token, offset) => index.normalized[cursor + offset] === token
  );
}

function toneFromContext(index, cursor) {
  let negative = 0;
  let positive = 0;
  for (
    let probe = Math.max(0, cursor - CONTEXT_WINDOW);
    probe <= cursor + CONTEXT_WINDOW;
    probe += 1
  ) {
    const token = index.normalized[probe];
    if (!token) continue;
    if (NEGATIVE_CONTEXT.has(token)) negative += 1;
    if (POSITIVE_CONTEXT.has(token)) positive += 1;
  }
  if (negative > positive) return 'negative';
  if (positive > negative) return 'positive';
  return 'gold';
}

function isNumericToken(token) {
  return /^[−+-]?\d+([.,]\d+)*%?$/.test(token);
}

/** Ocurrencia (1-based) de un ancla dentro del rango, hasta `cursor` incluido. */
function occurrenceOf(index, anchorText, startIndex, cursor) {
  const tokens = tokenizeAnchor(anchorText);
  let count = 0;
  for (let probe = startIndex; probe <= cursor; probe += 1) {
    if (phraseMatchesAt(index, probe, tokens)) count += 1;
  }
  return Math.max(1, count);
}

/**
 * @param {object[]} words transcripción por palabras (texto + start)
 * @param {object} options
 * @param {{startIndex:number,endIndex:number}} options.wordRange
 * @param {number} options.startSeconds inicio absoluto de la escena
 * @param {string} options.sceneId
 * @param {{name:string, aliases?:string[], id?:string}[]} [options.entities]
 * @param {object} [options.lexiconOverrides]
 * @returns {object[]} candidatos ordenados por instante
 */
export function mineSceneCues(words, {
  wordRange,
  startSeconds = 0,
  sceneId = 'scene',
  entities = [],
  lexiconOverrides = {}
} = {}) {
  const index = buildWordIndex(words);
  const range = resolveWordRange(index, wordRange);
  const lexicon = mergeLexiconOverrides(lexiconOverrides);
  const candidates = [];
  const consumed = new Set();

  const push = (cursor, kind, {
    anchorText,
    matchedText,
    confidence,
    tone,
    action,
    soundFamily,
    metaphor,
    span = 1,
    extra = {}
  }) => {
    const word = index.words[cursor];
    if (!word) return;
    const profile = lexicon.kindProfiles[kind] ?? {};
    const absoluteSeconds = Number(word.start);
    candidates.push({
      id: `${kind}-${slugify(anchorText, String(cursor))}-${cursor}`,
      sceneId,
      kind,
      anchorText,
      anchorWordIndex: cursor,
      anchorOccurrence: occurrenceOf(index, anchorText, range.startIndex, cursor),
      offsetSeconds: 0,
      atSeconds: round(Math.max(0, absoluteSeconds - startSeconds)),
      absoluteSeconds: round(absoluteSeconds),
      matchedText: matchedText ?? anchorText,
      confidence: round(confidence, 2),
      priority: profile.priority ?? 5,
      mandatory: Boolean(profile.mandatory),
      action: action ?? profile.action ?? 'highlight',
      tone: tone ?? 'neutral',
      target: null,
      sound: {family: soundFamily ?? profile.soundFamily ?? 'interface', intensity: 0.6},
      origin: 'mined',
      ...(metaphor ? {metaphor} : {}),
      ...extra
    });
    for (let offset = 0; offset < span; offset += 1) consumed.add(cursor + offset);
  };

  // --- Entidades del dossier (empresas, personas, instituciones, países) ---
  const entityPhrases = entities
    .flatMap((entity) => {
      const names = [entity.name, ...(entity.aliases ?? [])].filter(Boolean);
      return names.map((name) => ({
        entity,
        tokens: tokenizeAnchor(name),
        text: name
      }));
    })
    .filter((phrase) => phrase.tokens.length)
    .sort((left, right) => right.tokens.length - left.tokens.length);

  for (let cursor = range.startIndex; cursor <= range.endIndex; cursor += 1) {
    if (consumed.has(cursor)) continue;
    const phrase = entityPhrases.find((item) => phraseMatchesAt(index, cursor, item.tokens));
    if (!phrase) continue;
    push(cursor, 'entity', {
      anchorText: phrase.text,
      matchedText: phrase.text,
      confidence: 0.95,
      tone: 'cyan',
      span: phrase.tokens.length,
      extra: {entityId: phrase.entity.id ?? slugify(phrase.entity.name)}
    });
  }

  // --- Frases multipalabra: giros, comparaciones y periodos relativos ---
  const phraseGroups = [
    {kind: 'turn', phrases: lexicon.turnPhrases, tone: 'negative', confidence: 0.9},
    {kind: 'comparison', phrases: lexicon.comparisonPhrases, tone: 'cyan', confidence: 0.8},
    {kind: 'period', phrases: lexicon.relativePeriodPhrases, tone: 'neutral', confidence: 0.75}
  ];
  for (const group of phraseGroups) {
    const tokenized = group.phrases
      .map((phrase) => ({text: phrase, tokens: tokenizeAnchor(phrase)}))
      .filter((item) => item.tokens.length)
      .sort((left, right) => right.tokens.length - left.tokens.length);
    for (let cursor = range.startIndex; cursor <= range.endIndex; cursor += 1) {
      if (consumed.has(cursor)) continue;
      const match = tokenized.find((item) => phraseMatchesAt(index, cursor, item.tokens));
      if (!match) continue;
      push(cursor, group.kind, {
        anchorText: index.raw[cursor],
        matchedText: match.text,
        confidence: group.confidence,
        tone: group.tone,
        span: match.tokens.length
      });
    }
  }

  // --- Palabra a palabra: cifras, monedas, fechas y verbos visualizables ---
  for (let cursor = range.startIndex; cursor <= range.endIndex; cursor += 1) {
    if (consumed.has(cursor)) continue;
    const token = index.normalized[cursor];
    if (!token) continue;
    const raw = index.raw[cursor];
    const next = index.normalized[cursor + 1] ?? '';
    const afterNext = index.normalized[cursor + 2] ?? '';

    const isPercent = token.includes('%') ||
      (isNumericToken(token) && next === 'por' && afterNext === 'ciento');
    const isNumeric = isNumericToken(token);
    const isSpelledNumber = NUMBER_WORDS.has(token) && !MAGNITUDE_WORDS.has(token);

    if (isPercent) {
      push(cursor, 'percent', {
        anchorText: raw,
        confidence: 0.98,
        tone: toneFromContext(index, cursor),
        span: token.includes('%') ? 1 : 3
      });
      continue;
    }
    if (token.includes('$') || token.includes('€') || CURRENCY_WORDS.has(token)) {
      push(cursor, 'currency', {
        anchorText: raw,
        confidence: 0.92,
        tone: toneFromContext(index, cursor)
      });
      continue;
    }
    if (/^(19|20)\d{2}$/.test(token)) {
      push(cursor, 'date', {anchorText: raw, confidence: 0.96, tone: 'neutral'});
      continue;
    }
    if (MONTH_WORDS.has(token) || PERIOD_WORDS.has(token)) {
      push(cursor, 'date', {anchorText: raw, confidence: 0.8, tone: 'neutral'});
      continue;
    }
    if (isNumeric) {
      push(cursor, 'number', {
        anchorText: raw,
        confidence: 0.95,
        tone: toneFromContext(index, cursor)
      });
      continue;
    }
    if (MAGNITUDE_WORDS.has(token)) {
      push(cursor, 'magnitude', {
        anchorText: raw,
        confidence: 0.7,
        tone: toneFromContext(index, cursor)
      });
      continue;
    }
    if (isSpelledNumber) {
      push(cursor, 'number', {
        anchorText: raw,
        confidence: 0.6,
        tone: toneFromContext(index, cursor),
        extra: {numericValue: NUMBER_WORDS.get(token)}
      });
      continue;
    }
    const verb = lexicon.visualVerbs.get(token);
    if (verb) {
      push(cursor, 'verb', {
        anchorText: raw,
        confidence: 0.85,
        tone: verb.tone,
        action: verb.action,
        soundFamily: verb.soundFamily,
        metaphor: verb.metaphor
      });
    }
  }

  return candidates.sort((left, right) => left.atSeconds - right.atSeconds);
}

/**
 * ANM-B06 — Menciones visualizables detectadas frente a cues que sobreviven al
 * presupuesto. Lo que no tiene cue queda nombrado, no escondido.
 */
export function buildCueCoverage(mined, kept, {sceneId, mandatoryKinds} = {}) {
  const keptAnchors = new Set(kept.map((cue) => cue.anchorWordIndex));
  const mentions = mined.map((cue) => ({
    id: cue.id,
    kind: cue.kind,
    anchorWordIndex: cue.anchorWordIndex,
    anchorText: cue.anchorText,
    atSeconds: cue.atSeconds,
    mandatory: cue.mandatory,
    covered: keptAnchors.has(cue.anchorWordIndex)
  }));
  const required = mentions.filter((mention) =>
    mention.mandatory ||
    (mandatoryKinds ?? []).includes(mention.kind)
  );
  const coveredRequired = required.filter((mention) => mention.covered);
  return {
    sceneId,
    minedCount: mined.length,
    keptCount: kept.length,
    mandatoryCount: required.length,
    mandatoryCovered: coveredRequired.length,
    coverageRatio: required.length
      ? round(coveredRequired.length / required.length, 4)
      : 1,
    uncovered: mentions.filter((mention) => !mention.covered),
    mentions
  };
}
