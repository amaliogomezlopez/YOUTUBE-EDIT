import {createTikTokSandboxSession} from './tiktok-sandbox.js';
import {isLoopbackAddress} from './server-security.js';
import {parseMultipartUpload} from './upload.js';
import {fetchTikTokPostStatus, mapTikTokPostStatus, publishToTiktok} from './publishers/tiktok.js';
import {ffprobe} from './ffmpeg.js';
import {UPLOADS_DIR} from './utils.js';

export function createTikTokSandboxRoutes({readBody, sendJson, sendText, redirect}) {
  const sandbox = createTikTokSandboxSession();
  let busy = false;
  return async function handle(req, res, url) {
    const callback = url.pathname === '/api/oauth/tiktok/callback' && sandbox.ownsState(url.searchParams.get('state'));
    if (!callback && !url.pathname.startsWith('/api/tiktok-sandbox/')) return false;
    const remoteAddress = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (!isLoopbackAddress(remoteAddress)) { sendJson(res, 403, {error: 'El panel Sandbox solo está disponible en este ordenador.'}); return true; }
    try {
      if (callback && req.method === 'GET') {
        await sandbox.callback({state:url.searchParams.get('state'), code:url.searchParams.get('code'), error:url.searchParams.get('error')});
        redirect(res, '/tiktok-sandbox.html');
      } else if (req.method === 'GET' && url.pathname.endsWith('/status')) {
        sendJson(res, 200, {...sandbox.status(), busy});
      } else if (req.method === 'GET' && url.pathname.endsWith('/account')) {
        sendJson(res, 200, await sandbox.account());
      } else if (req.method === 'POST' && url.pathname.endsWith('/publication-status')) {
        const body = JSON.parse(await readBody(req, 4096));
        if (typeof body.publishId !== 'string' || body.publishId.length > 200 || !/^v_[A-Za-z0-9_.~:-]+$/.test(body.publishId)) throw new Error('Identificador de publicación no válido.');
        const result = await fetchTikTokPostStatus({accessToken:sandbox.token(), publishId:body.publishId});
        sendJson(res, 200, {publishId:body.publishId, ...mapTikTokPostStatus(result)});      } else if (req.method === 'POST' && url.pathname.endsWith('/config')) {
        if (busy) throw new Error('Hay una publicación en curso.');
        const body = JSON.parse(await readBody(req, 4096));
        sendJson(res, 200, sandbox.configure({...body, redirectUri: process.env.TIKTOK_SANDBOX_REDIRECT_URI || process.env.TIKTOK_REDIRECT_URI}));
      } else if (req.method === 'POST' && url.pathname.endsWith('/start')) {
        sendJson(res, 200, {url: sandbox.start()});
      } else if (req.method === 'POST' && url.pathname.endsWith('/publish')) {
        if (busy) throw new Error('Ya hay una publicación en curso. No repitas el envío.');
        const accessToken = sandbox.token();
        busy = true;
        let upload;
        try {
          upload = await parseMultipartUpload(req, {uploadDir:UPLOADS_DIR, maxFiles:1, fileFields:{video:{extensions:new Set(['.mp4']), fallbackExtension:'.mp4', maxBytes:100*1024*1024, label:'El vídeo de prueba'}}});
          const {fields, files} = upload;
          if (!files.video?.size || !/\.mp4$/i.test(files.video.originalName)) throw new Error('Selecciona un MP4 válido.');
          if (fields.consent !== 'on') throw new Error('Revisa y autoriza expresamente el envío.');
          if (!['inbox', 'direct'].includes(fields.mode)) throw new Error('Selecciona un destino válido.');
          if (String(fields.caption || '').length > 2200) throw new Error('La descripción supera 2200 caracteres.');
          if (fields.mode === 'direct' && fields.privacyLevel !== 'SELF_ONLY') throw new Error('Sandbox solo admite la prueba privada Solo yo.');
          const probe = await ffprobe(files.video.path);
          if (!(probe.duration > 0) || !probe.width || !probe.height) throw new Error('El archivo no contiene un vídeo válido.');
          const result = await publishToTiktok({videoFile:files.video.path, metadata:{}, clip:{start:0,end:probe.duration,publishing:{tiktok:{caption:fields.caption || '',disableComment:fields.allowComment !== 'on',disableDuet:fields.allowDuet !== 'on',disableStitch:fields.allowStitch !== 'on'}}}, options:{accessToken,mode:fields.mode,privacyLevel:fields.privacyLevel,statusTimeoutMs:30000}});
          sendJson(res, 200, {status:result.status, mode:result.mode, publishId:result.publishId, tiktokStatus:result.tiktokStatus, error:result.error, nextStep:result.nextStep});
        } finally {busy = false; await upload?.cleanup();}
      } else {sendJson(res, 404, {error:'Ruta de Sandbox desconocida.'});}
    } catch (error) {
      // Never include an upstream payload, token or key in an OAuth error page.
      if (callback) sendText(res, 400, 'TikTok no pudo completar la autorización de Sandbox. Vuelve a /tiktok-sandbox.html para intentarlo de nuevo.');
      else sendJson(res, 400, {error: error.message || 'No se pudo completar la operación Sandbox.'});
    }
    return true;
  };
}
