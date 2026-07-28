import path from 'node:path';
import {ROOT} from '../../lib/utils.js';
import {validateJsonSchema} from '../../lib/schema-validation.js';

export const EDITORIAL_VIDEO_SCHEMA_DIR = path.join(
  ROOT,
  'schemas',
  'editorial-video'
);

export const EDITORIAL_VIDEO_SCHEMAS = Object.freeze({
  channelConfig: path.join(
    EDITORIAL_VIDEO_SCHEMA_DIR,
    'channel-config.schema.json'
  ),
  sourceRecord: path.join(
    EDITORIAL_VIDEO_SCHEMA_DIR,
    'source-record.schema.json'
  ),
  researchDossier: path.join(
    EDITORIAL_VIDEO_SCHEMA_DIR,
    'research-dossier.schema.json'
  ),
  storyPackage: path.join(
    EDITORIAL_VIDEO_SCHEMA_DIR,
    'story-package.schema.json'
  ),
  episodeManifest: path.join(
    EDITORIAL_VIDEO_SCHEMA_DIR,
    'episode-manifest.schema.json'
  ),
  visualPlan: path.join(
    EDITORIAL_VIDEO_SCHEMA_DIR,
    'visual-plan.schema.json'
  )
});

function semanticError(label, details) {
  const error = new Error(`${label} no cumple sus reglas: ${details}`);
  error.code = 'EDITORIAL_SCHEMA_INVALID';
  error.status = 400;
  return error;
}

function assertUniqueIds(items, label, pathName) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) {
      throw semanticError(label, `${pathName} contiene el ID duplicado "${item.id}"`);
    }
    ids.add(item.id);
  }
  return ids;
}

function assertKnownRefs(refs, knownIds, label, pathName) {
  for (const ref of refs) {
    if (!knownIds.has(ref)) {
      throw semanticError(label, `${pathName} contiene el ID desconocido "${ref}"`);
    }
  }
}

export function validateChannelConfig(config) {
  validateJsonSchema(config, {
    schemaFile: EDITORIAL_VIDEO_SCHEMAS.channelConfig,
    label: 'Configuración del canal editorial'
  });
  if (config.episode.targetMinutes.min > config.episode.targetMinutes.max) {
    throw semanticError(
      'Configuración del canal editorial',
      '/episode/targetMinutes min no puede superar max'
    );
  }
  if (config.episode.sourceCount.min > config.episode.sourceCount.max) {
    throw semanticError(
      'Configuración del canal editorial',
      '/episode/sourceCount min no puede superar max'
    );
  }
  if (
    config.research.minimumIndependentSources >
    config.episode.sourceCount.max
  ) {
    throw semanticError(
      'Configuración del canal editorial',
      '/research/minimumIndependentSources no puede superar /episode/sourceCount/max'
    );
  }
  return config;
}

export function validateSourceRecord(record) {
  validateJsonSchema(record, {
    schemaFile: EDITORIAL_VIDEO_SCHEMAS.sourceRecord,
    label: 'Registro de fuente editorial'
  });
  if (record.status === 'ready' && !record.publishedAt) {
    throw semanticError(
      'Registro de fuente editorial',
      '/publishedAt es obligatorio cuando /status es ready'
    );
  }
  return record;
}

export function validateResearchDossier(
  dossier,
  {requireNumericDataRef = false} = {}
) {
  validateJsonSchema(dossier, {
    schemaFile: EDITORIAL_VIDEO_SCHEMAS.researchDossier,
    label: 'Dossier de investigación'
  });
  const sourceIds = assertUniqueIds(
    dossier.sources,
    'Dossier de investigación',
    '/sources'
  );
  const dataIds = assertUniqueIds(
    dossier.dataAssets,
    'Dossier de investigación',
    '/dataAssets'
  );
  const claimIds = assertUniqueIds(
    dossier.claims,
    'Dossier de investigación',
    '/claims'
  );
  assertKnownRefs(
    dossier.selectedCluster.sourceRefs,
    sourceIds,
    'Dossier de investigación',
    '/selectedCluster/sourceRefs'
  );
  for (const claim of dossier.claims) {
    assertKnownRefs(
      claim.sourceRefs,
      sourceIds,
      'Dossier de investigación',
      `/claims/${claim.id}/sourceRefs`
    );
    assertKnownRefs(
      claim.dataRefs,
      dataIds,
      'Dossier de investigación',
      `/claims/${claim.id}/dataRefs`
    );
    if (
      requireNumericDataRef &&
      claim.type === 'numeric' &&
      claim.status !== 'unsupported' &&
      claim.dataRefs.length === 0
    ) {
      throw semanticError(
        'Dossier de investigación',
        `/claims/${claim.id}/dataRefs necesita evidencia numérica`
      );
    }
  }
  for (const contradiction of dossier.contradictions) {
    assertKnownRefs(
      contradiction.claimRefs,
      claimIds,
      'Dossier de investigación',
      `/contradictions/${contradiction.id}/claimRefs`
    );
  }
  for (const event of dossier.timeline) {
    assertKnownRefs(
      event.claimRefs,
      claimIds,
      'Dossier de investigación',
      '/timeline/claimRefs'
    );
    assertKnownRefs(
      event.sourceRefs,
      sourceIds,
      'Dossier de investigación',
      '/timeline/sourceRefs'
    );
  }
  return dossier;
}

