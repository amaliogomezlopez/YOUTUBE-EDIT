import {manualResult, missing, validateVideoAsset} from './common.js';
import {uploadAssetToSshHost} from '../asset-host.js';
import {validateInstagramToken} from '../instagram-oauth.js';
import {postForPlatform} from '../publishing.js';
import {abortableSleep, fetchWithTimeout} from '../network.js';

const REQUIRED_ENV = ['INSTAGRAM_BUSINESS_ACCOUNT_ID', 'META_ACCESS_TOKEN'];
const INSTAGRAM_GRAPH_BASE = 'https://graph.instagram.com';
const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

function graphUrl(path, params = {}) {
  const url = new URL(`${INSTAGRAM_GRAPH_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  }
  return url;
}

async function graphPost(path, body, token, options = {}) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  const response = await fetchWithTimeout(`${INSTAGRAM_GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: form
  }, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || `Instagram Graph ${path} failed with ${response.status}`;
    return {ok: false, status: response.status, message, payload};
  }
  return {ok: true, payload};
}

async function graphGetMedia(mediaId, token, options = {}) {
  const url = graphUrl(`/${mediaId}`, {fields: 'id,permalink,media_type,username', access_token: token});
  const response = await fetchWithTimeout(url, {}, {fetchImpl: options.fetch || fetch, signal: options.signal, timeoutMs: options.requestTimeoutMs ?? 30_000});
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error?.message || `Instagram Graph media lookup failed with ${response.status}`);
  }
  return payload;
}

