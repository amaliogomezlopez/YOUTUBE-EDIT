import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRuleSet} from '../../video-studio/rule-set.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const MONTAGE_RULES_FILE = path.join(HERE, 'montage-rules.json');
export const MONTAGE_CHECKS_DIR = new URL('./checks/', import.meta.url);

/**
 * Reglas del montaje viral.
 *
 * El contexto que reciben los validadores es el build de un formato: `beats` con
 * visual, camara, transicion y overlays ya resueltos en frames, `captions`,
 * `geometry` del formato y el `budget` del perfil activo. Para los validadores de
 * catalogo (`cue-not-silent`) el build se expone ademas como `scenes`, con los
 * overlays de cada beat como `cues`.
 */
const montageRules = createRuleSet({rulesFile: MONTAGE_RULES_FILE, checksDir: MONTAGE_CHECKS_DIR});

export {formatIssue} from '../../video-studio/rule-set.js';

export const loadMontageRules = montageRules.loadRules;
export const loadMontageChecks = montageRules.loadChecks;
export const auditMontageRuleCoverage = montageRules.auditCoverage;

/** Contexto de reglas de un build: los beats tambien como escenas con cues. */
export function montageRuleContext(build) {
  return {...build, scenes: (build.beats ?? []).map((beat) => ({id: beat.id, cues: beat.overlays ?? []}))};
}

export function runMontageRules(build, options) {
  return montageRules.run(montageRuleContext(build), options);
}
