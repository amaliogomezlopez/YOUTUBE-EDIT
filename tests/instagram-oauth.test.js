import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_INSTAGRAM_SCOPES, describeInstagramConfig, instagramAuthUrl, validateInstagramOAuthConfig} from '../src/lib/instagram-oauth.js';

test('instagramAuthUrl requests configured Meta scopes', () => {
  const url = new URL(instagramAuthUrl({
    state: 'state-ig',
    config: {
      appId: 'app-id',
      appSecret: 'app-secret',
      redirectUri: 'http://localhost:3000/api/oauth/instagram/callback',
      scopes: DEFAULT_INSTAGRAM_SCOPES
    }
  }));
  assert.equal(url.origin + url.pathname, 'https://www.facebook.com/dialog/oauth');
  assert.equal(url.searchParams.get('client_id'), 'app-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/api/oauth/instagram/callback');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), DEFAULT_INSTAGRAM_SCOPES.join(','));
  assert.equal(url.searchParams.get('state'), 'state-ig');
});

test('instagramAuthUrl uses Instagram Login for business scopes', () => {
  const url = new URL(instagramAuthUrl({
    state: 'state-ig-business',
    config: {
      appId: 'app-id',
      appSecret: 'app-secret',
      redirectUri: 'http://localhost:3000/api/oauth/instagram/callback',
      scopes: ['instagram_business_basic', 'instagram_business_content_publish']
    }
  }));
  assert.equal(url.origin + url.pathname, 'https://www.instagram.com/oauth/authorize');
  assert.equal(url.searchParams.get('scope'), 'instagram_business_basic,instagram_business_content_publish');
  assert.equal(url.searchParams.get('enable_fb_login'), '0');
  assert.equal(url.searchParams.get('force_authentication'), '1');
});

test('instagramAuthUrl can omit scopes for dashboard-controlled Instagram Login', () => {
  const url = new URL(instagramAuthUrl({
    state: 'state-ig-business',
    config: {
      appId: 'app-id',
      appSecret: 'app-secret',
      redirectUri: 'http://localhost:3000/api/oauth/instagram/callback',
      scopes: ['instagram_business_basic', 'instagram_business_content_publish'],
      omitScopes: true
    }
  }));
  assert.equal(url.origin + url.pathname, 'https://www.instagram.com/oauth/authorize');
  assert.equal(url.searchParams.has('scope'), false);
  assert.equal(url.searchParams.get('enable_fb_login'), '0');
  assert.equal(url.searchParams.get('force_authentication'), '1');
});

test('validateInstagramOAuthConfig reports missing appId and appSecret', () => {
  const missing = validateInstagramOAuthConfig({appId: null, appSecret: null, scopes: []});
  assert.deepEqual(missing, ['META_APP_ID', 'META_APP_SECRET']);
});

test('describeInstagramConfig masks secret and detects instagram login', () => {
  const report = describeInstagramConfig({
    appId: '166717702120911',
    appSecret: '0123456789abcdef0123456789abcdef',
    redirectUri: 'https://example.com/cb',
    omitScopes: false,
    scopes: ['instagram_business_basic', 'instagram_business_content_publish']
  });
  assert.equal(report.appId, '166717702120911');
  assert.equal(report.hasAppSecret, true);
  assert.match(report.appSecretMasked, /0123…cdef\(32\)/);
  assert.equal(report.usesInstagramLogin, true);
  assert.equal(report.usesMetaLogin, false);
  assert.deepEqual(report.missingEnv, []);
});
