import crypto from 'node:crypto';
import {open, stat} from 'node:fs/promises';
import {manualResult, missing, validateVideoAsset} from './common.js';
import {postForPlatform} from '../publishing.js';

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

function sanitizeApiError(error) {
  const raw = error?.message || String(error);
  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'Bearer [redacted]')
    .replace(/access_token=([^&\s]+)/gi, 'access_token=[redacted]');
}

async function xJson(path, {method = 'GET', token, body} = {}) {
  const response = await fetch(`${X_API_BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });
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

async function xFormPost(url, {token, fields = {}, files = {}} = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  for (const [key, value] of Object.entries(files)) {
    if (Buffer.isBuffer(value)) form.set(key, new Blob([value], {type: 'video/mp4'}), `${key}.mp4`);
    else if (value !== undefined && value !== null) form.set(key, value);
  }
  const response = await fetch(url, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`},
    body: form
  });
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

async function oauth1FormPost(url, form, credentials) {
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) body.set(key, String(value));
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: oauthHeader('POST', url, form, credentials),
      'content-type': 'application/x-www-form-urlencoded'
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || `X OAuth1 media upload failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function oauth1MultipartPost(url, query, fields, credentials) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) parsed.searchParams.set(key, String(value));
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Buffer.isBuffer(value)) form.set(key, new Blob([value]), key);
    else form.set(key, String(value));
  }
  const response = await fetch(parsed, {
    method: 'POST',
    headers: {
      authorization: oauthHeader('POST', parsed.toString(), query, credentials)
    },
    body: form
  });
  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || `X OAuth1 media append failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function oauth1Get(url, query, credentials) {
  const parsed = new URL(url);
  for (const [key, value] of Object.entries(query)) parsed.searchParams.set(key, String(value));
  const response = await fetch(parsed, {
    headers: {
      authorization: oauthHeader('GET', parsed.toString(), query, credentials)
    }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || `X OAuth1 media status failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function initializeUpload({token, videoSize}) {
  return xJson('/2/media/upload/initialize', {
    method: 'POST',
    token,
    body: {
      media_type: 'video/mp4',
      media_category: 'tweet_video',
      total_bytes: videoSize
    }
  });
}

async function appendUploadChunk({token, mediaId, segmentIndex, chunk}) {
  const form = new FormData();
  form.set('segment_index', String(segmentIndex));
  form.set('media', new Blob([chunk], {type: 'video/mp4'}), `segment-${segmentIndex}.mp4`);
  const response = await fetch(`${X_API_BASE}/2/media/upload/${encodeURIComponent(mediaId)}/append`, {
    method: 'POST',
    headers: {authorization: `Bearer ${token}`},
    body: form
  });
  if (response.status === 204) return {};
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.detail || payload.title || `X media append failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function appendUpload({token, mediaId, videoFile, videoSize, chunkSize = CHUNK_SIZE}) {
  const file = await open(videoFile, 'r');
  try {
    let offset = 0;
    let segmentIndex = 0;
    while (offset < videoSize) {
      const length = Math.min(chunkSize, videoSize - offset);
      const buffer = Buffer.allocUnsafe(length);
      const {bytesRead} = await file.read(buffer, 0, length, offset);
      if (!bytesRead) break;
      await appendUploadChunk({
        token,
        mediaId,
        segmentIndex,
        chunk: bytesRead === buffer.length ? buffer : buffer.subarray(0, bytesRead)
      });
      offset += bytesRead;
      segmentIndex += 1;
    }
  } finally {
    await file.close();
  }
}

async function finalizeUpload({token, mediaId}) {
  return xJson(`/2/media/upload/${encodeURIComponent(mediaId)}/finalize`, {
    method: 'POST',
    token
  });
}

async function getUploadStatus({token, mediaId}) {
  return xJson(`/2/media/upload?command=STATUS&media_id=${encodeURIComponent(mediaId)}`, {token});
}

function processingState(payload) {
  return payload.data?.processing_info?.state || payload.processing_info?.state;
}

function checkAfterSecs(payload) {
  return Number(payload.data?.processing_info?.check_after_secs || payload.processing_info?.check_after_secs || 0);
}

async function pollUpload({token, mediaId, getStatus = getUploadStatus, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))}) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const payload = await getStatus({token, mediaId});
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
  const init = await initUpload({token, videoSize});
  const mediaId = init.data?.id || init.media_id || init.media_id_string;
  if (!mediaId) throw new Error('X no devolvio media_id al inicializar el upload.');
  await appendFile({token, mediaId, videoFile, videoSize});
  const finalized = await finishUpload({token, mediaId});
  if (processingState(finalized)) {
    await poll({
      token,
      mediaId,
      getStatus: options.getUploadStatus || getUploadStatus,
      sleep: options.sleep
    });
  }
  return {mediaId, init, finalized};
}

