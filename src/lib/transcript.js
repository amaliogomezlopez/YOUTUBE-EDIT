import {readFile} from 'node:fs/promises';
import {round} from './utils.js';

function parseTimecode(raw) {
  const normalized = raw.trim().replace(',', '.');
  const parts = normalized.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return Number(normalized);
}

function normalizeCaption(item, index = 0) {
  const start =
    item.start ??
    item.startSeconds ??
    (Number.isFinite(item.startMs) ? item.startMs / 1000 : undefined) ??
    (Number.isFinite(item.timestampMs) ? item.timestampMs / 1000 : undefined);
  const end =
    item.end ??
    item.endSeconds ??
    (Number.isFinite(item.endMs) ? item.endMs / 1000 : undefined);
  const text = String(item.text ?? item.caption ?? item.content ?? '').replace(/\s+/g, ' ').trim();
  if (!Number.isFinite(start) || !Number.isFinite(end) || !text) {
    return null;
  }
  return {
    id: item.id ?? `seg-${index + 1}`,
    start: round(Number(start), 3),
    end: round(Math.max(Number(end), Number(start) + 0.2), 3),
    text,
    speaker: item.speaker ?? item.speakerLabel ?? null,
    confidence: Number.isFinite(item.confidence) ? item.confidence : null
  };
}

function normalizeTextForOverlap(text) {
  return text
    .split(/\s+/)
    .map((word) => word
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, '')
      .trim())
    .filter(Boolean);
}

function removeRepeatedRuns(words) {
  const result = [];
  for (const word of words) {
    result.push(word);
    for (const size of [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
      if (result.length < size * 2) continue;
      const a = result.slice(result.length - size * 2, result.length - size).join(' ');
      const b = result.slice(result.length - size).join(' ');
      if (a === b) {
        result.splice(result.length - size, size);
        break;
      }
    }
  }
  return result;
}

function trimPrefixOverlap(previousText, text) {
  const previous = normalizeTextForOverlap(previousText);
  const current = text.split(/\s+/).filter(Boolean);
  const currentNormalized = normalizeTextForOverlap(text);
  const max = Math.min(previous.length, current.length, 24);
  let overlap = 0;
  for (let size = max; size >= 2; size -= 1) {
    const prevSuffix = previous.slice(-size).join(' ');
    const currentPrefix = currentNormalized.slice(0, size).join(' ');
    if (prevSuffix === currentPrefix) {
      overlap = size;
      break;
    }
  }
  if (overlap === 0) {
    const previousTail = previous.slice(-40);
    for (let size = max; size >= 4; size -= 1) {
      const currentPrefix = currentNormalized.slice(0, size).join(' ');
      for (let index = 0; index <= previousTail.length - size; index += 1) {
        if (previousTail.slice(index, index + size).join(' ') === currentPrefix) {
          overlap = size;
          break;
        }
      }
      if (overlap) break;
    }
  }
  return current.slice(overlap).join(' ');
}

function cleanCaptionText(text) {
  const words = text.split(/\s+/).filter(Boolean);
  return removeRepeatedRuns(words).join(' ').trim();
}

export function cleanTranscriptCaptions(captions) {
  const cleaned = [];
  for (const caption of captions.sort((a, b) => a.start - b.start)) {
    let text = cleanCaptionText(caption.text);
    const previous = cleaned.at(-1);
    if (previous && caption.start - previous.end < 2.5) {
      text = trimPrefixOverlap(previous.text, text).trim();
    }
    text = cleanCaptionText(text);
    if (!text) continue;
    cleaned.push({...caption, text});
  }
  return cleaned;
}

export function parseJsonTranscript(raw) {
  const parsed = JSON.parse(raw);
  const items = Array.isArray(parsed)
    ? parsed
    : parsed.captions ?? parsed.segments ?? parsed.transcript ?? parsed.results ?? [];
  return cleanTranscriptCaptions(items.map(normalizeCaption).filter(Boolean));
}

export function parseSrtTranscript(raw) {
  const blocks = raw
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
  const captions = [];
  for (const [index, block] of blocks.entries()) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    const timingIndex = lines.findIndex((line) => line.includes('-->'));
    if (timingIndex === -1) continue;
    const [startRaw, endRaw] = lines[timingIndex].split('-->').map((part) => part.trim().split(/\s+/)[0]);
    const text = lines.slice(timingIndex + 1).join(' ').replace(/<[^>]+>/g, '').trim();
    const caption = normalizeCaption({start: parseTimecode(startRaw), end: parseTimecode(endRaw), text}, index);
    if (caption) captions.push(caption);
  }
  return cleanTranscriptCaptions(captions);
}

export function parseVttTranscript(raw) {
  return parseSrtTranscript(raw.replace(/^WEBVTT[^\n]*\n+/i, ''));
}

export function approximatePlainTextTranscript(raw, videoDuration) {
  const sentences = raw
    .replace(/\r/g, ' ')
    .split(/(?<=[.!?¿¡])\s+/)
    .map((text) => text.trim())
    .filter(Boolean);
  if (sentences.length === 0) return [];
  const totalWords = sentences.reduce((sum, sentence) => sum + sentence.split(/\s+/).length, 0);
  let cursor = 0;
  return cleanTranscriptCaptions(sentences.map((text, index) => {
    const words = text.split(/\s+/).length;
    const duration = Math.max(1.2, (words / Math.max(1, totalWords)) * videoDuration);
    const start = cursor;
    const end = index === sentences.length - 1 ? videoDuration : Math.min(videoDuration, cursor + duration);
    cursor = end;
    return normalizeCaption({start, end, text}, index);
  }).filter(Boolean));
}

export function parseTranscriptText(raw, filename = '', videoDuration = 0) {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    return parseJsonTranscript(trimmed);
  }
  if (lower.endsWith('.vtt') || trimmed.startsWith('WEBVTT')) {
    return parseVttTranscript(trimmed);
  }
  if (lower.endsWith('.srt') || trimmed.includes('-->')) {
    return parseSrtTranscript(trimmed);
  }
  return approximatePlainTextTranscript(trimmed, videoDuration || 60);
}

export async function loadTranscript(file, videoDuration = 0) {
  const raw = await readFile(file, 'utf8');
  const captions = parseTranscriptText(raw, file, videoDuration);
  if (captions.length === 0) {
    throw new Error(`Transcript ${file} did not contain usable timed captions.`);
  }
  return captions;
}

export function captionsToText(captions) {
  return captions.map((caption) => caption.text).join(' ');
}

export function sliceCaptions(captions, start, end) {
  return captions
    .filter((caption) => caption.end > start && caption.start < end)
    .map((caption) => ({
      ...caption,
      start: round(Math.max(0, caption.start - start), 3),
      end: round(Math.min(end - start, caption.end - start), 3)
    }));
}
