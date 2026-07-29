const STRONG_MOTION =
  /drag|arrastr|fall|ca[ií]da|downward|impact|break|ruptur|burst|abyss|abismo/i;

export default {
  id: 'semantic-motion-sound',
  run(context, rule) {
    const planned = new Map(
      (context.sound?.scenes ?? [])
        .flatMap((scene) => scene.cues ?? [])
        .map((cue) => [`${cue.sceneId}:${cue.cueId}`, cue])
    );
    const minimumVolume = rule.params?.minVolume ?? 0.32;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const cues = scene.cues ?? scene.semanticCues ?? [];
      const localSound = new Map(
        (scene.soundPlan ?? scene.props?.soundPlan ?? []).map((cue) => [cue.cueId, cue])
      );
      for (const cue of cues) {
        const signature = [cue.id, cue.target, cue.label, cue.metaphor].join(' ');
        if (!STRONG_MOTION.test(signature)) continue;
        const sound = localSound.get(cue.id) ?? planned.get(`${scene.id}:${cue.id}`);
        if (!sound || Number(sound.volume ?? 0) < minimumVolume) {
          issues.push({
            sceneId: scene.id,
            cueId: cue.id,
            message:
              `El movimiento fuerte «${cue.label ?? cue.id}» no tiene un sonido ` +
              `perceptible sincronizado (volumen mínimo ${minimumVolume}).`
          });
        }
      }
    }
    return issues;
  }
};
