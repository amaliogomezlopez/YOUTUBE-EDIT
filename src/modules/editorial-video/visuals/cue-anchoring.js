/**
 * Anclaje estricto de cues a palabras.
 *
 * ANM-A01 · ANM-A02 · ANM-A03 — Sustituye la resolución silenciosa antigua:
 *   - la búsqueda se restringe al `wordRange` de la escena;
 *   - soporta la ocurrencia N de un ancla;
 *   - un ancla que no aparece produce un error con escena, cue y causa;
 *   - `atSeconds` pasa a ser un valor derivado, nunca autoritativo.
 */
import {
  buildWordIndex,
  countAnchorOccurrences,
  findAnchorIndex,
  normalizeWords,
  resolveWordRange
} from './word-index.js';

export const ANCHOR_TOLERANCE_SECONDS = 0.35;

export class CueAnchorError extends Error {
  constructor(issues) {
    const detail = issues
      .map((issue) => `  · [${issue.code}] ${issue.sceneId}/${issue.cueId}: ${issue.message}`)
      .join('\n');
    super(`Anclaje de cues inválido:\n${detail}`);
    this.name = 'CueAnchorError';
    this.issues = issues;
  }
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function issue(code, sceneId, cueId, message, extra = {}) {
  return {code, severity: 'error', sceneId, cueId, message, ...extra};
}

/**
 * Resuelve los cues de una escena contra las palabras de la transcripción.
 *
 * @param {object[]} cues definiciones con `anchorText` o `anchorWordIndex`
 * @param {object} context
 * @param {object[]} context.words transcripción por palabras del episodio
 * @param {{startIndex:number,endIndex:number}} context.wordRange rango de la escena
 * @param {number} context.startSeconds inicio absoluto de la escena
 * @param {number} context.endSeconds fin absoluto de la escena
 * @param {string} context.sceneId
 * @param {boolean} [context.strict=true] lanza en vez de acumular incidencias
 * @returns {{cues: object[], issues: object[]}}
 */
export function resolveSceneCues(cues, {
  words,
  wordRange,
  startSeconds,
  endSeconds,
  sceneId,
  strict = true
}) {
  const index = buildWordIndex(words);
  const range = resolveWordRange(index, wordRange);
  const issues = [];
  const resolved = [];

  for (const definition of Array.isArray(cues) ? cues : []) {
    const {
      anchorText,
      anchorWordIndex,
      anchorOccurrence = 1,
      offsetSeconds,
      anchorOffsetSeconds,
      ...cue
    } = definition;
    const offset = Number(offsetSeconds ?? anchorOffsetSeconds ?? 0);
    const cueId = cue.id ?? '(sin id)';

    let wordIndex = Number.isInteger(anchorWordIndex) ? anchorWordIndex : -1;
    if (wordIndex < 0 && anchorText) {
      wordIndex = findAnchorIndex(index, {
        anchorText,
        occurrence: anchorOccurrence,
        startIndex: range.startIndex,
        endIndex: range.endIndex
      });
      if (wordIndex < 0) {
        const globalMatches = countAnchorOccurrences(index, {
          anchorText,
          startIndex: 0,
          endIndex: index.normalized.length - 1
        });
        const inRange = countAnchorOccurrences(index, {
          anchorText,
          startIndex: range.startIndex,
          endIndex: range.endIndex
        });
        issues.push(issue(
          'anchor-not-found',
          sceneId,
          cueId,
          `«${anchorText}» (ocurrencia ${anchorOccurrence}) no aparece en las ` +
          `palabras ${range.startIndex}–${range.endIndex} de la escena ` +
          `(${inRange} en rango, ${globalMatches} en todo el episodio).`,
          {anchorText, anchorOccurrence, wordRange: range}
        ));
        continue;
      }
    }

    if (wordIndex < 0) {
      issues.push(issue(
        'anchor-missing',
        sceneId,
        cueId,
        'El cue no declara `anchorText` ni `anchorWordIndex`; `atSeconds` a mano ' +
        'no es una fuente de verdad admitida.'
      ));
      continue;
    }

    const word = index.words[wordIndex];
    if (!word) {
      issues.push(issue(
        'anchor-out-of-bounds',
        sceneId,
        cueId,
        `El índice de palabra ${wordIndex} está fuera de la transcripción.`
      ));
      continue;
    }

    const absoluteSeconds = Number(word.start) + offset;
    if (
      absoluteSeconds < startSeconds - ANCHOR_TOLERANCE_SECONDS ||
      absoluteSeconds > endSeconds + ANCHOR_TOLERANCE_SECONDS
    ) {
      issues.push(issue(
        'anchor-outside-scene',
        sceneId,
        cueId,
        `La palabra anclada cae en ${round(absoluteSeconds)} s, fuera de la ` +
        `escena [${round(startSeconds)}, ${round(endSeconds)}] s.`,
        {absoluteSeconds: round(absoluteSeconds)}
      ));
      continue;
    }

    resolved.push({
      ...cue,
      anchorText: anchorText ?? String(word.text ?? ''),
      anchorWordIndex: wordIndex,
      anchorOccurrence,
      offsetSeconds: round(offset),
      atSeconds: round(Math.max(0, absoluteSeconds - startSeconds)),
      absoluteSeconds: round(absoluteSeconds)
    });
  }

  if (strict && issues.length) throw new CueAnchorError(issues);
  return {cues: resolved.sort((left, right) => left.atSeconds - right.atSeconds), issues};
}

/**
 * Recalcula `atSeconds` tras una reedición del audio (playbook §10).
 * Solo necesita el índice de palabra: por eso el índice es la fuente de verdad.
 */
export function reanchorCues(cues, {words, startSeconds}) {
  const index = buildWordIndex(words);
  return cues.map((cue) => {
    const word = index.words[cue.anchorWordIndex];
    if (!word) return cue;
    const absoluteSeconds = Number(word.start) + Number(cue.offsetSeconds ?? 0);
    return {
      ...cue,
      atSeconds: round(Math.max(0, absoluteSeconds - startSeconds)),
      absoluteSeconds: round(absoluteSeconds)
    };
  });
}

/** Desviación en ms entre el cue y su palabra: métrica de sincronía del plan. */
export function cueDeviationMs(cue, words) {
  const word = normalizeWords(words)[cue.anchorWordIndex];
  if (!word) return null;
  return Math.round(Math.abs(Number(cue.absoluteSeconds) - Number(word.start)) * 1000);
}
