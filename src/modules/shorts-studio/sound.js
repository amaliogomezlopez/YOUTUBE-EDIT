/**
 * Sonido por familia, nunca por fichero.
 *
 * El plan editorial pide `{sound: 'impact'}` y aqui se resuelve a un WAV de
 * `remotion-animations/public/sfx/`. Es la misma regla dura del motor editorial
 * (AGENTS.md): cambiar la libreria no debe obligar a reescribir planes.
 *
 * Cada familia declara varias tomas. Un short encadena muchos golpes seguidos
 * (tres logos, cuatro cortes) y repetir el mismo fichero suena a plantilla, asi
 * que las tomas rotan y se les aplica un leve desplazamiento de tono. La rotacion
 * es deterministica: depende del numero de veces que ya se ha usado la familia en
 * ese short, no del azar, de modo que dos builds del mismo plan suenan igual.
 */
const family = (files, durationSeconds, volume) => ({files, durationSeconds, volume});

const variants = (name, count) =>
  Array.from({length: count}, (_, index) => `sfx/amaliometria-${name}-${String(index + 1).padStart(2, '0')}.wav`);

export const SOUND_FAMILIES = {
  impact: family(variants('impact', 6), 0.58, 0.82),
  hit: family(['sfx/amaliometria-soft-impact.wav', ...variants('impact', 6).slice(3)], 0.55, 0.86),
  whoosh: family(['sfx/amaliometria-rise-whoosh.wav', 'sfx/library-smooth-whoosh.wav'], 0.78, 0.6),
  whip: family(['sfx/library-quick-whip.wav', ...variants('rewind', 4)], 0.2, 0.34),
  pop: family(['sfx/library-pop.wav', ...variants('reveal', 6)], 0.46, 0.5),
  reveal: family(variants('reveal', 6), 0.5, 0.55),
  tick: family(['sfx/amaliometria-data-tick.wav', ...variants('data', 6)], 0.26, 0.48),
  ui: family(variants('interface', 6), 0.24, 0.54),
  chime: family(['sfx/amaliometria-success-chime.wav', ...variants('confirm', 6)], 0.52, 0.6),
  shimmer: family(['sfx/amaliometria-logo-shimmer.wav'], 0.9, 0.55),
  tension: family(['sfx/amaliometria-tension-swell.wav', ...variants('tension', 6)], 1.2, 0.34),
  alert: family(['sfx/amaliometria-needle-strike.wav', ...variants('break', 3)], 0.42, 0.62),
  burst: family(['sfx/amaliometria-bubble-burst.wav', ...variants('break', 6).slice(3)], 0.5, 0.55),
  rewind: family(['sfx/amaliometria-rewind-sweep.wav', ...variants('rewind', 6)], 0.7, 0.5),
  camera: family(variants('camera', 6), 0.6, 0.42),
  texture: family(variants('texture', 6), 1.1, 0.24)
};

export const soundFamilyIds = Object.keys(SOUND_FAMILIES);

/** Desplazamientos de tono por repeticion, para que el tercer golpe no clone al primero. */
const PITCH_STEPS = [1, 1.06, 0.95, 1.03, 0.98, 1.09];

/**
 * @param {string} familyId id de familia
 * @param {number} atSeconds tiempo absoluto del short
 * @param {number} intensity multiplicador de volumen (0..1.5)
 * @param {number} occurrence cuantas veces se ha usado ya esta familia
 */
export function resolveSoundCue(familyId, atSeconds, intensity = 1, occurrence = 0) {
  const preset = SOUND_FAMILIES[familyId];
  if (!preset) throw new Error(`Familia de sonido desconocida: ${familyId}. Disponibles: ${soundFamilyIds.join(', ')}`);
  const index = Math.abs(Math.trunc(occurrence));
  return {
    file: preset.files[index % preset.files.length],
    startSeconds: Math.max(0, atSeconds),
    durationSeconds: preset.durationSeconds,
    volume: Math.min(1, Math.max(0, preset.volume * intensity)),
    attackSeconds: 0.012,
    releaseSeconds: 0.14,
    playbackRate: PITCH_STEPS[index % PITCH_STEPS.length]
  };
}

/**
 * Contador de repeticiones por familia dentro de un short. Lo crea el build y lo
 * pasa a cada `resolveSoundCue` para que la rotacion avance.
 */
export function createSoundRotation() {
  const counters = new Map();
  return (familyId) => {
    const next = counters.get(familyId) ?? 0;
    counters.set(familyId, next + 1);
    return next;
  };
}

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
