#!/usr/bin/env node
import {createReadStream, existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createJob, loadJobState, processJob} from './lib/pipeline.js';
import {publishJob} from './lib/publishers.js';
import {ensureDataDirs, loadDotEnv, ROOT, UPLOADS_DIR, safeFilename} from './lib/utils.js';
import {planStory} from './lib/stories/planner.js';
import {renderStorySvg} from './lib/stories/renderer.js';
import {describeInstagramConfig, exchangeInstagramCode, exchangeLongLivedMetaToken, findInstagramBusinessAccount, instagramAuthUrl, validateInstagramToken} from './lib/instagram-oauth.js';
import {exchangeYoutubeCode, makeOAuthState, youtubeAuthUrl} from './lib/youtube-oauth.js';

const PUBLIC_DIR = path.join(ROOT, 'public');
const runningJobs = new Map();
const oauthStates = new Set();

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, {'content-type': 'application/json; charset=utf-8'});
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {'content-type': type});
  res.end(text);
}

function redirect(res, location) {
  res.writeHead(302, {location});
  res.end();
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.mp4': 'video/mp4',
    '.ass': 'text/plain; charset=utf-8'
  }[ext] ?? 'application/octet-stream';
}

async function serveStatic(res, file) {
  try {
    const resolved = path.resolve(file);
    if (!resolved.startsWith(PUBLIC_DIR)) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    if (!existsSync(resolved)) {
      sendText(res, 404, 'Not found');
      return;
    }
    res.writeHead(200, {'content-type': contentType(resolved)});
    const stream = createReadStream(resolved);
    stream.on('error', () => {
      if (!res.headersSent) sendText(res, 404, 'Not found');
      else res.end();
    });
    stream.pipe(res);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

function splitBuffer(buffer, delimiter) {
  const parts = [];
  let start = 0;
  let index = buffer.indexOf(delimiter, start);
  while (index !== -1) {
    parts.push(buffer.subarray(start, index));
    start = index + delimiter.length;
    index = buffer.indexOf(delimiter, start);
  }
  parts.push(buffer.subarray(start));
  return parts;
}

async function readBody(req, maxBytes = 5 * 1024 * 1024 * 1024) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Upload too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};
  for (const rawPart of splitBuffer(buffer, delimiter)) {
    let part = rawPart;
    if (part.subarray(0, 2).toString() === '\r\n') part = part.subarray(2);
    if (part.length === 0 || part.toString('utf8').startsWith('--')) continue;
    const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEnd === -1) continue;
    const headers = part.subarray(0, headerEnd).toString('utf8');
    let body = part.subarray(headerEnd + 4);
    if (body.subarray(body.length - 2).toString() === '\r\n') body = body.subarray(0, body.length - 2);
    const name = /name="([^"]+)"/.exec(headers)?.[1];
    const filename = /filename="([^"]*)"/.exec(headers)?.[1];
    if (!name) continue;
    if (filename) {
      files[name] = {filename, body};
    } else {
      fields[name] = body.toString('utf8');
    }
  }
  return {fields, files};
}

