import assert from 'node:assert/strict';
import test from 'node:test';
import {
  contrastRatio,
  evaluateRemotionProps
} from '../src/lib/remotion-visual-qa.js';
import {buildManagedAssetRecord} from '../src/lib/remotion-assets.js';

test('QA permite una composición concisa y bloquea títulos desbordados', () => {
  const base = {
    format: 'vertical',
    themeId: 'ink-lime',
    title: 'Una idea clara',
    supportingText: '',
    showHeader: true,
    items: [{label: 'A'}, {label: 'B'}],
    soundEnabled: false
  };
  const valid = evaluateRemotionProps(base);
  assert.equal(valid.passed, true);
  assert.ok(valid.score >= 80);

  const invalid = evaluateRemotionProps({
    ...base,
    title: 'x'.repeat(120)
  });
  assert.equal(invalid.passed, false);
  assert.ok(invalid.issues.some((issue) => issue.code === 'TITLE_OVERFLOW_RISK'));
});

test('las combinaciones tipográficas registradas superan contraste AA', () => {
  assert.ok(contrastRatio('#F2F7F3', '#07110F') >= 4.5);
  assert.ok(contrastRatio('#171713', '#F1EEE6') >= 4.5);
});

test('el registro de asset conserva procedencia, tratamiento y punto focal', () => {
  const record = buildManagedAssetRecord({
    id: 'captura-demo',
    publicPath: 'assets/library/screenshots/captura-demo.png',
    alt: 'Captura de una interfaz',
    width: 1600,
    height: 900,
    sha256: 'a'.repeat(64),
    sourceSha256: 'b'.repeat(64),
    source: 'Shortsmith',
    license: 'project-owned',
    tags: ['captura', 'interfaz'],
    focalPoint: {x: 61, y: 44},
    assetType: 'screenshot',
    treatment: 'natural'
  });
  assert.equal(record.assetType, 'screenshot');
  assert.deepEqual(record.focalPoint, {x: 61, y: 44});
  assert.equal(record.sourceSha256, 'b'.repeat(64));
});
