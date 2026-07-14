#!/usr/bin/env node
import {createReadStream, existsSync} from 'node:fs';
import {mkdir, readFile, stat, unlink, writeFile} from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import {createJob, createProcessingQueue, enqueueClipRerender, enqueueProcessingJob, loadJobState, saveJobState, updateClipDecision} from './lib/pipeline.js';
import {createPublishingQueue, enqueuePublishingJob} from './lib/publishing-queue.js';
import {DATA_DIR, ensureDataDirs, loadDotEnv, persistEnvValues, ROOT, UPLOADS_DIR, safeFilename} from './lib/utils.js';
import {listJobSummaries, publicJobState, publicQueueJob, saveMetadataEdits} from './lib/dashboard.js';
import {getLlmConfig, isLlmEnabled} from './lib/llm.js';
import {FixedWindowRateLimiter, hasCsrfHeader, isAuthenticated, isPathInsideRoots, isRequestAllowed, securityHeaders, validateExposureConfig} from './lib/server-security.js';
import {parseMultipartUpload} from './lib/upload.js';
import {planStory} from './lib/stories/planner.js';
import {renderStorySvg} from './lib/stories/renderer.js';
import {describeInstagramConfig, exchangeInstagramCode, exchangeLongLivedMetaToken, findInstagramBusinessAccount, instagramAuthUrl, validateInstagramToken} from './lib/instagram-oauth.js';
import {exchangeYoutubeCode, makeOAuthState, youtubeAuthUrl} from './lib/youtube-oauth.js';
import {describeTiktokConfig, exchangeTiktokCode, tiktokAuthUrl, validateTiktokToken} from './lib/tiktok-oauth.js';
import {describeXConfig, exchangeXCode, makePkceChallenge, makePkceVerifier, xAuthUrl} from './lib/x-oauth.js';
import {normalizeOAuthPath, SHORTSMITH_OAUTH_PREFIX} from './lib/oauth-redirect.js';
import {assertDiskCapacity, cleanupStorage, diskStatus} from './lib/storage.js';
import {acquireInstanceLock} from './lib/instance-lock.js';
import {publishingReadiness} from './lib/publishing-readiness.js';
import {loadMetrics, recordMetrics} from './lib/metrics.js';

const PUBLIC_DIR = path.join(ROOT, 'public');
let processingQueue = null;
let publishingQueue = null;
const oauthStates = new Set();
const xOauthStates = new Map();
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;
let mutationLimiter = null;
let exposure = {remote: false, protected: false};

function rememberOAuthState(state) {
  oauthStates.add(state);
  const timer = setTimeout(() => oauthStates.delete(state), OAUTH_STATE_TTL_MS);
  timer.unref?.();
}

function rememberXOauthState(state, verifier) {
  xOauthStates.set(state, {verifier, createdAt: Date.now()});
  const timer = setTimeout(() => xOauthStates.delete(state), OAUTH_STATE_TTL_MS);
  timer.unref?.();
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(status, securityHeaders({contentType: 'application/json; charset=utf-8'}));
  res.end(body);
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, securityHeaders({contentType: type}));
  res.end(text);
}

