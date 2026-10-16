import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveSoundCue} from '../src/modules/video-studio/sound-families.js';
import {FAMILY_SITUATION, SFX_LEVELS_LU, calibratedVolume, soundMetadata} from '../src/modules/video-studio/sound-loudness.js';
import {SOUND_SITUATIONS} from '../src/modules/intro-studio/sound.js';

const palette = {camera: ['sfx/user-reel-a.wav'], impact: ['sfx/user-reel-b.wav']};

test('un efecto medido sale calibrado frente a la voz; uno sin medir, como antes', () => {
  const metadata = {'sfx/user-reel-a.wav': {durationSeconds: 0.4, momentaryLufs: -18.7, truePeakDb: -3}};
  const cue = resolveSoundCue('camera', 1, 1, 0, {palette, metadata});
  assert.equal(cue.calibrated, true);
  // zoom: 10 LU bajo una voz a -14 LUFS -> -24; el efecto mide -18.7 -> -5.3 dB.
  assert.equal(cue.volume, Math.round(10 ** (-5.3 / 20) * 1000) / 1000);
  const plain = resolveSoundCue('camera', 1, 1, 0, {palette, metadata: {'sfx/user-reel-a.wav': {durationSeconds: 0.4}}});
  assert.equal(plain.calibrated, undefined);
  assert.equal(plain.volume, 0.42);
});

test('la intensidad del plan ajusta en relativo y el volumen no pasa de 1', () => {
  const metadata = {momentaryLufs: -10, truePeakDb: -3};
  assert.ok(Math.abs(calibratedVolume('impact', metadata, 0.5) / calibratedVolume('impact', metadata, 1) - 0.5) < 0.01);
  assert.equal(calibratedVolume('impact', {momentaryLufs: -60, truePeakDb: -40}), 1);
  assert.equal(calibratedVolume('impact', {durationSeconds: 1}), null);
});

test('cada familia con situacion apunta a una situacion de montaje con nivel', () => {
  const situations = new Set(SOUND_SITUATIONS.map((s) => s.id));
  for (const [family, situation] of Object.entries(FAMILY_SITUATION)) {
    assert.ok(situations.has(situation), family);
    assert.ok(Number.isFinite(SFX_LEVELS_LU[situation]), situation);
  }
});

test('la metadata del importador lleva la sonoridad solo si se midio', () => {
  assert.deepEqual(soundMetadata({durationSeconds: 1, momentaryLufs: -12, truePeakDb: -3}, 0.9), {durationSeconds: 0.9, momentaryLufs: -12, truePeakDb: -3});
  assert.deepEqual(soundMetadata({durationSeconds: 1}), {durationSeconds: 1});
});

import os from 'node:os';
import path from 'node:path';
import {mkdtemp, mkdir, readFile, rm} from 'node:fs/promises';
import {run} from '../src/lib/utils.js';
import {withSfxLoudness} from '../src/modules/video-studio/sound-loudness.js';

test('el build completa la sonoridad de efectos del usuario y la deja en cache', async () => {
  const publicRoot = await mkdtemp(path.join(os.tmpdir(), 'sfx-loudness-'));
  try {
    await mkdir(path.join(publicRoot, 'sfx'));
    const file = 'sfx/user-reel-abc123-aligned-v2.wav';
    await run('ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', '-af', 'volume=-6dB', path.join(publicRoot, file)]);
    const metadata = await withSfxLoudness({[file]: {durationSeconds: 0.5}, 'sfx/library-pop.wav': {durationSeconds: 0.4}}, [file, 'sfx/library-pop.wav'], {publicRoot});
    assert.ok(Number.isFinite(metadata[file].momentaryLufs));
    assert.equal(metadata[file].durationSeconds, 0.5);
    assert.equal(metadata['sfx/library-pop.wav'].momentaryLufs, undefined);
    const index = JSON.parse(await readFile(path.join(publicRoot, 'sfx', 'loudness-index.json'), 'utf8'));
    assert.deepEqual(Object.keys(index.files), [file]);
  } finally {
    await rm(publicRoot, {recursive: true, force: true});
  }
});

import {resolveBrandKit} from '../src/modules/editorial-memory/kit.js';

test('el kit de los videos largos sale calibrado y guarda el volumen de CapCut', async () => {
  const edits = [{sounds: [{file: 'w.wav', family: 'whoosh', volume: 0.3}], music: [], takes: [], inserts: [], stickers: []}];
  const options = {probe: async () => ({duration: 0.4}), readFile: async () => '', exists: () => true};
  const plain = await resolveBrandKit(edits, options);
  assert.equal(plain.sounds.whoosh[0].volume, 0.3);
  const kit = await resolveBrandKit(edits, {...options, loudness: async () => ({maxMomentaryLufs: -10, truePeakDb: -1})});
  const [sound] = kit.sounds.whoosh;
  assert.equal(sound.capcutVolume, 0.3);
  assert.equal(sound.calibrated, true);
  // entrar-broll: 9 LU bajo -14 -> -23; mide -10 -> -13 dB.
  assert.equal(sound.volume, Math.round(10 ** (-13 / 20) * 1000) / 1000);
});
