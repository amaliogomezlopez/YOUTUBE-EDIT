import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPacingKeepRanges,
  mapSourceTimestamp,
  retimeTranscript
} from '../scripts/tighten-narration-pacing.js';

test('buildPacingKeepRanges caps long word gaps and preserves short pauses', () => {
  const result = buildPacingKeepRanges({
    durationSeconds: 10,
    words: [
      {start: 0.5, end: 1},
      {start: 1.6, end: 2},
      {start: 6, end: 6.5},
      {start: 7.1, end: 7.5}
    ],
    maxWordGapSeconds: 1,
    retainedGapSeconds: 0.7
  });
  assert.equal(result.edits.length, 1);
  assert.equal(result.edits[0].originalWordGapSeconds, 4);
  assert.equal(result.edits[0].retainedWordGapSeconds, 0.7);
  assert.equal(result.outputDurationSeconds, 6.7);
});

test('mapSourceTimestamp collapses removed time onto the previous edit edge', () => {
  const mapping = [
    {
      sourceStartSeconds: 0,
      sourceEndSeconds: 2.35,
      outputStartSeconds: 0,
      outputEndSeconds: 2.35
    },
    {
      sourceStartSeconds: 5.65,
      sourceEndSeconds: 10,
      outputStartSeconds: 2.35,
      outputEndSeconds: 6.7
    }
  ];
  assert.equal(mapSourceTimestamp(1.5, mapping), 1.5);
  assert.equal(mapSourceTimestamp(4, mapping), 2.35);
  assert.equal(mapSourceTimestamp(6, mapping), 2.7);
});

test('retimeTranscript preserves text and updates segment and word timings', () => {
  const transcript = {
    language: 'es',
    segments: [{
      id: 'seg-1',
      start: 0.5,
      end: 6.5,
      text: 'uno dos',
      words: [
        {text: 'uno', start: 0.5, end: 1},
        {text: 'dos', start: 6, end: 6.5}
      ]
    }]
  };
  const mapping = [
    {
      sourceStartSeconds: 0,
      sourceEndSeconds: 1.35,
      outputStartSeconds: 0,
      outputEndSeconds: 1.35
    },
    {
      sourceStartSeconds: 5.65,
      sourceEndSeconds: 10,
      outputStartSeconds: 1.35,
      outputEndSeconds: 5.7
    }
  ];
  const result = retimeTranscript(transcript, mapping);
  assert.equal(result.segments[0].text, 'uno dos');
  assert.equal(result.segments[0].words[1].start, 1.7);
  assert.equal(result.segments[0].words[1].end, 2.2);
});
