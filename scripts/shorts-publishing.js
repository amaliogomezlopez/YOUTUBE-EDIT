#!/usr/bin/env node
/**
 * Metadata de publicacion del short montado.
 *
 *   npm run shorts:publishing -- --slug harness-vs-modelo [--no-llm] [--out <carpeta>]
 */
import path from 'node:path';
import {OUTPUT_DIR, loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {buildShortPublishing} from '../src/modules/shorts-studio/publishing.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
const slug = args.slug ?? args._[0];

if (!slug || slug === true) {
  console.error('Uso: npm run shorts:publishing -- --slug <slug> [--no-llm] [--out <carpeta>]');
  process.exit(1);
}

// `--out` sin valor deja la metadata junto al MP4 exportado; con valor, donde se pida.
const outputDir = args.out === true
  ? path.join(OUTPUT_DIR, `shorts-${slug}`)
  : (args.out ? String(args.out) : null);

const {payload, files} = await buildShortPublishing({
  slug,
  useLlm: args['no-llm'] !== true,
  outputDir,
  log: (message) => console.log(message)
});

console.log('');
console.log(payload.titles.youtube_shorts.slice(0, 3).map((title, index) => `${index + 1}. ${title.title}`).join('\n'));
console.log('');
console.log(payload.hashtags);
console.log('');
for (const file of files) console.log(`escrito: ${path.relative(process.cwd(), file)}`);
