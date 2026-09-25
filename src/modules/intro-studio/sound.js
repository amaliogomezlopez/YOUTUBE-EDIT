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
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {REMOTION_ROOT} from '../video-studio/paths.js';
import {measurePeakSeconds} from '../video-studio/sound-edges.js';
import {SOUND_DROP_FOLDER, loadTalkingHeadSounds} from '../talking-head/sounds.js';

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
  brand: 'shimmer',
  // La agenda acompana a la voz: la compila muda la apertura; suena si el plan lo pide.
  list: 'tick',
  // La palabra clave del tercio inferior entra como un cambio de imagen mas: con la
  // biblioteca SONIDOS-REELS suena con uno de los sonidos cortos del usuario.
  keyword: 'pop'
};

export const DEFAULT_TRANSITION_SOUND = {
  cut: null,
  fade: 'texture',
  whip: 'whip',
  'slide-up': 'whoosh',
  'zoom-blur': 'rewind',
  'flash-cut': 'shutter',
  'glitch-cut': 'glitch',
  // La hoja que se pliega suena a papel (SONIDOS-REELS: situacion `papel`).
  'page-curl': 'paper'
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

/**
 * Familias que se leen como "cambio de imagen": transiciones, entradas de captura o
 * de palabra clave, flashes y roturas. Con la biblioteca del usuario todas suenan con
 * sus efectos cortos, rotando en un unico contador para que dos cambios seguidos no
 * repitan fichero aunque pidan familias distintas.
 */
export const USER_TRANSITION_FAMILIES = new Set([
  'whip', 'whoosh', 'rewind', 'shutter', 'glitch', 'camera', 'pop', 'reveal', 'paper'
]);

/** Por encima de esto un efecto tiene cola y pisa el siguiente corte (Slice Ring). */
export const DEFAULT_MAX_TRANSITION_SECONDS = 0.7;

/**
 * Usos de montaje de SONIDOS-REELS (prefijo del fichero, ver
 * `talking-head/sound-usage.js`) y las familias de la intro que ocupan. Si falta un
 * uso, su familia sigue sonando como antes: transiciones del usuario para `rewind` y
 * `glitch`, y la libreria para `boom`, `impact`, `hit`, `ui`, `tick`, `chime` y
 * `typing`.
 *
 * `maxSeconds` acota la cola: el Soundtrack corta el efecto ahi con un fundido, que
 * es lo que evita que un bombo cinematografico pise el golpe siguiente.
 */
export const USER_EDIT_USES = {
  'impact-low': {families: ['boom', 'hit'], maxSeconds: 0.9},
  'impact-finisher': {families: ['impact'], maxSeconds: 1.4},
  'whoosh-in': {families: ['rewind'], endAnchored: true},
  click: {families: ['ui'], maxSeconds: 0.4},
  data: {families: ['tick', 'chime'], maxSeconds: 0.8},
  glitch: {families: ['glitch'], maxSeconds: 0.7},
  typing: {families: ['typing'], maxSeconds: 1}
};

/**
 * Situaciones de montaje que el usuario puede sonorizar a su gusto desde
 * `SONIDOS-REELS/preferencias.json` (lo genera `SONIDOS-REELS/ESCUCHA.html`). Cada una
 * ocupa familias propias: el compilador de la apertura pide la familia de cada
 * situacion (toma nueva, entrar o salir de un b-roll, captura…), asi que un ranking
 * por situacion no se pisa con otro.
 */
export const SOUND_SITUATIONS = [
  {id: 'arranque', label: 'Arranque (una vez, termina en el primer corte)', families: ['riser'], openingRiser: true},
  {id: 'toma-nueva', label: 'Cambio a una toma nueva', families: ['shutter']},
  {id: 'entrar-broll', label: 'Entrar a un b-roll a pantalla completa', families: ['whoosh']},
  {id: 'salir-broll', label: 'Volver del b-roll a la camara', families: ['whip']},
  {id: 'zoom-inverso', label: 'Transicion zoom-blur (entrar a un remate)', families: ['rewind']},
  {id: 'captura', label: 'Portada o logo que aparece junto a la cara', families: ['pop', 'reveal']},
  {id: 'glitch', label: 'Transicion glitch', families: ['glitch']},
  {id: 'papel', label: 'Hoja que se pliega (entrar a una pantalla)', families: ['paper']},
  {id: 'zoom', label: 'Zoom de camara (punch-in, snap-zoom, push-out)', families: ['camera']},
  {id: 'golpe-palabra', label: 'Zoom de golpe en la palabra que pesa', families: ['boom', 'hit']},
  {id: 'remate', label: 'Temblor en el remate de una idea', families: ['impact']},
  {id: 'cifra', label: 'Cifra que no es dinero', families: ['tick', 'chime']},
  {id: 'dinero', label: 'Cifra de dinero', families: ['money']},
  {id: 'mensaje', label: 'Mensaje, chat o post que aparece', families: ['message']},
  {id: 'titular', label: 'Titular (solo si el plan pide sonido)', families: ['typing']},
  {id: 'clic', label: 'Clic de interfaz', families: ['ui']}
];

/**
 * Aplica `preferencias.json` sobre la paleta: por situacion, los sonidos elegidos en
 * orden de preferencia (rotan en ese orden y con contador propio), y los
 * `descartados` salen de todas las rotaciones. Un nombre que no esta en la carpeta es
 * un error: una preferencia que se ignora en silencio no es una preferencia. Repetir
 * un nombre en la lista le da mas peso en la rotacion ("abusar" de un sonido). Los
 * nombres son rutas dentro de SONIDOS-REELS, con `/` o `\`.
 */
export const soundName = (name) => String(name).replace(/\\/g, '/');

export function applySoundPreferences(result, entries, preferences) {
  if (!preferences) return result;
  const bySource = new Map(entries.map((entry) => [soundName(entry.sourceName), entry]));
  const discarded = new Set((preferences.descartados ?? []).map(soundName));
  for (const name of discarded) {
    if (!bySource.has(name)) throw new Error(`preferencias.json: descartado "${name}" no esta en SONIDOS-REELS`);
  }
  const palette = {...result.palette};
  for (const [family, files] of Object.entries(palette)) {
    const kept = files.filter((file) => !discarded.has(soundName(result.sources[file])));
    if (kept.length) palette[family] = kept;
  }
  const metadata = {...result.metadata};
  const ownRotation = new Set();
  let openingRiser = result.openingRiser && !discarded.has(soundName(result.sources[result.openingRiser])) ? result.openingRiser : null;
  for (const situation of SOUND_SITUATIONS) {
    const names = preferences.situaciones?.[situation.id];
    if (!names?.length) continue;
    const files = names.map((name) => {
      const entry = bySource.get(soundName(name));
      if (!entry) throw new Error(`preferencias.json: "${name}" (situacion ${situation.id}) no esta en SONIDOS-REELS`);
      metadata[entry.file] ??= {durationSeconds: entry.durationSeconds};
      return entry.file;
    });
    if (situation.openingRiser) openingRiser = files[0];
    else for (const family of situation.families) { palette[family] = files; ownRotation.add(family); }
  }
  return {...result, palette, metadata, openingRiser, ownRotation, preferences: true};
}

/**
 * Sonido por defecto de un cue cuando suena la biblioteca del usuario. Una cifra que
 * no es dinero suena a dato (ding), no a bombo: el `impact` se reserva para el
 * remate. Las cifras de dinero siguen pidiendo `soundUse: "money"`.
 */
export const USER_LIBRARY_CUE_SOUND = {stat: 'tick'};

/**
 * Paleta de la intro a partir del catalogo de SONIDOS-REELS
 * (`talking-head/sounds.js` lo importa, recorta y clasifica por uso).
 *
 * Las familias de cambio de imagen suenan con las transiciones cortas del usuario, y
 * cada uso de montaje (`USER_EDIT_USES`) ocupa sus familias propias. El riser del
 * usuario se reserva para el arranque y no sustituye al `riser` de `vignette-pulse`.
 *
 * `peaks` ({file: segundos}) lleva el instante del pico de los efectos que se anclan
 * por el final (whoosh inverso): el golpe que se oye es el pico, y es el pico lo que
 * tiene que caer en el corte.
 */
export function userSoundPalette(selection, {maxTransitionSeconds = DEFAULT_MAX_TRANSITION_SECONDS, peaks = {}} = {}) {
  const entries = selection?.entries ?? [];
  const byUse = (use) => entries.filter((entry) => entry.use === use);
  const transitions = byUse('transition')
    .filter((entry) => entry.durationSeconds <= maxTransitionSeconds)
    .sort((a, b) => a.sourceName.localeCompare(b.sourceName));
  if (!transitions.length) {
    throw new Error(
      `SONIDOS-REELS no tiene efectos de transicion de ${maxTransitionSeconds}s o menos`
    );
  }
  const palette = {};
  const metadata = {};
  const remember = (entry) => { metadata[entry.file] = {durationSeconds: entry.durationSeconds}; };
  for (const family of USER_TRANSITION_FAMILIES) palette[family] = transitions.map((entry) => entry.file);
  transitions.forEach(remember);
  for (const use of ['money', 'message']) {
    const found = byUse(use);
    if (found.length) {
      palette[use] = found.map((entry) => entry.file);
      found.forEach(remember);
    }
  }
  const endAnchored = {};
  for (const [use, spec] of Object.entries(USER_EDIT_USES)) {
    const found = byUse(use).sort((a, b) => a.sourceName.localeCompare(b.sourceName));
    if (!found.length) continue;
    for (const family of spec.families) palette[family] = found.map((entry) => entry.file);
    for (const entry of found) {
      metadata[entry.file] = {
        durationSeconds: spec.maxSeconds ? Math.min(entry.durationSeconds, spec.maxSeconds) : entry.durationSeconds
      };
      if (spec.endAnchored) {
        const peak = Number(peaks[entry.file]);
        endAnchored[entry.file] = Number.isFinite(peak) && peak > 0 ? peak : entry.durationSeconds;
      }
    }
  }
  const intro = byUse('intro');
  intro.forEach(remember);
  return {
    palette,
    metadata,
    endAnchored,
    uses: Object.fromEntries(Object.keys(USER_EDIT_USES).map((use) => [use, byUse(use).length])),
    transitionFiles: palette.whoosh,
    openingRiser: intro[0]?.file ?? null,
    sources: Object.fromEntries(entries.map((entry) => [entry.file, entry.sourceName]))
  };
}

/**
 * Carga SONIDOS-REELS y mide el pico de los efectos anclados por el final. Es lo
 * unico asincrono: `userSoundPalette` sigue siendo pura para poder probarla.
 */
export async function loadUserSoundPalette(options = {}) {
  const selection = await loadTalkingHeadSounds();
  const peaks = {};
  for (const entry of selection.entries ?? []) {
    if (!USER_EDIT_USES[entry.use]?.endAnchored) continue;
    peaks[entry.file] = await measurePeakSeconds(path.join(REMOTION_ROOT, 'public', entry.file));
  }
  const preferences = await readFile(SOUND_PREFERENCES_FILE, 'utf8').then(JSON.parse, (error) => {
    if (error.code === 'ENOENT') return null;
    throw new Error(`SONIDOS-REELS/preferencias.json no es JSON valido: ${error.message}`);
  });
  return applySoundPreferences(userSoundPalette(selection, {...options, peaks}), selection.entries ?? [], preferences);
}

/** Preferencias del usuario por situacion (las genera SONIDOS-REELS/ESCUCHA.html). */
export const SOUND_PREFERENCES_FILE = path.join(SOUND_DROP_FOLDER, 'preferencias.json');

/**
 * Coloca un efecto: por defecto empieza en `atSeconds`; si es de los anclados por el
 * final, empieza antes para que su pico caiga en `atSeconds`. `hitSeconds` es el
 * instante que el espectador oye como golpe, y es el que mide IN-R-042.
 */
export function placeUserSound(cue, atSeconds, userSounds) {
  const peak = userSounds?.endAnchored?.[cue.file];
  if (!Number.isFinite(peak)) return {...cue, hitSeconds: cue.startSeconds};
  return {...cue, startSeconds: Math.max(0, atSeconds - peak), hitSeconds: atSeconds};
}

/** Usos semanticos que el plan pide con `soundUse` y que exigen `soundNote`. */
export const SEMANTIC_SOUND_USES = new Set(['money', 'message']);
