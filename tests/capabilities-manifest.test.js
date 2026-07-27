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
  assert.ok(actual.compositionIds.length >= 64);
  assert.ok(actual.compositionIds.includes('ALV3A-27-Subagentes'));
  assert.ok(actual.compositionIds.includes('Chart-Annotated-Market'));
  assert.ok(actual.compositionIds.includes('Pattern-Screenshot-Spotlight'));
  assert.ok(actual.compositionIds.includes('Review-Contextual-Pattern'));
  const annotatedChart = actual.patterns.find(
    (pattern) => pattern.id === 'asset.annotated-chart'
  );
  assert.ok(annotatedChart.variants.includes('Chart-Annotated-Documentary'));
  assert.equal(actual.visuals.fallbackPolicy, 'catalog-only-no-freeform-svg');
  assert.equal(actual.version, 2);
  assert.equal(actual.review.frameComments, true);
  assert.equal(actual.review.approvalGate, 'qa-passed');
  assert.equal(
    actual.schemas.renderedVisualQa,
    'schemas/rendered-visual-qa-report.schema.json'
  );
  assert.deepEqual(actual.design.formats, [
    'landscape',
    'vertical',
    'square',
    'portrait'
  ]);
  const ranking = actual.patterns.find((pattern) => pattern.id === 'data.ranking');
  assert.equal(ranking.status, 'ready');
  assert.ok(ranking.supportedFormats.includes('vertical'));
});
