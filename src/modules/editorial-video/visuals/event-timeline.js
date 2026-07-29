/**
 * Timeline unificado de eventos, densidad y ritmo.
 *
 * ANM-C01 · ANM-C02 · ANM-C03 · ANM-C04 · ANM-C05
 *
 * «No mantener el mismo estado focal más de 1,5 s» deja de ser prosa: se mide.
 * Un hueco sin nada que mire el espectador es un fallo de build, salvo que esté
 * declarado como respiración (`intent: "breath"`).
 */

export const RHYTHM_PROFILES = {
  hook: {maxGapSeconds: 1.4, warnGapSeconds: 1.1, minEventsPerMinute: 42},
  desarrollo: {maxGapSeconds: 2.0, warnGapSeconds: 1.6, minEventsPerMinute: 30},
  giro: {maxGapSeconds: 1.5, warnGapSeconds: 1.2, minEventsPerMinute: 38},
  cierre: {maxGapSeconds: 2.4, warnGapSeconds: 1.9, minEventsPerMinute: 24}
};

export const DEFAULT_DENSITY_POLICY = {
  maxGapSeconds: 2.0,
  warnGapSeconds: 1.6,
  secondaryChangeAfterSeconds: 4,
  focusHoldMaxSeconds: 1.5,
  breathMaxSeconds: 3.5
};

const PHASE_FRACTIONS = [
  {phase: 'entry', at: 0},
  {phase: 'build', at: 0.18},
  {phase: 'focus', at: 0.42},
  {phase: 'hold', at: 0.7},
  {phase: 'exit', at: 0.92}
];

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * ANM-C01 — Un único array ordenado con todo lo que cambia en pantalla:
 * cues, entradas de escena, fases del patrón y activaciones de asset.
 */
export function buildEventTimeline(scenes, {includePhases = true} = {}) {
  const events = [];
  for (const scene of scenes) {
    const duration = Math.max(0.1, scene.endSeconds - scene.startSeconds);
    events.push({
      atSeconds: round(scene.startSeconds),
      sceneId: scene.id,
      type: 'scene-enter',
      weight: 1,
      label: scene.headline ?? scene.id
    });
    if (includePhases) {
      for (const {phase, at} of PHASE_FRACTIONS) {
        if (at === 0) continue;
        events.push({
          atSeconds: round(scene.startSeconds + duration * at),
          sceneId: scene.id,
          type: 'pattern-phase',
          phase,
          weight: phase === 'hold' ? 0.4 : 0.7
        });
      }
    }
    for (const cue of scene.cues ?? []) {
      events.push({
        atSeconds: round(scene.startSeconds + cue.atSeconds),
        sceneId: scene.id,
        type: 'cue',
        cueId: cue.id,
        action: cue.action,
        target: cue.target,
        kind: cue.kind,
        weight: 1
      });
    }
    for (const asset of scene.assetActivations ?? []) {
      events.push({
        atSeconds: round(scene.startSeconds + Number(asset.atSeconds ?? 0)),
        sceneId: scene.id,
        type: 'asset-activation',
        assetId: asset.id,
        weight: 0.8
      });
    }
    for (const filler of scene.fillerEvents ?? []) {
      events.push({
        atSeconds: round(scene.startSeconds + Number(filler.atSeconds ?? 0)),
        sceneId: scene.id,
        type: 'filler',
        function: filler.function,
        weight: 0.5
      });
    }
  }
  return events.sort((left, right) => left.atSeconds - right.atSeconds);
}

/** Huecos entre eventos con peso ≥ `minWeight`: lo que el espectador percibe. */
export function findGaps(events, {startSeconds = 0, endSeconds, minWeight = 0.5} = {}) {
  const visible = events
    .filter((event) => (event.weight ?? 1) >= minWeight)
    .sort((left, right) => left.atSeconds - right.atSeconds);
  const gaps = [];
  let cursor = startSeconds;
  for (const event of visible) {
    if (event.atSeconds - cursor > 0) {
      gaps.push({
        startSeconds: round(cursor),
        endSeconds: round(event.atSeconds),
        durationSeconds: round(event.atSeconds - cursor),
        beforeSceneId: event.sceneId
      });
    }
    cursor = Math.max(cursor, event.atSeconds);
  }
  if (Number.isFinite(endSeconds) && endSeconds > cursor) {
    gaps.push({
      startSeconds: round(cursor),
      endSeconds: round(endSeconds),
      durationSeconds: round(endSeconds - cursor),
      beforeSceneId: null
    });
  }
  return gaps;
}

