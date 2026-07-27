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

test('contrasta tema, ritmo, geometría, metáfora y cámara en seis piezas', () => {
  const result = planAnimationVariety({
    patternId: 'data.ranking',
    preferredArtDirection: 'diagrammatic-system',
    artDirectionCandidates: ['diagrammatic-system', 'editorial-report'],
    preferredTheme: 'ink-lime',
    themeCandidates: ['ink-lime', 'signal-cobalt'],
    preferredMotionProfile: 'editorial',
    motionProfileCandidates: ['editorial', 'technical'],
    preferredGeometry: 'rows',
    geometryCandidates: ['rows', 'radial'],
    preferredMetaphor: 'podium',
    metaphorCandidates: ['podium', 'race'],
    preferredCamera: 'static',
    cameraCandidates: ['static', 'focus'],
    recentSelections: Array.from({length: 6}, () => ({
      artDirection: 'diagrammatic-system',
      themeId: 'ink-lime',
      motionProfile: 'editorial',
      geometry: 'rows',
      metaphor: 'podium',
      camera: 'static'
    }))
  });
  assert.equal(result.historyWindow, 6);
  assert.equal(result.selected.themeId, 'signal-cobalt');
  assert.equal(result.selected.motionProfile, 'technical');
  assert.equal(result.selected.geometry, 'radial');
  assert.equal(result.selected.metaphor, 'race');
  assert.equal(result.selected.camera, 'focus');
});
