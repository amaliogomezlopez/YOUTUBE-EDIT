#!/usr/bin/env node
/**
 * Resuelve una paleta de sonidos de shorts contra SONIDOS-REELS.
 *
 *   npm run shorts:sonidos [-- --palette viral-reels] [--folder SONIDOS-REELS]
 *
 * Importa la carpeta (hash de contenido, normalizado), recorta el silencio de los
 * extremos de cada efecto (SH-R-054) y escribe en
 * `src/modules/shorts-studio/sound-palettes/<id>.json` la `palette` por familia y la
 * `metadata` con la duracion real: sin ella el build cortaria cada efecto a la
 * duracion generica de su familia. `families` (nombres de fichero) no se toca.
 */
import path from 'node:path';
import {loadDotEnv, parseCliArgs, readJson, writeJson} from '../src/lib/utils.js';
import {importFolderSounds} from '../src/modules/video-studio/folder-sounds.js';
import {alignFolderSoundEdges} from '../src/modules/video-studio/sound-edges.js';
import {REMOTION_ROOT} from '../src/modules/video-studio/paths.js';
import {SOUND_PALETTES_DIR} from '../src/modules/shorts-studio/sound.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
const id = String(args.palette && args.palette !== true ? args.palette : 'viral-reels');
const folder = path.resolve(String(args.folder && args.folder !== true ? args.folder : 'SONIDOS-REELS'));
const file = path.join(SOUND_PALETTES_DIR, `${id}.json`);
const spec = await readJson(file);
const publicRoot = path.join(REMOTION_ROOT, 'public');

const imported = await importFolderSounds({folder, publicRoot, manifestFile: path.join(publicRoot, 'sfx', 'sonidos-reels-import.json'), log: console.log});
const aligned = await alignFolderSoundEdges(imported, publicRoot);
const byName = new Map(aligned.entries.map((entry) => [path.basename(entry.sourceName), entry]));

const palette = {};
const metadata = {};
const missing = [];
for (const [family, names] of Object.entries(spec.families ?? {})) {
  palette[family] = [];
  for (const name of names) {
    const entry = byName.get(name);
    if (!entry) { missing.push(`${family}: ${name}`); continue; }
    palette[family].push(entry.file);
    metadata[entry.file] = {durationSeconds: Number(entry.durationSeconds.toFixed(3)), source: name};
  }
  if (!palette[family].length) delete palette[family];
}
await writeJson(file, {...spec, palette, metadata, resolvedAt: new Date().toISOString()});
console.log(`paleta ${id}: ${Object.keys(palette).length} familias, ${Object.keys(metadata).length} ficheros`);
for (const line of missing) console.log(`  falta en ${path.basename(folder)}: ${line}`);
for (const error of aligned.errors ?? imported.errors ?? []) console.log(`  error: ${error}`);
if (missing.length) process.exitCode = 2;
