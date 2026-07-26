import {chatJson, getLlmConfig, isLlmEnabled} from '../../lib/llm.js';
import {clamp} from '../../lib/utils.js';
import {CAROUSEL_LAYOUTS, CAROUSEL_LIMITS, CAROUSEL_THEMES} from './constants.js';

function clean(value, max = 500) {
  return String(value ?? '').replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').trim().slice(0, max);
}

function inputError(message, code) {
  const error = new Error(message);
  error.status = 400;
  error.code = code;
  return error;
}

export function buildEvidence(source) {
  const text = clean(source, CAROUSEL_LIMITS.sourceCharacters);
  const chunks = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((value) => clean(value, 320))
    .filter((value) => value.length >= 12)
    .slice(0, 120);
  return chunks.map((textValue, index) => ({id: `source-${String(index + 1).padStart(3, '0')}`, text: textValue}));
}

export function carouselLayoutNeedsAsset(layout) {
  return ['cover-hero', 'photo-annotation', 'quote', 'verdict'].includes(layout);
}

export function assetSlotsForSlide(slide, index, theme = 'forge') {
  if (!carouselLayoutNeedsAsset(slide.layout)) return [];
  const reservedTextZone = slide.layout === 'cover-hero' ? 'top-45-percent' : 'right-45-percent';
  return [{
    id: `${slide.id}-visual-01`,
    purpose: slide.layout === 'cover-hero' ? 'Ilustración o fotografía principal' : 'Apoyo visual',
    prompt: clean(slide.imagePrompt || `Imagen editorial original sobre ${slide.headline}. Paleta ${theme}. Sin texto, sin logotipos y con fondo sencillo.`, 600),
    composition: {subjectPosition: index % 2 ? 'bottom-left' : 'bottom-right', reservedTextZone, background: 'simple'},
    status: 'pending',
    assetId: null
  }];
}

function normalizeEvidenceRefs(value, evidenceIds, fallbackId) {
  const refs = (Array.isArray(value) ? value : []).map(String).filter((id) => evidenceIds.has(id)).slice(0, 5);
  return refs.length ? refs : fallbackId ? [fallbackId] : [];
}

export function normalizeCarouselSlides(rawSlides, {count, evidence, theme = 'forge'} = {}) {
  const wanted = clamp(Number(count) || 7, CAROUSEL_LIMITS.minSlides, CAROUSEL_LIMITS.maxSlides);
  const evidenceIds = new Set(evidence.map((item) => item.id));
  const slides = (Array.isArray(rawSlides) ? rawSlides : []).slice(0, wanted).map((raw, index) => {
    const id = `slide-${String(index + 1).padStart(2, '0')}`;
    const layout = CAROUSEL_LAYOUTS.includes(raw?.layout) ? raw.layout : CAROUSEL_LAYOUTS[index % CAROUSEL_LAYOUTS.length];
    const slide = {
      id,
      order: index + 1,
      role: clean(raw?.role || layout, 32),
      layout,
      label: clean(raw?.label || 'EN CLARO', CAROUSEL_LIMITS.labelCharacters).toUpperCase(),
      headline: clean(raw?.headline || `Pieza ${index + 1}`, CAROUSEL_LIMITS.headlineCharacters),
      body: clean(raw?.body, CAROUSEL_LIMITS.bodyCharacters),
      accent: clean(raw?.accent, 40),
      stat: clean(raw?.stat, 24),
      evidenceRefs: normalizeEvidenceRefs(raw?.evidenceRefs, evidenceIds, evidence[index % evidence.length]?.id),
      assetSlots: []
    };
    slide.assetSlots = assetSlotsForSlide({...slide, imagePrompt: raw?.imagePrompt}, index, theme);
    return slide;
  });
  if (slides.length) {
    slides[0].layout = 'cover-hero';
    slides[0].role = 'cover';
    slides.at(-1).layout = 'cta';
    slides.at(-1).role = 'cta';
    slides[0].assetSlots = assetSlotsForSlide(slides[0], 0, theme);
    slides.at(-1).assetSlots = [];
  }
  return slides;
}

