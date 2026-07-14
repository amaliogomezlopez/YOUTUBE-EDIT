import {EventEmitter} from 'node:events';
import {readFile, rename, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {ensureDir, makeId} from './utils.js';

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function errorDetails(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    code: error?.code
  };
}

async function replaceFile(temp, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(temp, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EACCES'].includes(error.code) || attempt >= 5) throw error;
      await new Promise((resolve) => setTimeout(resolve, 5 * (attempt + 1)));
    }
  }
}

export class PersistentJobQueue extends EventEmitter {
  constructor({file, handler, concurrency = 1, autoStart = true, retryDelayMs = 0} = {}) {
    super();
    if (!file) throw new Error('PersistentJobQueue requires a persistence file');
    if (typeof handler !== 'function') throw new Error('PersistentJobQueue requires a handler');
    super.setMaxListeners(100);
    this.file = file;
    this.handler = handler;
    this.concurrency = this.#validConcurrency(concurrency);
    this.autoStart = autoStart;
    this.retryDelayMs = Math.max(0, Number(retryDelayMs) || 0);
    this.jobs = new Map();
    this.controllers = new Map();
    this.retryTimers = new Map();
    this.wakeTimer = null;
    this.running = 0;
    this.started = false;
    this.closed = false;
    this.persistChain = Promise.resolve();
  }

