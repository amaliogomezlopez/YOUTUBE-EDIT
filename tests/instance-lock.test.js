import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {acquireInstanceLock} from '../src/lib/instance-lock.js';

test('instance lock rejects a live owner and releases only its own lock', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-lock-'));
  const file = path.join(dir, 'instance.lock');
  try {
    const release = await acquireInstanceLock(file);
    await assert.rejects(acquireInstanceLock(file), (error) => error.code === 'INSTANCE_ALREADY_RUNNING');
    assert.equal(JSON.parse(await readFile(file, 'utf8')).pid, process.pid);
    await release();
    const releaseAgain = await acquireInstanceLock(file);
    await releaseAgain();
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('instance lock recovers a stale owner', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-stale-lock-'));
  const file = path.join(dir, 'instance.lock');
  try {
    await writeFile(file, JSON.stringify({pid: 2_147_483_647}), 'utf8');
    const release = await acquireInstanceLock(file);
    assert.equal(JSON.parse(await readFile(file, 'utf8')).pid, process.pid);
    await release();
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
