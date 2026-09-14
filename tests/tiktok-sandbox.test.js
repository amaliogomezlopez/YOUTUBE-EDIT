import test from 'node:test';
import assert from 'node:assert/strict';
import {createTikTokSandboxSession} from '../src/lib/tiktok-sandbox.js';
const config = {clientKey: 'sandbox-key', clientSecret: 'sandbox-secret', redirectUri: 'https://example.com/callback/'};
test('Sandbox OAuth isolates credentials, consumes state once and expires tokens', async () => {
  let time = 1000;
  let exchanges = 0;
  const sandbox = createTikTokSandboxSession({now: () => time, exchange: async (code, received) => {
    exchanges++;
    assert.equal(received.clientKey, 'sandbox-key');
    return {access_token: 'private-token', expires_in: 60};
  }});
  sandbox.configure(config);
  const state = new URL(sandbox.start()).searchParams.get('state');
  await assert.rejects(sandbox.callback({state: 'wrong', code: 'code'}));
  assert.equal(exchanges, 0);
  await sandbox.callback({state, code: 'code'});
  assert.equal(sandbox.token(), 'private-token');
  assert.equal(JSON.stringify(sandbox.status()).includes('private-token'), false);
  await assert.rejects(sandbox.callback({state, code: 'code'}));
  time += 61000;
  assert.throws(() => sandbox.token());
});
test('Sandbox configuration changes invalidate pending OAuth grants', async () => {
  const sandbox = createTikTokSandboxSession();
  sandbox.configure(config);
  const state = new URL(sandbox.start()).searchParams.get('state');
  sandbox.configure({...config, clientKey: 'other-key'});
  assert.equal(sandbox.ownsState(state), false);
  await assert.rejects(sandbox.callback({state, code: 'code'}));
});
