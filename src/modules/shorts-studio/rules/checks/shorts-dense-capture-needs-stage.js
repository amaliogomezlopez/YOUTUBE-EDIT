/**
 * Una captura de pantalla con texto solo se lee en `stage`, que le da 952x760 px.
 * En `split` el escenario mide 540 px de alto y la misma imagen entra a la mitad de
 * escala: se ve que hay un tuit, no lo que dice. Si una escena empieza con la cara y
 * luego necesita la captura, se parte en dos escenas con el mismo `clipId` y trims
 * contiguos.
 *
 * Una captura sin texto se declara con `"dense": false` en el plan.
 */
export default {
  id: 'shorts-dense-capture-needs-stage',
  run(context, rule) {
    const layout = rule?.params?.layout ?? 'stage';
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (scene.layout === layout) continue;
      for (const cue of scene.cues ?? []) {
        if (cue.type !== 'screenshot' || cue.dense === false) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message: `La captura «${cue.assetId ?? cue.id}» se muestra en layout ` +
            `«${scene.layout}»: su texto no se lee. Usa «${layout}» o declara ` +
            '"dense": false si la imagen no lleva texto.'
        });
      }
    }
    return issues;
  }
};
