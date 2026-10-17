import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {bestLag, listRecordedTakes, normalise, obsTimestamp, settleOffsets} from '../src/modules/video-studio/recorded-takes.js';

async function recordings(names, {screen = true} = {}) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'tomas-'));
  await mkdir(path.join(dir, 'CAMARA'));
  if (screen) await mkdir(path.join(dir, 'PANTALLA'));
  for (const name of names) {
    await writeFile(path.join(dir, name), '');
    await writeFile(path.join(dir, 'CAMARA', `CAMARA ${name}`), '');
    if (screen) await writeFile(path.join(dir, 'PANTALLA', `PANTALLA ${name}`), '');
  }
  return dir;
}

test('OBS names give their recording time; other names give null', () => {
  assert.equal(obsTimestamp('2026-10-16 21-04-09.mkv'), Date.UTC(2026, 9, 16, 21, 4, 9));
  assert.equal(obsTimestamp('toma.mkv'), null);
});

test('takes come oldest first by default and newest first on request', async () => {
  const dir = await recordings(['2026-10-16 21-12-40.mkv', '2026-10-16 21-04-09.mkv', '2026-10-17 09-00-00.mkv']);
  try {
    assert.deepEqual((await listRecordedTakes(dir)).map((t) => t.name), ['2026-10-16 21-04-09.mkv', '2026-10-16 21-12-40.mkv', '2026-10-17 09-00-00.mkv']);
    assert.deepEqual((await listRecordedTakes(dir, {order: 'newest'})).map((t) => t.name)[0], '2026-10-17 09-00-00.mkv');
    const [first] = await listRecordedTakes(dir);
    assert.equal(first.camera, path.join(dir, 'CAMARA', 'CAMARA 2026-10-16 21-04-09.mkv'));
    assert.equal(first.screen, path.join(dir, 'PANTALLA', 'PANTALLA 2026-10-16 21-04-09.mkv'));
  } finally {await rm(dir, {recursive: true, force: true});}
});

test('a root file without its CAMARA twin is not a take, and no CAMARA folder means no split recording', async () => {
  const dir = await recordings(['2026-10-16 21-04-09.mkv'], {screen: false});
  try {
    await writeFile(path.join(dir, '2026-10-16 22-00-00.mkv'), '');
    await writeFile(path.join(dir, 'notas.txt'), '');
    const takes = await listRecordedTakes(dir);
    assert.deepEqual(takes.map((t) => t.name), ['2026-10-16 21-04-09.mkv']);
    assert.equal(takes[0].screen, null);
    assert.deepEqual(await listRecordedTakes(path.join(dir, 'CAMARA')), []);
  } finally {await rm(dir, {recursive: true, force: true});}
});

test('a camera or screen file named a second later than the mix still pairs; a distant one does not', async () => {
  const dir = await recordings([]);
  try {
    await writeFile(path.join(dir, '2026-10-17 18-41-20.mkv'), '');
    await writeFile(path.join(dir, 'CAMARA', 'CAMARA 2026-10-17 18-41-21.mkv'), '');
    await writeFile(path.join(dir, 'PANTALLA', 'PANTALLA 2026-10-17 18-41-21.mkv'), '');
    await writeFile(path.join(dir, '2026-10-17 18-50-00.mkv'), '');
    await writeFile(path.join(dir, 'CAMARA', 'CAMARA 2026-10-17 18-50-05.mkv'), '');
    const takes = await listRecordedTakes(dir);
    assert.deepEqual(takes.map((t) => t.name), ['2026-10-17 18-41-20.mkv']);
    assert.equal(takes[0].camera, path.join(dir, 'CAMARA', 'CAMARA 2026-10-17 18-41-21.mkv'));
    assert.equal(takes[0].screen, path.join(dir, 'PANTALLA', 'PANTALLA 2026-10-17 18-41-21.mkv'));
  } finally {await rm(dir, {recursive: true, force: true});}
});

test('the measured lag recovers a known shift between camera and mix motion', () => {
  const mix = normalise(Array.from({length: 600}, (_, i) => Math.sin(i / 7) + Math.sin(i / 23) * 0.5 + ((i * 7919) % 13) / 13));
  const camera = mix.slice(5, 500); // the camera starts 5 frames (0.167 s at 30 fps) after the mix
  const {lag, r} = bestLag(camera, mix);
  assert.ok(Math.abs(lag - 5 / 30) < 1e-9);
  assert.ok(r > 0.99);
});

test('unreliable takes fall back to the median of reliable ones; none reliable fails', () => {
  const settled = settleOffsets({a: {lag: 0.167, r: 0.9}, b: {lag: 0.133, r: 0.8}, c: {lag: -2.6, r: 0.2}});
  assert.equal(settled.c.lag, 0.167);
  assert.equal(settled.c.measured, -2.6);
  assert.equal(settled.a.fallback, undefined);
  assert.throws(() => settleOffsets({a: {lag: 1, r: 0.1}}), /--offset/);
  assert.equal(settleOffsets({a: {lag: 0.2, r: null, manual: true}}).a.lag, 0.2);
});
