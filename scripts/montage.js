#!/usr/bin/env node
/**
 * Montaje viral con voz en off (superficie `montage-studio`).
 *
 *   npm run montage -- ingest --slug <slug> --voiceover <audio> --assets <carpeta>
 *                              [--transcript <json>] [--music <audio>] [--force]
 *   npm run montage -- build  --slug <slug> [--format 9x16|16x9]
 *   npm run montage -- render --slug <slug> [--format 9x16|16x9] [...opciones de Remotion]
 *
 * El ciclo no exige tocar codigo: `ingest` deja un `montage-plan.json` inicial, el
 * agente lo edita (enfasis, overrides, textos), `build` compila un build por formato
 * y regenera el registro de composiciones, y `render` exporta con Remotion.
 */
import {spawnSync} from 'node:child_process';
import {access, readFile, readdir, rename, stat} from 'node:fs/promises';
import path from 'node:path';
import {loadDotEnv} from '../src/lib/utils.js';
import {buildMontage} from '../src/modules/montage-studio/build.js';
import {MONTAGE_FORMATS, REMOTION_ROOT, projectDir} from '../src/modules/montage-studio/constants.js';
import {ingestMontage} from '../src/modules/montage-studio/ingest.js';
import {compositionIdForSlug} from '../src/modules/montage-studio/registry.js';
import {finalizeShortAudio} from '../src/modules/video-studio/render-quality.js';

await loadDotEnv();
const [command, ...rest] = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--slug', '--voiceover', '--assets', '--transcript', '--music', '--format']);
const options = {};
const passthrough = [];
for (let i = 0; i < rest.length; i += 1) {
  if (VALUE_FLAGS.has(rest[i])) options[rest[i].slice(2)] = rest[++i];
  else if (rest[i] === '--force') options.force = true;
  else passthrough.push(rest[i]);
}
const log = (line) => console.log(line);

function usage(message) {
  if (message) console.error(message);
  console.error('Uso: npm run montage -- ingest|build|render --slug <slug> [...]');
  process.exit(1);
}

if (!options.slug) usage('Falta --slug.');

if (command === 'ingest') {
  await ingestMontage({
    slug: options.slug,
    voiceover: options.voiceover && path.resolve(options.voiceover),
    assetsDir: options.assets && path.resolve(options.assets),
    transcript: options.transcript && path.resolve(options.transcript),
    music: options.music && path.resolve(options.music),
    force: Boolean(options.force),
    log
  });
} else if (command === 'build') {
  await buildMontage({slug: options.slug, formats: options.format ? [options.format] : null, log});
} else if (command === 'render') {
  const plan = JSON.parse(await readFile(path.join(projectDir(options.slug), 'montage-plan.json'), 'utf8'));
  const formats = options.format ? [options.format] : plan.formats ?? ['9x16'];
  for (const formatId of formats) {
    if (!MONTAGE_FORMATS[formatId]) usage(`Formato desconocido: ${formatId}`);
    const buildFile = path.join(projectDir(options.slug), `montage-build.${formatId}.json`);
    if (!await access(buildFile).then(() => true, () => false)) {
      usage(`No existe ${path.relative(process.cwd(), buildFile)}. Ejecuta: npm run montage -- build --slug ${options.slug}`);
    }
    const build = JSON.parse(await readFile(buildFile, 'utf8'));
    const compositionId = compositionIdForSlug(options.slug, formatId);
    const outProject = `montage-${options.slug}`;
    const filename = `${options.slug}-${formatId}.raw.mp4`;
    console.log(`Renderizando ${compositionId}`);
    const result = spawnSync(process.execPath,
      // Mismo encode que los shorts: sin forzar el formato de pixel, Remotion entrega
      // yuvj420p (rango completo), que algunas plataformas muestran lavado.
      [path.join('scripts', 'render-safe.mjs'), 'render', outProject, compositionId, filename,
        '--codec=h264', '--pixel-format=yuv420p', '--color-space=bt709', '--image-format=png', ...passthrough],
      {cwd: REMOTION_ROOT, stdio: 'inherit'});
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    const raw = await newestOutput(path.join(REMOTION_ROOT, 'out', outProject, 'runs'), filename);
    const final = raw.replace(/\.raw\.mp4$/, '.mp4');
    // La mezcla (voz + golpes + musica) se renormaliza a -14 LUFS, el objetivo al que
    // renormalizan YouTube, TikTok e Instagram; el video no se recodifica.
    await finalizeShortAudio(raw, `${final}.tmp.mp4`, {duration: build.durationSeconds});
    await rename(`${final}.tmp.mp4`, final);
    console.log(`MP4: ${final}`);
  }
} else {
  usage(`Subcomando desconocido: ${command ?? '(ninguno)'}`);
}

async function newestOutput(runsRoot, filename) {
  const runs = await readdir(runsRoot, {withFileTypes: true});
  const candidates = [];
  for (const entry of runs.filter((item) => item.isDirectory())) {
    const dir = path.join(runsRoot, entry.name);
    const files = await readdir(dir, {recursive: true}).catch(() => []);
    for (const file of files.filter((name) => path.basename(String(name)) === filename)) {
      const full = path.join(dir, String(file));
      candidates.push({full, mtime: (await stat(full)).mtimeMs});
    }
  }
  const newest = candidates.sort((a, b) => b.mtime - a.mtime)[0];
  if (!newest) throw new Error(`No encuentro ${filename} en ${runsRoot}`);
  return newest.full;
}
