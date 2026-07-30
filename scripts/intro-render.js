#!/usr/bin/env node
/**
 * Render de la intro ya compilada.
 *
 *   npm run intro:render -- --slug <slug> [...opciones de Remotion]
 *
 * Delega en `remotion-animations/scripts/render-safe.mjs`, que reserva un directorio
 * de ejecución por render y escribe su manifiesto. El MP4 sale a
 * `remotion-animations/out/intro-<slug>/runs/` listo para colocarlo al principio del
 * vídeo largo en el editor: la intro no se publica sola, así que aquí no hay etapa de
 * metadata ni de publicación.
 */
import {spawnSync} from 'node:child_process';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {REMOTION_ROOT, projectDir} from '../src/modules/intro-studio/constants.js';
import {compositionIdForSlug, discoverIntroProjects} from '../src/modules/intro-studio/registry.js';

const argv = process.argv.slice(2);
const slugIndex = argv.findIndex((token) => token === '--slug');
const slug = slugIndex >= 0 ? argv[slugIndex + 1] : argv.find((token) => !token.startsWith('--'));
// Todo lo que no sea `--slug <slug>` viaja tal cual a Remotion (--frames, --scale...).
const passthrough = argv.filter((token, index) => (
  slugIndex >= 0
    ? index !== slugIndex && index !== slugIndex + 1
    : token !== slug
));

if (!slug) {
  console.error('Uso: npm run intro:render -- --slug <slug> [...opciones de Remotion]');
  process.exit(1);
}

const buildFile = path.join(projectDir(slug), 'intro-build.json');
const compiled = await access(buildFile).then(() => true, () => false);
if (!compiled) {
  console.error(
    `No existe ${path.relative(process.cwd(), buildFile)}. ` +
    `Ejecuta primero: npm run intro:build -- --slug ${slug}`
  );
  process.exit(1);
}

const compositionId = compositionIdForSlug(slug);
const registered = await discoverIntroProjects();
if (!registered.some((project) => project.slug === slug)) {
  console.error(
    `El registro de composiciones no lista "${slug}". ` +
    `Ejecuta: npm run intro:build -- --slug ${slug}`
  );
  process.exit(1);
}

console.log(`Renderizando ${compositionId} (${slug})`);
const result = spawnSync(
  process.execPath,
  [
    path.join('scripts', 'render-safe.mjs'),
    'render',
    `intro-${slug}`,
    compositionId,
    `${slug}.mp4`,
    ...passthrough
  ],
  {cwd: REMOTION_ROOT, stdio: 'inherit'}
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
