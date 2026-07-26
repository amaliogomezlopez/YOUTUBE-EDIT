import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressiveCaptionPlan} from '../src/lib/captions/planner.js';
import {captionsToAss} from '../src/lib/subtitles.js';

const timedCaption = [{
  id: 'seg-1',
  start: 0,
  end: 2.2,
  text: 'where for the FIRST time ever',
  words: [
    {start: 0, end: 0.28, text: 'where'},
    {start: 0.28, end: 0.52, text: 'for'},
    {start: 0.52, end: 0.72, text: 'the'},
    {start: 0.72, end: 1.16, text: 'FIRST'},
    {start: 1.16, end: 1.54, text: 'time'},
    {start: 1.54, end: 2.2, text: 'ever'}
  ]
}];

test('progressive planner preserves exact word times and creates editorial hierarchy', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {preset: 'progressive-editorial'});
  assert.equal(plan.timing.source, 'word');
  assert.equal(plan.timing.words, 6);
  assert.equal(plan.pages.length, 1);
  assert.deepEqual(plan.pages[0].lines.map((line) => line.role), ['normal', 'hero', 'normal']);
  assert.equal(plan.pages[0].lines[1].words[0].text, 'FIRST');
  assert.ok(plan.pages[0].lines[1].fontSize > plan.pages[0].lines[0].fontSize * 1.8);
});

test('progressive ASS accumulates words at stable positions', () => {
  const ass = captionsToAss(timedCaption, {mode: 'progressive', preset: 'progressive-editorial'});
  assert.match(ass, /Style: Progressive,Arial Black/);
  assert.match(ass, /\\pos\(150,/);
  assert.match(ass, /WHERE FOR THE/);
  assert.match(ass, /\\fs166/);
  assert.match(ass, /FIRST/);
  assert.match(ass, /TIME EVER/);
});

test('punchy preset uses shorter pages and the local editorial font', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {preset: 'progressive-punchy'});
  assert.equal(plan.style.font, 'Bahnschrift');
  assert.equal(plan.style.maxWords, 5);
  assert.equal(plan.pages.length, 2);
  assert.ok(plan.pages.every((page) => page.lines.flatMap((line) => line.words).length <= 5));
});

test('progressive captions can render flat text without outline or shadow', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {
    preset: 'progressive-punchy',
    outlineSize: 0,
    shadow: 0
  });
  assert.equal(plan.style.outlineSize, 0);
  assert.equal(plan.style.shadow, 0);
  const ass = captionsToAss(timedCaption, {
    mode: 'progressive', preset: 'progressive-punchy', outlineSize: 0, shadow: 0
  });
  assert.match(ass, /\\bord0\\shad0/);
});

test('reference preset reproduces the centered lowercase, hero and uppercase stack', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {preset: 'progressive-reference'});
  assert.equal(plan.style.font, 'Arial');
  assert.equal(plan.style.align, 'center');
  assert.equal(plan.style.outlineSize, 0);
  assert.equal(plan.style.shadow, 0);
  assert.deepEqual(plan.pages[0].lines.map((line) => line.role), ['lead', 'hero', 'tail']);
  assert.deepEqual(plan.pages[0].lines.map((line) => line.case), ['lower', 'upper', 'upper']);
  assert.equal(plan.pages[0].lines[1].words[0].text, 'FIRST');
  assert.ok(plan.pages[0].lines[1].fontSize > plan.pages[0].lines[0].fontSize * 2);
  const ass = captionsToAss(timedCaption, {mode: 'progressive', preset: 'progressive-reference'});
  assert.match(ass, /where for the/);
  assert.match(ass, /FIRST/);
  assert.match(ass, /TIME EVER/);
  assert.match(ass, /\\an8\\pos\(540,/);
  assert.match(ass, /\\bord0\\shad0/);
});

test('progressive planner reports approximate timing for segment-only captions', () => {
  const plan = buildProgressiveCaptionPlan([{id: 'seg-1', start: 1, end: 3, text: 'Texto sin palabras medidas'}]);
  assert.equal(plan.timing.source, 'approximate');
  assert.equal(plan.timing.exactWords, 0);
  assert.equal(plan.timing.words, 4);
});
