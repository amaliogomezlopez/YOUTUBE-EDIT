#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {ensureDataDirs, loadDotEnv, parseCliArgs} from '../../lib/utils.js';
import {importCarouselAsset} from './assets.js';
import {exportCarouselProject} from './exporter.js';
import {listCarouselProjects, loadCarouselProject} from './repository.js';
import {createCarouselProject} from './service.js';

function usage() {
  console.log(`Carouselsmith

Uso:
  npm run carousel -- create --source-file noticia.txt --title "Tema" --slides 7 --theme forge
  npm run carousel -- import --id carousel-... --slide slide-01 --slot slide-01-visual-01 --image hero.png
  npm run carousel -- render --id carousel-... --formats instagram-feed,vertical
  npm run carousel -- show --id carousel-...
  npm run carousel -- list

Temas: forge, cobalt, signal, night`);
}

function required(args, name) {
  const value = args[name];
  if (!value) throw new Error(`Falta --${name}.`);
  return String(value);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || ['help', '--help', '-h'].includes(command)) return usage();
  const args = parseCliArgs(rest);
  await loadDotEnv();
  await ensureDataDirs();

  if (command === 'create') {
    let source = args.source ? String(args.source) : '';
    if (args['source-file']) {
      const sourceFile = path.resolve(String(args['source-file']));
      if (!existsSync(sourceFile)) throw new Error(`No existe la fuente: ${sourceFile}`);
      source = await readFile(sourceFile, 'utf8');
    }
    const project = await createCarouselProject({source, title: args.title, sourceName: args['source-name'], slideCount: Number(args.slides || 7), theme: args.theme || 'forge', audience: args.audience, tone: args.tone, handle: args.handle, useLlm: !args['no-llm']});
    console.log(JSON.stringify({id: project.id, title: project.title, slides: project.slides.length, warning: project.warning}, null, 2));
    return;
  }
  if (command === 'import') {
    const id = required(args, 'id');
    const image = path.resolve(required(args, 'image'));
    if (!existsSync(image)) throw new Error(`No existe la imagen: ${image}`);
    const project = await loadCarouselProject(id);
    const asset = await importCarouselAsset(project, {file: image, originalName: path.basename(image), slideId: required(args, 'slide'), slotId: required(args, 'slot'), provider: args.provider || 'uploaded', prompt: args.prompt});
    console.log(JSON.stringify({projectId: id, asset}, null, 2));
    return;
  }
  if (command === 'render') {
    const project = await loadCarouselProject(required(args, 'id'));
    const formats = String(args.formats || 'instagram-feed,vertical').split(',').map((item) => item.trim()).filter(Boolean);
    console.log(JSON.stringify(await exportCarouselProject(project, {formats, quality: Number(args.quality || 90)}), null, 2));
    return;
  }
  if (command === 'show') {
    console.log(JSON.stringify(await loadCarouselProject(required(args, 'id')), null, 2));
    return;
  }
  if (command === 'list') {
    console.log(JSON.stringify(await listCarouselProjects(), null, 2));
    return;
  }
  throw new Error(`Comando desconocido: ${command}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
