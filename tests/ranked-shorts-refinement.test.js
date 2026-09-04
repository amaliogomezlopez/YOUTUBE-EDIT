import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {refineClips} from '../.agents/skills/create-ranked-shorts/scripts/refine-clips.mjs';
import {rerenderClip, saveJobState} from '../src/lib/pipeline.js';

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-refine-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const jobDir = path.join(root, 'job');
  const outputDir = path.join(root, 'output');
  await mkdir(jobDir);
  await mkdir(outputDir);
  const captions = [{id: 'caption-1', start: 0, end: 30, text: 'Antes dentro después', words: [
    {start: 1, end: 2, text: 'Antes'}, {start: 11, end: 12, text: 'dentro'}, {start: 25, end: 26, text: 'después'}
  ]}];
  const clip = {id: 'clip-1', rank: 3, suggestedTitle: 'Original', start: 10, end: 20, duration: 10, text: 'Anterior', status: 'ready',
    renderSettings: {engine: 'ffmpeg', mode: 'fit', quality: 'balanced', subtitleMode: 'karaoke', subtitleStyle: {preset: 'karaoke-highlight'}},
    publishing: {title: 'Original', titleVariants: ['Original'], youtube_shorts: {title: 'Original'}},
    files: {video: path.join(outputDir, 'old.mp4'), metadata: path.join(outputDir, 'old.json')}};
  const state = {id: 'refine-job', jobDir, outputDir, sourceVideo: path.join(root, 'source.mp4'), media: {duration: 60, width: 1000, height: 500}, clips: [clip]};
  await writeFile(clip.files.video, 'old');
  await writeFile(path.join(jobDir, 'transcript.json'), JSON.stringify(captions));
  await saveJobState(state);
  return {state, captions, log: () => {}, saveJobState};
}

test('refinement preserves approved settings and persists current text, title and artifact paths', async (t) => {
  const context = await fixture(t);
  let options;
  await refineClips({...context, items: [{clipId: 'clip-1', rank: 1, title: 'Título nuevo'}],
    rerenderClip: (state, id, edits) => {
      assert.deepEqual(edits, {start: 10, end: 20});
      return rerenderClip(state, id, edits, {renderClip: async (args) => {
        options = args;
        await writeFile(args.outputFile, 'new');
      }});
    }
  });
  const clip = context.state.clips[0];
  assert.equal(options.quality, 'balanced');
  assert.equal(clip.renderSettings.subtitleMode, 'karaoke');
  assert.equal(clip.renderSettings.subtitleStyle.preset, 'karaoke-highlight');
  assert.equal(clip.renderSettings.mode, 'fit');
  assert.equal(clip.text, 'dentro');
  assert.equal(clip.rank, 1);
  assert.equal(clip.publishing.youtube_shorts.title, 'Título nuevo');
  assert.deepEqual(clip.sourceCaptionIds, ['caption-1']);
  const metadata = JSON.parse(await readFile(clip.files.metadata, 'utf8'));
  const saved = JSON.parse(await readFile(path.join(context.state.jobDir, 'job.json'), 'utf8')).clips[0];
  assert.deepEqual(metadata, saved);
  assert.deepEqual(metadata, JSON.parse(JSON.stringify(clip)));
  assert.equal(await readFile(clip.files.video, 'utf8'), 'new');
});

test('refinement forwards explicit adaptive edits without replacing the mounted transcript', async (t) => {
  const context = await fixture(t);
  context.state.clips[0].editing = {enabled: true, profile: 'sobrio'};
  context.state.clips[0].renderSettings.engine = 'remotion';
  const editing = {effects: false, wordEdits: [{index: 0, text: 'Corregido'}]};
  await refineClips({...context, items: [{clipId: 'clip-1', editing, subtitleMode: 'progressive', subtitleStyle: {fontSize: 80}, subtitlePreset: 'progressive-reference', quality: 'high', renderMode: 'fit'}],
    rerenderClip: (state, id, edits) => {
      assert.deepEqual(edits.editing, editing);
      assert.deepEqual(edits.subtitleStyle, {fontSize: 80, preset: 'progressive-reference'});
      return rerenderClip(state, id, edits, {renderCandidate: async ({outputFile, editing: resolved, quality}) => {
        assert.equal(resolved.profile, 'sobrio');
        assert.equal(resolved.effects, false);
        assert.equal(quality, 'high');
        await writeFile(outputFile, 'remotion');
        return {outputFile, editing: resolved, duration: 8, renderMode: 'fit', transcript: [{text: 'Corregido'}]};
      }});
    }
  });
  assert.equal(context.state.clips[0].text, 'Corregido');
  assert.equal(context.state.clips[0].duration, 8);
  assert.equal(context.state.clips[0].suggestedTitle, 'Original');
});

