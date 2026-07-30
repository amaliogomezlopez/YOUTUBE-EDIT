import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  findShortRender,
  loadShortPublishState,
  publishShort
} from '../src/modules/shorts-studio/publish.js';

const REFERENCE_SLUG = 'harness-vs-modelo';

async function withTempDir(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), 'shorts-publish-'));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
}

async function fakeRender(outputRoot, slug, runId) {
  const dir = path.join(outputRoot, `shorts-${slug}`, 'runs', runId, 'renders');
  await mkdir(dir, {recursive: true});
  const file = path.join(dir, `${slug}.mp4`);
  await writeFile(file, 'fake');
  return file;
}

test('findShortRender devuelve el render mas reciente del short', async () => {
  await withTempDir(async (outputRoot) => {
    await fakeRender(outputRoot, 'mi-short', '20260101T000000000Z-aaaaaaaa');
    const newest = await fakeRender(outputRoot, 'mi-short', '20260102T000000000Z-bbbbbbbb');
    assert.equal(await findShortRender('mi-short', {outputRoot}), newest);
  });
});

test('findShortRender devuelve null sin renders', async () => {
  await withTempDir(async (outputRoot) => {
    assert.equal(await findShortRender('mi-short', {outputRoot}), null);
  });
});

test('loadShortPublishState monta el contrato que espera publishJob', async () => {
  const state = await loadShortPublishState(REFERENCE_SLUG, {videoFile: 'D:/fake/short.mp4'});
  assert.equal(state.id, `shorts-${REFERENCE_SLUG}`);
  assert.ok(state.publishingMetadata.platform_posts.instagram, 'lee publishing-metadata.json del proyecto');
  assert.equal(state.clips.length, 1);
  assert.equal(state.clips[0].files.video, 'D:/fake/short.mp4');
  assert.ok(state.clips[0].suggestedTitle, 'el conector de YouTube usa suggestedTitle de fallback');
});

test('loadShortPublishState exige la metadata antes de publicar', async () => {
  await assert.rejects(
    () => loadShortPublishState('slug-que-no-existe', {videoFile: 'D:/fake/short.mp4'}),
    /shorts:publishing/
  );
});

test('publishShort delega en publishJob con el estado del short', async () => {
  const calls = [];
  const run = await publishShort(
    {slug: REFERENCE_SLUG, videoFile: 'D:/fake/short.mp4', platforms: ['youtube'], idempotencyKey: 'k-1'},
    {
      publish: async (state, options) => {
        calls.push({state, options});
        return {status: 'requires_manual_action', platforms: {youtube: {status: 'requires_manual_action'}}};
      }
    }
  );
  assert.equal(run.status, 'requires_manual_action');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].state.publishingMetadata.slug, REFERENCE_SLUG);
  assert.deepEqual(calls[0].options.platforms, ['youtube']);
  assert.equal(calls[0].options.idempotencyKey, 'k-1');
});
