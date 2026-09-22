import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeEdit, soundFamilyOf} from '../src/modules/editorial-memory/corpus.js';
import {buildStyleProfile, quantiles} from '../src/modules/editorial-memory/style-profile.js';
import {buildDecisionExamples} from '../src/modules/editorial-memory/examples.js';

const s = (seconds) => Math.round(seconds * 1e6);
const segment = (id, material, at, duration, extra = {}) => ({native: {id, material_id: material,
  target_timerange: {start: s(at), duration: s(duration)}, source_timerange: {start: s(extra.sourceIn ?? 0), duration: s(duration)}, ...extra}});
const timeline = () => ({id: 't', duration: s(60), tracks: [
  {type: 'video', segments: [
    segment('a', 'take1', 0, 20, {sourceIn: 0.5, common_keyframes: [{property_type: 'KFTypeScaleX', keyframe_list: [
      {time_offset: s(0.5), values: [1], curveType: 'Line'}, {time_offset: s(10.5), values: [1.12], curveType: 'Bezier'}]}]}),
    segment('b', 'take1', 20, 10, {sourceIn: 22, clip: {scale: {x: 1.2}}}),
    segment('c', 'take2', 30, 30, {sourceIn: 0.4, clip: {scale: {x: 1}, transform: {x: 0.3}}})]},
  {type: 'video', segments: [segment('img', 'photo', 40, 5, {volume: 1})]},
  {type: 'sticker', segments: [segment('st', 'sub', 0, 8, {clip: {scale: {x: 0.45}, transform: {x: 0.82, y: -0.85}}})]},
  {type: 'audio', segments: [segment('w', 'whoosh', 29.8, 0.8), segment('sh', 'shutter', 40, 0.5)]},
  {type: 'audio', segments: [segment('m', 'music', 0, 60, {volume: 0.04})]}
], materials: {
  videos: [{native: {id: 'take1', path: 'C:/rec/1.mkv', type: 'video'}}, {native: {id: 'take2', path: 'C:/rec/2.mkv', type: 'video'}},
    {native: {id: 'photo', path: 'C:/img/cap.png', type: 'photo'}}],
  stickers: [{native: {id: 'sub', name: 'Subscribe Stickers'}}],
  audios: [{native: {id: 'whoosh', name: 'DSGNWhsh_Quick Whoosh.wav'}}, {native: {id: 'shutter', name: 'Camera shutter sound'}}, {native: {id: 'music', name: 'Epic music'}}]
}});

test('normalizeEdit turns a CapCut timeline into takes, moves, inserts and anticipated sounds', () => {
  const edit = normalizeEdit(timeline(), {canvas: {width: 1920, height: 1080}});
  assert.equal(edit.format, 'horizontal');
  assert.deepEqual(edit.takes.map((t) => [t.name, t.layout, t.jumpCutGap ?? null]), [['1.mkv', 'full', null], ['1.mkv', 'full', 1.5], ['2.mkv', 'right', null]]);
  assert.deepEqual(edit.cameraMoves, [{at: 0, duration: 10, from: 1, to: 1.12, easing: 'curve', track: 0}]);
  assert.equal(edit.inserts[0].photo, true);
  assert.equal(edit.music[0].volume, 0.04);
  // The whoosh starts 0.2 s before the take change so its peak lands on the cut.
  assert.deepEqual(edit.sounds.map((x) => [x.family, x.event, x.lead]), [['whoosh', 'take-change', 0.2], ['shutter', 'image-in', 0]]);
});

test('sound library names map to Shortsmith families', () => {
  assert.equal(soundFamilyOf('DSGNWhsh_Short Whip, Short Whoosh 1'), 'whip');
  assert.equal(soundFamilyOf('理想的 Swoosh'), 'whoosh');
  assert.equal(soundFamilyOf('ES_Riser Metallic'), 'riser');
  assert.equal(soundFamilyOf('ReelAudio-67085.mp3'), 'unmapped');
});

test('style profile keeps sample sizes and never claims approval', () => {
  const edit = {...normalizeEdit(timeline(), {canvas: {width: 1920, height: 1080}}), project: 'x'};
  const profile = buildStyleProfile([edit], {format: 'horizontal'});
  assert.equal(profile.status, 'measured-not-approved');
  assert.equal(profile.videos, 1);
  assert.equal(profile.camera.peakZoom.n, 1);
  assert.equal(profile.brand.openingSticker.share, 1);
  assert.deepEqual(profile.sound.familyByEvent['take-change'], {whoosh: 1});
  assert.deepEqual(quantiles([1, 2, 3, 4]), {n: 4, p25: 1.75, median: 2.5, p75: 3.25, p90: 3.7});
});

test('decision examples bind words on the edit clock and keep quiet spans as negatives', () => {
  const edit = normalizeEdit(timeline(), {canvas: {width: 1920, height: 1080}});
  const words = Array.from({length: 60}, (_, i) => ({text: 'w' + i, start: i, end: i + 0.8}));
  const examples = buildDecisionExamples(edit, words, {project: 'x'});
  const cut = examples.find((e) => e.type === 'cut');
  assert.equal(cut.at, 30);
  assert.equal(cut.params.sound, 'whoosh');
  assert.equal(cut.context.before, 'w26 w27 w28 w29');
  assert.ok(examples.some((e) => e.type === 'none'));
  assert.ok(examples.every((e) => e.type !== 'none' || !examples.some((d) => d.type !== 'none' && Math.abs(d.at - e.at) < 4)));
});
