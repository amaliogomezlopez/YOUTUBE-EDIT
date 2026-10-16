import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {
  OPENVERSE_SITUATIONS, adoptSounds, adoptedFileName, measureEnvelope, normalizeOpenverseAudio,
  scoreCandidate, searchOpenverseAudio
} from '../src/modules/video-studio/openverse-sounds.js';
import {DEMO_BEATS, soundStart} from '../src/modules/video-studio/openverse-demo.js';
import {describeReelSound} from '../src/modules/talking-head/sound-usage.js';

const result = (overrides = {}) => ({
  id: 'eab8a6e2-0ac8-4615-9e0d-ebde30523783', title: 'Deep Whoosh #1', creator: 'Kinoton', license: 'cc0', license_version: '1.0',
  source: 'freesound', foreign_landing_url: 'https://freesound.org/people/Kinoton/sounds/351256',
  url: 'https://cdn.freesound.org/previews/351/351256_2247456-hq.mp3', filetype: 'mp3', duration: 3155, tags: [{name: 'whoosh'}],
  ...overrides
});

test('solo pasan licencias sin atribucion y descargas de CDNs conocidos', () => {
  assert.equal(normalizeOpenverseAudio(result()).license, 'cc0');
  assert.equal(normalizeOpenverseAudio(result({license: 'pdm'})).license, 'pdm');
  for (const license of ['by', 'by-sa', 'by-nc', 'sampling+']) assert.equal(normalizeOpenverseAudio(result({license})), null, license);
  assert.equal(normalizeOpenverseAudio(result({url: 'https://ejemplo.com/x.mp3'})), null);
});

test('la busqueda pide CC0/PDM y descarta lo que el servidor devuelva fuera de ese filtro', async () => {
  let asked;
  const fetchImpl = async (url) => {
    asked = new URL(url);
    return {ok: true, status: 200, json: async () => ({results: [result(), result({id: 'b', license: 'by'})]})};
  };
  const found = await searchOpenverseAudio('whoosh', {fetchImpl});
  assert.equal(asked.searchParams.get('license'), 'cc0,pdm');
  assert.equal(asked.searchParams.get('source'), 'freesound');
  assert.deepEqual(found.map((c) => c.license), ['cc0']);
  await assert.rejects(searchOpenverseAudio('x', {fetchImpl: async () => ({ok: false, status: 429})}), /limitado/);
});

test('un sonido adoptado es biblioteca de la apertura: no entra en ninguna rotacion', () => {
  for (const situation of Object.keys(OPENVERSE_SITUATIONS)) {
    for (const title of ['Riser money message', 'Cash Register', 'glitch click', 'Whoosh-in boom']) {
      const name = 'apertura/openverse/' + adoptedFileName(situation, normalizeOpenverseAudio(result({title})));
      assert.equal(describeReelSound(name).use, 'library', name);
    }
  }
});

test('envolvente: ataque, pico y duracion util a -30 dB', () => {
  const db = [-120, -120, -40, -6, -10, -20, -50, -120];
  const measured = measureEnvelope({db, blockSeconds: 0.1});
  assert.equal(measured.peakDb, -6);
  assert.equal(measured.onsetSeconds, 0.3);
  assert.equal(measured.peakSeconds, 0.3);
  assert.equal(measured.usefulSeconds, 0.3);
});

test('la puntuacion castiga lo que se nota en montaje', () => {
  const clean = {usefulSeconds: 0.4, onsetSeconds: 0, peakPosition: 0.1, peakDb: -3};
  assert.equal(scoreCandidate('golpe-palabra', clean).score, 1);
  assert.ok(scoreCandidate('golpe-palabra', {...clean, onsetSeconds: 0.25}).reasons.includes('silencio inicial'));
  assert.ok(scoreCandidate('golpe-palabra', {...clean, peakPosition: 0.8}).reasons.includes('pico tardio'));
  // Un riser empieza bajo a proposito; lo que no puede es tener el golpe al principio.
  const riser = {usefulSeconds: 2.5, onsetSeconds: 0.8, peakPosition: 0.95, peakDb: -3};
  assert.equal(scoreCandidate('arranque', riser).score, 1);
  assert.ok(scoreCandidate('arranque', {...riser, peakPosition: 0.2}).reasons.includes('no crece hasta el corte'));
});

