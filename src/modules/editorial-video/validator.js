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
  )
});

function semanticError(label, details) {
  const error = new Error(`${label} no cumple sus reglas: ${details}`);
  error.code = 'EDITORIAL_SCHEMA_INVALID';
  error.status = 400;
  return error;
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
