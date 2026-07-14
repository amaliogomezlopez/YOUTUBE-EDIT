import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {rerenderClip, saveJobState, updateClipDecision} from '../src/lib/pipeline.js';

async function fixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-editor-'));
  const jobDir = path.join(root, 'job');
  const outputDir = path.join(root, 'output');
  const clipDir = path.join(outputDir, 'clip-1');
  const {mkdir} = await import('node:fs/promises');
  await Promise.all([mkdir(clipDir, {recursive: true}), mkdir(jobDir, {recursive: true})]);
  const metadata = path.join(clipDir, 'metadata.json');
  const video = path.join(clipDir, 'short-old.mp4');
  await writeFile(video, 'old');
  const state = {
    id: 'job-editor', jobDir, outputDir, sourceVideo: path.join(jobDir, 'source.mp4'),
    media: {duration: 120, width: 1000, height: 500}, renderMode: 'fit', webcamBox: null,
    clips: [{id: 'clip-1', start: 10, end: 30, duration: 20, status: 'ready', files: {video, metadata}}]
  };
  await writeFile(state.sourceVideo, 'source');
  await writeFile(path.join(jobDir, 'transcript.json'), JSON.stringify([{start: 0, end: 120, text: 'Texto de prueba para el clip'}]));
  await saveJobState(state);
  return {root, state};
}

test('clip editor persists accept and discard decisions', async () => {
  const {root, state} = await fixture();
  try {
    const clip = await updateClipDecision(state, 'clip-1', 'accepted');
    assert.equal(clip.editorialStatus, 'accepted');
    await updateClipDecision(state, 'clip-1', 'discarded');
    assert.equal(JSON.parse(await readFile(path.join(state.jobDir, 'job.json'))).clips[0].editorialStatus, 'discarded');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('clip editor validates range and rerenders with normalized webcam override', async () => {
  const {root, state} = await fixture();
  try {
    await assert.rejects(() => rerenderClip(state, 'clip-1', {start: 50, end: 40}), /rango/i);
    const clip = await rerenderClip(state, 'clip-1', {
      start: 12, end: 26, renderMode: 'pip', webcamBox: {x: 0.7, y: 0.05, w: 0.25, h: 0.35}
    }, {
      renderClip: async ({outputFile, webcamBox}) => {
        assert.deepEqual(webcamBox, {x: 700, y: 25, w: 250, h: 175, confidence: 1, method: 'manual-override'});
        await writeFile(outputFile, 'new');
      }
    });
    assert.equal(clip.duration, 14);
    assert.equal(clip.status, 'ready');
    assert.equal(await readFile(clip.files.video, 'utf8'), 'new');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
