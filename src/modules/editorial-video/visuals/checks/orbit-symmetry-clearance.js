export default {
  id: 'orbit-symmetry-clearance',
  run(context, rule) {
    const minimumClearance = rule.params?.minClearance ?? 32;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const componentKey = scene.componentKey ?? scene.kind ?? '';
      const orbital =
        /orbit/i.test(componentKey) ||
        scene.patternId === 'asset.logo-ecosystem' ||
        scene.geometry === 'radial';
      if (!orbital) continue;
      const geometry = scene.orbitGeometry ?? scene.props?.orbitGeometry;
      if (
        !geometry ||
        geometry.equalSpacing !== true ||
        Number(geometry.minClearance ?? 0) < minimumClearance
      ) {
        issues.push({
          sceneId: scene.id,
          message:
            'La composición orbital debe declarar separación angular equidistante ' +
            `y al menos ${minimumClearance}px de holgura respecto al núcleo y sus pares.`
        });
      }
    }
    return issues;
  }
};
