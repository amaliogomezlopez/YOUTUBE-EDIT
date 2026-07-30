import path from 'node:path';
import {readJson, round, writeJson} from '../../lib/utils.js';
import {SHORT_FORMAT, projectDir} from './constants.js';
import {buildCaptionPages} from './captions.js';
import {writeShortsRegistry} from './registry.js';
import {analyzeArtwork} from './artwork.js';
import {formatIssue, runShortsRules} from './rules/index.js';
import {
  DEFAULT_CAMERA_SOUND,
  DEFAULT_CUE_SOUND,
  DEFAULT_TRANSITION_SOUND,
  createSoundRotation,
  resolveSoundCue
} from './sound.js';

/**
 * Aire que se deja antes de la primera palabra y despues de la ultima. Sin nada de
 * margen la voz entra cortada; con mas de medio segundo el clip se siente muerto.
 */
export const DEFAULT_SILENCE_PADDING_SECONDS = 0.5;

export const CUE_TYPES = new Set(['logo', 'screenshot', 'stat', 'chip', 'label', 'brand']);
export const LAYOUTS = new Set(['full', 'split', 'stage']);
export const CAMERAS = new Set(['static', 'punch-in', 'push-out', 'drift-left', 'drift-right']);
export const TRANSITIONS = new Set(['cut', 'fade', 'whip', 'slide-up', 'zoom-blur']);

/**
 * Compila `short-plan.json` (editorial, escrito a mano) contra `manifest.json` y
 * las transcripciones, y emite `short-build.json`: todo resuelto en frames, con
 * paginas de subtitulo, cues anclados y pista de sonido.
 *
 * Regla dura heredada del motor editorial: el indice de palabra manda. Un cue se
 * ancla con `atWord`; `atSeconds` es un derivado que se escribe en el build, no
 * en el plan.
 */
