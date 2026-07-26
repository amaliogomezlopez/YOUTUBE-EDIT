import test from 'node:test';
import assert from 'node:assert/strict';
import {transcriptSourceKind, validateJobOptions} from '../src/lib/job-request.js';

test('job request validates numeric limits and compatible durations', () => {
  assert.deepEqual(validateJobOptions({topN: '5', minDuration: '18', maxDuration: '60'}), {
    topN: 5,
    minDuration: 18,
    maxDuration: 60,
    renderMode: undefined,
    renderQuality: 'high',
    subtitleMode: 'progressive',
    sttProvider: 'faster-whisper',
    sttModel: undefined,
    sttLanguage: 'auto',
    sttInitialPrompt: undefined,
    useLlm: false
  });
  assert.throws(() => validateJobOptions({topN: 'NaN'}), /número de clips/i);
  assert.throws(() => validateJobOptions({topN: '999'}), /entre 1 y 20/i);
  assert.throws(() => validateJobOptions({minDuration: '80', maxDuration: '40'}), /mínima no puede superar/i);
  assert.throws(() => validateJobOptions({renderQuality: 'ultra'}), /calidad/i);
});

test('transcript request accepts one source and rejects ambiguous combinations', () => {
  assert.equal(transcriptSourceKind({pathValue: 'D:\\clip.srt'}), 'path');
  assert.equal(transcriptSourceKind({uploadedSize: 100}), 'upload');
  assert.equal(transcriptSourceKind({pastedText: 'Texto'}), 'text');
  assert.equal(transcriptSourceKind({}), null);
  assert.throws(() => transcriptSourceKind({pathValue: 'D:\\clip.srt', pastedText: 'Texto'}), /una sola fuente/i);
  assert.throws(() => transcriptSourceKind({uploadedSize: 100, pastedText: 'Texto'}), /una sola fuente/i);
});
