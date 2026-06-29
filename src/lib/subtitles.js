import {writeFile} from 'node:fs/promises';
import {secondsToAssTime} from './utils.js';

function escapeAss(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ')
    .trim();
}

function wordCaptions(captions) {
  const words = [];
  for (const caption of captions) {
    const parts = caption.text.split(/\s+/).map((word) => word.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    const duration = Math.max(0.1, caption.end - caption.start);
    const weights = parts.map((word) => Math.max(1, word.replace(/[^\p{L}\p{N}]/gu, '').length));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let cursor = caption.start;
    for (const [index, word] of parts.entries()) {
      const isLast = index === parts.length - 1;
      const span = isLast ? caption.end - cursor : duration * (weights[index] / total);
      const end = isLast ? caption.end : Math.min(caption.end, cursor + Math.max(0.16, span));
      words.push({
        ...caption,
        text: word,
        start: cursor,
        end
      });
      cursor = end;
    }
  }
  return words;
}

function wrapCaption(text, maxChars = 34) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 2).join('\\N');
}

export function captionsToAss(captions, options = {}) {
  const oneWord = options.mode === 'words' || options.wordByWord === true;
  const sourceCaptions = oneWord ? wordCaptions(captions) : captions;
  const font = options.font ?? 'Arial Black';
  const fontSize = options.fontSize ?? (oneWord ? 98 : 82);
  const primary = options.primary ?? '&H0000FFFF';
  const outline = options.outline ?? '&H00000000';
  const accent = options.accent ?? '&H0000FFFF';
  const marginV = options.marginV ?? 150;
  const outlineSize = options.outlineSize ?? 8;
  const shadow = options.shadow ?? 3;
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${font},${fontSize},${primary},${accent},${outline},&H90000000,-1,0,0,0,100,100,0,0,1,${outlineSize},${shadow},2,70,70,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;

  const events = sourceCaptions.map((caption) => {
    const rawText = caption.text.toLocaleUpperCase('es-ES');
    const text = oneWord ? escapeAss(rawText) : wrapCaption(escapeAss(rawText));
    return `Dialogue: 0,${secondsToAssTime(caption.start)},${secondsToAssTime(caption.end)},Default,,0,0,0,,${text}`;
  });
  return `${header}\n${events.join('\n')}\n`;
}

export async function writeAssFile(file, captions, options = {}) {
  await writeFile(file, captionsToAss(captions, options), 'utf8');
}
