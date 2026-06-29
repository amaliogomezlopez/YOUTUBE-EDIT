import test from 'node:test';
import assert from 'node:assert/strict';
import {YOUTUBE_UPLOAD_SCOPE, youtubeAuthUrl} from '../src/lib/youtube-oauth.js';

test('youtubeAuthUrl requests offline upload consent', () => {
  const url = new URL(youtubeAuthUrl({
    state: 'state-123',
    config: {
      clientId: 'client-id',
      clientSecret: 'client-secret',
      redirectUri: 'http://localhost:3000/api/oauth/youtube/callback'
    }
  }));
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth');
  assert.equal(url.searchParams.get('client_id'), 'client-id');
  assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:3000/api/oauth/youtube/callback');
  assert.equal(url.searchParams.get('scope'), YOUTUBE_UPLOAD_SCOPE);
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  assert.equal(url.searchParams.get('state'), 'state-123');
});
