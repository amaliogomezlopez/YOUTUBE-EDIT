/**
 * Nada informativo por debajo de `geometry.safeBottom`: ahi dibuja la plataforma
 * (botones y descripcion de Shorts, barra y controles de YouTube). Se mide contra
 * los rectangulos que usa el renderer, no contra una constante.
 */
export default {
  id: 'montage-safe-area',
  run(context) {
    const geometry = context.geometry ?? {};
    const issues = [];
    for (const [name, rect] of [['subtitulos', geometry.captionRect], ['textos emergentes', geometry.popRect]]) {
      if (!rect) continue;
      const bottom = rect.top + rect.height;
      if (bottom > geometry.safeBottom) {
        issues.push({message: `La zona de ${name} baja hasta y = ${bottom}, por debajo del limite ${geometry.safeBottom} del formato ${context.format.id}.`});
      }
    }
    return issues;
  }
};
