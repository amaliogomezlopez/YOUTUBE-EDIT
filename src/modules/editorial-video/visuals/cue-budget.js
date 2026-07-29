/**
 * Fusión, presupuesto y overrides de cues.
 *
 * ANM-B04 · ANM-B05 — La minería produce de más a propósito. Aquí se decide qué
 * sobrevive, y toda intervención manual queda registrada con motivo.
 */

export const DEFAULT_BUDGET = {
  mergeWindowSeconds: 0.25,
  windowSeconds: 4,
  maxPerWindow: 3,
  maxPerScene: 12
};

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function byTime(left, right) {
  return left.atSeconds - right.atSeconds ||
    (right.priority ?? 0) - (left.priority ?? 0);
}

/**
 * Fusiona cues minados con cues escritos por el agente.
 * El cue autoral gana sobre el minado cuando comparten palabra de anclaje.
 */
export function mergeCueSets({mined = [], authored = [], sceneId} = {}) {
  const byAnchor = new Map();
  for (const cue of mined) {
    byAnchor.set(cue.anchorWordIndex, {...cue, origin: 'mined'});
  }
  const promoted = [];
  for (const cue of authored) {
    const key = cue.anchorWordIndex;
    if (Number.isInteger(key) && byAnchor.has(key)) {
      const base = byAnchor.get(key);
      byAnchor.set(key, {
        ...base,
        ...cue,
        kind: cue.kind ?? base.kind,
        priority: Math.max(base.priority ?? 0, cue.priority ?? 0),
        origin: 'authored+mined'
      });
      continue;
    }
    if (Number.isInteger(key)) {
      byAnchor.set(key, {...cue, origin: 'authored'});
      continue;
    }
    promoted.push({...cue, origin: 'authored'});
  }
  return [...byAnchor.values(), ...promoted]
    .map((cue) => ({...cue, sceneId: cue.sceneId ?? sceneId}))
    .sort(byTime);
}

/**
 * ANM-B05 — Overrides con trazabilidad obligatoria.
 * Cada operación (`add` | `move` | `suppress`) exige `reason`.
 */
export function applyCueOverrides(cues, overrides = []) {
  const log = [];
  let result = [...cues];
  for (const override of overrides) {
    if (!override?.reason) {
      throw new Error(
        `El override ${override?.cueId ?? '(sin id)'} no declara motivo; ` +
        'un cambio manual sin motivo no es reproducible.'
      );
    }
    if (override.op === 'suppress') {
      const before = result.length;
      result = result.filter((cue) => cue.id !== override.cueId);
      log.push({...override, applied: result.length < before});
      continue;
    }
    if (override.op === 'move') {
      let applied = false;
      result = result.map((cue) => {
        if (cue.id !== override.cueId) return cue;
        applied = true;
        return {
          ...cue,
          anchorWordIndex: override.anchorWordIndex ?? cue.anchorWordIndex,
          anchorText: override.anchorText ?? cue.anchorText,
          anchorOccurrence: override.anchorOccurrence ?? cue.anchorOccurrence,
          offsetSeconds: override.offsetSeconds ?? cue.offsetSeconds,
          origin: 'override'
        };
      });
      log.push({...override, applied});
      continue;
    }
    if (override.op === 'add') {
      result.push({...override.cue, origin: 'override'});
      log.push({...override, applied: true});
      continue;
    }
    throw new Error(`Operación de override desconocida: ${override.op}`);
  }
  return {cues: result.sort(byTime), log};
}

/**
 * ANM-B04 — Deduplica cues casi simultáneos y aplica presupuesto por ventana.
 * Un cue obligatorio (cifra, entidad, giro) nunca cae por presupuesto: si hay
 * saturación, cae el opcional de menor prioridad.
 */
export function applyCueBudget(cues, budget = {}) {
  const config = {...DEFAULT_BUDGET, ...budget};
  const ordered = [...cues].sort(byTime);
  const dropped = [];

  // 1. Fusión de cues a menos de `mergeWindowSeconds`.
  const merged = [];
  for (const cue of ordered) {
    const previous = merged.at(-1);
    if (
      previous &&
      Math.abs(cue.atSeconds - previous.atSeconds) < config.mergeWindowSeconds &&
      previous.target === cue.target
    ) {
      const winner = (cue.priority ?? 0) > (previous.priority ?? 0) ? cue : previous;
      const loser = winner === cue ? previous : cue;
      merged[merged.length - 1] = {
        ...winner,
        mergedFrom: [...(winner.mergedFrom ?? []), loser.id]
      };
      dropped.push({cue: loser, reason: 'merged-window'});
      continue;
    }
    merged.push(cue);
  }

  // 2. Presupuesto por ventana deslizante.
  const kept = [];
  for (const cue of merged) {
    const windowStart = cue.atSeconds - config.windowSeconds;
    const inWindow = kept.filter((item) => item.atSeconds > windowStart);
    if (inWindow.length < config.maxPerWindow) {
      kept.push(cue);
      continue;
    }
    const weakest = inWindow
      .filter((item) => !item.mandatory)
      .sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0))[0];
    if (cue.mandatory && weakest && (weakest.priority ?? 0) < (cue.priority ?? 0)) {
      kept.splice(kept.indexOf(weakest), 1);
      dropped.push({cue: weakest, reason: 'window-budget-displaced'});
      kept.push(cue);
      continue;
    }
    dropped.push({cue, reason: 'window-budget'});
  }

  // 3. Techo por escena.
  const finalCues = kept
    .sort(byTime)
    .filter((cue, position) => {
      if (position < config.maxPerScene) return true;
      dropped.push({cue, reason: 'scene-budget'});
      return false;
    });

  return {
    cues: finalCues,
    dropped,
    stats: {
      input: cues.length,
      kept: finalCues.length,
      dropped: dropped.length,
      densityPerMinute: finalCues.length
        ? round(finalCues.length / Math.max(1 / 60, (finalCues.at(-1).atSeconds || 1) / 60), 2)
        : 0
    }
  };
}
