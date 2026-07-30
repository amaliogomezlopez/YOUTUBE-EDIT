import path from 'node:path';
import {MEDIA_ROOT, PROJECTS_ROOT, surfacePaths} from '../video-studio/paths.js';

export {
  IMAGE_EXTENSIONS,
  REMOTION_ROOT,
  VIDEO_EXTENSIONS,
  naturalCompare,
  slugify
} from '../video-studio/paths.js';

export const INTRO_SURFACE = 'intro';

const paths = surfacePaths(INTRO_SURFACE);

export const INTRO_MEDIA_ROOT = path.join(MEDIA_ROOT, INTRO_SURFACE);
export const INTRO_PROJECTS_ROOT = PROJECTS_ROOT;

export const mediaDir = paths.mediaDir;
export const projectDir = paths.projectDir;
export const staticPath = paths.staticPath;

/**
 * 1920x1080 a 60 fps. El motor editorial trabaja a 30 porque compone graficas que
 * se leen; una intro vive de golpes de dos o tres frames y a 30 fps un flash o un
 * temblor se ven como un salto.
 */
export const INTRO_FORMAT = {width: 1920, height: 1080, fps: 60};

export const LAYOUTS = new Set(['hero', 'hero-left', 'hero-right', 'frame', 'insert']);
export const CAMERAS = new Set([
  'static', 'punch-in', 'push-out', 'drift-left', 'drift-right', 'handheld', 'snap-zoom'
]);
export const TRANSITIONS = new Set([
  'cut', 'fade', 'whip', 'slide-up', 'zoom-blur', 'flash-cut', 'glitch-cut'
]);
export const CUE_TYPES = new Set(['logo', 'screenshot', 'stat', 'chip', 'label', 'brand']);
export const PRESENTATIONS = new Set(['card', 'plate', 'plain', 'blend']);
export const DEPTHS = new Set(['back', 'front']);
export const BACKDROP_MOTIONS = new Set(['static', 'parallax-left', 'parallax-right', 'slow-zoom']);

export const EFFECTS = new Set([
  'flash', 'rgb-split', 'shake', 'zoom-punch', 'glitch', 'light-leak', 'grain',
  'scanlines', 'vignette-pulse', 'letterbox-snap', 'speed-blur'
]);

/**
 * Efectos que el ojo percibe como un golpe. Son los que tienen que caer en un beat
 * y los que se cuentan para el techo de densidad: una textura continua como el
 * grano o las lineas de barrido no marca ritmo y no compite con nada.
 */
export const STRONG_EFFECTS = new Set([
  'flash', 'rgb-split', 'shake', 'zoom-punch', 'glitch', 'letterbox-snap'
]);

/** Duracion por defecto de cada efecto, en segundos. */
export const EFFECT_SECONDS = {
  flash: 0.18,
  'rgb-split': 0.25,
  shake: 0.35,
  'zoom-punch': 0.4,
  glitch: 0.3,
  'light-leak': 1.1,
  grain: 2.5,
  scanlines: 2,
  'vignette-pulse': 0.9,
  'letterbox-snap': 0.7,
  'speed-blur': 0.45
};
