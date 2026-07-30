const PHYSICAL_ACTION =
  /close|cerr|fall|ca[ií]|exit|salid|collapse|colaps|desmoron|break|ruptur/i;

export default {
  id: 'physical-action-metaphor',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      for (const cue of scene.cues ?? scene.semanticCues ?? []) {
        const signature = [cue.id, cue.label, cue.target].join(' ');
        if (!PHYSICAL_ACTION.test(signature) || cue.metaphor) continue;
        issues.push({
          sceneId: scene.id,
          cueId: cue.id,
          message:
            `La acción física «${cue.label ?? cue.id}» debe declarar una ` +
            'metáfora visual reconocible.'
        });
      }
    }
    return issues;
  }
};
