import path from 'node:path';
import {loadDotEnv, readJson, writeJson} from '../src/lib/utils.js';
import {publishToInstagram} from '../src/lib/publishers/instagram.js';

const JOB_ID = 'job-2026-06-30T10-24-09-767Z-b1a3c414';
const CLIP_ID = 'clip-57c3666f';
const JOB_DIR = path.resolve('data/jobs', JOB_ID);
const OUTPUT_DIR = path.resolve('data/output', JOB_ID);
const RESULTS_FILE = path.join(JOB_DIR, 'instagram-upload-results.json');

const videoFile = path.join(OUTPUT_DIR, CLIP_ID, 'short.mp4');
const caption = [
  'GLM 5.2 ha encendido el debate contra GPT y Claude, pero la pregunta real no es solo cual gana.',
  '',
  'La clave: que modelo echas de menos cuando pruebas GLM?',
  '',
  '#IA #GLM52 #GPT #Claude #InteligenciaArtificial'
].join('\n');

await loadDotEnv();
const state = await readJson(path.join(JOB_DIR, 'job.json'));
const clip = state.clips.find((item) => item.id === CLIP_ID);
if (!clip) throw new Error(`Clip not found in job: ${CLIP_ID}`);

const metadata = {
  summary: {short: caption},
  platform_posts: {
    instagram: {caption}
  }
};

const result = await publishToInstagram({videoFile, metadata});
console.log(JSON.stringify({
  clipId: CLIP_ID,
  status: result.status,
  mediaId: result.mediaId,
  permalink: result.permalink,
  videoUrl: result.videoUrl,
  error: result.error
}, null, 2));

let existing = {results: []};
try {
  existing = await readJson(RESULTS_FILE);
} catch {
  existing = {createdAt: new Date().toISOString(), results: []};
}

await writeJson(RESULTS_FILE, {
  ...existing,
  updatedAt: new Date().toISOString(),
  results: [...(existing.results ?? []), {...result, clipId: CLIP_ID}]
});
