/**
 * Un cue de profundidad `back` tiene que estar reducido y desenfocado.
 *
 * Sin mascara de persona, lo unico que dice "esto esta detras" es la profundidad de
 * campo: un logo a escala 1 y sin desenfoque detras del sujeto no se lee como fondo,
 * se lee como un logo pegado que compite con la cara. Los valores por defecto los
 * pone el perfil, asi que esta regla solo salta cuando el plan los sobrescribe a
 * mano.
 */
export default {
  id: 'intro-back-cue-reads-as-background',
  run(context, rule) {
    const maxScale = rule?.params?.maxScale ?? 0.95;
    const minBlurPx = rule?.params?.minBlurPx ?? 1;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        if (cue.depth !== 'back') continue;
        const problems = [];
        if (!(cue.scale <= maxScale)) problems.push(`escala ${cue.scale} (máximo ${maxScale})`);
        if (!(cue.blurPx >= minBlurPx)) problems.push(`desenfoque ${cue.blurPx}px (mínimo ${minBlurPx}px)`);
        if (!problems.length) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El cue «${cue.id}» va detrás del sujeto con ${problems.join(' y ')}: ` +
            'sin reducir ni desenfocar no se lee como fondo, compite con la cara.'
        });
      }
    }
    return issues;
  }
};
