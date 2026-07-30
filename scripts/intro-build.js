#!/usr/bin/env node
/**
 * Compila `intro-plan.json` a `intro-build.json` y ejecuta las reglas de montaje.
 *
 *   npm run intro:build -- --slug <slug>
 */
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {buildIntro} from '../src/modules/intro-studio/build.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));

if (!args.slug || args.slug === true) {
  console.error('Uso: npm run intro:build -- --slug <slug>');
  process.exit(1);
}

const build = await buildIntro({slug: args.slug, log: (message) => console.log(message)});

console.log('');
for (const scene of build.scenes) {
  const seconds = (scene.durationInFrames / build.format.fps).toFixed(2);
  console.log(
    `${scene.id.padEnd(14)} clip=${scene.clipId} ${scene.layout.padEnd(10)} ${seconds}s ` +
    `cues=${scene.cues.length} efectos=${scene.effects.length}` +
    `${scene.faceRect ? '' : ' (sin cara detectada)'}`
  );
}
console.log('');
if (build.music) {
  console.log(`musica: ${build.music.bpm} BPM, ${build.music.beatSeconds.length} beats`);
}
console.log(`total: ${build.durationSeconds}s (${build.durationInFrames} frames @ ${build.format.fps}fps)`);
