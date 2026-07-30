import path from 'node:path';
import {readJson, round, writeJson} from '../../lib/utils.js';
import {
  BACKDROP_MOTIONS,
  CAMERAS,
  CUE_TYPES,
  DEPTHS,
  EFFECTS,
  EFFECT_SECONDS,
  INTRO_FORMAT,
  LAYOUTS,
  PRESENTATIONS,
  STRONG_EFFECTS,
  TRANSITIONS,
  projectDir
} from './constants.js';
import {BACK_SLOTS, faceRectOnScreen, scaledRect, slotIds, slotRect} from './geometry.js';
import {profileBudget, resolveIntroProfile} from './profiles.js';
import {analyzeArtwork} from '../video-studio/artwork.js';
import {buildCaptionPages} from '../video-studio/captions.js';
import {writeIntroRegistry} from './registry.js';
import {formatIssue, runIntroRules} from './rules/index.js';
import {
  DEFAULT_SILENCE_PADDING_SECONDS,
  edgeSilence,
  measureArtwork,
  resolveTrim,
  speechWindows
} from '../video-studio/timeline.js';
import {
  DEFAULT_CAMERA_SOUND,
  DEFAULT_CUE_SOUND,
  DEFAULT_EFFECT_SOUND,
  DEFAULT_TRANSITION_SOUND,
  createSoundRotation,
  resolveSoundCue
} from './sound.js';

/**
 * Compila `intro-plan.json` contra `manifest.json`, las transcripciones y la rejilla
 * de beats de la musica, y emite `intro-build.json`.
 *
 * Se diferencia del build del short en una cosa de fondo: alli el ancla canonica es
 * la palabra, porque el short explica algo mientras se habla. Aqui la referencia es
 * el **beat**, porque una intro se monta contra la musica: `atBeat` es un indice de
 * la rejilla global de la pieza, mientras que `atWord` sigue siendo un indice dentro
 * de la transcripcion de su clip. Los dos se resuelven a segundos relativos a la
 * escena, y el build guarda si cada golpe cayo en un beat para que la regla lo mida.
 */
