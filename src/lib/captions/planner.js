import {clamp, round} from '../utils.js';
import {resolveCaptionStyle} from './presets.js';

const STOP_WORDS = new Set([
  'a', 'al', 'and', 'as', 'at', 'con', 'como', 'de', 'del', 'el', 'en', 'es', 'esta', 'este', 'for',
  'la', 'las', 'lo', 'los', 'of', 'o', 'para', 'por', 'que', 'se', 'sin', 'the', 'to', 'un', 'una', 'y'
]);

function cleanWordText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizedWord(value) {
  return cleanWordText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

function approximateCaptionWords(caption) {
  const parts = String(caption.text ?? '').split(/\s+/).map(cleanWordText).filter(Boolean);
  if (!parts.length) return [];
  const duration = Math.max(0.12, Number(caption.end) - Number(caption.start));
  const weights = parts.map((word) => Math.max(1, normalizedWord(word).length));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = Number(caption.start);
  return parts.map((text, index) => {
    const last = index === parts.length - 1;
    const proportional = duration * (weights[index] / totalWeight);
    const end = last ? Number(caption.end) : Math.min(Number(caption.end), cursor + Math.max(0.08, proportional));
    const word = {
      id: `${caption.id || 'segment'}-word-${index + 1}`,
      text,
      start: round(cursor, 3),
      end: round(Math.max(cursor + 0.04, end), 3),
      confidence: null,
      timingSource: 'approximate',
      segmentId: caption.id ?? null
    };
    cursor = word.end;
    return word;
  });
}

function timedCaptionWords(caption) {
  if (!Array.isArray(caption.words) || !caption.words.length) return approximateCaptionWords(caption);
  return caption.words.map((word, index) => {
    const text = cleanWordText(word.text ?? word.word);
    const start = Number(word.start);
    const end = Number(word.end);
    if (!text || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return {
      id: word.id ?? `${caption.id || 'segment'}-word-${index + 1}`,
      text,
      start: round(start, 3),
      end: round(end, 3),
      confidence: Number.isFinite(word.confidence) ? word.confidence : (Number.isFinite(word.probability) ? word.probability : null),
      timingSource: 'word',
      segmentId: caption.id ?? null
    };
  }).filter(Boolean);
}

export function captionsToTimedWords(captions) {
  const words = (captions ?? []).flatMap(timedCaptionWords).sort((a, b) => a.start - b.start || a.end - b.end);
  return words.filter((word, index) => {
    const previous = words[index - 1];
    return !previous || word.start !== previous.start || word.end !== previous.end || normalizedWord(word.text) !== normalizedWord(previous.text);
  });
}

function closesThought(text) {
  return /[.!?]["'»)]?$/.test(text);
}

function pageCharCount(words) {
  return words.map((word) => word.text).join(' ').length;
}

function groupIntoPages(words, style) {
  const pages = [];
  let current = [];
  for (const word of words) {
    const previous = current.at(-1);
    const pause = previous ? word.start - previous.end : 0;
    const duration = current.length ? word.end - current[0].start : 0;
    const nextChars = pageCharCount([...current, word]);
    const shouldBreak = current.length && (
      current.length >= style.maxWords ||
      nextChars > style.maxPageChars ||
      pause >= style.pauseBreak ||
      duration > style.maxPageDuration ||
      closesThought(previous.text)
    );
    if (shouldBreak) {
      pages.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) pages.push(current);
  return pages;
}

function emphasisScore(word, index, words) {
  const normalized = normalizedWord(word.text);
  if (!normalized || STOP_WORDS.has(normalized)) return -100;
  let score = Math.min(12, normalized.length);
  if (/\d/.test(normalized)) score += 7;
  if (normalized.length >= 5) score += 3;
  if (index > 0 && index < words.length - 1) score += 2;
  if (/[!:]$/.test(word.text)) score += 2;
  return score;
}

function chooseEmphasisIndex(words, style) {
  if (style.emphasis === 'off' || words.length < 3) return -1;
  if (style.layout === 'reference-stack') {
    const target = Math.floor(words.length / 2);
    let bestIndex = 1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let index = 1; index < words.length - 1; index += 1) {
      const structural = Math.max(0, 4 - Math.abs(index - target) * 1.5);
      const score = emphasisScore(words[index], index, words) + structural;
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }
    return bestIndex;
  }
  let bestIndex = -1;
  let bestScore = 7;
  words.forEach((word, index) => {
    const score = emphasisScore(word, index, words);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function wrapWords(words, style) {
  const maxChars = style.maxLineChars;
  const maxLineWords = style.maxLineWords ?? style.maxWords ?? 4;
  const maxLines = style.maxLines ?? 3;
  const lines = [];
  let current = [];
  for (const word of words) {
    const nextLength = [...current, word].map((item) => item.text).join(' ').length;
    if (current.length && (nextLength > maxChars || current.length >= maxLineWords)) {
      lines.push(current);
      current = [];
    }
    current.push(word);
  }
  if (current.length) lines.push(current);
  while (lines.length > maxLines) {
    const tail = lines.pop();
    lines[lines.length - 1].push(...tail);
  }
  return lines;
}

function pageLines(words, style) {
  const emphasisIndex = chooseEmphasisIndex(words, style);
  if (emphasisIndex === -1) return wrapWords(words, style).map((lineWords) => ({words: lineWords, role: 'normal'}));
  const before = words.slice(0, emphasisIndex);
  const hero = [words[emphasisIndex]];
  const after = words.slice(emphasisIndex + 1);
  if (style.layout === 'reference-stack') {
    return [
      ...(before.length ? [{words: before, role: 'lead', case: 'lower'}] : []),
      {words: hero, role: 'hero', case: 'upper'},
      ...(after.length ? [{words: after, role: 'tail', case: 'upper'}] : [])
    ];
  }
  const lines = [];
  if (before.length) lines.push({words: before, role: 'normal'});
  lines.push({words: hero, role: 'hero'});
  if (after.length) lines.push({words: after, role: 'normal'});
  if (lines.length <= 3 && lines.every((line) => line.words.map((word) => word.text).join(' ').length <= style.maxLineChars * 1.5 || line.role === 'hero')) {
    return lines;
  }
  return wrapWords(words, style).map((lineWords) => ({
    words: lineWords,
    role: lineWords.includes(hero[0]) && lineWords.length === 1 ? 'hero' : 'normal'
  }));
}

function lineFontSize(line, style) {
  const chars = line.words.map((word) => word.text).join(' ').length;
  if (line.role === 'hero') {
    const desired = style.baseFontSize * style.heroScale;
    const availableWidth = 1080 - style.marginX * 2;
    const fitted = availableWidth / Math.max(1, chars * 0.62);
    return Math.round(clamp(Math.min(desired, fitted), style.baseFontSize, desired));
  }
  if (style.layout === 'reference-stack') {
    const scale = line.role === 'tail' ? style.tailScale : style.leadScale;
    const desired = style.baseFontSize * scale;
    const availableWidth = 1080 - style.marginX * 2;
    const fitted = availableWidth / Math.max(1, chars * 0.58);
    return Math.round(clamp(Math.min(desired, fitted), style.baseFontSize * 0.72, desired));
  }
  if (chars > style.maxLineChars * 1.25) return Math.round(style.baseFontSize * 0.72);
  if (chars > style.maxLineChars) return Math.round(style.baseFontSize * 0.84);
  return style.baseFontSize;
}

function positionCenter(style) {
  if (Number.isFinite(style.anchorY)) return style.anchorY;
  return { 'upper-middle': 720, center: 930, 'lower-middle': 1220, lower: 1430, 'safe-lower': 1608 }[style.position] ?? 1608;
}

function layoutLines(lines, style) {
  const measured = lines.map((line) => {
    const fontSize = lineFontSize(line, style);
    const referenceRatio = line.role === 'hero' ? 0.88 : (line.role === 'tail' ? 1 : 1.03);
    const lineHeight = style.layout === 'reference-stack'
      ? Math.round(fontSize * referenceRatio)
      : Math.round(fontSize * (line.role === 'hero' ? 0.93 : 1.08));
    return {...line, fontSize, lineHeight};
  });
  const blockHeight = measured.reduce((sum, line) => sum + line.lineHeight, 0);
  let y = Math.round(positionCenter(style) - blockHeight / 2);
  return measured.map((line, index) => {
    const width = 1080 - style.marginX * 2;
    const x = style.align === 'center' ? 540 : style.marginX;
    const placed = {
      id: `line-${index + 1}`,
      role: line.role,
      case: line.case ?? null,
      x,
      y: clamp(y, 220, 1680),
      width,
      align: style.align,
      fontSize: line.fontSize,
      words: line.words
    };
    y += line.lineHeight;
    return placed;
  });
}

export function buildProgressiveCaptionPlan(captions, options = {}) {
  const style = resolveCaptionStyle(options);
  const words = captionsToTimedWords(captions);
  const groups = groupIntoPages(words, style);
  const pages = groups.map((pageWords, index) => {
    const nextStart = groups[index + 1]?.[0]?.start;
    const lastEnd = pageWords.at(-1).end;
    const end = Number.isFinite(nextStart)
      ? Math.max(lastEnd, Math.min(nextStart, lastEnd + 0.28))
      : lastEnd + 0.28;
    return {
      id: `page-${index + 1}`,
      start: pageWords[0].start,
      end: round(end, 3),
      lines: layoutLines(pageLines(pageWords, style), style)
    };
  });
  const exactWords = words.filter((word) => word.timingSource === 'word').length;
  return {
    version: 1,
    renderer: 'ass-progressive',
    preset: style.preset,
    canvas: {width: 1080, height: 1920},
    timing: {
      source: words.length && exactWords === words.length ? 'word' : (exactWords ? 'mixed' : 'approximate'),
      words: words.length,
      exactWords
    },
    style,
    pages
  };
}
