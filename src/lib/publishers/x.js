import crypto from 'node:crypto';
import {open, stat} from 'node:fs/promises';
import {manualResult, missing, validateVideoAsset} from './common.js';
import {postForPlatform} from '../publishing.js';
import {abortableSleep, fetchWithTimeout} from '../network.js';
import {refreshXAccessToken} from '../x-oauth.js';
import {persistEnvValues} from '../utils.js';

const X_API_BASE = 'https://api.x.com';
const X_API_1_1_BASE = 'https://api.twitter.com';
const X_UPLOAD_1_1_URL = 'https://upload.twitter.com/1.1/media/upload.json';
const REQUIRED_ENV = ['X_USER_ACCESS_TOKEN'];
const OAUTH1_ENV = ['X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
const OAUTH1_ENV_ALIASES = {
  X_API_KEY: ['X_API_KEY', 'X_API_KEY_OAUTH1'],
  X_API_SECRET: ['X_API_SECRET', 'X_API_SECRET_OAUTH1'],
  X_ACCESS_TOKEN: ['X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_OAUTH1'],
  X_ACCESS_TOKEN_SECRET: ['X_ACCESS_TOKEN_SECRET', 'X_ACCESS_TOKEN_SECRET_OAUTH1']
};
const CHUNK_SIZE = 4 * 1024 * 1024;
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function envToken() {
  return process.env.X_USER_ACCESS_TOKEN || process.env.X_OAUTH2_ACCESS_TOKEN || '';
}

function credentialStatus() {
  if (envToken() || oauth1Credentials()) return [];
  return missing(REQUIRED_ENV);
}

function oauth1Credentials() {
  const value = (key) => OAUTH1_ENV_ALIASES[key].map((alias) => process.env[alias]).find(Boolean);
  if (!OAUTH1_ENV.every((key) => value(key))) return null;
  return {
    consumerKey: value('X_API_KEY'),
    consumerSecret: value('X_API_SECRET'),
    token: value('X_ACCESS_TOKEN'),
    tokenSecret: value('X_ACCESS_TOKEN_SECRET')
  };
}

async function currentAccessToken(options = {}) {
  if (options.accessToken) return options.accessToken;
  const existing = envToken();
  if (!process.env.X_REFRESH_TOKEN) return existing;
  const refresh = options.refreshAccessToken || refreshXAccessToken;
  let tokens;
  try {
    tokens = await refresh(process.env.X_REFRESH_TOKEN, undefined, options);
  } catch (error) {
    if (existing) return existing;
    throw error;
  }
  if (!tokens?.access_token) throw new Error('X refrescó OAuth sin devolver access_token.');
  await (options.persistTokens || persistEnvValues)({
    X_USER_ACCESS_TOKEN: tokens.access_token,
    X_REFRESH_TOKEN: tokens.refresh_token || process.env.X_REFRESH_TOKEN,
    X_SCOPES: tokens.scope || process.env.X_SCOPES || '',
    X_TOKEN_EXPIRES_IN: tokens.expires_in || process.env.X_TOKEN_EXPIRES_IN || ''
  });
  return tokens.access_token;
}

function sanitizeApiError(error) {
  const raw = error?.message || String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/access_token=([^&\s]+)/gi, 'access_token=[redacted]');
}

