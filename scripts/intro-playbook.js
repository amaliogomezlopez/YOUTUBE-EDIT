#!/usr/bin/env node
/**
 * Genera `docs/intro-playbook.md` **desde** `intro-rules.json`.
 *
 * Igual que en las otras superficies: la prosa es una vista del contrato, no una
 * fuente. Editar el .md a mano no cambia nada; edita el JSON.
 *
 *   node scripts/intro-playbook.js [--check]
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {loadIntroChecks, loadIntroRules} from '../src/modules/intro-studio/rules/index.js';
import {renderPlaybook} from './render-editing-playbook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_FILE = path.join(ROOT, 'docs', 'intro-playbook.md');

export const PLAYBOOK_OPTIONS = {
  source: 'src/modules/intro-studio/rules/intro-rules.json',
  feedbackCommand: 'npm run intro:feedback -- --note "el logo tapa mi cara" ' +
    '--section layers --severity error --check intro-face-not-covered'
};

async function main() {
  const check = process.argv.slice(2).includes('--check');
  await loadIntroChecks();
  const markdown = renderPlaybook(await loadIntroRules(), PLAYBOOK_OPTIONS);
  if (check) {
    const current = await readFile(OUTPUT_FILE, 'utf8').catch(() => '');
    if (current.trim() !== markdown.trim()) {
      console.error(
        `${path.relative(ROOT, OUTPUT_FILE)} está desincronizado con intro-rules.json. ` +
        'Ejecuta `npm run intro:playbook`.'
      );
      process.exitCode = 1;
      return;
    }
    console.log('El playbook de intro está sincronizado con el contrato.');
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
