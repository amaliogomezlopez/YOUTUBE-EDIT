import path from 'node:path';
import {readdir} from 'node:fs/promises';
import {JOBS_DIR, readJson, writeJson} from './utils.js';
import {normalizeHashtags} from './publishing.js';

const MAX_TEXT = 12_000;

function text(value, max = MAX_TEXT) {
  return String(value ?? '').replace(/\r\n/g, '\n').trim().slice(0, max);
}

function timestampLines(value) {
  const lines = (Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/))
    .map((line) => text(line, 180))
    .filter(Boolean)
    .slice(0, 80);
  if (lines.length && !/^00:00(?::00)?\s/.test(lines[0])) {
    throw new Error('El primer timestamp debe empezar en 00:00.');
  }
  return lines;
}

export function mergePublishingEdits(current = {}, edits = {}) {
  const next = {
    ...current,
    summary: {...(current.summary ?? {})},
    platform_posts: {...(current.platform_posts ?? {})}
  };
  if (edits.summary && typeof edits.summary === 'object') {
    for (const key of ['short', 'medium', 'youtube_description']) {
      if (key in edits.summary) next.summary[key] = text(edits.summary[key]);
    }
  }
  if ('hashtags' in edits) next.hashtags = normalizeHashtags(text(edits.hashtags, 800));
  if ('timestamps' in edits) next.timestamps = timestampLines(edits.timestamps);
  if (edits.platform_posts && typeof edits.platform_posts === 'object') {
    const fieldByPlatform = {youtube: 'description', youtube_shorts: 'description', instagram: 'caption', tiktok: 'caption', x: 'text'};
    for (const [platform, field] of Object.entries(fieldByPlatform)) {
      if (edits.platform_posts[platform] && field in edits.platform_posts[platform]) {
        next.platform_posts[platform] = {
          ...(current.platform_posts?.[platform] ?? {}),
          [field]: text(edits.platform_posts[platform][field], platform === 'x' ? 280 : MAX_TEXT)
        };
      }
    }
  }
  return next;
}

export function mergeClipPublishingEdits(current = {}, edits = {}) {
  const next = {...current};
  if ('title' in edits) next.title = text(edits.title, 100);
  if ('hashtags' in edits) next.hashtags = normalizeHashtags(text(edits.hashtags, 800));
  for (const platform of ['youtube_shorts', 'instagram', 'tiktok', 'x']) {
    const field = platform === 'x' ? 'text' : platform === 'youtube_shorts' ? 'description' : 'caption';
    if (edits[platform] && field in edits[platform]) {
      next[platform] = {
        ...(current[platform] ?? {}),
        [field]: text(edits[platform][field], platform === 'x' ? 280 : MAX_TEXT)
      };
    }
  }
  return next;
}

export function jobSummary(state) {
  return {
    id: state.id,
    status: state.status,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt ?? null,
    sourceName: state.sourceVideo ? path.basename(state.sourceVideo) : 'Video',
    duration: state.media?.duration ?? null,
    clipsReady: (state.clips ?? []).filter((clip) => clip.files?.video).length,
    warnings: (state.warnings ?? []).length,
    publishStatus: state.publishStatus ?? null
  };
}

export async function listJobSummaries(limit = 30) {
  const entries = await readdir(JOBS_DIR, {withFileTypes: true}).catch(() => []);
  const rows = await Promise.all(entries.filter((entry) => entry.isDirectory()).map(async (entry) => {
    try {
      return jobSummary(await readJson(path.join(JOBS_DIR, entry.name, 'job.json')));
    } catch {
      return null;
    }
  }));
  return rows.filter(Boolean).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, limit);
}

export async function saveMetadataEdits(state, body = {}) {
  state.publishingMetadata = mergePublishingEdits(state.publishingMetadata ?? {}, body.metadata ?? {});
  if (body.clipId && body.clipPublishing) {
    const clip = (state.clips ?? []).find((item) => item.id === body.clipId);
    if (!clip) throw new Error('No se encontró el clip seleccionado.');
    clip.publishing = mergeClipPublishingEdits(clip.publishing ?? {}, body.clipPublishing);
    if (clip.files?.metadata) await writeJson(clip.files.metadata, clip);
  }
  await writeJson(path.join(state.jobDir, 'publishing-metadata.json'), state.publishingMetadata);
  await writeJson(path.join(state.jobDir, 'job.json'), state);
  return state;
}

function publicQueueJob(job) {
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    priority: job.priority,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    runAfter: job.runAfter,
    recoveredAt: job.recoveredAt,
    recoveryCount: job.recoveryCount,
    error: job.error ? {name: job.error.name, message: job.error.message, code: job.error.code} : null
  };
}

function publicRemote(remote = {}) {
  const allowed = ['videoSize', 'bytesUploaded', 'videoId', 'publishId', 'postIds', 'tiktokStatus', 'containerId', 'mediaId', 'permalink', 'postId', 'uploadMode', 'phase'];
  return Object.fromEntries(allowed.filter((key) => remote[key] !== undefined).map((key) => [key, remote[key]]));
}

function publicPublishRun(run) {
  return {
    id: run.id,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
    clipId: run.clipId,
    status: run.status,
    platforms: Object.fromEntries(Object.entries(run.platforms ?? {}).map(([platform, result]) => [platform, {
      ...result,
      asset: undefined,
      videoUrl: undefined,
      remote: publicRemote(result.remote)
    }]))
  };
}

export function publicJobState(state, {queue = null, publishQueue = null, renderQueues = new Map()} = {}) {
  return {
    id: state.id,
    status: state.status,
    createdAt: state.createdAt,
    updatedAt: state.updatedAt,
    completedAt: state.completedAt,
    cancelledAt: state.cancelledAt,
    elapsedSeconds: state.elapsedSeconds,
    sourceName: state.sourceVideo ? path.basename(state.sourceVideo) : 'Video',
    media: state.media,
    transcript: state.transcript,
    renderMode: state.renderMode,
    webcamBox: state.webcamBox,
    warnings: state.warnings ?? [],
    error: state.error ? {message: state.error.message} : null,
    publishingMetadata: state.publishingMetadata,
    publishStatus: state.publishStatus,
    publishRuns: (state.publishRuns ?? []).map(publicPublishRun),
    metrics: state.metrics ?? [],
    queue: publicQueueJob(queue),
    publishQueue: publicQueueJob(publishQueue),
    clips: (state.clips ?? []).map((clip) => ({
      ...clip,
      files: {
        video: Boolean(clip.files?.video),
        subtitles: Boolean(clip.files?.subtitles),
        metadata: Boolean(clip.files?.metadata)
      },
      renderQueue: publicQueueJob(renderQueues.get(clip.renderQueueId)),
      renderError: clip.renderError ? String(clip.renderError).slice(0, 500) : null
    }))
  };
}

export {publicQueueJob};
