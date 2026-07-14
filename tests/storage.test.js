import assert from 'node:assert/strict';
import {mkdir, mkdtemp, rm, stat, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {assertDiskCapacity, cleanupStorage, diskStatus} from '../src/lib/storage.js';

test('storage reports capacity and rejects impossible reservations', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-storage-'));
  try {
    const disk = await diskStatus(dir);
    assert.ok(disk.freeBytes > 0);
    await assertDiskCapacity(1, {target: dir, reserveBytes: 0});
    await assert.rejects(assertDiskCapacity(Number.MAX_SAFE_INTEGER, {target: dir, reserveBytes: 0}), /Espacio insuficiente/);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('storage cleanup previews and removes only expired managed entries', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-cleanup-'));
  const dirs = Object.fromEntries(['uploads', 'tmp', 'jobs', 'output'].map((name) => [name, path.join(root, name)]));
  try {
    await Promise.all(Object.values(dirs).map((dir) => mkdir(dir, {recursive: true})));
    const old = path.join(dirs.uploads, 'old.tmp');
    await writeFile(old, 'old');
    const now = Date.now() + 2 * 3600_000;
    const preview = await cleanupStorage({dryRun: true, now, tempMaxAgeHours: 1, uploadDir: dirs.uploads, tmpDir: dirs.tmp, jobsDir: dirs.jobs, outputDir: dirs.output});
    assert.equal(preview.count, 1);
    assert.ok(await stat(old));
    const cleaned = await cleanupStorage({dryRun: false, now, tempMaxAgeHours: 1, uploadDir: dirs.uploads, tmpDir: dirs.tmp, jobsDir: dirs.jobs, outputDir: dirs.output});
    assert.equal(cleaned.count, 1);
    await assert.rejects(stat(old), {code: 'ENOENT'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
