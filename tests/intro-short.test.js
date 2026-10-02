import test from 'node:test';
import assert from 'node:assert/strict';
import {
  introToShortPlan, isDenseAsset, logoPresentation, shortSoundPalette, shortStat, webcamBoxFromFace
} from '../src/modules/intro-short/translate.js';

// Una toma de 12 palabras, una cada medio segundo.
const words = Array.from({length: 12}, (_, index) => ({index, text: `w${index}`, start: index * 0.5 + 0.2, end: index * 0.5 + 0.6}));
const camClip = {id: '01', width: 1920, height: 1080, faceBox: {x: 760, y: 240, w: 360, h: 480}};
const manifest = {
  clips: [camClip],
  assets: [
    {id: 'logo', kind: 'image', file: 'projects/intro/x/assets/logo.png'},
    {id: 'demo', kind: 'video', file: 'projects/intro/x/assets/demo.mp4', durationSeconds: 1.5},
    {id: 'titular', kind: 'image', file: 'projects/intro/x/assets/titular.png'}
  ],
  music: {file: 'projects/intro/x/assets/music.mp3'}
};
const transcripts = {'01': {words}};
const art = {logo: {opaqueCoverage: 0.3, meanLuma: 0.5, darkRatio: 0.2, edgeDarkRatio: 0}, titular: {opaqueCoverage: 1, meanLuma: 0.9, darkRatio: 0, edgeDarkRatio: 0}};

function translate(escaletaScenes, planScenes, extra = {}) {
  return introToShortPlan({
    escaleta: {slug: 'x', titular: {text: 'Producto X'}, scenes: escaletaScenes},
    introPlan: {scenes: planScenes},
    manifest, transcripts, art,
    requests: {assets: [{id: 'titular', captura: 'titular'}]},
    ...extra
  });
}

test('el gancho lleva el logo arriba en placa y el short reutiliza titular y musica', () => {
  const {plan} = translate(
    [{id: 'hook', clip: '01', from: 0, to: 5, intent: 'gancho', asset: {id: 'logo', atWord: 2}}],
    [{id: 'hook', clipId: '01', trim: {start: 0.1, end: 3}, transitionIn: 'cut'}]
  );
  const [scene] = plan.scenes;
  assert.equal(scene.layout, 'full');
  assert.equal(scene.camera, 'punch-in');
  assert.deepEqual([scene.cues[0].type, scene.cues[0].atWord, scene.cues[0].slot, scene.cues[0].presentation], ['logo', 2, 'overlay-top', 'plate']);
  assert.equal(plan.title, 'Producto X');
  assert.equal(plan.sound.music.assetId, 'music');
  assert.equal(plan.derivedFrom.workflow, 'intro-short');
});

test('mostrar pone el recurso arriba desde el primer fotograma y vuelve a cara si el video se acaba', () => {
  const {plan} = translate(
    [{id: 'demo', clip: '01', from: 0, to: 11, intent: 'mostrar', broll: 'demo'}],
    [{id: 'demo', clipId: '01', trim: {start: 0.1, end: 4}, transitionIn: 'whip'}]
  );
  const [media, tail] = plan.scenes;
  assert.equal(media.layout, 'talking-head');
  const cue = media.cues[0];
  assert.equal(cue.type, 'broll');
  assert.equal(cue.slot, 'broll-panel');
  // ancla en la primera palabra, adelantada al inicio del recorte
  assert.ok(words[cue.atWord].start + cue.offsetSeconds >= media.trim.start);
  assert.ok(cue.holdSeconds <= 1.5);
  assert.equal(tail.layout, 'full');
  assert.equal(tail.trim.start, media.trim.end);
  assert.equal(tail.trim.end, 4);
});

test('una noticia se parte cuando se nombra y una captura densa va en stage', () => {
  const {plan} = translate(
    [{id: 'nota', clip: '01', from: 0, to: 11, intent: 'noticia', asset: {id: 'titular', atWord: 6}}],
    [{id: 'nota', clipId: '01', trim: {start: 0.1, end: 6}, transitionIn: 'cut'}]
  );
  assert.deepEqual(plan.scenes.map((s) => s.layout), ['full', 'stage']);
  assert.equal(plan.scenes[0].trim.end, plan.scenes[1].trim.start);
  assert.ok(Math.abs(plan.scenes[1].trim.start - (words[6].start - 0.04)) < 0.002);
  assert.equal(plan.scenes[1].cues[0].type, 'screenshot');
});

