import path from 'node:path';
import {loadDotEnv, readJson, writeJson} from '../src/lib/utils.js';
import {publishToYoutube} from '../src/lib/publishers/youtube.js';

const JOB_ID = 'job-2026-06-30T10-24-09-767Z-b1a3c414';
const JOB_DIR = path.resolve('data/jobs', JOB_ID);
const OUTPUT_DIR = path.resolve('data/output', JOB_ID);
const RESULTS_FILE = path.join(JOB_DIR, 'youtube-upload-results.json');

const commonTags = [
  'Shorts',
  'IA',
  'InteligenciaArtificial',
  'GLM52',
  'GLM',
  'GPT',
  'Claude',
  'ClaudeOpus',
  'AICoding',
  'ModelosIA',
  'Programacion',
  'Tecnologia',
  'ComparativaIA',
  'PromptEngineering'
];

function description(lines, extraTags = []) {
  const tags = [...new Set([...commonTags, ...extraTags])].slice(0, 18).map((tag) => `#${tag}`).join(' ');
  return `${lines.join('\n')}\n\n${tags}`;
}

function lastScheduledAt(existing) {
  const timestamps = (existing.results ?? [])
    .map((result) => result.publishAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime())
    .filter(Number.isFinite);
  return timestamps.length ? Math.max(...timestamps) : Date.now();
}

await loadDotEnv();
const state = await readJson(path.join(JOB_DIR, 'job.json'));
const existing = await readJson(RESULTS_FILE);
const base = lastScheduledAt(existing);

const uploads = [
  {
    clipId: 'clip-4dd2d37e',
    videoFile: path.join(OUTPUT_DIR, 'clip-4dd2d37e', 'short.mp4'),
    title: 'GLM 5.2 gana por precio? Mi veredicto claro',
    publishAt: new Date(base + 2 * 60 * 60 * 1000).toISOString(),
    description: description([
      'GLM 5.2 no solo compite por calidad: el precio cambia completamente la comparativa contra GPT y Claude.',
      'Una opinion directa sobre cuando merece la pena cambiar de modelo.',
      '',
      'Short extraido y editado con Shortsmith.'
    ], ['PrecioIA', 'ClaudeVsGPT'])
  },
  {
    clipId: 'clip-227a15f9',
    videoFile: path.join(OUTPUT_DIR, 'clip-227a15f9', 'short.mp4'),
    title: 'Por que ya no echo de menos GPT ni Claude',
    publishAt: new Date(base + 4 * 60 * 60 * 1000).toISOString(),
    description: description([
      'GLM 5.2 puede cubrir casi todo el flujo y ahorrar dinero, limites y tokens.',
      'La combinacion inteligente: usar un modelo barato para construir y otro para revisar criticamente.',
      '',
      'Short extraido y editado con Shortsmith.'
    ], ['AhorroIA', 'ProductividadIA'])
  }
];

const results = [];
for (const upload of uploads) {
  const clip = state.clips.find((item) => item.id === upload.clipId);
  if (!clip) throw new Error(`Clip not found in job: ${upload.clipId}`);
  const metadata = {
    summary: {short: upload.description},
    titles: {youtube_shorts: [{title: upload.title}]},
    platform_posts: {
      youtube_shorts: {
        title: upload.title,
        description: upload.description,
        tags: commonTags,
        privacy: 'private',
        publishAt: upload.publishAt
      }
    }
  };
  const result = await publishToYoutube({videoFile: upload.videoFile, metadata, clip});
  results.push({...result, clipId: upload.clipId});
  console.log(JSON.stringify({
    clipId: upload.clipId,
    status: result.status,
    title: result.title,
    url: result.url,
    privacyStatus: result.privacyStatus,
    publishAt: result.publishAt,
    error: result.error
  }, null, 2));
}

await writeJson(RESULTS_FILE, {
  ...existing,
  updatedAt: new Date().toISOString(),
  results: [...(existing.results ?? []), ...results]
});
