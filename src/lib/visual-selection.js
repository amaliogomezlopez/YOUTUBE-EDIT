import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {chatJson, getLlmConfig, isLlmEnabled} from './llm.js';
import {ROOT} from './utils.js';
import {validateVisualSelection} from './schema-validation.js';

const CATALOG_ROOT = path.join(
  ROOT,
  'remotion-animations',
  'catalog',
  'visuals'
);
const DEFAULT_PREFERENCE_FILE = path.join(
  ROOT,
  'remotion-animations',
  'catalog',
  'preferences',
  'channel-profile.json'
);

const KIND_FILES = {
  icon: 'icons.json',
  drawing: 'drawings.json',
  image: 'images.json'
};

const FALLBACK_ROLE_MAP = [
  {pattern: /\b(datos?|grafica|analitica|rendimiento|metrica|indice|bolsa)\b/, ids: ['chart', 'analytics']},
  {pattern: /\b(credito|banco|prestamo|sloos)\b/, ids: ['bank', 'credit']},
  {pattern: /\b(burbuja|techo|exuberancia)\b/, ids: ['bubble', 'risk']},
  {pattern: /\b(contagio|propagacion|sector)\b/, ids: ['contagion', 'factory']},
  {pattern: /\b(inflacion|tipos|empleo|hogar|consumo)\b/, ids: ['inflation', 'employment', 'household']},
  {pattern: /\b(proceso|pipeline|flujo|etapas?)\b/, ids: ['input', 'tool', 'output']},
  {pattern: /\b(ia|modelo|agente|prompt)\b/, ids: ['agent', 'model', 'prompt']},
  {pattern: /\b(nube|servidor|api|despliegue)\b/, ids: ['server', 'cloud', 'api']},
  {pattern: /\b(riesgo|seguridad|bloqueo)\b/, ids: ['risk', 'shield', 'lock']}
];

const SEMANTIC_ONTOLOGY = [
  {
    id: 'memory-context',
    terms: ['memoria', 'recordar', 'preferencia', 'contexto', 'history', 'remember'],
    expands: ['memory', 'context', 'repository', 'preferences']
  },
  {
    id: 'branch-consolidate',
    terms: ['ramificar', 'subagente', 'paralelo', 'consolidar', 'merge', 'branch'],
    expands: ['branch', 'merge', 'agent', 'parallel', 'consolidation']
  },
  {
    id: 'filter-compress',
    terms: ['filtrar', 'reducir', 'comprimir', 'seleccionar', 'ruido', 'filter'],
    expands: ['filter', 'compression', 'funnel', 'selection', 'noise']
  },
  {
    id: 'market-evidence',
    terms: ['bolsa', 'sp500', 's&p', 'rendimiento', 'mercado', 'grafica', 'índice', 'concentracion'],
    expands: ['analytics', 'chart', 'finance', 'index', 'trend', 'evidence', 'balance']
  },
  {
    id: 'credit-cycle',
    terms: ['credito', 'banco', 'prestamo', 'sloos', 'endurecer', 'hogar'],
    expands: ['bank', 'credit', 'household', 'cycle']
  },
  {
    id: 'bubble-earnings',
    terms: ['burbuja', 'techo', 'exuberancia', 'beneficios', 'earnings'],
    expands: ['bubble', 'chart', 'shield', 'earnings']
  },
  {
    id: 'contagion-path',
    terms: ['contagio', 'propagacion', 'sectores', 'sistémico', 'sistemico'],
    expands: ['contagion', 'factory', 'chart', 'spread']
  },
  {
    id: 'rate-channel',
    terms: ['inflacion', 'tipos', 'empleo', 'transmision', 'fed'],
    expands: ['inflation', 'credit', 'employment', 'rates']
  },
  {
    id: 'process-flow',
    terms: ['proceso', 'flujo', 'pipeline', 'etapa', 'entrada', 'salida'],
    expands: ['input', 'tool', 'output', 'pipeline', 'flow', 'stages']
  },
  {
    id: 'risk-security',
    terms: ['riesgo', 'seguridad', 'bloqueo', 'proteger', 'vulnerable'],
    expands: ['risk', 'shield', 'lock', 'security', 'protection']
  },
  {
    id: 'time-sequence',
    terms: ['tiempo', 'fecha', 'hito', 'cronologia', 'antes', 'despues'],
    expands: ['clock', 'timeline', 'milestone', 'sequence', 'before', 'after']
  }
];

function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(value) {
  return new Set(normalize(value).split(/\s+/).filter((token) => token.length > 1));
}

function trigrams(value) {
  const normalized = `  ${normalize(value)}  `;
  const grams = new Set();
  for (let index = 0; index <= normalized.length - 3; index++) {
    grams.add(normalized.slice(index, index + 3));
  }
  return grams;
}

