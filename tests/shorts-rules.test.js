import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {CHECKS, runRuleEngine} from '../src/modules/editorial-video/visuals/rules-engine.js';
import {
  auditShortsRuleCoverage,
  loadShortsChecks,
  loadShortsRules,
  runShortsRules
} from '../src/modules/shorts-studio/rules/index.js';
import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {renderPlaybook} from '../scripts/render-editing-playbook.js';
import {PLAYBOOK_OPTIONS} from '../scripts/shorts-playbook.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'shorts-rules');
const PLAYBOOK = path.join(ROOT, 'docs', 'shorts-playbook.md');

test('toda regla de shorts tiene id, ambito, severidad y validador', async () => {
  const ruleSet = await loadShortsRules();
  const seen = new Set();
  for (const rule of ruleSet.rules) {
    assert.match(rule.id, /^SH-R-\d{3}$/, `id invalido: ${rule.id}`);
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

test('ninguna regla de shorts declara un validador inexistente', async () => {
  const audit = await auditShortsRuleCoverage();
  assert.deepEqual(audit.missingCheck, []);
  assert.equal(audit.coverageRatio, 1);
});

test('el catalogo de checks cubre los ids declarados en las reglas de shorts', async () => {
  await loadShortsChecks();
  const ruleSet = await loadShortsRules();
  for (const rule of ruleSet.rules) {
    if (rule.check === 'manual') continue;
    assert.equal(typeof CHECKS[rule.check], 'function', `falta el validador ${rule.check}`);
  }
});

test('cada regla automatica declara su fixture y el fichero existe', async () => {
  const ruleSet = await loadShortsRules();
  const files = new Set(await readdir(FIXTURES));
  for (const rule of ruleSet.rules) {
    if (rule.check === 'manual') continue;
    assert.equal(
      rule.fixture,
      `tests/fixtures/shorts-rules/${rule.id}.json`,
      `${rule.id}: fixture mal declarado`
    );
    assert.ok(files.has(`${rule.id}.json`), `${rule.id}: falta el fixture`);
  }
});

/**
 * Fixture de regresion por regla: un montaje minimo que la incumple. Si alguien
 * relaja un validador, el fixture deja de fallar y este test lo caza.
 */
test('cada fixture de shorts sigue disparando su regla', async () => {
  await loadShortsChecks();
  const ruleSet = await loadShortsRules();
  const files = (await readdir(FIXTURES)).filter((name) => name.endsWith('.json'));
  assert.ok(files.length >= 8, 'se esperan fixtures para todas las reglas automaticas');
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

/**
 * Un validador recien generado por `shorts:feedback` devuelve una incidencia TODO
 * hasta que alguien lo implementa. Se aisla en su propio test para que la regla
 * pendiente no ensucie el resto del informe.
 */
test('ningun validador de shorts se ha quedado en TODO', async () => {
  await loadShortsChecks();
  const ruleSet = await loadShortsRules();
  const pending = pendingRules(ruleSet);
  assert.deepEqual(
    pending.map((rule) => `${rule.id} (${rule.check})`),
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

test('el fixture de una regla no dispara las demas', async () => {
  await loadShortsChecks();
  const ruleSet = await loadShortsRules();
  const pending = new Set(pendingRules(ruleSet).map((rule) => rule.id));
  const files = (await readdir(FIXTURES)).filter((name) => name.endsWith('.json'));
  for (const file of files) {
    const fixture = JSON.parse(await readFile(path.join(FIXTURES, file), 'utf8'));
    if (pending.has(fixture.ruleId)) continue;
    const others = ruleSet.rules.filter(
      (rule) => rule.id !== fixture.ruleId && !pending.has(rule.id)
    );
    const {issues} = runRuleEngine({rules: others}, fixture.context);
    assert.deepEqual(
      issues.map((issue) => issue.ruleId),
      [],
      `${fixture.ruleId}: su contexto incumple tambien otras reglas, ` +
      'asi no se sabe cual esta validando el test'
    );
  }
});

test('el short de referencia pasa todas las reglas', async () => {
  const build = JSON.parse(
    await readFile(path.join(projectDir('harness-vs-modelo'), 'short-build.json'), 'utf8')
  );
  const ruleSet = await loadShortsRules();
  const pending = new Set(pendingRules(ruleSet).map((rule) => rule.id));
  const {summary, issues} = await runShortsRules(build, {
    ruleSet: {...ruleSet, rules: ruleSet.rules.filter((rule) => !pending.has(rule.id))}
  });
  assert.deepEqual(
    issues.map((issue) => `${issue.ruleId}: ${issue.message}`),
    [],
    'harness-vs-modelo es el proyecto de referencia: no puede incumplir el contrato'
  );
  assert.equal(summary.failed, 0);
  assert.equal(summary.skipped, 2, 'las reglas adaptativas sin budget ni geometria se declaran no evaluables');
});

test('el playbook de shorts esta generado desde el JSON', async () => {
  const ruleSet = await loadShortsRules();
  await loadShortsChecks();
  const current = await readFile(PLAYBOOK, 'utf8');
  assert.equal(
    current.trim(),
    renderPlaybook(ruleSet, PLAYBOOK_OPTIONS).trim(),
    'ejecuta `npm run shorts:playbook` tras editar shorts-rules.json'
  );
});
