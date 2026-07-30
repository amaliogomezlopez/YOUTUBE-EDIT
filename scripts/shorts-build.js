#!/usr/bin/env node
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {buildShort} from '../src/modules/shorts-studio/build.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
const slug = args.slug ?? args._[0];

if (!slug || slug === true) {
  console.error('Uso: npm run shorts:build -- --slug <slug>');
  process.exit(1);
}

const build = await buildShort({slug, log: (message) => console.log(message)});
console.log('');
for (const scene of build.scenes) {
  console.log(
    `${scene.id.padEnd(14)} clip=${scene.clipId} ${scene.layout.padEnd(6)} ` +
    `${(scene.durationInFrames / build.format.fps).toFixed(2)}s ` +
    `cues=${scene.cues.length} paginas=${scene.captionPages.length}`
  );
}
console.log('');
console.log(`total: ${build.durationSeconds}s (${build.durationInFrames} frames @ ${build.format.fps}fps)`);
