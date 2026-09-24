import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {runRuleEngine} from '../src/modules/editorial-video/visuals/rules-engine.js';
import {
  auditMontageRuleCoverage,
  loadMontageChecks,
  loadMontageRules
} from '../src/modules/montage-studio/rules/index.js';

const ROOT = path.resolve(import.meta.dirname, '..');
const FIXTURES = path.join(ROOT, 'tests', 'fixtures', 'montage-rules');

test('toda regla de montaje tiene id, ambito, severidad, seccion y motivo', async () => {
  const ruleSet = await loadMontageRules();
  const seen = new Set();
  for (const rule of ruleSet.rules) {
    assert.match(rule.id, /^MO-R-\d{3}$/, `id invalido: ${rule.id}`);
    assert.ok(!seen.has(rule.id), `id duplicado: ${rule.id}`);
    seen.add(rule.id);
    assert.ok(['catalog', 'channel'].includes(rule.scope), `${rule.id}: ambito invalido`);
    assert.ok(['error', 'warning', 'review'].includes(rule.severity), `${rule.id}: severidad invalida`);
    assert.ok(rule.statement?.length > 10, `${rule.id}: enunciado vacio`);
    assert.ok(rule.rationale?.length > 10, `${rule.id}: sin motivo registrado`);
    assert.ok(ruleSet.sections.some((section) => section.id === rule.section), `${rule.id}: seccion desconocida`);
  }
});

test('ninguna regla de montaje declara un validador inexistente', async () => {
  const audit = await auditMontageRuleCoverage();
  assert.deepEqual(audit.missingCheck, []);
  assert.equal(audit.coverageRatio, 1);
});

test('cada fixture de montaje sigue disparando su regla', async () => {
  await loadMontageChecks();
  const ruleSet = await loadMontageRules();
  const files = new Set(await readdir(FIXTURES));
  for (const rule of ruleSet.rules) {
    assert.equal(rule.fixture, `tests/fixtures/montage-rules/${rule.id}.json`, `${rule.id}: fixture mal declarado`);
    assert.ok(files.has(`${rule.id}.json`), `${rule.id}: falta el fixture`);
    const fixture = JSON.parse(await readFile(path.join(FIXTURES, `${rule.id}.json`), 'utf8'));
    assert.equal(fixture.check, rule.check, `${rule.id}: el fixture apunta a otro validador`);
    const {results} = runRuleEngine({rules: [rule]}, fixture.context);
    assert.ok(results[0].issues.length > 0, `${rule.id} (${rule.check}): el fixture ya no dispara la regla`);
  }
});