/**
 * ANM-C03 — Relleno **con función**. Nunca movimiento decorativo puro: cada
 * evento generado declara para qué está y sobre qué objeto actúa.
 */
export function generateFillerEvents(scene, {
  policy = DEFAULT_DENSITY_POLICY,
  actProfiles = RHYTHM_PROFILES
} = {}) {
  const duration = scene.endSeconds - scene.startSeconds;
  // El hueco admisible depende del acto: el hook aprieta, el cierre respira.
  const profile = actProfiles[scene.act ?? 'desarrollo'] ?? actProfiles.desarrollo;
  const maxGapSeconds = Math.min(policy.maxGapSeconds, profile.maxGapSeconds);
  const functions = [
    {function: 'cursor-advance', requires: ['line', 'lanes']},
    {function: 'axis-reveal', requires: ['line', 'bars', 'lanes']},
    {function: 'incremental-count', requires: ['metric-card', 'bars', 'grid']},
    {function: 'glow-breath', requires: ['radial', 'node-graph', 'logo-row', 'sphere']},
    {function: 'purposeful-parallax', requires: ['facade', 'timeline', 'layered-plane', 'typography']}
  ];
  const eligible = functions.filter(
    (item) => !scene.geometry || item.requires.includes(scene.geometry)
  );
  const pool = eligible.length ? eligible : functions;
  const cueTimes = (scene.cues ?? []).map((cue) => cue.atSeconds).sort((a, b) => a - b);
  const anchors = [0, ...cueTimes, duration];
  const fillers = [];
  for (let position = 0; position < anchors.length - 1; position += 1) {
    const gap = anchors[position + 1] - anchors[position];
    if (gap <= maxGapSeconds) continue;
    const slots = Math.ceil(gap / (maxGapSeconds * 0.8)) - 1;
    for (let slot = 1; slot <= slots; slot += 1) {
      const atSeconds = round(anchors[position] + (gap * slot) / (slots + 1));
      if (atSeconds >= duration - 0.2) continue;
      const choice = pool[(fillers.length + position) % pool.length];
      fillers.push({
        atSeconds,
        function: choice.function,
        target: scene.focusTargets?.[fillers.length % Math.max(1, scene.focusTargets.length)] ?? null,
        reason: `Hueco de ${round(gap)} s sin cambio visible.`
      });
    }
  }
  return fillers;
}

/**
 * ANM-C02 — Validador de densidad de evento.
 * @returns {{issues: object[], report: object}}
 */
