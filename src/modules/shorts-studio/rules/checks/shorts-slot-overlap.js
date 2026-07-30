/**
 * Dos cues en el mismo slot y a la vez se dibujan uno encima del otro. Es el fallo
 * mas facil de introducir al alargar un `holdSeconds`, y no se ve en el JSON: solo
 * aparece al renderizar. Los chips son la excepcion, porque `stage-footer` los
 * maqueta en fila a proposito.
 */
export default {
  id: 'shorts-slot-overlap',
  run(context) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      const bySlot = new Map();
      for (const cue of scene.cues ?? []) {
        if (cue.type === 'chip') continue;
        const slot = cue.slot ?? 'stage-full';
        if (!bySlot.has(slot)) bySlot.set(slot, []);
        bySlot.get(slot).push(cue);
      }
      for (const [slot, slotCues] of bySlot) {
        const ordered = [...slotCues].sort((left, right) => left.fromFrame - right.fromFrame);
        for (let index = 1; index < ordered.length; index += 1) {
          const previous = ordered[index - 1];
          const current = ordered[index];
          if (current.fromFrame >= previous.fromFrame + previous.durationInFrames) continue;
          issues.push({
            sceneId: scene.id,
            cueId: current.id,
            message: `Los cues «${previous.id}» y «${current.id}» se solapan en el slot ` +
              `«${slot}». Reduce holdSeconds de «${previous.id}» o mueve uno a otro slot.`
          });
        }
      }
    }
    return issues;
  }
};
