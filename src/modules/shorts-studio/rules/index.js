import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  auditRuleCoverage,
  loadCustomChecks,
  runRuleEngine
} from '../../editorial-video/visuals/rules-engine.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const SHORTS_RULES_FILE = path.join(HERE, 'shorts-rules.json');
export const SHORTS_CHECKS_DIR = new URL('./checks/', import.meta.url);

/**
 * Reglas del montaje vertical.
 *
 * Reutiliza el motor del canal editorial (`visuals/rules-engine.js`), que ya es
 * generico: registra los validadores de `rules/checks/` en el mismo catalogo
 * `CHECKS` y ejecuta el set con `runRuleEngine`. Lo unico propio de shorts es el
 * contexto, que es `short-build.json`: escenas, layouts, cues con slot y frames,
 * paginas de subtitulo y pista de sonido.
 */
export async function loadShortsRules({file = SHORTS_RULES_FILE} = {}) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function loadShortsChecks() {
  return loadCustomChecks({directory: SHORTS_CHECKS_DIR});
}

/** Ejecuta el set contra un `short-build.json` ya resuelto. */
export async function runShortsRules(build, {ruleSet = null, exceptions = []} = {}) {
  await loadShortsChecks();
  const rules = ruleSet ?? await loadShortsRules();
  return runRuleEngine(rules, {...build, exceptions});
}

export async function auditShortsRuleCoverage() {
  await loadShortsChecks();
  return auditRuleCoverage(await loadShortsRules());
}

/** Linea legible de una incidencia, para el log del build. */
export function formatIssue(issue) {
  const where = [issue.sceneId, issue.cueId].filter(Boolean).join(' / ');
  return `${issue.ruleId}${where ? ` [${where}]` : ''}: ${issue.message}`;
}
