const signatureOf = (scene) =>
  scene.visualSignature ??
  scene.props?.visualSignature ??
  (scene.patternId === 'asset.logo-ecosystem' ? 'brand-center-orbit' : null);

export default {
  id: 'approved-block-visual-novelty',
  run(context) {
    const approved = new Set(
      (context.approvedVisualSignatures ?? []).map(String)
    );
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const signature = signatureOf(scene);
      if (!signature) continue;
      if (approved.has(signature)) {
        issues.push({
          sceneId: scene.id,
          message:
            `La firma visual dominante "${signature}" ya aparece en uno de los ` +
            'dos bloques aprobados anteriores. Elige otra geometría o registra una excepción.'
        });
      }
    }
    return issues;
  }
};
