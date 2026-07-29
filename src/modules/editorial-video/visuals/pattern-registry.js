/**
 * Puente catálogo → render y contrato de targets.
 *
 * ANM-A04 · ANM-E01 · ANM-E05 — El plan elige `patternId`; el registro dice qué
 * componente lo pinta y qué objetos son enfocables. Un `cue.target` que no
 * pertenece al patrón deja de ser un zoom a ninguna parte: es un error de build.
 */
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'
);
const BINDINGS_FILE = path.join(
  ROOT, 'remotion-animations', 'catalog', 'animations', 'pattern-bindings.json'
);
const PATTERNS_FILE = path.join(
  ROOT, 'remotion-animations', 'catalog', 'animations', 'patterns.json'
);

/** `2026-05-28/2026-06-26` — intervalo verificable, no un id de objeto. */
export const RANGE_TARGET_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function isRangeTarget(target) {
  return RANGE_TARGET_PATTERN.test(String(target ?? ''));
}

export async function loadPatternRegistry({
  bindingsFile = BINDINGS_FILE,
  patternsFile = PATTERNS_FILE
} = {}) {
  const [bindings, patterns] = await Promise.all([
    readFile(bindingsFile, 'utf8').then(JSON.parse),
    readFile(patternsFile, 'utf8').then(JSON.parse).catch(() => ({patterns: []}))
  ]);
  return createPatternRegistry(bindings, patterns);
}

export function createPatternRegistry(bindings, patterns = {patterns: []}) {
  const byComponentKey = new Map(
    (bindings.bindings ?? []).map((binding) => [binding.componentKey, binding])
  );
  const byPatternId = new Map();
  for (const binding of bindings.bindings ?? []) {
    const list = byPatternId.get(binding.patternId) ?? [];
    list.push(binding);
    byPatternId.set(binding.patternId, list);
  }
  const catalogPatternIds = new Set(
    (patterns.patterns ?? []).map((pattern) => pattern.id)
  );

  return {
    bindings,
    byComponentKey,
    byPatternId,
    catalogPatternIds,

    get(componentKey) {
      return byComponentKey.get(componentKey) ?? null;
    },

    patternIdFor(componentKey) {
      return byComponentKey.get(componentKey)?.patternId ?? null;
    },

    focusTargets(componentKey) {
      return byComponentKey.get(componentKey)?.focusTargets ?? [];
    },

    /** ¿El patrón elegido existe realmente en el catálogo? */
    knowsPattern(patternId) {
      return catalogPatternIds.size === 0 || catalogPatternIds.has(patternId);
    },

    /**
     * ANM-B01 — Da destino a un cue minado según su tipo de mención.
     * Un cue sin target no puede entrar en el plan.
     */
    bindCueTargets(componentKey, cues) {
      const binding = byComponentKey.get(componentKey);
      if (!binding) return {cues, issues: [{
        code: 'pattern-binding-missing',
        severity: 'error',
        message: `No hay binding declarado para «${componentKey}».`
      }]};
      const issues = [];
      const bound = cues.map((cue) => {
        if (cue.target) return cue;
        const target = binding.defaultTargets?.[cue.kind] ?? binding.focusTargets[0];
        if (!target) {
          issues.push({
            code: 'cue-target-unresolved',
            severity: 'error',
            cueId: cue.id,
            message: `El patrón ${binding.patternId} no declara destino para «${cue.kind}».`
          });
          return cue;
        }
        return {...cue, target, targetSource: 'binding-default'};
      });
      return {cues: bound, issues};
    },

    /** ANM-A04 — Validación dura de `cue.target ∈ focusTargets`. */
    validateSceneTargets(scene) {
      const componentKey = scene.componentKey ?? scene.kind ?? scene.props?.kind;
      const binding = byComponentKey.get(componentKey);
      const issues = [];
      if (!binding) {
        issues.push({
          code: 'pattern-binding-missing',
          severity: 'error',
          sceneId: scene.id,
          message: `«${componentKey}» no está en pattern-bindings.json: el render ` +
            'no puede resolver el patrón ni sus targets.'
        });
        return issues;
      }
      if (!this.knowsPattern(binding.patternId)) {
        issues.push({
          code: 'pattern-unknown',
          severity: 'error',
          sceneId: scene.id,
          message: `El patrón ${binding.patternId} no existe en patterns.json.`
        });
      }
      const declared = new Set([
        ...binding.focusTargets,
        ...(scene.focusTargets ?? [])
      ]);
      for (const cue of scene.cues ?? scene.props?.semanticCues ?? []) {
        if (!cue.target) {
          issues.push({
            code: 'cue-target-missing',
            severity: 'error',
            sceneId: scene.id,
            cueId: cue.id,
            message: 'El cue no declara target.'
          });
          continue;
        }
        if (declared.has(cue.target)) continue;
        if (isRangeTarget(cue.target)) {
          const effects = scene.effectIds ?? [];
          if (!effects.includes('focus.divergence-range')) {
            issues.push({
              code: 'range-target-without-divergence-effect',
              severity: 'warning',
              sceneId: scene.id,
              cueId: cue.id,
              message: `El target «${cue.target}» es un intervalo narrado y la ` +
                'escena no declara `focus.divergence-range` (playbook §20).'
            });
          }
          continue;
        }
        issues.push({
          code: 'cue-target-unknown',
          severity: 'error',
          sceneId: scene.id,
          cueId: cue.id,
          message: `«${cue.target}» no pertenece a los focusTargets de ` +
            `${binding.patternId}: ${[...declared].join(', ')}.`
        });
      }
      return issues;
    }
  };
}
