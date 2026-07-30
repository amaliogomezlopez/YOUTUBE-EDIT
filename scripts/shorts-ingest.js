#!/usr/bin/env node
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {ingestShortProject} from '../src/modules/shorts-studio/ingest.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));

if (!args.source) {
  console.error(
    'Uso: npm run shorts:ingest -- --source "<carpeta de clips>" [--slug <slug>] ' +
    '[--assets "<carpeta de imagenes>"] [--no-transcribe] [--retranscribe] [--no-face] [--force]'
  );
  process.exit(1);
}

const manifest = await ingestShortProject({
  sourceDir: args.source,
  slug: args.slug === true ? null : args.slug,
  assetsDir: args.assets === true ? null : args.assets ?? null,
  transcribe: args.transcribe !== false && args['no-transcribe'] !== true,
  reuseTranscripts: args.retranscribe !== true,
  faceTracking: args.face !== false && args['no-face'] !== true,
  force: args.force === true,
  log: (message) => console.log(message)
});

console.log('');
console.log(`proyecto: ${manifest.slug}`);
console.log(`clips: ${manifest.clips.length} (${manifest.totalClipSeconds}s)`);
console.log(`assets: ${manifest.assets.length}`);
for (const clip of manifest.clips) {
  console.log(
    `  ${clip.id} ${clip.durationSeconds}s ${clip.width}x${clip.height}@${clip.fps} ` +
    `focus=${clip.focus.x},${clip.focus.y} cara=${clip.faceConfidence} palabras=${clip.wordCount}`
  );
}
