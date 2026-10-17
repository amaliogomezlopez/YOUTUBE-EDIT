/**
 * Tomas grabadas con OBS en salidas separadas:
 *   <grabaciones>/<toma>.mkv                   mezcla pantalla + webcam incrustada, la unica con audio
 *   <grabaciones>/CAMARA/CAMARA <toma>.mkv     la cara a pantalla completa, muda
 *   <grabaciones>/PANTALLA/PANTALLA <toma>.mkv la pantalla limpia, muda
 *
 * Las tomas se ordenan de la mas antigua a la mas nueva (la fecha del nombre de OBS,
 * `2026-10-16 21-04-09`, o la del fichero si no la tiene): es el orden en que se
 * grabaron y, salvo que el autor diga otra cosa, el del montaje.
 *
 * Camara y pantalla arrancan unas decimas despues que la mezcla. El desfase se mide
 * correlacionando la energia de movimiento de la camara con cada esquina de la mezcla
 * (la webcam incrustada esta en una de ellas).
 */
import {spawn, spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {readdir, stat} from 'node:fs/promises';
import path from 'node:path';

const VIDEO = /\.(mkv|mp4|mov)$/i;
const OBS_STAMP = /(\d{4})-(\d{2})-(\d{2})[ _](\d{2})-(\d{2})-(\d{2})/;
const W = 32, H = 18, FPS = 30;
export const MAX_LAG_SECONDS = 3;
export const MIN_CORRELATION = 0.5;

/** Epoch ms from an OBS file name, or null. */
export function obsTimestamp(name) {
  const m = OBS_STAMP.exec(name);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) : null;
}

/**
 * Takes of a recordings folder, oldest first (`order: 'newest'` reverses it). Only
 * root files with a matching CAMARA file count as split recordings; a folder without
 * CAMARA/ returns an empty list so callers can fall back to numbered takes.
 */
export async function listRecordedTakes(dir, {order = 'oldest'} = {}) {
  const cameraDir = path.join(dir, 'CAMARA'), screenDir = path.join(dir, 'PANTALLA');
  if (!existsSync(cameraDir)) return [];
  const cameras = await readdir(cameraDir);
  const screens = existsSync(screenDir) ? await readdir(screenDir) : [];
  const takes = [];
  for (const name of await readdir(dir)) {
    const mix = path.join(dir, name);
    if (!VIDEO.test(name) || !(await stat(mix)).isFile()) continue;
    const camera = companion(cameraDir, cameras, 'CAMARA', name);
    if (!camera) continue;
    const screen = companion(screenDir, screens, 'PANTALLA', name);
    takes.push({name, mix, camera, screen,
      recordedAt: obsTimestamp(name) ?? (await stat(mix)).mtimeMs});
  }
  takes.sort((a, b) => a.recordedAt - b.recordedAt || a.name.localeCompare(b.name));
  return order === 'newest' ? takes.reverse() : takes;
}

/** Max gap between the OBS stamps of a mix and its camera/screen file names. */
export const COMPANION_STAMP_TOLERANCE_MS = 2000;

/**
 * `<prefix> <name>` inside `folder`, or the file whose OBS stamp is closest to the
 * mix's within the tolerance: OBS starts each output on its own and can name the
 * camera a second later than the mix (18-41-20 vs 18-41-21).
 */
function companion(folder, files, prefix, name) {
  const exact = `${prefix} ${name}`;
  if (files.includes(exact)) return path.join(folder, exact);
  const stamp = obsTimestamp(name);
  if (stamp == null) return null;
  let best = null, bestGap = Infinity;
  for (const file of files) {
    if (!VIDEO.test(file) || !file.startsWith(`${prefix} `)) continue;
    const other = obsTimestamp(file);
    const gap = other == null ? Infinity : Math.abs(other - stamp);
    if (gap <= COMPANION_STAMP_TOLERANCE_MS && gap < bestGap) { best = file; bestGap = gap; }
  }
  return best ? path.join(folder, best) : null;
}

