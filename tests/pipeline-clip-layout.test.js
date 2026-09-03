import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {processJob, resolveClipLayout, saveJobState} from '../src/lib/pipeline.js';

test('resolveClipLayout uses the candidate window and falls back to fit when auto', async () => {
  const box = {x: 10, y: 10, w: 80, h: 100};
  const pip = await resolveClipLayout({
    state: {sourceVideo: 'a.mp4', media: {width: 1920, height: 1080}},
    candidate: {start: 8, end: 22},
    renderMode: 'pip',
    webcamBox: null,
    options: {
      detectWebcam: async (_file, _media, options) => {
        assert.equal(options.window.startSeconds, 8);
        assert.equal(options.window.endSeconds, 22);
        return box;
      }
    }
  });
  assert.deepEqual(pip, {mode: 'pip', webcamBox: box, faceBox: box});

  const fit = await resolveClipLayout({
    state: {sourceVideo: 'a.mp4', media: {width: 1920, height: 1080}},
    candidate: {start: 40, end: 58},
    renderMode: 'pip',
    webcamBox: box,
    options: {detectWebcam: async () => null}
  });
  assert.deepEqual(fit, {mode: 'fit', webcamBox: null, faceBox: null});

  const talking = await resolveClipLayout({
    state: {sourceVideo: 'a.mp4', media: {width: 1920, height: 1080}},
    candidate: {start: 8, end: 22},
    renderMode: 'pip',
    webcamBox: null,
    options: {detectWebcam: async () => ({method: 'talking-head-face', layout: 'crop', confidence: 0.6})}
  });
  assert.deepEqual(talking, {mode: 'crop', webcamBox: null, faceBox: null});
});

test('ffmpeg path samples webcam per clip and writes karaoke overlay', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'shortsmith-cliplayout-'));
  const jobDir = path.join(root, 'job');
  const outputDir = path.join(root, 'output');
  await mkdir(jobDir, {recursive: true});
  const sourceVideo = path.join(jobDir, 'source.mp4');
  const transcript = path.join(jobDir, 'transcript.json');
  await writeFile(sourceVideo, 'video');
  const captions = [
    {id: 'a', start: 0, end: 20, text: 'primer corte con cara visible ahora mismo', words: [
      {text: 'primer', start: 0, end: 0.4}, {text: 'corte', start: 0.4, end: 0.8},
      {text: 'con', start: 0.8, end: 1}, {text: 'cara', start: 1, end: 1.4},
      {text: 'visible', start: 1.4, end: 2}
    ]},
    {id: 'b', start: 25, end: 45, text: 'segundo corte sin webcam en este tramo', words: [
      {text: 'segundo', start: 25, end: 25.4}, {text: 'corte', start: 25.4, end: 25.8},
      {text: 'sin', start: 25.8, end: 26}, {text: 'webcam', start: 26, end: 26.5}
    ]}
  ];
  await writeFile(transcript, JSON.stringify(captions));
  const state = {
    id: 'job-layout',
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobDir,
    outputDir,
    sourceVideo,
    sourceTranscript: transcript,
    error: null,
    clips: []
  };
  await saveJobState(state);

  const windows = [];
  const renders = [];
  const box = {x: 1400, y: 80, w: 400, h: 500, confidence: 0.9, method: 'yunet-face-tracking'};
  const finalState = await processJob(state, {
    useLlm: false,
    topN: 2,
    minDuration: 15,
    maxDuration: 25,
    subtitleMode: 'karaoke',
    subtitleStyle: {preset: 'karaoke-highlight'},
    ffprobe: async () => ({duration: 60, width: 1920, height: 1080, fps: 30}),
    detectWebcam: async (_file, _media, options) => {
      windows.push(options.window || null);
      if (options.window?.startSeconds >= 20) return null;
      return box;
    },
    renderClip: async ({outputFile, mode, webcamBox}) => {
      renders.push({mode, webcamBox: webcamBox ? {x: webcamBox.x, w: webcamBox.w} : null});
      await mkdir(path.dirname(outputFile), {recursive: true});
      await writeFile(outputFile, 'mp4');
    }
  });

  try {
    assert.equal(finalState.status, 'done');
    assert.ok(windows.some((window) => window && window.startSeconds >= 0 && window.endSeconds <= 25));
    assert.ok(renders.length >= 1);
    assert.ok(renders.some((item) => item.mode === 'pip' && item.webcamBox?.x === 1400));
    const karaokeClip = finalState.clips.find((clip) => clip.captionOverlay);
    assert.ok(karaokeClip, 'el clip guarda overlay karaoke');
    assert.equal(karaokeClip.captionOverlay.renderer, 'ass-karaoke');
    assert.equal(karaokeClip.renderSettings.subtitleStyle.font, 'Schibsted Grotesk');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
