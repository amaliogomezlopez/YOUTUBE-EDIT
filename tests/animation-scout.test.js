import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import {
  classifyFrameChange,
  createSamplingPlan,
  frameChangeScore,
  parseScoutCrop,
  parseScoutTime,
  rankMotionWindows
} from '../src/lib/animation-scout.js';
import {
  analyzeAnimationScout,
  getVisionLlmConfig,
  normalizeVisionReport
} from '../src/lib/animation-scout-llm.js';

test('scout time parser accepts seconds, MM:SS and HH:MM:SS', () => {
  assert.equal(parseScoutTime('42.5'), 42.5);
  assert.equal(parseScoutTime('01:02.250'), 62.25);
  assert.equal(parseScoutTime('01:02:03'), 3723);
  assert.equal(parseScoutTime(undefined), null);
  assert.throws(() => parseScoutTime('uno:dos'), /MM:SS/);
});

test('study sampling defaults above two fps and respects source and frame budgets', () => {
  const dense = createSamplingPlan({
    mode: 'study',
    durationSeconds: 8,
    sourceFps: 60
  });
  assert.equal(dense.requestedFps, 8);
  assert.equal(dense.effectiveFps, 8);
  assert.equal(dense.estimatedFrames, 64);
  assert.equal(dense.cappedByFrameBudget, false);

  const capped = createSamplingPlan({
    mode: 'study',
    durationSeconds: 60,
    sourceFps: 30,
    fps: 12,
    maxFrames: 120
  });
  assert.equal(capped.effectiveFps, 2);
  assert.equal(capped.estimatedFrames, 120);
  assert.equal(capped.cappedByFrameBudget, true);

  const sourceLimited = createSamplingPlan({
    mode: 'study',
    durationSeconds: 2,
    sourceFps: 24,
    fps: 60,
    maxFrames: 240
  });
  assert.equal(sourceLimited.effectiveFps, 24);
});

test('crop parser validates pixel bounds', () => {
  assert.deepEqual(
    parseScoutCrop('10:20:640:360', {width: 1920, height: 1080}),
    {x: 10, y: 20, width: 640, height: 360}
  );
  assert.throws(
    () => parseScoutCrop('1800:0:640:360', {width: 1920, height: 1080}),
    /excede/
  );
});

test('frame delta distinguishes holds, sustained motion and probable cuts', () => {
  const black = Buffer.alloc(16, 0);
  const near = Buffer.alloc(16, 1);
  const gray = Buffer.alloc(16, 80);
  assert.equal(frameChangeScore(black, black), 0);
  assert.equal(classifyFrameChange(frameChangeScore(black, near)), 'hold');
  assert.equal(classifyFrameChange(frameChangeScore(black, gray)), 'probable-cut');
});

test('motion window ranking favors sustained changes over a single hard cut', () => {
  const scores = [null, 0.03, 0.035, 0.04, 0.032, 0.03, 0.01, 0, 0.4, 0, 0, 0];
  const frames = scores.map((changeScore, index) => ({
    index: index + 1,
    timestampSeconds: index * 0.5,
    changeScore
  }));
  const windows = rankMotionWindows(frames, {fps: 2, windowSeconds: 2, limit: 4});
  assert.ok(windows.length > 0);
  assert.ok(windows.some((window) => window.kind === 'sustained-motion'));
  const bestSustained = windows.find((window) => window.kind === 'sustained-motion');
  assert.ok(bestSustained.startSeconds < 2);
});

test('vision config remains separate from the editorial LLM', () => {
  const config = getVisionLlmConfig({
    provider: 'openai-compatible',
    baseUrl: 'https://vision.example/v1',
    apiKey: 'secret',
    model: 'vision-model',
    maxImagesPerRequest: 6,
    jsonMode: false
  });
  assert.equal(config.baseUrl, 'https://vision.example/v1');
  assert.equal(config.model, 'vision-model');
  assert.equal(config.maxImagesPerRequest, 6);
  assert.equal(config.jsonMode, false);
});

test('vision report clamps candidates to the inspected source range', () => {
  const manifest = {mode: 'study', range: {startSeconds: 10, endSeconds: 18}};
  const report = normalizeVisionReport({
    animationCandidates: [{
      startSeconds: 8,
      endSeconds: 22,
      confidence: 2,
      observed: 'Un bloque entra y desacelera.'
    }]
  }, manifest, {model: 'test'});
  assert.equal(report.animationCandidates[0].startSeconds, 10);
  assert.equal(report.animationCandidates[0].endSeconds, 18);
  assert.equal(report.animationCandidates[0].confidence, 1);
});

test('multimodal analysis sends contact sheets as data URLs without audio or transcript', async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-animation-scout-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  const image = path.join(directory, 'sheet-001.jpg');
  await sharp({
    create: {width: 160, height: 90, channels: 3, background: '#14233a'}
  }).jpeg().toFile(image);
  const manifest = {
    mode: 'study',
    source: {displayName: 'reference.mp4'},
    media: {fps: 30},
    sampling: {effectiveFps: 8},
    crop: null,
    range: {startSeconds: 4, endSeconds: 8},
    contactSheets: [{
      index: 1,
      path: image,
      startSeconds: 4,
      endSeconds: 8,
      frames: [{
        index: 1,
        timestampSeconds: 4,
        changeScore: null,
        changeKind: 'first'
      }]
    }]
  };
  const calls = [];
  const result = await analyzeAnimationScout(manifest, {
    provider: 'openai-compatible',
    baseUrl: 'https://vision.example/v1',
    apiKey: 'secret',
    model: 'vision-model',
    chatJsonImpl: async (messages) => {
      calls.push(messages);
      return {
        batchSummary: 'Movimiento editorial',
        styleObservations: {motionLanguage: ['deslizar']},
        candidates: [{
          startSeconds: 4,
          endSeconds: 6,
          confidence: 0.8,
          observed: 'La forma se desplaza.'
        }],
        uncertainties: []
      };
    }
  });
  const content = calls[0][1].content;
  assert.equal(content[0].type, 'text');
  assert.match(content[1].image_url.url, /^data:image\/jpeg;base64,/);
  assert.doesNotMatch(content[0].text, /transcript/i);
  assert.equal(result.report.animationCandidates[0].startSeconds, 4);
});
