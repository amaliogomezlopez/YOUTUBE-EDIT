/**
 * Recursos de la apertura: el contrato `asset-requests.json` y su resolucion a
 * ficheros `<id>.<ext>` (la ingesta toma el id del nombre) con su procedencia al lado.
 *
 * Tipos cerrados:
 * - `web`: portada oficial de una pagina (og:image) o captura si no la tiene.
 * - `image`: imagen https directa (el CDN de la pagina oficial).
 * - `youtube`: tramo de un video (trailer, demo oficial) de `start` a `start+duration`.
 * - `x`: tarjeta de un post de X con el oEmbed oficial.
 * - `local`: fichero que da el usuario (imagen o video; en video, tramo opcional).
 *
 * Las paginas protegidas (Cloudflare, 403) no se saltan: el recurso queda pendiente
 * para que el usuario lo capture y lo deje en la carpeta con su id.
 */
import path from 'node:path';
import {existsSync} from 'node:fs';
import {copyFile, mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import sharp from 'sharp';
import {run} from '../../lib/utils.js';
import {captureWebPage, captureXPost, provenance} from '../video-studio/asset-sourcing.js';
import {captureHeadline} from '../video-studio/page-capture.js';
import {IMAGE_EXTENSIONS, REMOTION_ROOT, VIDEO_EXTENSIONS} from '../video-studio/paths.js';

export const ASSET_KINDS = new Set(['web', 'image', 'youtube', 'x', 'local']);
export const BROLL_SECONDS = {min: 2, ideal: [4, 8], max: 12};
const CHROME = path.join(REMOTION_ROOT, 'node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');
const VIDEO_FILTER = 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30';

export function assetRequestsTemplate() {
  return {
    version: 1,
    note: 'Un recurso por idea. id en minusculas con guiones: es el nombre que usara la escaleta. kind: web | image | youtube | x | local. Noticia citada: kind web con captura: titular (captura real encuadrada en el titular). Video: start y duration (4-8 s). insert: true para capturas con texto que iran a pantalla completa con la cara en la esquina.',
    assets: []
  };
}

/** Errores de contrato, antes de tocar la red. */
export function validateAssetRequests(requests) {
  const errors = [];
  const ids = new Set();
  for (const [index, asset] of (requests?.assets ?? []).entries()) {
    const where = `recurso ${index + 1} (${asset.id ?? 'sin id'})`;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(asset.id ?? '')) errors.push(`${where}: id en minusculas, numeros y guiones ("portada-opus")`);
    else if (ids.has(asset.id)) errors.push(`${where}: id repetido`);
    ids.add(asset.id);
    if (asset.id === 'music') errors.push(`${where}: "music" esta reservado para la pista`);
    if (!ASSET_KINDS.has(asset.kind)) errors.push(`${where}: kind "${asset.kind}" no existe (${[...ASSET_KINDS].join(', ')})`);
    if (['web', 'image', 'youtube', 'x'].includes(asset.kind) && !/^https:\/\//.test(asset.url ?? '')) errors.push(`${where}: \`url\` https obligatoria`);
    if (asset.kind === 'local' && !asset.path) errors.push(`${where}: \`path\` obligatorio en kind local`);
    if (asset.captura !== undefined && !(asset.kind === 'web' && ['portada', 'titular'].includes(asset.captura))) {
      errors.push(`${where}: \`captura\` solo vale en kind web: "titular" (la noticia encuadrada en su titular) o "portada" (og:image)`);
    }
    if (asset.kind === 'youtube' && !(Number.isFinite(asset.start) && Number.isFinite(asset.duration))) {
      errors.push(`${where}: un video de YouTube necesita \`start\` y \`duration\` en segundos (busca el tramo con una hoja de contacto)`);
    }
    if (Number.isFinite(asset.duration) && (asset.duration < BROLL_SECONDS.min || asset.duration > BROLL_SECONDS.max)) {
      errors.push(`${where}: duration ${asset.duration}s; el b-roll va en fragmentos de ${BROLL_SECONDS.ideal.join('-')} s (uno por idea)`);
    }
    if (!asset.reason) errors.push(`${where}: falta \`reason\` (que frase lo nombra)`);
  }
  return errors;
}

const existing = async (dir, id) => {
  const files = existsSync(dir) ? await readdir(dir) : [];
  return files.find((file) => path.parse(file).name === id && !file.endsWith('.json') &&
    (IMAGE_EXTENSIONS.has(path.extname(file).toLowerCase()) || VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase())));
};

