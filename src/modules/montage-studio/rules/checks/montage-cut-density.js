import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Techo de ritmo: visuales mas cortas que `budget.minVisualSeconds` o mas de
 * `budget.maxCutsPer10s` cortes en una ventana deslizante de 10 s. Por encima el ojo
 * no llega a leer la imagen y el montaje se convierte en parpadeo. El ultimo beat
 * puede ser corto: lo acota el final de la locucion, no el montaje.
 */
export default {
  id: 'montage-cut-density',
  run(context) {
    const {minVisualSeconds, maxCutsPer10s} = context.budget ?? {};
    if (!Number.isFinite(minVisualSeconds) || !Number.isFinite(maxCutsPer10s)) {
      return notEvaluable('El perfil no declara minVisualSeconds y maxCutsPer10s.');
    }
    const fps = context.format.fps;
    const beats = context.beats ?? [];
    const issues = [];
    beats.forEach((beat, index) => {
      if (index < beats.length - 1 && beat.durationInFrames / fps < minVisualSeconds - 1e-6) {
        issues.push({sceneId: beat.id, message: `El beat «${beat.id}» dura ${(beat.durationInFrames / fps).toFixed(2)} s (minimo ${minVisualSeconds} s).`});
      }
    });
    const cuts = beats.slice(1).map((beat) => beat.fromFrame);
    for (const start of cuts) {
      const inWindow = cuts.filter((frame) => frame >= start && frame < start + 10 * fps).length;
      if (inWindow > maxCutsPer10s) {
        issues.push({message: `${inWindow} cortes entre ${(start / fps).toFixed(1)} s y ${(start / fps + 10).toFixed(1)} s (maximo ${maxCutsPer10s}).`});
        break;
      }
    }
    return issues;
  }
};
