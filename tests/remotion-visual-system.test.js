import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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

// ---------------------------------------------------------------------------
// ANM-E01 — El puente catálogo → render no puede desincronizarse. `remotion:check`
// lo comprueba al cargar el bundle; esto lo comprueba sin navegador, para que
// `npm test` cace la deriva antes.
// ---------------------------------------------------------------------------

const readCatalog = async (name) =>
  JSON.parse(
    await readFile(
      new URL(`../remotion-animations/catalog/animations/${name}`, import.meta.url),
      'utf8'
    )
  );

test('cada composición enrutada implementa un patrón `ready` del catálogo', async () => {
  const [patterns, routes] = await Promise.all([
    readCatalog('patterns.json'),
    readCatalog('pattern-routes.json')
  ]);
  const readyCompositions = new Set(
    patterns.patterns
      .filter((pattern) => pattern.status === 'ready' && pattern.implementation?.compositionId)
      .map((pattern) => pattern.implementation.compositionId)
  );
  for (const compositionId of routes.routed) {
    assert.ok(
      readyCompositions.has(compositionId),
      `${compositionId} está enrutado y ningún patrón ready lo implementa`
    );
  }
});

test('un patrón `ready` sin adaptador tiene que declarar el motivo', async () => {
  const [patterns, routes] = await Promise.all([
    readCatalog('patterns.json'),
    readCatalog('pattern-routes.json')
  ]);
  const routed = new Set(routes.routed);
  const excused = new Map(
    routes.unrouted.map((entry) => [entry.compositionId, entry.reason])
  );
  for (const pattern of patterns.patterns) {
    const compositionId = pattern.implementation?.compositionId;
    if (pattern.status !== 'ready' || !compositionId) continue;
    if (routed.has(compositionId)) continue;
    // Una laguna silenciosa es peor que una declarada: sin motivo escrito nadie
    // sabe si falta trabajo o si el patrón no puede alimentarse.
    assert.ok(
      excused.get(compositionId),
      `${compositionId} no está enrutado ni tiene motivo en unrouted`
    );
  }
});

test('cada composición enrutada declara su geometría dominante', async () => {
  const routes = await readCatalog('pattern-routes.json');
  for (const compositionId of routes.routed) {
    assert.ok(
      routes.geometryByComposition[compositionId],
      `${compositionId} no declara geometría: FC-R-020 mediría «unknown»`
    );
  }
});

test('ningún kind del camino heredado se queda sin motivo', async () => {
  const routes = await readCatalog('pattern-routes.json');
  for (const entry of routes.kindFallback) {
    assert.ok(entry.kind, 'una entrada de kindFallback sin kind');
    assert.ok(
      entry.reason && entry.reason.length > 20,
      `${entry.kind} sigue en el camino heredado sin motivo escrito`
    );
  }
});
