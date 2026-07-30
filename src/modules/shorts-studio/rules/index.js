import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuleSet} from '../../video-studio/rule-set.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const SHORTS_RULES_FILE = path.join(HERE, 'shorts-rules.json');
export const SHORTS_CHECKS_DIR = new URL('./checks/', import.meta.url);

/**
 * Reglas del montaje vertical.
 *
 * El contexto que reciben los validadores es `short-build.json`: escenas, layouts,
 * cues con slot y frames, paginas de subtitulo y pista de sonido. Los validadores
 * de ambito `catalog` (los que miden el arte de un asset, por ejemplo) viven en
 * `video-studio/checks/` y los comparte con la superficie de intros.
 */
const shortsRules = createRuleSet({
  rulesFile: SHORTS_RULES_FILE,
  checksDir: SHORTS_CHECKS_DIR
});

export {formatIssue} from '../../video-studio/rule-set.js';

export const loadShortsRules = shortsRules.loadRules;
export const loadShortsChecks = shortsRules.loadChecks;
export const runShortsRules = shortsRules.run;
export const auditShortsRuleCoverage = shortsRules.auditCoverage;
