/**
 * Sonido del montaje de intro.
 *
 * El catalogo de familias y la rotacion son comunes
 * (`video-studio/sound-families.js`). Lo propio de la intro es que familia suena por
 * defecto en cada cosa, y aqui el criterio es distinto del de un short: en un short
 * el sonido acompana una explicacion y no debe tapar la voz, mientras que en una
 * intro el sonido *es* el ritmo. Por eso un logo entra con `boom` y no con `pop`, y
 * cada efecto fuerte tiene su propio golpe.
 */
export {
  SOUND_FAMILIES,
  createSoundRotation,
  resolveSoundCue,
  soundFamilyIds
} from '../video-studio/sound-families.js';

export const DEFAULT_CUE_SOUND = {
  logo: 'boom',
  screenshot: 'whoosh',
  stat: 'impact',
  chip: 'ui',
  label: 'tick',
  brand: 'shimmer'
};

export const DEFAULT_TRANSITION_SOUND = {
  cut: null,
  fade: 'texture',
  whip: 'whip',
  'slide-up': 'whoosh',
  'zoom-blur': 'rewind',
  'flash-cut': 'shutter',
  'glitch-cut': 'glitch'
};

export const DEFAULT_CAMERA_SOUND = {
  static: null,
  'punch-in': 'camera',
  'push-out': 'camera',
  'drift-left': null,
  'drift-right': null,
  handheld: null,
  'snap-zoom': 'shutter'
};

/**
 * Sonido por defecto de cada efecto. Un golpe visual sin sonido no se percibe como
 * un golpe: se percibe como un fallo de reproduccion.
 */
export const DEFAULT_EFFECT_SOUND = {
  flash: 'shutter',
  'rgb-split': 'glitch',
  shake: 'impact',
  'zoom-punch': 'boom',
  glitch: 'glitch',
  'light-leak': 'shimmer',
  grain: null,
  scanlines: null,
  'vignette-pulse': 'riser',
  'letterbox-snap': 'hit',
  'speed-blur': 'whoosh'
};
