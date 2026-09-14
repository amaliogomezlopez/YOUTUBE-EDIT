/**
 * Validador generado por `npm run shorts:feedback`.
 *
 * Regla: Los proyectos con estilo blanco dinamico aprobado mantienen Schibsted Grotesk blanca, contorno oscuro y una unidad de subtitulo por pagina; el encuadre se revisa por escena.
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
  id: "shorts-approved-white-captions",
  run(context) {
    const style = context.captionStyle ?? {};
    if (style.approvedStyle !== 'white-dynamic-v1') return [];
    const issues = [];
    if (style.font !== 'Schibsted Grotesk' ||
        ['primary', 'accent', 'activeColor'].some(key => style[key]?.toUpperCase() !== '#FFFFFF') ||
        style.outlineSize < 5 || style.mode !== 'karaoke' || style.emphasis !== 'off') {
      issues.push({message: 'El estilo aprobado exige Schibsted Grotesk blanca, contorno de 5 px y karaoke sin enfasis de color.'});
    }
    for (const scene of context.scenes ?? []) {
      for (const page of scene.captionPages ?? []) {
        if ((page.words?.length ?? 0) > 1) issues.push({sceneId: scene.id, message: 'El estilo aprobado muestra una unidad por pagina, conservando nombres compuestos juntos.'});
      }
    }
    return issues;
  }
};