export async function buildIntro({slug, log = () => {}}) {
  const project = projectDir(slug);
  const plan = await readJson(path.join(project, 'intro-plan.json'));
  const manifest = await readJson(path.join(project, 'manifest.json'));
  const format = {...INTRO_FORMAT, ...(plan.format ?? {})};
  const {fps} = format;
  const profile = resolveIntroProfile(plan.profileId);

  const clipsById = new Map(manifest.clips.map((clip) => [clip.id, clip]));
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const transcripts = new Map();
  for (const clip of manifest.clips) {
    if (!clip.transcript) continue;
    transcripts.set(clip.id, await readJson(path.join(project, clip.transcript)));
  }

  const warnings = [];
  const music = resolveMusic(plan, manifest, profile, warnings);
  const beats = music?.beatSeconds ?? [];

  const scenes = [];
  const soundCues = [];
  const duckWindows = [];
  const rotate = createSoundRotation();
  const padding = Number(plan.silencePaddingSeconds ?? DEFAULT_SILENCE_PADDING_SECONDS);
  const addSound = (familyId, atSeconds, intensity = 1) => {
    const cue = resolveSoundCue(familyId, atSeconds, intensity, rotate(familyId));
    soundCues.push(cue);
    return cue;
  };
  const artByAsset = await measureArtwork(manifest.assets, warnings, analyzeArtwork);
  let cursor = 0;

  for (const [index, scene] of (plan.scenes ?? []).entries()) {
    const where = `escena ${index + 1} (${scene.id ?? 'sin id'})`;
    const clip = clipsById.get(scene.clipId);
    if (!clip) throw new Error(`${where}: clipId "${scene.clipId}" no existe en manifest.json`);
    if (!LAYOUTS.has(scene.layout)) throw new Error(`${where}: layout "${scene.layout}" no valido (${[...LAYOUTS].join(', ')})`);
    const camera = scene.camera ?? 'static';
    if (!CAMERAS.has(camera)) throw new Error(`${where}: camera "${camera}" no valida (${[...CAMERAS].join(', ')})`);
    const transitionIn = scene.transitionIn ?? 'cut';
    if (!TRANSITIONS.has(transitionIn)) throw new Error(`${where}: transitionIn "${transitionIn}" no valida (${[...TRANSITIONS].join(', ')})`);

    const words = transcripts.get(clip.id)?.words ?? [];
    const trim = resolveTrim(scene.trim, clip, words, padding);
    const {startSeconds, endSeconds} = trim;
    if (endSeconds - startSeconds < 0.2) throw new Error(`${where}: recorte demasiado corto (${startSeconds}-${endSeconds})`);
    if (trim.trimmedSeconds > 0.05) {
      warnings.push(
        `${where}: recortados ${trim.trimmedSeconds}s de silencio ` +
        `(entrada ${trim.leadTrimmed}s, salida ${trim.tailTrimmed}s)`
      );
    }
    const sceneSeconds = endSeconds - startSeconds;
    const durationInFrames = Math.max(1, Math.round(sceneSeconds * fps));
    const sceneStartSeconds = cursor / fps;
    const anchor = {words, beats, sceneStartSeconds, sceneSeconds, trimStartSeconds: startSeconds};

    const focus = scene.focus ?? clip.focus;
    const faceRect = faceRectOnScreen({
      faceBox: clip.faceBox,
      clipWidth: clip.width,
      clipHeight: clip.height,
      focus,
      layout: scene.layout
    });

    const cues = (scene.cues ?? []).map((cue, cueIndex) => {
      const cueWhere = `${where} cue ${cueIndex + 1}`;
      if (!CUE_TYPES.has(cue.type)) throw new Error(`${cueWhere}: type "${cue.type}" no valido (${[...CUE_TYPES].join(', ')})`);
      if (cue.presentation && !PRESENTATIONS.has(cue.presentation)) {
        throw new Error(`${cueWhere}: presentation "${cue.presentation}" no valida (${[...PRESENTATIONS].join(', ')})`);
      }
      const slot = cue.slot ?? 'center';
      const baseRect = slotRect(slot);
      if (!baseRect) throw new Error(`${cueWhere}: slot "${slot}" no existe (${slotIds().join(', ')})`);
      // La profundidad la decide el slot salvo que el plan diga otra cosa: los slots
      // `back-*` y `orbit-*` existen para el arte que va detras del sujeto, y tener
      // que declararlo dos veces solo invita a contradecirse.
      const depth = cue.depth ?? (BACK_SLOTS.has(slot) ? 'back' : 'front');
      if (!DEPTHS.has(depth)) throw new Error(`${cueWhere}: depth "${depth}" no valida (${[...DEPTHS].join(', ')})`);
      // Los valores de fondo salen del perfil: es lo que hace que el mismo plan se
      // vea mas o menos agresivo cambiando `profileId`.
      const scale = Number(cue.scale ?? (depth === 'back' ? profile.backDepth.scale : 1));
      const blurPx = Number(cue.blurPx ?? (depth === 'back' ? profile.backDepth.blurPx : 0));

      const atSeconds = resolveAnchor(cue, anchor, cueWhere);
      const asset = cue.assetId ? assetsById.get(cue.assetId) : null;
      if (cue.assetId && !asset) throw new Error(`${cueWhere}: assetId "${cue.assetId}" no existe en manifest.json`);
      const holdSeconds = Number(cue.holdSeconds ?? sceneSeconds - atSeconds);
      const cueFrames = Math.max(1, Math.round(Math.min(holdSeconds, sceneSeconds - atSeconds) * fps));
      const soundFamily = cue.sound === false ? null : cue.sound ?? DEFAULT_CUE_SOUND[cue.type];
      const sound = soundFamily
        ? addSound(soundFamily, sceneStartSeconds + atSeconds, Number(cue.soundIntensity ?? 1))
        : null;

      return {
        id: cue.id ?? `${scene.id}-cue-${cueIndex + 1}`,
        type: cue.type,
        assetId: cue.assetId ?? null,
        src: asset?.file ?? null,
        slot,
        depth,
        presentation: cue.presentation ?? 'card',
        text: cue.text ?? null,
        note: cue.note ?? null,
        tone: cue.tone ?? 'neutral',
        scale: round(scale, 3),
        blurPx: round(blurPx, 2),
        rect: scaledRect(baseRect, scale),
        atBeat: Number.isInteger(cue.atBeat) ? cue.atBeat : null,
        atWord: Number.isInteger(cue.atWord) ? cue.atWord : null,
        atSeconds: round(atSeconds, 3),
        fromFrame: Math.round(atSeconds * fps),
        durationInFrames: cueFrames,
        dense: cue.dense !== false,
        sound: soundFamily ? {family: soundFamily, file: sound.file} : null,
        soundNote: cue.soundNote ?? null,
        art: cue.assetId ? artByAsset.get(cue.assetId) ?? null : null
      };
    }).sort((a, b) => a.fromFrame - b.fromFrame);

    const effects = (scene.effects ?? []).map((effect, effectIndex) => {
      const effectWhere = `${where} efecto ${effectIndex + 1}`;
      if (!EFFECTS.has(effect.id)) throw new Error(`${effectWhere}: efecto "${effect.id}" no valido (${[...EFFECTS].join(', ')})`);
      if (!profile.effectAllowlist.includes(effect.id)) {
        throw new Error(
          `${effectWhere}: el perfil "${profile.id}" no autoriza el efecto "${effect.id}" ` +
          `(permitidos: ${profile.effectAllowlist.join(', ')})`
        );
      }
      const atSeconds = resolveAnchor(effect, anchor, effectWhere);
      const seconds = Number(effect.holdSeconds ?? EFFECT_SECONDS[effect.id]);
      const effectFrames = Math.max(1, Math.round(Math.min(seconds, sceneSeconds - atSeconds) * fps));
      const absoluteSeconds = sceneStartSeconds + atSeconds;
      const beat = nearestBeat(beats, absoluteSeconds);
      const soundFamily = effect.sound === false ? null : effect.sound ?? DEFAULT_EFFECT_SOUND[effect.id];
      const sound = soundFamily
        ? addSound(soundFamily, absoluteSeconds, Number(effect.soundIntensity ?? effect.intensity ?? 1))
        : null;

      return {
        id: effect.cueId ?? `${scene.id}-fx-${effectIndex + 1}`,
        effect: effect.id,
        intensity: Number(effect.intensity ?? 1),
        strong: STRONG_EFFECTS.has(effect.id),
        atBeat: Number.isInteger(effect.atBeat) ? effect.atBeat : null,
        atSeconds: round(atSeconds, 3),
        absoluteSeconds: round(absoluteSeconds, 3),
        fromFrame: Math.round(atSeconds * fps),
        durationInFrames: effectFrames,
        beatDeltaSeconds: beat === null ? null : round(absoluteSeconds - beat, 3),
        offBeatNote: effect.offBeatNote ?? null,
        sound: soundFamily ? {family: soundFamily, file: sound.file} : null,
        soundNote: effect.soundNote ?? null
      };
    }).sort((a, b) => a.fromFrame - b.fromFrame);

    const captionsEnabled = scene.captions ?? profile.captionsByDefault;
    const captionPages = words.length && captionsEnabled
      ? buildCaptionPages(words, {startSeconds, endSeconds}, plan.captions ?? {}).map((page) => ({
        fromFrame: Math.round(page.startSeconds * fps),
        durationInFrames: Math.max(1, Math.round((page.endSeconds - page.startSeconds) * fps)),
        words: page.words.map((word) => ({
          text: word.text,
          fromFrame: Math.round(word.start * fps),
          toFrame: Math.round(word.end * fps)
        }))
      }))
      : [];

    duckWindows.push(...speechWindows(words, {startSeconds, endSeconds}, sceneStartSeconds, plan.sound?.duckGainDb));

    if (index > 0) {
      const transitionFamily = scene.transitionSound === false
        ? null
        : scene.transitionSound ?? DEFAULT_TRANSITION_SOUND[transitionIn];
      if (transitionFamily) addSound(transitionFamily, sceneStartSeconds, Number(scene.transitionSoundIntensity ?? 0.9));
    }
    const cameraFamily = scene.cameraSound === false
      ? null
      : scene.cameraSound ?? DEFAULT_CAMERA_SOUND[camera];
    if (cameraFamily) addSound(cameraFamily, sceneStartSeconds + 0.05, Number(scene.cameraSoundIntensity ?? 0.7));

    scenes.push({
      id: scene.id ?? `scene-${index + 1}`,
      clipId: clip.id,
      src: clip.file,
      from: cursor,
      durationInFrames,
      trimStartSeconds: round(startSeconds, 3),
      trimEndSeconds: round(endSeconds, 3),
      silenceTrimmedSeconds: trim.trimmedSeconds,
      ...edgeSilence(words, startSeconds, endSeconds),
      layout: scene.layout,
      camera,
      cameraIntensity: Number(scene.cameraIntensity ?? 1),
      focus,
      faceRect,
      transitionIn,
      label: scene.label ?? null,
      backdrop: resolveBackdrop(scene.backdrop, assetsById, profile, where),
      cues,
      effects,
      captionPages
    });
    cursor += durationInFrames;
  }

  if (!scenes.length) throw new Error('El plan no tiene escenas.');

  for (const ambience of plan.sound?.ambience ?? []) {
    addSound(ambience.family, Number(ambience.atSeconds ?? 0), Number(ambience.intensity ?? 1));
  }

  const durationSeconds = round(cursor / fps, 3);
  const titleCard = resolveTitleCard(plan.titleCard, {beats, durationSeconds, fps});

  const build = {
    slug,
    generatedAt: new Date().toISOString(),
    format,
    durationInFrames: cursor,
    durationSeconds,
    profileId: profile.id,
    themeId: plan.themeId ?? profile.themeId,
    accentColor: plan.accentColor ?? null,
    dangerColor: plan.dangerColor ?? null,
    titleCard,
    music,
    captionStyle: plan.captionStyle ?? {},
    silencePaddingSeconds: padding,
    soundEnabled: plan.sound?.enabled ?? true,
    soundMix: Number(plan.sound?.mix ?? profile.soundMix),
    clipVolume: Number(plan.sound?.clipVolume ?? profile.clipVolume),
    // Presupuesto del perfil: las reglas de ritmo miden contra esto y no contra una
    // constante, de modo que el perfil sobrio y el nervioso comparten validador.
    budget: profileBudget(profile),
    scenes,
    soundCues: soundCues.sort((a, b) => a.startSeconds - b.startSeconds),
    duckWindows,
    warnings
  };

  // Las reglas se ejecutan contra el build ya resuelto y antes de escribirlo: un
  // `error` no debe dejar un intro-build.json que Remotion pueda renderizar.
  const {issues, summary} = await runIntroRules(build, {exceptions: plan.ruleExceptions ?? []});
  build.rules = {summary, issues};
  const blocking = issues.filter((issue) => issue.severity === 'error');
  for (const issue of issues.filter((issue) => issue.severity !== 'error')) {
    warnings.push(formatIssue(issue));
  }
  if (blocking.length) {
    throw new Error(
      `El plan incumple ${blocking.length} regla(s) de montaje:\n` +
      blocking.map((issue) => `  - ${formatIssue(issue)}`).join('\n')
    );
  }

  await writeJson(path.join(project, 'intro-build.json'), build);
  const registered = await writeIntroRegistry();
  log(
    `build: ${scenes.length} escenas, ${durationSeconds}s, perfil ${profile.id}, ` +
    `${soundCues.length} cues de sonido`
  );
  log(
    `reglas: ${summary.passed}/${summary.total} pasan, ${summary.warnings} avisos, ` +
    `${summary.skipped} no evaluables`
  );
  log(`registro: ${registered.length} composiciones (${registered.map((entry) => entry.id).join(', ')})`);
  for (const warning of warnings) log(`  aviso: ${warning}`);
  return build;
}

