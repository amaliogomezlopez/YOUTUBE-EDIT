import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  CHECKS,
  auditRuleCoverage,
  loadCustomChecks,
  runRuleEngine
} from '../src/modules/editorial-video/visuals/rules-engine.js';
import {loadPatternRegistry} from '../src/modules/editorial-video/visuals/pattern-registry.js';
import {renderPlaybook} from '../scripts/render-editing-playbook.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHANNEL = 'finance-cavaliers';
const BRAND = path.join(ROOT, 'channels', CHANNEL, 'brand');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'editing-rules');

async function loadRuleSet() {
  return JSON.parse(await readFile(path.join(BRAND, 'editing-rules.json'), 'utf8'));
}

test('toda regla tiene id, ámbito, severidad y validador', async () => {
  const ruleSet = await loadRuleSet();
  const seen = new Set();
  for (const rule of ruleSet.rules) {
    assert.match(rule.id, /^FC-R-\d{3}$/, `id inválido: ${rule.id}`);
    assert.ok(!seen.has(rule.id), `id duplicado: ${rule.id}`);
    seen.add(rule.id);
    assert.ok(['catalog', 'channel'].includes(rule.scope), `${rule.id}: ámbito inválido`);
    assert.ok(['error', 'warning', 'review'].includes(rule.severity), `${rule.id}: severidad inválida`);
    assert.ok(rule.statement?.length > 10, `${rule.id}: enunciado vacío`);
    assert.ok(
      ruleSet.sections.some((section) => section.id === rule.section),
      `${rule.id}: sección desconocida «${rule.section}»`
    );
  }
});

test('ninguna regla declara un validador inexistente', async () => {
  await loadCustomChecks();
  const audit = auditRuleCoverage(await loadRuleSet());
  assert.deepEqual(audit.missingCheck, []);
  assert.equal(audit.coverageRatio, 1);
});

test('el playbook markdown está generado desde el JSON', async () => {
  const ruleSet = await loadRuleSet();
  const current = await readFile(path.join(BRAND, 'editing-playbook.md'), 'utf8');
  assert.equal(
    current.trim(),
    renderPlaybook(ruleSet).trim(),
    'ejecuta `npm run channel:playbook` tras editar editing-rules.json'
  );
});

test('las excepciones registradas declaran motivo', async () => {
  const payload = JSON.parse(
    await readFile(path.join(BRAND, 'rule-exceptions.json'), 'utf8')
  );
  const ruleSet = await loadRuleSet();
  for (const exception of payload.exceptions) {
    assert.ok(exception.reason?.length > 20, `${exception.ruleId}: motivo insuficiente`);
    assert.ok(
      ruleSet.rules.some((rule) => rule.id === exception.ruleId),
      `${exception.ruleId}: la excepción apunta a una regla inexistente`
    );
  }
});

/**
 * ANM-I05 — Fixture de regresión por regla: un plan mínimo que la incumple.
 * El test verifica que el motor la detecta. Si alguien relaja un validador, el
 * fixture deja de fallar y este test lo caza.
 */
test('cada fixture de regresión sigue disparando su regla', async () => {
  await loadCustomChecks();
  const ruleSet = await loadRuleSet();
  const registry = await loadPatternRegistry();
  const files = await readdir(FIXTURES);
  assert.ok(files.length >= 10, 'se esperan fixtures para las reglas automáticas');
  for (const file of files.filter((name) => name.endsWith('.json'))) {
    const fixture = JSON.parse(await readFile(path.join(FIXTURES, file), 'utf8'));
    const rule = ruleSet.rules.find((candidate) => candidate.id === fixture.ruleId);
    assert.ok(rule, `${fixture.ruleId}: la regla ya no existe`);
    const {results} = runRuleEngine(
      {rules: [rule]},
      {registry, ...fixture.context}
    );
    const [result] = results;
    assert.ok(
      result.issues.length > 0,
      `${fixture.ruleId} (${rule.check}): el fixture ya no dispara la regla`
    );
  }
});

test('un plan correcto no dispara reglas de layout ni de conectores', async () => {
  const ruleSet = await loadRuleSet();
  const registry = await loadPatternRegistry();
  const rules = ruleSet.rules.filter((rule) =>
    ['layout-no-overlap', 'connector-boundary-clipped'].includes(rule.check)
  );
  const {issues} = runRuleEngine({rules}, {
    registry,
    words: [],
    coverage: [],
    issues: [],
    scenes: [{
      id: 'scene-ok-001',
      componentKey: 'kinetic-text',
      startSeconds: 0,
      endSeconds: 4,
      cues: [],
      layoutBoxes: [
        {id: 'a', x: 0, y: 0, width: 100, height: 100},
        {id: 'b', x: 200, y: 0, width: 100, height: 100}
      ],
      connectors: [{id: 'c', endpoint: 'boundary', clipped: true}],
      assets: []
    }]
  });
  assert.deepEqual(issues, []);
});

test('el catálogo de checks cubre los ids declarados en las reglas', async () => {
  const ruleSet = await loadRuleSet();
  const declared = new Set(
    ruleSet.rules.map((rule) => rule.check).filter((check) => check !== 'manual')
  );
  for (const check of declared) {
    assert.equal(typeof CHECKS[check], 'function', `falta el validador ${check}`);
  }
});
