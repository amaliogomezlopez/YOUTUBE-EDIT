import {open, stat} from 'node:fs/promises';
import {manualResult, missing, validateVideoAsset} from './common.js';
import {postForPlatform} from '../publishing.js';
import {abortableSleep, fetchWithTimeout, throwIfAborted} from '../network.js';

const REQUIRED_ENV = ['TIKTOK_ACCESS_TOKEN'];
const TIKTOK_INBOX_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';
const TIKTOK_STATUS_URL = 'https://open.tiktokapis.com/v2/post/publish/status/fetch/';
const TIKTOK_MAX_SINGLE_CHUNK_BYTES = 64_000_000;
const TIKTOK_MULTI_CHUNK_BYTES = 32_000_000;
const TIKTOK_UPLOAD_RETRIES = 3;
const TIKTOK_STATUS_TIMEOUT_MS = 30_000;
const TIKTOK_STATUS_INITIAL_DELAY_MS = 2_000;
const TIKTOK_STATUS_REQUEST_TIMEOUT_MS = 15_000;

const STATUS_MAP = Object.freeze({
  PROCESSING_UPLOAD: {status: 'processing', terminal: false},
  PROCESSING_DOWNLOAD: {status: 'processing', terminal: false},
  SEND_TO_USER_INBOX: {status: 'requires_manual_action', terminal: true},
  PUBLISH_COMPLETE: {status: 'published', terminal: true},
  FAILED: {status: 'failed', terminal: true}
});

class TikTokStatusApiError extends Error {
  constructor(message, {status = 0, code = '', retryable = false} = {}) {
    super(message);
    this.name = 'TikTokStatusApiError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

function abortError(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error('TikTok status polling cancelled');
  error.name = 'AbortError';
  return error;
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(abortError(signal));
    };
    timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, {once: true});
  });
}

async function initInboxUpload({accessToken, videoSize, chunkSize = videoSize, totalChunkCount = 1, postInfo = {}, signal, fetchImpl = fetch, requestTimeoutMs = 30_000}) {
  const response = await fetchWithTimeout(TIKTOK_INBOX_INIT_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      post_info: {
        privacy_level: 'SELF_ONLY',
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        ...postInfo
      },
      source_info: {
        source: 'FILE_UPLOAD',
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount
      }
    })
  }, {fetchImpl, signal, timeoutMs: requestTimeoutMs});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error?.code) {
    throw new Error(payload.error?.message || payload.error_description || `TikTok inbox init failed with ${response.status}`);
  }
  return payload;
}

export function mapTikTokPostStatus(data = {}) {
  const tiktokStatus = String(data.status || '').toUpperCase();
  const mapped = STATUS_MAP[tiktokStatus];
  if (!mapped) {
    throw new Error(`TikTok devolvio un estado de publicacion desconocido: ${tiktokStatus || '(vacio)'}.`);
  }
  const numericOrNull = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  return {
    ...mapped,
    tiktokStatus,
    failReason: data.fail_reason || null,
    postIds: Array.isArray(data.publicaly_available_post_id) ? data.publicaly_available_post_id.map(String) : [],
    uploadedBytes: numericOrNull(data.uploaded_bytes),
    downloadedBytes: numericOrNull(data.downloaded_bytes)
  };
}

