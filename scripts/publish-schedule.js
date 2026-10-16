#!/usr/bin/env node
/**
 * Publicacion escalonada de los clips de un job de video largo.
 *
 *   node scripts/publish-schedule.js plan --job <id> [--every-hours 2] [--start ISO]
 *        [--platforms youtube,instagram] [--privacy public] [--clips clip-a,clip-b]
 *   node scripts/publish-schedule.js run --job <id> [--task-name "Shortsmith\\X"]
 *   node scripts/publish-schedule.js status --job <id>
 *
 * `plan` escribe `publish-schedule.json` en el job con un hueco por clip, en orden
 * de ranking. `run` publica como mucho un clip por ejecucion: el primero cuyo hueco
 * ya ha llegado, respetando la separacion minima respecto al ultimo publicado (si el
 * equipo estuvo apagado, los atrasados no salen de golpe). Esta pensado para
 * lanzarse cada pocos minutos desde el Programador de tareas; un lock evita que dos
 * ejecuciones se pisen y la clave de idempotencia de `publishJob` evita duplicados.
 * Con `--task-name`, al terminar todos los huecos borra esa tarea programada.
 */
import {execFile} from 'node:child_process';
import {open, rm, stat} from 'node:fs/promises';
import path from 'node:path';
import {JOBS_DIR, loadDotEnv, parseCliArgs, readJson, writeJson} from '../src/lib/utils.js';
import {loadJobState} from '../src/lib/pipeline.js';
import {publishJob} from '../src/lib/publishers.js';

const HOUR = 3600_000;
const LOCK_STALE_MS = 3 * HOUR;
const RETRY_AFTER_MS = 30 * 60_000;
const MAX_ATTEMPTS = 4;
const QUOTA_RETRY_WINDOW_MS = 26 * HOUR;

const args = parseCliArgs(process.argv.slice(2));
const command = args._[0];
const jobId = args.job && args.job !== true ? String(args.job) : null;

if (!['plan', 'run', 'status'].includes(command) || !jobId) {
  console.error('Uso: node scripts/publish-schedule.js plan|run|status --job <id> [opciones]');
  process.exit(1);
}

const jobDir = path.join(JOBS_DIR, jobId);
const scheduleFile = path.join(jobDir, 'publish-schedule.json');
const lockFile = path.join(jobDir, 'publish-schedule.lock');
const log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);

function isQuotaError(text) {
  return /quota|rate limit|exceeded/i.test(String(text || ''));
}

function platformErrors(run) {
  return Object.values(run?.platforms ?? {})
    .filter((item) => item.status === 'failed' || item.status === 'requires_manual_action')
    .map((item) => `${item.platform}: ${item.error || item.message || item.status}`);
}

async function plan() {
  const state = await loadJobState(jobId);
  const wanted = args.clips ? String(args.clips).split(',').map((item) => item.trim()) : null;
  const clips = (state.clips ?? [])
    .filter((clip) => clip.files?.video && (!wanted || wanted.includes(clip.id)))
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  if (!clips.length) throw new Error('No hay clips renderizados que programar.');
  const everyHours = Number(args['every-hours'] ?? 2);
  const start = args.start ? Date.parse(String(args.start)) : Date.now();
  if (!Number.isFinite(start) || !(everyHours > 0)) throw new Error('--start o --every-hours no validos.');
  const schedule = {
    jobId,
    createdAt: new Date().toISOString(),
    everyHours,
    platforms: String(args.platforms ?? 'youtube,instagram').split(',').map((item) => item.trim()).filter(Boolean),
    youtubePrivacy: String(args.privacy ?? 'public'),
    entries: clips.map((clip, index) => ({
      clipId: clip.id,
      rank: clip.rank ?? index + 1,
      title: clip.publishing?.youtube_shorts?.title ?? clip.title ?? clip.id,
      at: new Date(start + index * everyHours * HOUR).toISOString(),
      status: 'scheduled',
      attempts: 0
    }))
  };
  await writeJson(scheduleFile, schedule);
  printStatus(schedule);
}

function printStatus(schedule) {
  for (const entry of schedule.entries) {
    const links = Object.entries(entry.links ?? {}).map(([platform, url]) => `${platform}=${url}`).join(' ');
    console.log(`#${entry.rank} ${entry.at} ${entry.status.padEnd(22)} ${entry.title}${links ? `  ${links}` : ''}${entry.error ? `  [${entry.error}]` : ''}`);
  }
}

