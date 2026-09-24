import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Suelo de movimiento: la camara no se queda quieta mas de `budget.maxSecondsStatic`.
 * Un beat esta quieto si sus keyframes no cambian ni escala ni posicion y no tiene
 * temblor; en ese caso todo el beat cuenta como tiempo estatico.
 */
export default {
  id: 'montage-camera-always-moving',
  run(context) {
    const limit = context.budget?.maxSecondsStatic;
    if (!Number.isFinite(limit)) return notEvaluable('El perfil no declara maxSecondsStatic.');
    const fps = context.format.fps;
    const issues = [];
    for (const beat of context.beats ?? []) {
      const keys = beat.camera?.keys ?? [];
      const first = keys[0] ?? {};
      const moves = beat.camera?.shake > 0 || keys.some((key) =>
        Math.abs(key.scale - first.scale) > 0.004 || Math.abs(key.x - first.x) > 0.002 || Math.abs(key.y - first.y) > 0.002);
      const seconds = beat.durationInFrames / fps;
      if (!moves && seconds > limit) {
        issues.push({sceneId: beat.id, message: `El beat «${beat.id}» tiene la camara quieta ${seconds.toFixed(2)} s (maximo ${limit} s).`});
      }
    }
    return issues;
  }
};
