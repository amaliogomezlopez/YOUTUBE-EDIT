import assert from 'node:assert/strict';
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {pathToFileURL} from 'node:url';
import {CHECKS, runRuleEngine} from '../src/modules/editorial-video/visuals/rules-engine.js';
import {nextRuleId, recordFeedbackRule} from '../src/modules/video-studio/rule-intake.js';
import {
  auditIntroRuleCoverage,
  loadIntroChecks,
  loadIntroRules
} from '../src/modules/intro-studio/rules/index.js';
import {renderPlaybook} from '../scripts/render-editing-playbook.js';
import {PLAYBOOK_OPTIONS} from '../scripts/intro-playbook.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'intro-rules');
const PLAYBOOK = path.join(ROOT, 'docs', 'intro-playbook.md');

test('toda regla de intro tiene id, ambito, severidad y validador', async () => {
  const ruleSet = await loadIntroRules();
  const seen = new Set();
  for (const rule of ruleSet.rules) {
    assert.match(rule.id, /^IN-R-\d{3}$/, `id invalido: ${rule.id}`);
    assert.ok(!seen.has(rule.id), `id duplicado: ${rule.id}`);
    seen.add(rule.id);
    assert.ok(['catalog', 'channel'].includes(rule.scope), `${rule.id}: ambito invalido`);
    assert.ok(['error', 'warning', 'review'].includes(rule.severity), `${rule.id}: severidad invalida`);
    assert.ok(rule.statement?.length > 10, `${rule.id}: enunciado vacio`);
    assert.ok(rule.rationale?.length > 10, `${rule.id}: sin motivo registrado`);
    assert.ok(
      ruleSet.sections.some((section) => section.id === rule.section),
      `${rule.id}: seccion desconocida «${rule.section}»`
    );
  }
});

test('ninguna regla de intro declara un validador inexistente', async () => {
  const audit = await auditIntroRuleCoverage();
  assert.deepEqual(audit.missingCheck, []);
  assert.equal(audit.coverageRatio, 1);
});

test('cada regla automatica de intro declara su fixture y el fichero existe', async () => {
  const ruleSet = await loadIntroRules();
  const files = new Set(await readdir(FIXTURES));
  for (const rule of ruleSet.rules) {
    if (rule.check === 'manual') continue;
    assert.equal(
      rule.fixture,
      `tests/fixtures/intro-rules/${rule.id}.json`,
      `${rule.id}: fixture mal declarado`
    );
    assert.ok(files.has(`${rule.id}.json`), `${rule.id}: falta el fixture`);
  }
});

/**
 * Fixture de regresion por regla: un montaje minimo que la incumple. Si alguien
 * relaja un validador, el fixture deja de fallar y este test lo caza.
 */
test('cada fixture de intro sigue disparando su regla', async () => {
  await loadIntroChecks();
  const ruleSet = await loadIntroRules();
  const files = (await readdir(FIXTURES)).filter((name) => name.endsWith('.json'));
  assert.ok(files.length >= ruleSet.rules.length, 'falta algun fixture');
  for (const file of files) {
    const fixture = JSON.parse(await readFile(path.join(FIXTURES, file), 'utf8'));
    const rule = ruleSet.rules.find((candidate) => candidate.id === fixture.ruleId);
    assert.ok(rule, `${fixture.ruleId}: la regla ya no existe`);
    assert.equal(fixture.check, rule.check, `${fixture.ruleId}: el fixture apunta a otro validador`);
    assert.equal(fixture.expect, 'fail', `${fixture.ruleId}: el fixture debe incumplir la regla`);
    const {results} = runRuleEngine({rules: [rule]}, fixture.context);
    assert.ok(
      results[0].issues.length > 0,
      `${fixture.ruleId} (${rule.check}): el fixture ya no dispara la regla`
    );
  }
});

test('el catalogo de checks cubre los ids declarados en las reglas de intro', async () => {
  await loadIntroChecks();
  const ruleSet = await loadIntroRules();
  for (const rule of ruleSet.rules) {
    if (rule.check === 'manual') continue;
    assert.equal(typeof CHECKS[rule.check], 'function', `falta el validador ${rule.check}`);
  }
});

test('ningun validador de intro se ha quedado en TODO', async () => {
  await loadIntroChecks();
  const ruleSet = await loadIntroRules();
  assert.deepEqual(
    pendingRules(ruleSet).map((rule) => `${rule.id} (${rule.check})`),
    [],
    'implementa el `run` de estos validadores y su fixture'
  );
});

function pendingRules(ruleSet) {
  const empty = {format: {fps: 60}, scenes: [], soundCues: [], duckWindows: []};
  return ruleSet.rules.filter((rule) => {
    const {issues} = runRuleEngine({rules: [rule]}, empty);
    return issues.some((issue) => issue.todo);
  });
}

/**
 * Aislamiento: el contexto de un fixture solo puede incumplir su propia regla. Sin
 * esto un fixture que incumple tres reglas a la vez no demuestra que su validador
 * funcione, solo que alguna salta.
 */
test('el fixture de una regla de intro no dispara las demas', async () => {
  await loadIntroChecks();
  const ruleSet = await loadIntroRules();
  const files = (await readdir(FIXTURES)).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    const fixture = JSON.parse(await readFile(path.join(FIXTURES, file), 'utf8'));
    const others = ruleSet.rules.filter((rule) => rule.id !== fixture.ruleId);
    const {issues} = runRuleEngine({rules: others}, fixture.context);
    assert.deepEqual(
      issues.map((issue) => `${issue.ruleId}: ${issue.message}`),
      [],
      `${fixture.ruleId}: su contexto incumple tambien otras reglas, ` +
      'asi no se sabe cual esta validando el test'
    );
  }
});

