import path from 'node:path';
import {loadDotEnv, readJson, writeJson} from '../src/lib/utils.js';
import {publishToYoutube} from '../src/lib/publishers/youtube.js';

const JOB_ID = 'job-2026-06-30T10-24-09-767Z-b1a3c414';
const JOB_DIR = path.resolve('data/jobs', JOB_ID);
const OUTPUT_DIR = path.resolve('data/output', JOB_ID);

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
  'DeepLearning'
];

function description(lines, extraTags = []) {
  const tags = [...new Set([...commonTags, ...extraTags])].slice(0, 18).map((tag) => `#${tag}`).join(' ');
  return `${lines.join('\n')}\n\n${tags}`;
}

const uploads = [
  {
    clipId: 'clip-57c3666f',
    videoFile: path.join(OUTPUT_DIR, 'clip-57c3666f', 'short.mp4'),
    title: 'GLM 5.2 vs GPT y Claude: la pregunta real',
    privacy: 'public',
    description: description([
      'GLM 5.2 ha encendido el debate contra GPT 5.5 y Claude Opus, pero la clave no es solo cual gana.',
      'La pregunta interesante: que modelos echas de menos cuando pruebas GLM?',
      '',
      'Short extraido y editado con Shortsmith.'
    ], ['ClaudeOpus', 'GPT55'])
  },
  {
    clipId: 'clip-1959a733',
    videoFile: path.join(OUTPUT_DIR, 'clip-1959a733', 'short.mp4'),
    title: 'GLM 5.2 falla? Este test visual lo deja claro',
    privacy: 'private',
    publishAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    description: description([
      'Comparativa visual entre modelos de IA generando un Phoenix: aqui se ve rapido quien entiende mejor el prompt.',
      'GLM 5.2 sorprende, pero tambien muestra limites claros en ciertos detalles.',
      '',
      'Short extraido y editado con Shortsmith.'
    ], ['PromptEngineering', 'Comparativa'])
  }
];

await loadDotEnv();
const state = await readJson(path.join(JOB_DIR, 'job.json'));
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
        privacy: upload.privacy,
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

await writeJson(path.join(JOB_DIR, 'youtube-upload-results.json'), {
  createdAt: new Date().toISOString(),
  results
});
