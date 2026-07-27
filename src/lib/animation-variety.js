const ART_DIRECTIONS = [
  'editorial-report',
  'documentary-evidence',
  'diagrammatic-system',
  'market-data'
];
const HISTORY_WINDOW = 6;

function normalizeRecent(recentSelections) {
  return Array.isArray(recentSelections)
    ? recentSelections.filter((item) => item && typeof item === 'object').slice(-24)
    : [];
}

function chooseDimension({
  preferred,
  candidates = [],
  recentSelections = [],
  field
}) {
  const unique = [...new Set(candidates.filter(Boolean))];
  if (preferred && !unique.includes(preferred)) unique.unshift(preferred);
  if (!unique.length) return null;
  const recent = normalizeRecent(recentSelections).slice(-HISTORY_WINDOW);
  const counts = new Map(unique.map((candidate) => [candidate, 0]));
  for (const item of recent) {
    if (counts.has(item[field])) {
      counts.set(item[field], counts.get(item[field]) + 1);
    }
  }
  return [...unique].sort((left, right) => {
    const frequency = counts.get(left) - counts.get(right);
    if (frequency) return frequency;
    if (left === preferred) return -1;
    if (right === preferred) return 1;
    return unique.indexOf(left) - unique.indexOf(right);
  })[0];
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
  preferredTheme,
  themeCandidates = [],
  preferredMotionProfile,
  motionProfileCandidates = [],
  preferredGeometry,
  geometryCandidates = [],
  preferredMetaphor,
  metaphorCandidates = [],
  preferredCamera,
  cameraCandidates = [],
  recentSelections = []
}) {
  const recent = normalizeRecent(recentSelections);
  const artDirection = chooseArtDirection({
    preferred: preferredArtDirection,
    candidates: artDirectionCandidates,
    recentSelections: recent
  });
  const recentEffectIds = new Set(
    recent.slice(-4).flatMap((item) =>
      Array.isArray(item.effectIds) ? item.effectIds : []
    )
  );
  const repeatedEffects = effectIds.filter((effectId) => recentEffectIds.has(effectId));
  const dimensions = {
    themeId: chooseDimension({
      preferred: preferredTheme,
      candidates: themeCandidates,
      recentSelections: recent,
      field: 'themeId'
    }),
    motionProfile: chooseDimension({
      preferred: preferredMotionProfile,
      candidates: motionProfileCandidates,
      recentSelections: recent,
      field: 'motionProfile'
    }),
    geometry: chooseDimension({
      preferred: preferredGeometry,
      candidates: geometryCandidates,
      recentSelections: recent,
      field: 'geometry'
    }),
    metaphor: chooseDimension({
      preferred: preferredMetaphor,
      candidates: metaphorCandidates,
      recentSelections: recent,
      field: 'metaphor'
    }),
    camera: chooseDimension({
      preferred: preferredCamera,
      candidates: cameraCandidates,
      recentSelections: recent,
      field: 'camera'
    })
  };
  const recentWindow = recent.slice(-HISTORY_WINDOW);
  const repeatedDimensions = Object.fromEntries(
    Object.entries(dimensions).map(([field, value]) => [
      field,
      value
        ? recentWindow.filter((item) => item[field] === value).length
        : 0
    ])
  );
  return {
    historyWindow: Math.min(HISTORY_WINDOW, recent.length),
    avoid: {
      artDirections: artDirection.avoided,
      effectIds: [...recentEffectIds],
      dominantDimensions: Object.fromEntries(
        ['themeId', 'motionProfile', 'geometry', 'metaphor', 'camera'].map((field) => {
          const counts = new Map();
          for (const item of recentWindow) {
            if (item[field]) counts.set(item[field], (counts.get(item[field]) || 0) + 1);
          }
          return [
            field,
            [...counts.entries()]
              .filter(([, count]) => count >= 2)
              .map(([value]) => value)
          ];
        })
      )
    },
    selected: {
      patternId,
      artDirection: artDirection.selected,
      effectIds,
      ...dimensions
    },
    repeatedEffects,
    repeatedDimensions,
    reasons: [
      artDirection.reason,
      repeatedEffects.length
        ? `Se conservan ${repeatedEffects.join(', ')} porque construyen la lectura factual.`
        : 'No se repiten efectos dominantes de las cuatro piezas recientes.',
      'Tema, ritmo, geometría, metáfora y cámara se contrastan contra una ventana de seis piezas.'
    ]
  };
}

export const animationArtDirections = ART_DIRECTIONS;
export const animationVarietyHistoryWindow = HISTORY_WINDOW;
