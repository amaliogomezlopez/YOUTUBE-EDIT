#!/usr/bin/env node
/**
 * Intake de feedback del montaje vertical: convierte una corrección en regla
 * ejecutable.
 *
 * El mecanismo lo implementa `src/modules/video-studio/rule-intake.js`, común a
 * todas las superficies. Aquí solo se declara qué es propio de shorts: el fichero
 * de reglas, el directorio de validadores, el prefijo del id y la forma del
 * contexto que recibe el validador.
 *
 *   npm run shorts:feedback -- --note "la captura no se lee en split" \
 *     --section legibility --severity error --check shorts-dense-capture-needs-stage
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {recordFeedbackRule} from '../src/modules/video-studio/rule-intake.js';
import {
  SHORTS_CHECKS_DIR,
  SHORTS_RULES_FILE,
  loadShortsChecks,
  loadShortsRules
} from '../src/modules/shorts-studio/rules/index.js';
import {PLAYBOOK_OPTIONS} from './shorts-playbook.js';
import {renderPlaybook} from './render-editing-playbook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYBOOK_FILE = path.join(ROOT, 'docs', 'shorts-playbook.md');

const SHORTS_SURFACE = {
  rulesFile: SHORTS_RULES_FILE,
  checksDir: fileURLToPath(SHORTS_CHECKS_DIR),
  fixturesDir: path.join(ROOT, 'tests', 'fixtures', 'shorts-rules'),
  fixturesRelativeDir: 'tests/fixtures/shorts-rules',
  logFile: path.join(ROOT, 'src', 'modules', 'shorts-studio', 'rules', 'feedback-log.jsonl'),
  idPrefix: 'SH-R',
  checkPrefix: 'shorts-',
  defaultSection: 'information',
  feedbackCommand: 'npm run shorts:feedback',
  loadRules: loadShortsRules,
  loadChecks: loadShortsChecks,
  contextDoc: 'El contexto es `short-build.json`: `context.scenes` con `layout`,\n' +
    '`cues` (slot, fromFrame, durationInFrames, presentation, art, sound) y\n' +
    '`captionPages`; `context.format`, `context.soundCues` y\n' +
    '`context.duckWindows` para lo demás.',
  fixtureContext: () => ({
    format: {width: 1080, height: 1920, fps: 60},
    silencePaddingSeconds: 0.5,
    scenes: [
      {
        id: 'scene-fixture-000',
        clipId: '01',
        layout: 'split',
        camera: 'static',
        from: 0,
        durationInFrames: 240,
        trimStartSeconds: 0,
        trimEndSeconds: 4,
        speechLeadSeconds: 0.2,
        speechTailSeconds: 0.2,
        cues: [],
        captionPages: []
      }
    ],
    soundCues: [],
    duckWindows: []
  })
};

function parseArgs(argv) {
  const args = {
    severity: 'warning',
    scope: 'catalog',
    check: '',
    section: '',
    note: '',
    rationale: '',
    statement: ''
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    if (key in args) args[key] = argv[++index] ?? '';
    else if (key === 'help' || key === 'h') args.help = true;
    else throw new Error(`Opción desconocida: ${token}`);
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.note) {
    console.log(
      'Uso: npm run shorts:feedback -- --note "<corrección>" ' +
      '[--section <id>] [--severity error|warning|review] ' +
      '[--scope catalog|channel] [--check <validador>|manual] [--rationale "<por qué>"]'
    );
    return;
  }
  await loadShortsChecks();
  const {ruleId, ruleSet, created, checkPending} = await recordFeedbackRule({
    surface: SHORTS_SURFACE,
    input: args,
    root: ROOT
  });

  await writeFile(PLAYBOOK_FILE, `${renderPlaybook(ruleSet, PLAYBOOK_OPTIONS)}\n`, 'utf8');

  console.log(`Regla ${ruleId} registrada en ${path.relative(ROOT, SHORTS_RULES_FILE)}.`);
  if (created.length) console.log(`Creados: ${created.join(', ')}`);
  if (checkPending) {
    console.log(
      `El validador «${args.check || 'generado'}» está sin implementar: rellena su ` +
      '`run` y el fixture con un montaje real que la incumpla.'
    );
  }
  console.log('Playbook regenerado.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
