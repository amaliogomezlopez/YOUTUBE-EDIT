import {manualResult, missing, validateVideoAsset} from './common.js';
import {uploadAssetToSshHost} from '../asset-host.js';
import {validateInstagramToken} from '../instagram-oauth.js';

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

async function graphPost(path, body, token) {
  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && value !== null) form.set(key, String(value));
  }
  const response = await fetch(`${INSTAGRAM_GRAPH_BASE}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/x-www-form-urlencoded'
    },
    body: form
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.error?.message || `Instagram Graph ${path} failed with ${response.status}`;
    return {ok: false, status: response.status, message, payload};
  }
  return {ok: true, payload};
}

async function pollContainerStatus(containerId, token, {onLog} = {}) {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const url = graphUrl(`/${containerId}`, {fields: 'status_code,status', access_token: token});
    const response = await fetch(url);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error?.message || `Instagram container status failed with ${response.status}`);
    }
    const status = payload.status_code || payload.status;
    onLog?.(`container ${containerId} status=${status || 'UNKNOWN'}`);
    if (status === 'FINISHED') return payload;
    if (status === 'ERROR') throw new Error(`Instagram container finished with ERROR. status=${JSON.stringify(payload)}`);
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
  throw new Error(`Instagram container polling timed out after ${POLL_TIMEOUT_MS / 1000}s`);
}

export async function publishToInstagram({videoFile, metadata, options = {}}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'instagram', status: 'failed', error: assetError};
  }

  const post = metadata.platform_posts?.instagram ?? {};
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
  const pollStatus = options.pollContainerStatus || pollContainerStatus;
  const uploadAsset = options.uploadAsset || uploadAssetToSshHost;

  let probe;
  try {
    probe = await validateToken(token, {fields: 'id,user_id,username,account_type'});
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

  let videoUrl = options.videoUrl || metadata.platform_posts?.instagram?.video_url || post.video_url;
  if (!videoUrl || !/^https:\/\//i.test(videoUrl)) {
    let hosted;
    try {
      hosted = await uploadAsset(videoFile, {env: process.env});
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

  const create = await postGraph(`/${igUserId}/media`, {
    media_type: 'REELS',
    video_url: videoUrl,
    caption
  }, token);
  if (!create.ok) {
    return {
      platform: 'instagram',
      status: 'failed',
      officialApi: 'POST /{ig-user-id}/media (REELS)',
      asset: videoFile,
      videoUrl,
      error: create.message,
      details: create.payload?.error
    };
  }
  const containerId = create.payload.id;
  try {
    await pollStatus(containerId, token);
  } catch (error) {
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

  const publish = await postGraph(`/${igUserId}/media_publish`, {
    creation_id: containerId
  }, token);
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

  return {
    platform: 'instagram',
    status: 'published',
    officialApi: 'Instagram Graph API media + media_publish',
    asset: videoFile,
    videoUrl,
    containerId,
    mediaId: publish.payload.id,
    permalink: publish.payload.permalink || `https://www.instagram.com/${probe.username}/`
  };
}
