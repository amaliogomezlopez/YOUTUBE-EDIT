#!/usr/bin/env node
/**
 * Recursos de un short (b-roll oficial, tuits, capturas, imagenes) con procedencia.
 *
 *   npm run shorts:assets -- --requests asset-requests.json --out "<carpeta ASSETS>" [--force] [--slug <slug>]
 *
 * Con `--slug`, ademas importa todo lo que haya en la carpeta al manifest de un
 * proyecto ya existente (p. ej. el `short-<job>-<clip>` de un corte de video largo,
 * que no tiene carpeta de clips que reingerir); los ids repetidos se sustituyen.
 *
 * Reutiliza el contrato `asset-requests.json` de la apertura viral
 * (src/modules/intro-viral/assets.js): kinds `youtube` (tramo start/duration),
 * `x`, `web`, `image` y `local`. Cada recurso queda como `<id>.<ext>` con su
 * `.provenance.json`; despues `shorts:ingest --assets <carpeta>` lo importa con ese id.
 * Una pagina protegida (Cloudflare, 403) no se salta: queda en pendientes para
 * capturarla a mano. Descargar exige el permiso explicito del usuario por fichero.
 */
import path from 'node:path';
import {loadDotEnv, parseCliArgs, readJson, writeJson} from '../src/lib/utils.js';
import {resolveAssetRequests, validateAssetRequests} from '../src/modules/intro-viral/assets.js';
import {importAssetFiles, listAssetFiles} from '../src/modules/video-studio/media-ingest.js';
import {surfacePaths} from '../src/modules/video-studio/paths.js';
import {SHORT_SURFACE} from '../src/modules/shorts-studio/constants.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
if (!args.requests || args.requests === true || !args.out || args.out === true) {
  console.error('Uso: npm run shorts:assets -- --requests <asset-requests.json> --out <carpeta ASSETS> [--force]');
  process.exit(1);
}

const requests = await readJson(path.resolve(String(args.requests)));
const errors = validateAssetRequests(requests);
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const assetsDir = path.resolve(String(args.out));
const result = await resolveAssetRequests(requests, {
  assetsDir,
  rawDir: path.join(assetsDir, '..', '_fuentes'),
  force: Boolean(args.force),
  log: console.log
});
console.log(`\nresueltos: ${result.resolved.length}, ya presentes: ${result.skipped.length}, pendientes: ${result.failed.length}`);
for (const item of result.failed) console.log(`  pendiente ${item.id}: ${item.reason}`);

if (args.slug && args.slug !== true) {
  const slug = String(args.slug);
  const paths = surfacePaths(SHORT_SURFACE);
  const manifestFile = path.join(paths.projectDir(slug), 'manifest.json');
  const manifest = await readJson(manifestFile);
  const imported = await importAssetFiles({
    assetsDir, names: await listAssetFiles(assetsDir), media: paths.mediaDir(slug), paths, projectSlug: slug
  });
  const ids = new Set(imported.map((asset) => asset.id));
  manifest.assets = [...(manifest.assets ?? []).filter((asset) => !ids.has(asset.id)), ...imported];
  await writeJson(manifestFile, manifest);
  console.log(`importados al proyecto ${slug}: ${imported.length} (${[...ids].join(', ')})`);
}
process.exitCode = result.failed.length ? 2 : 0;
