import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {selectVisualAsset} from '../src/lib/visual-selection.js';
import {loadDotEnv} from '../src/lib/utils.js';

function parseArgs(argv) {
  const args = {
    query: '',
    kind: 'any',
    limit: 5,
    allowFallback: false,
    useLlm: false,
    output: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--query') args.query = argv[++index] || '';
    else if (token === '--kind') args.kind = argv[++index] || 'any';
    else if (token === '--limit') args.limit = Number(argv[++index] || 5);
    else if (token === '--output') args.output = argv[++index] || '';
    else if (token === '--allow-fallback') args.allowFallback = true;
    else if (token === '--llm') args.useLlm = true;
    else if (token === '--help' || token === '-h') {
      console.log('Uso: npm run remotion:select:visual -- --query "<concepto>" [--kind any|icon|drawing|image] [--allow-fallback] [--llm] [--output archivo.json]');
      return null;
    } else {
      throw new Error(`Opción desconocida: ${token}`);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
if (args) {
  await loadDotEnv();
  const result = await selectVisualAsset(args.query, args);
  const payload = `${JSON.stringify(result, null, 2)}\n`;
  if (args.output) {
    await writeFile(path.resolve(args.output), payload, 'utf8');
  }
  console.log(payload);
}
