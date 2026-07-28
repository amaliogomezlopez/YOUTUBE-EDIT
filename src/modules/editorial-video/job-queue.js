import path from 'node:path';
import {PersistentJobQueue} from '../../lib/job-queue.js';
import {assertChannelId} from './channel-registry.js';
import {
  EDITORIAL_CHANNEL_DATA_ROOT,
  assertEpisodeId
} from './repository.js';

export const EDITORIAL_JOB_STAGES = Object.freeze([
  'discover',
  'research',
  'story',
  'transcribe',
  'align',
  'visual-plan',
  'render-preview',
  'render-final',
  'publishing-package'
]);

const PAYLOAD_KEYS = new Set([
  'channelId',
  'episodeId',
  'stage',
  'inputRevision'
]);

export function validateEditorialJobPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('El payload del job editorial debe ser un objeto.');
  }
  for (const key of Object.keys(payload)) {
    if (!PAYLOAD_KEYS.has(key)) {
      const error = new Error(
        `Campo no permitido en el job editorial: ${key}`
      );
      error.code = 'INVALID_EDITORIAL_JOB_PAYLOAD';
      error.status = 400;
      throw error;
    }
  }
  const normalized = {
    channelId: assertChannelId(payload.channelId),
    episodeId: assertEpisodeId(payload.episodeId),
    stage: String(payload.stage || ''),
    inputRevision: Number(payload.inputRevision)
  };
  if (!EDITORIAL_JOB_STAGES.includes(normalized.stage)) {
    const error = new Error(
      `Etapa de job editorial no válida: ${normalized.stage || '(vacía)'}`
    );
    error.code = 'INVALID_EDITORIAL_JOB_STAGE';
    error.status = 400;
    throw error;
  }
  if (
    !Number.isInteger(normalized.inputRevision) ||
    normalized.inputRevision < 1
  ) {
    const error = new Error(
      'inputRevision debe ser un entero positivo.'
    );
    error.code = 'INVALID_EDITORIAL_JOB_REVISION';
    error.status = 400;
    throw error;
  }
  return normalized;
}

export function editorialJobQueueFile(
  root = EDITORIAL_CHANNEL_DATA_ROOT
) {
  return path.join(path.resolve(root), '.jobs', 'stage-queue.json');
}

export function createEditorialJobQueue({
  root = EDITORIAL_CHANNEL_DATA_ROOT,
  file = editorialJobQueueFile(root),
  handler,
  concurrency = 1,
  autoStart = true,
  retryDelayMs = 0
} = {}) {
  if (typeof handler !== 'function') {
    throw new Error('La cola editorial necesita un handler.');
  }
  return new PersistentJobQueue({
    file,
    concurrency,
    autoStart,
    retryDelayMs,
    handler: (payload, context) =>
      handler(validateEditorialJobPayload(payload), context)
  });
}

export function enqueueEditorialStage(queue, payload, options = {}) {
  return queue.enqueue(validateEditorialJobPayload(payload), options);
}

export function editorialJobPublicDto(job) {
  if (!job) return null;
  return {
    id: job.id,
    channelId: job.payload?.channelId,
    episodeId: job.payload?.episodeId,
    stage: job.payload?.stage,
    inputRevision: job.payload?.inputRevision,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    retryable:
      job.status === 'failed' || job.status === 'cancelled',
    error: job.error?.code ? {code: job.error.code} : null
  };
}
