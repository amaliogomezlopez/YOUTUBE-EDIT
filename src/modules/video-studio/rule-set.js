import {readFile} from 'node:fs/promises';
import {
  auditRuleCoverage,
  loadCustomChecks,
  runRuleEngine
} from '../editorial-video/visuals/rules-engine.js';

/**
 * Conjunto de reglas de una superficie de montaje.
 *
 * El motor (`editorial-video/visuals/rules-engine.js`) ya es generico: registra
 * validadores en el catalogo `CHECKS` y ejecuta un set contra un contexto. Lo que
 * aporta este modulo es el reparto por ambito:
 *
 * - `video-studio/checks/`: validadores de ambito `catalog`, comunes a todas las
 *   superficies. Aqui aterriza una regla cuando se comprueba que no dependia del
 *   formato (la politica de promocion que declara cada set de reglas).
 * - `<surface>/rules/checks/`: validadores propios de la superficie.
 *
 * Los dos directorios se cargan siempre, en ese orden, de modo que una superficie
 * puede especializar un validador comun redeclarando su id.
 */
export const CATALOG_CHECKS_DIR = new URL('./checks/', import.meta.url);

export function createRuleSet({rulesFile, checksDir}) {
  const loadRules = async ({file = rulesFile} = {}) =>
    JSON.parse(await readFile(file, 'utf8'));

  const loadChecks = async () => {
    const catalog = await loadCustomChecks({directory: CATALOG_CHECKS_DIR});
    const own = await loadCustomChecks({directory: checksDir});
    return [...catalog, ...own];
  };

  return {
    rulesFile,
    checksDir,
    loadRules,
    loadChecks,
    /** Ejecuta el set contra un build ya resuelto. */
    async run(build, {ruleSet = null, exceptions = []} = {}) {
      await loadChecks();
      const rules = ruleSet ?? await loadRules();
      return runRuleEngine(rules, {...build, exceptions});
    },
    async auditCoverage() {
      await loadChecks();
      return auditRuleCoverage(await loadRules());
    }
  };
}

/** Linea legible de una incidencia, para el log del build. */
export function formatIssue(issue) {
  const where = [issue.sceneId, issue.cueId].filter(Boolean).join(' / ');
  return `${issue.ruleId}${where ? ` [${where}]` : ''}: ${issue.message}`;
}
