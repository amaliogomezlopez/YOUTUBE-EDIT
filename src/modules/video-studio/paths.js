import path from 'node:path';
import {ROOT} from '../../lib/utils.js';

/**
 * Rutas y utilidades de nombre comunes a las superficies de montaje.
 *
 * Una "superficie" es un formato con su propio contrato de montaje: `shorts`
 * (9:16 vertical), `intro` (16:9 con mi cara) y el motor editorial 16:9. Las tres
 * comparten arbol de proyecto y media, y solo se diferencian en el prefijo, asi
 * que el reparto de carpetas vive aqui una vez.
 */
export const REMOTION_ROOT = path.join(ROOT, 'remotion-animations');

/** Media pesada: Remotion la lee con staticFile(); esta ignorada por git. */
export const MEDIA_ROOT = path.join(REMOTION_ROOT, 'public', 'projects');

/** Planes y transcripciones: texto, versionable. */
export const PROJECTS_ROOT = path.join(REMOTION_ROOT, 'projects');

export const VIDEO_EXTENSIONS = new Set(['.mkv', '.mp4', '.mov', '.webm', '.avi', '.m4v']);
export const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif', '.gif', '.svg']);
export const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.m4a', '.aac', '.flac', '.ogg', '.opus']);

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g');

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

/**
 * Reparto de carpetas de una superficie. `surface` es el prefijo con el que se
 * nombran el directorio de proyecto (`<surface>-<slug>`) y el de media
 * (`public/projects/<surface>/<slug>`), de modo que dos superficies con el mismo
 * slug no se pisan.
 */
export function surfacePaths(surface) {
  return {
    surface,
    mediaDir: (slug) => path.join(MEDIA_ROOT, surface, slug),
    projectDir: (slug) => path.join(PROJECTS_ROOT, `${surface}-${slug}`),
    /** Ruta tal como la consume staticFile() dentro de Remotion. */
    staticPath: (slug, ...parts) => ['projects', surface, slug, ...parts].join('/')
  };
}
