/**
 * Validador generado por `npm run shorts:feedback`.
 *
 * Regla: Una captura densa en layout stage usa una escala resuelta de al menos 1.10 y ocupa stage-full.
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
  id: "shorts-dense-stage-expanded",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (scene.layout !== 'stage') continue;
      for (const cue of scene.cues ?? []) {
        if (cue.type !== 'screenshot' || cue.dense === false) continue;
        if ((cue.slot ?? 'stage-full') !== 'stage-full' || Number(cue.displayScale ?? 1.16) < 1.1) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message: `La captura densa ${cue.id ?? 'sin id'} debe ocupar stage-full con displayScale >= 1.10.`
          });
        }
      }
    }
    return issues;
  }
};