async function acquireLock() {
  try {
    const info = await stat(lockFile);
    if (Date.now() - info.mtimeMs < LOCK_STALE_MS) return false;
    await rm(lockFile, {force: true});
  } catch {}
  try {
    const handle = await open(lockFile, 'wx');
    await handle.writeFile(String(process.pid));
    await handle.close();
    return true;
  } catch {
    return false;
  }
}

function deleteTask(taskName) {
  return new Promise((resolve) => {
    execFile('schtasks', ['/delete', '/tn', taskName, '/f'], (error) => {
      log(error ? `No se pudo borrar la tarea ${taskName}: ${error.message}` : `Tarea ${taskName} borrada: calendario completo.`);
      resolve();
    });
  });
}

function pendingEntry(entry) {
  return entry.status === 'scheduled' || entry.status === 'retrying';
}

async function run() {
  if (!(await acquireLock())) {
    log('Otra ejecucion sigue en curso; salgo.');
    return;
  }
  try {
    const schedule = await readJson(scheduleFile);
    const now = Date.now();
    const lastPublished = Math.max(0, ...schedule.entries
      .filter((entry) => entry.publishedAt)
      .map((entry) => Date.parse(entry.publishedAt)));
    const minGap = schedule.everyHours * HOUR * 0.95;
    const entry = schedule.entries.find((item) => pendingEntry(item)
      && Date.parse(item.at) <= now
      && (!item.retryAfter || Date.parse(item.retryAfter) <= now));

    if (entry && (entry.status === 'retrying' || now - lastPublished >= minGap)) {
      log(`Publicando #${entry.rank} ${entry.clipId} en ${schedule.platforms.join(', ')}.`);
      const state = await loadJobState(jobId);
      const clip = state.clips.find((item) => item.id === entry.clipId);
      if (!clip) throw new Error(`Clip no encontrado: ${entry.clipId}`);
      clip.publishing = {
        ...clip.publishing,
        youtube_shorts: {...clip.publishing?.youtube_shorts, privacy: schedule.youtubePrivacy}
      };
      entry.attempts += 1;
      entry.firstAttemptAt ??= new Date().toISOString();
      const result = await publishJob(state, {
        clipId: entry.clipId,
        platforms: schedule.platforms,
        idempotencyKey: `schedule:${jobId}:${entry.clipId}`,
        retryFailed: entry.attempts > 1
      });
      entry.links = Object.fromEntries(Object.entries(result.platforms ?? {})
        .map(([platform, item]) => [platform, item.url || item.permalink || null])
        .filter(([, url]) => url));
      const errors = platformErrors(result);
      if (result.status === 'published') {
        entry.status = 'published';
        entry.publishedAt = new Date().toISOString();
        delete entry.error;
        delete entry.retryAfter;
      } else if (errors.length && errors.every(isQuotaError)
        && now - Date.parse(entry.firstAttemptAt) < QUOTA_RETRY_WINDOW_MS) {
        entry.status = 'retrying';
        entry.error = errors.join(' | ');
        entry.retryAfter = new Date(now + RETRY_AFTER_MS).toISOString();
      } else if (result.status === 'failed' && entry.attempts < MAX_ATTEMPTS) {
        entry.status = 'retrying';
        entry.error = errors.join(' | ');
        entry.retryAfter = new Date(now + RETRY_AFTER_MS).toISOString();
      } else {
        entry.status = result.status === 'failed' ? 'failed' : result.status;
        entry.error = errors.join(' | ') || undefined;
        // Un clip bloqueado no frena el calendario: el siguiente sigue su hueco.
        entry.publishedAt = new Date().toISOString();
      }
      log(`#${entry.rank} -> ${entry.status}${entry.error ? ` (${entry.error})` : ''} ${JSON.stringify(entry.links)}`);
      await writeJson(scheduleFile, schedule);
    } else {
      log('Nada que publicar ahora.');
    }

    const remaining = schedule.entries.filter(pendingEntry).length;
    if (!remaining && args['task-name'] && args['task-name'] !== true) await deleteTask(String(args['task-name']));
  } finally {
    await rm(lockFile, {force: true});
  }
}

await loadDotEnv();
if (command === 'plan') await plan();
else if (command === 'run') await run();
else printStatus(await readJson(scheduleFile));