export function validateEventDensity(scenes, {
  durationSeconds,
  policy: policyOverrides = {},
  actProfiles = RHYTHM_PROFILES
} = {}) {
  const policy = {...DEFAULT_DENSITY_POLICY, ...policyOverrides};
  const events = buildEventTimeline(scenes);
  const issues = [];

  const declaredBreaths = scenes
    .filter((scene) => scene.intent === 'breath')
    .map((scene) => ({
      startSeconds: scene.startSeconds,
      endSeconds: scene.endSeconds
    }));
  const insideBreath = (gap) => declaredBreaths.some(
    (breath) =>
      gap.startSeconds >= breath.startSeconds - 0.05 &&
      gap.endSeconds <= breath.endSeconds + 0.05
  );

  const gaps = findGaps(events, {startSeconds: 0, endSeconds: durationSeconds});
  for (const gap of gaps) {
    const scene = scenes.find(
      (candidate) =>
        gap.startSeconds >= candidate.startSeconds &&
        gap.startSeconds < candidate.endSeconds
    );
    const profile = actProfiles[scene?.act ?? 'desarrollo'] ?? actProfiles.desarrollo;
    const maxGap = Math.min(policy.maxGapSeconds, profile.maxGapSeconds);
    const warnGap = Math.min(policy.warnGapSeconds, profile.warnGapSeconds);
    if (insideBreath(gap)) {
      if (gap.durationSeconds > policy.breathMaxSeconds) {
        issues.push({
          code: 'breath-too-long',
          severity: 'error',
          sceneId: scene?.id ?? null,
          message: `La respiración declarada dura ${gap.durationSeconds} s ` +
            `(máximo ${policy.breathMaxSeconds} s).`
        });
      }
      continue;
    }
    if (gap.durationSeconds > maxGap) {
      issues.push({
        code: 'event-gap-max',
        severity: 'error',
        sceneId: scene?.id ?? null,
        message: `Hueco de ${gap.durationSeconds} s sin evento visible entre ` +
          `${gap.startSeconds} s y ${gap.endSeconds} s (máximo ${maxGap} s en ` +
          `acto «${scene?.act ?? 'desarrollo'}»). Declara \`intent: "breath"\` ` +
          'o añade un evento con función.'
      });
    } else if (gap.durationSeconds > warnGap) {
      issues.push({
        code: 'event-gap-warn',
        severity: 'warning',
        sceneId: scene?.id ?? null,
        message: `Hueco de ${gap.durationSeconds} s (aviso a partir de ${warnGap} s).`
      });
    }
  }

  for (const scene of scenes) {
    const duration = scene.endSeconds - scene.startSeconds;
    // La entrada de escena es el cambio primario; solo cuentan como secundarios
    // los cues, los rellenos con función y las activaciones de asset.
    const secondaryChanges = events.filter(
      (event) => event.sceneId === scene.id &&
        ['cue', 'filler', 'asset-activation'].includes(event.type)
    );
    if (duration > policy.secondaryChangeAfterSeconds && secondaryChanges.length < 2) {
      issues.push({
        code: 'scene-secondary-change',
        severity: 'error',
        sceneId: scene.id,
        message: `La escena dura ${round(duration)} s y solo tiene ` +
          `${secondaryChanges.length} cambio(s) de información; ` +
          'a partir de 4 s exige al menos un cambio secundario (playbook §3).'
      });
    }
    const cueTimes = (scene.cues ?? []).map((cue) => cue.atSeconds).sort((a, b) => a - b);
    for (let position = 0; position < cueTimes.length - 1; position += 1) {
      const hold = cueTimes[position + 1] - cueTimes[position];
      if (hold > policy.focusHoldMaxSeconds * 2) {
        issues.push({
          code: 'focus-hold-max',
          severity: 'warning',
          sceneId: scene.id,
          message: `El estado focal se mantiene ${round(hold)} s sin cambio de ` +
            `información (guía: ${policy.focusHoldMaxSeconds} s).`
        });
      }
    }
  }

  const report = {
    totalEvents: events.length,
    eventsPerMinute: durationSeconds
      ? round((events.length / durationSeconds) * 60, 2)
      : 0,
    maxGapSeconds: gaps.reduce((max, gap) => Math.max(max, gap.durationSeconds), 0),
    gapsOverThreshold: gaps.filter(
      (gap) => gap.durationSeconds > policy.maxGapSeconds && !insideBreath(gap)
    ),
    byType: events.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] ?? 0) + 1;
      return counts;
    }, {}),
    byAct: scenes.reduce((counts, scene) => {
      const act = scene.act ?? 'desarrollo';
      counts[act] = (counts[act] ?? 0) + 1;
      return counts;
    }, {})
  };
  return {issues, report, events, gaps};
}

/** ANM-C04 — Acto por posición narrativa; ajusta la densidad objetivo. */
export function assignActs(scenes, {durationSeconds} = {}) {
  const total = durationSeconds ?? scenes.at(-1)?.endSeconds ?? 1;
  return scenes.map((scene) => {
    if (scene.act) return scene;
    const position = scene.startSeconds / total;
    const hasTurn = (scene.cues ?? []).some((cue) => cue.kind === 'turn');
    const act = position < 0.12
      ? 'hook'
      : position > 0.88
        ? 'cierre'
        : hasTurn
          ? 'giro'
          : 'desarrollo';
    return {...scene, act};
  });
}
