import {readFile} from 'node:fs/promises';
import {manualResult, missing, validateVideoAsset} from './common.js';
import {refreshYoutubeAccessToken} from '../youtube-oauth.js';

const REQUIRED_ENV = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
const VIDEOS_INSERT_URL = 'https://www.googleapis.com/upload/youtube/v3/videos?part=snippet,status&uploadType=multipart';

function youtubeMetadata({metadata, clip, post}) {
  const title = String(post.title || clip?.suggestedTitle || metadata.titles?.youtube_shorts?.[0]?.title || 'Shortsmith upload').slice(0, 100);
  const description = String(post.description || metadata.summary?.youtube_description || metadata.summary?.short || '').slice(0, 5000);
  const tags = (post.tags || [])
    .map((tag) => String(tag).replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 30);
  return {
    snippet: {
      title,
      description,
      tags,
      categoryId: String(process.env.YOUTUBE_CATEGORY_ID || '22')
    },
    status: {
      privacyStatus: post.privacy || process.env.YOUTUBE_PRIVACY_STATUS || 'private',
      selfDeclaredMadeForKids: false
    }
  };
}

function multipartBody(metadataPart, videoBuffer) {
  const boundary = `shortsmith-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const head = Buffer.from([
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadataPart),
    `--${boundary}`,
    'Content-Type: video/mp4',
    '',
    ''
  ].join('\r\n'));
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    boundary,
    body: Buffer.concat([head, videoBuffer, tail])
  };
}

export async function publishToYoutube({videoFile, metadata, clip}) {
  const assetError = validateVideoAsset(videoFile);
  if (assetError) {
    return {platform: 'youtube', status: 'failed', error: assetError};
  }

  const post = metadata.platform_posts?.youtube_shorts ?? metadata.platform_posts?.youtube ?? {};
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

  const token = await refreshYoutubeAccessToken();
  const videoBuffer = await readFile(videoFile);
  const metadataPart = youtubeMetadata({metadata, clip, post});
  const {boundary, body} = multipartBody(metadataPart, videoBuffer);
  const response = await fetch(VIDEOS_INSERT_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token.access_token}`,
      'content-type': `multipart/related; boundary=${boundary}`,
      'content-length': String(body.length)
    },
    body
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      platform: 'youtube',
      status: 'failed',
      officialApi: 'YouTube Data API videos.insert',
      asset: videoFile,
      error: payload.error?.message || payload.error_description || `YouTube upload failed with ${response.status}`,
      details: payload.error?.errors?.map((item) => item.reason).filter(Boolean) || []
    };
  }
  return {
    platform: 'youtube',
    status: 'published',
    officialApi: 'YouTube Data API videos.insert',
    asset: videoFile,
    videoId: payload.id,
    url: payload.id ? `https://www.youtube.com/watch?v=${payload.id}` : null,
    privacyStatus: metadataPart.status.privacyStatus,
    title: metadataPart.snippet.title
  };
}
