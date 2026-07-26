import {CAROUSEL_FORMATS, CAROUSEL_LAYOUTS, CAROUSEL_LIMITS, CAROUSEL_THEMES} from './constants.js';
import {inspectCarouselLayout} from './renderer.js';

function rgb(hex) {
  const value = String(hex || '').replace('#', '');
  if (!/^[a-f\d]{6}$/i.test(value)) return null;
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(channel) {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

export function contrastRatio(foreground, background) {
  const fg = rgb(foreground);
  const bg = rgb(background);
  if (!fg || !bg) return 0;
  const first = 0.2126 * luminance(fg[0]) + 0.7152 * luminance(fg[1]) + 0.0722 * luminance(fg[2]);
  const second = 0.2126 * luminance(bg[0]) + 0.7152 * luminance(bg[1]) + 0.0722 * luminance(bg[2]);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function validateCarouselProject(project) {
  const errors = [];
  const warnings = [];
  const slides = project.slides || [];
  if (slides.length < CAROUSEL_LIMITS.minSlides || slides.length > CAROUSEL_LIMITS.maxSlides) errors.push(`El proyecto debe contener entre ${CAROUSEL_LIMITS.minSlides} y ${CAROUSEL_LIMITS.maxSlides} diapositivas.`);
  const ids = new Set();
  const evidenceIds = new Set((project.evidence || []).map((item) => item.id));
  if (slides.length && (slides[0].role !== 'cover' || slides[0].layout !== 'cover-hero')) errors.push('La primera diapositiva debe ser la portada cover-hero.');
  if (slides.length && (slides.at(-1).role !== 'cta' || slides.at(-1).layout !== 'cta')) errors.push('La última diapositiva debe ser la CTA.');
  for (const [index, slide] of slides.entries()) {
    if (ids.has(slide.id)) errors.push(`La diapositiva ${index + 1} tiene un ID duplicado.`);
    ids.add(slide.id);
    if (!CAROUSEL_LAYOUTS.includes(slide.layout)) errors.push(`Layout no admitido en ${slide.id}: ${slide.layout}`);
    if (!slide.headline?.trim()) errors.push(`${slide.id} no tiene titular.`);
    if (slide.layout === 'stat' && !String(slide.stat || slide.accent || '').trim()) errors.push(`${slide.id} usa un layout de dato sin una cifra explícita.`);
    if (['pros-cons', 'comparison', 'steps'].includes(slide.layout)) {
      const itemCount = String(slide.body || '').split(/\n|\s*[;•]\s*/).map((item) => item.trim()).filter(Boolean).length;
      if (itemCount < 2) errors.push(`${slide.id} necesita al menos dos elementos para el layout ${slide.layout}.`);
    }
    if (slide.headline?.length > CAROUSEL_LIMITS.headlineCharacters) errors.push(`${slide.id} supera el límite de titular.`);
    if (slide.body?.length > CAROUSEL_LIMITS.bodyCharacters) errors.push(`${slide.id} supera el límite de cuerpo.`);
    if (slide.role !== 'cta' && !(slide.evidenceRefs || []).some((id) => evidenceIds.has(id))) warnings.push(`${slide.id} no conserva una referencia válida a la fuente.`);
    for (const format of Object.values(CAROUSEL_FORMATS)) {
      const inspection = inspectCarouselLayout(project, slide.id, format.id, {assetDataUri: (slide.assetSlots || []).some((slot) => slot.assetId) ? 'data:image/png;base64,iVBORw0KGgo=' : null});
      if (inspection.overflows.length) errors.push(`${slide.id} desborda ${inspection.overflows.join(', ')} en ${format.label}.`);
      if (inspection.collisions.length) errors.push(`${slide.id} solapa ${inspection.collisions.map(([first, second]) => `${first}/${second}`).join(', ')} en ${format.label}.`);
    }
    if ((slide.assetSlots || []).some((slot) => !slot.assetId)) warnings.push(`${slide.id} conserva una imagen pendiente; se exportará con placeholder.`);
  }
  const theme = CAROUSEL_THEMES[project.theme] || CAROUSEL_THEMES.forge;
  if (contrastRatio(theme.ink, theme.paper) < 4.5) errors.push(`El tema ${project.theme} no alcanza contraste AA entre texto y fondo.`);
  if (contrastRatio(theme.accentInk, theme.accent) < 3) warnings.push(`El acento del tema ${project.theme} tiene contraste ajustado para texto grande.`);
  return {valid: errors.length === 0, errors: [...new Set(errors)], warnings: [...new Set(warnings)]};
}