test('cifras, cortes secos dentro de la toma y escenas omitidas', () => {
  const {plan, report} = translate(
    [
      {id: 'a', clip: '01', from: 0, to: 3, intent: 'cifra', stat: {text: '7', note: 'meses sin un Pro', atWord: 2}},
      {id: 'b', clip: '01', from: 4, to: 7, intent: 'frase', keyword: {text: 'dato'}},
      {id: 'c', clip: '01', from: 8, to: 11, intent: 'enfasis'}
    ],
    [
      {id: 'a', clipId: '01', trim: {start: 0.1, end: 2.1}, transitionIn: 'cut'},
      {id: 'b', clipId: '01', trim: {start: 2.1, end: 4.1}, transitionIn: 'cut'},
      {id: 'c', clipId: '01', trim: {start: 4.1, end: 6.1}, transitionIn: 'flash-cut'}
    ],
    {overrides: {omit: ['c']}}
  );
  assert.equal(plan.scenes.length, 2);
  assert.deepEqual([plan.scenes[0].cues[0].text, plan.scenes[0].cues[0].note], ['7 MESES', 'sin un Pro']);
  assert.equal(plan.scenes[1].transitionSound, false);
  assert.deepEqual(report.keywordsDropped.map((k) => k.text), ['dato']);
  assert.equal(report.dropped[0].scene, 'c');
});

test('una toma de pantalla con webcam va en pip y no recibe recurso', () => {
  const screen = {...camClip, faceBox: {x: 1552, y: 111, w: 189, h: 253}};
  const {plan, report} = introToShortPlan({
    escaleta: {slug: 'x', scenes: [{id: 's', clip: '01', from: 0, to: 11, intent: 'mostrar', broll: 'demo'}]},
    introPlan: {scenes: [{id: 's', clipId: '01', trim: {start: 0.1, end: 4}}]},
    manifest: {...manifest, clips: [screen]}, transcripts, art
  });
  assert.equal(plan.scenes[0].layout, 'pip');
  const box = plan.scenes[0].webcamBox;
  assert.ok(box.x <= 1552 && box.x + box.w >= 1552 + 189 && box.x + box.w <= 1920);
  assert.equal(report.dropped.length, 1);
});

test('piezas sueltas: densidad, presentacion, cifras, paleta y webcam', () => {
  assert.equal(isDenseAsset({insert: true}), true);
  assert.equal(isDenseAsset({captura: 'portada'}), false);
  assert.equal(logoPresentation({opaqueCoverage: 1, meanLuma: 0.05, darkRatio: 0.9, edgeDarkRatio: 1}), 'blend');
  assert.equal(logoPresentation({opaqueCoverage: 0.3, meanLuma: 0.95, darkRatio: 0, edgeDarkRatio: 0}), 'card');
  assert.deepEqual(shortStat('200 $', 'al mes'), {text: '200 $', note: 'al mes'});
  assert.deepEqual(shortStat('3', 'motivos'), {text: '3 MOTIVOS', note: null});
  const sounds = shortSoundPalette({
    palette: {whoosh: ['sfx/a.wav'], rewind: ['sfx/in.wav'], paper: ['sfx/p.wav'], impact: ['sfx/in.wav', 'sfx/b.wav']},
    metadata: {'sfx/a.wav': {durationSeconds: 0.4}, 'sfx/b.wav': {durationSeconds: 1}},
    endAnchored: {'sfx/in.wav': 0.5}
  });
  assert.deepEqual(sounds.palette, {whoosh: ['sfx/a.wav'], impact: ['sfx/b.wav']});
  assert.equal(shortSoundPalette(null), null);
  const box = webcamBoxFromFace({x: 10, y: 10, w: 100, h: 100}, {width: 1920, height: 1080});
  assert.deepEqual([box.x, box.y], [0, 0]);
});