async function writeProvenance(file, record) {
  await writeFile(file + '.provenance.json', JSON.stringify({...record, file: path.basename(file)}, null, 2) + '\n');
}

/** Captura con texto que ira en `insert`: reducida sobre lienzo 1920x1080 para que la esquina del sujeto no tape el final. */
async function padForInsert(input, output, color = '#141414') {
  const shot = await sharp(input, {density: 300}).resize({width: 1300, height: 1080 - 170, fit: 'inside'}).png().toBuffer();
  await sharp({create: {width: 1920, height: 1080, channels: 3, background: color}})
    .composite([{input: shot, left: 70, top: 170}])
    .png().toFile(output);
}

/** Esquinas redondeadas (radio ~2,5 % del ancho) con alfa: el recorte se lee como un recuadro. */
async function roundCorners(input, output) {
  const {width, height} = await sharp(input).metadata();
  const r = Math.round(width * 0.025);
  const mask = Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${r}" ry="${r}"/></svg>`);
  await sharp(input).ensureAlpha().composite([{input: mask, blend: 'dest-in'}]).png().toFile(output);
}

/** Ruta y comando de yt-dlp: `YTDLP_BIN`, o `python -m yt_dlp` con `YTDLP_PYTHONPATH`. */
export function ytDlpCommand(env = process.env) {
  if (env.YTDLP_BIN) return {command: env.YTDLP_BIN, args: [], env: {}};
  return {command: 'python', args: ['-m', 'yt_dlp'], env: env.YTDLP_PYTHONPATH ? {PYTHONPATH: env.YTDLP_PYTHONPATH} : {}};
}

async function cutVideo(input, output, {start = 0, duration = null}) {
  await run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', '-ss', String(start), ...(duration ? ['-t', String(duration)] : []),
    '-i', input, '-an', '-vf', VIDEO_FILTER, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', output], {timeoutMs: 20 * 60_000});
}

