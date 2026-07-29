/**
 * QA de episodio: qué hay que mirar y dónde.
 *
 * ANM-J01 · ANM-J02 · ANM-J03 · ANM-J04 — Convierte los informes del director
 * en un plan de comprobación concreto: frames exactos a muestrear por cue
 * (antes / palabra / después), contact sheet por bloque, histograma sonoro y
 * lista de comprobaciones que siguen siendo humanas.
 */

const DEFAULT_QA = {
  fps: 30,
  cueProbeOffsetsSeconds: [-0.2, 0, 0.25],
  contactSheetBlockSeconds: 60,
  contactSheetFramesPerBlock: 5
};

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function frameAt(seconds, fps) {
  return Math.max(0, Math.round(seconds * fps));
}

/**
 * ANM-J03 — Para cada cue, los tres frames que demuestran que el cambio ocurre
 * en la palabra. La comparación de píxeles sobre la región del target sigue
 * siendo el paso de render; aquí queda declarada la muestra exacta.
 */
export function buildCueProbes(scenes, options = {}) {
  const config = {...DEFAULT_QA, ...options};
  const probes = [];
  for (const scene of scenes) {
    for (const cue of scene.cues ?? []) {
      const absolute = Number(cue.absoluteSeconds ?? scene.startSeconds + cue.atSeconds);
      probes.push({
        sceneId: scene.id,
        cueId: cue.id,
        target: cue.target,
        action: cue.action,
        anchorWordIndex: cue.anchorWordIndex ?? null,
        atSeconds: round(absolute),
        frames: config.cueProbeOffsetsSeconds.map((offset) => ({
          label: offset < 0 ? 'antes' : offset === 0 ? 'palabra' : 'despues',
          atSeconds: round(Math.max(0, absolute + offset)),
          frame: frameAt(Math.max(0, absolute + offset), config.fps)
        })),
        expect: 'Cambio de píxel significativo en la región de `target` entre ' +
          '«antes» y «después».'
      });
    }
  }
  return probes;
}

/** ANM-J04 — Contact sheet por bloque de aproximadamente un minuto. */
export function buildContactSheet(durationSeconds, options = {}) {
  const config = {...DEFAULT_QA, ...options};
  const blocks = [];
  for (
    let start = 0;
    start < durationSeconds;
    start += config.contactSheetBlockSeconds
  ) {
    const end = Math.min(durationSeconds, start + config.contactSheetBlockSeconds);
    const step = (end - start) / (config.contactSheetFramesPerBlock + 1);
    blocks.push({
      startSeconds: round(start),
      endSeconds: round(end),
      frames: Array.from({length: config.contactSheetFramesPerBlock}, (_, index) => {
        const atSeconds = round(start + step * (index + 1));
        return {atSeconds, frame: frameAt(atSeconds, config.fps)};
      })
    });
  }
  return blocks;
}

/**
 * @param {object} validation resultado de `validateEpisodePlan`
 * @returns {object} informe listo para escribir en `episode-qa.json`
 */
export function buildEpisodeQaReport(validation, options = {}) {
  const config = {...DEFAULT_QA, ...options};
  const {reports, summary, scenes} = validation;
  const soundPlan = reports.soundPlan ?? {scenes: [], bedTrack: [], ducking: []};
  return {
    version: 1,
    generatedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    fps: config.fps,
    summary,
    blocking: {
      errors: validation.issues.filter((issue) => issue.severity === 'error'),
      waived: validation.issues.filter((issue) => issue.exception)
    },
    density: {
      ...reports.density,
      verdict: reports.density.maxGapSeconds <= 2
        ? 'correcto'
        : 'revisar: hay huecos por encima del umbral'
    },
    sound: {
      ...reports.sound,
      bedSegments: soundPlan.bedTrack.length,
      duckWindows: soundPlan.ducking.length,
      verdict: reports.sound.maxFileSharePercent <= 12 &&
        reports.sound.distinctFamilies >= 8
        ? 'correcto'
        : 'revisar: monotonía sonora por encima del umbral'
    },
    variety: reports.variety,
    cueProbes: buildCueProbes(scenes, config),
    contactSheet: buildContactSheet(summary.durationSeconds, config),
    manualChecks: [
      'Contraste del texto sobre geometría compleja en los frames de cue.',
      'Recortes de título, ejes o fuente en el frame de máximo zoom.',
      'Longitud de rótulo y desbordes en resolución 1920×1080.',
      'Coincidencia de cada cifra visible con su claimRef y su dataRef.',
      'Revisión del vídeo completo con audio antes de aprobar el bloque.'
    ]
  };
}