async function pollContainerStatus(containerId, token, {onLog, signal, fetchImpl = fetch, timeoutMs = POLL_TIMEOUT_MS, requestTimeoutMs = 30_000, sleep = abortableSleep} = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    signal?.throwIfAborted();
    const url = graphUrl(`/${containerId}`, {fields: 'status_code,status', access_token: token});
    const response = await fetchWithTimeout(url, {}, {fetchImpl, signal, timeoutMs: requestTimeoutMs});
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || `Instagram container status failed with ${response.status}`);
    }
    const status = payload.status_code || payload.status;
    onLog?.(`container ${containerId} status=${status || 'UNKNOWN'}`);
    if (status === 'FINISHED') return payload;
    if (status === 'ERROR') throw new Error(`Instagram container finished with ERROR. status=${JSON.stringify(payload)}`);
    await sleep(POLL_INTERVAL_MS, signal);
  }
  throw new Error(`Instagram container polling timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

export async function publishToInstagram({videoFile, metadata, clip, options = {}}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'instagram', status: 'failed', error: assetError};
  }

  const post = postForPlatform(metadata, clip, 'instagram');
  const missingEnv = missing(REQUIRED_ENV);
  if (missingEnv.length) {
    return manualResult('instagram', 'Faltan credenciales de Instagram Graph API. Reels requiere cuenta profesional y media URL accesible por HTTPS.', {
      missingEnv,
      officialApi: 'Instagram Graph API media + media_publish',
      asset: videoFile,
      caption: post.caption || metadata.summary?.short
    });
  }

  const token = process.env.META_ACCESS_TOKEN;
  const igUserId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;

  const validateToken = options.validateInstagramToken || validateInstagramToken;
  const postGraph = options.graphPost || graphPost;
  const getMedia = options.graphGetMedia || graphGetMedia;
  const pollStatus = options.pollContainerStatus || pollContainerStatus;
  const uploadAsset = options.uploadAsset || uploadAssetToSshHost;
  const resume = options.resumeState ?? {};

  if (resume.mediaId) {
    let media = {};
    try {
      media = await getMedia(resume.mediaId, token, options);
    } catch (error) {
      if (options.signal?.aborted || error?.name === 'AbortError') throw error;
    }
    return {
      platform: 'instagram', status: 'published', officialApi: 'Instagram Graph API media lookup', asset: videoFile,
      videoUrl: resume.videoUrl, containerId: resume.containerId, mediaId: resume.mediaId,
      permalink: media.permalink || resume.permalink || null, reconciled: true
    };
  }
  if (resume.phase === 'publishing' && resume.containerId) {
    return manualResult('instagram', 'La publicación pudo completarse antes del reinicio, pero falta el mediaId local. Revisa la cuenta antes de reintentar para evitar un duplicado.', {
      officialApi: 'Instagram Graph API media_publish', containerId: resume.containerId, videoUrl: resume.videoUrl
    });
  }

  let probe;
  try {
    probe = await validateToken(token, {fields: 'id,user_id,username,account_type', signal: options.signal, fetch: options.fetch, timeoutMs: options.requestTimeoutMs});
  } catch (error) {
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'Instagram Graph API',
      asset: videoFile,
      error: `Token invalido: ${error.message}`
    };
  }
  if (!probe.isProfessional) {
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'Instagram Graph API',
      asset: videoFile,
      error: `La cuenta @${probe.username} no es profesional (tipo=${probe.accountType}). Reels exige BUSINESS o CREATOR.`
    };
  }
  if (probe.matchesEnv === false) {
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'Instagram Graph API',
      asset: videoFile,
      error: `INSTAGRAM_BUSINESS_ACCOUNT_ID (${process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID}) no coincide con el token (user_id=${probe.instagramBusinessAccountId}).`
    };
  }

  let videoUrl = resume.videoUrl || options.videoUrl || metadata.platform_posts?.instagram?.video_url || post.video_url;
  if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
    let hosted;
    try {
      hosted = await uploadAsset(videoFile, {env: process.env, signal: options.signal});
    } catch (error) {
      return {
        platform: 'instagram',
        status: 'failed',
        officialApi: 'Instagram Graph API media + media_publish',
        asset: videoFile,
        error: `No se pudo subir el video al asset host: ${error.message}`
      };
    }
    if (hosted.ok && /^https:\/\//i.test(hosted.publicUrl)) {
      videoUrl = hosted.publicUrl;
      await options.onRemoteState?.({status: 'uploading', phase: 'asset-hosted', remote: {videoUrl, hostedFilename: hosted.filename || null, hostedRemotePath: hosted.remotePath || null, hostedAt: new Date().toISOString()}});
    } else {
      return manualResult('instagram', 'Instagram Graph API no acepta archivos locales: requiere una URL HTTPS publica (video_url) accesible por Meta.', {
        officialApi: 'Instagram Graph API media + media_publish',
        asset: videoFile,
        caption: post.caption || metadata.summary?.short,
        nextBlocker: 'hosting HTTPS del mp4 antes de crear el contenedor REELS',
        missingEnv: hosted.missingEnv,
        needs: [
          'ASSET_HOST_PROVIDER=ssh',
          'ASSET_HOST_SSH_HOST',
          'ASSET_HOST_REMOTE_DIR',
          'ASSET_HOST_PUBLIC_BASE_URL'
        ]
      });
    }
  }

  const caption = String(post.caption || metadata.summary?.short || '').slice(0, 2200);

  let containerId = resume.containerId;
  if (!containerId) {
    const create = await postGraph(`/${igUserId}/media`, {
      media_type: 'REELS',
      video_url: videoUrl,
      caption
    }, token, options);
    if (!create.ok) {
      return {
        platform: 'instagram', status: 'failed', officialApi: 'POST /{ig-user-id}/media (REELS)', asset: videoFile,
        videoUrl, error: create.message, details: create.payload?.error
      };
    }
    containerId = create.payload.id;
    await options.onRemoteState?.({status: 'processing', phase: 'container-created', remote: {videoUrl, containerId}});
  }
  if (!containerId) {
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'POST /{ig-user-id}/media',
      asset: videoFile,
      videoUrl,
      error: 'Instagram no devolvió containerId.'
    };
  }
  try {
    await pollStatus(containerId, token, {...options, fetchImpl: options.fetch || fetch});
  } catch (error) {
    if (options.signal?.aborted || error?.name === 'AbortError') throw error;
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'Poll container status',
      asset: videoFile,
      videoUrl,
      containerId,
      error: error.message
    };
  }

  await options.onRemoteState?.({status: 'processing', phase: 'publishing', remote: {videoUrl, containerId, phase: 'publishing'}});
  const publish = await postGraph(`/${igUserId}/media_publish`, {
    creation_id: containerId
  }, token, options);
  if (!publish.ok) {
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'POST /{ig-user-id}/media_publish',
      asset: videoFile,
      videoUrl,
      containerId,
      error: publish.message,
      details: publish.payload?.error
    };
  }
  let media = {};
  try {
    media = await getMedia(publish.payload.id, token, options);
  } catch {
    media = {};
  }

  await options.onRemoteState?.({status: 'published', phase: 'published', remote: {videoUrl, containerId, mediaId: publish.payload.id, permalink: media.permalink || publish.payload.permalink || null}});
  return {
    platform: 'instagram',
    status: 'published',
    officialApi: 'Instagram Graph API media + media_publish',
    asset: videoFile,
    videoUrl,
    containerId,
    mediaId: publish.payload.id,
    permalink: media.permalink || publish.payload.permalink || `https://www.instagram.com/${probe.username}/`
  };
}