  #validConcurrency(value) {
    const number = Number(value);
    if (!Number.isInteger(number) || number < 1) throw new Error('Queue concurrency must be a positive integer');
    return number;
  }

  async init() {
    if (this.started) return this;
    await ensureDir(path.dirname(this.file));
    try {
      const saved = JSON.parse(await readFile(this.file, 'utf8'));
      for (const job of saved.jobs ?? []) {
        if (!job?.id || this.jobs.has(job.id)) continue;
        if (job.status === 'running' || job.status === 'cancelling') {
          job.status = 'queued';
          job.recoveredAt = new Date().toISOString();
          job.recoveryCount = (job.recoveryCount ?? 0) + 1;
          job.startedAt = null;
        }
        this.jobs.set(job.id, job);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw new Error(`Cannot load job queue: ${error.message}`, {cause: error});
    }
    this.started = true;
    await this.#persist();
    if (this.autoStart) this.#pump();
    return this;
  }

  async enqueue(payload, {id = null, maxAttempts = 1, priority = 0, runAfter = null} = {}) {
    this.#assertReady();
    const jobId = id ?? makeId('queue');
    if (this.jobs.has(jobId)) throw new Error(`Queue job already exists: ${jobId}`);
    const attempts = Number(maxAttempts);
    if (!Number.isInteger(attempts) || attempts < 1) throw new Error('maxAttempts must be a positive integer');
    const now = new Date().toISOString();
    const job = {
      id: jobId,
      payload: clone(payload),
      status: 'queued',
      priority: Number(priority) || 0,
      attempts: 0,
      maxAttempts: attempts,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
      runAfter: runAfter ? new Date(runAfter).toISOString() : null,
      error: null,
      result: null
    };
    this.jobs.set(jobId, job);
    await this.#persist();
    this.#emitUpdate(job);
    this.#pump();
    return clone(job);
  }

  get(id) {
    const job = this.jobs.get(id);
    return job ? clone(job) : null;
  }

  list({status = null} = {}) {
    return [...this.jobs.values()]
      .filter((job) => !status || job.status === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(clone);
  }

  stats() {
    const counts = {};
    for (const job of this.jobs.values()) counts[job.status] = (counts[job.status] ?? 0) + 1;
    return {concurrency: this.concurrency, running: this.running, total: this.jobs.size, counts};
  }

  async cancel(id) {
    this.#assertReady();
    const job = this.jobs.get(id);
    if (!job) return null;
    if (TERMINAL_STATUSES.has(job.status)) return clone(job);
    const now = new Date().toISOString();
    job.cancelRequestedAt = now;
    job.updatedAt = now;
    if (job.status === 'queued') {
      job.status = 'cancelled';
      job.completedAt = now;
      this.#clearRetryTimer(id);
    } else {
      job.status = 'cancelling';
      this.controllers.get(id)?.abort(new Error('Job cancelled'));
    }
    await this.#persist();
    this.#emitUpdate(job);
    return clone(job);
  }

  async retry(id) {
    this.#assertReady();
    const job = this.jobs.get(id);
    if (!job) return null;
    if (!TERMINAL_STATUSES.has(job.status)) throw new Error(`Cannot retry a ${job.status} job`);
    this.#clearRetryTimer(id);
    job.status = 'queued';
    job.maxAttempts = Math.max(job.maxAttempts ?? 1, (job.attempts ?? 0) + 1);
    job.error = null;
    job.result = null;
    job.completedAt = null;
    job.cancelRequestedAt = null;
    job.updatedAt = new Date().toISOString();
    await this.#persist();
    this.#emitUpdate(job);
    this.#pump();
    return clone(job);
  }

  async setConcurrency(value) {
    this.concurrency = this.#validConcurrency(value);
    await this.#persist();
    this.#pump();
    return this.concurrency;
  }

  start() {
    this.#assertReady();
    this.autoStart = true;
    this.#pump();
  }

  pause() {
    this.autoStart = false;
  }

  async onIdle() {
    if (this.running === 0 && ![...this.jobs.values()].some((job) => job.status === 'queued')) return;
    await new Promise((resolve) => this.once('idle', resolve));
  }

  async close({cancelRunning = false} = {}) {
    this.autoStart = false;
    for (const timer of this.retryTimers.values()) clearTimeout(timer);
    this.retryTimers.clear();
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    if (cancelRunning) {
      const now = new Date().toISOString();
      for (const [id, controller] of this.controllers) {
        const job = this.jobs.get(id);
        job.status = 'cancelling';
        job.cancelRequestedAt = now;
        job.updatedAt = now;
        controller.abort(new Error('Queue closed'));
      }
    }
    while (this.running > 0) await new Promise((resolve) => this.once('settled', resolve));
    this.closed = true;
    await this.persistChain;
  }

  #assertReady() {
    if (!this.started) throw new Error('Queue must be initialized before use');
    if (this.closed) throw new Error('Queue is closed');
  }

  #nextQueued() {
    const now = Date.now();
    return [...this.jobs.values()]
      .filter((job) => job.status === 'queued' && !this.retryTimers.has(job.id) && (!job.runAfter || Date.parse(job.runAfter) <= now))
      .sort((a, b) => (b.priority - a.priority) || a.createdAt.localeCompare(b.createdAt))[0] ?? null;
  }

  #pump() {
    if (!this.started || this.closed || !this.autoStart) return;
    if (this.wakeTimer) clearTimeout(this.wakeTimer);
    this.wakeTimer = null;
    while (this.running < this.concurrency) {
      const job = this.#nextQueued();
      if (!job) break;
      this.#execute(job);
    }
    if (this.running < this.concurrency) this.#scheduleWake();
    this.#maybeIdle();
  }

  #scheduleWake() {
    const now = Date.now();
    const next = [...this.jobs.values()]
      .filter((job) => job.status === 'queued' && job.runAfter && !this.retryTimers.has(job.id))
      .map((job) => Date.parse(job.runAfter))
      .filter((time) => Number.isFinite(time) && time > now)
      .sort((a, b) => a - b)[0];
    if (!next) return;
    this.wakeTimer = setTimeout(() => {
      this.wakeTimer = null;
      this.#pump();
    }, Math.min(2_147_483_647, next - now));
    this.wakeTimer.unref?.();
  }

  async #execute(job) {
    const controller = new AbortController();
    this.controllers.set(job.id, controller);
    this.running += 1;
    job.status = 'running';
    job.attempts += 1;
    job.startedAt = new Date().toISOString();
    job.updatedAt = job.startedAt;
    job.error = null;
    await this.#persist();
    this.#emitUpdate(job);
    try {
      const result = await this.handler(clone(job.payload), {
        id: job.id,
        attempt: job.attempts,
        signal: controller.signal
      });
      if (controller.signal.aborted || job.cancelRequestedAt) {
        job.status = 'cancelled';
        job.result = null;
      } else {
        job.status = 'completed';
        job.result = clone(result);
      }
      job.completedAt = new Date().toISOString();
    } catch (error) {
      if (controller.signal.aborted || job.cancelRequestedAt || error?.name === 'AbortError') {
        job.status = 'cancelled';
        job.error = null;
        job.completedAt = new Date().toISOString();
      } else {
        job.error = errorDetails(error);
        if (job.attempts < job.maxAttempts) {
          job.status = 'queued';
          this.#scheduleRetry(job);
        } else {
          job.status = 'failed';
          job.completedAt = new Date().toISOString();
        }
      }
    } finally {
      job.updatedAt = new Date().toISOString();
      await this.#persist();
      this.controllers.delete(job.id);
      this.running -= 1;
      this.#emitUpdate(job);
      this.emit('settled', clone(job));
      this.#pump();
    }
  }

  #scheduleRetry(job) {
    if (!this.retryDelayMs) return;
    const timer = setTimeout(() => {
      this.retryTimers.delete(job.id);
      this.#pump();
    }, this.retryDelayMs);
    this.retryTimers.set(job.id, timer);
  }

  #clearRetryTimer(id) {
    const timer = this.retryTimers.get(id);
    if (timer) clearTimeout(timer);
    this.retryTimers.delete(id);
  }

  #emitUpdate(job) {
    this.emit('updated', clone(job));
    this.emit(job.status, clone(job));
  }

  #maybeIdle() {
    if (this.running === 0 && ![...this.jobs.values()].some((job) => job.status === 'queued')) this.emit('idle');
  }

  #persist() {
    this.persistChain = this.persistChain.catch(() => {}).then(async () => {
      const snapshot = {
        version: 1,
        updatedAt: new Date().toISOString(),
        concurrency: this.concurrency,
        jobs: [...this.jobs.values()]
      };
      const temp = `${this.file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
      await writeFile(temp, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await replaceFile(temp, this.file);
    });
    return this.persistChain;
  }
}
