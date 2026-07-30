import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Silencio de sobra en los extremos de una escena.
 *
 * El recorte automatico deja `silencePaddingSeconds` de aire antes de la primera
 * palabra y despues de la ultima. Un extremo declarado en el plan manda siempre, y
 * es asi como se parte un clip en dos escenas; pero un extremo declarado con dos
 * segundos de silencio dentro es un despiste, y en un short de 30 s eso es el 7 % del
 * tiempo mirando a alguien que no habla.
 */
export default {
  id: 'shorts-scene-edge-silence',
  run(context, rule) {
    const padding = Number(
      rule?.params?.paddingSeconds ?? context.silencePaddingSeconds ?? 0.5
    );
    const tolerance = Number(rule?.params?.toleranceSeconds ?? 0.25);
    const limit = padding + tolerance;
    const measurable = (context.scenes ?? []).filter(
      (scene) => Number.isFinite(scene.speechLeadSeconds)
    );
    if (!measurable.length) {
      return notEvaluable(
        'Ninguna escena declara donde empieza y acaba la locucion; sin transcripcion ' +
        'no hay silencio que medir.'
      );
    }
    const issues = [];
    for (const scene of measurable) {
      for (const [edge, value] of [
        ['entrada', scene.speechLeadSeconds],
        ['salida', scene.speechTailSeconds]
      ]) {
        if (!Number.isFinite(value) || value <= limit) continue;
        issues.push({
          sceneId: scene.id,
          message: `La escena deja ${value}s de silencio en la ${edge} ` +
            `(maximo ${limit}s). Ajusta el trim o quita el extremo declarado para ` +
            'que el build lo recorte solo.'
        });
      }
    }
    return issues;
  }
};
