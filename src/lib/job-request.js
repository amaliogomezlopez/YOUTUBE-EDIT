const RENDER_MODES = new Set(['', 'crop', 'fit', 'pip']);
const RENDER_QUALITIES = new Set(['draft', 'standard', 'high']);
const SUBTITLE_MODES = new Set(['karaoke', 'progressive', 'words', 'lines']);
const STT_PROVIDERS = new Set(['off', 'faster-whisper', 'whisper-cli', 'openai', 'nemotron']);

function boundedNumber(value, {label, fallback, min, max, integer = false}) {
  const parsed = value === undefined || value === null || value === '' ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isInteger(parsed))) {
    throw new Error(`${label} debe ser ${integer ? 'un entero' : 'un número'} entre ${min} y ${max}.`);
  }
  return parsed;
}

function choice(value, allowed, fallback, label) {
  const normalized = String(value ?? fallback).trim();
  if (!allowed.has(normalized)) throw new Error(`${label} no es válido.`);
  return normalized || undefined;
}

export function validateJobOptions(fields = {}) {
  const topN = boundedNumber(fields.topN, {label: 'El número de clips', fallback: 8, min: 1, max: 20, integer: true});
  const minDuration = boundedNumber(fields.minDuration, {label: 'La duración mínima', fallback: 18, min: 4, max: 90});
  const maxDuration = boundedNumber(fields.maxDuration, {label: 'La duración máxima', fallback: 60, min: 8, max: 120});
  if (minDuration > maxDuration) throw new Error('La duración mínima no puede superar la máxima.');
  const language = String(fields.sttLanguage || 'auto').trim().toLowerCase();
  if (!/^(?:auto|[a-z]{2,3}(?:-[a-z0-9]{2,8})*)$/i.test(language)) throw new Error('El idioma de transcripción no es válido.');
  return {
    topN,
    minDuration,
    maxDuration,
    renderMode: choice(fields.renderMode, RENDER_MODES, '', 'El modo de composición'),
    renderQuality: choice(fields.renderQuality, RENDER_QUALITIES, 'high', 'La calidad de render'),
    subtitleMode: choice(fields.subtitleMode, SUBTITLE_MODES, 'karaoke', 'El modo de subtítulos'),
    sttProvider: choice(fields.sttProvider, STT_PROVIDERS, 'faster-whisper', 'El proveedor de transcripción'),
    sttModel: String(fields.sttModel || '').replace(/[\r\n]/g, ' ').trim().slice(0, 120) || undefined,
    sttLanguage: language,
    sttInitialPrompt: String(fields.sttPrompt || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 1200) || undefined,
    useLlm: fields.useLlm === 'on'
  };
}

export function transcriptSourceKind({pathValue, uploadedSize, pastedText} = {}) {
  const sources = [
    String(pathValue || '').trim() ? 'path' : null,
    Number(uploadedSize) > 0 ? 'upload' : null,
    String(pastedText || '').trim() ? 'text' : null
  ].filter(Boolean);
  if (sources.length > 1) throw new Error('Elige una sola fuente de transcripción: ruta, archivo o texto pegado.');
  return sources[0] || null;
}
