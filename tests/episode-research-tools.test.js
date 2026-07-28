import assert from 'node:assert/strict';
import test from 'node:test';
import {
  flattenTranscriptWords,
  formatSrtTimestamp,
  transcriptToSrt
} from '../scripts/export-faster-whisper-transcript.js';
import {
  extractSloosSeries,
  parseCsvRows
} from '../scripts/extract-fed-sloos-series.js';

test('formatSrtTimestamp rounds and pads timestamps', () => {
  assert.equal(formatSrtTimestamp(65.4321), '00:01:05,432');
  assert.equal(formatSrtTimestamp(-1), '00:00:00,000');
});

test('transcript exporters preserve segment and word timing', () => {
  const segments = [{
    id: 'seg-1',
    start: 1.25,
    end: 2.5,
    text: 'Dato verificado',
    words: [
      {start: 1.25, end: 1.6, text: 'Dato', confidence: 0.9},
      {start: 1.6, end: 2.5, text: 'verificado', confidence: 0.8}
    ]
  }];
  assert.match(transcriptToSrt(segments), /00:00:01,250 --> 00:00:02,500/);
  assert.deepEqual(flattenTranscriptWords(segments).map((word) => word.index), [0, 1]);
});

test('parseCsvRows handles quoted commas and escaped quotes', () => {
  assert.deepEqual(parseCsvRows('"a","b,b","c""c"\n1,2,3\n'), [
    ['a', 'b,b', 'c"c'],
    ['1', '2', '3']
  ]);
});

test('extractSloosSeries selects the official series column', () => {
  const csv = [
    '"Series Description","Other","Net tightening"',
    '"Unit:","Percentage","Percentage"',
    '"Time Period","OTHER.Q","SUBLPDCILS_N.Q"',
    '2025Q3,0,',
    '2025Q4,1,6.5',
    '2026Q1,2,5.3',
    '2026Q2,3,8.1'
  ].join('\n');
  const result = extractSloosSeries(csv);
  assert.equal(result.seriesId, 'SUBLPDCILS_N.Q');
  assert.equal(result.description, 'Net tightening');
  assert.deepEqual(result.observations, [
    {period: '2025Q4', value: 6.5},
    {period: '2026Q1', value: 5.3},
    {period: '2026Q2', value: 8.1}
  ]);
});
