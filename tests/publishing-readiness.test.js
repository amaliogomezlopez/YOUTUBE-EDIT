import test from 'node:test';
import assert from 'node:assert/strict';
import {publishingReadiness} from '../src/lib/publishing-readiness.js';

const KEYS = [
  'YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN',
  'META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID',
  'ASSET_HOST_PROVIDER', 'ASSET_HOST_SSH_HOST', 'ASSET_HOST_SSH_USER',
  'ASSET_HOST_SSH_KEY_PATH', 'ASSET_HOST_REMOTE_DIR', 'ASSET_HOST_PUBLIC_BASE_URL',
  'TIKTOK_ACCESS_TOKEN', 'TIKTOK_REFRESH_TOKEN', 'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET', 'TIKTOK_SCOPES', 'TIKTOK_PUBLISH_MODE', 'TIKTOK_PRIVACY_LEVEL',
  'X_USER_ACCESS_TOKEN', 'X_OAUTH2_ACCESS_TOKEN', 'X_REFRESH_TOKEN', 'X_SCOPES',
  'X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'
];

async function withEnv(values, run) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  for (const key of KEYS) delete process.env[key];
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('publishing readiness distinguishes free, paid, direct and manual modes', async () => {
  await withEnv({
    YOUTUBE_CLIENT_ID: 'client',
    YOUTUBE_CLIENT_SECRET: 'secret',
    YOUTUBE_REFRESH_TOKEN: 'refresh',
    META_ACCESS_TOKEN: 'meta-token',
    INSTAGRAM_BUSINESS_ACCOUNT_ID: 'ig-id',
    ASSET_HOST_PROVIDER: 'ssh',
    ASSET_HOST_SSH_HOST: 'example.com',
    ASSET_HOST_SSH_USER: 'user',
    ASSET_HOST_SSH_KEY_PATH: 'key',
    ASSET_HOST_REMOTE_DIR: '/videos',
    ASSET_HOST_PUBLIC_BASE_URL: 'https://example.com/videos',
    TIKTOK_ACCESS_TOKEN: 'tiktok-token',
    TIKTOK_SCOPES: 'video.publish,user.info.basic',
    TIKTOK_PUBLISH_MODE: 'direct',
    TIKTOK_PRIVACY_LEVEL: 'SELF_ONLY',
    X_USER_ACCESS_TOKEN: 'x-token',
    X_REFRESH_TOKEN: 'x-refresh',
    X_SCOPES: 'tweet.write media.write offline.access'
  }, async () => {
    const report = await publishingReadiness({
      verify: true,
      validators: {
        refreshYoutubeAccessToken: async () => ({expires_in: 3600}),
        validateInstagramToken: async () => ({
          username: 'creator',
          accountType: 'BUSINESS',
          isProfessional: true,
          matchesEnv: true
        }),
        queryTiktokCreatorInfo: async () => ({
          creator_username: 'creator',
          privacy_level_options: ['SELF_ONLY'],
          max_video_post_duration_sec: 180
        })
      }
    });
    assert.equal(report.platforms.youtube.status, 'ready');
    assert.equal(report.platforms.instagram.status, 'ready');
    assert.equal(report.platforms.tiktok.status, 'ready');
    assert.equal(report.platforms.tiktok.mode, 'direct_post');
    assert.equal(report.platforms.x.status, 'paid');
    assert.equal(report.platforms.x.freeProgrammatic, false);
  });
});

test('publishing readiness exposes invalid remote auth instead of a false ready state', async () => {
  await withEnv({
    YOUTUBE_CLIENT_ID: 'client',
    YOUTUBE_CLIENT_SECRET: 'secret',
    YOUTUBE_REFRESH_TOKEN: 'revoked'
  }, async () => {
    const error = Object.assign(new Error('invalid_grant: Bad Request'), {code: 'invalid_grant', status: 400});
    const report = await publishingReadiness({
      verify: true,
      validators: {
        refreshYoutubeAccessToken: async () => { throw error; }
      }
    });
    assert.equal(report.platforms.youtube.configured, true);
    assert.equal(report.platforms.youtube.operational, false);
    assert.equal(report.platforms.youtube.status, 'blocked');
    assert.equal(report.platforms.youtube.auth.code, 'invalid_grant');
  });
});
