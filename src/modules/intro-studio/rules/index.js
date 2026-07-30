import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuleSet} from '../../video-studio/rule-set.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const INTRO_RULES_FILE = path.join(HERE, 'intro-rules.json');
export const INTRO_CHECKS_DIR = new URL('./checks/', import.meta.url);

/**
 * Reglas del montaje de intro.
 *
 * El contexto que reciben los validadores es `intro-build.json`: escenas con layout,
 * cues con rectangulo y profundidad ya resueltos, efectos con su distancia al beat
 * mas cercano, el rectangulo de la cara del sujeto, la rejilla de beats y el
 * presupuesto del perfil activo (`budget`).
 *
 * Los validadores de ambito `catalog` —el arte oscuro sobre alfa, el fondo negro
 * solido, el cue en silencio— viven en `video-studio/checks/` y son los mismos que
 * ejecuta la superficie de shorts.
 */
const introRules = createRuleSet({
  rulesFile: INTRO_RULES_FILE,
  checksDir: INTRO_CHECKS_DIR
});

export {formatIssue} from '../../video-studio/rule-set.js';

export const loadIntroRules = introRules.loadRules;
export const loadIntroChecks = introRules.loadChecks;
export const runIntroRules = introRules.run;
export const auditIntroRuleCoverage = introRules.auditCoverage;