async function handleCreateJob(req, res) {
  const type = req.headers['content-type'] ?? '';
  const boundary = /boundary=([^;]+)/i.exec(type)?.[1];
  if (!boundary) {
    sendJson(res, 400, {error: 'Expected multipart/form-data.'});
    return;
  }
  const body = await readBody(req);
  const {fields, files} = parseMultipart(body, boundary);
  const video = files.video;
  let videoPath = fields.sourcePath?.trim() ? path.resolve(fields.sourcePath.trim().replace(/^["']|["']$/g, '')) : null;
  if (videoPath && !existsSync(videoPath)) {
    sendJson(res, 400, {error: `Source video path does not exist: ${videoPath}`});
    return;
  }
  if (!videoPath && !video?.body?.length) {
    sendJson(res, 400, {error: 'Missing video file or local source path.'});
    return;
  }
  await mkdir(UPLOADS_DIR, {recursive: true});
  const stamp = Date.now();
  if (!videoPath) {
    videoPath = path.join(UPLOADS_DIR, `${stamp}-${safeFilename(video.filename || 'video.mp4')}`);
    await writeFile(videoPath, video.body);
  }

  let transcriptPath = fields.transcriptPath?.trim()
    ? path.resolve(fields.transcriptPath.trim().replace(/^["']|["']$/g, ''))
    : null;
  if (transcriptPath && !existsSync(transcriptPath)) {
    sendJson(res, 400, {error: `Transcript path does not exist: ${transcriptPath}`});
    return;
  }
  if (files.transcript?.body?.length) {
    transcriptPath = path.join(UPLOADS_DIR, `${stamp}-${safeFilename(files.transcript.filename || 'transcript.srt')}`);
    await writeFile(transcriptPath, files.transcript.body);
  } else if (fields.transcriptText?.trim()) {
    transcriptPath = path.join(UPLOADS_DIR, `${stamp}-transcript.txt`);
    await writeFile(transcriptPath, fields.transcriptText.trim(), 'utf8');
  }

  const state = await createJob({videoFile: videoPath, transcriptFile: transcriptPath});
  const options = {
    topN: Number(fields.topN || 8),
    minDuration: Number(fields.minDuration || 18),
    maxDuration: Number(fields.maxDuration || 60),
    renderMode: fields.renderMode || undefined,
    renderQuality: fields.renderQuality || 'high',
    subtitleMode: fields.subtitleMode || 'words',
    useLlm: fields.useLlm === 'on'
  };
  runningJobs.set(state.id, {startedAt: Date.now()});
  processJob(state, options).catch((error) => {
    console.error(`[${state.id}] ${error.stack || error.message}`);
  }).finally(() => {
    runningJobs.delete(state.id);
  });
  sendJson(res, 202, {id: state.id, status: state.status});
}

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/oauth/youtube/start') {
    try {
      const state = makeOAuthState();
      oauthStates.add(state);
      redirect(res, youtubeAuthUrl({state}));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/youtube/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');
    if (oauthError) {
      sendText(res, 400, `Google OAuth error: ${oauthError}`);
      return;
    }
    if (!code || !state || !oauthStates.has(state)) {
      sendText(res, 400, 'OAuth callback invalido o expirado. Vuelve a abrir /api/oauth/youtube/start.');
      return;
    }
    oauthStates.delete(state);
    try {
      const tokens = await exchangeYoutubeCode(code);
      const refreshToken = tokens.refresh_token;
      if (!refreshToken) {
        sendText(res, 200, 'OAuth correcto, pero Google no devolvio refresh_token. Revoca el acceso de la app en tu cuenta Google y vuelve a abrir /api/oauth/youtube/start con prompt=consent.');
        return;
      }
      sendText(res, 200, `YouTube OAuth OK.

Copia esta linea en tu .env local y reinicia el servidor:

YOUTUBE_REFRESH_TOKEN=${refreshToken}

Scope concedido: ${tokens.scope || 'no informado por Google'}

No pegues este token en chats, commits ni capturas.`);
    } catch (error) {
      sendText(res, 500, `No se pudo canjear el codigo OAuth: ${error.message}`);
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/instagram/start') {
    try {
      const state = makeOAuthState();
      oauthStates.add(state);
      redirect(res, instagramAuthUrl({state}));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/instagram/doctor') {
    const report = {config: describeInstagramConfig(), metaAccessTokenPresent: Boolean(process.env.META_ACCESS_TOKEN)};
    try {
      report.authUrl = instagramAuthUrl();
    } catch (error) {
      report.authUrlError = error.message;
    }
    if (process.env.META_ACCESS_TOKEN) {
      try {
        report.token = await validateInstagramToken(process.env.META_ACCESS_TOKEN, {fields: 'id,user_id,username,account_type'});
        report.tokenOk = true;
      } catch (error) {
        report.tokenOk = false;
        report.tokenError = error.message;
      }
    }
    sendJson(res, 200, report);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/instagram/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');
    const oauthErrorDescription = url.searchParams.get('error_description');
    if (oauthError) {
      sendText(res, 400, `Meta OAuth error: ${oauthErrorDescription || oauthError}`);
      return;
    }
    if (!code || (state && !oauthStates.has(state))) {
      sendText(res, 400, 'OAuth callback invalido o expirado. Vuelve a abrir /api/oauth/instagram/start.');
      return;
    }
    if (state) oauthStates.delete(state);
    try {
      const shortToken = await exchangeInstagramCode(code);
      let longToken = {};
      let tokenWarning = '';
      try {
        longToken = await exchangeLongLivedMetaToken(shortToken.access_token);
      } catch (error) {
        tokenWarning = `\nAviso: no se pudo convertir a token largo; usando token corto para validar: ${error.message}\n`;
      }
      const accessToken = longToken.access_token || shortToken.access_token;
      const accountInfo = await findInstagramBusinessAccount(accessToken);
      if (!accountInfo.instagramBusinessAccount) {
        const pageNames = accountInfo.pages.map((page) => page.name).join(', ') || 'ninguna pagina visible';
const maskedFallback = accessToken.length <= 12
          ? '***'
          : `${accessToken.slice(0, 6)}…${accessToken.slice(-4)}(len=${accessToken.length})`;
        sendText(res, 200, `Meta OAuth OK, pero no encontre una cuenta profesional de Instagram conectada a las paginas visibles.

Paginas visibles: ${pageNames}

Comprueba que tu Instagram es Business/Creator, esta conectado a una pagina de Facebook, y que autorizaste permisos de paginas e Instagram.

Token generado para pruebas (guarda una copia segura localmente): ${maskedFallback}

${tokenWarning}
No pegues este token en chats, commits ni capturas.`);
        return;
      }
const maskedToken = accessToken.length <= 12
        ? '***'
        : `${accessToken.slice(0, 6)}…${accessToken.slice(-4)}(len=${accessToken.length})`;
      sendText(res, 200, `Instagram OAuth OK.

Copia estas lineas en tu .env local y reinicia el servidor:

META_ACCESS_TOKEN=<pega tu token; archivo local, no lo compartas>
INSTAGRAM_BUSINESS_ACCOUNT_ID=${accountInfo.instagramBusinessAccount.id}

Resumen saneado del token: ${maskedToken}
Cuenta detectada: ${accountInfo.instagramBusinessAccount.username || 'sin username'}.
Pagina conectada: ${accountInfo.page?.name || 'sin nombre'}.
El token caduca en aproximadamente ${longToken.expires_in ? Math.round(longToken.expires_in / 86400) : 'varios'} dias.
${tokenWarning}

No pegues estos tokens en chats, commits ni capturas. El token completo se guarda solo en .env.`);
    } catch (error) {
      sendText(res, 500, `No se pudo completar OAuth de Instagram/Meta: ${error.message}`);
    }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/stories/plan') {
    const body = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
    const story = await planStory(body.source, {title: body.title, source: body.sourceName, theme: body.theme, useLlm: body.useLlm});
    sendJson(res, 200, story);
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/stories/render') {
    const body = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
    sendText(res, 200, renderStorySvg(body.story, Number(body.index || 0), {handle: body.handle}), 'image/svg+xml; charset=utf-8');
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/jobs') {
    await handleCreateJob(req, res);
    return;
  }
  const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (req.method === 'GET' && jobMatch) {
    try {
      const state = await loadJobState(jobMatch[1]);
      sendJson(res, 200, state);
    } catch {
      sendJson(res, 404, {error: 'Job not found.'});
    }
    return;
  }
  const metadataMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/publishing-metadata$/);
  if (req.method === 'GET' && metadataMatch) {
    try {
      const state = await loadJobState(metadataMatch[1]);
      sendJson(res, 200, state.publishingMetadata ?? {error: 'Publishing metadata not ready.'});
    } catch {
      sendJson(res, 404, {error: 'Job not found.'});
    }
    return;
  }
  const publishMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/publish$/);
  if (req.method === 'POST' && publishMatch) {
    try {
      const body = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
      const state = await loadJobState(publishMatch[1]);
      const run = await publishJob(state, {clipId: body.clipId, platforms: body.platforms});
      sendJson(res, 202, run);
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  const videoMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/clips\/([^/]+)\/video$/);
  if (req.method === 'GET' && videoMatch) {
    try {
      const state = await loadJobState(videoMatch[1]);
      const clip = state.clips.find((item) => item.id === videoMatch[2]);
      if (!clip?.files?.video) {
        sendJson(res, 404, {error: 'Clip video not ready.'});
        return;
      }
      res.writeHead(200, {'content-type': 'video/mp4'});
      createReadStream(clip.files.video).pipe(res);
    } catch {
      sendJson(res, 404, {error: 'Clip not found.'});
    }
    return;
  }
  sendJson(res, 404, {error: 'Unknown API route.'});
}

async function handler(req, res) {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    const file = url.pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, url.pathname);
    await serveStatic(res, file);
  } catch (error) {
    sendJson(res, 500, {error: error.message});
  }
}

await loadDotEnv();
await ensureDataDirs();
try {
  await readFile(path.join(PUBLIC_DIR, 'index.html'));
} catch {
  throw new Error('public/index.html is missing.');
}

const port = Number(process.env.PORT || 3000);
http.createServer(handler).listen(port, () => {
  console.log(`Shortsmith MVP running at http://localhost:${port}`);
});

