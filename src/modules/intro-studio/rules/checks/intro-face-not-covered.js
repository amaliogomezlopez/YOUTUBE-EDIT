import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';
import {INTRO_GEOMETRY, rectsOverlap} from '../../geometry.js';

/**
 * Ningun cue de primer plano tapa la cara del sujeto.
 *
 * Es el fallo mas caro de una intro y el mas invisible en el JSON: el plan pide un
 * logo en `center` con el layout `hero` y el logo aterriza sobre la boca. El build
 * traduce el `faceBox` de la ingesta al rectangulo que ocupa la cara en la
 * composicion, y aqui se compara contra el rectangulo de cada cue activo a la vez.
 *
 * Se admite un solape pequeno: un rotulo que roza el hombro o el pelo no molesta, y
 * exigir cero contacto dejaria media pantalla inutilizable.
 *
 * Tambien mide el titular, que no es un cue pero ocupa una banda fija y grande: en un
 * layout donde el sujeto quede bajo en el encuadre, el titulo le cae sobre la cara.
 */
export default {
  id: 'intro-face-not-covered',
  run(context, rule) {
    const maxOverlapRatio = rule?.params?.maxOverlapRatio ?? 0.12;
    const scenes = context.scenes ?? [];
    const withFace = scenes.filter((scene) => scene.faceRect);
    if (scenes.length && !withFace.length) {
      return notEvaluable(
        'Ninguna escena trae el rectángulo de la cara; reingiere con detección de ' +
        'cara para que el build pueda medir la oclusión.'
      );
    }

    const overlapRatio = (rect, face) => {
      if (!rectsOverlap(rect, face)) return 0;
      const width = Math.min(rect.left + rect.width, face.left + face.width)
        - Math.max(rect.left, face.left);
      const height = Math.min(rect.top + rect.height, face.top + face.height)
        - Math.max(rect.top, face.top);
      return (width * height) / (face.width * face.height);
    };

    const issues = [];
    for (const scene of withFace) {
      const face = scene.faceRect;

      if (context.titleCard && overlapsInTime(scene, context.titleCard)) {
        const ratio = overlapRatio(INTRO_GEOMETRY.titleBand, face);
        if (ratio > maxOverlapRatio) {
          issues.push({
            sceneId: scene.id,
            message: `El titular tapa el ${Math.round(ratio * 100)} % de la cara en esta escena ` +
              `(máximo ${Math.round(maxOverlapRatio * 100)} %). Encuadra más alto, usa ` +
              '`hero-left`/`hero-right` o mueve el titular a otra escena.'
          });
        }
      }

      for (const cue of scene.cues ?? []) {
        if (cue.depth !== 'front') continue;
        const ratio = overlapRatio(cue.rect, face);
        if (ratio <= maxOverlapRatio) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El cue «${cue.id}» tapa el ${Math.round(ratio * 100)} % de la cara ` +
            `(máximo ${Math.round(maxOverlapRatio * 100)} %). Usa un slot lateral, ` +
            'manda el cue a `depth: "back"` o cambia el layout a `hero-left`/`hero-right`.'
        });
      }
    }
    return issues;
  }
};

/** El titular es global: solo tapa a las escenas que estan en pantalla con el. */
function overlapsInTime(scene, titleCard) {
  const sceneFrom = scene.from ?? 0;
  const sceneTo = sceneFrom + (scene.durationInFrames ?? 0);
  const titleFrom = titleCard.fromFrame ?? 0;
  const titleTo = titleFrom + (titleCard.durationInFrames ?? 0);
  return sceneFrom < titleTo && titleFrom < sceneTo;
}
