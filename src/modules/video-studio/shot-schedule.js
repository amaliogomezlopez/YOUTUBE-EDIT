/**
 * Reparto del reloj montado en visuales ancladas a palabras.
 *
 * Es comun a las superficies porque el problema no depende del formato: dada una
 * lista de anclas (frames donde empieza una palabra) y un presupuesto de ritmo
 * `[minVisualSeconds, maxVisualSeconds]`, elegir los cortes que dejan cada visual lo
 * mas cerca posible del centro de la ventana. Se resuelve con programacion dinamica
 * sobre las anclas, de modo que ningun corte cae entre dos palabras.
 *
 * `nodes` son anclas ordenadas `{frame, ...}`; el primer nodo abre la pieza.
 * `bias(node)` resta coste a un ancla concreta (una palabra de enfasis atrae el
 * corte) sin romper el presupuesto.
 */
export function partitionAtAnchors(nodes, totalFrames, budget, fps, {bias = () => 0} = {}) {
  const candidates = [...nodes, {frame: totalFrames}];
  const min = Math.ceil(budget.minVisualSeconds * fps);
  const max = Math.floor(budget.maxVisualSeconds * fps);
  if (!(min > 0 && max >= min)) throw new Error('Falta presupuesto de ritmo');
  const ideal = (min + max) / 2;
  const cost = candidates.map(() => Infinity);
  const next = candidates.map(() => -1);
  cost[candidates.length - 1] = 0;
  for (let i = candidates.length - 2; i >= 0; i--) {
    for (let j = i + 1; j < candidates.length; j++) {
      const d = candidates[j].frame - candidates[i].frame;
      if (d > max) break;
      if (d < min || !Number.isFinite(cost[j])) continue;
      const score = cost[j] + ((d - ideal) / fps) ** 2 - (j < candidates.length - 1 ? bias(candidates[j]) : 0);
      if (score < cost[i]) {
        cost[i] = score;
        next[i] = j;
      }
    }
  }
  if (!Number.isFinite(cost[0])) return null;
  const segments = [];
  for (let i = 0; next[i] >= 0; i = next[i]) {
    segments.push({start: candidates[i], endFrame: candidates[next[i]].frame});
  }
  return segments;
}