/**
 * Las reglas de ritmo y duracion no llevan el umbral dentro: lo leen del `budget`
 * del perfil. Sin `budget` no pueden opinar, y decirlo como «no evaluable» en vez de
 * como incidencia es lo que permite que el mismo validador sirva a dos perfiles.
 */
test('las reglas de ritmo no opinan sin el presupuesto del perfil', async () => {
  await loadIntroChecks();
  const ruleSet = await loadIntroRules();
  const budgetRules = ruleSet.rules.filter((rule) => [
    'intro-effect-density-max',
    'intro-visual-change-cadence',
    'intro-duration-budget'
  ].includes(rule.check));
  assert.equal(budgetRules.length, 3, 'se esperan tres reglas gobernadas por el perfil');

  const context = {
    format: {width: 1920, height: 1080, fps: 60},
    durationInFrames: 60,
    durationSeconds: 1,
    scenes: [{id: 'sin-presupuesto', from: 0, durationInFrames: 60, cues: [], effects: [], captionPages: []}],
    soundCues: [],
    duckWindows: []
  };
  const {results} = runRuleEngine({rules: budgetRules}, context);
  assert.deepEqual(
    results.map((result) => result.status),
    ['skipped', 'skipped', 'skipped'],
    'sin budget estas reglas tienen que declararse no evaluables'
  );
});

/**
 * El intake es el mecanismo que convierte una correccion en regla, y es comun a las
 * tres superficies. Se prueba contra un descriptor de superficie temporal para no
 * ensuciar el contrato real, pero es el mismo codigo que ejecutan
 * `intro:feedback`, `shorts:feedback` y `channel:feedback`.
 */
test('el intake crea regla, validador en TODO y fixture de una vez', async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), 'rule-intake-'));
  try {
    const rulesFile = path.join(workspace, 'reglas.json');
    const checksDir = path.join(workspace, 'checks');
    const fixturesDir = path.join(workspace, 'fixtures');
    const logFile = path.join(workspace, 'feedback-log.jsonl');
    await mkdir(checksDir, {recursive: true});
    await writeFile(logFile, '', 'utf8');
    await writeFile(rulesFile, JSON.stringify({
      version: 1,
      sections: [{id: 'layers', number: 1, title: 'Capas'}],
      rules: []
    }), 'utf8');

    const surface = {
      rulesFile,
      checksDir,
      fixturesDir,
      fixturesRelativeDir: 'fixtures',
      logFile,
      idPrefix: 'IN-R',
      checkPrefix: 'intro-',
      defaultSection: 'layers',
      feedbackCommand: 'npm run intro:feedback',
      contextDoc: 'El contexto es `intro-build.json`.',
      loadRules: async () => JSON.parse(await readFile(rulesFile, 'utf8')),
      loadChecks: async () => [],
      fixtureContext: () => ({format: {fps: 60}, scenes: []})
    };

    const result = await recordFeedbackRule({
      surface,
      root: workspace,
      input: {note: 'el logo tapa mi cara', section: 'layers', severity: 'error'}
    });

    // El id nace en el bloque de decenas de su seccion: dice a que seccion pertenece.
    assert.equal(result.ruleId, 'IN-R-010');
    assert.equal(result.checkPending, true, 'un validador recien generado esta sin implementar');
    assert.equal(result.rule.severity, 'error');
    assert.equal(result.rule.origin.feedback, 'el logo tapa mi cara');
    assert.equal(result.rule.fixture, 'fixtures/IN-R-010.json');

    const stored = JSON.parse(await readFile(rulesFile, 'utf8'));
    assert.equal(stored.rules.length, 1);
    assert.equal(stored.rules[0].id, 'IN-R-010');

    const fixture = JSON.parse(await readFile(path.join(fixturesDir, 'IN-R-010.json'), 'utf8'));
    assert.equal(fixture.expect, 'fail', 'el fixture generado tiene que incumplir la regla');

    const logged = (await readFile(logFile, 'utf8')).trim().split('\n');
    assert.equal(logged.length, 1);
    assert.equal(JSON.parse(logged[0]).ruleId, 'IN-R-010');

    // El validador generado devuelve una incidencia `todo`: es lo que mantiene el
    // test de regresion rojo hasta que alguien lo implementa de verdad.
    const checkFile = path.join(checksDir, `${stored.rules[0].check}.js`);
    const {default: check} = await import(pathToFileURL(checkFile).href);
    assert.equal(check.id, stored.rules[0].check);
    const issues = check.run({scenes: []}, stored.rules[0]);
    assert.ok(issues.some((issue) => issue.todo), 'el esqueleto tiene que declararse TODO');

    // Una segunda regla de la misma seccion no reutiliza el id.
    assert.equal(nextRuleId(stored, 'layers', {prefix: 'IN-R'}), 'IN-R-011');
  } finally {
    await rm(workspace, {recursive: true, force: true});
  }
});

test('el playbook de intro esta generado desde el JSON', async () => {
  const ruleSet = await loadIntroRules();
  await loadIntroChecks();
  const current = await readFile(PLAYBOOK, 'utf8');
  assert.equal(
    current.trim(),
    renderPlaybook(ruleSet, PLAYBOOK_OPTIONS).trim(),
    'ejecuta `npm run intro:playbook` tras editar intro-rules.json'
  );
});
