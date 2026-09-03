import test from 'node:test';
import assert from 'node:assert/strict';
import {buildProgressiveCaptionPlan} from '../src/lib/captions/planner.js';
import {captionPlacement, projectFaceToCanvas} from '../src/lib/captions/placement.js';
import {pipLayout} from '../src/lib/pip-layout.js';
import {captionsToAss, captionOverlayFromPlan, isKaraokeCaptions} from '../src/lib/subtitles.js';

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

test('karaoke pages stay short: four words and a character budget', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {mode: 'karaoke', preset: 'karaoke-highlight'});
  assert.ok(plan.pages.length >= 2, 'six words split across pages');
  for (const page of plan.pages) {
    const pageWords = page.lines.flatMap((line) => line.words);
    assert.ok(pageWords.length <= 4, `page has ${pageWords.length} words`);
    assert.ok(page.lines.length <= 2);
    for (const line of page.lines) {
      assert.ok(line.words.length <= 4);
      assert.ok(line.words.map((word) => word.text).join(' ').length <= 18, 'long words force an earlier wrap');
    }
  }
});

test('talking-head captions sit on the chest, not over the mouth', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {
    mode: 'karaoke',
    preset: 'karaoke-highlight',
    anchorY: captionPlacement({layout: 'crop'}).anchorY
  });
  const firstY = plan.pages[0].lines[0].y;
  assert.ok(firstY >= 1450, `caption y ${firstY} covers the face`);
  assert.ok(firstY <= 1680);
});

test('pip captions sit in the gap between the webcam card and the screen', () => {
  const pip = pipLayout({x: 1400, y: 40, w: 400, h: 500}, {sourceWidth: 1920, sourceHeight: 1080});
  const placement = captionPlacement({layout: 'pip', pip});
  const camBottom = pip.camCard.top + pip.camCard.height;
  assert.equal(placement.region, 'gap');
  assert.ok(placement.anchorY > camBottom);
  assert.ok(placement.anchorY < pip.screen.top);
  assert.ok(pip.captionBand.height >= 180);
  const face = projectFaceToCanvas({x: 1400, y: 40, w: 400, h: 500}, {width: 1920, height: 1080}, 'pip', pip);
  assert.equal(face.top, pip.camCard.top);
});

test('karaoke ASS keeps the whole page visible and colors the active word', () => {
  const ass = captionsToAss(timedCaption, {mode: 'karaoke'});
  assert.match(ass, /Style: Karaoke,Schibsted Grotesk/);
  assert.match(ass, /\\1c&H6AFF7C&/);
  assert.match(ass, /\\1a&H70&/);
  assert.match(ass, /\\fscx108\\fscy108/);
  assert.match(ass, /WHERE/);
  assert.match(ass, /EVER/);
  assert.match(ass, /WHERE/);
  assert.match(ass, /FOR/);
  assert.match(ass, /THE/);
  assert.match(ass, /FIRST/);
  assert.match(ass, /TIME/);
  assert.match(ass, /EVER/);
  const firstDialogue = ass.split('\n').find((line) => line.startsWith('Dialogue:'));
  assert.match(firstDialogue, /WHERE/);
  assert.match(firstDialogue, /\\1a&H70&/);
});

test('karaoke is the renderer for the karaoke-highlight preset even in progressive mode', () => {
  assert.equal(isKaraokeCaptions({preset: 'karaoke-highlight'}), true);
  assert.equal(isKaraokeCaptions({mode: 'karaoke'}), true);
  assert.equal(isKaraokeCaptions({mode: 'progressive', preset: 'progressive-reference'}), false);
  const document = captionsToAss(timedCaption, {mode: 'progressive', preset: 'karaoke-highlight'});
  assert.match(document, /Style: Karaoke/);
});

test('caption overlay payload keeps word times for the clip player', () => {
  const plan = buildProgressiveCaptionPlan(timedCaption, {preset: 'karaoke-highlight'});
  const overlay = captionOverlayFromPlan({...plan, renderer: 'ass-karaoke'});
  assert.equal(overlay.renderer, 'ass-karaoke');
  assert.equal(overlay.style.font, 'Schibsted Grotesk');
  assert.equal(overlay.style.activeColor, '#7CFF6A');
  assert.ok(overlay.pages[0].lines[0].words[0].start === 0);
  assert.equal(overlay.pages.flatMap((page) => page.lines.flatMap((line) => line.words)).length, 6);
});

test('progressive planner reports approximate timing for segment-only captions', () => {
  const plan = buildProgressiveCaptionPlan([{id: 'seg-1', start: 1, end: 3, text: 'Texto sin palabras medidas'}]);
  assert.equal(plan.timing.source, 'approximate');
  assert.equal(plan.timing.exactWords, 0);
  assert.equal(plan.timing.words, 4);
});
