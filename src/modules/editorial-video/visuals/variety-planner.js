/**
 * Antimonotonía en el pipeline editorial.
 *
 * ANM-H01 · ANM-H02 · ANM-H03 · ANM-H04 — `animation-variety.js` existía pero
 * solo lo usaba `chart-ingestion.js`. Aquí se conecta al plan del episodio y se
 * añade la ventana deslizante de seis escenas sobre cinco ejes.
 */
import {planAnimationVariety} from '../../../lib/animation-variety.js';

export const VARIETY_AXES = ['patternId', 'geometry', 'camera', 'palette', 'soundFamily'];
export const VARIETY_WINDOW = 6;
export const MAX_REPEATS_IN_WINDOW = 2;

const EMPHASIS_ROTATION = [
  'zoom',
  'color-isolation',
  'underline',
  'scale',
  'peer-desaturation'
];

/**
 * Un cue puede pedir el sonido por familia (`{family: 'camera'}`) o por alias
 * histórico (`'quick-whip'`). Sin resolver el alias, dos escenas que suenan a la
 * misma familia se contabilizan como ejes distintos y la ventana deslizante deja
 * de ver la monotonía que existe (ANM-H02).
 */
function resolveFamily(sound, legacyAliases) {
  if (!sound) return null;
  if (typeof sound !== 'string') return sound.family ?? null;
  return legacyAliases?.[sound]?.family ?? sound;
}

function dominantSoundFamily(scene, legacyAliases) {
  const counts = new Map();
  for (const cue of scene.cues ?? []) {
    const family = resolveFamily(cue.sound, legacyAliases);
    if (!family) continue;
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

/**
 * Anota cada escena con sus ejes de variedad y con el mecanismo de énfasis que
 * le toca por rotación (ANM-F03: el zoom no puede convertirse en un tic).
 */
export function planSceneVariety(scenes, {
  registry,
  palettes = ['gold', 'cyan', 'neutral'],
  legacyAliases = {}
} = {}) {
  const history = [];
  return scenes.map((scene, position) => {
    const binding = registry?.get(scene.componentKey ?? scene.kind) ?? null;
    const geometry = scene.geometry ?? binding?.geometry ?? 'unknown';
    const patternId = scene.patternId ?? binding?.patternId ?? 'unknown';
    const camera = scene.camera ?? (
      (scene.cues ?? []).some((cue) => cue.action === 'zoom') ? 'focus-zoom' : 'static'
    );
    // Solo la paleta puede acabar rellenada por turno: el resto de ejes salen
    // de la escena, del binding del catálogo o de los propios cues.
    const declaresPalette = Boolean(scene.palette);
    const palette = scene.palette ?? palettes[position % palettes.length];
    const soundFamily = dominantSoundFamily(scene, legacyAliases);
    const variety = planAnimationVariety({
      patternId,
      preferredArtDirection: scene.artDirection,
      effectIds: scene.effectIds ?? [],
      preferredGeometry: geometry,
      geometryCandidates: [geometry],
      preferredCamera: camera,
      cameraCandidates: ['focus-zoom', 'static', 'path-track', 'pull-back'],
      preferredTheme: scene.themeId,
      themeCandidates: [scene.themeId].filter(Boolean),
      preferredMotionProfile: scene.motionProfile,
      motionProfileCandidates: [scene.motionProfile].filter(Boolean),
      recentSelections: history
    });
    const recentEmphasis = history.slice(-3).map((item) => item.emphasis);
    const emphasis = EMPHASIS_ROTATION.find(
      (candidate) => !recentEmphasis.includes(candidate)
    ) ?? binding?.emphasis ?? 'zoom';
    const record = {patternId, geometry, camera, palette, soundFamily, emphasis};
    history.push({...record, effectIds: scene.effectIds ?? [], artDirection: variety.selected.artDirection});
    return {
      ...scene,
      patternId,
      geometry,
      camera,
      palette,
      soundFamily,
      emphasis,
      syntheticAxes: declaresPalette ? [] : ['palette'],
      artDirection: variety.selected.artDirection,
      varietyReasons: variety.reasons
    };
  });
}

/**
 * ANM-H02 · ANM-H03 — Ventana deslizante de seis escenas sobre cinco ejes.
 * La repetición no se prohíbe: se penaliza y exige justificación registrada.
 */
export function validateVariety(scenes, {
  window = VARIETY_WINDOW,
  maxRepeats = MAX_REPEATS_IN_WINDOW,
  legacyAliases = {}
} = {}) {
  // `planSceneVariety` ya deja la familia resuelta en la escena; recalcularla
  // aquí sin el mapa de alias es lo que hacía divergir ambos caminos.
  const familyOf = (scene) => scene.soundFamily ?? dominantSoundFamily(scene, legacyAliases);
  const issues = [];
  const matrix = {};
  for (const axis of VARIETY_AXES) matrix[axis] = {};

  // Un eje que ninguna escena declara lo rellena `planSceneVariety` por turno
  // (`posición % n`). Con período fijo la ventana no puede detectar repetición
  // jamás: mediría su propio relleno y devolvería un aprobado gratis. Se declara
  // no medido en vez de fingir cobertura.
  const unmeasured = VARIETY_AXES.filter((axis) =>
    scenes.length > 0 && scenes.every((scene) => scene.syntheticAxes?.includes(axis)));
  const measuredAxes = VARIETY_AXES.filter((axis) => !unmeasured.includes(axis));

  for (let position = 0; position < scenes.length; position += 1) {
    const slice = scenes.slice(Math.max(0, position - window + 1), position + 1);
    for (const axis of measuredAxes) {
      const value = axis === 'soundFamily'
        ? familyOf(scenes[position])
        : scenes[position][axis];
      if (!value) continue;
      matrix[axis][value] = (matrix[axis][value] ?? 0) + 1;
      const repeats = slice.filter((scene) =>
        (axis === 'soundFamily' ? familyOf(scene) : scene[axis]) === value
      ).length;
      if (repeats > maxRepeats && !scenes[position].varietyException) {
        issues.push({
          code: 'variety-window',
          severity: axis === 'patternId' ? 'error' : 'warning',
          sceneId: scenes[position].id,
          message: `«${value}» aparece ${repeats} veces en las últimas ${slice.length} ` +
            `escenas sobre el eje ${axis} (máximo ${maxRepeats}). Cambia de ` +
            'encuadre o de mecanismo de énfasis, o declara `varietyException` con motivo.'
        });
      }
    }
  }

  const distinctPatterns = new Set(scenes.map((scene) => scene.patternId).filter(Boolean));
  return {
    issues,
    report: {
      scenes: scenes.length,
      distinctPatterns: distinctPatterns.size,
      measuredAxes,
      unmeasuredAxes: unmeasured,
      matrix,
      exceptions: scenes
        .filter((scene) => scene.varietyException)
        .map((scene) => ({sceneId: scene.id, reason: scene.varietyException}))
    }
  };
}
