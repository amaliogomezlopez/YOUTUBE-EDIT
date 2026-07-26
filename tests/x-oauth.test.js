import test from 'node:test';
import assert from 'node:assert/strict';
import {refreshXAccessToken} from '../src/lib/x-oauth.js';

test('X OAuth refresh uses confidential client authentication', async () => {
  let request;
  const tokens = await refreshXAccessToken('refresh-old', {
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'https://example.com/callback',
    scopes: ['offline.access']
  }, {
    fetch: async (url, options) => {
      request = {url: String(url), options};
      return new Response(JSON.stringify({
        access_token: 'access-new',
        refresh_token: 'refresh-new',
        scope: 'offline.access tweet.write media.write',
        expires_in: 7200
      }), {status: 200, headers: {'content-type': 'application/json'}});
    }
  });

  assert.equal(request.url, 'https://api.x.com/2/oauth2/token');
  assert.equal(request.options.headers.authorization, `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`);
  assert.equal(new URLSearchParams(request.options.body).get('grant_type'), 'refresh_token');
  assert.equal(tokens.refresh_token, 'refresh-new');
});
