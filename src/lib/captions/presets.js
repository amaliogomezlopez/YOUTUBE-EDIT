import {clamp} from '../utils.js';
import {CAPTION_PRESETS} from '../../../public/js/caption-presets.js';

export {CAPTION_PRESETS};

function cleanText(value, fallback, maxLength = 80) {
  const text = String(value ?? '').replace(/[\r\n,]/g, ' ').replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, maxLength) : fallback;
}

function color(value, fallback) {
  const normalized = String(value ?? '').trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function number(value, fallback, min, max) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function boolean(value, fallback) {
  if (value === true || value === 'true' || value === 'on' || value === 1 || value === '1') return true;
  if (value === false || value === 'false' || value === 'off' || value === 0 || value === '0') return false;
  return fallback;
}

export function resolveCaptionStyle(options = {}) {
  const presetName = CAPTION_PRESETS[options.preset] ? options.preset : 'progressive-reference';
  const preset = CAPTION_PRESETS[presetName];
  const position = ['upper-middle', 'center', 'lower-middle', 'lower'].includes(options.position)
    ? options.position
    : preset.position;
  const align = ['left', 'center'].includes(options.align) ? options.align : preset.align;
  const emphasis = ['auto', 'off'].includes(options.emphasis) ? options.emphasis : preset.emphasis;
  const accent = color(options.accent, preset.accent);
  const activeFallback = preset.activeColor === preset.accent ? accent : preset.activeColor;
  return {
    ...preset,
    preset: presetName,
    font: cleanText(options.font, preset.font),
    primary: color(options.primary, preset.primary),
    accent,
    activeColor: color(options.activeColor, activeFallback),
    baseFontSize: Math.round(number(options.baseFontSize ?? options.fontSize, preset.baseFontSize, 48, 132)),
    heroScale: number(options.heroScale, preset.heroScale, 1, 2.6),
    leadScale: number(options.leadScale, preset.leadScale ?? 1, 0.7, 1.5),
    tailScale: number(options.tailScale, preset.tailScale ?? 1, 0.7, 1.5),
    position,
    align,
    uppercase: boolean(options.uppercase, preset.uppercase),
    emphasis,
    maxWords: Math.round(number(options.maxWords, preset.maxWords, 3, 12)),
    maxPageDuration: number(options.maxPageDuration, preset.maxPageDuration, 1.2, 6),
    pauseBreak: number(options.pauseBreak, preset.pauseBreak, 0.12, 1.5),
    maxLineChars: Math.round(number(options.maxLineChars, preset.maxLineChars, 10, 30)),
    marginX: Math.round(number(options.marginX, preset.marginX, 70, 260)),
    outlineSize: number(options.outlineSize, preset.outlineSize, 0, 12),
    shadow: number(options.shadow, preset.shadow, 0, 8),
    tracking: number(options.tracking, preset.tracking, -2, 12)
  };
}
