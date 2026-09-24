import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * Suelo de ritmo: ninguna visual dura mas que `budget.maxSecondsWithoutCut`. Es el
 * fallo real de un montaje viral: no pasarse de cortes, sino quedarse quieto.
 */
export default {
  id: 'montage-max-seconds-without-cut',
  run(context) {
    const limit = context.budget?.maxSecondsWithoutCut;
    if (!Number.isFinite(limit)) return notEvaluable('El perfil no declara maxSecondsWithoutCut.');
    const fps = context.format.fps;
    return (context.beats ?? [])
      .filter((beat) => beat.durationInFrames / fps > limit + 1e-6)
      .map((beat) => ({sceneId: beat.id,
        message: `El beat «${beat.id}» dura ${(beat.durationInFrames / fps).toFixed(2)} s sin corte (maximo ${limit} s del perfil ${context.budget.profileId}).`}));
  }
};
