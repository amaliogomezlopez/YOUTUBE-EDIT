import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Un mismo asset no vuelve antes de `budget.assetRepeatGapSeconds`. Si vuelve, el
 * planificador ya le cambia encuadre y movimiento, pero con pocos assets el
 * espectador reconoce la imagen: la salida es anadir material, no esconderlo.
 */
export default {
  id: 'montage-asset-repeat-gap',
  run(context) {
    const gap = context.budget?.assetRepeatGapSeconds;
    if (!Number.isFinite(gap)) return notEvaluable('El perfil no declara assetRepeatGapSeconds.');
    const fps = context.format.fps;
    const last = new Map();
    const issues = [];
    for (const beat of context.beats ?? []) {
      const id = beat.visual?.assetId;
      if (last.has(id)) {
        const seconds = (beat.fromFrame - last.get(id)) / fps;
        if (seconds < gap) issues.push({sceneId: beat.id, message: `El asset «${id}» vuelve a los ${seconds.toFixed(1)} s (minimo ${gap} s). Anade mas material.`});
      }
      last.set(id, beat.fromFrame);
    }
    return issues;
  }
};
