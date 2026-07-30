#!/usr/bin/env node
/**
 * Render del short ya compilado.
 *
 *   npm run shorts:render -- --slug harness-vs-modelo [...opciones de Remotion]
 *
 * Delega en `remotion-animations/scripts/render-safe.mjs`, que reserva un
 * directorio de ejecucion por render y escribe su manifiesto. Ese script resuelve
 * el CLI de Remotion contra `node_modules` del cwd, asi que se lanza desde
 * `remotion-animations/` y no desde la raiz.
 */
import {spawnSync} from 'node:child_process';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {REMOTION_ROOT, projectDir} from '../src/modules/shorts-studio/constants.js';
import {compositionIdForSlug, discoverShortProjects} from '../src/modules/shorts-studio/registry.js';

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
  console.error('Uso: npm run shorts:render -- --slug <slug> [...opciones de Remotion]');
  process.exit(1);
}

const buildFile = path.join(projectDir(slug), 'short-build.json');
const compiled = await access(buildFile).then(() => true, () => false);
if (!compiled) {
  console.error(
    `No existe ${path.relative(process.cwd(), buildFile)}. ` +
    `Ejecuta primero: npm run shorts:build -- --slug ${slug}`
  );
  process.exit(1);
}

const compositionId = compositionIdForSlug(slug);
const registered = await discoverShortProjects();
if (!registered.some((project) => project.slug === slug)) {
  console.error(
    `El registro de composiciones no lista "${slug}". ` +
    `Ejecuta: npm run shorts:build -- --slug ${slug}`
  );
  process.exit(1);
}

console.log(`Renderizando ${compositionId} (${slug})`);
const result = spawnSync(
  process.execPath,
  [
    path.join('scripts', 'render-safe.mjs'),
    'render',
    `shorts-${slug}`,
    compositionId,
    `${slug}.mp4`,
    ...passthrough
  ],
  {cwd: REMOTION_ROOT, stdio: 'inherit'}
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
