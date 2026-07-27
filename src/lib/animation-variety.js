const ART_DIRECTIONS = [
  'editorial-report',
  'documentary-evidence',
  'diagrammatic-system',
  'market-data'
];

function normalizeRecent(recentSelections) {
  return Array.isArray(recentSelections)
    ? recentSelections.filter((item) => item && typeof item === 'object').slice(-12)
    : [];
}

export function chooseArtDirection({
  preferred,
  candidates = ART_DIRECTIONS,
  recentSelections = []
} = {}) {
  const validCandidates = [...new Set(candidates)].filter((candidate) =>
    ART_DIRECTIONS.includes(candidate)
  );
  if (!validCandidates.length) {
    throw new Error('Se necesita al menos una dirección artística válida.');
  }
  const recent = normalizeRecent(recentSelections);
  const lastTwo = recent.slice(-2).map((item) => item.artDirection).filter(Boolean);
  const ordered = [
    preferred,
    ...validCandidates
  ].filter((candidate, index, list) =>
    candidate
    && validCandidates.includes(candidate)
    && list.indexOf(candidate) === index
  );
  const selected = ordered.find((candidate) => !lastTwo.includes(candidate))
    || ordered[0];
  return {
    selected,
    avoided: lastTwo,
    reason: lastTwo.includes(preferred)
      ? `Se evita repetir ${preferred} en las dos piezas recientes.`
      : preferred === selected
        ? `Se conserva ${selected} por adecuación semántica.`
        : `Se elige ${selected} para introducir variedad sin cambiar el patrón.`
  };
}

export function planAnimationVariety({
  patternId,
  preferredArtDirection,
  artDirectionCandidates,
  effectIds = [],
  recentSelections = []
}) {
  const recent = normalizeRecent(recentSelections);
  const artDirection = chooseArtDirection({
    preferred: preferredArtDirection,
    candidates: artDirectionCandidates,
    recentSelections: recent
  });
  const recentEffectIds = new Set(
    recent.slice(-2).flatMap((item) =>
      Array.isArray(item.effectIds) ? item.effectIds : []
    )
  );
  const repeatedEffects = effectIds.filter((effectId) => recentEffectIds.has(effectId));
  return {
    historyWindow: Math.min(2, recent.length),
    avoid: {
      artDirections: artDirection.avoided,
      effectIds: [...recentEffectIds]
    },
    selected: {
      patternId,
      artDirection: artDirection.selected,
      effectIds
    },
    repeatedEffects,
    reasons: [
      artDirection.reason,
      repeatedEffects.length
        ? `Se conservan ${repeatedEffects.join(', ')} porque construyen la lectura factual.`
        : 'No se repiten efectos dominantes de las dos piezas recientes.'
    ]
  };
}

export const animationArtDirections = ART_DIRECTIONS;
