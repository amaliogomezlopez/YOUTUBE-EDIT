import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildAudioChunks, getSttRuntimeConfig, mergeTranscriptChunks, transcribeAudio} from '../src/lib/stt.js';

test('buildAudioChunks covers long audio with bounded overlap', () => {
  assert.deepEqual(buildAudioChunks(125, 60, 5), [
    {index: 0, start: 0, end: 60, duration: 60},
    {index: 1, start: 55, end: 115, duration: 60},
    {index: 2, start: 110, end: 125, duration: 15}
  ]);
  assert.deepEqual(buildAudioChunks(30, 60, 5), [{index: 0, start: 0, end: 30, duration: 30}]);
});

test('getSttRuntimeConfig constrains overlap and accepts explicit zero retries', () => {
  const config = getSttRuntimeConfig({chunkSeconds: 10, overlapSeconds: 20, retries: 0, timeoutMs: 1234});
  assert.equal(config.overlapSeconds, 9.9);
  assert.equal(config.retries, 0);
  assert.equal(config.timeoutMs, 1234);
});

test('mergeTranscriptChunks rebases timestamps and removes overlap duplicates', () => {
  const merged = mergeTranscriptChunks([
    {start: 0, segments: [
      {start: 50, end: 57, text: 'Esta es una idea importante'},
      {start: 57, end: 60, text: 'que debemos recordar siempre'}
    ]},
    {start: 55, segments: [
      {start: 0, end: 2, text: 'Esta es una idea importante'},
      {start: 2, end: 8, text: 'que debemos recordar siempre para el canal'}
    ]}
  ], {overlapSeconds: 5});

  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map(({id, text}) => ({id, text})), [
    {id: 'seg-1', text: 'Esta es una idea importante'},
    {id: 'seg-2', text: 'que debemos recordar siempre'},
    {id: 'seg-3', text: 'para el canal'}
  ]);
  assert.ok(merged[2].start > 60 && merged[2].start < merged[2].end);
});

test('long transcription chunks sequentially, rebases, and always cleans workspace', async () => {
  const created = [];
  const transcribed = [];
  const cleaned = [];
  const output = await transcribeAudio('long.wav', {
    provider: 'openai', apiKey: 'test', chunkSeconds: 60, overlapSeconds: 5,
    probe: async () => ({duration: 125}),
    makeTempDir: async () => 'virtual-stt-workspace',
    createChunk: async (_input, outputFile, chunk) => created.push({outputFile, chunk}),
    transcribeChunk: async (chunkFile, chunk) => {
      transcribed.push({chunkFile, chunk});
      return [{start: 0, end: Math.min(4, chunk.duration), text: `chunk ${chunk.index}`}];
    },
    cleanup: async (workspace, options) => cleaned.push({workspace, options})
  });

  assert.equal(created.length, 3);
  assert.equal(transcribed.length, 3);
  assert.deepEqual(output.map((segment) => segment.start), [0, 55, 110]);
  assert.deepEqual(cleaned, [{workspace: 'virtual-stt-workspace', options: {recursive: true, force: true}}]);
});

test('long transcription cleans temporary chunks when a provider fails', async () => {
  let cleanupCalls = 0;
  await assert.rejects(transcribeAudio('long.wav', {
    provider: 'nemotron', url: 'https://asr.invalid', chunkSeconds: 60,
    probe: async () => ({duration: 61}),
    makeTempDir: async () => 'virtual-stt-workspace',
    createChunk: async () => {},
    transcribeChunk: async () => { throw new Error('provider unavailable'); },
    cleanup: async () => { cleanupCalls += 1; }
  }), /provider unavailable/);
  assert.equal(cleanupCalls, 1);
});

test('OpenAI retries transient responses without making a real request', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-stt-test-'));
  const audioFile = path.join(dir, 'audio.wav');
  await writeFile(audioFile, 'mock audio');
  let calls = 0;
  try {
    const segments = await transcribeAudio(audioFile, {
      provider: 'openai', apiKey: 'test-key', retries: 1, retryDelayMs: 0,
      probe: async () => ({duration: 1}),
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) return new Response('busy', {status: 503});
        return Response.json({segments: [{start: 0, end: 1, text: ' listo '}]});
      }
    });
    assert.equal(calls, 2);
    assert.equal(segments[0].text, 'listo');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('Nemotron does not retry a permanent client error', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-stt-test-'));
  const audioFile = path.join(dir, 'audio.wav');
  await writeFile(audioFile, 'mock audio');
  let calls = 0;
  try {
    await assert.rejects(transcribeAudio(audioFile, {
      provider: 'nemotron', url: 'https://asr.invalid', retries: 3, retryDelayMs: 0,
      probe: async () => ({duration: 1}),
      fetchImpl: async () => {
        calls += 1;
        return new Response('bad input', {status: 400});
      }
    }), /Nemotron transcription failed \(400\)/);
    assert.equal(calls, 1);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('HTTP transcription aborts on timeout and retries within configured limit', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-stt-test-'));
  const audioFile = path.join(dir, 'audio.wav');
  await writeFile(audioFile, 'mock audio');
  let calls = 0;
  try {
    await assert.rejects(transcribeAudio(audioFile, {
      provider: 'openai', apiKey: 'test-key', retries: 1, retryDelayMs: 0, timeoutMs: 5,
      probe: async () => ({duration: 1}),
      fetchImpl: async (_url, {signal}) => {
        calls += 1;
        return new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), {once: true}));
      }
    }), (error) => error.code === 'ETIMEDOUT');
    assert.equal(calls, 2);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

test('Whisper CLI preserves model/language contract and parses mocked JSON', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'shortsmith-stt-test-'));
  const audioFile = path.join(dir, 'audio.wav');
  await writeFile(audioFile, 'mock audio');
  let invocation;
  try {
    const segments = await transcribeAudio(audioFile, {
      provider: 'faster-whisper', command: 'mock-whisper', model: 'small', language: 'es', outDir: dir,
      probe: async () => ({duration: 1}),
      runCommand: async (command, args, options) => {
        invocation = {command, args, options};
        await writeFile(path.join(dir, 'audio.json'), JSON.stringify({segments: [{start: 0, end: 1, text: 'hola'}]}));
        return {stdout: '', stderr: ''};
      }
    });
    assert.equal(invocation.command, 'mock-whisper');
    assert.ok(invocation.args.includes('small'));
    assert.ok(invocation.args.includes('es'));
    assert.equal(segments[0].text, 'hola');
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});
