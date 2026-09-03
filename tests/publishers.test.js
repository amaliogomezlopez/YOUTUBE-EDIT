import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {publishJob} from '../src/lib/publishers.js';
import {publishToInstagram} from '../src/lib/publishers/instagram.js';
import {planTikTokUpload, publishToTiktok, uploadVideoFile} from '../src/lib/publishers/tiktok.js';
import {publishToX} from '../src/lib/publishers/x.js';
import {makePkceChallenge, xAuthUrl} from '../src/lib/x-oauth.js';

const PUBLISHER_ENV_KEYS = [
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
  'META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET', 'TIKTOK_ACCESS_TOKEN', 'TIKTOK_REFRESH_TOKEN',
  'TIKTOK_SCOPES', 'TIKTOK_PUBLISH_MODE', 'TIKTOK_PRIVACY_LEVEL',
  'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET',
  'X_BEARER_TOKEN', 'X_CLIENT_ID', 'X_CLIENT_SECRET', 'X_REDIRECT_URI',
  'X_REFRESH_TOKEN', 'X_SCOPES', 'X_TOKEN_EXPIRES_IN',
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

test('publishJob reuses a persisted idempotency key', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  for (const key of PUBLISHER_ENV_KEYS) delete process.env[key];
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-idempotent-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const state = {
      id: 'job-idempotent',
      jobDir,
      publishingMetadata: {summary: {short: 'Resumen'}, platform_posts: {}},
      clips: [{id: 'clip-1', files: {video: videoFile}}]
    };
    const first = await publishJob(state, {platforms: ['youtube'], idempotencyKey: 'request-1'});
    const second = await publishJob(state, {platforms: ['youtube'], idempotencyKey: 'request-1'});
    assert.equal(second.id, first.id);
    assert.equal((await import('../src/lib/utils.js').then(({readJson}) => readJson(path.join(jobDir, 'publish-runs.json')))).length, 1);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('publishJob persists remote upload state before the platform completes', async () => {
  const keys = ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) process.env[key] = `${key}-test`;
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-remote-state-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, '0123456789');
    const state = {
      id: 'job-remote', jobDir,
      publishingMetadata: {summary: {}, titles: {}, platform_posts: {youtube_shorts: {title: 'Título'}}},
      clips: [{id: 'clip-1', files: {video: videoFile}}]
    };
    const run = await publishJob(state, {
      platforms: ['youtube'], idempotencyKey: 'remote-1',
      connectorOptions: {youtube: {
        refreshAccessToken: async () => ({access_token: 'token'}),
        initiateUpload: async () => 'https://upload.youtube.test/persisted-session',
        uploadVideo: async (_url, _file, size, options) => {
          await options.onProgress({bytesUploaded: size, totalBytes: size, percent: 100, phase: 'uploaded'});
          return {id: 'video-remote'};
        }
      }}
    });
    assert.equal(run.platforms.youtube.remote.videoId, 'video-remote');
    const savedRuns = JSON.parse(await import('node:fs/promises').then(({readFile}) => readFile(path.join(jobDir, 'publish-runs.json'), 'utf8')));
    assert.equal(savedRuns[0].platforms.youtube.remote.uploadUrl, 'https://upload.youtube.test/persisted-session');
    assert.equal(savedRuns[0].platforms.youtube.remote.videoId, 'video-remote');
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
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
        },
        pollPostStatus: async ({publishId}) => {
          assert.equal(publishId, 'publish-1');
          return {status: 'requires_manual_action', tiktokStatus: 'SEND_TO_USER_INBOX', terminal: true, polls: 1, timedOut: false};
        }
      }
    });
    assert.equal(result.status, 'requires_manual_action');
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

