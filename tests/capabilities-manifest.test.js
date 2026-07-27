import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  buildCapabilitiesManifest
} from '../remotion-animations/scripts/lib/capabilities-manifest.mjs';

const REMOTION_ROOT = path.resolve(import.meta.dirname, '..', 'remotion-animations');

test('el manifest generado coincide con catálogos y composiciones reales', async () => {
  const expected = buildCapabilitiesManifest(REMOTION_ROOT);
  const actual = JSON.parse(
    await readFile(
      path.join(REMOTION_ROOT, 'catalog', 'capabilities.manifest.json'),
      'utf8'
    )
  );
  assert.deepEqual(actual, expected);
  assert.equal(actual.compositionIds.length, 54);
  assert.ok(actual.compositionIds.includes('ALV3A-27-Subagentes'));
  assert.ok(actual.compositionIds.includes('Chart-Annotated-Market'));
  const annotatedChart = actual.patterns.find(
    (pattern) => pattern.id === 'asset.annotated-chart'
  );
  assert.ok(annotatedChart.variants.includes('Chart-Annotated-Documentary'));
  assert.equal(actual.visuals.fallbackPolicy, 'catalog-only-no-freeform-svg');
});
