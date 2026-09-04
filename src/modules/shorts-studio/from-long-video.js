import {classifyDetection} from '../video-studio/framing.js';
import {analyzeVisualTimeline} from '../video-studio/visual-analysis.js';
import {planAdaptiveShort, applySceneEdits} from './editing-plan.js';
import {finalizeShortAudio, verifyShortMedia} from '../video-studio/render-quality.js';
import {copyFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {resolveCaptionStyle} from '../../lib/captions/presets.js';
import {captionsToTimedWords} from '../../lib/captions/planner.js';
import {ensureDir, readJson, round, run, writeJson} from '../../lib/utils.js';
import {detectWebcamBox} from '../../lib/webcam.js';
import {DEFAULT_FOCUS, trackFace} from '../video-studio/face-tracking.js';
import {buildShort} from './build.js';
import {mediaDir, projectDir, REMOTION_ROOT, slugify, staticPath} from './constants.js';
import {compositionIdForSlug} from './registry.js';

/**
 * Puente entre el pipeline de extraccion desde video largo (`src/lib/pipeline.js`)
 * y el renderer Remotion de shorts-studio: un candidato del scoring se convierte
 * en un proyecto shorts (clip cortado + transcripcion rebasada + plan de una
 * escena), se compila con `buildShort` y se renderiza con render-safe.mjs.
 *
 * El layout del short hereda el renderMode del pipeline: `pip` (webcam +
 * pantalla) y `fit` se componen con PipStage replicando el filtergraph de
 * FFmpeg, y `crop` (fuente vertical) es un `full` a sangre.
 */

const LAYOUT_FOR_MODE = {pip: 'pip', fit: 'fit', crop: 'full'};

// Misma normalizacion de audio que la ingesta de video-studio: las plataformas
// renormalizan a -14 LUFS, asi que el clip ya llega ahi.
const LOUDNESS_FILTER = 'loudnorm=I=-14:TP=-1.5:LRA=11';

/**
 * Plan de una escena para un candidato del video largo. Pura y testeable.
 * Sin `trim`: el clip ya viene cortado al rango del candidato.
 */
export function buildShortPlanForCandidate({candidate, renderMode, webcamBox, subtitleMode = 'karaoke', subtitleStyle = {}}) {
  const layout = LAYOUT_FOR_MODE[renderMode] ?? 'full';
  if (layout === 'pip' && !webcamBox) {
    throw new Error(`Candidato ${candidate?.id ?? 'sin id'}: layout pip necesita webcamBox`);
  }
  return {
    scenes: [{
      id: 'scene-1',
      clipId: '01',
      layout,
      camera: 'static',
      transitionIn: 'cut',
      ...(layout === 'pip' ? {webcamBox} : {})
    }],
    captions: {...subtitleStyle, mode: subtitleMode},
    captionStyle: {...subtitleStyle, mode: subtitleMode}
  };
}

/**
 * Palabras del corte rebasadas a 0, en el formato que consume el build
 * (`flattenWords`). `captionsToTimedWords` ya aproxima tiempos por palabra
 * cuando el segmento no los trae, y lo declara en `timingSource`.
 *
 * Devuelve tambien `captionTiming`: 'word' solo si TODAS las palabras traen
 * tiempos reales; con una sola aproximada el renderer sigue funcionando pero el
 * pipeline avisa de que el karaoke es estimado.
 */
export function rebaseWords(captions, start, end) {
  const span = end - start;
  const words = captionsToTimedWords(captions)
    .filter((word) => word.end > start && word.start < end)
    .map((word, index) => ({
      index,
      text: word.text,
      start: round(Math.max(0, word.start - start), 3),
      end: round(Math.min(span, word.end - start), 3),
      timing: word.timingSource === 'word' ? 'word' : 'approximate'
    }))
    .filter((word) => word.end > word.start);
  const captionTiming = words.length && words.every((word) => word.timing === 'word')
    ? 'word'
    : 'approximate';
  return {words, captionTiming};
}

/**
 * Renderiza un candidato del video largo con el motor Remotion de shorts.
 * Devuelve {outputFile, slug, buildFile, captionTiming, renderMode, webcamBox}.
 *
 * Clasificacion del layout POR SEGMENTO (los videos reales mezclan cara a
 * pantalla completa y grabacion de pantalla con webcam en una esquina):
 *   - `renderMode` explicito (del usuario) se respeta tal cual, con el
 *     `webcamBox` recibido.
 *   - Sin `renderMode`: fuente vertical -> `crop`; fuente horizontal -> webcam
 *     en esquina dentro de la ventana del candidato -> `pip` (con ESE box); si
 *     no, cara a pantalla completa -> `crop`; si tampoco -> `fit`.
 *
 * `runners` inyecta las operaciones externas para testear sin ffmpeg ni
 * Remotion: {cutClip, render, trackFace, detectWebcam, build}.
 */
export async function renderCandidateWithRemotion({
  state,
  candidate,
  captions,
  renderMode = null,
  webcamBox = null,
  signal = null,
  log = () => {},
  runners = {},
  outputFile = null,
  editing = {},
  subtitleMode = 'karaoke',
  subtitleStyle = {},
  quality = 'high'
}) {
  const slug = slugify(`short-${state.id}-${candidate.id}`);
  if (!slug) throw new Error(`No se pudo derivar un slug para el candidato ${candidate.id}`);
  const media = mediaDir(slug);
  const project = projectDir(slug);
  await ensureDir(path.join(media, 'clips'));
  await ensureDir(path.join(project, 'transcripts'));

  const clipFile = path.join(media, 'clips', '01.mp4');
  const durationSeconds = round(candidate.end - candidate.start, 3);
  const trackFaceRunner = runners.trackFace ?? trackFace;
  const faceMedia = {duration: durationSeconds, width: state.media.width, height: state.media.height};

  // 1. Clasificacion. La deteccion de webcam muestrea la fuente dentro de la
  // ventana del candidato; el trackFace necesita el clip ya cortado, asi que su
  // parte se resuelve despues del corte y se reutiliza para el manifest.
  let effectiveMode = renderMode;
  let effectiveWebcamBox = webcamBox;
  let face = null;
  if (!effectiveMode) {
    if (state.media.height >= state.media.width) {
      effectiveMode = 'crop';
    } else {
      const detectWebcam = runners.detectWebcam ?? detectWebcamBox;
      const box = await detectWebcam(state.sourceVideo, state.media, {
        window: {startSeconds: candidate.start, endSeconds: candidate.end},
        signal
      });
      const detected = classifyDetection(box, state.media);
      if (detected.mode !== 'fit') {
        effectiveMode = detected.mode;
        effectiveWebcamBox = detected.webcamBox;
      }
    }
  }

  // 2. Corte del segmento. Re-encode siempre: con `-c:v copy` los puntos de
  // corte caen en el keyframe anterior y el short no empieza donde se pidio.
  const cutClip = runners.cutClip ?? defaultCutClip;
  await cutClip({
    videoFile: state.sourceVideo,
    outputFile: clipFile,
    start: candidate.start,
    durationSeconds,
    signal
  });

  // 3. Sin webcam en esquina, la decision cara/fit necesita el clip cortado.
  if (!effectiveMode) {
    face = await trackFaceRunner(clipFile, faceMedia, {signal});
    effectiveMode = face ? 'crop' : 'fit';
    log(`clasificacion: sin webcam en la ventana; ${face ? 'cara a pantalla completa -> crop' : 'sin cara -> fit'}`);
  }
  // El foco solo se detecta en `crop` (full): en pip/fit el encuadre lo fija el
  // layout y la cara visible es la del webcamBox. Si la clasificacion ya corrio
  // el trackFace, se reutiliza ese resultado.
  if (effectiveMode === 'crop' && !face) {
    face = await trackFaceRunner(clipFile, faceMedia, {signal});
  }
  if (effectiveMode !== 'pip') effectiveWebcamBox = null;

  // 4. Transcripcion del corte, rebasada al reloj del clip.
  const {words, captionTiming} = rebaseWords(captions, candidate.start, candidate.end);
  await writeJson(path.join(project, 'transcripts', '01.json'), {
    clipId: '01',
    language: null,
    words
  });

  // Las correcciones de texto mantienen los tiempos y no cambian el audio.
  for (const correction of editing.wordEdits ?? []) {
    if (!Number.isInteger(correction.index) || !words[correction.index] || typeof correction.text !== 'string' || !correction.text.trim() || correction.text.length > 120) throw new Error('Correccion de palabra invalida.');
    words[correction.index].text = correction.text.trim();
  }
  await writeJson(path.join(project, 'transcripts', '01.json'), {clipId: '01', language: null, words});
  const previousAnalysis = candidate.analysisFile && candidate.analysisStart === candidate.start && candidate.analysisEnd === candidate.end ? await readJson(candidate.analysisFile).catch(()=>null) : null;
  const analysis = editing.enabled
    ? previousAnalysis ?? await (runners.analyze ?? analyzeVisualTimeline)(clipFile, faceMedia, {outDir: project, words, signal})
    : null;

  // 5. Manifest. El clip cortado conserva la resolucion de la fuente, asi que
  // las medidas del job y el webcamBox valen tal cual.
  const layout = LAYOUT_FOR_MODE[effectiveMode] ?? 'full';
  const manifest = {
    slug,
    surface: 'shorts',
    format: {width: 1080, height: 1920, fps: 60},
    createdAt: new Date().toISOString(),
    source: {jobId: state.id, candidateId: candidate.id},
    clips: [{
      id: '01',
      sourceName: path.basename(state.sourceVideo),
      file: staticPath(slug, 'clips', '01.mp4'),
      durationSeconds,
      width: state.media.width,
      height: state.media.height,
      fps: state.media.fps,
      focus: face?.focus ?? DEFAULT_FOCUS,
      focusTrack: analysis?.focusTrack?.length ? analysis.focusTrack : face?.track ?? null,
      webcamBox: layout === 'pip' ? effectiveWebcamBox : null,
      transcript: 'transcripts/01.json',
      wordCount: words.length
    }],
    assets: []
  };
  await writeJson(path.join(project, 'manifest.json'), manifest);

  // 6. Plan + build (regenera el registro de composiciones). Inyectable porque
  // en tests un build real deja proyectos temporales en el registro.
  let plan = editing.enabled
    ? planAdaptiveShort({words, duration: durationSeconds, analysis, renderMode, webcamBox: effectiveWebcamBox,
      source: state.media, profile: editing.profile, effects: editing.effects !== false, tighten: editing.tighten !== false})
    : buildShortPlanForCandidate({candidate, renderMode: effectiveMode, webcamBox: effectiveWebcamBox, subtitleMode, subtitleStyle});
  const style = resolveCaptionStyle({preset: subtitleMode === 'progressive' ? 'progressive-punchy' : 'karaoke-highlight', ...subtitleStyle});
  plan.captions = {...style, maxWords: Math.min(5,style.maxWords), maxPageChars:Math.min(36,style.maxPageChars), pauseBreakSeconds:style.pauseBreak,maxPageSeconds:style.maxPageDuration,mode:subtitleMode};
  plan.captionStyle = {...style, mode:subtitleMode, renderer:'styled'};
  if (editing.musicFile) {
    if (!/\.(mp3|wav|m4a|ogg)$/i.test(editing.musicFile)) throw new Error('La musica debe ser un archivo de audio.');
    const musicName='music'+path.extname(editing.musicFile).toLowerCase();
    await copyFile(editing.musicFile,path.join(media,musicName));
    plan.sound={...plan.sound,music:{file:staticPath(slug,musicName),volume:.22,duckGainDb:-12}};
  }
  if (editing.music) plan.sound = {...plan.sound, music: editing.music};
  plan = applySceneEdits(plan, editing.sceneEdits);
  await writeJson(path.join(project, 'short-plan.json'), plan);
  const build = runners.build ?? buildShort;
  const compiled = await build({slug, log});

  // 7. Render con render-safe.mjs. La salida se localiza por el manifest del
  // run, no parseando stdout.
  const render = runners.render ?? defaultRemotionRender;
  const renderedFile = await render({slug, signal, quality});

  // 8. Copia al output del job, junto al resto de artefactos del candidato.
  const destination = outputFile || path.join(state.outputDir, candidate.id, 'short.mp4');
  await ensureDir(path.dirname(destination));
  let qa = null;
  if (!runners.render) {
    await finalizeShortAudio(renderedFile, destination, {signal, duration: compiled?.durationSeconds});
    qa = await verifyShortMedia(destination, {duration: compiled?.durationSeconds, signal});
    await writeJson(path.join(project, 'render-qa.json'), qa);
    if (qa.errors.length) throw new Error('El render no supera QA: ' + qa.errors.join('; '));
  } else await copyFile(renderedFile, destination);

  return {
    outputFile: destination,
    slug,
    buildFile: path.join(project, 'short-build.json'),
    captionTiming,
    renderMode: effectiveMode,
    webcamBox: effectiveWebcamBox,
    duration: compiled?.durationSeconds,
    editing: {...editing, scenes: (compiled?.scenes ?? plan.scenes).map(s => ({id:s.id, layout:s.layout, start:s.trimStartSeconds ?? s.trim?.start, end:s.trimEndSeconds ?? s.trim?.end, intent:s.intent, reason:s.reason, screenRegion:s.screenRegion, focus:plan.scenes.find(p=>p.id===s.id)?.focus ?? null, webcamBox:s.webcamBox, camera:s.camera})), sourceMap: compiled?.sourceMap ?? plan.sourceMap},
    transcript: words,
    qa,
    captionStyle: compiled?.captionStyle ?? plan.captionStyle
  };
}

async function defaultCutClip({videoFile, outputFile, start, durationSeconds, signal}) {
  await ensureDir(path.dirname(outputFile));
  await run('ffmpeg', [
    '-y',
    '-ss', String(round(start, 3)),
    '-i', videoFile,
    '-t', String(durationSeconds),
    '-af', LOUDNESS_FILTER,
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '16',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-movflags', '+faststart',
    outputFile
  ], {signal});
  return outputFile;
}

async function defaultRemotionRender({slug, signal, quality = 'high'}) {
  const compositionId = compositionIdForSlug(slug);
  // Runs existentes ANTES de lanzar: el render tarda minutos y cualquier otra
  // ejecucion de render-safe (un still de verificacion, otro job) puede dejar
  // runs nuevos por medio. El run de ESTE render es uno que no estaba antes.
  const before = await listRunIds(slug);
  await run(process.execPath,
    ['scripts/render-safe.mjs', 'render', 'shorts-' + slug, compositionId, slug + '.mp4', '--color-space=bt709', '--crf=' + ({draft:23,standard:19,high:17}[quality] ?? 17)],
    {cwd: REMOTION_ROOT, signal});
  return locateRunOutput(slug, before);
}

async function listRunIds(slug) {
  const runsRoot = path.join(REMOTION_ROOT, 'out', `shorts-${slug}`, 'runs');
  try {
    return (await readdir(runsRoot, {withFileTypes: true}))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/**
 * MP4 producido por el run de ESTE render: el primero que no existia antes de
 * lanzarlo (`before`), con salida .mp4 registrada en su run-result.json (ver
 * scripts/lib/output-run.mjs). Si por lo que sea no se encuentra el run nuevo,
 * se falla: un artefacto de una exportacion anterior no prueba el exito actual.
 */
export async function locateRunOutput(slug, before = []) {
  const runsRoot = path.join(REMOTION_ROOT, 'out', `shorts-${slug}`, 'runs');
  const runs = await listRunIds(slug);
  if (!runs.length) throw new Error(`render-safe.mjs no dejo runs en ${runsRoot}`);
  const fresh = runs.filter((runId) => !before.includes(runId));
  const candidates = [...fresh].reverse();
  for (const runId of candidates) {
    const manifest = await readJson(path.join(runsRoot, runId, 'run-result.json')).catch(() => null);
    const output = (manifest?.outputs ?? []).find((file) => file.endsWith('.mp4'));
    if (output) return path.isAbsolute(output) ? output : path.join(runsRoot, runId, output);
  }
  throw new Error(`Ningun run de ${slug} registro una salida .mp4`);
}
