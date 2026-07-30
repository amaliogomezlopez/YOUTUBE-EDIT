import path from 'node:path';
import {readJson, round, writeJson} from '../../lib/utils.js';
import {SHORT_FORMAT, projectDir} from './constants.js';
import {buildCaptionPages} from './captions.js';
import {resolveSoundCue} from './sound.js';

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

    const startSeconds = Math.max(0, Number(scene.trim?.start ?? 0));
    const endSeconds = Math.min(clip.durationSeconds, Number(scene.trim?.end ?? clip.durationSeconds));
    if (endSeconds - startSeconds < 0.2) throw new Error(`${where}: recorte demasiado corto (${startSeconds}-${endSeconds})`);
    const durationInFrames = Math.max(1, Math.round((endSeconds - startSeconds) * fps));
    const words = transcripts.get(clip.id)?.words ?? [];
    if (!words.length) warnings.push(`${where}: el clip ${clip.id} no tiene transcripcion; sin subtitulos ni anclaje por palabra`);

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
      if (cue.sound) {
        soundCues.push(resolveSoundCue(cue.sound, cursor / fps + atSeconds, Number(cue.soundIntensity ?? 1)));
      }
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
        durationInFrames: cueFrames
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

    assertNoSlotOverlap(cues, where);
    duckWindows.push(...speechWindows(words, {startSeconds, endSeconds}, cursor / fps, plan.sound?.duckGainDb));

    if (transitionIn !== 'cut' && index === 0) {
      warnings.push(`${where}: transitionIn "${transitionIn}" en la primera escena; el hook gana con corte seco`);
    }

    scenes.push({
      id: scene.id ?? `scene-${index + 1}`,
      clipId: clip.id,
      src: clip.file,
      from: cursor,
      durationInFrames,
      trimStartSeconds: round(startSeconds, 3),
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
    soundCues.push(resolveSoundCue(ambience.family, Number(ambience.atSeconds ?? 0), Number(ambience.intensity ?? 1)));
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
    soundEnabled: plan.sound?.enabled ?? true,
    soundMix: Number(plan.sound?.mix ?? 0.6),
    clipVolume: Number(plan.sound?.clipVolume ?? 1),
    scenes,
    soundCues: soundCues.sort((a, b) => a.startSeconds - b.startSeconds),
    duckWindows,
    warnings
  };

  await writeJson(path.join(project, 'short-build.json'), build);
  log(`build: ${scenes.length} escenas, ${build.durationSeconds}s, ${soundCues.length} cues de sonido`);
  for (const warning of warnings) log(`  aviso: ${warning}`);
  return build;
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
 * Dos cues en el mismo slot y a la vez se dibujan uno encima del otro. Es el fallo
 * mas facil de introducir al alargar un `holdSeconds`, y no se ve en el JSON: solo
 * aparece al renderizar. Los chips son la excepcion, porque `stage-footer` los
 * maqueta en fila a proposito.
 */
function assertNoSlotOverlap(cues, where) {
  const bySlot = new Map();
  for (const cue of cues) {
    if (cue.type === 'chip') continue;
    const slot = cue.slot ?? 'stage-full';
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(cue);
  }
  for (const [slot, slotCues] of bySlot) {
    for (let index = 1; index < slotCues.length; index += 1) {
      const previous = slotCues[index - 1];
      const current = slotCues[index];
      const previousEnd = previous.fromFrame + previous.durationInFrames;
      if (current.fromFrame < previousEnd) {
        throw new Error(
          `${where}: los cues "${previous.id}" y "${current.id}" se solapan en el slot "${slot}". ` +
          `Reduce holdSeconds de "${previous.id}" o mueve uno a otro slot.`
        );
      }
    }
  }
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