function fallbackRawSlides(evidence, count, title) {
  const group = (start, amount = 3) => evidence.slice(start, start + amount).map((item) => item.text).join('; ');
  const safePatterns = [
    ['cover', 'cover-hero', 'EN CLARO', title, 'Una explicación visual construida únicamente con la fuente proporcionada.'],
    ['context', 'photo-annotation', 'EL CONTEXTO', 'QUÉ SABEMOS', evidence[0]?.text],
    ['features', 'feature-list', 'LO IMPORTANTE', 'LAS CLAVES', group(1) || group(0)],
    ['detail', 'photo-annotation', 'PUNTO CLAVE', 'UN DETALLE IMPORTANTE', evidence[3]?.text || evidence[1]?.text],
    ['evidence', 'feature-list', 'EN LA FUENTE', 'HECHOS A RETENER', group(4) || group(1)],
    ['summary', 'verdict', 'EN RESUMEN', 'LA IDEA CENTRAL', evidence[5]?.text || evidence[0]?.text],
    ['context-2', 'photo-annotation', 'OTRA CLAVE', 'QUÉ MÁS CONVIENE SABER', evidence[6]?.text || evidence[2]?.text],
    ['evidence-2', 'feature-list', 'REPASO', 'TRES IDEAS PARA RECORDAR', group(6) || group(0)],
    ['summary-2', 'verdict', 'CONCLUSIÓN', 'LO QUE DEJA LA FUENTE', evidence[8]?.text || evidence.at(-1)?.text],
  ];
  const cta = ['cta', 'cta', 'TU TURNO', '¿LO COMPARTIRÍAS?', 'Guarda el carrusel y compártelo con quien necesite una explicación clara.'];
  const selected = safePatterns.slice(0, Math.max(1, count - 1));
  selected.push(cta);
  return selected.slice(0, count).map(([role, layout, label, headline, body], index) => ({
    role, layout, label, headline, body: clean(body || evidence[index % evidence.length]?.text || '', CAROUSEL_LIMITS.bodyCharacters),
    evidenceRefs: role === 'cta' ? [] : [evidence[index % evidence.length]?.id].filter(Boolean)
  }));
}

export async function planCarousel(source, options = {}) {
  const text = clean(source, CAROUSEL_LIMITS.sourceCharacters);
  if (text.length < 80) throw inputError('Añade al menos 80 caracteres de fuente verificable.', 'CAROUSEL_SOURCE_TOO_SHORT');
  const count = clamp(Number(options.slideCount) || 7, CAROUSEL_LIMITS.minSlides, CAROUSEL_LIMITS.maxSlides);
  const theme = CAROUSEL_THEMES[options.theme] ? options.theme : 'forge';
  const evidence = buildEvidence(text);
  if (!evidence.length) throw inputError('No se pudieron extraer fragmentos verificables de la fuente.', 'CAROUSEL_SOURCE_INVALID');
  const title = clean(options.title || evidence[0].text, 90);
  let rawSlides = fallbackRawSlides(evidence, count, title);
  let llmUsed = false;
  let warning = null;
  const config = getLlmConfig(options);
  if (options.useLlm !== false && isLlmEnabled(config)) {
    try {
      const result = await chatJson([
        {role: 'system', content: 'Eres editor de carruseles informativos en español. Usa exclusivamente la evidencia enumerada. No inventes datos. Devuelve solo JSON válido.'},
        {role: 'user', content: `Diseña exactamente ${count} diapositivas. Primera cover-hero, última cta. Usa layouts variados de: ${CAROUSEL_LAYOUTS.join(', ')}. Usa stat solo si hay una cifra explícita; comparison solo si la fuente compara; pros-cons solo si acredita ventajas y límites; quote solo para una cita textual; steps solo si existe un proceso. Cada slide: role, layout, label, headline (máximo 10 palabras), body (máximo 55 palabras), accent opcional, stat obligatorio para stat, evidenceRefs con IDs válidos, imagePrompt sin texto ni logos. Audiencia: ${clean(options.audience || 'creadores de contenido', 80)}. Tono: ${clean(options.tone || 'claro, crítico y didáctico', 80)}. Tema: ${title}. Evidencia:\n${evidence.map((item) => `[${item.id}] ${item.text}`).join('\n')}`}
      ], {...config, signal: options.signal, temperature: 0.45, maxTokens: 3200});
      const candidate = Array.isArray(result) ? result : result.slides;
      if (!Array.isArray(candidate) || candidate.length < count) throw new Error(`El modelo devolvió ${candidate?.length || 0} de ${count} piezas.`);
      rawSlides = candidate;
      llmUsed = true;
    } catch (error) {
      if (options.signal?.aborted || error?.name === 'AbortError') throw error;
      warning = `Se utilizó el plan local porque la IA no devolvió un guion válido: ${error.message}`;
    }
  }
  return {
    title,
    source: text,
    sourceName: clean(options.sourceName, 120),
    audience: clean(options.audience || 'Creadores de contenido', 100),
    tone: clean(options.tone || 'Claro, crítico y didáctico', 100),
    theme,
    handle: clean(options.handle || 'shortsmith.ai', 60),
    llmUsed,
    warning,
    evidence,
    slides: normalizeCarouselSlides(rawSlides, {count, evidence, theme})
  };
}
