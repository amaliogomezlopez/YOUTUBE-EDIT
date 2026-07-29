import {normalizeWords} from './word-index.js';

/**
 * Dirección de sonido por familias, con memoria.
 *
 * ANM-D03 · ANM-D04 · ANM-D05 · ANM-D06 · ANM-D07 · ANM-D08 · ANM-D09 · ANM-D10
 *
 * El cue pide una **familia**; el director elige la variante concreta teniendo
 * en cuenta cooldown, uso acumulado y rotación sembrada, y le aplica jitter
 * determinista de tono y ganancia. Ninguna acción apila automáticamente un
 * whoosh: si un movimiento no merece sonido, se queda en silencio.
 */

export const DEFAULT_SOUND_POLICY = {
  cooldownSecondsFallback: 12,
  maxFileSharePercent: 12,
  minDistinctFiles: 24,
  minFamilies: 8,
  maxPerceptibleImpactsPer8s: 3,
  perceptibleFamilies: ['impact', 'break', 'confirm'],
  pitchJitter: 0.03,
  gainJitterDb: 1.5,
  riserLeadSeconds: 0.9,
  riserFamily: 'tension',
  resolutionFamily: 'reveal',
  resolutionDelaySeconds: 0.65,
  bedFamily: 'texture',
  bedVolume: 0.13,
  duckingDb: -5,
  duckAttackSeconds: 0.06,
  duckReleaseSeconds: 0.18,
  duckPadSeconds: 0.12
};

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (let position = 0; position < value.length; position += 1) {
    hash ^= value.charCodeAt(position);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** PRNG determinista: mismo episodio y mismo cue ⇒ mismo timbre siempre. */
function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let result = Math.imul(state ^ (state >>> 15), 1 | state);
    result = (result + Math.imul(result ^ (result >>> 7), 61 | result)) ^ result;
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function dbToGain(db) {
  return 10 ** (db / 20);
}

export function indexSoundCatalog(catalog) {
  const families = new Map();
  for (const family of catalog.families ?? []) {
    families.set(family.id, family);
  }
  const variants = new Map();
  for (const family of catalog.families ?? []) {
    for (const variant of family.variants ?? []) {
      variants.set(variant.id, {...variant, familyId: family.id});
    }
  }
  return {families, variants, aliases: catalog.legacyAliases ?? {}};
}

/** Traduce un alias histórico (`"alert-sting"`) a `{family, variantHint}`. */
export function resolveLegacyAlias(index, alias) {
  const entry = index.aliases?.[alias];
  if (!entry) return null;
  return {family: entry.family, variantHint: entry.variant};
}

/** Normaliza `cue.sound` a `{family, intensity, variantHint}`. */
export function normalizeCueSound(index, sound) {
  if (!sound) return null;
  if (typeof sound === 'string') {
    const alias = resolveLegacyAlias(index, sound);
    if (!alias) return {family: sound, intensity: 0.6, variantHint: null, unknownAlias: sound};
    return {...alias, intensity: 0.6};
  }
  return {
    family: sound.family,
    intensity: Number.isFinite(sound.intensity) ? sound.intensity : 0.6,
    variantHint: sound.variantHint ?? null
  };
}

class VariantSelector {
  constructor(index, policy, seed) {
    this.index = index;
    this.policy = policy;
    this.random = mulberry32(seed);
    this.lastUsedAt = new Map();
    this.usage = new Map();
    this.cursor = new Map();
    this.instances = [];
  }

  /** Rotación sembrada: el punto de partida por familia depende del episodio. */
  startCursor(familyId, size) {
    if (!this.cursor.has(familyId)) {
      this.cursor.set(familyId, Math.floor(this.random() * size));
    }
    return this.cursor.get(familyId);
  }

  select(familyId, absoluteSeconds, {variantHint} = {}) {
    const family = this.index.families.get(familyId);
    if (!family) return null;
    const variants = family.variants ?? [];
    if (!variants.length) return null;
    const cooldown = Number.isFinite(family.cooldownSeconds)
      ? family.cooldownSeconds
      : this.policy.cooldownSecondsFallback;

    // El hint es una preferencia, no un cerrojo. Los alias históricos apuntan
    // siempre a la misma variante, así que respetarlo incondicionalmente hacía
    // que un alias frecuente monopolizara su fichero (data-01: 6 usos mientras
    // data-02/04/05 seguían sin estrenar). Se honra mientras no se despegue del
    // reparto de la familia; si se despega, manda la rotación (ANM-D05).
    if (variantHint) {
      const hinted = variants.find((variant) => variant.id === variantHint);
      const lastUsed = this.lastUsedAt.get(variantHint);
      const cooldownOk = lastUsed === undefined || absoluteSeconds - lastUsed >= cooldown;
      const minUsage = Math.min(...variants.map((variant) => this.usage.get(variant.id) ?? 0));
      const balanced = (this.usage.get(variantHint) ?? 0) <= minUsage;
      if (hinted && cooldownOk && balanced) {
        return this.commit(hinted, familyId, absoluteSeconds, {cooldownRespected: true});
      }
    }

    const start = this.startCursor(familyId, variants.length);
    const rotated = variants.map((_, offset) => variants[(start + offset) % variants.length]);
    const available = rotated.filter((variant) => {
      const lastUsed = this.lastUsedAt.get(variant.id);
      return lastUsed === undefined || absoluteSeconds - lastUsed >= cooldown;
    });
    // Con cooldown satisfecho manda el uso acumulado (reparto plano). Si toda la
    // familia está en cooldown no hay elección buena, solo la menos mala: la
    // variante oída hace más tiempo. Ordenar por uso aquí reabriría un fichero
    // usado hace 7 s teniendo otro de hace 11,9 s (ANM-D05).
    const chosen = available.length
      ? available.reduce((best, variant) => {
        const bestUse = this.usage.get(best.id) ?? 0;
        const use = this.usage.get(variant.id) ?? 0;
        return use < bestUse ? variant : best;
      }, available[0])
      : rotated.reduce((best, variant) => {
        const bestLast = this.lastUsedAt.get(best.id) ?? -Infinity;
        const last = this.lastUsedAt.get(variant.id) ?? -Infinity;
        if (last !== bestLast) return last < bestLast ? variant : best;
        return (this.usage.get(variant.id) ?? 0) < (this.usage.get(best.id) ?? 0)
          ? variant
          : best;
      }, rotated[0]);
    return this.commit(chosen, familyId, absoluteSeconds, {
      cooldownRespected: available.length > 0
    });
  }

  commit(variant, familyId, absoluteSeconds, meta = {}) {
    this.lastUsedAt.set(variant.id, absoluteSeconds);
    this.usage.set(variant.id, (this.usage.get(variant.id) ?? 0) + 1);
    return {...variant, familyId, ...meta};
  }
}

/**
 * Construye la mezcla completa del episodio.
 *
 * @returns {{scenes: object[], bedTrack: object[], ducking: object[], report: object, issues: object[]}}
 */
export function planEpisodeSound({
  episodeId,
  scenes,
  catalog,
  policy: policyOverrides = {},
  narrationWords = []
}) {
  const policy = {...DEFAULT_SOUND_POLICY, ...policyOverrides};
  const index = indexSoundCatalog(catalog);
  const selector = new VariantSelector(index, policy, hashSeed(episodeId));
  const issues = [];
  const instances = [];

  const orderedScenes = [...scenes].sort((left, right) => left.startSeconds - right.startSeconds);
  const plannedScenes = [];

  for (const scene of orderedScenes) {
    const sceneCues = [];
    const orderedCues = [...(scene.cues ?? [])]
      .filter((cue) => cue.sound)
      .sort((left, right) => left.atSeconds - right.atSeconds);

    for (const cue of orderedCues) {
      const sound = normalizeCueSound(index, cue.sound);
      if (!sound) continue;
      if (sound.unknownAlias || !index.families.has(sound.family)) {
        issues.push({
          code: 'sound-family-unknown',
          severity: 'error',
          sceneId: scene.id,
          cueId: cue.id,
          message: `Familia sonora desconocida: «${sound.unknownAlias ?? sound.family}».`
        });
        continue;
      }
      const absoluteSeconds = Number(
        cue.absoluteSeconds ?? scene.startSeconds + cue.atSeconds
      );
      const variant = selector.select(sound.family, absoluteSeconds, {
        variantHint: sound.variantHint
      });
      if (!variant) {
        issues.push({
          code: 'sound-variant-missing',
          severity: 'error',
          sceneId: scene.id,
          cueId: cue.id,
          message: `La familia ${sound.family} no declara variantes utilizables.`
        });
        continue;
      }
      const random = mulberry32(hashSeed(`${episodeId}:${scene.id}:${cue.id}`));
      const playbackRate = round(1 + (random() * 2 - 1) * policy.pitchJitter, 4);
      const gainDb = round((random() * 2 - 1) * policy.gainJitterDb, 3);
      const intensity = Math.min(1.4, Math.max(0.2, sound.intensity));
      const volume = round(
        Math.min(1, variant.volume * intensity * dbToGain(gainDb) * 1.25), 4
      );
      const instance = {
        cueId: cue.id,
        sceneId: scene.id,
        family: variant.familyId,
        variantId: variant.id,
        file: variant.file,
        startSeconds: round(cue.atSeconds, 3),
        absoluteSeconds: round(absoluteSeconds, 3),
        durationSeconds: variant.durationSeconds,
        volume,
        playbackRate,
        gainDb,
        role: 'cue',
        cooldownRespected: variant.cooldownRespected !== false
      };
      sceneCues.push(instance);
      instances.push(instance);

      // ANM-D08 — Riser antes del giro detectado por la minería.
      if (cue.kind === 'turn' || cue.metaphor === 'burst') {
        const riserStart = Math.max(0, cue.atSeconds - policy.riserLeadSeconds);
        const riserVariant = selector.select(
          policy.riserFamily,
          absoluteSeconds - policy.riserLeadSeconds
        );
        if (riserVariant) {
          const riser = {
            cueId: `${cue.id}-riser`,
            sceneId: scene.id,
            family: riserVariant.familyId,
            variantId: riserVariant.id,
            file: riserVariant.file,
            startSeconds: round(riserStart, 3),
            absoluteSeconds: round(absoluteSeconds - policy.riserLeadSeconds, 3),
            durationSeconds: Math.min(
              riserVariant.durationSeconds,
              policy.riserLeadSeconds + 0.25
            ),
            volume: round(riserVariant.volume * 0.7, 4),
            playbackRate: 1,
            gainDb: 0,
            role: 'riser',
            cooldownRespected: true
          };
          sceneCues.push(riser);
          instances.push(riser);
        }
      }
    }

    // ANM-D08 — Resolución tras el clímax de la escena.
    const climax = sceneCues
      .filter((instance) => policy.perceptibleFamilies.includes(instance.family))
      .at(-1);
    if (climax) {
      const resolutionStart = climax.startSeconds + policy.resolutionDelaySeconds;
      const sceneDuration = scene.endSeconds - scene.startSeconds;
      if (resolutionStart < sceneDuration - 0.4) {
        const variant = selector.select(
          policy.resolutionFamily,
          scene.startSeconds + resolutionStart
        );
        if (variant) {
          const resolution = {
            cueId: `${climax.cueId}-resolution`,
            sceneId: scene.id,
            family: variant.familyId,
            variantId: variant.id,
            file: variant.file,
            startSeconds: round(resolutionStart, 3),
            absoluteSeconds: round(scene.startSeconds + resolutionStart, 3),
            durationSeconds: variant.durationSeconds,
            volume: round(variant.volume * 0.55, 4),
            playbackRate: 1,
            gainDb: 0,
            role: 'resolution',
            cooldownRespected: true
          };
          sceneCues.push(resolution);
          instances.push(resolution);
        }
      }
    }

    plannedScenes.push({
      sceneId: scene.id,
      act: scene.act ?? 'desarrollo',
      cues: sceneCues.sort((left, right) => left.startSeconds - right.startSeconds)
    });
  }

  const bedTrack = planBedTrack({orderedScenes, index, selector, policy});
  const ducking = planDucking(narrationWords, policy);
  const report = buildSoundReport({instances, bedTrack, policy});
  return {scenes: plannedScenes, bedTrack, ducking, report, issues, policy};
}

/** ANM-D07 — Lecho continuo por acto. El silencio pasa a ser una decisión. */
export function planBedTrack({orderedScenes, index, selector, policy}) {
  const acts = [];
  for (const scene of orderedScenes) {
    const act = scene.act ?? 'desarrollo';
    const current = acts.at(-1);
    if (current && current.act === act) {
      current.endSeconds = scene.endSeconds;
      continue;
    }
    acts.push({act, startSeconds: scene.startSeconds, endSeconds: scene.endSeconds});
  }
  const bedFamily = index.families.get(policy.bedFamily);
  if (!bedFamily) return [];
  return acts.map((segment, position) => {
    const variant = selector
      ? selector.select(policy.bedFamily, segment.startSeconds)
      : bedFamily.variants[position % bedFamily.variants.length];
    return {
      act: segment.act,
      startSeconds: round(segment.startSeconds, 3),
      endSeconds: round(segment.endSeconds, 3),
      file: variant.file,
      variantId: variant.id,
      volume: policy.bedVolume,
      loop: true,
      fadeSeconds: 1.2
    };
  });
}

/**
 * ANM-D09 — Ventanas de ducking derivadas de las palabras de la locución.
 * La capa SFX baja mientras se habla y se recupera en 180 ms.
 */
export function planDucking(words, policy = DEFAULT_SOUND_POLICY) {
  const windows = [];
  for (const word of normalizeWords(words)) {
    const start = Number(word.start) - policy.duckPadSeconds;
    const end = Number(word.end ?? word.start) + policy.duckPadSeconds;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    const previous = windows.at(-1);
    if (previous && start <= previous.endSeconds) {
      previous.endSeconds = Math.max(previous.endSeconds, end);
      continue;
    }
    windows.push({startSeconds: round(Math.max(0, start), 3), endSeconds: round(end, 3)});
  }
  return windows.map((window) => ({
    ...window,
    gainDb: policy.duckingDb,
    attackSeconds: policy.duckAttackSeconds,
    releaseSeconds: policy.duckReleaseSeconds
  }));
}

export function buildSoundReport({instances, bedTrack = [], policy = DEFAULT_SOUND_POLICY}) {
  const byFile = new Map();
  const byFamily = new Map();
  for (const instance of instances) {
    byFile.set(instance.file, (byFile.get(instance.file) ?? 0) + 1);
    byFamily.set(instance.family, (byFamily.get(instance.family) ?? 0) + 1);
  }
  const total = instances.length || 1;
  const files = [...byFile.entries()]
    .map(([file, count]) => ({
      file,
      count,
      sharePercent: round((count / total) * 100, 2)
    }))
    .sort((left, right) => right.count - left.count);
  const perceptible = instances
    .filter((instance) => policy.perceptibleFamilies.includes(instance.family))
    .sort((left, right) => left.absoluteSeconds - right.absoluteSeconds);
  let maxImpactsPer8s = 0;
  for (let position = 0; position < perceptible.length; position += 1) {
    const windowEnd = perceptible[position].absoluteSeconds + 8;
    const count = perceptible.filter(
      (instance) =>
        instance.absoluteSeconds >= perceptible[position].absoluteSeconds &&
        instance.absoluteSeconds < windowEnd
    ).length;
    maxImpactsPer8s = Math.max(maxImpactsPer8s, count);
  }
  return {
    totalInstances: instances.length,
    distinctFiles: byFile.size,
    distinctFamilies: byFamily.size,
    maxFileSharePercent: files[0]?.sharePercent ?? 0,
    maxPerceptibleImpactsPer8s: maxImpactsPer8s,
    bedSegments: bedTrack.length,
    files,
    families: [...byFamily.entries()]
      .map(([family, count]) => ({family, count}))
      .sort((left, right) => right.count - left.count)
  };
}

/** ANM-D10 — El validador que impide que la monotonía vuelva por la puerta de atrás. */
export function validateSoundVariety(report, policy = DEFAULT_SOUND_POLICY, {scenes = []} = {}) {
  const issues = [];
  if (report.maxFileSharePercent > policy.maxFileSharePercent) {
    const worst = report.files[0];
    issues.push({
      code: 'sound-file-share',
      severity: 'error',
      message: `${worst.file} concentra el ${worst.sharePercent} % de las ` +
        `instancias (máximo ${policy.maxFileSharePercent} %).`
    });
  }
  if (report.distinctFamilies < policy.minFamilies) {
    issues.push({
      code: 'sound-family-count',
      severity: 'error',
      message: `Solo se usan ${report.distinctFamilies} familias sonoras ` +
        `(mínimo ${policy.minFamilies}).`
    });
  }
  if (report.distinctFiles < policy.minDistinctFiles) {
    issues.push({
      code: 'sound-distinct-files',
      severity: 'warning',
      message: `Solo se usan ${report.distinctFiles} ficheros distintos ` +
        `(objetivo ${policy.minDistinctFiles}).`
    });
  }
  if (report.maxPerceptibleImpactsPer8s > policy.maxPerceptibleImpactsPer8s) {
    issues.push({
      code: 'sound-impact-density',
      severity: 'error',
      message: `Hay ${report.maxPerceptibleImpactsPer8s} impactos perceptibles ` +
        `en 8 s (máximo ${policy.maxPerceptibleImpactsPer8s}).`
    });
  }
  // Tres escenas consecutivas con la misma secuencia de familias = tic.
  const signatures = scenes.map((scene) =>
    scene.cues.map((instance) => instance.family).join('>')
  );
  for (let position = 2; position < signatures.length; position += 1) {
    const signature = signatures[position];
    if (
      signature &&
      signature === signatures[position - 1] &&
      signature === signatures[position - 2]
    ) {
      issues.push({
        code: 'sound-family-sequence',
        severity: 'warning',
        sceneId: scenes[position].sceneId,
        message: `Tres escenas seguidas repiten la secuencia de familias «${signature}».`
      });
    }
  }
  return issues;
}
