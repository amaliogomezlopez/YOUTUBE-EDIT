/**
 * Validador generado por `npm run shorts:feedback`.
 *
 * Regla: Un cue brand en layout full usa el slot overlay-top para no cubrir la cara.
 *
 * El contexto es `short-build.json`: `context.scenes` con `layout`,
 * `cues` (slot, fromFrame, durationInFrames, presentation, art, sound) y
 * `captionPages`; `context.format`, `context.soundCues` y
 * `context.duckWindows` para lo demás.
 *
 * Rellena `run` con la comprobación real. Mientras devuelva la incidencia TODO,
 * el fixture de regresión falla y la regla no se puede dar por cerrada.
 */
export default {
  id: "shorts-full-brand-top",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (scene.layout !== 'full') continue;
      for (const cue of scene.cues ?? []) {
        if (cue.type === 'brand' && cue.slot !== 'overlay-top') {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El cierre de marca ${cue.id ?? 'sin id'} debe usar overlay-top en layout full.`
          });
        }
      }
    }
    return issues;
  }
};
