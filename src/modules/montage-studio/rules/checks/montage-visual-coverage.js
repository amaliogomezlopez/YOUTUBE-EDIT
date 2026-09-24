/**
 * Ningun frame sin visual: los beats empiezan en 0, se tocan sin hueco ni solape y
 * terminan en la duracion de la pieza, y cada uno apunta a un asset resuelto. Un
 * hueco se renderiza como un fotograma negro, que en un montaje de este ritmo se lee
 * como un fallo, nunca como una pausa.
 */
export default {
  id: 'montage-visual-coverage',
  run(context) {
    const issues = [];
    let cursor = 0;
    for (const beat of context.beats ?? []) {
      if (beat.fromFrame !== cursor) {
        issues.push({sceneId: beat.id, message: `El beat «${beat.id}» empieza en el frame ${beat.fromFrame} y el anterior acaba en ${cursor}: hay un hueco o un solape.`});
      }
      if (!beat.visual?.src) issues.push({sceneId: beat.id, message: `El beat «${beat.id}» no tiene visual resuelta.`});
      cursor = beat.fromFrame + beat.durationInFrames;
    }
    if (cursor !== context.durationInFrames) {
      issues.push({message: `Los beats cubren ${cursor} frames y la pieza dura ${context.durationInFrames}.`});
    }
    return issues;
  }
};
