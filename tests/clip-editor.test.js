import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
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


test('changing editing profile rebuilds scenes while keeping word corrections', async () => {
  const {root,state}=await fixture();
  try {
    state.clips[0].editing={enabled:true,profile:'sobrio',sceneEdits:[{id:'scene-1',layout:'fit'}],wordEdits:[{index:0,text:'Texto'}]};
    await rerenderClip(state,'clip-1',{editing:{profile:'energico'}},{
      renderCandidate:async({outputFile,editing,renderMode})=>{
        assert.equal(renderMode,null);
        assert.deepEqual(editing.sceneEdits,[]);
        assert.equal(editing.wordEdits[0].text,'Texto');
        await writeFile(outputFile,'new');
        return {outputFile,editing,duration:20,renderMode:'fit',captionTiming:'word'};
      }
    });
    assert.ok(state.warnings.some(w=>w.includes('perfil')));
  } finally {await rm(root,{recursive:true,force:true});}
});

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

test('switching caption preset resets inherited visual defaults', async () => {
  const {root, state} = await fixture();
  try {
    state.clips[0].renderSettings = {
      subtitleMode: 'progressive',
      subtitleStyle: {preset: 'progressive-punchy', font: 'Bahnschrift', align: 'left', uppercase: true, outlineSize: 3, shadow: 2}
    };
    const clip = await rerenderClip(state, 'clip-1', {
      subtitleStyle: {preset: 'progressive-reference'}
    }, {
      renderClip: async ({outputFile}) => writeFile(outputFile, 'new-reference')
    });
    assert.equal(clip.renderSettings.subtitleStyle.preset, 'progressive-reference');
    assert.equal(clip.renderSettings.subtitleStyle.font, 'Arial');
    assert.equal(clip.renderSettings.subtitleStyle.align, 'center');
    assert.equal(clip.renderSettings.subtitleStyle.uppercase, false);
    assert.equal(clip.renderSettings.subtitleStyle.outlineSize, 0);
    assert.equal(clip.renderSettings.subtitleStyle.shadow, 0);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('switching to karaoke-highlight uses Schibsted Grotesk and a green accent', async () => {
  const {root, state} = await fixture();
  try {
    const clip = await rerenderClip(state, 'clip-1', {
      subtitleMode: 'karaoke',
      subtitleStyle: {preset: 'karaoke-highlight'}
    }, {
      renderClip: async ({outputFile}) => writeFile(outputFile, 'karaoke')
    });
    assert.equal(clip.renderSettings.subtitleMode, 'karaoke');
    assert.equal(clip.renderSettings.subtitleStyle.font, 'Schibsted Grotesk');
    assert.equal(clip.renderSettings.subtitleStyle.activeColor, '#7CFF6A');
    assert.equal(clip.renderSettings.subtitleStyle.outlineSize, 5);
    assert.equal(clip.captionOverlay.renderer, 'ass-karaoke');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('failed rerender rolls back clip settings and removes staged artifacts', async () => {
  const {root, state} = await fixture();
  try {
    const before = structuredClone(state.clips[0]);
    await assert.rejects(() => rerenderClip(state, 'clip-1', {
      start: 12,
      end: 26,
      renderMode: 'fit',
      subtitleStyle: {preset: 'progressive-reference'}
    }, {
      renderClip: async ({outputFile}) => {
        await writeFile(outputFile, 'partial');
        throw new Error('FFmpeg simulated failure');
      }
    }), /simulated failure/i);

    const failed = state.clips[0];
    assert.equal(failed.start, before.start);
    assert.equal(failed.end, before.end);
    assert.deepEqual(failed.renderSettings, before.renderSettings);
    assert.deepEqual(failed.files, before.files);
    assert.equal(failed.status, 'render_failed');
    assert.match(failed.renderError, /simulated failure/i);
    assert.equal(await readFile(before.files.video, 'utf8'), 'old');
    assert.deepEqual((await readdir(path.dirname(before.files.video))).sort(), ['short-old.mp4']);

    const persisted = JSON.parse(await readFile(path.join(state.jobDir, 'job.json'), 'utf8')).clips[0];
    assert.equal(persisted.start, before.start);
    assert.deepEqual(persisted.files, before.files);
    assert.equal(persisted.status, 'render_failed');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
