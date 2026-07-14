import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createPublishingQueue, enqueuePublishingJob} from '../src/lib/publishing-queue.js';

test('publishing queue persists, deduplicates and forwards cancellation signal', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-publish-queue-'));
  let calls = 0;
  let receivedSignal;
  const retryFlags = [];
  const queue = await createPublishingQueue({
    file: path.join(dir, 'queue.json'),
    autoStart: false,
    loadState: async (id) => ({id}),
    publish: async (state, options) => {
      calls += 1;
      receivedSignal = options.signal;
      retryFlags.push(options.retryFailed);
      return {id: state.id, status: 'published'};
    }
  });
  try {
    const state = {id: 'job-1'};
    const first = await enqueuePublishingJob(queue, state, {idempotencyKey: 'same-key', platforms: ['youtube']});
    const duplicate = await enqueuePublishingJob(queue, state, {idempotencyKey: 'same-key', platforms: ['youtube']});
    assert.equal(duplicate.id, first.id);
    assert.equal(queue.list().length, 1);
    queue.start();
    await queue.onIdle();
    assert.equal(calls, 1);
    assert.equal(receivedSignal instanceof AbortSignal, true);
    assert.equal(queue.get(first.id).status, 'completed');
    await queue.retry(first.id);
    await queue.onIdle();
    assert.equal(calls, 2);
    assert.deepEqual(retryFlags, [false, true]);
    const stored = JSON.parse(await readFile(path.join(dir, 'queue.json'), 'utf8'));
    assert.equal(stored.jobs[0].status, 'completed');
  } finally {
    await queue.close({cancelRunning: true});
    await rm(dir, {recursive: true, force: true});
  }
});
