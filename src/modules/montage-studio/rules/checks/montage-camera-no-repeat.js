/**
 * Dos beats seguidos no repiten movimiento de camara. Dos `push-in` encadenados se
 * leen como un solo zoom largo interrumpido por un corte: la alternancia es lo que
 * hace que cada cambio se sienta como un golpe nuevo.
 */
export default {
  id: 'montage-camera-no-repeat',
  run(context) {
    const issues = [];
    const beats = context.beats ?? [];
    for (let i = 1; i < beats.length; i += 1) {
      const move = beats[i].camera?.move;
      if (move && move === beats[i - 1].camera?.move) {
        issues.push({sceneId: beats[i].id, message: `«${beats[i - 1].id}» y «${beats[i].id}» repiten el movimiento «${move}».`});
      }
    }
    return issues;
  }
};
