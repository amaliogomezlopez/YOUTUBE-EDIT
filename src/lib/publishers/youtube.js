import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {manualResult, missing, validateVideoAsset} from './common.js';
import {refreshYoutubeAccessToken} from '../youtube-oauth.js';
import {postForPlatform} from '../publishing.js';
import {abortableSleep, fetchWithTimeout, retryDelay as networkRetryDelay, throwIfAborted} from '../network.js';

const REQUIRED_ENV = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
const VIDEOS_INSERT_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=resumable';
const CHUNK_GRANULARITY = 256 * 1024;
const DEFAULT_CHUNK_BYTES = 8 * 1024 * 1024;
const DEFAULT_RETRIES = 5;

function youtubeMetadata({metadata, clip, post}) {
  const title = String(post.title || clip?.suggestedTitle || metadata.titles?.youtube_shorts?.[0]?.title || 'Shortsmith upload').slice(0, 100);
  const description = String(post.description || metadata.summary?.youtube_description || metadata.summary?.short || '').slice(0, 5000);
  const tags = (post.tags || []).map((tag) => String(tag).replace(/^#/, '').trim()).filter(Boolean).slice(0, 30);
  const publishAt = post.publishAt || metadata.publishAt || null;
  return {
    snippet: {title, description, tags, categoryId: String(process.env.YOUTUBE_CATEGORY_ID || '22')},
    status: {
      privacyStatus: publishAt ? 'private' : (post.privacy || process.env.YOUTUBE_PRIVACY_STATUS || 'private'),
      ...(publishAt ? {publishAt} : {}),
      selfDeclaredMadeForKids: false
    }
  };
}

function header(response, name) {
  return response.headers?.get?.(name) ?? response.headers?.get?.(name.toLowerCase()) ?? null;
}

function retryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(attempt) {
  return networkRetryDelay(attempt);
}

function sanitizeError(error) {
  return String(error?.message || error || 'Error desconocido')
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/access_token=([^&\s]+)/gi, 'access_token=[redacted]')
    .replace(/upload_id=([^&\s]+)/gi, 'upload_id=[redacted]');
}

async function responsePayload(response) {
  return response.json().catch(() => ({}));
}

async function apiError(response, fallback) {
  const payload = await responsePayload(response);
  const error = new Error(payload.error?.message || payload.error_description || `${fallback} (${response.status})`);
  error.status = response.status;
  error.details = payload.error?.errors?.map((item) => item.reason).filter(Boolean) || [];
  return error;
}

function acknowledgedOffset(response, totalBytes) {
  const value = header(response, 'range');
  if (!value) return 0;
  const match = /bytes\s*=\s*\d+-(\d+)/i.exec(value);
  return match ? Math.min(totalBytes, Number(match[1]) + 1) : 0;
}

function normalizeChunkBytes(value) {
  const chunkBytes = Number(value || DEFAULT_CHUNK_BYTES);
  if (!Number.isSafeInteger(chunkBytes) || chunkBytes < CHUNK_GRANULARITY || chunkBytes % CHUNK_GRANULARITY !== 0) {
    throw new Error(`YOUTUBE_UPLOAD_CHUNK_BYTES debe ser un multiplo de ${CHUNK_GRANULARITY} bytes.`);
  }
  return chunkBytes;
}

async function emitProgress(onProgress, bytesUploaded, totalBytes) {
  if (!onProgress) return;
  try {
    await onProgress({
      platform: 'youtube',
      phase: bytesUploaded >= totalBytes ? 'uploaded' : 'uploading',
      bytesUploaded,
      totalBytes,
      progress: totalBytes ? bytesUploaded / totalBytes : 0,
      percent: totalBytes ? Math.round((bytesUploaded / totalBytes) * 100) : 0
    });
  } catch {
    // Observability must never turn a completed remote upload into a local failure.
  }
}

export async function initiateYoutubeResumableUpload({accessToken, metadata, videoSize, options = {}}) {
  const fetchImpl = options.fetch || fetch;
  const sleep = options.sleep || ((ms) => abortableSleep(ms, options.signal));
  const retries = options.retries ?? DEFAULT_RETRIES;
  const body = JSON.stringify(metadata);
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(options.initUrl || VIDEOS_INSERT_URL, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json; charset=UTF-8',
          'content-length': String(Buffer.byteLength(body)),
          'x-upload-content-length': String(videoSize),
          'x-upload-content-type': 'video/mp4'
        },
        body
      }, {fetchImpl, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
    } catch (error) {
      if (attempt >= retries) throw error;
      await sleep(retryDelay(attempt));
      continue;
    }
    if (response.ok) {
      const uploadUrl = header(response, 'location');
      if (!uploadUrl) throw new Error('YouTube no devolvio la URL de la sesion resumible.');
      return uploadUrl;
    }
    if (!retryableStatus(response.status) || attempt >= retries) {
      throw await apiError(response, 'YouTube resumable upload init failed');
    }
    await response.text().catch(() => '');
    await sleep(retryDelay(attempt));
  }
  throw new Error('No se pudo iniciar la subida resumible de YouTube.');
}

