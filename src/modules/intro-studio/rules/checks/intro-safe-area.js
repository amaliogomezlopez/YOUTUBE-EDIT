import {INTRO_GEOMETRY, insideSafeArea, safeRect} from '../../geometry.js';

/**
 * Nada informativo sale de la zona segura.
 *
 * En 16:9 el limite no lo pone el formato sino el reproductor: YouTube dibuja la
 * barra de progreso y los controles en la franja inferior, y las tarjetas de
 * sugerencias arriba a la derecha. Un rotulo perfectamente legible en el MP4 queda
 * tapado en el reproductor real, asi que el render no delata el fallo.
 *
 * La geometria se lee del mismo JSON con el que dibuja Remotion: cambiar
 * `safeBottom` cambia lo que dibuja y lo que se mide a la vez.
 */
export default {
  id: 'intro-safe-area',
  run(context) {
    const safe = safeRect();
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        if (insideSafeArea(cue.rect)) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El cue «${cue.id}» (${cue.slot}) ocupa ` +
            `${cue.rect.left},${cue.rect.top} ${cue.rect.width}x${cue.rect.height} y sale de la ` +
            `zona segura ${safe.left},${safe.top} ${safe.width}x${safe.height}: ` +
            `nada informativo baja de y = ${INTRO_GEOMETRY.safeBottom} ni se sale de los ` +
            `${INTRO_GEOMETRY.safeX} px laterales.`
        });
      }
    }
    return issues;
  }
};
