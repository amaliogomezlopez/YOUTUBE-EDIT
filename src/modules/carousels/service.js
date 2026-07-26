import {makeId} from '../../lib/utils.js';
import {CAROUSEL_LAYOUTS, CAROUSEL_LIMITS, CAROUSEL_THEMES} from './constants.js';
import {assetSlotsForSlide, carouselLayoutNeedsAsset, planCarousel} from './planner.js';
import {loadCarouselProject, saveCarouselProject} from './repository.js';
import {validateCarouselProject} from './validator.js';

function clean(value, max) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

export async function createCarouselProject(input = {}, options = {}) {
  const plan = await planCarousel(input.source, {...input, ...options});
  const now = new Date().toISOString();
  const project = {
    version: 1,
    id: makeId('carousel'),
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    renderedAt: null,
    ...plan,
    assets: [],
    renders: {outputs: [], contactSheetName: null}
  };
  project.validation = validateCarouselProject(project);
  await saveCarouselProject(project, options);
  return project;
}

function normalizeSlidePatch(current, patch = {}, index = 0, theme = 'forge') {
  const layout = CAROUSEL_LAYOUTS.includes(patch.layout) ? patch.layout : current.layout;
  const updated = {
    ...current,
    layout,
    label: 'label' in patch ? clean(patch.label, CAROUSEL_LIMITS.labelCharacters).toUpperCase() : current.label,
    headline: 'headline' in patch ? clean(patch.headline, CAROUSEL_LIMITS.headlineCharacters) : current.headline,
    body: 'body' in patch ? clean(patch.body, CAROUSEL_LIMITS.bodyCharacters) : current.body,
    accent: 'accent' in patch ? clean(patch.accent, 40) : current.accent,
    stat: 'stat' in patch ? clean(patch.stat, 24) : current.stat
  };
  if (!carouselLayoutNeedsAsset(layout)) updated.assetSlots = [];
  else if (!carouselLayoutNeedsAsset(current.layout) || !(current.assetSlots || []).length) {
    updated.assetSlots = assetSlotsForSlide(updated, index, theme);
  }
  return updated;
}

export async function updateCarouselProject(id, patch = {}, options = {}) {
  const project = await loadCarouselProject(id, options);
  if ('title' in patch) project.title = clean(patch.title, 90);
  if ('audience' in patch) project.audience = clean(patch.audience, 100);
  if ('tone' in patch) project.tone = clean(patch.tone, 100);
  if ('handle' in patch) project.handle = clean(patch.handle, 60);
  if (CAROUSEL_THEMES[patch.theme]) project.theme = patch.theme;
  if (Array.isArray(patch.slideOrder)) {
    const currentById = new Map(project.slides.map((slide) => [slide.id, slide]));
    const unique = [...new Set(patch.slideOrder.map(String))];
    if (unique.length === project.slides.length && unique.every((slideId) => currentById.has(slideId))) {
      const ordered = unique.map((slideId, index) => ({...currentById.get(slideId), order: index + 1}));
      if (ordered[0].role !== 'cover' || ordered.at(-1).role !== 'cta') {
        const error = new Error('La portada debe permanecer primera y la CTA debe permanecer última.');
        error.status = 400;
        error.code = 'CAROUSEL_FIXED_EDGES';
        throw error;
      }
      project.slides = ordered;
    }
  }
  if (patch.slide?.id) {
    const index = project.slides.findIndex((slide) => slide.id === patch.slide.id);
    if (index < 0) {
      const error = new Error('No se encontró la diapositiva que quieres editar.');
      error.status = 400;
      error.code = 'CAROUSEL_SLIDE_NOT_FOUND';
      throw error;
    }
    const current = project.slides[index];
    const safePatch = current.role === 'cover' ? {...patch.slide, layout: 'cover-hero'} : current.role === 'cta' ? {...patch.slide, layout: 'cta'} : patch.slide;
    project.slides[index] = normalizeSlidePatch(current, safePatch, index, project.theme);
  }
  project.status = 'draft';
  if (project.renders?.outputs?.length) project.renders.stale = true;
  project.validation = validateCarouselProject(project);
  await saveCarouselProject(project, options);
  return project;
}

export function publicCarouselProject(project) {
  return {
    ...project,
    assets: (project.assets || []).map(({filename, ...asset}) => asset),
    renders: {
      stale: Boolean(project.renders?.stale),
      contactSheetUrl: project.renders?.contactSheetName && !project.renders?.stale ? `/api/carousels/${encodeURIComponent(project.id)}/render-files/${encodeURIComponent(project.renders.contactSheetName)}` : null,
      outputs: (project.renders?.stale ? [] : project.renders?.outputs || []).map((item) => ({
        ...item,
        pngUrl: `/api/carousels/${encodeURIComponent(project.id)}/render-files/${encodeURIComponent(item.format)}/${encodeURIComponent(item.pngName)}`,
        jpegUrl: `/api/carousels/${encodeURIComponent(project.id)}/render-files/${encodeURIComponent(item.format)}/${encodeURIComponent(item.jpegName)}`
      }))
    }
  };
}
