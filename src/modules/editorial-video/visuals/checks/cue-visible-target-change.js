export default {
  id: 'cue-visible-target-change',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (!Array.isArray(scene.visibleTargets)) continue;
      for (const cue of scene.cues ?? scene.semanticCues ?? []) {
        if (cue.action === 'zoom' && !scene.visibleTargets.includes(cue.target)) {
          issues.push({sceneId: scene.id, cueId: cue.id, message: `El zoom ${cue.id} no cambia ningún destino visible.`});
        }
      }
    }
    return issues;
  }
};
