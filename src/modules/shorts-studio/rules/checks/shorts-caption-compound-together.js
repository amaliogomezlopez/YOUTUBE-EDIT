/**
 * Validador generado por `npm run shorts:feedback`.
 *
 * Regla: Los subtitulos fusionan nombres de modelo y versiones decimales; no dejan fragmentos como .2 ni separan GLM de 5.2.
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
  id: "shorts-caption-compound-together",
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const page of scene.captionPages ?? []) {
        const words = page.words ?? [];
        for (let index = 0; index < words.length; index += 1) {
          const text = String(words[index].text ?? '');
          const previous = String(words[index - 1]?.text ?? '');
          const fragment = /^\.\d+$/.test(text);
          const separatedModelVersion =
            /^\d+(?:\.\d+)+$/.test(text) &&
            /^[\p{L}][\p{L}\p{N}-]{1,15}$/u.test(previous);
          if (fragment || separatedModelVersion) {
            issues.push({
              sceneId: scene.id,
              message: `El subtítulo separa el compuesto «${previous} ${text}»; debe ser una sola unidad.`
            });
          }
        }
      }
    }
    return issues;
  }
};
