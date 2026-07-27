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

const KIND_FILES = {
  icon: 'icons.json',
  drawing: 'drawings.json',
  image: 'images.json'
};

const FALLBACK_ROLE_MAP = [
  {pattern: /\b(datos?|grafica|analitica|rendimiento|metrica)\b/, ids: ['analytics', 'search']},
  {pattern: /\b(proceso|pipeline|flujo|etapas?)\b/, ids: ['input', 'tool', 'output']},
  {pattern: /\b(ia|modelo|agente|prompt)\b/, ids: ['agent', 'model', 'prompt']},
  {pattern: /\b(nube|servidor|api|despliegue)\b/, ids: ['server', 'cloud', 'api']},
  {pattern: /\b(riesgo|seguridad|bloqueo)\b/, ids: ['risk', 'shield', 'lock']}
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

function scoreEntry(query, entry) {
  const queryText = normalize(query);
  const queryTokens = tokens(query);
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
    for (const token of queryTokens) {
      if (tags.some((tag) => tag === token || tag.includes(token))) {
        score += 5;
        matches.push(`tag:${token}`);
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
        score += 4;
        matches.push(`label:${token}`);
      }
    }
  }
  return {...entry, score, matches: [...new Set(matches)]};
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
  chatJsonImpl = chatJson
} = {}) {
  if (!normalize(query)) throw new Error('La consulta visual no puede estar vacía.');
  const catalog = await loadVisualCatalog({kind});
  const ranked = catalog
    .map((entry) => scoreEntry(query, entry))
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
    fallback
  });
}
