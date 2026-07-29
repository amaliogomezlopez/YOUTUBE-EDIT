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
const ROUTES_FILE = path.join(
  ROOT, 'remotion-animations', 'catalog', 'animations', 'pattern-routes.json'
);

/** `2026-05-28/2026-06-26` — intervalo verificable, no un id de objeto. */
export const RANGE_TARGET_PATTERN = /^[^/\s]+\/[^/\s]+$/;

export function isRangeTarget(target) {
  return RANGE_TARGET_PATTERN.test(String(target ?? ''));
}

export async function loadPatternRegistry({
  bindingsFile = BINDINGS_FILE,
  patternsFile = PATTERNS_FILE,
  routesFile = ROUTES_FILE
} = {}) {
  const [bindings, patterns, routes] = await Promise.all([
    readFile(bindingsFile, 'utf8').then(JSON.parse),
    readFile(patternsFile, 'utf8').then(JSON.parse).catch(() => ({patterns: []})),
    readFile(routesFile, 'utf8').then(JSON.parse).catch(() => null)
  ]);
  return createPatternRegistry(bindings, patterns, routes);
}

export function createPatternRegistry(
  bindings,
  patterns = {patterns: []},
  routes = null
) {
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
  const catalogPatternStatus = new Map(
    (patterns.patterns ?? []).map((pattern) => [pattern.id, pattern.status])
  );

  // ANM-E03 — El render resuelve por `patternId`; los `kind` de `kindFallback`
  // todavía no. Mientras dure la migración conviven dos formas dominantes en
  // pantalla y hay que medir la que de verdad se pinta en cada caso.
  const compositionByPattern = new Map(
    (patterns.patterns ?? [])
      .filter((pattern) => pattern.status === 'ready' && pattern.implementation?.compositionId)
      .map((pattern) => [pattern.id, pattern.implementation.compositionId])
  );
  const routedCompositions = new Set(routes?.routed ?? []);
  const geometryByComposition = new Map(
    Object.entries(routes?.geometryByComposition ?? {})
  );
  const fallbackKinds = new Set(
    (routes?.kindFallback ?? []).map((entry) => entry.kind)
  );

  return {
    bindings,
    byComponentKey,
    byPatternId,
    catalogPatternIds,
    fallbackKinds,

    /** ¿El render pinta esta escena por patrón o sigue en el camino por kind? */
    rendersByPattern(componentKey, patternId) {
      if (fallbackKinds.has(componentKey)) return false;
      const compositionId = compositionByPattern.get(patternId);
      return Boolean(compositionId && routedCompositions.has(compositionId));
    },

    /**
     * Forma dominante en pantalla (ANM-H02). Para una escena ya enrutada por
     * patrón, la del patrón; para una que sigue en el camino heredado, la del
     * binding. Medir la del binding en una escena enrutada sería contar la
     * geometría de un componente que no se está pintando.
     */
    geometryFor(componentKey, patternId) {
      if (this.rendersByPattern(componentKey, patternId)) {
        const compositionId = compositionByPattern.get(patternId);
        const geometry = geometryByComposition.get(compositionId);
        if (geometry) return geometry;
      }
      return byComponentKey.get(componentKey)?.geometry ?? null;
    },

    get(componentKey) {
      return byComponentKey.get(componentKey) ?? null;
    },

    patternIdFor(componentKey) {
      return byComponentKey.get(componentKey)?.patternId ?? null;
    },

    /**
     * ANM-H05 — Patrones admisibles para un componentKey: el preferente primero
     * y después los alternativos declarados. Es el conjunto entre el que puede
     * elegir el selector de ventana deslizante; nada fuera de aquí es legítimo.
     */
    patternCandidatesFor(componentKey) {
      const binding = byComponentKey.get(componentKey);
      if (!binding) return [];
      return [...new Set([binding.patternId, ...(binding.patternCandidates ?? [])])];
    },

    focusTargets(componentKey) {
      return byComponentKey.get(componentKey)?.focusTargets ?? [];
    },

    /** ¿El patrón elegido existe realmente en el catálogo? */
    knowsPattern(patternId) {
      return catalogPatternIds.size === 0 || catalogPatternIds.has(patternId);
    },

    /** `ready` | `primitive` | `planned` | null si el catálogo no lo declara. */
    patternStatus(patternId) {
      return catalogPatternStatus.get(patternId) ?? null;
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
      // La escena puede haberse apartado del preferente por variedad
      // (ANM-H05). Lo que se valida es el patrón que realmente lleva puesto y
      // que pertenezca al conjunto declarado por el binding: un patternId
      // inventado a mano no es diversidad, es una escena fuera de contrato.
      const candidates = this.patternCandidatesFor(componentKey);
      const patternId = scene.patternId ?? binding.patternId;
      if (!this.knowsPattern(patternId)) {
        issues.push({
          code: 'pattern-unknown',
          severity: 'error',
          sceneId: scene.id,
          message: `El patrón ${patternId} no existe en patterns.json.`
        });
      } else if (!candidates.includes(patternId)) {
        issues.push({
          code: 'pattern-not-a-candidate',
          severity: 'error',
          sceneId: scene.id,
          message: `El patrón ${patternId} no está declarado para «${componentKey}»: ` +
            `el binding admite ${candidates.join(', ')}. Amplía patternCandidates ` +
            'en pattern-bindings.json en vez de escribir el patrón en la escena.'
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
