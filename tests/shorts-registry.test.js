import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {
  REGISTRY_FILE,
  compositionIdForSlug,
  discoverShortProjects,
  renderRegistrySource
} from '../src/modules/shorts-studio/registry.js';

test('el id de composicion conserva los conectores en minuscula', () => {
  assert.equal(compositionIdForSlug('harness-vs-modelo'), 'Short-Harness-vs-Modelo');
  assert.equal(compositionIdForSlug('coste-de-tokens'), 'Short-Coste-de-Tokens');
  assert.equal(compositionIdForSlug('demo'), 'Short-Demo');
});

test('el registro importa cada build y expone su id', () => {
  const source = renderRegistrySource([
    {slug: 'harness-vs-modelo', id: 'Short-Harness-vs-Modelo'},
    {slug: 'otro-corte', id: 'Short-Otro-Corte'}
  ]);
  assert.match(source, /import harnessVsModeloBuild from "\.\.\/\.\.\/projects\/shorts-harness-vs-modelo\/short-build\.json";/);
  assert.match(source, /import otroCorteBuild from "\.\.\/\.\.\/projects\/shorts-otro-corte\/short-build\.json";/);
  assert.match(source, /id: "Short-Otro-Corte"/);
  assert.ok(source.startsWith('// GENERADO'), 'el fichero avisa de que es generado');
});

test('el registro no lista proyectos sin compilar', async () => {
  const projects = await discoverShortProjects();
  assert.ok(projects.length >= 1);
  for (const project of projects) {
    assert.match(project.buildFile, /short-build\.json$/);
  }
  assert.deepEqual(
    projects.map((project) => project.slug),
    [...projects.map((project) => project.slug)].sort(),
    'el orden es estable para que el fichero generado no cambie sin motivo'
  );
});

/**
 * El registro lo importa el bundler, asi que un glob en tiempo de ejecucion no
 * serviria. Si alguien anade un proyecto y no ejecuta `shorts:build`, este test
 * lo caza antes de que el estudio muestre una lista incompleta.
 */
test('registry.generated.ts esta sincronizado con los proyectos compilados', async () => {
  const current = await readFile(REGISTRY_FILE, 'utf8');
  const expected = renderRegistrySource(await discoverShortProjects());
  assert.equal(
    current.trim(),
    expected.trim(),
    'ejecuta `npm run shorts:build -- --slug <slug>` para regenerar el registro'
  );
});
