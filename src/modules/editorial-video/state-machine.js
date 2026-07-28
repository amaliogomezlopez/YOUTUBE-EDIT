import {validateEpisodeManifest} from './validator.js';

export const EPISODE_STATUSES = Object.freeze([
  'draft',
  'discovering',
  'researching',
  'research-ready',
  'planning-story',
  'awaiting-story-approval',
  'awaiting-narration',
  'transcribing',
  'aligning',
  'planning-visuals',
  'rendering-preview',
  'preview-ready',
  'changes-requested',
  'approved',
  'rendering-final',
  'completed',
  'failed',
  'cancelled'
]);

const ACTIVE_STATUSES = new Set(
  EPISODE_STATUSES.filter(
    (status) => !['completed', 'failed', 'cancelled'].includes(status)
  )
);

const TRANSITIONS = new Map([
  ['draft', new Set(['discovering', 'researching'])],
  ['discovering', new Set(['researching', 'research-ready'])],
  ['researching', new Set(['research-ready'])],
  ['research-ready', new Set(['researching', 'planning-story'])],
  ['planning-story', new Set(['awaiting-story-approval'])],
  [
    'awaiting-story-approval',
    new Set(['changes-requested', 'awaiting-narration'])
  ],
  ['awaiting-narration', new Set(['transcribing'])],
  ['transcribing', new Set(['aligning'])],
  ['aligning', new Set(['changes-requested', 'planning-visuals'])],
  ['planning-visuals', new Set(['rendering-preview'])],
  ['rendering-preview', new Set(['preview-ready'])],
  [
    'preview-ready',
    new Set(['changes-requested', 'rendering-preview', 'approved'])
  ],
  [
    'changes-requested',
    new Set(['planning-story', 'planning-visuals', 'rendering-preview'])
  ],
  ['approved', new Set(['changes-requested', 'rendering-final'])],
  ['rendering-final', new Set(['completed'])],
  ['completed', new Set()],
  ['failed', ACTIVE_STATUSES],
  ['cancelled', ACTIVE_STATUSES]
]);

function transitionError(message, code = 'EDITORIAL_INVALID_TRANSITION') {
  const error = new Error(message);
  error.code = code;
  error.status = 409;
  return error;
}

function readyArtifact(value) {
  return ['ready', 'approved', 'completed'].includes(value?.status);
}

function assertGate(manifest, nextStatus) {
  if (
    nextStatus === 'awaiting-narration' &&
    manifest.story?.approval?.status !== 'approved'
  ) {
    throw transitionError(
      'No se puede esperar narración sin un guion aprobado.',
      'EDITORIAL_STORY_APPROVAL_REQUIRED'
    );
  }
  if (nextStatus === 'rendering-preview') {
    const missing = [
      ['narration', manifest.narration],
      ['transcript', manifest.transcript],
      ['visualPlan', manifest.visualPlan]
    ]
      .filter(([, artifact]) => !readyArtifact(artifact))
      .map(([name]) => name);
    if (missing.length) {
      throw transitionError(
        `No se puede renderizar la preview; faltan artefactos listos: ${missing.join(', ')}.`,
        'EDITORIAL_PREVIEW_INPUTS_REQUIRED'
      );
    }
  }
  if (['approved', 'rendering-final'].includes(nextStatus)) {
    if (
      manifest.review?.qa?.passed !== true ||
      manifest.review?.approval?.status !== 'approved'
    ) {
      throw transitionError(
        'La preview necesita QA superado y aprobación antes del render final.',
        'EDITORIAL_PREVIEW_APPROVAL_REQUIRED'
      );
    }
  }
  if (
    nextStatus === 'completed' &&
    manifest.renders?.final?.status !== 'completed'
  ) {
    throw transitionError(
      'No se puede completar el episodio sin un render final terminado.',
      'EDITORIAL_FINAL_RENDER_REQUIRED'
    );
  }
}

export function assertEpisodeTransition(manifest, nextStatus) {
  validateEpisodeManifest(manifest);
  if (!EPISODE_STATUSES.includes(nextStatus)) {
    throw transitionError(
      `Estado de episodio desconocido: ${nextStatus}`,
      'EDITORIAL_UNKNOWN_STATUS'
    );
  }
  const current = manifest.status;
  if (current === nextStatus) return manifest;
  if (
    nextStatus === 'failed' &&
    current !== 'completed' &&
    current !== 'cancelled'
  ) {
    return manifest;
  }
  if (
    nextStatus === 'cancelled' &&
    current !== 'completed' &&
    current !== 'failed'
  ) {
    return manifest;
  }
  if (!TRANSITIONS.get(current)?.has(nextStatus)) {
    throw transitionError(
      `Transición de episodio no permitida: ${current} -> ${nextStatus}.`
    );
  }
  assertGate(manifest, nextStatus);
  return manifest;
}

export function transitionEpisode(manifest, nextStatus, {progress = {}} = {}) {
  assertEpisodeTransition(manifest, nextStatus);
  const next = structuredClone(manifest);
  next.status = nextStatus;
  next.progress = {
    ...next.progress,
    stage: progress.stage || nextStatus,
    completedUnits:
      progress.completedUnits ?? (nextStatus === 'completed' ? 1 : 0),
    totalUnits: progress.totalUnits ?? 1,
    message: progress.message ?? '',
    attempt: progress.attempt ?? next.progress.attempt,
    retryable:
      progress.retryable ??
      (nextStatus === 'failed' ? true : nextStatus !== 'cancelled')
  };
  validateEpisodeManifest(next);
  return next;
}
