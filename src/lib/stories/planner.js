import {chatJson, getLlmConfig, isLlmEnabled} from '../llm.js';

const LAYOUTS = ['cover', 'statement', 'stat', 'split', 'solution', 'cta'];

function clean(value, max = 240) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function fallbackPlan(source, options = {}) {
  const title = clean(options.title || source.split(/[.!?\n]/)[0] || 'La noticia de IA', 70);
  const body = clean(source, 360);
  return {
    title,
    theme: options.theme || 'signal',
    source: clean(options.source, 90),
    llmUsed: false,
    slides: [
      {layout: 'cover', label: 'IA AL DÍA', headline: title, body: '', accent: title.split(' ').slice(-2).join(' ')},
      {layout: 'statement', label: 'EL CONTEXTO', headline: 'LO QUE\nHA PASADO', body, accent: 'HA PASADO'},
      {layout: 'cta', label: 'EN RESUMEN', headline: 'GUÁRDALO\nPARA LUEGO', body: 'Sigue el canal para entender la IA sin ruido.', accent: 'GUÁRDALO'}
    ]
  };
}

function normalizeSlide(slide, index) {
  const layout = LAYOUTS.includes(slide?.layout) ? slide.layout : LAYOUTS[index % LAYOUTS.length];
  return {
    layout,
    label: clean(slide?.label || 'IA AL DÍA', 24).toUpperCase(),
    headline: clean(slide?.headline, 90).toUpperCase(),
    body: clean(slide?.body, 320),
    accent: clean(slide?.accent, 35).toUpperCase(),
    stat: clean(slide?.stat, 18),
    imageUrl: clean(slide?.imageUrl, 600),
    imageQuery: clean(slide?.imageQuery, 100)
  };
}

export async function planStory(source, options = {}) {
  const text = clean(source, 12000);
  if (text.length < 40) throw new Error('Añade al menos 40 caracteres de contenido fuente.');
  const fallback = fallbackPlan(text, options);
  const config = getLlmConfig(options);
  if (options.useLlm === false || !isLlmEnabled(config)) return fallback;

  try {
    const result = await chatJson([
      {role: 'system', content: 'Eres director editorial de un canal español de IA. Convierte fuentes en Stories rigurosas, visuales y concisas. No inventes cifras ni hechos. Devuelve exclusivamente JSON válido.'},
      {role: 'user', content: `Crea un carrusel de 4 a 7 Stories verticales. Usa layouts de: cover, statement, stat, split, solution, cta. Cada slide: layout, label, headline (máximo 9 palabras), body (máximo 38 palabras), accent (fragmento literal del headline o body), stat opcional, imageQuery opcional. La primera debe ser cover y la última cta. Varía el ritmo y dedica una idea a cada slide. Tema: ${clean(options.title || 'noticia de IA', 80)}. Fuente verificable:\n${text}`}
    ], {...config, temperature: 0.55, maxTokens: 2200});
    const rawSlides = Array.isArray(result)
      ? result
      : result.slides || result.stories || result.carousel?.slides || result.story?.slides || result.data?.slides || [];
    const slides = rawSlides.slice(0, 7).map(normalizeSlide).filter((slide) => slide.headline);
    if (slides.length < 3) throw new Error('El LLM devolvió pocas diapositivas.');
    return {title: clean(result.title || fallback.title, 70), theme: options.theme || result.theme || 'signal', source: clean(options.source, 90), llmUsed: true, slides};
  } catch (error) {
    return {...fallback, warning: `MiniMax no pudo estructurar la historia: ${error.message}`};
  }
}

export {fallbackPlan, normalizeSlide};