async function queryUploadStatus(uploadUrl, videoSize, options = {}) {
  const response = await fetchWithTimeout(uploadUrl, {
    method: 'PUT',
    headers: {'content-length': '0', 'content-range': `bytes */${videoSize}`}
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
  if (response.status === 308) return {complete: false, offset: acknowledgedOffset(response, videoSize)};
  if (response.ok) return {complete: true, offset: videoSize, payload: await responsePayload(response)};
  throw await apiError(response, 'YouTube upload status query failed');
}

async function putChunk(uploadUrl, videoFile, {start, end, videoSize, options}) {
  const body = createReadStream(videoFile, {start, end});
  try {
    return await fetchWithTimeout(uploadUrl, {
      method: 'PUT',
      headers: {
        'content-type': 'video/mp4',
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${videoSize}`
      },
      body,
      duplex: 'half'
    }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.chunkTimeoutMs ?? 5 * 60_000});
  } finally {
    body.destroy();
  }
}

export async function uploadYoutubeVideo(uploadUrl, videoFile, videoSize, options = {}) {
  if (!Number.isSafeInteger(videoSize) || videoSize <= 0) throw new Error('YouTube requiere un archivo de video no vacio.');
  const fetchImpl = options.fetch || fetch;
  const sleep = options.sleep || ((ms) => abortableSleep(ms, options.signal));
  const retries = options.retries ?? DEFAULT_RETRIES;
  const chunkBytes = normalizeChunkBytes(options.chunkBytes || process.env.YOUTUBE_UPLOAD_CHUNK_BYTES);
  let offset = Math.min(videoSize, Math.max(0, Number(options.startOffset || 0)));
  if (offset > 0) {
    const status = await queryUploadStatus(uploadUrl, videoSize, {...options, fetch: fetchImpl});
    if (status.complete) {
      await emitProgress(options.onProgress, videoSize, videoSize);
      return status.payload;
    }
    offset = status.offset;
  }
  await emitProgress(options.onProgress, offset, videoSize);

  while (offset < videoSize) {
    throwIfAborted(options.signal);
    const end = Math.min(videoSize - 1, offset + chunkBytes - 1);
    let advanced = false;
    for (let attempt = 0; attempt <= retries && !advanced; attempt += 1) {
      let response;
      try {
        response = await putChunk(uploadUrl, videoFile, {start: offset, end, videoSize, options: {...options, fetch: fetchImpl}});
      } catch (error) {
        if (attempt >= retries) throw error;
        await sleep(retryDelay(attempt));
        try {
          const status = await queryUploadStatus(uploadUrl, videoSize, {...options, fetch: fetchImpl});
          if (status.complete) {
            await emitProgress(options.onProgress, videoSize, videoSize);
            return status.payload;
          }
          if (status.offset > offset) {
            offset = status.offset;
            advanced = true;
            await emitProgress(options.onProgress, offset, videoSize);
          }
        } catch (statusError) {
          if (attempt >= retries) throw statusError;
        }
        continue;
      }

      if (response.status === 308) {
        const nextOffset = acknowledgedOffset(response, videoSize);
        if (nextOffset > offset) {
          offset = nextOffset;
          advanced = true;
          await emitProgress(options.onProgress, offset, videoSize);
          continue;
        }
        if (attempt >= retries) throw new Error(`YouTube no confirmo progreso desde el byte ${offset}.`);
        await sleep(retryDelay(attempt));
        continue;
      }
      if (response.ok) {
        const payload = await responsePayload(response);
        await emitProgress(options.onProgress, videoSize, videoSize);
        return payload;
      }
      if (!retryableStatus(response.status) || attempt >= retries) {
        throw await apiError(response, 'YouTube video upload failed');
      }

      await response.text().catch(() => '');
      await sleep(retryDelay(attempt));
      try {
        const status = await queryUploadStatus(uploadUrl, videoSize, {...options, fetch: fetchImpl});
        if (status.complete) {
          await emitProgress(options.onProgress, videoSize, videoSize);
          return status.payload;
        }
        if (status.offset > offset) {
          offset = status.offset;
          advanced = true;
          await emitProgress(options.onProgress, offset, videoSize);
        }
      } catch (statusError) {
        if (attempt >= retries) throw statusError;
      }
    }
  }
  throw new Error('YouTube termino la transferencia sin devolver el recurso de video.');
}

export async function publishToYoutube({videoFile, metadata, clip, options = {}}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) return {platform: 'youtube', status: 'failed', error: assetError};

  const post = postForPlatform(metadata, clip, 'youtube_shorts') ?? metadata.platform_posts?.youtube ?? {};
  const missingEnv = missing(REQUIRED_ENV);
  if (missingEnv.length) {
    return manualResult('youtube', 'Faltan credenciales OAuth de YouTube Data API para subir automaticamente.', {
      missingEnv,
      officialApi: 'YouTube Data API videos.insert',
      asset: videoFile,
      title: post.title || clip?.suggestedTitle || metadata.titles?.youtube_shorts?.[0]?.title,
      description: post.description || metadata.summary?.youtube_description,
      tags: post.tags || []
    });
  }

  const metadataPart = youtubeMetadata({metadata, clip, post});
  try {
    options.signal?.throwIfAborted();
    const token = options.refreshAccessToken
      ? await options.refreshAccessToken(options)
      : await refreshYoutubeAccessToken(undefined, options);
    const videoSize = (await stat(videoFile)).size;
    let uploadUrl = options.resumeState?.uploadUrl;
    if (!uploadUrl) {
      uploadUrl = await (options.initiateUpload || initiateYoutubeResumableUpload)({
        accessToken: token.access_token, metadata: metadataPart, videoSize, options
      });
      await options.onRemoteState?.({status: 'uploading', phase: 'session-created', remote: {uploadUrl, videoSize, bytesUploaded: 0}});
    }
    const uploadOptions = (sessionUrl, startOffset) => ({
      ...options,
      startOffset,
      onProgress: async (progress) => {
        await options.onRemoteState?.({status: 'uploading', phase: progress.phase, remote: {uploadUrl: sessionUrl, videoSize, bytesUploaded: progress.bytesUploaded}});
        await options.onProgress?.(progress);
      }
    });
    let payload;
    try {
      payload = await (options.uploadVideo || uploadYoutubeVideo)(uploadUrl, videoFile, videoSize, uploadOptions(uploadUrl, options.resumeState?.bytesUploaded ?? 0));
    } catch (error) {
      if (!options.resumeState?.uploadUrl || ![404, 410].includes(error.status)) throw error;
      uploadUrl = await (options.initiateUpload || initiateYoutubeResumableUpload)({accessToken: token.access_token, metadata: metadataPart, videoSize, options});
      await options.onRemoteState?.({status: 'uploading', phase: 'session-replaced', remote: {uploadUrl, videoSize, bytesUploaded: 0}});
      payload = await (options.uploadVideo || uploadYoutubeVideo)(uploadUrl, videoFile, videoSize, uploadOptions(uploadUrl, 0));
    }
    if (!payload?.id) throw new Error('YouTube completo la subida sin devolver un videoId.');
    await options.onRemoteState?.({status: 'published', phase: 'published', remote: {uploadUrl, videoSize, bytesUploaded: videoSize, videoId: payload.id}});
    return {
      platform: 'youtube',
      status: 'published',
      officialApi: 'YouTube Data API videos.insert resumable upload',
      asset: videoFile,
      videoId: payload.id,
      url: payload.id ? `https://www.youtube.com/watch?v=${payload.id}` : null,
      privacyStatus: metadataPart.status.privacyStatus,
      publishAt: metadataPart.status.publishAt || null,
      title: metadataPart.snippet.title
    };
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw error;
    return {
      platform: 'youtube',
      status: 'failed',
      officialApi: 'YouTube Data API videos.insert resumable upload',
      asset: videoFile,
      error: sanitizeError(error),
      details: error.details || []
    };
  }
}
