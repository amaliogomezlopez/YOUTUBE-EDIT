import path from 'node:path';
import {MEDIA_ROOT, PROJECTS_ROOT, surfacePaths} from '../video-studio/paths.js';

export {
  IMAGE_EXTENSIONS,
  REMOTION_ROOT,
  VIDEO_EXTENSIONS,
  naturalCompare,
  slugify
} from '../video-studio/paths.js';

export const SHORT_SURFACE = 'shorts';

const paths = surfacePaths(SHORT_SURFACE);

export const SHORTS_MEDIA_ROOT = path.join(MEDIA_ROOT, SHORT_SURFACE);
export const SHORTS_PROJECTS_ROOT = PROJECTS_ROOT;

// Media pesada: vive en public/ porque Remotion la lee con staticFile(). Ya esta
// ignorada por remotion-animations/.gitignore (public/projects/).
export const mediaDir = paths.mediaDir;

// Plan editable + transcripciones: texto, versionable.
export const projectDir = paths.projectDir;

/** Ruta tal como la consume staticFile() dentro de Remotion. */
export const staticPath = paths.staticPath;

export const SHORT_FORMAT = {width: 1080, height: 1920, fps: 60};
