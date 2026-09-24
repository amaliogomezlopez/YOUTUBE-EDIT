import {surfacePaths} from '../video-studio/paths.js';

export {
  AUDIO_EXTENSIONS,
  IMAGE_EXTENSIONS,
  PROJECTS_ROOT,
  REMOTION_ROOT,
  VIDEO_EXTENSIONS,
  naturalCompare,
  slugify
} from '../video-studio/paths.js';

/**
 * Superficie de montaje con voz en off y visuales a pantalla completa.
 *
 * No hay camara: la pieza la conduce una locucion (grabada o sintetica) y encima se
 * encadenan imagenes y videos que cambian cada pocos segundos, con movimiento de
 * camara, transicion y golpe de sonido en cada cambio. Un mismo plan compila un
 * build por formato; cada build tiene un formato fijo y su propia composicion.
 */
export const MONTAGE_SURFACE = 'montage';

const paths = surfacePaths(MONTAGE_SURFACE);
export const mediaDir = paths.mediaDir;
export const projectDir = paths.projectDir;
export const staticPath = paths.staticPath;

/**
 * 60 fps en los dos formatos: los golpes de zoom y los whips duran tres o cuatro
 * frames, y a 30 fps se leen como un salto.
 */
export const MONTAGE_FORMATS = {
  '9x16': {id: '9x16', width: 1080, height: 1920, fps: 60},
  '16x9': {id: '16x9', width: 1920, height: 1080, fps: 60}
};

export const CAMERA_MOVES = ['push-in', 'pull-out', 'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'punch', 'drift-shake'];
export const TRANSITIONS = ['cut', 'whip', 'zoom-blur', 'glitch', 'flash', 'slide'];
export const OVERLAY_KINDS = ['pop', 'stat'];
export const HIT_EFFECTS = ['flash', 'rgb-split', 'shake', 'zoom-punch', 'glitch'];