export function validateStoryPackage(story, {dossier = null} = {}) {
  validateJsonSchema(story, {
    schemaFile: EDITORIAL_VIDEO_SCHEMAS.storyPackage,
    label: 'Paquete narrativo'
  });
  const beatIds = assertUniqueIds(
    story.beats,
    'Paquete narrativo',
    '/beats'
  );
  const sectionIds = assertUniqueIds(
    story.scriptSections,
    'Paquete narrativo',
    '/scriptSections'
  );
  if (!beatIds.size || !sectionIds.size) {
    throw semanticError(
      'Paquete narrativo',
      'debe contener beats y secciones'
    );
  }
  const declaredClaimIds = new Set(story.claimRefs);
  const declaredSourceIds = new Set(story.sourceRefs);
  for (const beat of story.beats) {
    assertKnownRefs(
      beat.claimRefs,
      declaredClaimIds,
      'Paquete narrativo',
      `/beats/${beat.id}/claimRefs`
    );
  }
  for (const section of story.scriptSections) {
    assertKnownRefs(
      section.claimRefs,
      declaredClaimIds,
      'Paquete narrativo',
      `/scriptSections/${section.id}/claimRefs`
    );
    assertKnownRefs(
      section.sourceRefs,
      declaredSourceIds,
      'Paquete narrativo',
      `/scriptSections/${section.id}/sourceRefs`
    );
  }
  if (dossier) {
    validateResearchDossier(dossier);
    const claimById = new Map(dossier.claims.map((claim) => [claim.id, claim]));
    const sourceIds = new Set(dossier.sources.map((source) => source.id));
    assertKnownRefs(
      story.claimRefs,
      new Set(claimById.keys()),
      'Paquete narrativo',
      '/claimRefs'
    );
    assertKnownRefs(
      story.sourceRefs,
      sourceIds,
      'Paquete narrativo',
      '/sourceRefs'
    );
    for (const ref of story.claimRefs) {
      if (claimById.get(ref).status === 'unsupported') {
        throw semanticError(
          'Paquete narrativo',
          `/claimRefs no puede incluir el claim bloqueado "${ref}"`
        );
      }
    }
  }
  return story;
}

export function validateEpisodeManifest(manifest) {
  validateJsonSchema(manifest, {
    schemaFile: EDITORIAL_VIDEO_SCHEMAS.episodeManifest,
    label: 'Manifest del episodio'
  });
  if (manifest.progress.completedUnits > manifest.progress.totalUnits) {
    throw semanticError(
      'Manifest del episodio',
      '/progress/completedUnits no puede superar /progress/totalUnits'
    );
  }
  if (Date.parse(manifest.updatedAt) < Date.parse(manifest.createdAt)) {
    throw semanticError(
      'Manifest del episodio',
      '/updatedAt no puede ser anterior a /createdAt'
    );
  }
  return manifest;
}

export function validateVisualPlan(plan) {
  validateJsonSchema(plan, {
    schemaFile: EDITORIAL_VIDEO_SCHEMAS.visualPlan,
    label: 'Plan visual'
  });
  assertUniqueIds(plan.scenes, 'Plan visual', '/scenes');
  let previousEnd = 0;
  for (const scene of [...plan.scenes].sort((a, b) => a.order - b.order)) {
    if (scene.endSeconds <= scene.startSeconds) {
      throw semanticError(
        'Plan visual',
        `/scenes/${scene.id} debe tener duración positiva`
      );
    }
    if (scene.startSeconds < previousEnd) {
      throw semanticError(
        'Plan visual',
        `/scenes/${scene.id} se solapa con la escena anterior`
      );
    }
    if (scene.endSeconds > plan.audioDurationSeconds) {
      throw semanticError(
        'Plan visual',
        `/scenes/${scene.id}/endSeconds supera la duración del audio`
      );
    }
    if (scene.wordRange.endIndex < scene.wordRange.startIndex) {
      throw semanticError(
        'Plan visual',
        `/scenes/${scene.id}/wordRange no está ordenado`
      );
    }
    previousEnd = scene.endSeconds;
  }
  return plan;
}
