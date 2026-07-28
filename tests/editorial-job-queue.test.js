import assert from 'node:assert/strict';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  createEditorialJobQueue,
  editorialJobPublicDto,
  editorialJobQueueFile,
  enqueueEditorialStage
} from '../src/modules/editorial-video/job-queue.js';

const payload = {
  channelId: 'synthetic-channel',
  episodeId: 'episode-20260728090000-deadbeef',
  stage: 'research',
  inputRevision: 1
};

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-editorial-queue-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  return root;
}

test('editorial queue retries and its public DTO strips payload and errors', async (t) => {
  const root = await temporaryRoot(t);
  let calls = 0;
  const queue = createEditorialJobQueue({
    root,
    handler: async () => {
      calls += 1;
      if (calls === 1) {
        const error = new Error('Ruta privada D:\\secretos\\fuente.json');
        error.code = 'TEMPORARY_RESEARCH_FAILURE';
        throw error;
      }
      return {privateFile: 'D:\\secretos\\resultado.json'};
    }
  });
  await queue.init();
  try {
    await enqueueEditorialStage(queue, payload, {id: 'editorial-retry'});
    await queue.onIdle();
    assert.equal(queue.get('editorial-retry').status, 'failed');
    await queue.retry('editorial-retry');
    await queue.onIdle();
    const dto = editorialJobPublicDto(queue.get('editorial-retry'));
    assert.equal(dto.status, 'completed');
    assert.equal('payload' in dto, false);
    assert.equal('result' in dto, false);
    assert.doesNotMatch(JSON.stringify(dto), /secretos|privateFile/);
  } finally {
    await queue.close({cancelRunning: true});
  }
});

test('editorial queue cancellation propagates AbortSignal', async (t) => {
  const root = await temporaryRoot(t);
  const queue = createEditorialJobQueue({
    root,
    handler: async (_job, {signal}) =>
      new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 5000);
        if (signal.aborted) {
          clearTimeout(timer);
          reject(signal.reason);
          return;
        }
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(signal.reason);
        }, {once: true});
      })
  });
  await queue.init();
  try {
    await enqueueEditorialStage(queue, payload, {id: 'editorial-cancel'});
    await new Promise((resolve) => {
      const current = queue.get('editorial-cancel');
      if (current?.status === 'running') return resolve();
      queue.on('running', (job) => {
        if (job.id === 'editorial-cancel') resolve();
      });
    });
    await queue.cancel('editorial-cancel');
    await queue.onIdle();
    assert.equal(queue.get('editorial-cancel').status, 'cancelled');
  } finally {
    await queue.close({cancelRunning: true});
  }
});

test('editorial queue recovers interrupted jobs after restart', async (t) => {
  const root = await temporaryRoot(t);
  const file = editorialJobQueueFile(root);
  await mkdir(path.dirname(file), {recursive: true});
  const now = new Date().toISOString();
  await writeFile(file, JSON.stringify({
    version: 1,
    jobs: [
      {
        id: 'editorial-recovered',
        payload,
        status: 'running',
        priority: 0,
        attempts: 1,
        maxAttempts: 2,
        createdAt: now,
        updatedAt: now,
        startedAt: now,
        completedAt: null,
        runAfter: null,
        error: null,
        result: null
      }
    ]
  }), 'utf8');
  const queue = createEditorialJobQueue({
    root,
    handler: async () => ({status: 'safe'})
  });
  await queue.init();
  try {
    await queue.onIdle();
    const recovered = queue.get('editorial-recovered');
    assert.equal(recovered.status, 'completed');
    assert.equal(recovered.recoveryCount, 1);
    assert.equal(
      JSON.parse(await readFile(file, 'utf8')).jobs[0].status,
      'completed'
    );
  } finally {
    await queue.close();
  }
});

test('editorial queue rejects paths and arbitrary sensitive payload fields', async (t) => {
  const root = await temporaryRoot(t);
  const queue = createEditorialJobQueue({
    root,
    autoStart: false,
    handler: async () => null
  });
  await queue.init();
  try {
    assert.throws(
      () =>
        enqueueEditorialStage(queue, {
          ...payload,
          sourceFile: 'D:\\private\\source.json'
        }),
      /Campo no permitido.*sourceFile/
    );
  } finally {
    await queue.close();
  }
});
