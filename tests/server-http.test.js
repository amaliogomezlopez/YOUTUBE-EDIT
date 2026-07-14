import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, rm} from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

async function freePort() {
  const server = http.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitForServer(baseUrl, child, headers = {}) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Server exited with ${child.exitCode}`);
    try {
      const response = await fetch(`${baseUrl}/api/system/status`, {headers});
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Server did not become ready');
}

async function rawGet(baseUrl, pathname, headers = {}) {
  const target = new URL(baseUrl);
  return new Promise((resolve, reject) => {
    const request = http.request({hostname: target.hostname, port: target.port, path: pathname, method: 'GET', headers}, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({status: response.statusCode, body: Buffer.concat(chunks).toString('utf8')}));
    });
    request.on('error', reject);
    request.end();
  });
}

async function waitForExit(child, timeoutMs = 4000) {
  if (child.exitCode !== null) return true;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.removeListener('exit', exited);
      resolve(false);
    }, timeoutMs);
    function exited() {
      clearTimeout(timer);
      resolve(true);
    }
    child.once('exit', exited);
  });
}

test('HTTP server applies security headers, CSRF and sanitized queue DTOs', {timeout: 20_000}, async () => {
  const dataDir = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-http-'));
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const token = 'server-test-token-123456789';
  const authorization = `Basic ${Buffer.from(`shortsmith:${token}`).toString('base64')}`;
  const authHeaders = {authorization};
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: path.resolve('.'),
    env: {...process.env, PORT: String(port), HOST: '127.0.0.1', SHORTSMITH_DATA_DIR: dataDir, SHORTSMITH_AUTH_TOKEN: token},
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  try {
    await waitForServer(baseUrl, child, authHeaders);
    assert.equal((await fetch(`${baseUrl}/`)).status, 401);
    const page = await fetch(`${baseUrl}/`, {headers: authHeaders});
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
    assert.equal(page.headers.get('x-frame-options'), 'DENY');

    const rebound = await rawGet(baseUrl, '/api/system/status', {...authHeaders, host: 'evil.example'});
    assert.equal(rebound.status, 403);
    assert.equal(JSON.parse(rebound.body).code, 'ORIGIN_BLOCKED');

    const blocked = await fetch(`${baseUrl}/api/storage/cleanup`, {method: 'POST', headers: {...authHeaders, 'content-type': 'application/json'}, body: '{}'});
    assert.equal(blocked.status, 403);
    assert.equal((await blocked.json()).code, 'CSRF_BLOCKED');

    const confirmedHeader = await fetch(`${baseUrl}/api/storage/cleanup`, {
      method: 'POST', headers: {...authHeaders, 'content-type': 'application/json', 'x-shortsmith-csrf': '1'}, body: '{}'
    });
    assert.equal(confirmedHeader.status, 400);

    const queue = await (await fetch(`${baseUrl}/api/queue`, {headers: authHeaders})).json();
    assert.ok(Array.isArray(queue.jobs));
    assert.equal(queue.jobs.some((job) => 'payload' in job || 'result' in job), false);
  } finally {
    child.kill('SIGTERM');
    if (!await waitForExit(child)) child.kill('SIGKILL');
    await rm(dataDir, {recursive: true, force: true});
    assert.equal(stderr, '');
  }
});
