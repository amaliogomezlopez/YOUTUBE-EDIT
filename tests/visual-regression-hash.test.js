import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import sharp from 'sharp';
import {
  hashDistance,
  luminanceStats,
  perceptualHash
} from '../remotion-animations/scripts/lib/perceptual-hash.mjs';

/**
 * ANM-J03 — La red de regresión visual del episodio. Sin ella no se puede tocar
 * el router de escenas: no habría forma de decir qué escenas cambian de píxeles
 * y cuáles no. Aquí se comprueba que el hash mide lo que dice medir.
 */

const solid = (color) =>
  sharp({create: {width: 320, height: 180, channels: 3, background: color}})
    .png()
    .toBuffer();

const halves = (left, right) =>
  sharp({create: {width: 320, height: 180, channels: 3, background: left}})
    .composite([
      {
        input: {
          create: {width: 160, height: 180, channels: 3, background: right}
        },
        left: 160,
        top: 0
      }
    ])
    .png()
    .toBuffer();

test('el mismo frame produce el mismo hash', async () => {
  const first = await perceptualHash(await solid('#123456'));
  const second = await perceptualHash(await solid('#123456'));
  assert.equal(first, second);
  assert.equal(hashDistance(first, second), 0);
});

test('un cambio de composición separa los hashes', async () => {
  const flat = await perceptualHash(await solid('#123456'));
  const split = await perceptualHash(await halves('#123456', '#EEEEEE'));
  assert.ok(
    hashDistance(flat, split) > 6,
    'un corte vertical debería superar la tolerancia de 6 bits'
  );
});

test('un cambio de brillo sin cambio de forma no dispara el hash', async () => {
  // El render no es bit-exacto: si el hash reaccionara a esto, cada corrida
  // daría un falso positivo y la red no serviría para nada.
  const dark = await perceptualHash(await halves('#101010', '#909090'));
  const bright = await perceptualHash(await halves('#151515', '#959595'));
  assert.ok(hashDistance(dark, bright) <= 6);
});

test('la estadística de luminancia distingue un frame plano de uno con contenido', async () => {
  const flat = await luminanceStats(await solid('#101010'));
  const split = await luminanceStats(await halves('#101010', '#F0F0F0'));
  assert.ok(flat.luminanceVariance < 8, 'un frame plano debe delatarse');
  assert.ok(split.luminanceVariance > 8);
});

test('la baseline versionada cubre las 58 escenas con tres muestras', async () => {
  const baseline = JSON.parse(
    await readFile(
      new URL(
        '../tests/fixtures/visual-regression/episode-finance-cavaliers-001.json',
        import.meta.url
      ),
      'utf8'
    )
  );
  const scenes = new Set(baseline.frames.map((frame) => frame.sceneId));
  assert.equal(baseline.hashAlgorithm, 'dhash-64');
  assert.equal(scenes.size, 58);
  assert.equal(baseline.frames.length, scenes.size * 3);
  for (const frame of baseline.frames) {
    assert.match(frame.hash, /^[0-9a-f]{16}$/);
    assert.ok(
      frame.luminanceVariance > 8,
      `${frame.sceneId}/${frame.checkpoint} parece un frame vacío`
    );
  }
});
