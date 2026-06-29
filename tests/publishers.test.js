import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {publishJob} from '../src/lib/publishers.js';
import {publishToInstagram} from '../src/lib/publishers/instagram.js';

const PUBLISHER_ENV_KEYS = [
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
  'META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'TIKTOK_CLIENT_KEY', 'TIKTOK_CLIENT_SECRET',
  'X_API_KEY', 'X_API_SECRET'
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
        pollContainerStatus: async () => ({status_code: 'FINISHED'}),
        uploadAsset: async () => {
          throw new Error('upload should not run');
        }
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.videoUrl, 'https://example.com/short.mp4');
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
        pollContainerStatus: async () => ({status_code: 'FINISHED'}),
        uploadAsset: async () => ({ok: true, publicUrl: 'https://cdn.example.com/short.mp4'})
      }
    });
    assert.equal(result.status, 'published');
    assert.equal(result.videoUrl, 'https://cdn.example.com/short.mp4');
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