test('refinement failure preserves the original editorial fields and video', async (t) => {
  const context = await fixture(t);
  const before = structuredClone(context.state.clips[0]);
  await assert.rejects(refineClips({...context, items: [{clipId: 'clip-1', rank: 1, title: 'No guardar'}],
    rerenderClip: (state, id, edits) => rerenderClip(state, id, edits, {renderClip: async () => {throw new Error('render failed');}})
  }), /render failed/);
  const clip = context.state.clips[0];
  assert.equal(clip.suggestedTitle, before.suggestedTitle);
  assert.equal(clip.rank, before.rank);
  assert.deepEqual(clip.publishing, before.publishing);
  assert.equal(clip.files.video, before.files.video);
  assert.equal(await readFile(clip.files.video, 'utf8'), 'old');
});

test('dry-run and render preflight validate the whole batch before writes or rendering', async () => {
  const state = {media: {duration: 60}, clips: [{id: 'one', start: 0, end: 10}, {id: 'two', start: 20, end: 30}]};
  const captions = [{start: 0, end: 30, text: 'Palabras'}];
  const forbidden = async () => assert.fail('Preflight must not write or render');
  for (const dryRun of [false, true]) {
    for (const invalid of [
      {clipId: 'missing'}, {clipId: 'two', start: 5, end: 5.5}, {clipId: 'two', end: 70},
      {clipId: 'two', rank: 0}, {clipId: 'two', title: ''}, {clipId: 'two', start: 40, end: 50},
      {clipId: 'one'}, {clipId: 'two', editing: []}
    ]) {
      await assert.rejects(refineClips({state, captions, dryRun, items: [{clipId: 'one'}, invalid], rerenderClip: forbidden, saveJobState: forbidden, persistMetadata: forbidden, log: () => {}}));
    }
  }
});

test('valid dry-run leaves the job and its metadata unchanged', async (t) => {
  const context = await fixture(t);
  const before = structuredClone(context.state);
  const beforeFile = await readFile(path.join(context.state.jobDir, 'job.json'), 'utf8');
  const forbidden = async () => assert.fail('Dry-run must not write or render');
  await refineClips({...context, dryRun: true, items: [{clipId: 'clip-1', title: 'Dry title'}], rerenderClip: forbidden, saveJobState: forbidden, persistMetadata: forbidden});
  assert.deepEqual(context.state, before);
  assert.equal(await readFile(path.join(context.state.jobDir, 'job.json'), 'utf8'), beforeFile);
});

test('completed refinements are saved even when a later clip fails', async () => {
  const state = {media: {duration: 60}, clips: [
    {id: 'one', rank: 2, start: 0, end: 10, files: {metadata: 'one.json'}},
    {id: 'two', rank: 3, start: 20, end: 30, suggestedTitle: 'Original'}
  ]};
  const saved = [];
  const metadata = [];
  await assert.rejects(refineClips({state, captions: [{start: 0, end: 30, text: 'Palabras'}],
    items: [{clipId: 'one', rank: 1, title: 'Completado'}, {clipId: 'two', title: 'Fallido'}],
    rerenderClip: async (job, id) => {
      if (id === 'two') throw new Error('second failed');
      return job.clips.find((clip) => clip.id === id);
    },
    saveJobState: async (job) => saved.push(structuredClone(job)),
    persistMetadata: async (file, clip) => metadata.push({file, clip: structuredClone(clip)}), log: () => {}
  }), /second failed/);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].clips[0].suggestedTitle, 'Completado');
  assert.equal(metadata[0].clip.suggestedTitle, 'Completado');
  assert.equal(state.clips[1].suggestedTitle, 'Original');
});
