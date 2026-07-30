/**
 * Sonido del montaje vertical.
 *
 * El catalogo de familias y la rotacion son comunes a todas las superficies
 * (`video-studio/sound-families.js`): el timbre de un impacto no depende de que el
 * video sea vertical. Lo propio de shorts es que familia suena por defecto en cada
 * tipo de cue, en cada transicion y en cada movimiento de camara, y eso si es una
 * decision de estilo del formato.
 */
export {
  SOUND_FAMILIES,
  createSoundRotation,
  resolveSoundCue,
  soundFamilyIds
} from '../video-studio/sound-families.js';

/** Sonido por defecto de cada tipo de cue, para que nada aparezca en silencio. */
export const DEFAULT_CUE_SOUND = {
  logo: 'pop',
  screenshot: 'whoosh',
  stat: 'impact',
  chip: 'ui',
  label: 'tick',
  brand: 'chime'
};

/** Sonido por defecto de cada transicion de escena. */
export const DEFAULT_TRANSITION_SOUND = {
  cut: null,
  fade: 'texture',
  whip: 'whip',
  'slide-up': 'whoosh',
  'zoom-blur': 'rewind'
};

/** Sonido por defecto del movimiento de camara, al arrancar la escena. */
export const DEFAULT_CAMERA_SOUND = {
  static: null,
  'punch-in': 'camera',
  'push-out': 'camera',
  'drift-left': null,
  'drift-right': null
};