export async function fetchTikTokPostStatus({
  accessToken,
  publishId,
  fetchImpl = fetch,
  signal,
  requestTimeoutMs = TIKTOK_STATUS_REQUEST_TIMEOUT_MS
} = {}) {
  if (!accessToken) throw new Error('TikTok status requiere accessToken.');
  if (!publishId) throw new Error('TikTok status requiere publishId.');
  signal?.throwIfAborted();
  const timeoutSignal = AbortSignal.timeout(Math.max(1, Number(requestTimeoutMs) || TIKTOK_STATUS_REQUEST_TIMEOUT_MS));
  const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  let response;
  try {
    response = await fetchImpl(TIKTOK_STATUS_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify({publish_id: publishId}),
      signal: requestSignal
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    if (timeoutSignal.aborted) {
      throw new TikTokStatusApiError('TikTok status request timed out', {retryable: true});
    }
    if (error?.name === 'AbortError') throw error;
    throw new TikTokStatusApiError(`TikTok status network error: ${error.message}`, {retryable: true});
  }
  const payload = await response.json().catch(() => ({}));
  const code = payload.error?.code || '';
  if (!response.ok || (code && code !== 'ok')) {
    const retryable = response.status === 429 || response.status >= 500 || ['internal_error', 'rate_limit_exceeded'].includes(code);
    throw new TikTokStatusApiError(
      payload.error?.message || payload.error_description || `TikTok status failed with ${response.status}`,
      {status: response.status, code, retryable}
    );
  }
  return payload.data ?? {};
}

export async function pollTikTokPostStatus({
  accessToken,
  publishId,
  fetchImpl = fetch,
  fetchStatus = fetchTikTokPostStatus,
  signal,
  timeoutMs = TIKTOK_STATUS_TIMEOUT_MS,
  initialDelayMs = TIKTOK_STATUS_INITIAL_DELAY_MS,
  maxDelayMs = 10_000,
  backoffFactor = 1.6,
  requestTimeoutMs = TIKTOK_STATUS_REQUEST_TIMEOUT_MS,
  sleep = wait,
  now = Date.now
} = {}) {
  const startedAt = now();
  const timeout = Math.max(0, Number(timeoutMs) || 0);
  let delay = Math.max(0, Number(initialDelayMs) || 0);
  let polls = 0;
  let lastResult = null;
  let lastError = null;
  while (true) {
    signal?.throwIfAborted();
    polls += 1;
    try {
      const elapsedBeforeRequest = now() - startedAt;
      const remainingForRequest = Math.max(1, timeout - elapsedBeforeRequest);
      const data = await fetchStatus({
        accessToken,
        publishId,
        fetchImpl,
        signal,
        requestTimeoutMs: Math.min(requestTimeoutMs, remainingForRequest)
      });
      lastResult = mapTikTokPostStatus(data);
      lastError = null;
      if (lastResult.terminal) return {...lastResult, polls, timedOut: false};
    } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      if (!error.retryable) throw error;
      lastError = error;
    }
    const elapsed = now() - startedAt;
    if (elapsed >= timeout) {
      return {
        ...(lastResult ?? {status: 'processing', terminal: false, tiktokStatus: 'UNKNOWN'}),
        polls,
        timedOut: true,
        pollingError: lastError?.message ?? null
      };
    }
    const remaining = timeout - elapsed;
    await sleep(Math.min(delay, remaining), signal);
    delay = Math.min(maxDelayMs, Math.max(1, delay * backoffFactor));
  }
}

export function planTikTokUpload(videoSize) {
  if (!Number.isSafeInteger(videoSize) || videoSize <= 0) {
    throw new Error('TikTok requiere un archivo de video no vacio.');
  }
  if (videoSize <= TIKTOK_MAX_SINGLE_CHUNK_BYTES) {
    return {chunkSize: videoSize, totalChunkCount: 1};
  }
  return {
    chunkSize: TIKTOK_MULTI_CHUNK_BYTES,
    totalChunkCount: Math.floor(videoSize / TIKTOK_MULTI_CHUNK_BYTES)
  };
}

async function putVideoChunk(uploadUrl, body, {start, end, videoSize, fetchImpl, retries, sleep, signal, requestTimeoutMs}) {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    let response;
    try {
      response = await fetchWithTimeout(uploadUrl, {
        method: 'PUT',
        headers: {
          'content-type': 'video/mp4',
          'content-length': String(body.length),
          'content-range': `bytes ${start}-${end}/${videoSize}`
        },
        body
      }, {fetchImpl, signal, timeoutMs: requestTimeoutMs ?? 5 * 60_000});
    } catch (error) {
      if (attempt === retries) throw error;
      await sleep(2 ** (attempt - 1) * 500);
      continue;
    }
    if (response.ok) return;
    const text = await response.text().catch(() => '');
    if (response.status < 500 || attempt === retries) {
      throw new Error(text || `TikTok video upload failed with ${response.status}`);
    }
    await sleep(2 ** (attempt - 1) * 500);
  }
}

export async function uploadVideoFile(uploadUrl, videoFile, videoSize, options = {}) {
  const plan = options.plan || planTikTokUpload(videoSize);
  const fetchImpl = options.fetch || fetch;
  const retries = options.retries ?? TIKTOK_UPLOAD_RETRIES;
  const sleep = options.sleep || ((ms) => abortableSleep(ms, options.signal));
  const file = await open(videoFile, 'r');
  try {
    let offset = Math.max(0, Number(options.startOffset || 0));
    let index = Math.floor(offset / plan.chunkSize);
    for (; index < plan.totalChunkCount; index += 1) {
      throwIfAborted(options.signal);
      const isLast = index === plan.totalChunkCount - 1;
      const length = isLast ? videoSize - offset : plan.chunkSize;
      const buffer = Buffer.allocUnsafe(length);
      const {bytesRead} = await file.read(buffer, 0, length, offset);
      if (bytesRead !== length) {
        throw new Error(`TikTok no pudo leer el chunk ${index + 1}/${plan.totalChunkCount} completo.`);
      }
      await putVideoChunk(uploadUrl, buffer, {
        start: offset,
        end: offset + bytesRead - 1,
        videoSize,
        fetchImpl,
        retries,
        sleep,
        signal: options.signal,
        requestTimeoutMs: options.chunkTimeoutMs
      });
      offset += bytesRead;
      await options.onProgress?.({platform: 'tiktok', phase: offset >= videoSize ? 'uploaded' : 'uploading', bytesUploaded: offset, totalBytes: videoSize, percent: Math.round(offset / videoSize * 100)});
    }
    if (offset !== videoSize) {
      throw new Error(`TikTok upload incompleto: ${offset}/${videoSize} bytes leidos.`);
    }
  } finally {
    await file.close();
  }
}

