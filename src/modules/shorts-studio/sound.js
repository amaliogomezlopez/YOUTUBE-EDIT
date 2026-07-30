/**
 * Sonido por familia, nunca por fichero.
 *
 * El plan editorial pide `{sound: 'impact'}` y aqui se resuelve a un WAV de
 * `remotion-animations/public/sfx/`. Es la misma regla dura del motor editorial
 * (AGENTS.md): cambiar la libreria no debe obligar a reescribir planes.
 */
export const SOUND_FAMILIES = {
  impact: {file: 'sfx/amaliometria-soft-impact.wav', durationSeconds: 0.58, volume: 0.85},
  hit: {file: 'sfx/amaliometria-impact-05.wav', durationSeconds: 0.52, volume: 0.8},
  whoosh: {file: 'sfx/amaliometria-rise-whoosh.wav', durationSeconds: 0.78, volume: 0.62},
  whip: {file: 'sfx/library-quick-whip.wav', durationSeconds: 0.14, volume: 0.34},
  pop: {file: 'sfx/library-pop.wav', durationSeconds: 0.42, volume: 0.32},
  tick: {file: 'sfx/amaliometria-data-tick.wav', durationSeconds: 0.24, volume: 0.5},
  ui: {file: 'sfx/amaliometria-ui-pulse.wav', durationSeconds: 0.22, volume: 0.58},
  chime: {file: 'sfx/amaliometria-success-chime.wav', durationSeconds: 0.52, volume: 0.6},
  shimmer: {file: 'sfx/amaliometria-logo-shimmer.wav', durationSeconds: 0.9, volume: 0.55},
  tension: {file: 'sfx/amaliometria-tension-swell.wav', durationSeconds: 1.4, volume: 0.38},
  alert: {file: 'sfx/amaliometria-needle-strike.wav', durationSeconds: 0.4, volume: 0.62},
  burst: {file: 'sfx/amaliometria-bubble-burst.wav', durationSeconds: 0.5, volume: 0.55},
  rewind: {file: 'sfx/amaliometria-rewind-sweep.wav', durationSeconds: 0.7, volume: 0.5}
};

export const soundFamilyIds = Object.keys(SOUND_FAMILIES);

/**
 * @param {string} family id de familia
 * @param {number} atSeconds tiempo absoluto del short
 * @param {number} intensity multiplicador de volumen (0..1.5)
 */
export function resolveSoundCue(family, atSeconds, intensity = 1) {
  const preset = SOUND_FAMILIES[family];
  if (!preset) throw new Error(`Familia de sonido desconocida: ${family}. Disponibles: ${soundFamilyIds.join(', ')}`);
  return {
    file: preset.file,
    startSeconds: Math.max(0, atSeconds),
    durationSeconds: preset.durationSeconds,
    volume: Math.min(1, Math.max(0, preset.volume * intensity)),
    attackSeconds: 0.012,
    releaseSeconds: 0.14
  };
}
