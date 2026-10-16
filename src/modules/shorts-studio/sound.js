/**
 * Sonido del montaje vertical.
 *
 * El catalogo de familias y la rotacion son comunes a todas las superficies
 * (`video-studio/sound-families.js`): el timbre de un impacto no depende de que el
 * video sea vertical. Lo propio de shorts es que familia suena por defecto en cada
 * tipo de cue, en cada transicion y en cada movimiento de camara, y eso si es una
 * decision de estilo del formato.
 */
import {existsSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export {
  SOUND_FAMILIES,
  createSoundRotation,
  resolveSoundCue,
  soundFamilyIds
} from '../video-studio/sound-families.js';

/** Paletas con nombre (`sound.paletteId`); `npm run shorts:sonidos` las resuelve. */
export const SOUND_PALETTES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sound-palettes');
/** Paleta aprobada el 2026-10-15: la usa todo short que no declare la suya. */
export const DEFAULT_SOUND_PALETTE = 'viral-reels';

/**
 * Paleta efectiva del plan. Una `sound.palette` explicita manda (los shorts antiguos
 * conservan su sonido); si no, `sound.paletteId` o la paleta por defecto.
 * `"paletteId": "none"` vuelve a la libreria generica. Si la paleta no esta resuelta
 * o le faltan ficheros en `public/` (otra maquina), se usa la libreria con un aviso.
 */
export function resolvePlanSoundPalette(sound = {}, {publicRoot, warnings = []} = {}) {
  if (sound.palette) return {palette: sound.palette, metadata: sound.metadata, paletteId: null};
  const id = sound.paletteId ?? DEFAULT_SOUND_PALETTE;
  if (!id || id === 'none') return {palette: undefined, metadata: undefined, paletteId: null};
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`sound.paletteId "${id}" no valido`);
  const file = path.join(SOUND_PALETTES_DIR, `${id}.json`);
  if (!existsSync(file)) throw new Error(`No existe la paleta de sonidos "${id}" (${file})`);
  const spec = JSON.parse(readFileSync(file, 'utf8'));
  const files = Object.values(spec.palette ?? {}).flat();
  const absent = publicRoot ? files.filter((item) => !existsSync(path.join(publicRoot, item))) : [];
  if (!files.length || absent.length) {
    warnings.push(`paleta de sonidos "${id}" sin resolver en esta maquina (${absent.length || 'sin'} ficheros); se usa la libreria generica. Ejecuta npm run shorts:sonidos`);
    return {palette: undefined, metadata: undefined, paletteId: null};
  }
  return {palette: spec.palette, metadata: {...spec.metadata, ...(sound.metadata ?? {})}, paletteId: id};
}

/** Sonido por defecto de cada tipo de cue, para que nada aparezca en silencio. */
export const DEFAULT_CUE_SOUND = {
  logo: 'pop',
  screenshot: 'whoosh',
  stat: 'impact',
  chip: 'ui',
  label: 'tick',
  brand: 'chime',
  broll: 'reveal'
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
