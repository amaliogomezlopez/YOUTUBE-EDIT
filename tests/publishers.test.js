import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {publishJob} from '../src/lib/publishers.js';
import {publishToInstagram} from '../src/lib/publishers/instagram.js';
import {publishToTiktok} from '../src/lib/publishers/tiktok.js';
import {publishToX} from '../src/lib/publishers/x.js';
import {makePkceChallenge, xAuthUrl} from '../src/lib/x-oauth.js';

const PUBLISHER_ENV_KEYS = [
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
  'META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN',
  'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET',
  'X_BEARER_TOKEN', 'X_CLIENT_ID', 'X_CLIENT_SECRET', 'X_REFRESH_TOKEN',
  'X_USER_ACCESS_TOKEN', 'X_OAUTH2_ACCESS_TOKEN',
  'X_CLIENT_ID_NEW_APP', 'X_CLIENT_SECRET_NEW_APP', 'X_REDIRECT_URI_NEW_APP', 'X_SCOPES_NEW_APP'
];

test('publishJob prepares all platform runs without configured credentials', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PUBLISHER_ENV_KEYS) delete process.env[key];
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-publish-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const state = {
      id: 'job-test',
      jobDir,
      publishingMetadata: {
        summary: {short: 'Resumen del video', youtube_description: 'Descripcion'},
        titles: {youtube_shorts: [{title: 'Titulo short'}]},
        platform_posts: {
          youtube_shorts: {title: 'Titulo short', description: 'Descripcion', tags: ['shorts']},
          instagram: {caption: 'Caption IG'},
          tiktok: {caption: 'Caption TikTok'},
          x: {text: 'Post X'}
        }
      },
      clips: [{id: 'clip-1', rank: 1, files: {video: videoFile}}]
    };

    const run = await publishJob(state);
    assert.equal(run.status, 'requires_manual_action');
    assert.deepEqual(Object.keys(run.platforms), ['youtube', 'instagram', 'tiktok', 'x']);
    assert.equal(run.platforms.instagram.status, 'requires_manual_action');
    assert.match(run.platforms.youtube.reason, /YouTube Data API/);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('tiktok publisher initializes and uploads draft video', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.TIKTOK_CLIENT_KEY = 'client-key';
  process.env.TIKTOK_CLIENT_SECRET = 'client-secret';
  process.env.TIKTOK_ACCESS_TOKEN = 'access-token';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-tiktok-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const calls = [];
    const result = await publishToTiktok({
      videoFile,
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {tiktok: {caption: 'Caption TikTok'}}
      },
      options: {
        initUpload: async (input) => {
          calls.push(input);
          assert.equal(input.videoSize, 10);
          assert.equal(input.postInfo.title, 'Caption TikTok');
          return {data: {upload_url: 'https://upload.example.com/video', publish_id: 'publish-1'}};
        },
        uploadVideoFile: async (uploadUrl, file, size) => {
          assert.equal(uploadUrl, 'https://upload.example.com/video');
          assert.equal(file, videoFile);
          assert.equal(size, 10);
        }
      }
    });
    assert.equal(result.status, 'processing');
    assert.equal(result.mode, 'draft_upload');
    assert.equal(result.publishId, 'publish-1');
    assert.equal(calls[0].accessToken, 'access-token');
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('instagram publisher uses provided HTTPS videoUrl', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.META_ACCESS_TOKEN = 'token';
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '178';
  try {
    const calls = [];
    const result = await publishToInstagram({
      videoFile: 'D:\\clips\\short.mp4',
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {instagram: {caption: 'Caption'}}
      },
      options: {
        videoUrl: 'https://example.com/short.mp4',
        validateInstagramToken: async () => ({
          isProfessional: true,
          matchesEnv: true,
          username: 'amaliometria'
        }),
        graphPost: async (path, body) => {
          calls.push({path, body});
          return path.endsWith('/media')
            ? {ok: true, payload: {id: 'container-1'}}
            : {ok: true, payload: {id: 'media-1'}};
        },
        graphGetMedia: async () => ({permalink: 'https://www.instagram.com/reel/media-1/'}),
        pollContainerStatus: async () => ({status_code: 'FINISHED'}),
        uploadAsset: async () => {
          throw new Error('upload should not run');
        }
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.videoUrl, 'https://example.com/short.mp4');
    assert.equal(result.permalink, 'https://www.instagram.com/reel/media-1/');
    assert.equal(calls[0].body.video_url, 'https://example.com/short.mp4');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('instagram publisher uploads to asset host when videoUrl is missing', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.META_ACCESS_TOKEN = 'token';
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '178';
  try {
    const result = await publishToInstagram({
      videoFile: 'D:\\clips\\short.mp4',
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {instagram: {caption: 'Caption'}}
      },
      options: {
        validateInstagramToken: async () => ({
          isProfessional: true,
          matchesEnv: true,
          username: 'amaliometria'
        }),
        graphPost: async (path, body) => (
          path.endsWith('/media')
            ? (assert.equal(body.video_url, 'https://cdn.example.com/short.mp4'), {ok: true, payload: {id: 'container-1'}})
            : {ok: true, payload: {id: 'media-1'}}
        ),
        graphGetMedia: async () => ({permalink: 'https://www.instagram.com/reel/media-1/'}),
        pollContainerStatus: async () => ({status_code: 'FINISHED'}),
        uploadAsset: async () => ({ok: true, publicUrl: 'https://cdn.example.com/short.mp4'})
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.videoUrl, 'https://cdn.example.com/short.mp4');
    assert.equal(result.permalink, 'https://www.instagram.com/reel/media-1/');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('x publisher returns manual action without OAuth2 user token', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PUBLISHER_ENV_KEYS) delete process.env[key];
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-x-missing-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const result = await publishToX({
      videoFile,
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {x: {text: 'Post X'}}
      }
    });
    assert.equal(result.status, 'requires_manual_action');
    assert.equal(result.asset, videoFile);
    assert.equal(result.text, 'Post X');
    assert.deepEqual(result.missingEnv, ['X_USER_ACCESS_TOKEN']);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('x publisher uploads video and creates post', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.X_USER_ACCESS_TOKEN = 'x-user-token';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-x-publish-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const calls = [];
    const result = await publishToX({
      videoFile,
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {x: {text: 'Post X'}}
      },
      options: {
        uploadVideo: async (input) => {
          calls.push(input);
          assert.equal(input.token, 'x-user-token');
          assert.equal(input.videoFile, videoFile);
          assert.equal(input.videoSize, 10);
          return {mediaId: 'media-1'};
        },
        createPost: async ({token, text, mediaId}) => {
          assert.equal(token, 'x-user-token');
          assert.equal(text, 'Post X');
          assert.equal(mediaId, 'media-1');
          return {data: {id: 'tweet-1'}};
        }
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.mediaId, 'media-1');
    assert.equal(result.postId, 'tweet-1');
    assert.equal(result.url, 'https://x.com/i/web/status/tweet-1');
    assert.equal(calls.length, 1);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('x publisher returns failed with sanitized API error', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.X_USER_ACCESS_TOKEN = 'x-user-token';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-x-error-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const result = await publishToX({
      videoFile,
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {x: {text: 'Post X'}}
      },
      options: {
        uploadVideo: async () => {
          throw new Error('403 Forbidden Bearer x-user-token');
        }
      }
    });
    assert.equal(result.status, 'failed');
    assert.match(result.error, /403 Forbidden Bearer \[redacted\]/);
    assert.doesNotMatch(result.error, /x-user-token/);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('x publisher falls back to OAuth1 media upload and post', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.X_USER_ACCESS_TOKEN = 'x-user-token';
  process.env.X_API_KEY = 'api-key';
  process.env.X_API_SECRET = 'api-secret';
  process.env.X_ACCESS_TOKEN = 'access-token';
  process.env.X_ACCESS_TOKEN_SECRET = 'access-secret';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-x-oauth1-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const result = await publishToX({
      videoFile,
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {x: {text: 'Post X'}}
      },
      options: {
        uploadVideo: async () => {
          throw new Error('Forbidden');
        },
        uploadVideoOAuth1: async ({videoSize, credentials}) => {
          assert.equal(videoSize, 10);
          assert.equal(credentials.consumerKey, 'api-key');
          return {mediaId: 'media-oauth1'};
        },
        createPostOAuth1: async ({text, mediaId, credentials}) => {
          assert.equal(text, 'Post X');
          assert.equal(mediaId, 'media-oauth1');
          assert.equal(credentials.token, 'access-token');
          return {id_str: 'tweet-oauth1'};
        }
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.uploadMode, 'oauth1_1_1');
    assert.equal(result.mediaId, 'media-oauth1');
    assert.equal(result.postId, 'tweet-oauth1');
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('x OAuth URL includes manual media.write scope for new app aliases', () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.X_CLIENT_ID_NEW_APP = 'client-id';
  process.env.X_CLIENT_SECRET_NEW_APP = 'client-secret';
  process.env.X_REDIRECT_URI_NEW_APP = 'https://127.0.0.1:3000/api/oauth/x/callback';
  delete process.env.X_SCOPES_NEW_APP;
  try {
    const url = new URL(xAuthUrl({
      state: 'state-1',
      codeChallenge: makePkceChallenge('verifier')
    }));
    assert.equal(url.searchParams.get('client_id'), 'client-id');
    assert.equal(url.searchParams.get('redirect_uri'), 'https://127.0.0.1:3000/api/oauth/x/callback');
    assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
    assert.ok(url.searchParams.get('scope').split(' ').includes('media.write'));
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
