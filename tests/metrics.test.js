import assert from 'node:assert/strict';
import {mkdtemp, rm, readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {loadMetrics, recordMetrics} from '../src/lib/metrics.js';

test('metrics are validated, derived and replaced per clip/platform', async () => {
  const jobDir = await mkdtemp(path.join(os.tmpdir(), 'shortsmith-metrics-'));
  const state = {jobDir, clips: [{id: 'clip-1', duration: 20}]};
  try {
    const first = await recordMetrics(state, {clipId: 'clip-1', platform: 'youtube', views: 100, likes: 10, comments: 2, shares: 3, averageWatchSeconds: 15});
    assert.equal(first.engagementRate, 15);
    assert.equal(first.averageCompletionRate, 75);
    await recordMetrics(state, {clipId: 'clip-1', platform: 'youtube', views: 200, likes: 20});
    const rows = await loadMetrics(state);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].views, 200);
    await assert.rejects(recordMetrics(state, {clipId: 'clip-1', platform: 'youtube', views: -1}), /no negativo/);
  } finally {
    await rm(jobDir, {recursive: true, force: true});
  }
});

test('retencion conserva ausencias, permite repeticion y guarda el historial por render', async () => {
  const jobDir=await mkdtemp(path.join(os.tmpdir(),'shortsmith-retention-'));
  const state={jobDir,clips:[{id:'clip-1',duration:20,editing:{profile:'sobrio'},renderedAt:'v1'}]};
  try {
    const first=await recordMetrics(state,{clipId:'clip-1',platform:'youtube',stayedToWatchPercent:80,averagePercentageViewed:125});
    assert.equal(first.retentionAt3Seconds,null);
    assert.equal(first.averagePercentageViewed,125);
    state.clips[0].renderedAt='v2';
    await recordMetrics(state,{clipId:'clip-1',platform:'youtube',retentionAt3Seconds:92});
    const history=JSON.parse(await readFile(path.join(jobDir,'metrics-history.json'),'utf8'));
    assert.deepEqual(history.map(m=>m.renderVersion),['v1','v2']);
    assert.equal(history[0].editingProfile,'sobrio');
    await assert.rejects(recordMetrics(state,{clipId:'clip-1',platform:'youtube',retentionAt10Seconds:101}),/retencion/);
    assert.equal((await loadMetrics(state)).length,1);
  } finally { await rm(jobDir,{recursive:true,force:true}); }
});
