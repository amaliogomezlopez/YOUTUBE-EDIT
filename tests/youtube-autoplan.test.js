import test from 'node:test';
import assert from 'node:assert/strict';
import {orderTakes, trimTake, planEdit, compileEditPlan, zoomAt, anchor} from '../src/modules/youtube-studio/autoplan.js';
import {evaluatePlan} from '../src/modules/youtube-studio/evaluate.js';
import {validateIntents, retrieveExamples} from '../src/modules/youtube-studio/intents.js';
import {parseSilences} from '../src/modules/video-studio/silences.js';
import {cutPadding} from '../src/modules/editorial-memory/examples.js';

const words = (text, start, step = 0.4) => text.split(' ').map((t, i) => ({text: t, start: start + i * step, end: start + i * step + 0.3}));
const q = (median) => ({n: 5, p25: median, median, p75: median, p90: median});
const share = (count, of) => ({count, of, share: Math.round(count / of * 100) / 100});
const profile = () => ({
  projects: ['a'], takes: {headTrimSeconds: q(0.4)}, speech: {leadSeconds: q(0.04), tailSeconds: q(0.08)},
  hook: {videosWithPunchIns: share(1, 3), punchInZoom: q(1.2), punchInSpacingSeconds: q(1.5), punchInSound: {shutter: 2}, videosWithEarlyMoves: share(0, 3)},
  outro: {videosWithMoves: share(0, 3), moveSeconds: q(8)},
  cuts: {soundShare: q(0.5), soundFamily: {whip: 3}},
  camera: {movesPerMinute: q(1), moveSeconds: q(4), peakZoom: q(1.1), curveShare: share(0, 3)},
  sound: {leadSecondsByEvent: {'take-change': q(0.17)}, musicVideos: share(3, 3), musicVolume: {...q(0.04), p90: 0.17}},
  brand: {openingSticker: share(0, 3), closingAsset: share(3, 3)}
});
const clip = (id, sourceName, text, extra = {}) => ({id, sourceName, file: `projects/youtube/x/${id}.mp4`, width: 1920, height: 1080,
  focus: {x: 0.5, y: 0.5}, words: words(text, 1), silences: [{start: 0, end: 1}], ...extra});

test('takes follow their recording number and resources stay out of the timeline', () => {
  const {takes, resources} = orderTakes([{sourceName: '10.mkv'}, {sourceName: 'grok46.mkv'}, {sourceName: '2.mkv'}]);
  assert.deepEqual(takes.map((t) => t.sourceName), ['2.mkv', '10.mkv']);
  assert.deepEqual(resources.map((t) => t.sourceName), ['grok46.mkv']);
});

test('trims snap to audio onset and drop a false start the transcriber merged', () => {
  const w = [...words('Y claro cuando Elon', 1.6, 0.35), ...words('Musk dijo que lo iban a entrenar en grandes cantidades de datos de ingenieria de SpaceX y todos esperabamos mucho', 5.3)];
  const silences = [{start: 0, end: 2.03}, {start: 3.06, end: 4.58}, {start: 12.2, end: 14}];
  const trim = trimTake(w, {headPad: 0.04, tailPad: 0.08, maxPause: 2, silences});
  assert.equal(trim.restartAt, 4.58);
  assert.equal(trim.pieces[0].in, 4.54);
  assert.equal(trim.pieces.at(-1).out, 12.28);
  assert.deepEqual(trimTake(words('hola que tal', 1), {headPad: 0.04, tailPad: 0.08, maxPause: 2, silences: [{start: 0, end: 1.1}]}).pieces, [{in: 1.06, out: 2.18}]);
});

