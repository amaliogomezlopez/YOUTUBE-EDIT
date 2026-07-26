import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TIKTOK_SCOPES,
  queryTiktokCreatorInfo,
  refreshTiktokAccessToken,
  tiktokAuthUrl
} from '../src/lib/tiktok-oauth.js';

test('tiktokAuthUrl requests configured scopes with HTTPS redirect', () => {
  const url = new URL(tiktokAuthUrl({
    state: 'state-123',
    config: {
      clientKey: 'client-key',
      clientSecret: 'client-secret',
      redirectUri: 'https://example.com/oauth/tiktok/callback/',
      scopes: DEFAULT_TIKTOK_SCOPES
    }
  }));
  assert.equal(url.origin + url.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
  assert.equal(url.searchParams.get('client_key'), 'client-key');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://example.com/oauth/tiktok/callback/');
  assert.equal(url.searchParams.get('scope'), 'user.info.basic,user.info.profile,video.upload,video.publish');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'state-123');
});

test('TikTok refresh rotates tokens without exposing credentials', async () => {
  let request;
  const tokens = await refreshTiktokAccessToken('refresh-old', {
    clientKey: 'client-key',
    clientSecret: 'client-secret',
    redirectUri: 'https://example.com/callback',
    scopes: DEFAULT_TIKTOK_SCOPES
  }, {
    fetch: async (url, options) => {
      request = {url: String(url), options};
      return new Response(JSON.stringify({
        access_token: 'access-new',
        refresh_token: 'refresh-new',
        scope: 'video.publish'
      }), {status: 200, headers: {'content-type': 'application/json'}});
    }
  });
  assert.equal(request.url, 'https://open.tiktokapis.com/v2/oauth/token/');
  assert.equal(new URLSearchParams(request.options.body).get('grant_type'), 'refresh_token');
  assert.equal(tokens.access_token, 'access-new');
  assert.equal(tokens.refresh_token, 'refresh-new');
});

test('TikTok creator info verifies Direct Post scope and privacy options', async () => {
  let request;
  const creator = await queryTiktokCreatorInfo('access-token', {
    fetch: async (url, options) => {
      request = {url: String(url), options};
      return new Response(JSON.stringify({
        data: {
          creator_username: 'creator',
          privacy_level_options: ['SELF_ONLY'],
          max_video_post_duration_sec: 180
        },
        error: {code: 'ok', message: ''}
      }), {status: 200, headers: {'content-type': 'application/json'}});
    }
  });
  assert.equal(request.url, 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/');
  assert.equal(request.options.headers.authorization, 'Bearer access-token');
  assert.deepEqual(creator.privacy_level_options, ['SELF_ONLY']);
});
