import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Techo de golpes por segundo.
 *
 * Pasado ese techo la intro deja de tener ritmo y pasa a tener ruido: el ojo no
 * distingue diez impactos en dos segundos, solo registra parpadeo. Ademas es lo que
 * hace incomoda de ver una intro en pantalla grande.
 *
 * El techo lo fija el perfil, no la superficie: el mismo validador vale para el
 * perfil nervioso y para el sobrio, que es justo lo que permite tener estilos
 * distintos sin reglas distintas.
 */
export default {
  id: 'intro-effect-density-max',
  run(context) {
    const max = context.budget?.maxStrongEffectsPerSecond;
    if (!Number.isFinite(max)) {
      return notEvaluable(
        'El build no declara `budget.maxStrongEffectsPerSecond`; el techo lo fija el ' +
        'perfil de estilo y sin él no hay contra qué medir.'
      );
    }

    const hits = (context.scenes ?? [])
      .flatMap((scene) => (scene.effects ?? [])
        .filter((effect) => effect.strong)
        .map((effect) => ({
          sceneId: scene.id,
          id: effect.id,
          effect: effect.effect,
          atSeconds: Number(effect.absoluteSeconds ?? effect.atSeconds)
        })))
      .sort((a, b) => a.atSeconds - b.atSeconds);

    // Ventana deslizante de un segundo: medir por segundos enteros deja pasar cuatro
    // golpes repartidos entre el final de un segundo y el principio del siguiente.
    const issues = [];
    for (let index = 0; index < hits.length; index += 1) {
      const window = hits.filter(
        (hit) => hit.atSeconds >= hits[index].atSeconds && hit.atSeconds < hits[index].atSeconds + 1
      );
      if (window.length <= max) continue;
      issues.push({
        sceneId: hits[index].sceneId,
        cueId: hits[index].id,
        message: `${window.length} golpes en un segundo desde ${hits[index].atSeconds}s ` +
          `(${window.map((hit) => hit.effect).join(', ')}); el perfil ` +
          `«${context.budget.profileId ?? context.profileId}» admite ${max}.`
      });
      // Un solo aviso por racha: informar de cada golpe de la ventana repetiria el
      // mismo problema tantas veces como golpes tenga.
      index += window.length - 1;
    }
    return issues;
  }
};
