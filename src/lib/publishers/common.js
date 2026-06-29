export const PUBLISH_STATUSES = [
  'pending',
  'validating',
  'uploading',
  'processing',
  'published',
  'failed',
  'requires_manual_action',
  'skipped'
];

export function configured(keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

export function missing(keys) {
  return keys.filter((key) => !process.env[key]);
}

export function manualResult(platform, reason, payload = {}) {
  return {
    platform,
    status: 'requires_manual_action',
    reason,
    ...payload
  };
}

export function validateVideoAsset(videoFile) {
  if (!videoFile) {
    return 'No hay video renderizado para publicar.';
  }
  return null;
}
