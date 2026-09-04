export default {
  id: 'shorts-screen-centered',
  run(context) {
    const width = context.format?.width ?? 1080;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const panels = [scene.pip?.screen, scene.fit?.screen, ...(scene.comparison ?? []).map(item => item.slot)].filter(Boolean);
      for (const panel of panels) {
        const right = width - panel.left - panel.width;
        if (![width, panel.left, panel.width].every(Number.isFinite) || panel.width <= 0 || panel.left < 0 || right < 0 || Math.abs(panel.left - right) > 0.5) {
          issues.push({sceneId: scene.id, message: 'La pantalla no esta centrada: los margenes laterales deben ser iguales.'});
        }
      }
    }
    return issues;
  }
};