export async function publishToTiktok({videoFile, metadata, clip, options = {}}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'tiktok', status: 'failed', error: assetError};
  }

  const post = postForPlatform(metadata, clip, 'tiktok');
  const missingEnv = missing(REQUIRED_ENV);
  if (missingEnv.length) {
    return manualResult('tiktok', 'Faltan credenciales de TikTok Content Posting API y scopes de publicacion.', {
      missingEnv,
      officialApi: 'TikTok Content Posting API',
      asset: videoFile,
      caption: post.caption || metadata.summary?.short
    });
  }

  const initUpload = options.initUpload || initInboxUpload;
  const putVideo = options.uploadVideoFile || uploadVideoFile;
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const caption = String(post.caption || metadata.summary?.short || '').slice(0, 2200);
  const signal = options.signal;

  try {
    signal?.throwIfAborted();
    const videoSize = (await stat(videoFile)).size;
    const uploadPlan = planTikTokUpload(videoSize);
    let uploadUrl = options.resumeState?.uploadUrl;
    let publishId = options.resumeState?.publishId;
    if (!publishId) {
      const init = await initUpload({
        accessToken,
        videoSize,
        ...uploadPlan,
        postInfo: {title: caption},
        signal,
        fetchImpl: options.fetch || fetch,
        requestTimeoutMs: options.requestTimeoutMs
      });
      uploadUrl = init.data?.upload_url || init.upload_url;
      publishId = init.data?.publish_id || init.publish_id;
      await options.onRemoteState?.({status: 'uploading', phase: 'session-created', remote: {uploadUrl, publishId, videoSize, bytesUploaded: 0, uploadPlan}});
    }
    if (!uploadUrl || !publishId) {
      throw new Error('TikTok no devolvio upload_url/publish_id.');
    }
    if (Number(options.resumeState?.bytesUploaded || 0) < videoSize) {
      await putVideo(uploadUrl, videoFile, videoSize, {
        plan: options.resumeState?.uploadPlan || uploadPlan,
        startOffset: options.resumeState?.bytesUploaded || 0,
        signal,
        fetch: options.fetch || fetch,
        sleep: options.sleep,
        onProgress: async (progress) => {
          await options.onRemoteState?.({status: 'uploading', phase: progress.phase, remote: {uploadUrl, publishId, videoSize, bytesUploaded: progress.bytesUploaded, uploadPlan}});
          await options.onProgress?.(progress);
        }
      });
      await options.onRemoteState?.({status: 'processing', phase: 'uploaded', remote: {uploadUrl, publishId, videoSize, bytesUploaded: videoSize, uploadPlan}});
    }
    const reconcile = options.pollPostStatus || pollTikTokPostStatus;
    const postStatus = await reconcile({
      accessToken,
      publishId,
      fetchImpl: options.fetch || fetch,
      fetchStatus: options.fetchStatus,
      signal,
      timeoutMs: options.statusTimeoutMs,
      initialDelayMs: options.statusInitialDelayMs,
      maxDelayMs: options.statusMaxDelayMs,
      backoffFactor: options.statusBackoffFactor,
      requestTimeoutMs: options.statusRequestTimeoutMs,
      sleep: options.sleep,
      now: options.now
    });
    const result = {
      platform: 'tiktok',
      status: postStatus.status,
      officialApi: 'TikTok Content Posting API inbox video init + upload + status fetch',
      mode: 'draft_upload',
      asset: videoFile,
      caption,
      publishId,
      tiktokStatus: postStatus.tiktokStatus,
      statusPolls: postStatus.polls,
      timedOut: postStatus.timedOut,
      postIds: postStatus.postIds ?? []
    };
    await options.onRemoteState?.({status: result.status, phase: 'reconciled', remote: {publishId, postIds: result.postIds, tiktokStatus: result.tiktokStatus, bytesUploaded: videoSize, videoSize}});
    if (postStatus.status === 'requires_manual_action') {
      result.nextStep = 'Revisa el borrador/inbox en TikTok y completa la publicacion manualmente.';
    } else if (postStatus.status === 'processing') {
      result.nextStep = 'TikTok sigue procesando el video; consulta de nuevo el estado mas tarde.';
    } else if (postStatus.status === 'failed') {
      result.error = postStatus.failReason || 'TikTok no pudo procesar el video.';
    }
    return result;
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw error;
    return {
      platform: 'tiktok',
      status: 'failed',
      officialApi: 'TikTok Content Posting API',
      asset: videoFile,
      caption,
      error: error.message
    };
  }
}
