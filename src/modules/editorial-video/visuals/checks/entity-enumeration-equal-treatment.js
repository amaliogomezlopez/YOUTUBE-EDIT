export default {
  id: 'entity-enumeration-equal-treatment',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const entity of scene.entitySequence ?? []) {
        const cue = (scene.cues ?? scene.semanticCues ?? []).find(
          (item) => item.entityId === entity || item.target === `dotcom-company-${entity}`
        );
        if (!cue || cue.action !== 'focus' || !cue.sound) {
          issues.push({sceneId: scene.id, message: `La entidad ${entity} no tiene foco y sonido equivalentes.`});
        }
      }
    }
    return issues;
  }
};
