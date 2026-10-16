import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {DEFAULT_SOUND_PALETTE, resolvePlanSoundPalette} from '../src/modules/shorts-studio/sound.js';
import {resolveCaptionStyle} from '../src/lib/captions/presets.js';

test('an explicit plan palette wins over the default one', () => {
  const palette = {whoosh: ['sfx/a.wav']};
  const resolved = resolvePlanSoundPalette({palette, metadata: {'sfx/a.wav': {durationSeconds: 0.4}}});
  assert.equal(resolved.palette, palette);
  assert.equal(resolved.paletteId, null);
});

test('paletteId none falls back to the generic library', () => {
  const resolved = resolvePlanSoundPalette({paletteId: 'none'});
  assert.equal(resolved.palette, undefined);
});

test('an unresolved default palette warns and falls back instead of failing', async () => {
  const empty = await mkdtemp(path.join(os.tmpdir(), 'shorts-palette-'));
  try {
    const warnings = [];
    const resolved = resolvePlanSoundPalette({}, {publicRoot: empty, warnings});
    assert.equal(resolved.palette, undefined);
    assert.match(warnings[0], new RegExp(DEFAULT_SOUND_PALETTE));
    assert.match(warnings[0], /shorts:sonidos/);
  } finally {
    await rm(empty, {recursive: true, force: true});
  }
});

test('an unknown palette id is an error, not a silent fallback', () => {
  assert.throws(() => resolvePlanSoundPalette({paletteId: 'no-existe'}), /No existe la paleta/);
});

test('the yellow karaoke preset keeps the approved shape and accepts rotating colors', () => {
  const style = resolveCaptionStyle({preset: 'talking-head-yellow'});
  assert.equal(style.activeColor, '#FFD60A');
  assert.equal(style.primary, '#FFFFFF');
  assert.equal(style.maxWords, 3);
  assert.equal(style.activeColors, undefined);
  const rotating = resolveCaptionStyle({preset: 'talking-head-yellow', activeColors: ['#43f56c', 'bad', '#FFD60A']});
  assert.deepEqual(rotating.activeColors, ['#43F56C', '#FFD60A']);
});
