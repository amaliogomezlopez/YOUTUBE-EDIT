#!/usr/bin/env node
/**
 * Publicacion de un short montado.
 *
 *   npm run shorts:publish -- --slug harness-vs-modelo [--platforms youtube,instagram] [--video ruta.mp4]
 *
 * Consume `publishing-metadata.json` (lo escribe `shorts:publishing`) y el ultimo
 * MP4 renderizado, y delega en los conectores de `src/lib/publishers/`. Lo que no
 * se pueda publicar automaticamente queda en `requires_manual_action` con el
 * caption y el asset exportados en `publish-runs.json`.
 */
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {publishShort} from '../src/modules/shorts-studio/publish.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
const slug = args.slug ?? args._[0];

if (!slug || slug === true) {
  console.error('Uso: npm run shorts:publish -- --slug <slug> [--platforms youtube,instagram,tiktok,x] [--video <ruta.mp4>]');
  process.exit(1);
}

const platforms = args.platforms
  ? String(args.platforms).split(',').map((item) => item.trim()).filter(Boolean)
  : undefined;

const run = await publishShort({
  slug,
  videoFile: args.video ? String(args.video) : null,
  platforms
});

console.log('');
for (const [platform, result] of Object.entries(run.platforms ?? {})) {
  const detail = result.error ?? result.url ?? result.permalink ?? result.message ?? '';
  console.log(`${platform}: ${result.status}${detail ? ` — ${detail}` : ''}`);
}
console.log('');
console.log(`estado: ${run.status}`);
if (run.status !== 'published') {
  console.log('Detalle por plataforma y assets exportados: publish-runs.json en el proyecto del short.');
}
