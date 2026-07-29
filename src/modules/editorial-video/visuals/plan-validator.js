/**
 * Validación completa del plan de episodio.
 *
 * ANM-A07 — Un único punto de entrada que ejecuta contratos, densidad, sonido,
 * variedad y reglas de canal antes de bundlear. Cero degradaciones silenciosas:
 * cada incidencia nombra escena, cue, causa y regla.
 */
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadPatternRegistry} from './pattern-registry.js';
import {validateEventDensity, assignActs} from './event-timeline.js';
import {
  DEFAULT_SOUND_POLICY,
  planEpisodeSound,
  validateSoundVariety
} from './sound-director.js';
import {planSceneVariety, validateVariety} from './variety-planner.js';
import {loadCustomChecks, runRuleEngine} from './rules-engine.js';
import {loadEntityRegistry} from './entity-resolver.js';

/**
 * Adapta un `visual-plan.json` (o un plan ya normalizado) a la forma que
 * consumen los validadores.
 */
export function normalizePlanScenes(plan) {
  return (plan.scenes ?? []).map((scene) => {
    const props = scene.props ?? {};
    const cues = scene.cues ?? props.semanticCues ?? [];
    return {
      id: scene.id,
      componentKey: scene.componentKey ?? props.kind ?? scene.kind,
      patternId: scene.patternId,
      startSeconds: scene.startSeconds,
      endSeconds: scene.endSeconds,
      wordRange: scene.wordRange,
      act: scene.act ?? props.act,
      intent: scene.intent ?? props.intent,
      geometry: scene.geometry,
      emphasis: scene.emphasis,
      varietyReasons: scene.varietyReasons ?? [],
      headline: scene.header?.text ?? props.headline,
      sourceLabel: scene.sourceLabel ?? props.sourceLabel,
      effectIds: scene.effectIds ?? [],
      focusTargets: scene.focusTargets ?? props.focusTargets ?? [],
      visualIntent: scene.visualIntent,
      assets: props.assets ?? scene.assets ?? [],
      layoutBoxes: scene.layoutBoxes ?? props.layoutBoxes ?? [],
      connectors: scene.connectors ?? props.connectors ?? [],
      fillerEvents: scene.fillerEvents ?? props.fillerEvents ?? [],
      assetActivations: scene.assetActivations ?? [],
      cues: cues.map((cue) => ({
        ...cue,
        absoluteSeconds: cue.absoluteSeconds ?? scene.startSeconds + (cue.atSeconds ?? 0)
      })),
      props
    };
  });
}

export async function loadSoundCatalog({root = process.cwd()} = {}) {
  return JSON.parse(await readFile(
    path.join(root, 'remotion-animations', 'catalog', 'sound', 'sfx.json'),
    'utf8'
  ));
}

export async function loadRuleSet(channelId, {root = process.cwd()} = {}) {
  return JSON.parse(await readFile(
    path.join(root, 'channels', channelId, 'brand', 'editing-rules.json'),
    'utf8'
  ));
}

/** Excepciones aprobadas por el canal. Ausencia de fichero = sin excepciones. */
export async function loadRuleExceptions(channelId, {root = process.cwd()} = {}) {
  try {
    const payload = JSON.parse(await readFile(
      path.join(root, 'channels', channelId, 'brand', 'rule-exceptions.json'),
      'utf8'
    ));
    return payload.exceptions ?? [];
  } catch {
    return [];
  }
}

/**
 * @returns {{ok: boolean, issues: object[], reports: object, summary: object}}
 */
