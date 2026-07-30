/**
 * Un logo o una captura que entra sin sonido se percibe como un fallo de montaje, no
 * como una decision. Cada tipo de cue tiene familia por defecto, asi que quedarse
 * mudo solo pasa si el plan lo pide con `"sound": false`; cuando eso es
 * intencionado, el plan lo explica con `soundNote` y la regla calla.
 */
export default {
  id: 'shorts-cue-not-silent',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? []) {
        if (cue.sound || cue.soundNote) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `El cue «${cue.id}» entra en silencio. Pide una familia con ` +
            '"sound" o justifica el silencio con "soundNote".'
        });
      }
    }
    return issues;
  }
};