function trigramSimilarity(left, right) {
  const leftGrams = trigrams(left);
  const rightGrams = trigrams(right);
  if (!leftGrams.size || !rightGrams.size) return 0;
  let intersection = 0;
  for (const gram of leftGrams) if (rightGrams.has(gram)) intersection += 1;
  return (2 * intersection) / (leftGrams.size + rightGrams.size);
}

export function semanticVisualSignals(query) {
  const queryText = normalize(query);
  const queryTokens = tokens(query);
  const concepts = SEMANTIC_ONTOLOGY.filter((concept) =>
    concept.terms.some((term) => {
      const normalizedTerm = normalize(term);
      return queryText.includes(normalizedTerm)
        || [...queryTokens].some((token) =>
          trigramSimilarity(token, normalizedTerm) >= 0.68
        );
    })
  );
  const expandedTerms = [...new Set(
    concepts.flatMap((concept) => concept.expands.map(normalize))
  )];
  return {
    concepts: concepts.map((concept) => concept.id),
    expandedTerms,
    relationshipIntent: concepts.some((concept) =>
      ['branch-consolidate', 'filter-compress', 'process-flow', 'time-sequence', 'credit-cycle', 'contagion-path', 'rate-channel', 'bubble-earnings'].includes(concept.id)
    )
  };
}

async function loadPreferenceProfile(preferenceProfile) {
  if (preferenceProfile === false) return null;
  if (preferenceProfile && typeof preferenceProfile === 'object') {
    return preferenceProfile;
  }
  const named = typeof preferenceProfile === 'string' && preferenceProfile
    ? path.join(
      ROOT,
      'remotion-animations',
      'catalog',
      'preferences',
      `${preferenceProfile}.json`
    )
    : null;
  for (const file of [named, DEFAULT_PREFERENCE_FILE].filter(Boolean)) {
    try {
      return JSON.parse(await readFile(file, 'utf8'));
    } catch {
      continue;
    }
  }
  return null;
}

async function readCatalog(kind) {
  const payload = JSON.parse(
    await readFile(path.join(CATALOG_ROOT, KIND_FILES[kind]), 'utf8')
  );
  const entries = kind === 'icon'
    ? payload.icons
    : kind === 'drawing'
      ? payload.drawings
      : payload.images;
  return entries.map((entry) => ({...entry, kind}));
}

export async function loadVisualCatalog({kind = 'any'} = {}) {
  const kinds = kind === 'any' ? Object.keys(KIND_FILES) : [kind];
  if (kinds.some((candidate) => !KIND_FILES[candidate])) {
    throw new Error(`Tipo visual no válido: ${kind}.`);
  }
  return (await Promise.all(kinds.map(readCatalog))).flat();
}

function preferenceAdjustment(entry, profile, signals) {
  if (!profile) return {score: 0, matches: []};
  let score = 0;
  const matches = [];
  if (profile.acceptedAssetIds?.includes(entry.id)) {
    score += 7;
    matches.push('preference:accepted-asset');
  }
  if (profile.rejectedAssetIds?.includes(entry.id)) {
    score -= 18;
    matches.push('preference:rejected-asset');
  }
  const categoryWeight = Number(profile.categoryWeights?.[entry.category] || 0);
  if (categoryWeight) {
    score += categoryWeight;
    matches.push(`preference:category:${entry.category}`);
  }
  const kindWeight = Number(profile.kindWeights?.[entry.kind] || 0);
  if (kindWeight) {
    score += kindWeight;
    matches.push(`preference:kind:${entry.kind}`);
  }
  if (signals.relationshipIntent && entry.kind === 'drawing') {
    score += Number(profile.relationshipDrawingBoost ?? 2);
    matches.push('preference:relationship-drawing');
  }
  return {score, matches};
}

