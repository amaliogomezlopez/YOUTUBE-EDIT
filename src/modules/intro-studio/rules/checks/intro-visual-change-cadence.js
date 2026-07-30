import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Suelo de cambio visible.
 *
 * El techo de densidad evita el ruido; esta regla evita lo contrario, que es el
 * fallo real de la mayoria de intros caseras: cuatro segundos de alguien hablando a
 * camara sin que pase nada. Una intro no explica, engancha, y para eso tiene que
 * cambiar algo con regularidad.
 *
 * Cuenta como cambio visible cualquier cosa que el espectador percibe: un corte de
 * escena, la entrada de un cue, un efecto o el titular. Un movimiento de camara
 * continuo (`punch-in`, `drift`) no cuenta como instante, porque no tiene uno; si la
 * escena solo lleva eso, el hueco se mide entero.
 *
 * El intervalo maximo lo fija el perfil.
 */
export default {
  id: 'intro-visual-change-cadence',
  run(context) {
    const maxGap = context.budget?.maxSecondsWithoutChange;
    if (!Number.isFinite(maxGap)) {
      return notEvaluable(
        'El build no declara `budget.maxSecondsWithoutChange`; la cadencia la fija el ' +
        'perfil de estilo.'
      );
    }
    const fps = context.format?.fps ?? 60;
    const durationSeconds = Number(
      context.durationSeconds ?? (context.durationInFrames ? context.durationInFrames / fps : 0)
    );
    if (!durationSeconds) return [];

    const changes = new Set([0]);
    for (const scene of context.scenes ?? []) {
      const sceneStart = (scene.from ?? 0) / fps;
      changes.add(round(sceneStart));
      for (const cue of scene.cues ?? []) changes.add(round(sceneStart + Number(cue.atSeconds ?? 0)));
      for (const effect of scene.effects ?? []) {
        changes.add(round(sceneStart + Number(effect.atSeconds ?? 0)));
      }
    }
    if (context.titleCard) changes.add(round(Number(context.titleCard.atSeconds ?? 0)));

    const timeline = [...changes].sort((a, b) => a - b);
    const issues = [];
    for (let index = 1; index < timeline.length; index += 1) {
      const gap = timeline[index] - timeline[index - 1];
      if (gap <= maxGap) continue;
      issues.push({
        message: `${round(gap)}s sin ningún cambio visible entre ${timeline[index - 1]}s y ` +
          `${timeline[index]}s (el perfil admite ${maxGap}s).`
      });
    }
    // Tambien el tramo final: una intro que se queda quieta al acabar pierde el remate.
    const tail = durationSeconds - timeline.at(-1);
    if (tail > maxGap) {
      issues.push({
        message: `${round(tail)}s sin ningún cambio visible desde ${timeline.at(-1)}s hasta el ` +
          `final (el perfil admite ${maxGap}s).`
      });
    }
    return issues;
  }
};

function round(value) {
  return Math.round(value * 1000) / 1000;
}
