import {notEvaluable} from '../../../editorial-video/visuals/rules-engine.js';

/**
 * La intro dura lo que tiene que durar.
 *
 * Por debajo del minimo no hay intro, hay un golpe; por encima del maximo la
 * retencion del video cae porque el espectador ya sabe de que va y todavia no ha
 * empezado. El intervalo lo fija el perfil, que es donde vive esa decision editorial.
 */
export default {
  id: 'intro-duration-budget',
  run(context) {
    const budget = context.budget?.durationBudgetSeconds;
    if (!budget) {
      return notEvaluable(
        'El build no declara `budget.durationBudgetSeconds`; la duración la fija el ' +
        'perfil de estilo.'
      );
    }
    const fps = context.format?.fps ?? 60;
    const seconds = Number(
      context.durationSeconds ?? (context.durationInFrames ? context.durationInFrames / fps : 0)
    );
    if (!seconds) return [];
    if (seconds >= budget.min && seconds <= budget.max) return [];
    return [{
      message: `La intro dura ${seconds}s y el perfil ` +
        `«${context.budget.profileId ?? context.profileId}» la quiere entre ` +
        `${budget.min}s y ${budget.max}s.`
    }];
  }
};
