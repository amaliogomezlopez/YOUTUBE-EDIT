import path from 'node:path';
import {readJson, writeJson} from './utils.js';
import {publishToInstagram} from './publishers/instagram.js';
import {publishToTiktok} from './publishers/tiktok.js';
import {publishToX} from './publishers/x.js';
import {publishToYoutube} from './publishers/youtube.js';

const CONNECTORS = {
  youtube: publishToYoutube,
  instagram: publishToInstagram,
  tiktok: publishToTiktok,
  x: publishToX
};

export const DEFAULT_PLATFORMS = Object.freeze(['youtube', 'instagram', 'tiktok', 'x']);

function normalizePlatforms(platforms = DEFAULT_PLATFORMS) {
  const selected = Array.isArray(platforms) ? platforms : DEFAULT_PLATFORMS;
  return selected.filter((platform, index) => (
    CONNECTORS[platform] && selected.indexOf(platform) === index
  ));
}

function findClip(state, clipId) {
  const readyClips = (state.clips ?? []).filter((clip) => clip.files?.video);
  if (!readyClips.length) {
    throw new Error('No hay clips renderizados para publicar.');
  }
  if (!clipId) return readyClips[0];
  const clip = readyClips.find((item) => item.id === clipId);
  if (!clip) {
    throw new Error(`Clip no encontrado o no renderizado: ${clipId}`);
  }
  return clip;
}

async function loadRuns(state) {
  try {
    return await readJson(path.join(state.jobDir, 'publish-runs.json'));
  } catch {
    return [];
  }
}

export async function publishJob(state, options = {}) {
  const metadata = state.publishingMetadata;
  if (!metadata) {
    throw new Error('La metadata de publicacion todavia no esta lista.');
  }
  const clip = findClip(state, options.clipId);
  const platforms = normalizePlatforms(options.platforms);
  if (!platforms.length) {
    throw new Error('No hay plataformas validas seleccionadas.');
  }

  const run = {
    id: `publish-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    createdAt: new Date().toISOString(),
    clipId: clip.id,
    asset: clip.files.video,
    status: 'validating',
    platforms: Object.fromEntries(platforms.map((platform) => [platform, {status: 'pending'}]))
  };
  const runs = await loadRuns(state);
  await writeJson(path.join(state.jobDir, 'publish-runs.json'), [...runs, run]);

  const results = await Promise.all(platforms.map(async (platform) => {
    try {
      return await CONNECTORS[platform]({state, clip, videoFile: clip.files.video, metadata});
    } catch (error) {
      return {platform, status: 'failed', error: error.message};
    }
  }));

  run.completedAt = new Date().toISOString();
  run.platforms = Object.fromEntries(results.map((result) => [result.platform, result]));
  run.status = results.every((result) => result.status === 'published')
    ? 'published'
    : results.some((result) => result.status === 'failed')
      ? 'failed'
      : 'requires_manual_action';

  const nextRuns = [...runs, run];
  await writeJson(path.join(state.jobDir, 'publish-runs.json'), nextRuns);
  state.publishRuns = nextRuns;
  state.publishStatus = run.status;
  return run;
}