export async function buildShort({slug, log = () => {}}) {
  const project = projectDir(slug);
  const plan = await readJson(path.join(project, 'short-plan.json'));
  const manifest = await readJson(path.join(project, 'manifest.json'));
  const format = {...SHORT_FORMAT, ...(plan.format ?? {})};
  const {fps} = format;

  const clipsById = new Map(manifest.clips.map((clip) => [clip.id, clip]));
  const assetsById = new Map(manifest.assets.map((asset) => [asset.id, asset]));
  const transcripts = new Map();
  for (const clip of manifest.clips) {
    if (!clip.transcript) continue;
    transcripts.set(clip.id, await readJson(path.join(project, clip.transcript)));
  }

  const warnings = [];
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
  const artByAsset = await measureArtwork(manifest.assets, warnings);
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
    if (!words.length) warnings.push(`${where}: el clip ${clip.id} no tiene transcripcion; sin subtitulos ni anclaje por palabra`);

    const trim = resolveTrim(scene.trim, clip, words, padding);
    const {startSeconds, endSeconds} = trim;
    if (endSeconds - startSeconds < 0.2) throw new Error(`${where}: recorte demasiado corto (${startSeconds}-${endSeconds})`);
    if (trim.trimmedSeconds > 0.05) {
      warnings.push(
        `${where}: recortados ${trim.trimmedSeconds}s de silencio ` +
        `(entrada ${trim.leadTrimmed}s, salida ${trim.tailTrimmed}s)`
      );
    }
    const durationInFrames = Math.max(1, Math.round((endSeconds - startSeconds) * fps));

    const cues = (scene.cues ?? []).map((cue, cueIndex) => {
      const cueWhere = `${where} cue ${cueIndex + 1}`;
      if (!CUE_TYPES.has(cue.type)) throw new Error(`${cueWhere}: type "${cue.type}" no valido (${[...CUE_TYPES].join(', ')})`);
      if (cue.presentation && !['card', 'plate', 'plain', 'blend'].includes(cue.presentation)) {
        throw new Error(`${cueWhere}: presentation "${cue.presentation}" no valida (card, plate, plain, blend)`);
      }
      const atSeconds = resolveCueSeconds(cue, words, startSeconds, cueWhere);
      const asset = cue.assetId ? assetsById.get(cue.assetId) : null;
      if (cue.assetId && !asset) throw new Error(`${cueWhere}: assetId "${cue.assetId}" no existe en manifest.json`);
      const holdSeconds = Number(cue.holdSeconds ?? (endSeconds - startSeconds) - atSeconds);
      const cueFrames = Math.max(1, Math.round(Math.min(holdSeconds, endSeconds - startSeconds - atSeconds) * fps));
      // Todo cue suena. Si el plan no pide familia se usa la del tipo: un logo o
      // una captura que entra en silencio se percibe como un fallo de montaje.
      // `sound: false` es la forma explicita de dejarlo mudo.
      const soundFamily = cue.sound === false ? null : cue.sound ?? DEFAULT_CUE_SOUND[cue.type];
      const sound = soundFamily
        ? addSound(soundFamily, cursor / fps + atSeconds, Number(cue.soundIntensity ?? 1))
        : null;
      return {
        id: cue.id ?? `${scene.id}-cue-${cueIndex + 1}`,
        type: cue.type,
        assetId: cue.assetId ?? null,
        src: asset?.file ?? null,
        slot: cue.slot ?? null,
        presentation: cue.presentation ?? 'card',
        text: cue.text ?? null,
        note: cue.note ?? null,
        tone: cue.tone ?? 'neutral',
        atWord: Number.isInteger(cue.atWord) ? cue.atWord : null,
        atSeconds: round(atSeconds, 3),
        fromFrame: Math.round(atSeconds * fps),
        durationInFrames: cueFrames,
        // Campos que consumen las reglas: una captura sin texto se declara con
        // `dense: false`, el silencio deliberado con `soundNote`, y `art` son las
        // medidas del asset con las que se valida su presentacion.
        dense: cue.dense !== false,
        sound: soundFamily ? {family: soundFamily, file: sound.file} : null,
        soundNote: cue.soundNote ?? null,
        art: cue.assetId ? artByAsset.get(cue.assetId) ?? null : null
      };
    }).sort((a, b) => a.fromFrame - b.fromFrame);

    const captionPages = words.length && scene.captions !== false
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

    duckWindows.push(...speechWindows(words, {startSeconds, endSeconds}, cursor / fps, plan.sound?.duckGainDb));

    if (transitionIn !== 'cut' && index === 0) {
      warnings.push(`${where}: transitionIn "${transitionIn}" en la primera escena; el hook gana con corte seco`);
    }

    // Cada cambio de escena y cada movimiento de camara tiene su propio sonido, no
    // solo los cues: es lo que hace que el montaje suene continuo en vez de tener
    // golpes aislados sobre un fondo mudo.
    if (index > 0) {
      const transitionFamily = scene.transitionSound === false
        ? null
        : scene.transitionSound ?? DEFAULT_TRANSITION_SOUND[transitionIn];
      if (transitionFamily) addSound(transitionFamily, cursor / fps, Number(scene.transitionSoundIntensity ?? 0.9));
    }
    const cameraFamily = scene.cameraSound === false
      ? null
      : scene.cameraSound ?? DEFAULT_CAMERA_SOUND[camera];
    if (cameraFamily) addSound(cameraFamily, cursor / fps + 0.05, Number(scene.cameraSoundIntensity ?? 0.7));

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
      focus: scene.focus ?? clip.focus,
      transitionIn,
      label: scene.label ?? null,
      cues,
      captionPages
    });
    cursor += durationInFrames;
  }

  if (!scenes.length) throw new Error('El plan no tiene escenas.');

  for (const ambience of plan.sound?.ambience ?? []) {
    addSound(ambience.family, Number(ambience.atSeconds ?? 0), Number(ambience.intensity ?? 1));
  }

  const build = {
    slug,
    generatedAt: new Date().toISOString(),
    format,
    durationInFrames: cursor,
    durationSeconds: round(cursor / fps, 3),
    themeId: plan.themeId ?? 'oxide-documentary',
    accentColor: plan.accentColor ?? null,
    dangerColor: plan.dangerColor ?? null,
    backgroundImage: plan.backgroundImage ? (assetsById.get(plan.backgroundImage)?.file ?? plan.backgroundImage) : null,
    captionStyle: plan.captionStyle ?? {},
    silencePaddingSeconds: padding,
    soundEnabled: plan.sound?.enabled ?? true,
    soundMix: Number(plan.sound?.mix ?? 0.6),
    clipVolume: Number(plan.sound?.clipVolume ?? 1),
    scenes,
    soundCues: soundCues.sort((a, b) => a.startSeconds - b.startSeconds),
    duckWindows,
    warnings
  };

  // Las reglas se ejecutan contra el build ya resuelto y antes de escribirlo: un
  // `error` no debe dejar un short-build.json que Remotion pueda renderizar.
  const {issues, summary} = await runShortsRules(build, {exceptions: plan.ruleExceptions ?? []});
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

  await writeJson(path.join(project, 'short-build.json'), build);
  // El registro que importa Root.tsx se regenera aqui: un proyecto nuevo aparece
  // como composicion sin editar codigo, y uno borrado desaparece.
  const registered = await writeShortsRegistry();
  log(`build: ${scenes.length} escenas, ${build.durationSeconds}s, ${soundCues.length} cues de sonido`);
  log(
    `reglas: ${summary.passed}/${summary.total} pasan, ${summary.warnings} avisos, ` +
    `${summary.skipped} no evaluables`
  );
  log(`registro: ${registered.length} composiciones (${registered.map((entry) => entry.id).join(', ')})`);
  for (const warning of warnings) log(`  aviso: ${warning}`);
  return build;
}

