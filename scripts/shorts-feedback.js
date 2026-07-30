#!/usr/bin/env node
/**
 * Intake de feedback del montaje vertical: convierte una corrección en regla
 * ejecutable.
 *
 * Una corrección dada una vez debe aplicarse siempre y por cualquier agente. Este
 * comando registra la nota, crea la regla con id estable, deja el esqueleto del
 * validador y un fixture que la incumple, y regenera el playbook.
 *
 *   npm run shorts:feedback -- --note "la captura no se lee en split" \
 *     --section legibility --severity error --check shorts-dense-capture-needs-stage
 */
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {CHECKS} from '../src/modules/editorial-video/visuals/rules-engine.js';
import {
  SHORTS_RULES_FILE,
  loadShortsChecks,
  loadShortsRules
} from '../src/modules/shorts-studio/rules/index.js';
import {nextRuleId} from './channel-feedback.js';
import {PLAYBOOK_OPTIONS} from './shorts-playbook.js';
import {renderPlaybook} from './render-editing-playbook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHECKS_DIR = path.join(ROOT, 'src', 'modules', 'shorts-studio', 'rules', 'checks');
const FIXTURES_DIR = path.join(ROOT, 'tests', 'fixtures', 'shorts-rules');
const LOG_FILE = path.join(ROOT, 'src', 'modules', 'shorts-studio', 'rules', 'feedback-log.jsonl');
const PLAYBOOK_FILE = path.join(ROOT, 'docs', 'shorts-playbook.md');

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

function slugify(value) {
  return String(value)
    .normalize('NFD')
    .replace(new RegExp('[\\u0300-\\u036f]', 'g'), '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

/** El validador recibe `short-build.json`: escenas con layout, cues y subtítulos. */
function checkTemplate(checkId, statement) {
  return `/**
 * Validador generado por \`npm run shorts:feedback\`.
 *
 * Regla: ${statement}
 *
 * El contexto es \`short-build.json\`: \`context.scenes\` con \`layout\`,
 * \`cues\` (slot, fromFrame, durationInFrames, presentation, art, sound) y
 * \`captionPages\`; \`context.format\`, \`context.soundCues\` y
 * \`context.duckWindows\` para lo demás.
 *
 * Rellena \`run\` con la comprobación real. Mientras devuelva la incidencia TODO,
 * el fixture de regresión falla y la regla no se puede dar por cerrada.
 */
export default {
  id: ${JSON.stringify(checkId)},
  run(context, rule) {
    const issues = [];
    for (const scene of context.scenes ?? []) {
      // TODO: implementar la comprobación de ${checkId} sobre \`scene\`.
      void scene;
      void rule;
    }
    if (!issues.length) {
      return [{
        message: 'TODO: el validador ${checkId} aún no comprueba nada.',
        todo: true
      }];
    }
    return issues;
  }
};
`;
}

function fixtureTemplate(ruleId, statement, checkId) {
  return {
    ruleId,
    statement,
    check: checkId,
    expect: 'fail',
    note: 'Montaje mínimo que INCUMPLE la regla. El test verifica que el motor la detecta.',
    context: {
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
    }
  };
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
  const ruleSet = await loadShortsRules();

  const sectionId = args.section || 'information';
  if (!ruleSet.sections.some((section) => section.id === sectionId)) {
    throw new Error(
      `Sección desconocida «${sectionId}». Disponibles: ` +
      ruleSet.sections.map((section) => section.id).join(', ')
    );
  }
  const ruleId = nextRuleId(ruleSet, sectionId);
  const statement = args.statement || args.note;
  const checkId = args.check || `shorts-${slugify(args.note)}`;
  const isManual = checkId === 'manual';
  const known = isManual || Boolean(CHECKS[checkId]);

  const rule = {
    id: ruleId,
    section: sectionId,
    statement,
    rationale: args.rationale || args.note,
    scope: args.scope,
    severity: args.severity,
    check: checkId,
    origin: {
      feedback: args.note,
      recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    },
    ...(isManual ? {} : {fixture: `tests/fixtures/shorts-rules/${ruleId}.json`})
  };
  ruleSet.rules.push(rule);
  await writeFile(SHORTS_RULES_FILE, `${JSON.stringify(ruleSet, null, 2)}\n`, 'utf8');

  const created = [];
  if (!known) {
    const checkFile = path.join(CHECKS_DIR, `${checkId}.js`);
    await mkdir(CHECKS_DIR, {recursive: true});
    await writeFile(checkFile, checkTemplate(checkId, statement), 'utf8');
    created.push(path.relative(ROOT, checkFile));
    // El playbook cuenta cuantas reglas tienen validador; sin releer el directorio
    // el esqueleto recien creado saldria como «sin implementar».
    await loadShortsChecks();
  }
  if (!isManual) {
    const fixtureFile = path.join(FIXTURES_DIR, `${ruleId}.json`);
    await mkdir(FIXTURES_DIR, {recursive: true});
    await writeFile(
      fixtureFile,
      `${JSON.stringify(fixtureTemplate(ruleId, statement, checkId), null, 2)}\n`,
      'utf8'
    );
    created.push(path.relative(ROOT, fixtureFile));
  }

  await appendFile(
    LOG_FILE,
    `${JSON.stringify({ruleId, ...rule.origin, severity: args.severity, scope: args.scope, check: checkId})}\n`,
    'utf8'
  );

  await writeFile(PLAYBOOK_FILE, `${renderPlaybook(ruleSet, PLAYBOOK_OPTIONS)}\n`, 'utf8');

  console.log(`Regla ${ruleId} registrada en ${path.relative(ROOT, SHORTS_RULES_FILE)}.`);
  if (created.length) console.log(`Creados: ${created.join(', ')}`);
  if (!known) {
    console.log(
      `El validador «${checkId}» está sin implementar: rellena su \`run\` y el ` +
      'fixture con un montaje real que la incumpla.'
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
