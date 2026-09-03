import {writeFile} from 'node:fs/promises';
import {secondsToAssTime} from './utils.js';
import {buildProgressiveCaptionPlan, captionsToTimedWords} from './captions/planner.js';

function escapeAss(text) {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\n/g, ' ')
    .trim();
}

function wordCaptions(captions) {
  return captionsToTimedWords(captions).map((word) => ({
    id: word.id,
    text: word.text,
    start: word.start,
    end: word.end,
    confidence: word.confidence
  }));
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

function hexToAss(value, fallback = '#FFFFFF', includeAlpha = true) {
  const normalized = /^#[0-9A-F]{6}$/i.test(String(value ?? '')) ? String(value).slice(1) : fallback.slice(1);
  const [rr, gg, bb] = [normalized.slice(0, 2), normalized.slice(2, 4), normalized.slice(4, 6)];
  return `&H${includeAlpha ? '00' : ''}${bb}${gg}${rr}${includeAlpha ? '' : '&'}`.toUpperCase();
}

export function isKaraokeCaptions(options = {}) {
  if (options.mode === 'words' || options.mode === 'lines') return false;
  if (options.mode === 'karaoke') return true;
  return options.preset === 'karaoke-highlight';
}

function applyWordCase(text, line, style) {
  if (line.case === 'lower') return text.toLocaleLowerCase('es-ES');
  if (line.case === 'upper' || style.uppercase) return text.toLocaleUpperCase('es-ES');
  return text;
}

function karaokeAss(plan) {
  const {style} = plan;
  const primary = hexToAss(style.primary);
  const accent = hexToAss(style.accent);
  const activeTag = hexToAss(style.activeColor, style.accent, false);
  const primaryTag = hexToAss(style.primary, '#FFFFFF', false);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Karaoke,${style.font},${style.baseFontSize},${primary},${accent},&H00000000,&H70000000,-1,0,0,0,100,100,${style.tracking},0,1,${style.outlineSize},${style.shadow},8,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
  const events = [];
  for (const page of plan.pages) {
    const pageWords = page.lines.flatMap((line) => line.words);
    for (const [wordIndex, word] of pageWords.entries()) {
      const next = pageWords[wordIndex + 1];
      const start = word.start;
      const end = next ? Math.max(start + 0.03, next.start) : Math.max(start + 0.03, page.end);
      for (const line of page.lines) {
        const alignment = line.align === 'center' ? 8 : 7;
        const pieces = line.words.map((item) => {
          const text = escapeAss(applyWordCase(item.text, line, style));
          const active = item.id === word.id || (item.start === word.start && item.end === word.end && item.text === word.text);
          const future = item.start > word.start + 0.0001;
          if (active) {
            return `{\\1c${activeTag}\\fscx108\\fscy108\\bord${Math.min(12, style.outlineSize + 1)}}${text}{\\fscx100\\fscy100\\bord${style.outlineSize}\\1c${primaryTag}}`;
          }
          if (future) return `{\\1a&H70&}${text}{\\1a&H00&}`;
          return text;
        });
        const tags = `{\\an${alignment}\\pos(${line.x},${line.y})\\fn${style.font}\\fs${line.fontSize}\\fsp${style.tracking}\\bord${style.outlineSize}\\shad${style.shadow}\\q2}`;
        events.push(`Dialogue: 1,${secondsToAssTime(start)},${secondsToAssTime(end)},Karaoke,,0,0,0,,${tags}${pieces.join(' ')}`);
      }
    }
  }
  return `${header}\n${events.join('\n')}\n`;
}

function progressiveAss(plan) {
  const {style} = plan;
  const primary = hexToAss(style.primary);
  const accent = hexToAss(style.accent);
  const activeTag = hexToAss(style.activeColor, style.accent, false);
  const primaryTag = hexToAss(style.primary, '#FFFFFF', false);
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Progressive,${style.font},${style.baseFontSize},${primary},${accent},&H00000000,&H70000000,-1,0,0,0,100,100,${style.tracking},0,1,${style.outlineSize},${style.shadow},7,0,0,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
  const events = [];
  for (const page of plan.pages) {
    for (const line of page.lines) {
      const alignment = line.align === 'center' ? 8 : 7;
      for (const [index, word] of line.words.entries()) {
        const next = line.words[index + 1];
        const start = word.start;
        const end = next ? Math.max(start + 0.03, next.start) : Math.max(start + 0.03, page.end);
        const visible = line.words.slice(0, index + 1).map((item) => {
          const text = line.case === 'lower'
            ? item.text.toLocaleLowerCase('es-ES')
            : (line.case === 'upper' || style.uppercase ? item.text.toLocaleUpperCase('es-ES') : item.text);
          return escapeAss(text);
        });
        const active = visible.pop();
        const previous = visible.join(' ');
        const colorized = activeTag === primaryTag
          ? [previous, active].filter(Boolean).join(' ')
          : `${previous ? `${previous} ` : ''}{\\1c${activeTag}}${active}`;
        const tags = `{\\an${alignment}\\pos(${line.x},${line.y})\\fn${style.font}\\fs${line.fontSize}\\fsp${style.tracking}\\bord${style.outlineSize}\\shad${style.shadow}\\q2}`;
        events.push(`Dialogue: 1,${secondsToAssTime(start)},${secondsToAssTime(end)},Progressive,,0,0,0,,${tags}${colorized}`);
      }
    }
  }
  return `${header}\n${events.join('\n')}\n`;
}

export function captionOverlayFromPlan(plan) {
  if (!plan?.pages) return null;
  return {
    renderer: plan.renderer,
    preset: plan.preset,
    timing: plan.timing ?? null,
    style: {
      font: plan.style.font,
      primary: plan.style.primary,
      accent: plan.style.accent,
      activeColor: plan.style.activeColor,
      uppercase: plan.style.uppercase,
      position: plan.style.position,
      align: plan.style.align,
      outlineSize: plan.style.outlineSize,
      shadow: plan.style.shadow,
      baseFontSize: plan.style.baseFontSize,
      position: plan.style.position,
      anchorY: plan.style.anchorY ?? null
    },
    pages: plan.pages.map((page) => ({
      start: page.start,
      end: page.end,
      lines: page.lines.map((line) => ({
        role: line.role,
        case: line.case,
        y: line.y,
        words: line.words.map((word) => ({text: word.text, start: word.start, end: word.end}))
      }))
    }))
  };
}

export function buildSubtitleDocument(captions, options = {}) {
  const karaoke = isKaraokeCaptions(options);
  const resolved = karaoke && !options.preset ? {...options, preset: 'karaoke-highlight'} : options;
  if (karaoke || resolved.mode === 'progressive' || String(resolved.preset ?? '').startsWith('progressive')) {
    const plan = buildProgressiveCaptionPlan(captions, resolved);
    if (karaoke) {
      plan.renderer = 'ass-karaoke';
      return {ass: karaokeAss(plan), plan};
    }
    return {ass: progressiveAss(plan), plan};
  }
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
  return {ass: `${header}\n${events.join('\n')}\n`, plan: null};
}

export function captionsToAss(captions, options = {}) {
  return buildSubtitleDocument(captions, options).ass;
}

export async function writeAssFile(file, captions, options = {}) {
  const document = buildSubtitleDocument(captions, options);
  await writeFile(file, document.ass, 'utf8');
  return document;
}
