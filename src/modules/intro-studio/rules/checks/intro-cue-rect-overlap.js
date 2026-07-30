import {rectsOverlap} from '../../geometry.js';

/**
 * Dos cues activos a la vez y a la misma profundidad no pueden solaparse.
 *
 * Se compara por rectangulo y no por slot porque los slots de la intro se pisan a
 * proposito: `center` cae dentro de `banner-bottom`, y `back-center` toca
 * `back-left` y `back-right`. Ese solape es util —permite elegir composicion— pero
 * solo si no hay dos cosas dentro a la vez.
 *
 * Profundidades distintas si pueden solaparse: es exactamente el efecto que se busca
 * cuando un logo pasa por detras del sujeto mientras un rotulo entra por delante.
 */
export default {
  id: 'intro-cue-rect-overlap',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const cues = scene.cues ?? [];
      for (let left = 0; left < cues.length; left += 1) {
        for (let right = left + 1; right < cues.length; right += 1) {
          const a = cues[left];
          const b = cues[right];
          if (a.depth !== b.depth) continue;
          const overlapsInTime =
            a.fromFrame < b.fromFrame + b.durationInFrames &&
            b.fromFrame < a.fromFrame + a.durationInFrames;
          if (!overlapsInTime || !rectsOverlap(a.rect, b.rect)) continue;
          issues.push({
            sceneId: scene.id,
            cueId: a.id,
            message: `Los cues «${a.id}» (${a.slot}) y «${b.id}» (${b.slot}) están activos ` +
              `a la vez en ${a.depth} y sus rectángulos se solapan: uno se dibuja encima ` +
              'del otro. Separa los instantes o usa slots que no se toquen.'
          });
        }
      }
    }
    return issues;
  }
};
