#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {access, copyFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * FC-R-101 — Un bloque aprobable son cinco artefactos, no dos ficheros JSON:
 * render-props, manifiesto, audio recortado, cinco stills de QA y un MP4
 * independiente. Aprobar un bloque tiene que ser ver el bloque.
 */
const QA_STILL_CHECKPOINTS = [0.08, 0.3, 0.52, 0.74, 0.94];
const REMOTION_DIRECTORY = path.join(ROOT, 'remotion-animations');
const REMOTION_CLI = path.join(
  REMOTION_DIRECTORY, 'node_modules', '@remotion', 'cli', 'remotion-cli.js'
);
const COMPOSITION_ID = 'Finance-Cavaliers-Episode';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      result[key] = true;
    } else {
      result[key] = value;
      index += 1;
    }
  }
  return result;
}

function run(command, args, {cwd = ROOT} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      windowsHide: true
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} terminó con código ${code}.`))
    );
  });
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const args = parseArgs(process.argv.slice(2));
if (!args.props || !args.from || !args.to || !args.id) {
  throw new Error(
    'Uso: node scripts/build-editorial-review-block.js ' +
      '--props <render-props.json> --from <scene-id> --to <scene-id> --id <02> ' +
      '[--skip-render]\n' +
      '  --skip-render deja el bloque sin stills ni MP4: FC-R-101 lo marcará ' +
      'incompleto, que es exactamente lo que es.'
  );
}
const skipRender = args['skip-render'] === true;

const propsFile = path.resolve(ROOT, args.props);
const props = JSON.parse(await readFile(propsFile, 'utf8'));
const startIndex = props.scenes.findIndex((scene) => scene.id === args.from);
const endIndex = props.scenes.findIndex((scene) => scene.id === args.to);
if (startIndex < 0 || endIndex < startIndex) {
  throw new Error('El rango de escenas solicitado no existe o está invertido.');
}

const selected = props.scenes.slice(startIndex, endIndex + 1);
const sourceStartSeconds = selected[0].startSeconds;
const contentEndSeconds = selected.at(-1).endSeconds;
const tailSeconds = Math.max(0, Math.min(2, Number(args.tail) || 0));
const sourceEndSeconds = Math.min(
  props.durationSeconds,
  contentEndSeconds + tailSeconds
);
const durationSeconds = Number(
  (sourceEndSeconds - sourceStartSeconds).toFixed(3)
);
const blockSlug = `block-${String(args.id).padStart(2, '0')}`;
const publicDirectory = path.join(
  ROOT,
  'remotion-animations',
  'public',
  'assets',
  'library',
  'finance-cavaliers',
  'episodes',
  '1',
  'review-blocks'
);
const visualsDirectory = path.join(
  ROOT,
  'data',
  'channels',
  'finance-cavaliers',
  'episodes',
  '1',
  'visuals',
  'review-blocks',
  blockSlug
);
await Promise.all([
  mkdir(publicDirectory, {recursive: true}),
  mkdir(visualsDirectory, {recursive: true})
]);

const sourceAudio = path.join(
  ROOT,
  'remotion-animations',
  'public',
  props.audioPath
);
const audioName =
  `${blockSlug}-${sourceStartSeconds.toFixed(3).replace('.', '_')}-` +
  `${sourceEndSeconds.toFixed(3).replace('.', '_')}.m4a`;
const outputAudio = path.join(publicDirectory, audioName);
// Un proceso interrumpido puede dejar un M4A existente pero sin átomo `moov`.
// Regenerar el recorte es barato y evita que Remotion renderice únicamente los
// efectos al reutilizar silenciosamente un archivo truncado.
await run('ffmpeg', [
  '-y',
  '-ss',
  String(sourceStartSeconds),
  '-to',
  String(sourceEndSeconds),
  '-i',
  sourceAudio,
  '-vn',
  '-c:a',
  'aac',
  '-b:a',
  '192k',
  outputAudio
]);

const blockProps = {
  ...props,
  durationSeconds,
  audioPath: path
    .relative(path.join(ROOT, 'remotion-animations', 'public'), outputAudio)
    .split(path.sep)
    .join('/'),
  scenes: selected.map((scene) => ({
    ...scene,
    startSeconds: Number((scene.startSeconds - sourceStartSeconds).toFixed(3)),
    endSeconds: Number((scene.endSeconds - sourceStartSeconds).toFixed(3))
  }))
};
const outputProps = path.join(visualsDirectory, 'render-props.json');
const outputManifest = path.join(visualsDirectory, 'manifest.json');
await writeFile(outputProps, `${JSON.stringify(blockProps, null, 2)}\n`, 'utf8');

// El audio recortado vive en `public/` porque el render lo necesita ahí, pero el
// bloque también lo lleva: se revisa —y se archiva— como una unidad.
const blockAudio = path.join(visualsDirectory, 'audio.m4a');
await copyFile(outputAudio, blockAudio);

const fps = Number(props.fps) || 30;
const totalFrames = Math.max(1, Math.round(durationSeconds * fps));
const blockVideo = path.join(visualsDirectory, 'block.mp4');
const stills = QA_STILL_CHECKPOINTS.map((checkpoint, position) => ({
  checkpoint,
  frame: Math.min(totalFrames - 1, Math.round((totalFrames - 1) * checkpoint)),
  file: path.join(
    visualsDirectory,
    `still-${String(position + 1).padStart(2, '0')}.png`
  )
}));

const rendered = [];
if (skipRender) {
  console.warn(
    `[${blockSlug}] --skip-render: no se generan stills ni MP4. El bloque queda ` +
      'incompleto para FC-R-101.'
  );
} else {
  // Los cinco stills se reparten por el bloque, no se agolpan al principio: un
  // contact sheet de los cinco primeros segundos no demuestra nada del minuto.
  for (const still of stills) {
    if (await exists(still.file)) continue;
    await run(process.execPath, [
      REMOTION_CLI,
      'still',
      'src/index.ts',
      COMPOSITION_ID,
      still.file,
      `--props=${outputProps}`,
      `--frame=${still.frame}`,
      '--image-format=png'
    ], {cwd: REMOTION_DIRECTORY});
    rendered.push(path.basename(still.file));
  }
  if (!(await exists(blockVideo))) {
    await run(process.execPath, [
      REMOTION_CLI,
      'render',
      'src/index.ts',
      COMPOSITION_ID,
      blockVideo,
      `--props=${outputProps}`
    ], {cwd: REMOTION_DIRECTORY});
    rendered.push(path.basename(blockVideo));
  }
}

const relative = (file) => path.relative(ROOT, file).split(path.sep).join('/');
const artifacts = [
  'render-props.json',
  'manifest.json',
  'audio.m4a',
  ...stills.map((still) => path.basename(still.file)),
  'block.mp4'
];
const missing = [];
for (const name of artifacts) {
  if (name === 'manifest.json') continue;
  if (!(await exists(path.join(visualsDirectory, name)))) missing.push(name);
}

await writeFile(outputManifest, `${JSON.stringify({
  version: 2,
  id: blockSlug,
  sourceProps: relative(propsFile),
  sourceStartSeconds,
  contentEndSeconds,
  sourceEndSeconds,
  tailSeconds,
  durationSeconds,
  fps,
  frames: totalFrames,
  sceneIds: selected.map((scene) => scene.id),
  audioPath: blockProps.audioPath,
  renderProps: relative(outputProps),
  // La lista es la que lee `delivery-completeness` a través de
  // `collectReviewBlockArtifacts`; se declara aquí para que un bloque
  // incompleto se vea en el propio manifiesto y no solo en el informe.
  artifacts,
  missingArtifacts: missing,
  qaStills: stills.map((still) => ({
    file: path.basename(still.file),
    frame: still.frame,
    atSeconds: Number((still.frame / fps).toFixed(3)),
    checkpoint: still.checkpoint
  }))
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({
  block: blockSlug,
  sourceStartSeconds,
  contentEndSeconds,
  sourceEndSeconds,
  tailSeconds,
  durationSeconds,
  sceneIds: selected.map((scene) => scene.id),
  propsFile: outputProps,
  audioFile: outputAudio,
  rendered,
  missingArtifacts: missing
}, null, 2));

if (missing.length) {
  console.warn(
    `[${blockSlug}] faltan ${missing.join(', ')}: el bloque no cumple FC-R-101.`
  );
}
