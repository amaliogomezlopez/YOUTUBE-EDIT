import {notEvaluable} from '../../editorial-video/visuals/rules-engine.js';
import {hasSolidDarkBackground} from '../artwork.js';

/**
 * Un wordmark exportado sin alfa arrastra su rectangulo negro. Dentro de una
 * tarjeta oscura se ve el escalon; sobre el video, un parche. `blend` lo suma con
 * `screen`, que hace desaparecer el negro solido.
 *
 * Solo aplica a logos y marcas: una captura de pantalla tambien trae fondo propio,
 * pero ahi el fondo es parte de la evidencia y `card` es lo correcto.
 *
 * Validador de ambito `catalog`, comun a todas las superficies.
 */
export default {
  id: 'art-solid-background-needs-blend',
  run(context, rule) {
    const types = new Set(rule?.params?.types ?? ['logo', 'brand']);
    const withAsset = (context.scenes ?? [])
      .flatMap((scene) => scene.cues ?? [])
      .filter((cue) => cue.assetId && types.has(cue.type));
    if (withAsset.length && !withAsset.some((cue) => cue.art)) {
      return notEvaluable(
        'Ningun logo trae medidas de arte; recompila con la media presente para que ' +
        'el build pueda medir los assets.'
      );
    }
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        if (!types.has(cue.type)) continue;
        if (!hasSolidDarkBackground(cue.art) || cue.presentation === 'blend') continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `«${cue.assetId ?? cue.id}» trae fondo negro solido ` +
            `(borde opaco ${cue.art.edgeDarkRatio}) y se presenta como ` +
            `«${cue.presentation}»: se vera el rectangulo. Usa "presentation": "blend".`
        });
      }
    }
    return issues;
  }
};
