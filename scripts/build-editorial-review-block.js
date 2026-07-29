#!/usr/bin/env node
import {spawn} from 'node:child_process';
import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT,
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
      '--props <render-props.json> --from <scene-id> --to <scene-id> --id <02>'
  );
}

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
if (!(await exists(outputAudio))) {
  await run('ffmpeg', [
    '-n',
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
}

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
await Promise.all([
  writeFile(outputProps, `${JSON.stringify(blockProps, null, 2)}\n`, 'utf8'),
  writeFile(outputManifest, `${JSON.stringify({
    version: 1,
    id: blockSlug,
    sourceProps: path.relative(ROOT, propsFile).split(path.sep).join('/'),
    sourceStartSeconds,
    contentEndSeconds,
    sourceEndSeconds,
    tailSeconds,
    durationSeconds,
    sceneIds: selected.map((scene) => scene.id),
    audioPath: blockProps.audioPath,
    renderProps: path.relative(ROOT, outputProps).split(path.sep).join('/')
  }, null, 2)}\n`, 'utf8')
]);

console.log(JSON.stringify({
  block: blockSlug,
  sourceStartSeconds,
  contentEndSeconds,
  sourceEndSeconds,
  tailSeconds,
  durationSeconds,
  sceneIds: selected.map((scene) => scene.id),
  propsFile: outputProps,
  audioFile: outputAudio
}, null, 2));
