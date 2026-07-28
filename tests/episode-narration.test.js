import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildKeepRanges,
  parseSilenceDetection
} from '../scripts/prepare-episode-narration.js';

test('parseSilenceDetection pairs FFmpeg events and closes trailing silence', () => {
  const parsed = parseSilenceDetection(`
[silencedetect] silence_start: 0
[silencedetect] silence_end: 1.2 | silence_duration: 1.2
[silencedetect] silence_start: 8.5
`, 10);
  assert.deepEqual(parsed, [
    {startSeconds: 0, endSeconds: 1.2, durationSeconds: 1.2},
    {startSeconds: 8.5, endSeconds: 10, durationSeconds: 1.5}
  ]);
});

test('buildKeepRanges trims edges and compresses only long internal pauses', () => {
  const result = buildKeepRanges({
    durationSeconds: 20,
    silences: [
      {startSeconds: 0, endSeconds: 1, durationSeconds: 1},
      {startSeconds: 4, endSeconds: 4.5, durationSeconds: 0.5},
      {startSeconds: 8, endSeconds: 11, durationSeconds: 3},
      {startSeconds: 19, endSeconds: 20, durationSeconds: 1}
    ],
    internalGapSeconds: 0.6,
    compressSilenceAfterSeconds: 1.2,
    edgePaddingSeconds: 0.1
  });
  assert.equal(result.trimStartSeconds, 0.9);
  assert.equal(result.trimEndSeconds, 19.1);
  assert.deepEqual(result.ranges, [
    {startSeconds: 0.9, endSeconds: 8.3},
    {startSeconds: 10.7, endSeconds: 19.1}
  ]);
  assert.deepEqual(result.compressedSilences, [{
    startSeconds: 8,
    endSeconds: 11,
    originalDurationSeconds: 3,
    retainedDurationSeconds: 0.6
  }]);
});

test('buildKeepRanges keeps a clip intact when no silence is detected', () => {
  const result = buildKeepRanges({
    durationSeconds: 5,
    silences: []
  });
  assert.deepEqual(result.ranges, [{startSeconds: 0, endSeconds: 5}]);
});
