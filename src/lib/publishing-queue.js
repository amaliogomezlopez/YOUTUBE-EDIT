import crypto from 'node:crypto';
import path from 'node:path';
import {PersistentJobQueue} from './job-queue.js';
import {loadJobState} from './pipeline.js';
import {publishJob} from './publishers.js';
import {JOBS_DIR} from './utils.js';

function queueId(jobId, idempotencyKey) {
  const digest = crypto.createHash('sha256').update(`${jobId}\0${idempotencyKey}`).digest('hex').slice(0, 24);
  return `publish-${digest}`;
}

export async function createPublishingQueue({
  file = path.join(JOBS_DIR, 'publishing-queue.json'),
  concurrency = Number(process.env.PUBLISH_CONCURRENCY ?? 1),
  retryDelayMs = Number(process.env.PUBLISH_RETRY_DELAY_MS ?? 3000),
  autoStart = true,
  loadState = loadJobState,
  publish = publishJob
} = {}) {
  const queue = new PersistentJobQueue({
    file,
    concurrency,
    retryDelayMs,
    autoStart,
    handler: async (payload, context) => {
      const state = await loadState(payload.jobId);
      return publish(state, {...payload.options, signal: context.signal, retryFailed: context.attempt > 1});
    }
  });
  await queue.init();
  return queue;
}

export async function enqueuePublishingJob(queue, state, options = {}) {
  if (!queue || typeof queue.enqueue !== 'function') throw new Error('A publishing queue is required');
  const idempotencyKey = String(options.idempotencyKey || '').trim().slice(0, 160);
  if (!idempotencyKey) throw new Error('Falta la clave de idempotencia de publicación.');
  const id = queueId(state.id, idempotencyKey);
  const existing = queue.get(id);
  if (existing) return existing;
  let runAfter = null;
  if (options.scheduledFor) {
    const time = Date.parse(options.scheduledFor);
    if (!Number.isFinite(time)) throw new Error('La fecha programada no es válida.');
    if (time < Date.now() - 60_000) throw new Error('La fecha programada ya ha pasado.');
    if (time > Date.now() + 366 * 86400_000) throw new Error('La publicación no puede programarse con más de un año de antelación.');
    runAfter = new Date(time).toISOString();
  }
  return queue.enqueue({jobId: state.id, options: {...options, scheduledFor: runAfter, idempotencyKey}}, {id, maxAttempts: 2, runAfter});
}
