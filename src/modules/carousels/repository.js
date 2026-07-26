import path from 'node:path';
import {readdir} from 'node:fs/promises';
import {CAROUSELS_DIR, ensureDir, readJson, writeJson} from '../../lib/utils.js';

const ID_PATTERN = /^carousel-[a-zA-Z0-9-]+$/;

export function assertCarouselId(id) {
  const value = String(id || '');
  if (!ID_PATTERN.test(value)) {
    const error = new Error('Identificador de carrusel no válido.');
    error.code = 'INVALID_CAROUSEL_ID';
    error.status = 400;
    throw error;
  }
  return value;
}

export function carouselDir(id, root = CAROUSELS_DIR) {
  return path.join(root, assertCarouselId(id));
}

export function carouselProjectFile(id, root = CAROUSELS_DIR) {
  return path.join(carouselDir(id, root), 'project.json');
}

export async function saveCarouselProject(project, {root = CAROUSELS_DIR} = {}) {
  project.updatedAt = new Date().toISOString();
  await ensureDir(carouselDir(project.id, root));
  await writeJson(carouselProjectFile(project.id, root), project);
  return project;
}

export async function loadCarouselProject(id, {root = CAROUSELS_DIR} = {}) {
  return readJson(carouselProjectFile(id, root));
}

export function carouselSummary(project) {
  return {
    id: project.id,
    title: project.title,
    status: project.status,
    theme: project.theme,
    slideCount: project.slides?.length || 0,
    renderedAt: project.renderedAt || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    warnings: project.validation?.warnings?.length || 0
  };
}

export async function listCarouselProjects({root = CAROUSELS_DIR, limit = 50} = {}) {
  const entries = await readdir(root, {withFileTypes: true}).catch(() => []);
  const projects = await Promise.all(entries.filter((entry) => entry.isDirectory() && ID_PATTERN.test(entry.name)).map(async (entry) => {
    try {
      return carouselSummary(await loadCarouselProject(entry.name, {root}));
    } catch {
      return null;
    }
  }));
  return projects.filter(Boolean).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, limit);
}
