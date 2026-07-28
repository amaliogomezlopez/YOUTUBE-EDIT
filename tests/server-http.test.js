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
    const pageHtml = await page.text();
    assert.match(pageHtml, /id="assets-view"/);
    assert.match(pageHtml, /id="asset-search-form"/);
    assert.match(pageHtml, /id="carousels-view"/);
    assert.match(pageHtml, /data-caption-studio/);
    assert.match(pageHtml, /name="subtitleHeroScale"/);
    assert.match(pageHtml, /id="publishing-readiness"/);
    const carouselModule = await fetch(`${baseUrl}/js/carousels.js`, {headers: authHeaders});
    assert.equal(carouselModule.status, 200);
    assert.match(carouselModule.headers.get('content-type'), /javascript/);
    const assetModule = await fetch(`${baseUrl}/js/assets.js`, {headers: authHeaders});
    assert.equal(assetModule.status, 200);
    assert.match(assetModule.headers.get('content-type'), /javascript/);
    const fontsResponse = await fetch(`${baseUrl}/api/fonts`, {headers: authHeaders});
    assert.equal(fontsResponse.status, 200);
    const fonts = await fontsResponse.json();
    assert.ok(fonts.fonts.some((font) => font.family === 'Arial'));
    const previewResponse = await fetch(`${baseUrl}/api/captions/preview`, {
      method: 'POST',
      headers: {...authHeaders, 'content-type': 'application/json', 'x-shortsmith-csrf': '1'},
      body: JSON.stringify({text: 'donde por primera vez todo cambia', style: {preset: 'progressive-reference'}})
    });
    assert.equal(previewResponse.status, 200);
    const captionPreview = await previewResponse.json();
    assert.equal(captionPreview.plan.style.outlineSize, 0);
    assert.deepEqual(captionPreview.plan.pages[0].lines.map((line) => line.role), ['lead', 'hero', 'tail']);
    const system = await (await fetch(`${baseUrl}/api/system/status`, {headers: authHeaders})).json();
    assert.equal(system.app.version, '0.4.0');

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

    const carouselResponse = await fetch(`${baseUrl}/api/carousels`, {
      method: 'POST',
      headers: {...authHeaders, 'content-type': 'application/json', 'x-shortsmith-csrf': '1'},
      body: JSON.stringify({title: 'Prueba HTTP', slideCount: 5, useLlm: false, source: 'Carouselsmith guarda proyectos locales editables. Cada afirmación mantiene una referencia a la fuente. El renderer genera piezas cuatro por cinco y nueve por dieciséis. La revisión humana ocurre antes de exportar. Las imágenes se consideran apoyo visual y no evidencia.'})
    });
    assert.equal(carouselResponse.status, 201);
    const carousel = await carouselResponse.json();
    assert.equal(carousel.slides.length, 5);
    assert.equal('filename' in (carousel.assets[0] || {}), false);

    const preview = await fetch(`${baseUrl}/api/carousels/${carousel.id}/preview/${carousel.slides[0].id}?format=instagram-feed`, {headers: authHeaders});
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get('content-type'), /image\/svg\+xml/);
    assert.match(await preview.text(), /width="1080" height="1350"/);

    const renderedResponse = await fetch(`${baseUrl}/api/carousels/${carousel.id}/render`, {
      method: 'POST', headers: {...authHeaders, 'content-type': 'application/json', 'x-shortsmith-csrf': '1'}, body: JSON.stringify({formats: ['instagram-feed']})
    });
    assert.equal(renderedResponse.status, 200);
    const rendered = await renderedResponse.json();
    assert.equal(rendered.renders.outputs.length, 5);
    const contact = await fetch(`${baseUrl}${rendered.renders.contactSheetUrl}`, {headers: authHeaders});
    assert.equal(contact.status, 200);
    assert.equal(contact.headers.get('content-type'), 'image/png');

    const invalidOrder = [carousel.slides[1].id, carousel.slides[0].id, ...carousel.slides.slice(2).map((slide) => slide.id)];
    const invalidReorder = await fetch(`${baseUrl}/api/carousels/${carousel.id}`, {
      method: 'PATCH', headers: {...authHeaders, 'content-type': 'application/json', 'x-shortsmith-csrf': '1'}, body: JSON.stringify({slideOrder: invalidOrder})
    });
    assert.equal(invalidReorder.status, 400);
    assert.equal((await invalidReorder.json()).code, 'CAROUSEL_FIXED_EDGES');
  } finally {
    child.kill('SIGTERM');
    if (!await waitForExit(child)) child.kill('SIGKILL');
    await rm(dataDir, {recursive: true, force: true});
    assert.equal(stderr, '');
  }
});
