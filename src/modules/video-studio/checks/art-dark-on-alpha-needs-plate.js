import {notEvaluable} from '../../editorial-video/visuals/rules-engine.js';
import {isDarkArtOnAlpha} from '../artwork.js';

/**
 * Un logo cuyo arte es negro sobre transparencia desaparece dentro de la tarjeta
 * oscura de `card`: queda un marco vacio. `plate` le pone una placa clara detras.
 *
 * Validador de ambito `catalog`: la mide igual un short vertical que una intro
 * 16:9, porque el problema esta en el arte del asset y no en el formato. Vive en
 * `video-studio/checks/` justamente por eso (politica de promocion de reglas).
 *
 * El build mide el arte de cada asset y lo deja en `cue.art`; sin esa medida
 * (media borrada, sharp no disponible) la regla no puede opinar.
 */
export default {
  id: 'art-dark-on-alpha-needs-plate',
  run(context) {
    const withAsset = (context.scenes ?? [])
      .flatMap((scene) => scene.cues ?? [])
      .filter((cue) => cue.assetId);
    if (withAsset.length && !withAsset.some((cue) => cue.art)) {
      return notEvaluable(
        'Ningun cue trae medidas de arte; recompila con la media presente para que ' +
        'el build pueda medir los assets.'
      );
    }
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        if (!isDarkArtOnAlpha(cue.art) || cue.presentation === 'plate') continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El arte de «${cue.assetId ?? cue.id}» es oscuro sobre alfa ` +
            `(luma ${cue.art.meanLuma}) y se presenta como «${cue.presentation}»: ` +
            'sobre tarjeta oscura es invisible. Usa "presentation": "plate".'
        });
      }
    }
    return issues;
  }
};