function scoreEntry(query, entry, signals, profile) {
  const queryText = normalize(query);
  const queryTokens = tokens(query);
  const semanticTokens = new Set([...queryTokens, ...signals.expandedTerms]);
  const label = normalize(entry.label || entry.alt || '');
  const id = normalize(entry.id);
  const tags = (entry.tags || []).map(normalize);
  const category = normalize(entry.category || '');
  const motionVerb = normalize(entry.motionVerb || '');
  let score = 0;
  const matches = [];
  if (queryText === id || queryText === label) {
    score += 20;
    matches.push('exact');
  } else {
    if (queryText.includes(id) || queryText.includes(label)) {
      score += 8;
      matches.push('id-or-label');
    }
    for (const token of semanticTokens) {
      if (tags.some((tag) => tag === token || tag.includes(token))) {
        const semantic = !queryTokens.has(token);
        score += semantic ? 2.6 : 5;
        matches.push(`${semantic ? 'semantic' : 'tag'}:${token}`);
      }
      if (category.includes(token)) {
        score += 2;
        matches.push(`category:${token}`);
      }
      if (motionVerb.includes(token)) {
        score += 3;
        matches.push(`motion:${token}`);
      }
      if (label.includes(token) || id.includes(token)) {
        score += queryTokens.has(token) ? 4 : 2;
        matches.push(`label:${token}`);
      }
    }
    const fuzzy = Math.max(
      trigramSimilarity(queryText, label),
      trigramSimilarity(queryText, id),
      ...tags.map((tag) => trigramSimilarity(queryText, tag))
    );
    if (fuzzy >= 0.42) {
      score += fuzzy * 5;
      matches.push(`fuzzy:${fuzzy.toFixed(2)}`);
    }
  }
  const preference = preferenceAdjustment(entry, profile, signals);
  score += preference.score;
  matches.push(...preference.matches);
  return {
    ...entry,
    score: Math.max(0, Number(score.toFixed(3))),
    matches: [...new Set(matches)]
  };
}

function controlledFallback(query, catalog) {
  const normalized = normalize(query);
  const route = FALLBACK_ROLE_MAP.find(({pattern}) => pattern.test(normalized));
  const availableIds = new Set(
    catalog.filter((entry) => entry.kind === 'icon').map((entry) => entry.id)
  );
  const iconIds = (route?.ids || ['unknown']).filter((id) => availableIds.has(id));
  return {
    kind: 'controlled-composite',
    layout: iconIds.length > 2 ? 'flow' : 'cluster',
    iconIds: iconIds.length ? iconIds.slice(0, 3) : ['unknown'],
    generationPolicy: 'catalog-only-no-freeform-svg',
    recipe: {
      version: 1,
      primitives: iconIds.map((id, index) => ({
        iconId: id,
        role: index === 0 ? 'primary' : 'supporting'
      })),
      connectors: iconIds.length > 1 ? 'semantic-flow' : 'none',
      editable: true
    },
    rationale:
      'No hay coincidencia suficientemente fuerte; se compone un fallback con glifos auditados.'
  };
}

export async function selectVisualAsset(query, {
  kind = 'any',
  limit = 5,
  allowFallback = false,
  useLlm = false,
  llmConfig,
  chatJsonImpl = chatJson,
  preferenceProfile
} = {}) {
  if (!normalize(query)) throw new Error('La consulta visual no puede estar vacía.');
  const [catalog, profile] = await Promise.all([
    loadVisualCatalog({kind}),
    loadPreferenceProfile(preferenceProfile)
  ]);
  const signals = semanticVisualSignals(query);
  const ranked = catalog
    .map((entry) => scoreEntry(query, entry, signals, profile))
    .sort((left, right) =>
      right.score - left.score
      || left.kind.localeCompare(right.kind)
      || left.id.localeCompare(right.id)
    );
  let selected = ranked[0]?.score >= 4 ? ranked[0] : null;
  let mode = selected ? 'deterministic-catalog' : 'no-match';
  if (useLlm) {
    const config = getLlmConfig(llmConfig || {});
    if (isLlmEnabled(config)) {
      const candidates = ranked.slice(0, 20).map(({id, kind: candidateKind, label, tags, motionVerb}) => ({
        id,
        kind: candidateKind,
        label: label || '',
        tags: tags || [],
        motionVerb: motionVerb || ''
      }));
      const response = await chatJsonImpl([
        {
          role: 'system',
          content: 'Selecciona un único asset del catálogo. No inventes IDs ni SVG.'
        },
        {
          role: 'user',
          content: JSON.stringify({query, candidates, output: {kind: '', id: '', rationale: ''}})
        }
      ], {...config, temperature: 0, maxTokens: 500});
      const llmMatch = catalog.find(
        (entry) => entry.id === response?.id && entry.kind === response?.kind
      );
      if (!llmMatch) {
        throw new Error('El selector LLM devolvió un asset fuera del catálogo.');
      }
      selected = {
        ...llmMatch,
        score: ranked.find((entry) =>
          entry.id === llmMatch.id && entry.kind === llmMatch.kind
        )?.score || 0,
        matches: ['llm-catalog-choice'],
        rationale: String(response.rationale || '').slice(0, 240)
      };
      mode = 'llm-catalog-validated';
    }
  }
  const fallback = !selected && allowFallback
    ? controlledFallback(query, catalog)
    : null;
  return validateVisualSelection({
    version: 1,
    query,
    kind,
    mode: fallback ? 'controlled-fallback' : mode,
    selected,
    alternatives: ranked.slice(0, Math.max(1, Math.min(12, limit))),
    fallback,
    semanticSignals: signals,
    preferenceProfile: profile?.id || null
  });
}