/** Normalised frame-to-frame motion energy of a (cropped) grey thumbnail stream. */
export function motionEnergy(file, crop = null) {
  return new Promise((resolve, reject) => {
    const vf = `${crop ? `crop=${crop},` : ''}scale=${W}:${H},format=gray`;
    const child = spawn('ffmpeg', ['-v', 'error', '-i', file, '-vf', vf, '-r', String(FPS), '-f', 'rawvideo', '-']);
    const chunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.on('error', reject);
    child.on('close', () => {
      const buf = Buffer.concat(chunks), n = Math.floor(buf.length / (W * H)), out = [];
      for (let f = 1; f < n; f += 1) {
        let s = 0;
        for (let k = 0; k < W * H; k += 1) s += Math.abs(buf[f * W * H + k] - buf[(f - 1) * W * H + k]);
        out.push(s);
      }
      resolve(normalise(out));
    });
  });
}

export function normalise(values) {
  const mean = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (values.length || 1)) || 1;
  return values.map((v) => (v - mean) / sd);
}

/**
 * Lag in seconds so that camera time t matches mix time t + lag, with its Pearson
 * correlation over the overlapping frames. Lags whose overlap is under `minOverlap` of
 * the shorter stream are skipped: a short overlap correlates by chance.
 */
export function bestLag(camera, mix, {fps = FPS, maxLagSeconds = MAX_LAG_SECONDS, minOverlap = 0.6} = {}) {
  const need = Math.max(2, Math.floor(Math.min(camera.length, mix.length) * minOverlap));
  let best = {lag: 0, r: -1};
  for (let lag = -maxLagSeconds * fps; lag <= maxLagSeconds * fps; lag += 1) {
    const from = Math.max(0, -lag), to = Math.min(camera.length, mix.length - lag);
    if (to - from < need) continue;
    let sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
    for (let k = from; k < to; k += 1) {
      const a = camera[k], b = mix[k + lag];
      sa += a; sb += b; saa += a * a; sbb += b * b; sab += a * b;
    }
    const n = to - from, cov = sab - sa * sb / n;
    const r = cov / (Math.sqrt((saa - sa * sa / n) * (sbb - sb * sb / n)) || 1);
    if (r > best.r) best = {lag: lag / fps, r};
  }
  return best;
}

/** Camera→mix offset of one take, trying each corner of the mix for the embedded webcam. */
export async function measureCameraOffset(cameraFile, mixFile) {
  const camera = await motionEnergy(cameraFile);
  let best = {lag: 0, r: -1};
  for (const crop of ['iw/2:ih/2:0:0', 'iw/2:ih/2:iw/2:0', 'iw/2:ih/2:0:ih/2', 'iw/2:ih/2:iw/2:ih/2']) {
    const found = bestLag(camera, await motionEnergy(mixFile, crop));
    if (found.r > best.r) best = {...found, corner: crop};
  }
  return best;
}

export const probeDuration = (file) => Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout.trim());

/**
 * One stretch of a take (camera clock, seconds) as a clip with the camera's picture and
 * the mix's audio. `segment` null means the whole take.
 */
export function cutCameraWithMixAudio({camera, mix}, segment, offset, output) {
  const [start, end] = segment ?? [0, probeDuration(camera)];
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y',
    '-ss', start.toFixed(3), '-i', camera,
    '-ss', Math.max(0, start + offset).toFixed(3), '-i', mix,
    '-t', (end - start).toFixed(3), '-map', '0:v:0', '-map', '1:a:0',
    '-c:v', 'libx264', '-crf', '16', '-preset', 'fast', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', output], {encoding: 'utf8'});
  if (r.status !== 0) throw new Error(`ffmpeg fallo en ${output}: ${r.stderr}`);
}

/**
 * A take with little movement correlates badly: it takes the median of the reliable
 * ones. Fails when none is reliable, so the caller asks for a manual offset.
 */
export function settleOffsets(offsets) {
  const reliable = Object.values(offsets).filter((o) => o.manual || o.r >= MIN_CORRELATION).map((o) => o.lag).sort((a, b) => a - b);
  const settled = {};
  for (const [take, o] of Object.entries(offsets)) {
    if (o.manual || o.r >= MIN_CORRELATION) {settled[take] = o; continue;}
    if (!reliable.length) throw new Error(`Desfase poco fiable en ${take} (r ${o.r.toFixed(2)}): pasa --offset`);
    settled[take] = {...o, measured: o.lag, lag: reliable[reliable.length >> 1], fallback: 'median'};
  }
  return settled;
}
