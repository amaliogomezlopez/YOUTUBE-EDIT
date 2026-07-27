#!/usr/bin/env node
import {importRemotionAsset, remotionAssetTypes} from '../src/lib/remotion-assets.js';

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
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

const args = parseArgs(process.argv.slice(2));
if (!args.file || !args.id || !args.type || !args.alt || !args.source || !args.license) {
  console.error(
    'Uso: npm run remotion:asset:import -- --file <imagen> --id <slug> ' +
    `--type <${remotionAssetTypes.join('|')}> --alt <texto> --source <origen> ` +
    '--license <licencia> --tags "tag 1,tag 2" [--collection <slug>] [--replace]'
  );
  process.exit(1);
}

const result = await importRemotionAsset({
  sourceFile: args.file,
  id: args.id,
  assetType: args.type,
  alt: args.alt,
  source: args.source,
  author: args.author,
  license: args.license,
  attribution: args.attribution,
  tags: String(args.tags || '').split(','),
  collection: args.collection,
  treatment: args.treatment,
  focalPoint: {
    x: Number(args['focal-x'] ?? 50),
    y: Number(args['focal-y'] ?? 50)
  },
  replace: args.replace === true
});

console.log(JSON.stringify(result, null, 2));
