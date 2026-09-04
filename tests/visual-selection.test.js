import assert from 'node:assert/strict';
import test from 'node:test';
import {selectVisualAsset} from '../src/lib/visual-selection.js';

test('selecciona iconos por significado y no por orden de catálogo', async () => {
  const result = await selectVisualAsset('memoria de preferencias', {
    kind: 'icon'
  });
  assert.equal(result.mode, 'deterministic-catalog');
  assert.equal(result.selected.id, 'memory');
});

test('prefiere un dibujo cuando la consulta describe una relación', async () => {
  const result = await selectVisualAsset('ramificar subagentes y consolidar', {
    kind: 'drawing'
  });
  assert.equal(result.selected.id, 'branch-merge');
  assert.ok(result.semanticSignals.concepts.includes('branch-consolidate'));
  assert.equal(result.preferenceProfile, 'amaliometria-default');
});

test('elige dibujos de finanzas por el ciclo de crédito', async () => {
  const result = await selectVisualAsset('el banco endurece el crédito al hogar', {
    kind: 'drawing'
  });
  assert.equal(result.selected.id, 'credit-cycle');
  assert.ok(result.semanticSignals.concepts.includes('credit-cycle'));
});

test('genera solo recetas de fallback con iconos auditados', async () => {
  const result = await selectVisualAsset('ornitorrinco cuántico', {
    kind: 'any',
    allowFallback: true
  });
  assert.equal(result.mode, 'controlled-fallback');
  assert.equal(result.fallback.generationPolicy, 'catalog-only-no-freeform-svg');
  assert.deepEqual(result.fallback.iconIds, ['unknown']);
  assert.equal(result.fallback.recipe.editable, true);
});

test('las preferencias auditables pueden penalizar un asset concreto', async () => {
  const result = await selectVisualAsset('memoria', {
    kind: 'icon',
    preferenceProfile: {
      id: 'test-profile',
      rejectedAssetIds: ['memory'],
      acceptedAssetIds: ['context']
    }
  });
  assert.equal(result.selected.id, 'context');
  assert.ok(result.alternatives.find((item) => item.id === 'memory').matches.includes('preference:rejected-asset'));
});

test('rechaza IDs inventados por el selector LLM', async () => {
  await assert.rejects(
    () => selectVisualAsset('servidor', {
      useLlm: true,
      llmConfig: {
        provider: 'openai-compatible',
        baseUrl: 'https://example.invalid/v1',
        apiKey: 'test',
        model: 'test'
      },
      chatJsonImpl: async () => ({
        kind: 'icon',
        id: 'icono-inventado'
      })
    }),
    /fuera del catálogo/
  );
});
