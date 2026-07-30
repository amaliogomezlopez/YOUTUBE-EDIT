#!/usr/bin/env node
/**
 * Ingesta de un proyecto de intro: clips a cámara, assets de apoyo y pista de música.
 *
 *   npm run intro:ingest -- --source "<carpeta de clips>" --slug <slug> --music "<pista>"
 */
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {ingestIntroProject} from '../src/modules/intro-studio/ingest.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));

if (!args.source) {
  console.error(
    'Uso: npm run intro:ingest -- --source "<carpeta de clips>" [--slug <slug>] ' +
    '[--assets "<carpeta de imagenes y videos>"] [--music "<pista.mp3>"] ' +
    '[--no-transcribe] [--retranscribe] [--no-face] [--force]'
  );
  process.exit(1);
}

const manifest = await ingestIntroProject({
  sourceDir: args.source,
  slug: args.slug === true ? null : args.slug,
  assetsDir: args.assets === true ? null : args.assets ?? null,
  musicFile: args.music === true ? null : args.music ?? null,
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
if (manifest.music) {
  console.log(
    `musica: ${manifest.music.sourceName} ${manifest.music.bpm} BPM, ` +
    `${manifest.music.beatSeconds.length} beats desde ${manifest.music.offsetSeconds}s ` +
    `(confianza ${manifest.music.confidence})`
  );
  if (manifest.music.confidence !== null && manifest.music.confidence < 1.5) {
    console.log(
      '  la pista no tiene pulso claro: fija "bpm" y "offsetSeconds" en intro-plan.json ' +
      'si los golpes no encajan.'
    );
  }
} else {
  console.log('musica: ninguna (los cues se anclaran por palabra)');
}
