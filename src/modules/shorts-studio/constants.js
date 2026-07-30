import path from 'node:path';
import {ROOT} from '../../lib/utils.js';

export const REMOTION_ROOT = path.join(ROOT, 'remotion-animations');

// Media pesada: vive en public/ porque Remotion la lee con staticFile(). Ya esta
// ignorada por remotion-animations/.gitignore (public/projects/).
export const SHORTS_MEDIA_ROOT = path.join(REMOTION_ROOT, 'public', 'projects', 'shorts');

// Plan editable + transcripciones: texto, versionable.
export const SHORTS_PROJECTS_ROOT = path.join(REMOTION_ROOT, 'projects');

export const SHORT_FORMAT = {width: 1080, height: 1920, fps: 60};

export const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.mov', '.webm', '.avi', '.m4v']);
export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

export function mediaDir(slug) {
  return path.join(SHORTS_MEDIA_ROOT, slug);
}

export function projectDir(slug) {
  return path.join(SHORTS_PROJECTS_ROOT, `shorts-${slug}`);
}

/** Ruta tal como la consume staticFile() dentro de Remotion. */
export function staticPath(slug, ...parts) {
  return ['projects', 'shorts', slug, ...parts].join('/');
}

export function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Orden natural: 2.mkv antes de 10.mkv. */
export function naturalCompare(a, b) {
  return String(a).localeCompare(String(b), 'en', {numeric: true, sensitivity: 'base'});
}