async function pollOAuth1Upload({mediaId, credentials, sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))}) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const payload = await oauth1Get(X_UPLOAD_1_1_URL, {command: 'STATUS', media_id: mediaId}, credentials);
    const state = payload.processing_info?.state;
    if (!state || state === 'succeeded') return payload;
    if (state === 'failed') throw new Error(payload.processing_info?.error?.message || 'X OAuth1 media processing failed.');
    const wait = Number(payload.processing_info?.check_after_secs || 0) * 1000;
    await sleep(Math.max(wait, POLL_INTERVAL_MS));
  }
  throw new Error(`X OAuth1 media processing timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

async function uploadVideoOAuth1({videoFile, videoSize, credentials, sleep}) {
  const init = await oauth1FormPost(X_UPLOAD_1_1_URL, {
    command: 'INIT',
    total_bytes: videoSize,
    media_type: 'video/mp4',
    media_category: 'tweet_video'
  }, credentials);
  const mediaId = init.media_id_string || init.media_id;
  if (!mediaId) throw new Error('X OAuth1 no devolvio media_id al inicializar el upload.');
  const file = await open(videoFile, 'r');
  try {
    let offset = 0;
    let segmentIndex = 0;
    while (offset < videoSize) {
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
      }, credentials);
      offset += bytesRead;
      segmentIndex += 1;
    }
  } finally {
    await file.close();
  }
  const finalized = await oauth1FormPost(X_UPLOAD_1_1_URL, {
    command: 'FINALIZE',
    media_id: mediaId
  }, credentials);
  if (processingState(finalized) || finalized.processing_info?.state) {
    await pollOAuth1Upload({mediaId, credentials, sleep});
  }
  return {mediaId, init, finalized};
}

async function createPost({token, text, mediaId}) {
  return xJson('/2/tweets', {
    method: 'POST',
    token,
    body: {
      text,
      media: {media_ids: [mediaId]}
    }
  });
}

async function createPostOAuth1({text, mediaId, credentials}) {
  return oauth1FormPost(`${X_API_1_1_BASE}/1.1/statuses/update.json`, {
    status: text,
    media_ids: mediaId
  }, credentials);
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

  const token = options.accessToken || envToken();
  const oauth1 = options.oauth1Credentials || oauth1Credentials();
  const getSize = options.stat || stat;
  const upload = options.uploadVideo || uploadVideo;
  const oauth1Upload = options.uploadVideoOAuth1 || uploadVideoOAuth1;
  const postTweet = options.createPost || createPost;
  const postTweetOAuth1 = options.createPostOAuth1 || createPostOAuth1;

  try {
    const videoSize = (await getSize(videoFile)).size;
    let uploadResult;
    let uploadMode = 'oauth2_v2';
    try {
      if (!token) throw new Error('No hay token OAuth 2.0 para X media upload v2.');
      uploadResult = await upload({token, videoFile, videoSize, options});
    } catch (error) {
      if (!oauth1) throw error;
      uploadMode = 'oauth1_1_1';
      uploadResult = await oauth1Upload({videoFile, videoSize, credentials: oauth1, sleep: options.sleep});
    }
    const mediaId = uploadResult.mediaId;
    const created = uploadMode === 'oauth1_1_1' && oauth1
      ? await postTweetOAuth1({text, mediaId, credentials: oauth1})
      : await postTweet({token, text, mediaId});
    const tweetId = created.data?.id || created.id_str || created.id;
    if (!tweetId) throw new Error('X no devolvio id del post publicado.');
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