async function resolveOne(asset, {assetsDir, rawDir}) {
  const base = path.join(assetsDir, asset.id);
  const raw = path.join(rawDir, asset.id);
  await mkdir(raw, {recursive: true});
  switch (asset.kind) {
    case 'web':
      if (asset.captura === 'titular') {
        // Noticia: captura real de la pagina encuadrada en su titular (no la og:image,
        // que suele ser una tarjeta con el titular reescrito). Esquinas redondeadas
        // para que en pantalla se lea como un recuadro.
        const shot = await captureHeadline(asset.url, {chrome: CHROME, output: path.join(raw, 'titular.png')});
        const target = base + '.png';
        await roundCorners(shot.file, target);
        await writeProvenance(target, {...provenance({file: target, bytes: await readFile(target), url: asset.url, provider: 'web-headline-screenshot',
          license: 'Captura de pagina publica; revisar derechos antes de publicar', attribution: new URL(asset.url).hostname,
          extra: {title: shot.title}}), request: asset});
        return target;
      }
    // falls through
    case 'x': {
      const captured = asset.kind === 'x'
        ? await captureXPost(asset.url, {dir: raw, chrome: CHROME, sharp})
        : await captureWebPage(asset.url, {dir: raw, chrome: CHROME});
      const target = asset.insert ? base + '.png' : base + (path.extname(captured.file) === '.webp' ? '.png' : path.extname(captured.file));
      if (asset.insert) await padForInsert(captured.file, target, asset.padColor);
      else if (captured.file.endsWith('.webp')) await sharp(captured.file).png().toFile(target);
      else await copyFile(captured.file, target);
      await writeProvenance(target, {...captured.provenance, request: asset});
      return target;
    }
    case 'image': {
      const response = await fetch(asset.url, {redirect: 'follow'});
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok || !/^image\//.test(type)) throw new Error(`la URL respondio ${response.status} ${type}; no es una imagen`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const rawFile = path.join(raw, 'source' + (type.includes('png') ? '.png' : type.includes('webp') ? '.webp' : type.includes('svg') ? '.svg' : '.jpg'));
      await writeFile(rawFile, bytes);
      const target = base + '.png';
      if (asset.insert) await padForInsert(rawFile, target, asset.padColor);
      else await sharp(rawFile, {density: 300}).png().toFile(target);
      await writeProvenance(target, {...provenance({file: target, bytes, url: asset.url, provider: 'direct-image',
        license: asset.license ?? 'Imagen publicada por la fuente; revisar derechos antes de publicar', attribution: new URL(asset.url).hostname}), request: asset});
      return target;
    }
    case 'youtube': {
      const yt = ytDlpCommand();
      const end = asset.start + asset.duration;
      await run(yt.command, [...yt.args, '-f', 'bv*[height<=1080]+ba/b', '--download-sections', `*${asset.start}-${end}`,
        '--force-keyframes-at-cuts', '--merge-output-format', 'mp4', '-o', path.join(raw, 'source.%(ext)s'), asset.url],
      {env: yt.env, timeoutMs: 30 * 60_000});
      const source = (await readdir(raw)).find((file) => file.startsWith('source.'));
      if (!source) throw new Error('yt-dlp no dejo ningun fichero');
      const target = base + '.mp4';
      await cutVideo(path.join(raw, source), target, {start: 0, duration: asset.duration});
      await writeProvenance(target, {...provenance({file: target, bytes: await readFile(target), url: asset.url, provider: 'youtube',
        license: asset.license ?? 'Video de terceros (trailer o demo oficial); revisar derechos antes de publicar',
        attribution: asset.attribution ?? new URL(asset.url).hostname, extra: {start: asset.start, duration: asset.duration}}), request: asset});
      return target;
    }
    case 'local': {
      const ext = path.extname(asset.path).toLowerCase();
      if (VIDEO_EXTENSIONS.has(ext)) {
        const target = base + '.mp4';
        await cutVideo(asset.path, target, {start: asset.start ?? 0, duration: asset.duration ?? null});
        await writeProvenance(target, {version: 1, url: null, provider: 'user-file', source: asset.path, request: asset, retrievedAt: new Date().toISOString()});
        return target;
      }
      if (!IMAGE_EXTENSIONS.has(ext)) throw new Error(`extension ${ext} no admitida`);
      const target = base + '.png';
      if (asset.insert) await padForInsert(asset.path, target, asset.padColor);
      else await sharp(asset.path, {density: 300}).png().toFile(target);
      await writeProvenance(target, {version: 1, url: null, provider: 'user-file', source: asset.path, request: asset, retrievedAt: new Date().toISOString()});
      return target;
    }
    default:
      throw new Error(`kind ${asset.kind} no soportado`);
  }
}

/**
 * Resuelve los recursos que aun no tienen fichero. Idempotente: un recurso ya en la
 * carpeta (resuelto antes o dejado a mano por el usuario con su id) no se toca salvo
 * `force`. Devuelve {resolved, skipped, failed}.
 */
export async function resolveAssetRequests(requests, {assetsDir, rawDir, force = false, log = () => {}}) {
  await mkdir(assetsDir, {recursive: true});
  const result = {resolved: [], skipped: [], failed: []};
  for (const asset of requests.assets ?? []) {
    const present = await existing(assetsDir, asset.id);
    if (present && !force) { result.skipped.push({id: asset.id, file: present}); continue; }
    try {
      const file = await resolveOne(asset, {assetsDir, rawDir});
      result.resolved.push({id: asset.id, file: path.basename(file)});
      log(`  ✔ ${asset.id} ← ${asset.kind} ${asset.url ?? asset.path}`);
    } catch (error) {
      result.failed.push({id: asset.id, kind: asset.kind, url: asset.url ?? asset.path, reason: error.message});
      log(`  ✖ ${asset.id}: ${error.message}`);
    }
  }
  return result;
}
