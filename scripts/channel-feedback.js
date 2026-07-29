#!/usr/bin/env node
/**
 * ANM-I04 — Intake de feedback: convierte una corrección en regla ejecutable.
 *
 * Una corrección dada una vez debe aplicarse siempre y por cualquier agente.
 * Este comando registra la nota, crea la regla con id estable, deja el esqueleto
 * del validador y un fixture que la incumple, y regenera el playbook.
 *
 *   npm run channel:feedback -- --note "el conector atraviesa la tarjeta" \
 *     --section spatial-safety --severity error --check connector-crosses-card
 */
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {CHECKS, loadCustomChecks} from '../src/modules/editorial-video/visuals/rules-engine.js';
import {renderPlaybook} from './render-editing-playbook.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    channel: 'finance-cavaliers',
    severity: 'warning',
    scope: 'channel',
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
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

export function nextRuleId(ruleSet, sectionId) {
  const prefix = ruleSet.rules[0]?.id?.split('-').slice(0, 2).join('-') ?? 'FC-R';
  const sectionNumber = ruleSet.sections.find((section) => section.id === sectionId)?.number ?? 0;
  const block = sectionNumber * 10;
  const used = ruleSet.rules
    .map((rule) => Number(rule.id.split('-').at(-1)))
    .filter((value) => Number.isFinite(value) && value >= block && value < block + 10);
  const next = used.length ? Math.max(...used) + 1 : block;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function checkTemplate(checkId, statement) {
  return `/**
 * Validador generado por \`npm run channel:feedback\`.
 *
 * Regla: ${statement}
 *
 * Rellena \`run\` con la comprobación real. Mientras devuelva la incidencia
 * TODO, el fixture de regresión falla y la regla no se puede dar por cerrada.
 */
export default {
  id: ${JSON.stringify(checkId)},
  run(context, rule) {
    const issues = [];
    for (const scene of context.scenes) {
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
    note: 'Plan mínimo que INCUMPLE la regla. El test verifica que el motor la detecta.',
    context: {
      words: [
        {text: 'ejemplo', start: 0, end: 0.4},
        {text: 'mínimo', start: 0.5, end: 0.9}
      ],
      scenes: [
        {
          id: 'scene-fixture-001',
          componentKey: 'kinetic-text',
          startSeconds: 0,
          endSeconds: 4,
          geometry: 'typography',
          emphasis: 'scale',
          cues: [],
          layoutBoxes: [],
          connectors: [],
          assets: []
        }
      ],
      coverage: [],
      issues: []
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.note) {
    console.log(
      'Uso: npm run channel:feedback -- --note "<corrección>" ' +
      '[--channel <id>] [--section <id>] [--severity error|warning|review] ' +
      '[--scope channel|catalog] [--check <validador>|manual] [--rationale "<por qué>"]'
    );
    return;
  }
  await loadCustomChecks();
  const rulesFile = path.join(ROOT, 'channels', args.channel, 'brand', 'editing-rules.json');
  const ruleSet = JSON.parse(await readFile(rulesFile, 'utf8'));

  const sectionId = args.section || 'rhythm';
  if (!ruleSet.sections.some((section) => section.id === sectionId)) {
    throw new Error(
      `Sección desconocida «${sectionId}». Disponibles: ` +
      ruleSet.sections.map((section) => section.id).join(', ')
    );
  }
  const ruleId = nextRuleId(ruleSet, sectionId);
  const statement = args.statement || args.note;
  const checkId = args.check || `${slugify(args.note)}`;
  const isManual = checkId === 'manual';
  const known = isManual || Boolean(CHECKS[checkId]);

  const rule = {
    id: ruleId,
    section: sectionId,
    statement,
    ...(args.rationale ? {rationale: args.rationale} : {}),
    scope: args.scope,
    severity: args.severity,
    check: checkId,
    origin: {
      feedback: args.note,
      recordedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
    },
    ...(isManual ? {} : {fixture: `tests/fixtures/editing-rules/${ruleId}.json`})
  };
  ruleSet.rules.push(rule);
  await writeFile(rulesFile, `${JSON.stringify(ruleSet, null, 2)}\n`, 'utf8');

  const created = [];
  if (!known) {
    const checkFile = path.join(
      ROOT, 'src', 'modules', 'editorial-video', 'visuals', 'checks', `${checkId}.js`
    );
    await mkdir(path.dirname(checkFile), {recursive: true});
    await writeFile(checkFile, checkTemplate(checkId, statement), 'utf8');
    created.push(path.relative(ROOT, checkFile));
  }
  if (!isManual) {
    const fixtureFile = path.join(ROOT, 'tests', 'fixtures', 'editing-rules', `${ruleId}.json`);
    await mkdir(path.dirname(fixtureFile), {recursive: true});
    await writeFile(
      fixtureFile,
      `${JSON.stringify(fixtureTemplate(ruleId, statement, checkId), null, 2)}\n`,
      'utf8'
    );
    created.push(path.relative(ROOT, fixtureFile));
  }

  const logFile = path.join(ROOT, 'channels', args.channel, 'brand', 'feedback-log.jsonl');
  await appendFile(
    logFile,
    `${JSON.stringify({ruleId, ...rule.origin, severity: args.severity, scope: args.scope, check: checkId})}\n`,
    'utf8'
  );

  const playbookFile = path.join(ROOT, 'channels', args.channel, 'brand', 'editing-playbook.md');
  await writeFile(playbookFile, `${renderPlaybook(ruleSet)}\n`, 'utf8');

  console.log(`Regla ${ruleId} registrada en ${path.relative(ROOT, rulesFile)}.`);
  if (created.length) console.log(`Creados: ${created.join(', ')}`);
  if (!known) {
    console.log(
      `El validador «${checkId}» está sin implementar: rellena su \`run\` y el ` +
      'fixture con un caso real que la incumpla.'
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
