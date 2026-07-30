#!/usr/bin/env node
/**
 * Intake de feedback del montaje de intro: convierte una corrección en regla
 * ejecutable.
 *
 * El mecanismo lo implementa `src/modules/video-studio/rule-intake.js`, común a las
 * tres superficies. Aquí solo se declara qué es propio de la intro.
 *
 *   npm run intro:feedback -- --note "el logo tapa mi cara" \
 *     --section layers --severity error --check intro-face-not-covered
 */
import {writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {recordFeedbackRule} from '../src/modules/video-studio/rule-intake.js';
import {
  INTRO_CHECKS_DIR,
  INTRO_RULES_FILE,
  loadIntroChecks,
  loadIntroRules
} from '../src/modules/intro-studio/rules/index.js';
import {PLAYBOOK_OPTIONS} from './intro-playbook.js';
import {renderPlaybook} from './render-editing-playbook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYBOOK_FILE = path.join(ROOT, 'docs', 'intro-playbook.md');

const INTRO_SURFACE = {
  rulesFile: INTRO_RULES_FILE,
  checksDir: fileURLToPath(INTRO_CHECKS_DIR),
  fixturesDir: path.join(ROOT, 'tests', 'fixtures', 'intro-rules'),
  fixturesRelativeDir: 'tests/fixtures/intro-rules',
  logFile: path.join(ROOT, 'src', 'modules', 'intro-studio', 'rules', 'feedback-log.jsonl'),
  idPrefix: 'IN-R',
  checkPrefix: 'intro-',
  defaultSection: 'layers',
  feedbackCommand: 'npm run intro:feedback',
  loadRules: loadIntroRules,
  loadChecks: loadIntroChecks,
  contextDoc: 'El contexto es `intro-build.json`: `context.scenes` con `layout`,\n' +
    '`faceRect`, `cues` (slot, depth, rect, scale, blurPx, presentation, art, sound),\n' +
    '`effects` (effect, strong, absoluteSeconds, beatDeltaSeconds) y `captionPages`;\n' +
    'más `context.music.beatSeconds` y `context.budget`, que trae los umbrales del\n' +
    'perfil de estilo activo. Una regla de ritmo lee su umbral del `budget`, nunca\n' +
    'de una constante, y se declara no evaluable si no está.',
  fixtureContext: () => ({
    format: {width: 1920, height: 1080, fps: 60},
    durationInFrames: 480,
    durationSeconds: 8,
    silencePaddingSeconds: 0.5,
    scenes: [
      {
        id: 'escena-fixture',
        clipId: '01',
        layout: 'hero',
        camera: 'static',
        from: 0,
        durationInFrames: 480,
        trimStartSeconds: 0,
        trimEndSeconds: 8,
        cues: [],
        effects: [],
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
      'Uso: npm run intro:feedback -- --note "<corrección>" ' +
      '[--section layers|legibility|safe-area|rhythm|sound|pacing] ' +
      '[--severity error|warning|review] [--scope catalog|channel] ' +
      '[--check <validador>|manual] [--rationale "<por qué>"]'
    );
    return;
  }
  await loadIntroChecks();
  const {ruleId, ruleSet, created, checkPending} = await recordFeedbackRule({
    surface: INTRO_SURFACE,
    input: args,
    root: ROOT
  });

  await writeFile(PLAYBOOK_FILE, `${renderPlaybook(ruleSet, PLAYBOOK_OPTIONS)}\n`, 'utf8');

  console.log(`Regla ${ruleId} registrada en ${path.relative(ROOT, INTRO_RULES_FILE)}.`);
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