/**
 * Musica de la pieza y su rejilla de beats.
 *
 * El plan puede fijar `bpm` y `offsetSeconds` a mano; entonces la rejilla se
 * recalcula aritmeticamente y el analisis de la ingesta se ignora. Es la salida para
 * musica sin percusion marcada, donde la estimacion automatica no acierta.
 */
function resolveMusic(plan, manifest, profile, warnings) {
  const declared = plan.music ?? null;
  const ingested = manifest.music ?? null;
  if (!declared && !ingested) return null;
  if (declared?.assetId && !ingested) {
    throw new Error(
      `El plan pide musica "${declared.assetId}" pero la ingesta no registro ninguna pista. ` +
      'Reingiere con --music <fichero>.'
    );
  }

  const bpm = Number(declared?.bpm ?? ingested.bpm);
  const offsetSeconds = Number(declared?.offsetSeconds ?? ingested.offsetSeconds);
  const overridden = Number.isFinite(declared?.bpm) || Number.isFinite(declared?.offsetSeconds);
  const beatSeconds = overridden
    ? beatGrid(bpm, offsetSeconds, ingested.durationSeconds)
    : ingested.beatSeconds;

  if (!overridden && Number.isFinite(ingested.confidence) && ingested.confidence < 1.5) {
    warnings.push(
      `la rejilla de beats de "${ingested.sourceName}" tiene confianza ${ingested.confidence}: ` +
      'la pista no tiene pulso claro. Fija `bpm` y `offsetSeconds` en el plan si los golpes no encajan.'
    );
  }

  return {
    file: ingested.file,
    bpm: round(bpm, 2),
    offsetSeconds: round(offsetSeconds, 3),
    beatSeconds,
    gainDb: Number(declared?.gainDb ?? profile.musicGainDb),
    confidence: overridden ? null : (ingested.confidence ?? null)
  };
}

