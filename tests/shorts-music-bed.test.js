import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveMusicBed} from '../src/modules/shorts-studio/build.js';

const manifest = {
  assets: [
    {id: 'intro-loop', kind: 'video', file: 'projects/shorts/x/assets/intro-loop.mp4'},
    {id: 'logo', kind: 'image', file: 'projects/shorts/x/assets/logo.png'}
  ],
  music: {file: 'projects/shorts/x/assets/music.wav', bpm: 92}
};

test('sin plan de musica no hay cama', () => {
  assert.equal(resolveMusicBed({}, manifest), null);
  assert.equal(resolveMusicBed({sound: {}}, manifest), null);
});

test('un assetId valido resuelve el file del manifest con los defaults', () => {
  assert.deepEqual(resolveMusicBed({sound: {music: {assetId: 'intro-loop'}}}, manifest), {
    file: 'projects/shorts/x/assets/intro-loop.mp4',
    volume: 0.35,
    duckGainDb: -10
  });
});

test('el assetId "music" apunta a la pista registrada en la ingesta', () => {
  assert.equal(
    resolveMusicBed({sound: {music: {assetId: 'music'}}}, manifest).file,
    'projects/shorts/x/assets/music.wav'
  );
});

test('un assetId inexistente lanza error claro', () => {
  assert.throws(
    () => resolveMusicBed({sound: {music: {assetId: 'no-existo'}}}, manifest),
    /assetId "no-existo" no existe/
  );
  assert.throws(() => resolveMusicBed({sound: {music: {}}}, manifest), /assetId o file/);
});

test('file directo pasa tal cual y respeta volumen y ducking declarados', () => {
  assert.deepEqual(
    resolveMusicBed({sound: {music: {file: 'musicas/cama.mp3', volume: 0.2, duckGainDb: -14}}}, manifest),
    {file: 'musicas/cama.mp3', volume: 0.2, duckGainDb: -14}
  );
});
