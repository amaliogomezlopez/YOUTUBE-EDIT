import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_TIKTOK_SCOPES, tiktokAuthUrl} from '../src/lib/tiktok-oauth.js';

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
  assert.equal(url.searchParams.get('scope'), 'user.info.basic,user.info.profile,video.upload');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('state'), 'state-123');
});