function beatGrid(bpm, offsetSeconds, durationSeconds) {
  const period = 60 / bpm;
  const beats = [];
  for (let at = offsetSeconds; at < durationSeconds; at += period) {
    beats.push(round(at, 3));
  }
  return beats;
}

function nearestBeat(beats, atSeconds) {
  if (!beats?.length) return null;
  let best = beats[0];
  for (const beat of beats) {
    if (Math.abs(beat - atSeconds) < Math.abs(best - atSeconds)) best = beat;
  }
  return best;
}

/**
 * Anclaje de un cue o de un efecto, en segundos relativos al inicio de su escena.
 *
 * `atBeat` es un indice de la rejilla global de la pieza y `atWord` un indice dentro
 * de la transcripcion de su clip. Los dos son absolutos en su propio reloj, y el
 * build los traduce: si se reajusta el recorte de la escena, el golpe sigue cayendo
 * en el mismo beat o sobre la misma palabra.
 *
 * `atSeconds` solo se acepta cuando no hay ni musica ni transcripcion, para que no
 * se cuelen tiempos a mano que dejan de encajar al mover una escena.
 */
function resolveAnchor(entry, {words, beats, sceneStartSeconds, sceneSeconds, trimStartSeconds}, where) {
  const offset = Number(entry.offsetSeconds ?? 0);

  if (Number.isInteger(entry.atBeat)) {
    if (!beats.length) throw new Error(`${where}: usa atBeat pero la pieza no tiene musica analizada`);
    const beat = beats[entry.atBeat];
    if (beat === undefined) {
      throw new Error(`${where}: atBeat ${entry.atBeat} fuera de rango (${beats.length} beats)`);
    }
    const relative = beat - sceneStartSeconds + offset;
    if (relative < 0 || relative >= sceneSeconds) {
      throw new Error(
        `${where}: atBeat ${entry.atBeat} cae en ${round(beat, 3)}s, fuera de la escena ` +
        `(${round(sceneStartSeconds, 3)}-${round(sceneStartSeconds + sceneSeconds, 3)}s)`
      );
    }
    return relative;
  }

  if (Number.isInteger(entry.atWord)) {
    const word = words[entry.atWord];
    if (!word) throw new Error(`${where}: atWord ${entry.atWord} fuera de rango (${words.length} palabras)`);
    const relative = word.start - trimStartSeconds + offset;
    if (relative < 0) throw new Error(`${where}: atWord ${entry.atWord} cae antes del recorte de la escena`);
    return relative;
  }

  if (Number.isFinite(entry.atSeconds)) {
    if (beats.length) throw new Error(`${where}: usa atBeat en vez de atSeconds; la pieza tiene rejilla de beats`);
    if (words.length) throw new Error(`${where}: usa atWord en vez de atSeconds; el clip tiene transcripcion`);
    return Number(entry.atSeconds);
  }

  throw new Error(`${where}: falta atBeat o atWord`);
}