export async function validateEpisodePlan({
  plan,
  words = [],
  channelId = 'finance-cavaliers',
  root = process.cwd(),
  coverage = [],
  artifacts = null,
  soundPolicy = {},
  registry: providedRegistry,
  soundCatalog: providedCatalog,
  ruleSet: providedRuleSet,
  entityRegistry: providedEntities,
  exceptions: providedExceptions
}) {
  const [registry, soundCatalog, ruleSet, entities, exceptions] = await Promise.all([
    providedRegistry ?? loadPatternRegistry(),
    providedCatalog ?? loadSoundCatalog({root}),
    providedRuleSet ?? loadRuleSet(channelId, {root}),
    providedEntities ?? loadEntityRegistry(channelId, {root}).catch(() => null),
    providedExceptions ?? loadRuleExceptions(channelId, {root})
  ]);
  await loadCustomChecks();

  const durationSeconds = plan.audioDurationSeconds ??
    plan.durationSeconds ??
    (plan.scenes ?? []).at(-1)?.endSeconds ?? 0;

  let scenes = normalizePlanScenes(plan);
  scenes = assignActs(scenes, {durationSeconds});
  const legacyAliases = soundCatalog?.legacyAliases ?? {};
  scenes = planSceneVariety(scenes, {registry, legacyAliases});

  const issues = [];

  // Contrato de targets (ANM-A04).
  for (const scene of scenes) {
    issues.push(...registry.validateSceneTargets(scene));
  }

  // Densidad y ritmo (ANM-C02).
  const density = validateEventDensity(scenes, {durationSeconds});
  issues.push(...density.issues);

  // Sonido (ANM-D10).
  const sound = planEpisodeSound({
    episodeId: plan.episodeId ?? 'episode-sin-id',
    scenes,
    catalog: soundCatalog,
    policy: soundPolicy,
    narrationWords: words
  });
  issues.push(...sound.issues);
  issues.push(...validateSoundVariety(
    sound.report,
    {...DEFAULT_SOUND_POLICY, ...soundPolicy},
    {scenes: sound.scenes}
  ));

  // Variedad (ANM-H02).
  const variety = validateVariety(scenes, {legacyAliases});
  issues.push(...variety.issues);

  // Assets locales (ANM-G05).
  const assetReport = entities ? await entities.verifyLocalAssets({
    publicRoot: path.join(root, 'remotion-animations', 'public')
  }) : {declared: [], missing: []};

  // Reglas de canal (ANM-I03): consumen todo lo anterior.
  const context = {
    plan,
    scenes,
    words,
    coverage,
    issues,
    sound,
    soundCatalog,
    registry,
    entities,
    assets: assetReport,
    artifacts,
    exceptions
  };
  const rules = runRuleEngine(ruleSet, context);

  const allIssues = rules.issues;
  const errors = allIssues.filter((issue) => issue.severity === 'error');
  return {
    ok: errors.length === 0,
    issues: allIssues,
    rawIssues: issues,
    reports: {
      density: density.report,
      sound: sound.report,
      variety: variety.report,
      rules: rules.results,
      assets: assetReport,
      soundPlan: {scenes: sound.scenes, bedTrack: sound.bedTrack, ducking: sound.ducking}
    },
    summary: {
      ...rules.summary,
      scenes: scenes.length,
      durationSeconds,
      cues: scenes.reduce((total, scene) => total + (scene.cues?.length ?? 0), 0)
    },
    scenes
  };
}

/** Texto listo para consola: la salida que ve un agente cuando algo falla. */
export function formatValidationReport(result) {
  const lines = [];
  const {summary} = result;
  lines.push(
    `Escenas: ${summary.scenes} · cues: ${summary.cues} · duración: ` +
    `${Math.round(summary.durationSeconds)} s`
  );
  lines.push(
    `Reglas: ${summary.passed}/${summary.total} pasan · ${summary.failed} fallan · ` +
    `${summary.manual} manuales` +
    (summary.skipped ? ` · ${summary.skipped} no evaluables` : '')
  );
  lines.push(
    `Incidencias: ${summary.errors} error · ${summary.warnings} warning · ` +
    `${summary.reviews} review` +
    (summary.waived ? ` · ${summary.waived} con excepción registrada` : '')
  );
  const bySeverity = {error: [], warning: [], review: []};
  for (const issue of result.issues) {
    (bySeverity[issue.severity] ?? bySeverity.review).push(issue);
  }
  for (const severity of ['error', 'warning']) {
    if (!bySeverity[severity].length) continue;
    lines.push('');
    lines.push(`— ${severity.toUpperCase()} —`);
    for (const issue of bySeverity[severity].slice(0, 40)) {
      const where = [issue.sceneId, issue.cueId].filter(Boolean).join('/');
      lines.push(`  [${issue.ruleId}] ${where ? `${where}: ` : ''}${issue.message}`);
    }
    if (bySeverity[severity].length > 40) {
      lines.push(`  … y ${bySeverity[severity].length - 40} más.`);
    }
  }
  const skipped = (result.reports?.rules ?? []).filter((rule) => rule.status === 'skipped');
  if (skipped.length) {
    lines.push('');
    lines.push('— NO EVALUABLE (falta contexto, no es incumplimiento) —');
    for (const rule of skipped) {
      lines.push(`  [${rule.ruleId}] ${rule.reason}`);
    }
  }
  return lines.join('\n');
}
