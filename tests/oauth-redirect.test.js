import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeOAuthPath, publicOAuthCallback} from '../src/lib/oauth-redirect.js';
import {instagramRedirectUri} from '../src/lib/instagram-oauth.js';
import {youtubeRedirectUri} from '../src/lib/youtube-oauth.js';
import {xRedirectUri} from '../src/lib/x-oauth.js';

function withEnv(updates, fn) {
  const previous = {};
  for (const key of Object.keys(updates)) {
    previous[key] = process.env[key];
    if (updates[key] === undefined) delete process.env[key];
    else process.env[key] = updates[key];
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('publicOAuthCallback builds stable shortsmith callback URLs', () => {
  withEnv({SHORTSMITH_PUBLIC_BASE_URL: 'https://sibelion.ddns.net:8443/'}, () => {
    assert.equal(
      publicOAuthCallback('instagram'),
      'https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback'
    );
  });
});

test('provider redirect URIs prefer explicit provider env over public base URL', () => {
  withEnv({
    SHORTSMITH_PUBLIC_BASE_URL: 'https://sibelion.ddns.net:8443',
    META_REDIRECT_URI: 'https://example.com/ig',
    YOUTUBE_REDIRECT_URI: 'https://example.com/yt',
    X_REDIRECT_URI: 'https://example.com/x',
    X_REDIRECT_URI_NEW_APP: undefined
  }, () => {
    assert.equal(instagramRedirectUri(), 'https://example.com/ig');
    assert.equal(youtubeRedirectUri(), 'https://example.com/yt');
    assert.equal(xRedirectUri(), 'https://example.com/x');
  });
});

test('provider redirect URIs use SHORTSMITH_PUBLIC_BASE_URL when explicit env is missing', () => {
  withEnv({
    SHORTSMITH_PUBLIC_BASE_URL: 'https://sibelion.ddns.net:8443',
    META_REDIRECT_URI: undefined,
    YOUTUBE_REDIRECT_URI: undefined,
    X_REDIRECT_URI: undefined,
    X_REDIRECT_URI_NEW_APP: undefined
  }, () => {
    assert.equal(instagramRedirectUri(), 'https://sibelion.ddns.net:8443/shortsmith/oauth/instagram/callback');
    assert.equal(youtubeRedirectUri(), 'https://sibelion.ddns.net:8443/shortsmith/oauth/youtube/callback');
    assert.equal(xRedirectUri(), 'https://sibelion.ddns.net:8443/shortsmith/oauth/x/callback');
  });
});

test('normalizeOAuthPath maps public shortsmith OAuth routes to API routes', () => {
  assert.equal(
    normalizeOAuthPath('/shortsmith/oauth/instagram/callback'),
    '/api/oauth/instagram/callback'
  );
  assert.equal(normalizeOAuthPath('/api/oauth/instagram/callback'), '/api/oauth/instagram/callback');
});
