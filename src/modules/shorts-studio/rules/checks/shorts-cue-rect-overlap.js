import {SHORT_GEOMETRY, slotRect} from '../../geometry.js';

/**
 * Dos cues activos a la vez no pueden tener rectangulos que se solapen, aunque
 * esten en slots distintos. SH-R-010 solo mira el mismo slot; este validador
 * mide la geometria real, que es como se cazo el rotulo "EL PEOR"
 * (podium-3-verdict) dibujado encima del logo "CLAUDE CODE" (podium-3) en
 * harness-vs-modelo: los rectanngulos se tocaban y el texto del logo caia
 * dentro del rect del veredicto.
 *
 * Se mide con la misma geometria con la que dibuja Remotion
 * (`src/shorts/geometry.json`, via `src/modules/shorts-studio/geometry.js`).
 * Los chips son la excepcion: `stage-footer` los maqueta en fila a proposito.
 * Las parejas del mismo slot no se repiten: son el dominio de SH-R-010.
 */
export default {
  id: 'shorts-cue-rect-overlap',
  run(context) {
    const geometry = context.geometry ?? SHORT_GEOMETRY;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const cues = (scene.cues ?? []).filter((cue) => cue.type !== 'chip');
      for (let index = 0; index < cues.length; index += 1) {
        for (let other = index + 1; other < cues.length; other += 1) {
          const first = cues[index];
          const second = cues[other];
          const firstSlot = first.slot ?? 'stage-full';
          const secondSlot = second.slot ?? 'stage-full';
          if (firstSlot === secondSlot) continue;
          const firstEnd = first.fromFrame + first.durationInFrames;
          const secondEnd = second.fromFrame + second.durationInFrames;
          if (first.fromFrame >= secondEnd || second.fromFrame >= firstEnd) continue;
          const firstRect = slotRect(firstSlot, scene.layout, geometry);
          const secondRect = slotRect(secondSlot, scene.layout, geometry);
          const overlapX =
            firstRect.left < secondRect.left + secondRect.width &&
            secondRect.left < firstRect.left + firstRect.width;
          const overlapY =
            firstRect.top < secondRect.top + secondRect.height &&
            secondRect.top < firstRect.top + firstRect.height;
          if (!overlapX || !overlapY) continue;
          issues.push({
            sceneId: scene.id,
            cueId: second.id,
            message: `Los cues «${first.id}» (slot «${firstSlot}») y «${second.id}» ` +
              `(slot «${secondSlot}») estan activos a la vez y sus rectangulos se solapan. ` +
              'Mueve uno a otro slot o recorta su ventana.'
          });
        }
      }
    }
    return issues;
  }
};