function resolveBackdrop(backdrop, assetsById, profile, where) {
  if (!backdrop) return null;
  const asset = assetsById.get(backdrop.assetId);
  if (!asset) throw new Error(`${where}: el fondo "${backdrop.assetId}" no existe en manifest.json`);
  const motion = backdrop.motion ?? 'slow-zoom';
  if (!BACKDROP_MOTIONS.has(motion)) {
    throw new Error(`${where}: motion de fondo "${motion}" no valido (${[...BACKDROP_MOTIONS].join(', ')})`);
  }
  return {
    src: asset.file,
    kind: asset.kind ?? 'image',
    motion,
    opacity: Number(backdrop.opacity ?? profile.backdropOpacity)
  };
}

function resolveTitleCard(titleCard, {beats, durationSeconds, fps}) {
  if (!titleCard?.text) return null;
  const atSeconds = Number.isInteger(titleCard.atBeat)
    ? beats[titleCard.atBeat]
    : Number(titleCard.atSeconds ?? 0);
  if (!Number.isFinite(atSeconds)) {
    throw new Error('titleCard: atBeat fuera de rango y sin atSeconds');
  }
  const holdSeconds = Number(titleCard.holdSeconds ?? Math.max(1.5, durationSeconds - atSeconds));
  return {
    text: titleCard.text,
    kicker: titleCard.kicker ?? null,
    atSeconds: round(atSeconds, 3),
    fromFrame: Math.round(atSeconds * fps),
    durationInFrames: Math.max(1, Math.round(Math.min(holdSeconds, durationSeconds - atSeconds) * fps))
  };
}