test('planEdit takes every amount from the profile and never invents missing material', () => {
  const clips = [clip('01', '1.mkv', 'esto es el gancho, del video y sigue, un poco mas'), clip('02', '2.mkv', 'segunda toma con mas contenido para explicar la idea completa hoy')];
  const kit = {sounds: {whip: [{file: 'C:/sfx/whip.wav', duration: 0.5}], shutter: [{file: 'C:/sfx/shutter.wav', duration: 0.4}]},
    music: {file: 'C:/music.mp3', duration: 100}, outro: {file: 'C:/GRACIAS.mp4', duration: 5, width: 1920, height: 1080}};
  const plan = planEdit({clips, profile: profile(), kit});
  assert.ok(plan.decisions.some((d) => d.type === 'punch-in' && d.zoom === 1.2 && d.sound === 'shutter'));
  const sfx = plan.decisions.find((d) => d.type === 'sfx' && d.event === 'take-change');
  assert.equal(sfx.family, 'whip');
  assert.equal(sfx.lead, 0.17);
  assert.ok(plan.decisions.some((d) => d.type === 'outro'));
  assert.equal(plan.decisions.find((d) => d.type === 'music').volume, 0.04);
  assert.ok(!plan.decisions.some((d) => d.type === 'sticker'), 'sin sticker en el kit no se pide');
  const render = compileEditPlan(plan, {clips, kit});
  assert.equal(render.kind, 'youtube-render-plan');
  assert.ok(render.layers.some((l) => l.type === 'audio' && l.file === 'C:/sfx/whip.wav'));
  assert.throws(() => compileEditPlan(plan, {clips, kit: {...kit, sounds: {}}}), /familia/);
});

test('zoom keeps the face still without exposing borders', () => {
  const pushes = [{at: 0, seconds: 2, from: 1, to: 1.2, easing: 'linear'}];
  assert.equal(zoomAt(pushes, 1), 1.1);
  const offset = anchor({focus: {x: 0.9, y: 0.2}}, 1.2);
  assert.ok(Math.abs(offset.x) <= 0.2 + 1e-9 && Math.abs(offset.y) <= 0.2 + 1e-9);
  assert.equal(offset.x, -0.16);
  assert.deepEqual(anchor({}, 1.3), {x: 0, y: 0});
});

test('evaluation compares on each take clock', () => {
  const plan = {duration: 20, segments: [{sourceName: '1.mkv', in: 1, out: 11, at: 0, zoom: 1}, {sourceName: '2.mkv', in: 0.5, out: 10.5, at: 10, zoom: 1}],
    decisions: [{type: 'push', at: 12, from: 1, to: 1.1, seconds: 3}, {type: 'sfx', at: 9.83, lead: 0.17}]};
  const edit = {duration: 21, takes: [{name: '1.mkv', sourceIn: 1.1, duration: 10, at: 0, staticZoom: 1}, {name: '2.mkv', sourceIn: 0.4, duration: 11, at: 10, staticZoom: 1}],
    cameraMoves: [{at: 13, track: 0, from: 1, to: 1.1}], sounds: [{at: 9.8, lead: 0.2, event: 'take-change'}], music: [], stickers: []};
  const e = evaluatePlan(plan, edit);
  assert.equal(e.takes.headErrorMedian, 0.1);
  assert.equal(e.moves.matched, 1);
  assert.equal(e.sounds.recall, 1);
});

test('intents only keep references to sentences that exist', () => {
  const takes = [clip('01', '1.mkv', 'hola. esto es'), clip('02', '2.mkv', 'otra cosa')];
  const intents = validateIntents({emphasis: [{ref: '01:0'}, {ref: '09:3'}], topicShiftTakes: [1, 7], hookPunchRefs: ['01:1', '02:0']}, takes);
  assert.deepEqual(intents.emphasis, [{clipId: '01', atWord: 0}]);
  assert.deepEqual(intents.topicShiftTakes, [1]);
  assert.deepEqual(intents.hookPunchRefs, [{clipId: '01', atWord: 1}]);
  const bank = [{type: 'cut', context: {before: 'bolsa acciones', during: ''}}, {type: 'cut', context: {before: 'receta cocina', during: ''}}];
  assert.equal(retrieveExamples(bank, 'hablamos de acciones en bolsa', {perType: 1})[0].context.before, 'bolsa acciones');
});

test('silences parse ffmpeg output and measure the air around cuts', () => {
  const stderr = '[silencedetect] silence_start: 0\n[silencedetect] silence_end: 1.5 | silence_duration: 1.5\n[silencedetect] silence_start: 9.9\n';
  assert.deepEqual(parseSilences(stderr, 12), [{start: 0, end: 1.5}, {start: 9.9, end: 12}]);
  const padding = cutPadding({takes: [{at: 0, duration: 10}, {at: 10, duration: 5}]}, [{start: 9.91, end: 10.04}]);
  assert.deepEqual(padding, {lead: [0.04], tail: [0.09]});
});
