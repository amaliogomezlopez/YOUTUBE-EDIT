import path from 'node:path';
import {loadDotEnv, readJson, writeJson} from '../src/lib/utils.js';
import {publishToInstagram} from '../src/lib/publishers/instagram.js';

const JOB_ID = 'job-2026-06-30T10-24-09-767Z-b1a3c414';
const JOB_DIR = path.resolve('data/jobs', JOB_ID);
const OUTPUT_DIR = path.resolve('data/output', JOB_ID);
const RESULTS_FILE = path.join(JOB_DIR, 'instagram-upload-results.json');

const captions = {
  'clip-57c3666f': [
    'GLM 5.2 ha encendido el debate contra GPT y Claude, pero la pregunta real no es solo cual gana.',
    '',
    'La clave: que modelo echas de menos cuando pruebas GLM?',
    '',
    '#IA #GLM52 #GPT #Claude #InteligenciaArtificial'
  ].join('\n'),
  'clip-1959a733': [
    'GLM 5.2 sorprende, pero este test visual muestra rapido donde acierta y donde se queda corto.',
    '',
    'Cuando comparas modelos, los detalles importan.',
    '',
    '#IA #GLM52 #PromptEngineering #ModelosIA #Tecnologia'
  ].join('\n'),
  'clip-4dd2d37e': [
    'GLM 5.2 no solo compite por calidad: el precio cambia completamente la decision.',
    '',
    'Mi veredicto sobre cuando merece la pena cambiar de modelo.',
    '',
    '#IA #GLM52 #Claude #GPT #AICoding'
  ].join('\n'),
  'clip-227a15f9': [
    'Con GLM 5.2 puedes ahorrar dinero, limites y tokens si lo combinas bien con GPT o Claude.',
    '',
    'Construir barato, revisar con criterio: esa es la jugada.',
    '',
    '#IA #GLM52 #ProductividadIA #GPT #Claude'
  ].join('\n')
};

const clipId = process.argv[2];
if (!clipId || !captions[clipId]) {
  throw new Error(`Uso: node scripts/publish-instagram-clip.js <clipId>. Clips: ${Object.keys(captions).join(', ')}`);
}

await loadDotEnv();

let existing = {results: []};
try {
  existing = await readJson(RESULTS_FILE);
} catch {
  existing = {createdAt: new Date().toISOString(), results: []};
}

const already = (existing.results ?? []).find((result) => (
  result.clipId === clipId && result.status === 'published'
));
if (already) {
  console.log(JSON.stringify({
    clipId,
    status: 'skipped',
    reason: 'already_published',
    permalink: already.permalink,
    mediaId: already.mediaId
  }, null, 2));
  process.exit(0);
}

const state = await readJson(path.join(JOB_DIR, 'job.json'));
const clip = state.clips.find((item) => item.id === clipId);
if (!clip) throw new Error(`Clip not found in job: ${clipId}`);

const videoFile = path.join(OUTPUT_DIR, clipId, 'short.mp4');
const metadata = {
  summary: {short: captions[clipId]},
  platform_posts: {
    instagram: {caption: captions[clipId]}
  }
};

const result = await publishToInstagram({videoFile, metadata});
console.log(JSON.stringify({
  clipId,
  status: result.status,
  mediaId: result.mediaId,
  permalink: result.permalink,
  videoUrl: result.videoUrl,
  error: result.error
}, null, 2));

await writeJson(RESULTS_FILE, {
  ...existing,
  updatedAt: new Date().toISOString(),
  results: [...(existing.results ?? []), {...result, clipId}]
});
