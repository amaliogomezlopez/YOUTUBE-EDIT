#!/usr/bin/env node
/**
 * ANM-G01 · ANM-G02 — Gestión del registro de entidades del canal.
 *
 *   npm run channel:entities -- --channel finance-cavaliers --verify
 *   npm run channel:entities -- --channel finance-cavaliers --resolve "Broadcom" --allow-remote
 *
 * Sin `--allow-remote` el comando es puramente local: informa de qué falta y con
 * qué comando se trae. El render nunca resuelve nada por red.
 */
import {mkdtemp, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createEntityRegistry, resolveEntityRemotely} from '../src/modules/editorial-video/visuals/entity-resolver.js';
import {searchBrandfetch} from '../src/lib/editorial-asset-search.js';
import {importRemotionAsset} from '../src/lib/remotion-assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {channel: 'finance-cavaliers', resolve: '', verify: false, allowRemote: false};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--verify') args.verify = true;
    else if (token === '--allow-remote') args.allowRemote = true;
    else if (token === '--channel') args.channel = argv[++index] ?? '';
    else if (token === '--resolve') args.resolve = argv[++index] ?? '';
    else if (token === '--help' || token === '-h') args.help = true;
  }
  return args;
}

async function downloadTo(url, id) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`La descarga de ${url} respondió HTTP ${response.status}.`);
  }
  const directory = await mkdtemp(path.join(tmpdir(), 'entity-logo-'));
  const extension = url.toLowerCase().includes('.jpg') ? '.jpg' : '.png';
  const file = path.join(directory, `${id}${extension}`);
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  return file;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.verify && !args.resolve)) {
    console.log(
      'Uso: npm run channel:entities -- --channel <id> [--verify] ' +
      '[--resolve "<nombre>" [--allow-remote]]'
    );
    return;
  }
  const registryFile = path.join(ROOT, 'channels', args.channel, 'brand', 'entities.json');
  const raw = JSON.parse(await readFile(registryFile, 'utf8'));
  const registry = createEntityRegistry(raw, {root: ROOT});

  if (args.verify) {
    const {declared, missing} = await registry.verifyLocalAssets();
    console.log(`Assets declarados: ${declared.length} · ausentes: ${missing.length}`);
    for (const asset of missing) {
      console.log(`  · ${asset.id} → ${asset.path}`);
    }
    if (missing.length) process.exitCode = 1;
  }

  if (args.resolve) {
    const existing = registry.resolve(args.resolve);
    if (existing) {
      console.log(`«${args.resolve}» ya está registrada como ${existing.id}.`);
      return;
    }
    if (!args.allowRemote) {
      console.log(
        `«${args.resolve}» no está en el registro. Añádela a mano en ` +
        `${path.relative(ROOT, registryFile)} o repite con --allow-remote ` +
        'para resolverla vía Brand Search API + Logo API.'
      );
      process.exitCode = 1;
      return;
    }
    const entity = await resolveEntityRemotely(args.resolve, {
      searchBrandfetch,
      downloadTo,
      importRemotionAsset,
      channelId: args.channel,
      collection: `${args.channel}-entity-logos`
    });
    raw.entities.push(entity);
    await writeFile(registryFile, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    console.log(`«${entity.name}» registrada con asset ${entity.asset.path}.`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