test('tiktok publisher queries creator settings and completes Direct Post', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.TIKTOK_ACCESS_TOKEN = 'access-token';
  delete process.env.TIKTOK_REFRESH_TOKEN;
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-tiktok-direct-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    const result = await publishToTiktok({
      videoFile,
      clip: {start: 10, end: 40},
      metadata: {
        summary: {short: 'Resumen'},
        platform_posts: {tiktok: {caption: 'Caption TikTok'}}
      },
      options: {
        mode: 'direct',
        privacyLevel: 'SELF_ONLY',
        queryCreatorInfo: async (token) => {
          assert.equal(token, 'access-token');
          return {
            creator_username: 'creator',
            creator_nickname: 'Creator',
            privacy_level_options: ['SELF_ONLY'],
            max_video_post_duration_sec: 180,
            stitch_disabled: true
          };
        },
        initDirectUpload: async ({postInfo}) => {
          assert.equal(postInfo.privacy_level, 'SELF_ONLY');
          assert.equal(postInfo.disable_stitch, true);
          return {data: {upload_url: 'https://upload.example.com/direct', publish_id: 'publish-direct'}};
        },
        uploadVideoFile: async () => {},
        pollPostStatus: async () => ({
          status: 'published',
          tiktokStatus: 'PUBLISH_COMPLETE',
          terminal: true,
          polls: 1,
          timedOut: false,
          postIds: ['post-direct']
        })
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.mode, 'direct_post');
    assert.equal(result.privacyLevel, 'SELF_ONLY');
    assert.equal(result.creator.username, 'creator');
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('tiktok publisher refreshes and persists rotating OAuth tokens', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.TIKTOK_CLIENT_KEY = 'client-key';
  process.env.TIKTOK_CLIENT_SECRET = 'client-secret';
  process.env.TIKTOK_ACCESS_TOKEN = 'access-old';
  process.env.TIKTOK_REFRESH_TOKEN = 'refresh-old';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-tiktok-refresh-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    let persisted;
    const result = await publishToTiktok({
      videoFile,
      metadata: {summary: {short: 'Resumen'}, platform_posts: {tiktok: {caption: 'Caption'}}},
      options: {
        refreshAccessToken: async () => ({
          access_token: 'access-new',
          refresh_token: 'refresh-new',
          scope: 'video.upload'
        }),
        persistTokens: async (values) => { persisted = values; },
        initUpload: async ({accessToken}) => {
          assert.equal(accessToken, 'access-new');
          return {data: {upload_url: 'https://upload.example.com/video', publish_id: 'publish-refresh'}};
        },
        uploadVideoFile: async () => {},
        pollPostStatus: async () => ({
          status: 'requires_manual_action',
          tiktokStatus: 'SEND_TO_USER_INBOX',
          terminal: true,
          polls: 1
        })
      }
    });
    assert.equal(result.status, 'requires_manual_action');
    assert.equal(persisted.TIKTOK_ACCESS_TOKEN, 'access-new');
    assert.equal(persisted.TIKTOK_REFRESH_TOKEN, 'refresh-new');
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('tiktok upload plan chunks videos larger than 64 MB', () => {
  assert.deepEqual(planTikTokUpload(64_000_000), {
    chunkSize: 64_000_000,
    totalChunkCount: 1
  });
  assert.deepEqual(planTikTokUpload(64_000_001), {
    chunkSize: 32_000_000,
    totalChunkCount: 2
  });
  assert.deepEqual(planTikTokUpload(100_000_000), {
    chunkSize: 32_000_000,
    totalChunkCount: 3
  });
  assert.throws(() => planTikTokUpload(0), /no vacio/);
});

test('tiktok uploader reads and sends sequential chunks without loading the whole file', async () => {
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-tiktok-chunks-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'abcdefghijklm');
    const calls = [];
    await uploadVideoFile('https://upload.example.com/video', videoFile, 13, {
      plan: {chunkSize: 5, totalChunkCount: 2},
      retries: 1,
      fetch: async (url, options) => {
        calls.push({
          url,
          range: options.headers['content-range'],
          length: options.headers['content-length'],
          body: Buffer.from(options.body).toString('utf8')
        });
        return {ok: true, status: calls.length === 2 ? 201 : 206};
      }
    });
    assert.deepEqual(calls, [
      {
        url: 'https://upload.example.com/video',
        range: 'bytes 0-4/13',
        length: '5',
        body: 'abcde'
      },
      {
        url: 'https://upload.example.com/video',
        range: 'bytes 5-12/13',
        length: '8',
        body: 'fghijklm'
      }
    ]);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
  }
});

test('tiktok publisher resumes persisted upload state and keeps publish id', async () => {
  const saved = process.env.TIKTOK_ACCESS_TOKEN;
  process.env.TIKTOK_ACCESS_TOKEN = 'access-token';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-tiktok-resume-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, '0123456789');
    const result = await publishToTiktok({
      videoFile,
      metadata: {summary: {short: 'Resumen'}, platform_posts: {tiktok: {caption: 'Caption'}}},
      options: {
        resumeState: {uploadUrl: 'https://upload.example/existing', publishId: 'publish-existing', videoSize: 10, bytesUploaded: 10},
        initUpload: async () => assert.fail('must not initialize another upload'),
        uploadVideoFile: async () => assert.fail('completed upload must not be repeated'),
        pollPostStatus: async ({publishId}) => ({status: 'published', tiktokStatus: 'PUBLISH_COMPLETE', postIds: ['post-1'], publishId, polls: 1})
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.publishId, 'publish-existing');
  } finally {
    await rm(jobDir, {recursive: true, force: true});
    if (saved === undefined) delete process.env.TIKTOK_ACCESS_TOKEN; else process.env.TIKTOK_ACCESS_TOKEN = saved;
  }
});

test('instagram and X stop for manual reconciliation after an ambiguous remote create', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.META_ACCESS_TOKEN = 'token';
  process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID = '178';
  process.env.X_USER_ACCESS_TOKEN = 'x-token';
  try {
    const instagram = await publishToInstagram({
      videoFile: 'D:\\clips\\short.mp4', metadata: {summary: {}, platform_posts: {instagram: {caption: 'Caption'}}},
      options: {
        resumeState: {phase: 'publishing', containerId: 'container-1', videoUrl: 'https://example.com/video.mp4'},
        validateInstagramToken: async () => ({isProfessional: true, matchesEnv: true, username: 'test'}),
        graphPost: async () => assert.fail('ambiguous publish must not be repeated')
      }
    });
    assert.equal(instagram.status, 'requires_manual_action');

    const x = await publishToX({
      videoFile: 'D:\\clips\\short.mp4', metadata: {summary: {}, platform_posts: {x: {text: 'Post'}}},
      options: {resumeState: {phase: 'posting', mediaId: 'media-1', uploadMode: 'oauth2_v2'}}
    });
    assert.equal(x.status, 'requires_manual_action');
  } finally {
    for (const [key, value] of Object.entries(saved)) value === undefined ? delete process.env[key] : process.env[key] = value;
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
  delete process.env.X_REFRESH_TOKEN;
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

test('x publisher refreshes and persists OAuth2 tokens before upload', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.X_USER_ACCESS_TOKEN = 'x-old';
  process.env.X_REFRESH_TOKEN = 'refresh-old';
  process.env.X_CLIENT_ID = 'client-id';
  process.env.X_CLIENT_SECRET = 'client-secret';
  const jobDir = await mkdtemp(path.join(tmpdir(), 'shortsmith-x-refresh-'));
  try {
    const videoFile = path.join(jobDir, 'short.mp4');
    await writeFile(videoFile, 'fake video');
    let persisted;
    const result = await publishToX({
      videoFile,
      metadata: {summary: {short: 'Resumen'}, platform_posts: {x: {text: 'Post X'}}},
      options: {
        refreshAccessToken: async () => ({
          access_token: 'x-new',
          refresh_token: 'refresh-new',
          scope: 'tweet.write media.write offline.access',
          expires_in: 7200
        }),
        persistTokens: async (values) => { persisted = values; },
        uploadVideo: async ({token}) => {
          assert.equal(token, 'x-new');
          return {mediaId: 'media-refresh'};
        },
        createPost: async ({token}) => {
          assert.equal(token, 'x-new');
          return {data: {id: 'tweet-refresh'}};
        }
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(persisted.X_USER_ACCESS_TOKEN, 'x-new');
    assert.equal(persisted.X_REFRESH_TOKEN, 'refresh-new');
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
  delete process.env.X_REFRESH_TOKEN;
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

test('x publisher falls back to OAuth1 media upload and creates the post through API v2', async () => {
  const saved = Object.fromEntries(PUBLISHER_ENV_KEYS.map((key) => [key, process.env[key]]));
  process.env.X_USER_ACCESS_TOKEN = 'x-user-token';
  delete process.env.X_REFRESH_TOKEN;
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
        createPost: async ({token, text, mediaId}) => {
          assert.equal(token, 'x-user-token');
          assert.equal(text, 'Post X');
          assert.equal(mediaId, 'media-oauth1');
          return {data: {id: 'tweet-oauth1'}};
        },
        createPostOAuth1: async () => {
          assert.fail('OAuth1 posting should not be used when an OAuth2 user token is available');
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
