/**
 * Validador generado por `npm run shorts:feedback`.
 *
 * Regla: Un logo con presentation plain resuelve decoration none: sin tarjeta, borde ni halo.
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
  id: "shorts-plain-logo-no-decoration",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        if (cue.type !== 'logo' || cue.presentation !== 'plain') continue;
        if (cue.decoration !== 'none') {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `El logo plain ${cue.id ?? 'sin id'} conserva decoration ${cue.decoration ?? 'sin resolver'}.`
          });
        }
      }
    }
    return issues;
  }
};