test('la demo pone el pico de los anclados por el final en el corte', () => {
  const riser = DEMO_BEATS.find((beat) => beat.situation === 'arranque');
  const audio = {onsetSeconds: 0.4, peakSeconds: 2.0};
  assert.equal(Math.round((soundStart(riser, audio) + (audio.peakSeconds - audio.onsetSeconds)) * 1000) / 1000, riser.at);
  const hit = DEMO_BEATS.find((beat) => beat.situation === 'golpe-palabra');
  assert.equal(soundStart(hit, {onsetSeconds: 0.05, peakSeconds: 0.1}), hit.at);
});

test('adoptar copia con procedencia y rechaza licencias con atribucion', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'openverse-'));
  try {
    const staging = path.join(dir, 'staging'), library = path.join(dir, 'library');
    const audioFile = path.join(dir, 'a.mp3');
    await writeFile(audioFile, 'x');
    const candidate = {...normalizeOpenverseAudio(result()), file: audioFile, audio: {peakDb: -3}};
    await (await import('../src/lib/utils.js')).writeJson(path.join(staging, 'zoom', 'candidatos.json'), {candidates: [candidate, {...candidate, id: 'ffff0000', license: 'by'}]});
    const [name] = await adoptSounds('zoom', ['eab8a6e2'], {stagingDir: staging, libraryDir: library});
    assert.match(name, /^apertura\/openverse\/ov_zoom_deep-whoosh-1_eab8a6e2\.mp3$/);
    const provenance = JSON.parse(await readFile(path.join(library, 'procedencia.json'), 'utf8'));
    assert.equal(Object.values(provenance.sounds)[0].landingUrl, candidate.landingUrl);
    await assert.rejects(adoptSounds('zoom', ['ffff0000'], {stagingDir: staging, libraryDir: library}), /atribucion/);
  } finally {
    await rm(dir, {recursive: true, force: true});
  }
});

import {SFX_LEVELS_LU, parseEbur128, sfxGainDb} from '../src/modules/video-studio/sound-loudness.js';

test('sonoridad: max momentanea, integrada y pico real del log de ebur128', () => {
  const log = '[Parsed_ebur128_0] t: 0.1 TARGET:-23 LUFS    M:-120.7 S:-120.7\n[Parsed_ebur128_0] t: 0.2 TARGET:-23 LUFS    M: -9.4 S:-12.0\n' +
    '[Parsed_ebur128_0] t: 0.3 TARGET:-23 LUFS    M:-15.2 S:-12.0\n  Summary:\n\n  Integrated loudness:\n    I:         -12.8 LUFS\n  True peak:\n    Peak:       -0.4 dBFS';
  assert.deepEqual(parseEbur128(log), {maxMomentaryLufs: -9.4, integratedLufs: -12.8, truePeakDb: -0.4});
});

test('un efecto queda a su distancia de la voz y nunca pasa del techo de pico', () => {
  // Ding muy fuerte: se baja hasta quedar 9 LU por debajo de una voz a -14 LUFS.
  assert.equal(sfxGainDb({situation: 'cifra', momentaryLufs: -3, peakDb: -1}), -14 + SFX_LEVELS_LU.cifra + 3);
  // Whoosh flojo: se sube, pero su pico no puede pasar de -2 dBFS.
  assert.equal(sfxGainDb({situation: 'zoom-inverso', momentaryLufs: -40, peakDb: -10}), 8);
  // El remate queda mas cerca de la voz que el clic.
  assert.ok(SFX_LEVELS_LU.remate > SFX_LEVELS_LU.clic);
});