function redirect(res, location) {
  res.writeHead(302, {...securityHeaders(), location});
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
    const relative = path.relative(PUBLIC_DIR, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    if (!existsSync(resolved)) {
      sendText(res, 404, 'Not found');
      return;
    }
    res.writeHead(200, securityHeaders({contentType: contentType(resolved), cache: !resolved.endsWith('index.html')}));
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

async function serveVideoFile(req, res, file) {
  const info = await stat(file);
  const range = req.headers.range;
  if (!range) {
    res.writeHead(200, {...securityHeaders({contentType: 'video/mp4'}), 'accept-ranges': 'bytes', 'content-length': String(info.size)});
    createReadStream(file).pipe(res);
    return;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!match) {
    res.writeHead(416, {...securityHeaders(), 'content-range': `bytes */${info.size}`});
    res.end();
    return;
  }
  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
  if (start > end || start >= info.size) {
    res.writeHead(416, {...securityHeaders(), 'content-range': `bytes */${info.size}`});
    res.end();
    return;
  }
  res.writeHead(206, {...securityHeaders({contentType: 'video/mp4'}),
    'accept-ranges': 'bytes',
    'content-range': `bytes ${start}-${end}/${info.size}`,
    'content-length': String(end - start + 1),
  });
  createReadStream(file, {start, end}).pipe(res);
}

async function readBody(req, maxBytes = 2 * 1024 * 1024) {
  const declared = Number(req.headers['content-length'] || 0);
  if (declared && declared > maxBytes) throw new Error(`Upload too large. Maximum is ${Math.round(maxBytes / 1024 / 1024)} MB; use a local path for long videos.`);
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) throw new Error('Upload too large.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function configured(...keys) {
  return keys.every((key) => Boolean(process.env[key]));
}

async function systemStatus() {
  const llm = getLlmConfig();
  const sttProvider = process.env.TRANSCRIPTION_PROVIDER || process.env.STT_PROVIDER || 'off';
  return {
    app: {name: 'Shortsmith', version: '0.3.0', runningJobs: processingQueue?.stats().running ?? 0, queue: processingQueue?.stats() ?? null, publishingQueue: publishingQueue?.stats() ?? null, security: exposure},
    llm: {configured: isLlmEnabled(llm), provider: llm.provider || 'off', model: isLlmEnabled(llm) ? llm.model : null},
    transcription: {configured: sttProvider !== 'off', provider: sttProvider},
    storage: await diskStatus(),
    publishing: {
      youtube: configured('YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'),
      instagram: configured('META_ACCESS_TOKEN', 'INSTAGRAM_BUSINESS_ACCOUNT_ID'),
      tiktok: configured('TIKTOK_ACCESS_TOKEN'),
      x: Boolean(process.env.X_USER_ACCESS_TOKEN || process.env.X_OAUTH2_ACCESS_TOKEN || configured('X_API_KEY', 'X_API_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'))
    }
  };
}

function requestAllowed(req, {checkSite = true} = {}) {
  return isRequestAllowed({
    host: req.headers.host,
    origin: req.headers.origin,
    secFetchSite: checkSite ? req.headers['sec-fetch-site'] : '',
    allowedHosts: process.env.SHORTSMITH_ALLOWED_HOSTS,
    allowedOrigins: process.env.SHORTSMITH_ALLOWED_ORIGINS
  });
}

async function handleCreateJob(req, res) {
  const declaredBytes = Number(req.headers['content-length'] || 0);
  await assertDiskCapacity(Math.max(64 * 1024 * 1024, declaredBytes * 2));
  const upload = await parseMultipartUpload(req, {
    uploadDir: UPLOADS_DIR,
    maxVideoBytes: Number(process.env.SHORTSMITH_MAX_UPLOAD_BYTES || 20 * 1024 * 1024 * 1024),
    maxTranscriptBytes: Number(process.env.SHORTSMITH_MAX_TRANSCRIPT_BYTES || 20 * 1024 * 1024)
  });
  const {fields, files} = upload;
  const video = files.video;
  let pastedTranscriptPath = null;
  try {
    let videoPath = fields.sourcePath?.trim() ? path.resolve(fields.sourcePath.trim().replace(/^["']|["']$/g, '')) : null;
    if (videoPath && !existsSync(videoPath)) {
      sendJson(res, 400, {error: `Source video path does not exist: ${videoPath}`});
      return;
    }
    if (!videoPath && !video?.size) {
      sendJson(res, 400, {error: 'Missing video file or local source path.'});
      return;
    }
    if (!videoPath) videoPath = video.path;
    if (fields.sourcePath?.trim()) {
      const sourceInfo = await stat(videoPath);
      await assertDiskCapacity(Math.ceil(sourceInfo.size * 1.1));
      if (exposure.remote) {
        const roots = String(process.env.SHORTSMITH_ALLOWED_MEDIA_ROOTS || '').split(',').map((value) => value.trim()).filter(Boolean).map((value) => path.resolve(value));
        const allowed = isPathInsideRoots(videoPath, roots);
        if (!allowed) {
          const error = new Error('Las rutas locales están deshabilitadas en modo remoto salvo dentro de SHORTSMITH_ALLOWED_MEDIA_ROOTS.');
          error.status = 403;
          error.code = 'MEDIA_PATH_BLOCKED';
          throw error;
        }
      }
    }

    let transcriptPath = fields.transcriptPath?.trim()
      ? path.resolve(fields.transcriptPath.trim().replace(/^["']|["']$/g, ''))
      : null;
    if (transcriptPath && !existsSync(transcriptPath)) {
      sendJson(res, 400, {error: `Transcript path does not exist: ${transcriptPath}`});
      return;
    }
    if (files.transcript?.size) {
      transcriptPath = files.transcript.path;
    } else if (fields.transcriptText?.trim()) {
      pastedTranscriptPath = path.join(UPLOADS_DIR, `transcript-${Date.now()}-${safeFilename('pasted.txt')}`);
      transcriptPath = pastedTranscriptPath;
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
    await enqueueProcessingJob(processingQueue, state, options, {
      maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS || 2)
    });
    sendJson(res, 202, {id: state.id, status: state.status});
  } finally {
    await upload.cleanup();
    if (pastedTranscriptPath) await unlink(pastedTranscriptPath).catch(() => {});
  }
}

async function handleApi(req, res, url) {
  url.pathname = normalizeOAuthPath(url.pathname);
  if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    if (!requestAllowed(req) || !hasCsrfHeader(req.headers)) {
      sendJson(res, 403, {error: 'Petición bloqueada por protección de origen/CSRF.', code: 'CSRF_BLOCKED'});
      return;
    }
    const limited = mutationLimiter.consume(req.socket.remoteAddress);
    if (!limited.allowed) {
      res.setHeader('retry-after', String(Math.max(1, Math.ceil((limited.resetAt - Date.now()) / 1000))));
      sendJson(res, 429, {error: 'Demasiadas operaciones. Espera un minuto antes de reintentar.', code: 'RATE_LIMITED'});
      return;
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/system/status') {
    sendJson(res, 200, await systemStatus());
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/storage') {
    sendJson(res, 200, {disk: await diskStatus(), cleanup: await cleanupStorage({dryRun: true, activeJobIds: processingQueue.list().filter((item) => ['queued', 'running', 'cancelling'].includes(item.status)).map((item) => item.payload?.jobId).filter(Boolean)})});
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/publishing/readiness') {
    sendJson(res, 200, publishingReadiness());
    return;
  }
  if (req.method === 'POST' && url.pathname === '/api/storage/cleanup') {
    const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}');
    if (body.confirm !== true) {
      sendJson(res, 400, {error: 'La limpieza requiere confirm=true después de revisar la simulación.'});
      return;
    }
    const activeJobIds = processingQueue.list().filter((item) => ['queued', 'running', 'cancelling'].includes(item.status)).map((item) => item.payload?.jobId).filter(Boolean);
    sendJson(res, 200, await cleanupStorage({dryRun: false, activeJobIds}));
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/youtube/start') {
    try {
      const state = makeOAuthState();
      rememberOAuthState(state);
      redirect(res, youtubeAuthUrl({state}));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/x/start') {
    try {
      const state = makeOAuthState();
      const verifier = makePkceVerifier();
      rememberXOauthState(state, verifier);
      redirect(res, xAuthUrl({state, codeChallenge: makePkceChallenge(verifier)}));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/x/doctor') {
    const report = {config: describeXConfig(), userAccessTokenPresent: Boolean(process.env.X_USER_ACCESS_TOKEN || process.env.X_USER_ACCESS_TOKEN_NEW_APP)};
    try {
      const verifier = makePkceVerifier();
      report.authUrl = xAuthUrl({state: 'doctor', codeChallenge: makePkceChallenge(verifier)});
    } catch (error) {
      report.authUrlError = error.message;
    }
    sendJson(res, 200, report);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/x/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');
    const oauthErrorDescription = url.searchParams.get('error_description');
    if (oauthError) {
      sendText(res, 400, `X OAuth error: ${oauthErrorDescription || oauthError}`);
      return;
    }
    const saved = state ? xOauthStates.get(state) : null;
    if (!code || !state || !saved) {
      sendText(res, 400, 'OAuth callback X invalido o expirado. Vuelve a abrir /api/oauth/x/start.');
      return;
    }
    xOauthStates.delete(state);
    try {
      const tokens = await exchangeXCode(code, saved.verifier);
      const maskedAccess = tokens.access_token?.length > 12
        ? `${tokens.access_token.slice(0, 6)}...${tokens.access_token.slice(-4)}(len=${tokens.access_token.length})`
        : '***';
      const maskedRefresh = tokens.refresh_token?.length > 12
        ? `${tokens.refresh_token.slice(0, 6)}...${tokens.refresh_token.slice(-4)}(len=${tokens.refresh_token.length})`
        : '***';
      const tokenFile = path.join(ROOT, 'data', 'secrets', 'x-oauth-latest.env');
      await mkdir(path.dirname(tokenFile), {recursive: true});
      await writeFile(tokenFile, [
        '# Generated by Shortsmith X OAuth callback. Do not commit.',
        `X_USER_ACCESS_TOKEN=${tokens.access_token || ''}`,
        `X_REFRESH_TOKEN=${tokens.refresh_token || ''}`,
        `X_SCOPES=${tokens.scope || ''}`,
        `X_TOKEN_EXPIRES_IN=${tokens.expires_in || ''}`,
        ''
      ].join('\n'), 'utf8');
      sendText(res, 200, `X OAuth OK.

Tokens guardados localmente en:

${tokenFile}

Copia estas lineas desde ese archivo a tu .env local y reinicia el servidor:

X_USER_ACCESS_TOKEN=<pega tu access token; archivo local, no lo compartas>
X_REFRESH_TOKEN=<pega tu refresh token; archivo local, no lo compartas>
X_SCOPES=${tokens.scope || ''}

Resumen saneado:
access_token=${maskedAccess}
refresh_token=${maskedRefresh}
scope=${tokens.scope || 'no informado por X'}
expires_in=${tokens.expires_in || 'no informado'}

Comprueba que scope incluya media.write antes de probar la subida de video.
No pegues estos tokens en chats, commits ni capturas.`);
    } catch (error) {
      sendText(res, 500, `No se pudo completar OAuth de X: ${error.message}`);
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
      await persistEnvValues({YOUTUBE_REFRESH_TOKEN: refreshToken});
      sendText(res, 200, `YouTube OAuth OK.

El refresh token se ha guardado en la configuracion local sin mostrarlo.

Scope concedido: ${tokens.scope || 'no informado por Google'}

Ya puedes volver a Shortsmith y revisar el estado de la cuenta.`);
    } catch (error) {
      sendText(res, 500, `No se pudo canjear el codigo OAuth: ${error.message}`);
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/instagram/start') {
    try {
      const state = makeOAuthState();
      rememberOAuthState(state);
      redirect(res, instagramAuthUrl({state}));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/tiktok/start') {
    try {
      const state = makeOAuthState();
      rememberOAuthState(state);
      redirect(res, tiktokAuthUrl({state}));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/tiktok/doctor') {
    const report = {config: describeTiktokConfig(), accessTokenPresent: Boolean(process.env.TIKTOK_ACCESS_TOKEN)};
    try {
      report.authUrl = tiktokAuthUrl();
    } catch (error) {
      report.authUrlError = error.message;
    }
    if (process.env.TIKTOK_ACCESS_TOKEN) {
      try {
        report.user = await validateTiktokToken(process.env.TIKTOK_ACCESS_TOKEN);
        report.tokenOk = true;
      } catch (error) {
        report.tokenOk = false;
        report.tokenError = error.message;
      }
    }
    sendJson(res, 200, report);
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/oauth/tiktok/callback') {
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');
    const oauthErrorDescription = url.searchParams.get('error_description');
    if (oauthError) {
      sendText(res, 400, `TikTok OAuth error: ${oauthErrorDescription || oauthError}`);
      return;
    }
    if (!code || !state || !oauthStates.has(state)) {
      sendText(res, 400, 'OAuth callback TikTok invalido o expirado. Vuelve a abrir /api/oauth/tiktok/start.');
      return;
    }
    oauthStates.delete(state);
    try {
      const tokens = await exchangeTiktokCode(code);
      const maskedAccess = tokens.access_token?.length > 12
        ? `${tokens.access_token.slice(0, 6)}…${tokens.access_token.slice(-4)}(len=${tokens.access_token.length})`
        : '***';
      const maskedRefresh = tokens.refresh_token?.length > 12
        ? `${tokens.refresh_token.slice(0, 6)}…${tokens.refresh_token.slice(-4)}(len=${tokens.refresh_token.length})`
        : '***';
      await persistEnvValues({
        TIKTOK_ACCESS_TOKEN: tokens.access_token,
        TIKTOK_REFRESH_TOKEN: tokens.refresh_token,
        TIKTOK_OPEN_ID: tokens.open_id
      });
      sendText(res, 200, `TikTok OAuth OK.

Los tokens se han guardado en la configuracion local sin mostrarlos.

Resumen saneado:
access_token=${maskedAccess}
refresh_token=${maskedRefresh}
scope=${tokens.scope || 'no informado por TikTok'}
expires_in=${tokens.expires_in || 'no informado'}

Ya puedes volver a Shortsmith y revisar el estado de la cuenta.`);
    } catch (error) {
      sendText(res, 500, `No se pudo completar OAuth de TikTok: ${error.message}`);
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
    if (!code || !state || !oauthStates.has(state)) {
      sendText(res, 400, 'OAuth callback invalido o expirado. Vuelve a abrir /api/oauth/instagram/start.');
      return;
    }
    oauthStates.delete(state);
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
      await persistEnvValues({
        META_ACCESS_TOKEN: accessToken,
        INSTAGRAM_BUSINESS_ACCOUNT_ID: accountInfo.instagramBusinessAccount.id
      });
      sendText(res, 200, `Instagram OAuth OK.

El token y la cuenta se han guardado en la configuracion local sin mostrarlos.

Resumen saneado del token: ${maskedToken}
Cuenta detectada: ${accountInfo.instagramBusinessAccount.username || 'sin username'}.
Pagina conectada: ${accountInfo.page?.name || 'sin nombre'}.
El token caduca en aproximadamente ${longToken.expires_in ? Math.round(longToken.expires_in / 86400) : 'varios'} dias.
${tokenWarning}

Ya puedes volver a Shortsmith y revisar el estado de la cuenta.`);
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
    try {
      await handleCreateJob(req, res);
    } catch (error) {
      const tooLarge = /límite|large|grande/i.test(error.message);
      sendJson(res, error.status || (tooLarge ? 413 : 400), {error: error.message, code: error.code});
    }
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/jobs') {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 30)));
    sendJson(res, 200, {jobs: await listJobSummaries(limit)});
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/queue') {
    sendJson(res, 200, {stats: processingQueue.stats(), jobs: processingQueue.list().map(publicQueueJob)});
    return;
  }
  if (req.method === 'GET' && url.pathname === '/api/publishing-queue') {
    sendJson(res, 200, {stats: publishingQueue.stats(), jobs: publishingQueue.list().map(publicQueueJob)});
    return;
  }
  const publishQueueCancelMatch = url.pathname.match(/^\/api\/publishing-queue\/([^/]+)\/cancel$/);
  if (req.method === 'POST' && publishQueueCancelMatch) {
    const queued = await publishingQueue.cancel(publishQueueCancelMatch[1]);
    if (!queued) sendJson(res, 404, {error: 'Publicación en cola no encontrada.'});
    else sendJson(res, 202, publicQueueJob(queued));
    return;
  }
  const publishQueueRetryMatch = url.pathname.match(/^\/api\/publishing-queue\/([^/]+)\/retry$/);
  if (req.method === 'POST' && publishQueueRetryMatch) {
    try {
      const queued = await publishingQueue.retry(publishQueueRetryMatch[1]);
      if (!queued) sendJson(res, 404, {error: 'Publicación en cola no encontrada.'});
      else sendJson(res, 202, publicQueueJob(queued));
    } catch (error) {
      sendJson(res, 409, {error: error.message});
    }
    return;
  }
  const jobMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)$/);
  if (req.method === 'GET' && jobMatch) {
    try {
      const state = await loadJobState(jobMatch[1]);
      const queue = processingQueue.get(state.id);
      const publishQueue = publishingQueue.list().find((item) => item.payload?.jobId === state.id) ?? null;
      const renderQueues = new Map((state.clips ?? []).map((clip) => [clip.renderQueueId, clip.renderQueueId ? processingQueue.get(clip.renderQueueId) : null]));
      sendJson(res, 200, publicJobState(state, {queue, publishQueue, renderQueues}));
    } catch {
      sendJson(res, 404, {error: 'Job not found.'});
    }
    return;
  }
  const queueCancelMatch = url.pathname.match(/^\/api\/queue\/([^/]+)\/cancel$/);
  if (req.method === 'POST' && queueCancelMatch) {
    const queued = await processingQueue.cancel(queueCancelMatch[1]);
    sendJson(res, queued ? 202 : 404, queued ? publicQueueJob(queued) : {error: 'Queue job not found.'});
    return;
  }
  const clipEditMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/clips\/([^/]+)$/);
  if (req.method === 'PATCH' && clipEditMatch) {
    try {
      const body = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
      const state = await loadJobState(clipEditMatch[1]);
      const clip = await updateClipDecision(state, clipEditMatch[2], body.editorialStatus);
      sendJson(res, 200, clip);
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  const rerenderMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/clips\/([^/]+)\/rerender$/);
  if (req.method === 'POST' && rerenderMatch) {
    try {
      const body = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
      const state = await loadJobState(rerenderMatch[1]);
      const queued = await enqueueClipRerender(processingQueue, state, rerenderMatch[2], body);
      sendJson(res, 202, publicQueueJob(queued));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  const cancelMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/cancel$/);
  if (req.method === 'POST' && cancelMatch) {
    try {
      const queued = await processingQueue.cancel(cancelMatch[1]);
      if (!queued) throw new Error('Job not found.');
      if (queued.status === 'cancelled') {
        const state = await loadJobState(cancelMatch[1]);
        state.status = 'cancelled';
        state.cancelledAt = new Date().toISOString();
        state.error = null;
        await saveJobState(state);
      }
      sendJson(res, 202, publicQueueJob(queued));
    } catch (error) {
      sendJson(res, /not found/i.test(error.message) ? 404 : 400, {error: error.message});
    }
    return;
  }
  const retryMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/retry$/);
  if (req.method === 'POST' && retryMatch) {
    try {
      const queued = await processingQueue.retry(retryMatch[1]);
      if (!queued) throw new Error('Job not found.');
      const state = await loadJobState(retryMatch[1]);
      state.status = 'queued';
      state.error = null;
      state.cancelledAt = null;
      await saveJobState(state);
      sendJson(res, 202, publicQueueJob(queued));
    } catch (error) {
      sendJson(res, /not found/i.test(error.message) ? 404 : 400, {error: error.message});
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
  const metricsMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/metrics$/);
  if (metricsMatch && req.method === 'GET') {
    try {
      const state = await loadJobState(metricsMatch[1]);
      sendJson(res, 200, {metrics: await loadMetrics(state)});
    } catch {
      sendJson(res, 404, {error: 'Job not found.'});
    }
    return;
  }
  if (metricsMatch && req.method === 'PATCH') {
    try {
      const state = await loadJobState(metricsMatch[1]);
      const body = JSON.parse((await readBody(req, 128 * 1024)).toString('utf8') || '{}');
      sendJson(res, 200, await recordMetrics(state, body));
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  const metadataEditMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/metadata$/);
  if (req.method === 'PATCH' && metadataEditMatch) {
    try {
      const body = JSON.parse((await readBody(req, 2 * 1024 * 1024)).toString('utf8') || '{}');
      const state = await loadJobState(metadataEditMatch[1]);
      const updated = await saveMetadataEdits(state, body);
      sendJson(res, 200, updated);
    } catch (error) {
      sendJson(res, 400, {error: error.message});
    }
    return;
  }
  const publishMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/publish$/);
  if (req.method === 'POST' && publishMatch) {
    try {
      const body = JSON.parse((await readBody(req, 1024 * 1024)).toString('utf8') || '{}');
      if (body.confirm !== true) throw new Error('La publicación requiere confirmación explícita.');
      const state = await loadJobState(publishMatch[1]);
      const idempotencyKey = String(body.idempotencyKey || '').slice(0, 160);
      if (!idempotencyKey) throw new Error('Falta la clave de idempotencia de publicación.');
      const queued = await enqueuePublishingJob(publishingQueue, state, {clipId: body.clipId, platforms: body.platforms, idempotencyKey, scheduledFor: body.scheduledFor});
      sendJson(res, 202, publicQueueJob(queued));
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
      await serveVideoFile(req, res, clip.files.video);
    } catch {
      sendJson(res, 404, {error: 'Clip not found.'});
    }
    return;
  }
  const sourceVideoMatch = url.pathname.match(/^\/api\/jobs\/([^/]+)\/source\/video$/);
  if (req.method === 'GET' && sourceVideoMatch) {
    try {
      const state = await loadJobState(sourceVideoMatch[1]);
      await serveVideoFile(req, res, state.sourceVideo);
    } catch {
      sendJson(res, 404, {error: 'Source video not found.'});
    }
    return;
  }
  sendJson(res, 404, {error: 'Unknown API route.'});
}

async function handler(req, res) {
  try {
    if (!requestAllowed(req, {checkSite: false})) {
      sendJson(res, 403, {error: 'Host u origen no permitido.', code: 'ORIGIN_BLOCKED'});
      return;
    }
    if (!isAuthenticated(req.headers.authorization, process.env.SHORTSMITH_AUTH_TOKEN || '')) {
      res.writeHead(401, {...securityHeaders(), 'www-authenticate': 'Basic realm="Shortsmith", charset="UTF-8"'});
      res.end('Authentication required');
      return;
    }
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith(`${SHORTSMITH_OAUTH_PREFIX}/`)) {
      await handleApi(req, res, url);
      return;
    }
    const file = url.pathname === '/' ? path.join(PUBLIC_DIR, 'index.html') : path.join(PUBLIC_DIR, url.pathname);
    await serveStatic(res, file);
  } catch (error) {
    console.error(`Shortsmith request failed: ${error?.name || 'Error'} (${error?.code || 'INTERNAL_ERROR'})`);
    sendJson(res, 500, {error: 'Error interno del servidor.', code: 'INTERNAL_ERROR'});
  }
}

await loadDotEnv();
await ensureDataDirs();
mutationLimiter = new FixedWindowRateLimiter({limit: Number(process.env.SHORTSMITH_MUTATION_RATE_LIMIT || 120), windowMs: 60_000});
const releaseInstanceLock = await acquireInstanceLock(path.join(DATA_DIR, '.shortsmith.lock'));
processingQueue = await createProcessingQueue({
  concurrency: Number(process.env.JOB_CONCURRENCY || 1),
  retryDelayMs: Number(process.env.JOB_RETRY_DELAY_MS || 1500)
});
publishingQueue = await createPublishingQueue({
  concurrency: Number(process.env.PUBLISH_CONCURRENCY || 1),
  retryDelayMs: Number(process.env.PUBLISH_RETRY_DELAY_MS || 3000)
});
await cleanupStorage({
  dryRun: false,
  activeJobIds: processingQueue.list().filter((item) => ['queued', 'running', 'cancelling'].includes(item.status)).map((item) => item.payload?.jobId).filter(Boolean)
});
try {
  await readFile(path.join(PUBLIC_DIR, 'index.html'));
} catch {
  throw new Error('public/index.html is missing.');
}

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
exposure = validateExposureConfig({host, authToken: process.env.SHORTSMITH_AUTH_TOKEN || ''});
const server = http.createServer(handler);
server.listen(port, host, () => {
  console.log(`Shortsmith running at http://${host}:${port}`);
});

let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Shortsmith stopping (${signal})...`);
  server.close();
  await Promise.allSettled([
    processingQueue.close({cancelRunning: true}),
    publishingQueue.close({cancelRunning: true})
  ]);
  await releaseInstanceLock();
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => shutdown(signal).finally(() => process.exit(0)));
}

