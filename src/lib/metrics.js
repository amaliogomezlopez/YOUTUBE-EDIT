import path from 'node:path';
import {readJson, writeJson} from './utils.js';

const PLATFORMS = new Set(['youtube', 'instagram', 'tiktok', 'x']);
const FIELDS = ['views', 'likes', 'comments', 'shares', 'saves', 'watchTimeSeconds', 'averageWatchSeconds', 'followersGained'];

export async function loadMetrics(state) {
  try {
    return await readJson(path.join(state.jobDir, 'metrics.json'));
  } catch {
    return [];
  }
}

export async function recordMetrics(state, input = {}) {
  const platform = String(input.platform || '').toLowerCase();
  if (!PLATFORMS.has(platform)) throw new Error('Plataforma de métricas no válida.');
  const clip = (state.clips ?? []).find((item) => item.id === input.clipId);
  if (!clip) throw new Error('Clip no encontrado para registrar métricas.');
  const values = {};
  for (const field of FIELDS) {
    const value = Number(input[field] ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new Error(`La métrica ${field} debe ser un número no negativo.`);
    values[field] = value;
  }
  for (const field of ['stayedToWatchPercent','averagePercentageViewed','retentionAt3Seconds','retentionAt10Seconds']) {
    if (input[field] === undefined || input[field] === null || input[field] === '') { values[field] = null; continue; }
    const value=Number(input[field]);
    if (!Number.isFinite(value) || value<0 || (field!=='averagePercentageViewed' && value>100)) throw new Error('Porcentaje de retencion invalido: '+field);
    values[field]=value;
  }
  const views = values.views;
  const snapshot = {
    id: `${clip.id}:${platform}`,
    clipId: clip.id,
    platform,
    source: input.source === 'official_api' ? 'official_api' : 'manual',
    recordedAt: new Date().toISOString(),
    editingProfile: clip.editing?.profile ?? null,
    renderVersion: clip.renderedAt ?? clip.files?.video ?? null,
    ...values,
    engagementRate: views ? Math.round(((values.likes + values.comments + values.shares + values.saves) / views) * 10000) / 100 : 0,
    averageCompletionRate: views && clip.duration ? Math.round((values.averageWatchSeconds / clip.duration) * 10000) / 100 : 0
  };
  const current = await loadMetrics(state);
  const next = [...current.filter((item) => item.id !== snapshot.id), snapshot];
  const history=await readJson(path.join(state.jobDir,'metrics-history.json')).catch(()=>[]);
  await writeJson(path.join(state.jobDir,'metrics-history.json'), [...history,snapshot]);
  await writeJson(path.join(state.jobDir, 'metrics.json'), next);
  state.metrics = next;
  return snapshot;
}
