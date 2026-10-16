/**
 * SH-R-063: el escenario no se queda vacio mas de MAX_EMPTY_SECONDS seguidos.
 *
 * Cuenta como lleno cualquier cue que ocupe el escenario (todo salvo los slots
 * `overlay-*`). El primer b-roll de una escena se dibuja desde el inicio de la
 * escena, igual que hace `BrollLayer`.
 */
const STAGE_LAYOUTS = new Set(['split', 'stage', 'talking-head']);
const MAX_EMPTY_SECONDS = 1.5;

export default {
  id: 'shorts-stage-never-empty',
  run(context) {
    const fps = context.format?.fps ?? 60;
    const issues = [];
    for (const scene of context.scenes ?? []) {
      if (!STAGE_LAYOUTS.has(scene.layout)) continue;
      const end = scene.durationInFrames;
      if (!Number.isFinite(end)) continue;
      const brolls = (scene.cues ?? []).filter((cue) => cue.type === 'broll');
      const spans = (scene.cues ?? [])
        .filter((cue) => !String(cue.slot ?? '').startsWith('overlay-'))
        .map((cue) => {
          const from = cue.type === 'broll' && cue === brolls[0] ? 0 : cue.fromFrame;
          return [from, cue.fromFrame + cue.durationInFrames];
        })
        .sort((a, b) => a[0] - b[0]);
      let covered = 0;
      let longest = 0;
      let longestAt = 0;
      for (const [from, to] of spans) {
        if (from - covered > longest) [longest, longestAt] = [from - covered, covered];
        covered = Math.max(covered, to);
      }
      if (end - covered > longest) [longest, longestAt] = [end - covered, covered];
      if (longest > MAX_EMPTY_SECONDS * fps) {
        issues.push({
          sceneId: scene.id,
          message: `El escenario queda vacio ${(longest / fps).toFixed(2)} s desde ${(longestAt / fps).toFixed(2)} s de la escena; adelanta el recurso o anade uno que cuadre con la frase.`
        });
      }
    }
    return issues;
  }
};