/**
 * Recorte de la escena.
 *
 * Lo habitual en una grabacion por clips es que sobre silencio en los extremos: se
 * pulsa grabar, se respira, se habla y se tarda en parar. Ese silencio no se ve en
 * el JSON pero se nota mucho al ver el short, asi que cuando el plan no fija un
 * extremo se deduce de la primera y la ultima palabra de la transcripcion, dejando
 * `padding` de aire.
 *
 * Un extremo declarado en el plan se respeta siempre: es como se parte un clip en
 * dos escenas con distinto layout sin cortar el audio.
 */
export function resolveTrim(trim, clip, words, padding = DEFAULT_SILENCE_PADDING_SECONDS) {
  const duration = clip.durationSeconds;
  const declaredStart = Number.isFinite(trim?.start) ? Math.max(0, Number(trim.start)) : null;
  const declaredEnd = Number.isFinite(trim?.end) ? Math.min(duration, Number(trim.end)) : null;

  const speechStart = words.length ? Math.max(0, words[0].start - padding) : 0;
  const speechEnd = words.length ? Math.min(duration, words.at(-1).end + padding) : duration;

  const startSeconds = round(declaredStart ?? speechStart, 3);
  const endSeconds = round(declaredEnd ?? speechEnd, 3);
  const leadTrimmed = declaredStart === null ? round(startSeconds, 3) : 0;
  const tailTrimmed = declaredEnd === null ? round(duration - endSeconds, 3) : 0;

  return {
    startSeconds,
    endSeconds,
    leadTrimmed,
    tailTrimmed,
    trimmedSeconds: round(leadTrimmed + tailTrimmed, 3)
  };
}

/**
 * Ventanas de locucion en tiempo absoluto del short, para que los efectos cedan
 * mientras se habla. Palabras separadas por menos de `gapSeconds` se unen en una
 * sola ventana: cerrar y reabrir el ducking en cada silencio de 200 ms produce un
 * bombeo audible.
 */
function speechWindows(words, window, offsetSeconds, gainDb, gapSeconds = 0.4) {
  const windows = [];
  for (const word of words ?? []) {
    if (word.end <= window.startSeconds || word.start >= window.endSeconds) continue;
    const start = Math.max(window.startSeconds, word.start) - window.startSeconds + offsetSeconds;
    const end = Math.min(window.endSeconds, word.end) - window.startSeconds + offsetSeconds;
    const previous = windows.at(-1);
    if (previous && start - previous.endSeconds <= gapSeconds) {
      previous.endSeconds = round(end, 3);
      continue;
    }
    windows.push({startSeconds: round(start, 3), endSeconds: round(end, 3), gainDb: Number(gainDb ?? -6)});
  }
  return windows;
}

/**
 * Silencio que queda dentro de la escena tras el recorte. El recorte automatico lo
 * deja acotado, pero un extremo declarado a mano puede esconder dos segundos de
 * nadie hablando, y eso solo se ve viendo el short. Lo mide la regla SH-R-060.
 */
function edgeSilence(words, startSeconds, endSeconds) {
  const inside = (words ?? []).filter(
    (word) => word.end > startSeconds && word.start < endSeconds
  );
  if (!inside.length) return {};
  return {
    speechLeadSeconds: round(Math.max(0, inside[0].start - startSeconds), 3),
    speechTailSeconds: round(Math.max(0, endSeconds - inside.at(-1).end), 3)
  };
}

/**
 * Medidas del arte de los assets, una vez por build. Si la media no esta presente
 * (carpeta ignorada por git, otra maquina) se avisa y las reglas de presentacion se
 * declaran no evaluables en vez de inventarse un veredicto.
 */
async function measureArtwork(assets, warnings) {
  const measured = new Map();
  for (const asset of assets ?? []) {
    try {
      measured.set(asset.id, await analyzeArtwork(asset.file));
    } catch (error) {
      warnings.push(
        `no se pudo medir el arte de "${asset.id}" (${asset.file}): ${error.message}`
      );
    }
  }
  return measured;
}

/**
 * `atWord` es el ancla canonica. `atSeconds` en el plan solo se acepta cuando el
 * clip no tiene transcripcion, y queda registrado como excepcion.
 */
function resolveCueSeconds(cue, words, trimStartSeconds, where) {
  if (Number.isInteger(cue.atWord)) {
    const word = words[cue.atWord];
    if (!word) throw new Error(`${where}: atWord ${cue.atWord} fuera de rango (${words.length} palabras)`);
    const relative = word.start - trimStartSeconds + Number(cue.offsetSeconds ?? 0);
    if (relative < 0) throw new Error(`${where}: atWord ${cue.atWord} cae antes del recorte de la escena`);
    return relative;
  }
  if (Number.isFinite(cue.atSeconds)) {
    if (words.length) {
      throw new Error(`${where}: usa atWord en vez de atSeconds; el clip tiene transcripcion con tiempos por palabra`);
    }
    return Number(cue.atSeconds);
  }
  throw new Error(`${where}: falta atWord`);
}
