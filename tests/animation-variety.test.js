import assert from 'node:assert/strict';
import test from 'node:test';
import {
  chooseArtDirection,
  planAnimationVariety
} from '../src/lib/animation-variety.js';

test('evita repetir la misma dirección artística en piezas consecutivas', () => {
  const result = chooseArtDirection({
    preferred: 'market-data',
    candidates: ['market-data', 'editorial-report', 'documentary-evidence'],
    recentSelections: [
      {artDirection: 'market-data'},
      {artDirection: 'documentary-evidence'}
    ]
  });
  assert.equal(result.selected, 'editorial-report');
});

test('documenta las repeticiones de efectos que son necesarias', () => {
  const result = planAnimationVariety({
    patternId: 'asset.annotated-chart',
    preferredArtDirection: 'market-data',
    artDirectionCandidates: ['market-data', 'editorial-report'],
    effectIds: ['reveal.path-draw', 'camera.focus-zoom'],
    recentSelections: [
      {artDirection: 'market-data', effectIds: ['camera.focus-zoom']}
    ]
  });
  assert.deepEqual(result.repeatedEffects, ['camera.focus-zoom']);
  assert.equal(result.selected.artDirection, 'editorial-report');
});
