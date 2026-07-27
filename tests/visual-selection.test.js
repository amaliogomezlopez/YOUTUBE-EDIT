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
});

test('genera solo recetas de fallback con iconos auditados', async () => {
  const result = await selectVisualAsset('ornitorrinco cuántico', {
    kind: 'any',
    allowFallback: true
  });
  assert.equal(result.mode, 'controlled-fallback');
  assert.equal(result.fallback.generationPolicy, 'catalog-only-no-freeform-svg');
  assert.deepEqual(result.fallback.iconIds, ['unknown']);
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
