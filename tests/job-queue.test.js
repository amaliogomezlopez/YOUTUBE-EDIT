import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {PersistentJobQueue} from '../src/lib/job-queue.js';

async function fixture(handler, options = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-queue-'));
  const file = path.join(dir, 'queue.json');
  const queue = new PersistentJobQueue({file, handler, retryDelayMs: 1, ...options});
  await queue.init();
  return {dir, file, queue};
}

async function waitFor(queue, id, status) {
  if (queue.get(id)?.status === status) return;
  await new Promise((resolve) => {
    const listener = (job) => {
      if (job.id !== id || job.status !== status) return;
      queue.off('updated', listener);
      resolve();
    };
    queue.on('updated', listener);
  });
}

test('persistent queue respects concurrency and saves completed jobs', async () => {
  let active = 0;
  let maximum = 0;
  const {dir, file, queue} = await fixture(async (payload) => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise((resolve) => setTimeout(resolve, 15));
    active -= 1;
    return payload.value * 2;
  }, {concurrency: 2});
  try {
    await Promise.all([1, 2, 3, 4].map((value) => queue.enqueue({value}, {id: `job-${value}`})));
    await queue.onIdle();
    assert.equal(maximum, 2);
    assert.deepEqual(queue.list().map((job) => job.status), ['completed', 'completed', 'completed', 'completed']);
    const saved = JSON.parse(await readFile(file, 'utf8'));
    assert.equal(saved.jobs.length, 4);
    assert.equal(saved.jobs.find((job) => job.id === 'job-4').result, 8);
  } finally {
    await queue.close();
    await rm(dir, {recursive: true, force: true});
  }
});

test('queue cancels queued and active jobs using AbortSignal', async () => {
  const {dir, queue} = await fixture(async (_payload, {signal}) => {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, 1000);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, {once: true});
    });
  });
  try {
    await queue.enqueue({}, {id: 'active'});
    await queue.enqueue({}, {id: 'pending'});
    await waitFor(queue, 'active', 'running');
    await queue.cancel('pending');
    await queue.cancel('active');
    await queue.onIdle();
    assert.equal(queue.get('active').status, 'cancelled');
    assert.equal(queue.get('pending').status, 'cancelled');
  } finally {
    await queue.close();
    await rm(dir, {recursive: true, force: true});
  }
});

test('queue retries automatically and supports manual retry', async () => {
  const calls = new Map();
  const {dir, queue} = await fixture(async ({key}) => {
    const count = (calls.get(key) ?? 0) + 1;
    calls.set(key, count);
    if (count === 1) throw new Error('temporary');
    return 'ok';
  });
  try {
    await queue.enqueue({key: 'auto'}, {id: 'auto', maxAttempts: 2});
    await queue.onIdle();
    assert.equal(queue.get('auto').status, 'completed');
    assert.equal(queue.get('auto').attempts, 2);

    await queue.enqueue({key: 'manual'}, {id: 'manual'});
    await queue.onIdle();
    assert.equal(queue.get('manual').status, 'failed');
    calls.set('manual', 1);
    await queue.retry('manual');
    await queue.onIdle();
    assert.equal(queue.get('manual').status, 'completed');
  } finally {
    await queue.close();
    await rm(dir, {recursive: true, force: true});
  }
});

test('queue recovers interrupted running jobs after restart', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-recovery-'));
  const file = path.join(dir, 'queue.json');
  await writeFile(file, JSON.stringify({version: 1, jobs: [{
    id: 'interrupted', payload: {value: 7}, status: 'running', priority: 0,
    attempts: 1, maxAttempts: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
  }]}), 'utf8');
  const queue = new PersistentJobQueue({file, handler: async ({value}) => value + 1});
  try {
    await queue.init();
    await queue.onIdle();
    const job = queue.get('interrupted');
    assert.equal(job.status, 'completed');
    assert.equal(job.result, 8);
    assert.equal(job.attempts, 2);
    assert.equal(job.recoveryCount, 1);
  } finally {
    await queue.close();
    await rm(dir, {recursive: true, force: true});
  }
});

test('queue persists scheduled work and does not run it before runAfter', async () => {
  const {dir, queue} = await fixture(async () => 'scheduled', {autoStart: false});
  try {
    const runAfter = new Date(Date.now() + 80).toISOString();
    await queue.enqueue({kind: 'scheduled'}, {id: 'scheduled-1', runAfter});
    queue.start();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(queue.get('scheduled-1').status, 'queued');
    await queue.onIdle();
    assert.equal(queue.get('scheduled-1').status, 'completed');
    assert.equal(queue.get('scheduled-1').runAfter, runAfter);
  } finally {
    await queue.close({cancelRunning: true});
    await rm(dir, {recursive: true, force: true});
  }
});
