/**
 * Índice de palabras de la transcripción.
 *
 * ANM-A01 / ANM-D11 — El índice de palabra es la fuente de verdad temporal del
 * motor. Los segundos son un derivado que se recalcula cuando el audio cambia;
 * nunca al revés.
 */

/** Normaliza para comparar: sin acentos, minúsculas, sin puntuación. */
export function normalizeToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9%$€]/g, '');
}

/** Divide un texto de ancla en tokens comparables. */
export function tokenizeAnchor(value) {
  return String(value ?? '')
    .split(/\s+/)
    .map(normalizeToken)
    .filter(Boolean);
}

/**
 * Acepta las dos formas que produce el pipeline (`start`/`end` y
 * `startSeconds`/`endSeconds`) y devuelve siempre `start`/`end`.
 */
export function normalizeWords(words) {
  return (Array.isArray(words) ? words : []).map((word, position) => ({
    ...word,
    index: Number.isInteger(word?.index) ? word.index : position,
    start: Number(word?.start ?? word?.startSeconds ?? 0),
    end: Number(word?.end ?? word?.endSeconds ?? word?.start ?? word?.startSeconds ?? 0)
  }));
}

/**
 * @param {{text: string, start?: number, startSeconds?: number}[]} words
 * @returns {{words: object[], normalized: string[], raw: string[]}}
 */
export function buildWordIndex(words) {
  const list = normalizeWords(words);
  return {
    words: list,
    raw: list.map((word) => String(word?.text ?? '')),
    normalized: list.map((word) => normalizeToken(word?.text))
  };
}

/** Rango de palabras de una escena, saneado contra el tamaño real del índice. */
export function resolveWordRange(index, wordRange) {
  const last = Math.max(0, index.normalized.length - 1);
  const startIndex = Number.isInteger(wordRange?.startIndex)
    ? Math.max(0, Math.min(last, wordRange.startIndex))
    : 0;
  const endIndex = Number.isInteger(wordRange?.endIndex)
    ? Math.max(startIndex, Math.min(last, wordRange.endIndex))
    : last;
  return {startIndex, endIndex};
}

/**
 * Busca la ocurrencia N de una secuencia de tokens dentro de un rango.
 * Devuelve `-1` si no aparece: nunca degrada a otra posición.
 */
export function findAnchorIndex(index, {
  anchorText,
  occurrence = 1,
  startIndex = 0,
  endIndex = index.normalized.length - 1
}) {
  const tokens = tokenizeAnchor(anchorText);
  if (!tokens.length) return -1;
  const target = Math.max(1, Math.trunc(occurrence));
  let seen = 0;
  for (let cursor = startIndex; cursor <= endIndex; cursor += 1) {
    const matches = tokens.every(
      (token, offset) => index.normalized[cursor + offset] === token
    );
    if (!matches) continue;
    seen += 1;
    if (seen === target) return cursor;
  }
  return -1;
}

/** Cuántas veces aparece un ancla en el rango: sirve para diagnosticar. */
export function countAnchorOccurrences(index, {anchorText, startIndex, endIndex}) {
  const tokens = tokenizeAnchor(anchorText);
  if (!tokens.length) return 0;
  let total = 0;
  for (let cursor = startIndex; cursor <= endIndex; cursor += 1) {
    if (tokens.every((token, offset) => index.normalized[cursor + offset] === token)) {
      total += 1;
    }
  }
  return total;
}

/** Índice de la primera palabra cuyo inicio cae en o después de `seconds`. */
export function wordIndexAtSeconds(index, seconds) {
  for (let cursor = 0; cursor < index.words.length; cursor += 1) {
    if (Number(index.words[cursor]?.start) >= seconds) return cursor;
  }
  return Math.max(0, index.words.length - 1);
}

/** Rango de palabras contenido en un intervalo temporal. */
export function wordRangeForInterval(index, startSeconds, endSeconds) {
  let startIndex = -1;
  let endIndex = -1;
  for (let cursor = 0; cursor < index.words.length; cursor += 1) {
    const word = index.words[cursor];
    const start = Number(word?.start ?? 0);
    const end = Number(word?.end ?? start);
    if (end < startSeconds) continue;
    if (start > endSeconds) break;
    if (startIndex < 0) startIndex = cursor;
    endIndex = cursor;
  }
  if (startIndex < 0) return null;
  return {startIndex, endIndex};
}
