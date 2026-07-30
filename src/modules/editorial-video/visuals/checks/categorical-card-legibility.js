export default {
  id: 'categorical-card-legibility',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const card of scene.categoryCards ?? []) {
        if (card.labelOrientation !== 'horizontal' || !card.iconId) {
          issues.push({sceneId: scene.id, message: `La tarjeta ${card.id ?? card.label} necesita texto horizontal e icono semántico.`});
        }
      }
    }
    return issues;
  }
};
