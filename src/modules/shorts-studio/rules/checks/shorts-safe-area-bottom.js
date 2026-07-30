import {SHORT_GEOMETRY, captionBottom, slotRect} from '../../geometry.js';

/**
 * La interfaz de Shorts y Reels dibuja titulo, avatar y botones en la franja
 * inferior. Nada informativo puede bajar de `safeBottom`: ahi el texto queda tapado
 * en el reproductor real aunque en el MP4 se lea perfectamente.
 *
 * Se mide el rectangulo de cada slot y el borde del bloque de subtitulos con la
 * misma geometria con la que dibuja Remotion (`src/shorts/geometry.json`).
 */
export default {
  id: 'shorts-safe-area-bottom',
  run(context, rule) {
    const geometry = context.geometry ?? SHORT_GEOMETRY;
    const limit = rule?.params?.safeBottom ?? geometry.safeBottom;
    const issues = [];
    const seenLayouts = new Set();

    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        const slot = cue.slot ?? 'stage-full';
        const rect = slotRect(slot, scene.layout, geometry);
        const bottom = rect.top + rect.height;
        if (bottom <= limit) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El slot «${slot}» del layout «${scene.layout}» acaba en y=${bottom}, ` +
            `por debajo de la zona segura (y=${limit}).`
        });
      }
      if (seenLayouts.has(scene.layout) || scene.captionPages?.length === 0) continue;
      seenLayouts.add(scene.layout);
      const bottom = captionBottom(scene.layout, geometry);
      if (bottom > limit) {
        issues.push({
          sceneId: scene.id,
          message: `El bloque de subtitulos del layout «${scene.layout}» se ancla en ` +
            `y=${bottom}, por debajo de la zona segura (y=${limit}).`
        });
      }
    }
    return issues;
  }
};