async function xJson(path, {method = 'GET', token, body, options = {}} = {}) {
  const response = await fetchWithTimeout(`${X_API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.detail || payload.title || `X API ${path} failed with ${response.status}`;
    const hint = response.status === 403 && path === '/2/media/upload/initialize'
      ? ' Comprueba que la app/token tenga acceso efectivo a X media upload y el scope media.write o entitlement equivalente.'
      : '';
    const error = new Error(`${message}${hint}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function xFormPost(url, {token, fields = {}, files = {}, options = {}} = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  for (const [key, value] of Object.entries(files)) {
    if (Buffer.isBuffer(value)) form.set(key, new Blob([value], {type: 'video/mp4'}), `${key}.mp4`);
    else if (value !== undefined && value !== null) form.set(key, value);
  }
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`},
    body: form
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.chunkTimeoutMs ?? 5 * 60_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.detail || payload.title || `X media upload failed with ${response.status}`;
    const hint = response.status === 403
      ? ' Comprueba que el token OAuth 2.0 incluya media.write y que la app tenga acceso efectivo a media upload.'
      : '';
    const error = new Error(`${message}${hint}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function oauthEncode(value) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function oauthBaseUrl(url) {
  const parsed = new URL(url);
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function oauthHeader(method, url, extraParams, credentials) {
  const oauthParams = {
    oauth_consumer_key: credentials.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000),
    oauth_token: credentials.token,
    oauth_version: '1.0'
  };
  const params = {...extraParams, ...oauthParams};
  const paramString = Object.entries(params)
    .flatMap(([key, value]) => Array.isArray(value) ? value.map((item) => [key, item]) : [[key, value]])
    .map(([key, value]) => [oauthEncode(key), oauthEncode(value)])
    .sort(([aKey, aValue], [bKey, bValue]) => aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  const baseString = [
    method.toUpperCase(),
    oauthEncode(oauthBaseUrl(url)),
    oauthEncode(paramString)
  ].join('&');
  const signingKey = `${oauthEncode(credentials.consumerSecret)}&${oauthEncode(credentials.tokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  const header = Object.entries(oauthParams)
    .map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`)
    .join(', ');
  return `OAuth ${header}`;
}

async function oauth1FormPost(url, form, credentials, options = {}) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) body.set(key, String(value));
  const response = await fetchWithTimeout(url, {
    method: 'POST',
    headers: {
      authorization: oauthHeader('POST', url, form, credentials),
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || `X OAuth1 media upload failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function oauth1MultipartPost(url, query, fields, credentials, options = {}) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) parsed.searchParams.set(key, String(value));
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Buffer.isBuffer(value)) form.set(key, new Blob([value]), key);
    else form.set(key, String(value));
  }
  const response = await fetchWithTimeout(parsed, {
    method: 'POST',
    headers: {
      authorization: oauthHeader('POST', parsed.toString(), query, credentials)
    },
    body: form
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.chunkTimeoutMs ?? 5 * 60_000});
  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || `X OAuth1 media append failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function oauth1Get(url, query, credentials, options = {}) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) parsed.searchParams.set(key, String(value));
  const response = await fetchWithTimeout(parsed, {
    headers: {
      authorization: oauthHeader('GET', parsed.toString(), query, credentials)
    }
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || `X OAuth1 media status failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function initializeUpload({token, videoSize, options = {}}) {
  return xJson('/2/media/upload/initialize', {
    method: 'POST',
    token,
    body: {
      media_type: 'video/mp4',
      media_category: 'tweet_video',
      total_bytes: videoSize
    },
    options
  });
}

async function appendUploadChunk({token, mediaId, segmentIndex, chunk, options = {}}) {
  const form = new FormData();
  form.set('segment_index', String(segmentIndex));
  form.set('media', new Blob([chunk], {type: 'video/mp4'}), `segment-${segmentIndex}.mp4`);
  const response = await fetchWithTimeout(`${X_API_BASE}/2/media/upload/${encodeURIComponent(mediaId)}/append`, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`},
    body: form
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.chunkTimeoutMs ?? 5 * 60_000});
  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.detail || payload.title || `X media append failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function appendUpload({token, mediaId, videoFile, videoSize, chunkSize = CHUNK_SIZE, options = {}}) {
  const file = await open(videoFile, 'r');
  try {
    let offset = Math.max(0, Number(options.startOffset || 0));
    let segmentIndex = Math.floor(offset / chunkSize);
    while (offset < videoSize) {
      options.signal?.throwIfAborted();
      const length = Math.min(chunkSize, videoSize - offset);
      const buffer = Buffer.allocUnsafe(length);
      const {bytesRead} = await file.read(buffer, 0, length, offset);
      if (!bytesRead) break;
      await appendUploadChunk({
        token,
        mediaId,
        segmentIndex,
        chunk: bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead),
        options
      });
      offset += bytesRead;
      segmentIndex += 1;
      await options.onProgress?.({platform: 'x', phase: offset >= videoSize ? 'uploaded' : 'uploading', bytesUploaded: offset, totalBytes: videoSize, percent: Math.round(offset / videoSize * 100)});
    }
  } finally {
    await file.close();
  }
}

async function finalizeUpload({token, mediaId, options = {}}) {
  return xJson(`/2/media/upload/${encodeURIComponent(mediaId)}/finalize`, {
    method: 'POST',
    token,
    options
  });
}

async function getUploadStatus({token, mediaId, options = {}}) {
  return xJson(`/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, {token, options});
}

function processingState(payload) {
  return payload.data?.processing_info?.state || payload.processing_info?.state;
}

function checkAfterSecs(payload) {
  return Number(payload.data?.processing_info?.check_after_secs || payload.processing_info?.check_after_secs || 0);
}

async function pollUpload({token, mediaId, getStatus = getUploadStatus, sleep, options = {}}) {
  sleep ||= (ms) => abortableSleep(ms, options.signal);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted();
    const payload = await getStatus({token, mediaId, options});
    const state = processingState(payload);
    if (!state || state === 'succeeded') return payload;
    if (state === 'failed') {
      const error = payload.data?.processing_info?.error || payload.processing_info?.error;
      throw new Error(error?.message || 'X media processing failed.');
    }
    await sleep(Math.max(checkAfterSecs(payload) * 1000, POLL_INTERVAL_MS));
  }
  throw new Error(`X media processing timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function uploadVideo({token, videoFile, videoSize, options = {}}) {
  const initUpload = options.initializeUpload || initializeUpload;
  const appendFile = options.appendUpload || appendUpload;
  const finishUpload = options.finalizeUpload || finalizeUpload;
  const poll = options.pollUpload || pollUpload;
  let mediaId = options.resumeState?.mediaId;
  let init = {};
  if (!mediaId) {
    init = await initUpload({token, videoSize, options});
    mediaId = init.data?.id || init.media_id || init.media_id_string;
    await options.onRemoteState?.({status: 'uploading', phase: 'media-created', remote: {mediaId, videoSize, bytesUploaded: 0, uploadMode: 'oauth2_v2'}});
  }
  if (!mediaId) throw new Error('X no devolvio media_id al inicializar el upload.');
  if (Number(options.resumeState?.bytesUploaded || 0) < videoSize) {
    await appendFile({token, mediaId, videoFile, videoSize, options: {
      ...options,
      startOffset: options.resumeState?.bytesUploaded || 0,
      onProgress: async (progress) => {
        await options.onRemoteState?.({status: 'uploading', phase: progress.phase, remote: {mediaId, videoSize, bytesUploaded: progress.bytesUploaded, uploadMode: 'oauth2_v2'}});
        await options.onProgress?.(progress);
      }
    }});
  }
  const finalized = await finishUpload({token, mediaId, options});
  if (processingState(finalized)) {
    await poll({
      token,
      mediaId,
      getStatus: options.getUploadStatus || getUploadStatus,
      sleep: options.sleep,
      options
    });
  }
  return {mediaId, init, finalized};
}

async function pollOAuth1Upload({mediaId, credentials, sleep, options = {}}) {
  sleep ||= (ms) => abortableSleep(ms, options.signal);
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted();
    const payload = await oauth1Get(X_UPLOAD_1_1_URL, {command: 'STATUS', media_id: mediaId}, credentials, options);
    const state = payload.processing_info?.state;
    if (!state || state === 'succeeded') return payload;
    if (state === 'failed') throw new Error(payload.processing_info?.error?.message || 'X OAuth1 media processing failed.');
    const wait = Number(payload.processing_info?.check_after_secs || 0) * 1000;
    await sleep(Math.max(wait, POLL_INTERVAL_MS));
  }
  throw new Error(`X OAuth1 media processing timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function uploadVideoOAuth1({videoFile, videoSize, credentials, sleep, options = {}}) {
  let mediaId = options.resumeState?.mediaId;
  let init = {};
  if (!mediaId) init = await oauth1FormPost(X_UPLOAD_1_1_URL, {
    command: 'INIT',
    total_bytes: videoSize,
    media_type: 'video/mp4',
    media_category: 'tweet_video'
  }, credentials, options);
  mediaId ||= init.media_id_string || init.media_id;
  if (!mediaId) throw new Error('X OAuth1 no devolvio media_id al inicializar el upload.');
  if (!options.resumeState?.mediaId) await options.onRemoteState?.({status: 'uploading', phase: 'media-created', remote: {mediaId, videoSize, bytesUploaded: 0, uploadMode: 'oauth1_1_1'}});
  const file = await open(videoFile, 'r');
  try {
    let offset = Math.max(0, Number(options.resumeState?.bytesUploaded || 0));
    let segmentIndex = Math.floor(offset / CHUNK_SIZE);
    while (offset < videoSize) {
      options.signal?.throwIfAborted();
      const length = Math.min(CHUNK_SIZE, videoSize - offset);
      const buffer = Buffer.allocUnsafe(length);
      const {bytesRead} = await file.read(buffer, 0, length, offset);
      if (!bytesRead) break;
      await oauth1MultipartPost(X_UPLOAD_1_1_URL, {
        command: 'APPEND',
        media_id: mediaId,
        segment_index: segmentIndex
      }, {
        media: bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead)
      }, credentials, options);
      offset += bytesRead;
      segmentIndex += 1;
      await options.onRemoteState?.({status: 'uploading', phase: offset >= videoSize ? 'uploaded' : 'uploading', remote: {mediaId, videoSize, bytesUploaded: offset, uploadMode: 'oauth1_1_1'}});
    }
  } finally {
    await file.close();
  }
  const finalized = await oauth1FormPost(X_UPLOAD_1_1_URL, {
    command: 'FINALIZE',
    media_id: mediaId
  }, credentials, options);
  if (processingState(finalized) || finalized.processing_info?.state) {
    await pollOAuth1Upload({mediaId, credentials, sleep, options});
  }
  return {mediaId, init, finalized};
}

async function createPost({token, text, mediaId, options = {}}) {
  return xJson('/2/tweets', {
    method: 'POST',
    token,
    body: {
      text,
      media: {media_ids: [mediaId]}
    },
    options
  });
}

async function createPostOAuth1({text, mediaId, credentials, options = {}}) {
  return oauth1FormPost(`${X_API_1_1_BASE}/1.1/statuses/update.json`, {
    status: text,
    media_ids: mediaId
  }, credentials, options);
}

export async function publishToX({videoFile, metadata, clip, options = {}}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'x', status: 'failed', error: assetError};
  }

  const post = postForPlatform(metadata, clip, 'x');
  const text = String(post.text || metadata.summary?.short || '').slice(0, 280);
  const missingEnv = credentialStatus();
  if (missingEnv.length) {
    return manualResult('x', 'Falta un token OAuth 2.0 de usuario de X con permisos tweet.write, tweet.read, users.read y media.write.', {
      missingEnv,
      officialApi: 'X API v2 media upload + POST /2/tweets',
      asset: videoFile,
      text,
      requiredPlan: 'Plan de X API con acceso de escritura y media upload habilitado.'
    });
  }

  const oauth1 = options.oauth1Credentials || oauth1Credentials();
  const getSize = options.stat || stat;
  const upload = options.uploadVideo || uploadVideo;
  const oauth1Upload = options.uploadVideoOAuth1 || uploadVideoOAuth1;
  const postTweet = options.createPost || createPost;
  const postTweetOAuth1 = options.createPostOAuth1 || createPostOAuth1;
  const resume = options.resumeState ?? {};

  if (resume.postId) {
    return {
      platform: 'x', status: 'published', officialApi: 'X API', asset: videoFile, text,
      uploadMode: resume.uploadMode, mediaId: resume.mediaId, postId: resume.postId,
      url: `https://x.com/i/web/status/${resume.postId}`, reconciled: true
    };
  }
  if (resume.phase === 'posting' && resume.mediaId) {
    return manualResult('x', 'X pudo aceptar el post antes del reinicio, pero Shortsmith no recibió su ID. Revisa la cuenta antes de reintentar.', {
      officialApi: 'X API POST /2/tweets', mediaId: resume.mediaId, text
    });
  }

  try {
    options.signal?.throwIfAborted();
    let token = '';
    try {
      token = await currentAccessToken(options);
    } catch (error) {
      if (!oauth1) throw error;
    }
    const videoSize = (await getSize(videoFile)).size;
    let uploadResult;
    let uploadMode = resume.uploadMode || 'oauth2_v2';
    if (resume.mediaId && Number(resume.bytesUploaded || 0) >= videoSize) {
      uploadResult = {mediaId: resume.mediaId};
    } else {
      try {
        if (!token) throw new Error('No hay token OAuth 2.0 para X media upload v2.');
        uploadResult = await upload({token, videoFile, videoSize, options});
      } catch (error) {
        if (options.signal?.aborted || error?.name === 'AbortError') throw error;
        if (!oauth1) throw error;
        uploadMode = 'oauth1_1_1';
        uploadResult = await oauth1Upload({videoFile, videoSize, credentials: oauth1, sleep: options.sleep, options: {...options, resumeState: resume.uploadMode === 'oauth1_1_1' ? resume : {}}});
      }
    }
    const mediaId = uploadResult.mediaId;
    await options.onRemoteState?.({status: 'processing', phase: 'media-ready', remote: {mediaId, videoSize, bytesUploaded: videoSize, uploadMode}});
    await options.onRemoteState?.({status: 'processing', phase: 'posting', remote: {mediaId, videoSize, bytesUploaded: videoSize, uploadMode, phase: 'posting'}});
    const created = uploadMode === 'oauth1_1_1' && oauth1
      ? await postTweetOAuth1({text, mediaId, credentials: oauth1, options})
      : await postTweet({token, text, mediaId, options});
    const tweetId = created.data?.id || created.id_str || created.id;
    if (!tweetId) throw new Error('X no devolvio id del post publicado.');
    await options.onRemoteState?.({status: 'published', phase: 'published', remote: {mediaId, videoSize, bytesUploaded: videoSize, uploadMode, postId: tweetId}});
    return {
      platform: 'x',
      status: 'published',
      officialApi: 'X API v2 media upload + POST /2/tweets',
      asset: videoFile,
      text,
      uploadMode,
      mediaId,
      postId: tweetId,
      url: `https://x.com/i/web/status/${tweetId}`
    };
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw error;
    return {
      platform: 'x',
      status: 'failed',
      officialApi: 'X API v2 media upload + POST /2/tweets',
      asset: videoFile,
      text,
      error: sanitizeApiError(error)
    };
  }
}
