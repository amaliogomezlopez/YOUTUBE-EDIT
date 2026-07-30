import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Todo golpe cae en un beat.
 *
 * Es la regla que separa una intro que engancha de una que solo tiene efectos. Un
 * flash 80 ms antes del golpe de la musica no se percibe como un adelanto: se
 * percibe como que el montaje esta mal hecho, aunque nadie sepa decir por que.
 *
 * Aplica a los efectos fuertes y a los cortes de escena con transicion; el
 * `beatDeltaSeconds` lo calcula el build contra la rejilla real. La tolerancia sale
 * del perfil: una intro sobria admite mas holgura porque sus golpes son mas suaves.
 *
 * Un golpe fuera de beat se puede querer —una entrada anticipada crea tension— y
 * para eso esta `offBeatNote`: la excepcion se declara, no se tolera en silencio.
 */
export default {
  id: 'intro-hit-on-beat',
  run(context) {
    if (!context.music?.beatSeconds?.length) {
      return notEvaluable(
        'La pieza no tiene rejilla de beats; sin música no hay nada contra lo que ' +
        'medir el golpe.'
      );
    }
    const tolerance = context.budget?.beatToleranceSeconds ?? 0.06;
    const issues = [];

    for (const scene of context.scenes ?? []) {
      for (const effect of scene.effects ?? []) {
        if (!effect.strong) continue;
        if (effect.offBeatNote) continue;
        if (effect.beatDeltaSeconds === null || effect.beatDeltaSeconds === undefined) continue;
        const delta = Math.abs(effect.beatDeltaSeconds);
        if (delta <= tolerance) continue;
        issues.push({
          sceneId: scene.id,
          cueId: effect.id,
          message: `El efecto «${effect.effect}» cae a ${effect.beatDeltaSeconds}s del beat ` +
            `más cercano (tolerancia ${tolerance}s). Ánclalo con "atBeat" o justifica el ` +
            'desfase con "offBeatNote".'
        });
      }
    }
    return issues;
  }
};
