import assert from 'node:assert/strict';
import {mkdir, readFile, rm, stat, utimes, writeFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  ANIMATION_CLEANUP_CONFIRMATION,
  cleanupAnimationArtifacts
} from '../src/lib/animation-artifact-cleanup.js';

const root = path.resolve('remotion-animations', 'out', `.cleanup-test-${process.pid}`);
const remotionRoot = path.join(root, 'remotion');
const scoutRoot = path.join(root, 'scout');
const oldDate = new Date('2025-01-01T00:00:00.000Z');
const now = new Date('2026-07-26T12:00:00.000Z').getTime();

async function makeRun(name, {complete = true, recent = false} = {}) {
  const directory = path.join(remotionRoot, 'demo', 'runs', name);
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(directory, 'clip.mp4'), name);
  if (complete) await writeFile(path.join(directory, 'run-result.json'), '{}');
  if (!recent) {
    for (const file of ['clip.mp4', ...(complete ? ['run-result.json'] : [])]) {
      await utimes(path.join(directory, file), oldDate, oldDate);
    }
    await utimes(directory, oldDate, oldDate);
  }
  return directory;
}

async function makeScout(name, {complete = true} = {}) {
  const directory = path.join(scoutRoot, name);
  await mkdir(directory, {recursive: true});
  await writeFile(path.join(directory, 'sheet.jpg'), name);
  if (complete) await writeFile(path.join(directory, 'manifest.json'), '{}');
  for (const file of ['sheet.jpg', ...(complete ? ['manifest.json'] : [])]) {
    await utimes(path.join(directory, file), oldDate, oldDate);
  }
  await utimes(directory, oldDate, oldDate);
  return directory;
}

test.before(async () => {
  await mkdir(root, {recursive: true});
});

test.after(async () => {
  await rm(root, {recursive: true, force: true});
});

test('la simulación conserva archivos y protege recientes e incompletos', async () => {
  const oldRun = await makeRun('old-complete');
  const recentRun = await makeRun('recent-complete', {recent: true});
  const incompleteRun = await makeRun('old-incomplete', {complete: false});

  const result = await cleanupAnimationArtifacts({
    remotionRoot,
    scoutRoot,
    scope: 'remotion',
    olderThanDays: 30,
    keepLast: 1,
    now
  });

  assert.deepEqual(result.candidates.map((item) => item.id), ['old-complete']);
  assert.equal(result.protected.find((item) => item.id === recentRun.split(path.sep).at(-1))?.protectedReason, 'keep-last');
  assert.equal(result.protected.find((item) => item.id === 'old-incomplete')?.protectedReason, 'incomplete');
  assert.equal(await readFile(path.join(oldRun, 'clip.mp4'), 'utf8'), 'old-complete');
  assert.ok(await stat(incompleteRun));
});

test('aplicar exige la confirmación exacta', async () => {
  await assert.rejects(
    cleanupAnimationArtifacts({
      dryRun: false,
      remotionRoot,
      scoutRoot,
      scope: 'remotion',
      olderThanDays: 0,
      keepLast: 0,
      includeIncomplete: true,
      now
    }),
    /requiere --confirm/
  );
});

test('un filtro de proyecto exige scope remotion', async () => {
  await assert.rejects(
    cleanupAnimationArtifacts({
      remotionRoot,
      scoutRoot,
      project: 'demo'
    }),
    /requiere --scope remotion/
  );
});

test('aplicar borra solo candidatos administrados y deja legacy fuera', async () => {
  const scout = await makeScout('old-scout');
  const legacy = path.join(remotionRoot, 'demo', 'PREVIEWS');
  const rootLegacy = path.join(remotionRoot, 'old-preview.png');
  await mkdir(legacy, {recursive: true});
  await writeFile(path.join(legacy, 'debug.png'), 'legacy');
  await writeFile(rootLegacy, 'root-legacy');
  await utimes(path.join(legacy, 'debug.png'), oldDate, oldDate);
  await utimes(legacy, oldDate, oldDate);
  await utimes(rootLegacy, oldDate, oldDate);

  const result = await cleanupAnimationArtifacts({
    dryRun: false,
    confirm: ANIMATION_CLEANUP_CONFIRMATION,
    remotionRoot,
    scoutRoot,
    scope: 'scout',
    olderThanDays: 30,
    keepLast: 0,
    now
  });

  assert.equal(result.deleted.length, 1);
  await assert.rejects(stat(scout), {code: 'ENOENT'});
  assert.equal(await readFile(path.join(legacy, 'debug.png'), 'utf8'), 'legacy');
  assert.equal(await readFile(rootLegacy, 'utf8'), 'root-legacy');
});
