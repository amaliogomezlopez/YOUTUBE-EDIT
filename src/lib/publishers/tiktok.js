import {readFile, stat} from 'node:fs/promises';
import {manualResult, missing, validateVideoAsset} from './common.js';

const REQUIRED_ENV = ['TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN'];
const TIKTOK_INBOX_INIT_URL = 'https://open.tiktokapis.com/v2/post/publish/inbox/video/init/';

async function initInboxUpload({accessToken, videoSize, chunkSize = videoSize, totalChunkCount = 1, postInfo = {}}) {
  const response = await fetch(TIKTOK_INBOX_INIT_URL, {
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
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.error?.code) {
    throw new Error(payload.error?.message || payload.error_description || `TikTok inbox init failed with ${response.status}`);
  }
  return payload;
}

async function uploadVideoFile(uploadUrl, videoFile, videoSize) {
  const body = await readFile(videoFile);
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': 'video/mp4',
      'content-length': String(videoSize),
      'content-range': `bytes 0-${videoSize - 1}/${videoSize}`
    },
    body
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || `TikTok video upload failed with ${response.status}`);
  }
}

export async function publishToTiktok({videoFile, metadata, options = {}}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'tiktok', status: 'failed', error: assetError};
  }

  const post = metadata.platform_posts?.tiktok ?? {};
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

  try {
    const videoSize = (await stat(videoFile)).size;
    const init = await initUpload({
      accessToken,
      videoSize,
      chunkSize: videoSize,
      totalChunkCount: 1,
      postInfo: {title: caption}
    });
    const uploadUrl = init.data?.upload_url || init.upload_url;
    const publishId = init.data?.publish_id || init.publish_id;
    if (!uploadUrl || !publishId) {
      throw new Error('TikTok no devolvio upload_url/publish_id.');
    }
    await putVideo(uploadUrl, videoFile, videoSize);
    return {
      platform: 'tiktok',
      status: 'processing',
      officialApi: 'TikTok Content Posting API inbox video init + upload',
      mode: 'draft_upload',
      asset: videoFile,
      caption,
      publishId,
      nextStep: 'Revisa el borrador/inbox en TikTok y completa la publicacion manualmente.'
    };
  } catch (error) {
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
