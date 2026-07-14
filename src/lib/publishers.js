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

  const runs = await loadRuns(state);
  const idempotencyKey = String(options.idempotencyKey || '').trim().slice(0, 160) || null;
  const existing = idempotencyKey
    ? runs.find((item) => item.idempotencyKey === idempotencyKey)
    : null;
  if (existing && ['published', 'requires_manual_action'].includes(existing.status)) return existing;
  if (existing?.status === 'failed' && !options.retryFailed) return existing;
  const run = existing ?? {
    id: `publish-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    createdAt: new Date().toISOString(),
    clipId: clip.id,
    asset: clip.files.video,
    idempotencyKey,
    status: 'validating',
    platforms: Object.fromEntries(platforms.map((platform) => [platform, {status: 'pending'}]))
  };
  const nextRuns = existing ? runs : [...runs, run];
  let persistChain = Promise.resolve();
  const persist = () => {
    run.updatedAt = new Date().toISOString();
    persistChain = persistChain.catch(() => {}).then(() => writeJson(path.join(state.jobDir, 'publish-runs.json'), nextRuns));
    return persistChain;
  };
  run.status = 'uploading';
  await persist();

  const settled = await Promise.allSettled(platforms.map(async (platform) => {
    if (['published', 'requires_manual_action'].includes(run.platforms?.[platform]?.status)) {
      return run.platforms[platform];
    }
    run.platforms[platform] = {...run.platforms[platform], platform, status: 'validating'};
    await persist();
    try {
      const connectorOptions = options.connectorOptions?.[platform] ?? {};
      const result = await CONNECTORS[platform]({
        state,
        clip,
        videoFile: clip.files.video,
        metadata,
        options: {
          ...connectorOptions,
          signal: options.signal,
          resumeState: run.platforms[platform]?.remote ?? {},
          onRemoteState: async (patch) => {
            const current = run.platforms[platform] ?? {platform};
            run.platforms[platform] = {
              ...current,
              status: patch.status ?? current.status ?? 'processing',
              phase: patch.phase ?? current.phase,
              remote: {...(current.remote ?? {}), ...(patch.remote ?? patch)}
            };
            await persist();
            await connectorOptions.onRemoteState?.(patch);
          },
          onProgress: async (progress) => {
            run.platforms[platform] = {...run.platforms[platform], platform, status: 'uploading', progress};
            await persist();
            await connectorOptions.onProgress?.(progress);
          }
        }
      });
      run.platforms[platform] = {...result, remote: run.platforms[platform]?.remote};
      await persist();
      return run.platforms[platform];
    } catch (error) {
      if (options.signal?.aborted || error?.name === 'AbortError') {
        run.platforms[platform] = {platform, status: 'failed', error: 'Publicación cancelada.'};
        await persist();
        throw error;
      }
      const result = {platform, status: 'failed', error: error.message};
      run.platforms[platform] = result;
      await persist();
      return result;
    }
  }));
  const results = settled.map((item, index) => item.status === 'fulfilled'
    ? item.value
    : {platform: platforms[index], status: 'failed', error: options.signal?.aborted ? 'Publicación cancelada.' : item.reason?.message});

  run.completedAt = new Date().toISOString();
  run.platforms = Object.fromEntries(results.map((result) => [result.platform, result]));
  run.status = results.every((result) => result.status === 'published')
    ? 'published'
    : results.some((result) => result.status === 'failed')
      ? 'failed'
      : 'requires_manual_action';

  await persist();
  state.publishRuns = nextRuns;
  state.publishStatus = run.status;
  if (options.signal?.aborted) throw options.signal.reason ?? new DOMException('Publicación cancelada.', 'AbortError');
  return run;
}
