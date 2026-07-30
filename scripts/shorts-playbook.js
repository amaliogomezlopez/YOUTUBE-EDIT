#!/usr/bin/env node
/**
 * Genera `docs/shorts-playbook.md` **desde** `shorts-rules.json`.
 *
 * Igual que en el canal editorial: la prosa es una vista del contrato, no una
 * fuente. Editar el .md a mano no cambia nada; edita el JSON.
 *
 *   node scripts/shorts-playbook.js [--check]
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {loadShortsChecks, loadShortsRules} from '../src/modules/shorts-studio/rules/index.js';
import {renderPlaybook} from './render-editing-playbook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = path.join(ROOT, 'docs', 'shorts-playbook.md');

export const PLAYBOOK_OPTIONS = {
  source: 'src/modules/shorts-studio/rules/shorts-rules.json',
  feedbackCommand: 'npm run shorts:feedback -- --note "la captura no se lee en split" ' +
    '--section legibility --severity error --check shorts-dense-capture-needs-stage'
};

async function main() {
  const check = process.argv.slice(2).includes('--check');
  await loadShortsChecks();
  const markdown = renderPlaybook(await loadShortsRules(), PLAYBOOK_OPTIONS);
  if (check) {
    const current = await readFile(OUTPUT_FILE, 'utf8').catch(() => '');
    if (current.trim() !== markdown.trim()) {
      console.error(
        `${path.relative(ROOT, OUTPUT_FILE)} está desincronizado con shorts-rules.json. ` +
        'Ejecuta `npm run shorts:playbook`.'
      );
      process.exitCode = 1;
      return;
    }
    console.log('El playbook de shorts está sincronizado con el contrato.');
    return;
  }
  await writeFile(OUTPUT_FILE, `${markdown}\n`, 'utf8');
  console.log(`${path.relative(ROOT, OUTPUT_FILE)} regenerado.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
