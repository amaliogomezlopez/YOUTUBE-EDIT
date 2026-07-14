import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
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
