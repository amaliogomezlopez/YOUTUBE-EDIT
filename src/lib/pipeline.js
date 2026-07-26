import path from 'node:path';
import {copyFile, unlink, writeFile} from 'node:fs/promises';
import {extractAudio, ffprobe, renderVerticalClip} from './ffmpeg.js';
import {enrichCandidatesWithLlm} from './llm.js';
import {findCandidates} from './scoring.js';
import {loadTranscript, sliceCaptions} from './transcript.js';
import {transcribeAudio} from './stt.js';
import {ensureDir, FONTS_DIR, JOBS_DIR, makeId, OUTPUT_DIR, readJson, round, safeFilename, writeJson} from './utils.js';
import {writeAssFile} from './subtitles.js';
import {detectWebcamBox} from './webcam.js';
import {buildClipPublishing, generatePublishingMetadata} from './publishing.js';
import {PersistentJobQueue} from './job-queue.js';

function throwIfCancelled(signal) {
  signal?.throwIfAborted();
}

export async function createJob({videoFile, transcriptFile = null, jobId = null}) {
  const id = jobId ?? makeId('job');
  const jobDir = path.join(JOBS_DIR, id);
  const outputDir = path.join(OUTPUT_DIR, id);
  await ensureDir(jobDir);
  await ensureDir(outputDir);
  const sourceVideo = path.join(jobDir, safeFilename(videoFile));
  await copyFile(videoFile, sourceVideo);
  let sourceTranscript = null;
  if (transcriptFile) {
    sourceTranscript = path.join(jobDir, safeFilename(transcriptFile));
    await copyFile(transcriptFile, sourceTranscript);
  }
  const state = {
    id,
    status: 'queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    jobDir,
    outputDir,
    sourceVideo,
    sourceTranscript,
    error: null,
    clips: []
  };
  await saveJobState(state);
  return state;
}

export async function saveJobState(state) {
  state.updatedAt = new Date().toISOString();
  await writeJson(path.join(state.jobDir, 'job.json'), state);
}

export async function loadJobState(id) {
  const state = await readJson(path.join(JOBS_DIR, id, 'job.json'));
  try {
    state.publishRuns = await readJson(path.join(state.jobDir, 'publish-runs.json'));
    state.publishStatus = state.publishRuns.at(-1)?.status ?? state.publishStatus;
  } catch {
    state.publishRuns = state.publishRuns ?? [];
  }
  try {
    state.metrics = await readJson(path.join(state.jobDir, 'metrics.json'));
  } catch {
    state.metrics = state.metrics ?? [];
  }
  return state;
}

function sourceQualityWarning(media, renderMode) {
  const isVertical = media.height >= media.width;
  const enoughForVertical = isVertical
    ? media.width >= 720 && media.height >= 1280
    : media.width >= 1280 && media.height >= 720;
  if (enoughForVertical) return null;
  const layout = renderMode === 'pip' ? 'webcam + pantalla' : renderMode;
  return `Fuente baja (${media.width}x${media.height}). El export se genera a 1080x1920, pero para que no se vea pixelado conviene usar al menos 1280x720 en horizontal o 720x1280 en vertical. Layout: ${layout}.`;
}

export async function processJob(state, options = {}) {
  const started = performance.now();
  const {signal} = options;
  try {
    throwIfCancelled(signal);
    state.status = 'probing';
    await saveJobState(state);
    const media = await ffprobe(state.sourceVideo, {signal});
    state.media = {
      duration: round(media.duration, 3),
      width: media.width,
      height: media.height,
      fps: round(media.fps, 3)
    };
    const defaultRenderMode = media.width > media.height ? 'pip' : 'crop';
    let renderMode = options.renderMode ?? defaultRenderMode;
    const warning = sourceQualityWarning(media, renderMode);
    if (warning && !(state.warnings ?? []).includes(warning)) {
      state.warnings = [...(state.warnings ?? []), warning];
      await saveJobState(state);
    }
    let webcamBox = options.webcamBox ?? null;
    if (renderMode === 'pip') {
      throwIfCancelled(signal);
      state.status = 'detecting-webcam';
      await saveJobState(state);
      webcamBox = await detectWebcamBox(state.sourceVideo, media, {...(options.webcamDetection ?? {}), signal});
      if (!webcamBox) {
        renderMode = 'fit';
        state.warnings = [...(state.warnings ?? []), 'No se detectó una webcam estable. Se usará pantalla completa para evitar un recorte falso.'];
      }
      state.webcamBox = webcamBox;
    }
    state.renderMode = renderMode;

    state.status = 'transcribing';
    await saveJobState(state);
    let captions;
    if (state.sourceTranscript) {
      captions = await loadTranscript(state.sourceTranscript, media.duration);
    } else {
      const audioFile = path.join(state.jobDir, 'audio.wav');
      await extractAudio(state.sourceVideo, audioFile, {signal});
      captions = await transcribeAudio(audioFile, {
        outDir: state.jobDir,
        provider: options.sttProvider,
        model: options.sttModel,
        language: options.sttLanguage,
        device: options.sttDevice,
        computeType: options.sttComputeType,
        python: options.sttPython,
        hfHubRoot: options.sttHfHubRoot,
        initialPrompt: options.sttInitialPrompt,
        chunkSeconds: options.sttChunkSeconds,
        overlapSeconds: options.sttChunkOverlapSeconds,
        timeoutMs: options.sttTimeoutMs,
        retries: options.sttRetries,
        signal
      });
    }
    throwIfCancelled(signal);
    await writeJson(path.join(state.jobDir, 'transcript.json'), captions);
    const timedWords = captions.reduce((sum, caption) => sum + (Array.isArray(caption.words) ? caption.words.length : 0), 0);
    state.transcript = {segments: captions.length, words: timedWords, wordTiming: timedWords > 0};

    state.status = 'generating-metadata';
    await saveJobState(state);
    const publishingMetadata = await generatePublishingMetadata(captions, {useLlm: options.useLlm !== false, signal});
    throwIfCancelled(signal);
    await writeJson(path.join(state.jobDir, 'publishing-metadata.json'), publishingMetadata);
    state.publishingMetadata = publishingMetadata;
    if (publishingMetadata.warning) {
      state.warnings = [...(state.warnings ?? []), publishingMetadata.warning];
      await saveJobState(state);
    }

    state.status = 'scoring';
    await saveJobState(state);
    let candidates = findCandidates(captions, {
      minDuration: Number(options.minDuration ?? 18),
      maxDuration: Number(options.maxDuration ?? 60),
      stride: Number(options.stride ?? 1)
    });
    if (options.useLlm !== false) {
      try {
        candidates = await enrichCandidatesWithLlm(candidates, {limit: Number(options.llmLimit ?? 15), signal});
      } catch (error) {
        state.warnings = [
          ...(state.warnings ?? []),
          `LLM enrichment failed; using heuristic scoring: ${error.message}`
        ];
        await saveJobState(state);
      }
    }
    throwIfCancelled(signal);
    const topN = Number(options.topN ?? 8);
    const selected = candidates.slice(0, topN).map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      publishing: buildClipPublishing({...candidate, rank: index + 1}, publishingMetadata),
      status: 'selected'
    }));
    await writeJson(path.join(state.jobDir, 'candidates.json'), candidates);

    state.status = 'rendering';
    state.clips = selected;
    await saveJobState(state);
    const rendered = [];
    for (const candidate of selected) {
      throwIfCancelled(signal);
      const clipDir = path.join(state.outputDir, candidate.id);
      await ensureDir(clipDir);
      const clipCaptions = sliceCaptions(captions, candidate.start, candidate.end);
      const assFile = path.join(clipDir, 'captions.ass');
      const captionPlanFile = path.join(clipDir, 'caption-plan.json');
      const subtitleMode = options.subtitleMode ?? 'progressive';
      const subtitleStyle = options.subtitleStyle ?? {};
      const subtitleDocument = await writeAssFile(assFile, clipCaptions, {
        mode: subtitleMode,
        ...(options.subtitleStyle ?? {})
      });
      if (subtitleDocument.plan) await writeJson(captionPlanFile, subtitleDocument.plan);
      if (subtitleDocument.plan?.timing.source !== 'word') {
        const timingWarning = 'Los subtítulos progresivos usan tiempos aproximados porque la transcripción no contiene timestamps por palabra.';
        if (!(state.warnings ?? []).includes(timingWarning)) state.warnings = [...(state.warnings ?? []), timingWarning];
      }
      const metadataFile = path.join(clipDir, 'metadata.json');
      const outputFile = path.join(clipDir, 'short.mp4');
      await renderVerticalClip({
        videoFile: state.sourceVideo,
        outputFile,
        start: candidate.start,
        end: candidate.end,
        subtitleFile: assFile,
        fontDir: FONTS_DIR,
        cwd: clipDir,
        mode: renderMode,
        webcamBox,
        quality: options.renderQuality ?? 'high',
        signal
      });
      const metadata = {
        ...candidate,
        renderSettings: {
          mode: renderMode,
          quality: options.renderQuality ?? 'high',
          subtitleMode,
          subtitleStyle: subtitleDocument.plan?.style ?? subtitleStyle,
          captionTiming: subtitleDocument.plan?.timing ?? null,
          webcamBox
        },
        files: {
          video: outputFile,
          subtitles: assFile,
          ...(subtitleDocument.plan ? {captionPlan: captionPlanFile} : {}),
          metadata: metadataFile
        }
      };
      await writeJson(metadataFile, metadata);
      rendered.push(metadata);
      state.clips = rendered.concat(selected.slice(rendered.length));
      await saveJobState(state);
    }

    state.status = 'done';
    state.clips = rendered;
    state.completedAt = new Date().toISOString();
    state.elapsedSeconds = round((performance.now() - started) / 1000, 2);
    await saveJobState(state);
    await writeFile(path.join(state.outputDir, 'README.txt'), `Generated ${rendered.length} shorts for job ${state.id}\n`, 'utf8');
    return state;
  } catch (error) {
    const cancelled = signal?.aborted || error?.name === 'AbortError';
    state.status = cancelled ? 'cancelled' : 'failed';
    state.error = cancelled ? null : {message: error.message, stack: error.stack};
    if (cancelled) state.cancelledAt = new Date().toISOString();
    await saveJobState(state);
    throw error;
  }
}

function normalizedWebcamBox(box, media) {
  if (!box) return null;
  const values = ['x', 'y', 'w', 'h'].map((key) => Number(box[key]));
  if (!values.every(Number.isFinite)) throw new Error('La caja de webcam necesita x, y, ancho y alto válidos.');
  const normalized = box.normalized !== false && values.every((value) => value >= 0 && value <= 1);
  const [x, y, w, h] = normalized
    ? [values[0] * media.width, values[1] * media.height, values[2] * media.width, values[3] * media.height]
    : values;
  if (w < 24 || h < 24 || x < 0 || y < 0 || x + w > media.width || y + h > media.height) {
    throw new Error('La caja de webcam queda fuera de la imagen o es demasiado pequeña.');
  }
  return {x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h), confidence: 1, method: 'manual-override'};
}

export async function updateClipDecision(state, clipId, decision) {
  if (!['accepted', 'discarded', 'ready'].includes(decision)) throw new Error('Estado editorial no válido.');
  const clip = (state.clips ?? []).find((item) => item.id === clipId);
  if (!clip) throw new Error('Clip no encontrado.');
  clip.editorialStatus = decision;
  clip.editorialUpdatedAt = new Date().toISOString();
  await saveJobState(state);
  if (clip.files?.metadata) await writeJson(clip.files.metadata, clip);
  return clip;
}

export async function rerenderClip(state, clipId, edits = {}, options = {}) {
  const {signal} = options;
  throwIfCancelled(signal);
  const clip = (state.clips ?? []).find((item) => item.id === clipId);
  if (!clip) throw new Error('Clip no encontrado.');
  if (!state.media?.duration) throw new Error('El vídeo todavía no se ha analizado.');
  const start = Number(edits.start ?? clip.start);
  const end = Number(edits.end ?? clip.end);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end > state.media.duration || end - start < 1 || end - start > 180) {
    throw new Error('El rango debe durar entre 1 y 180 segundos y quedar dentro del vídeo.');
  }
  const mode = ['crop', 'fit', 'pip'].includes(edits.renderMode) ? edits.renderMode : (state.renderMode || 'crop');
  const webcamBox = edits.webcamBox ? normalizedWebcamBox(edits.webcamBox, state.media) : state.webcamBox;
  if (mode === 'pip' && !webcamBox) throw new Error('Selecciona una caja de webcam antes de renderizar en modo PIP.');
  const captions = await readJson(path.join(state.jobDir, 'transcript.json'));
  const clipDir = path.dirname(clip.files?.metadata || path.join(state.outputDir, clip.id, 'metadata.json'));
  await ensureDir(clipDir);
  const renderId = makeId('render');
  const assFile = path.join(clipDir, `captions-${renderId}.ass`);
  const captionPlanFile = path.join(clipDir, `caption-plan-${renderId}.json`);
  const metadataFile = path.join(clipDir, `metadata-${renderId}.json`);
  const outputFile = path.join(clipDir, `short-${renderId}.mp4`);
  const subtitleMode = edits.subtitleMode || clip.renderSettings?.subtitleMode || 'progressive';
  const previousSubtitleStyle = clip.renderSettings?.subtitleStyle ?? {};
  const requestedSubtitleStyle = edits.subtitleStyle ?? {};
  const presetChanged = requestedSubtitleStyle.preset && requestedSubtitleStyle.preset !== previousSubtitleStyle.preset;
  const subtitleStyle = presetChanged
    ? requestedSubtitleStyle
    : {...previousSubtitleStyle, ...requestedSubtitleStyle};
  const previousClip = structuredClone(clip);
  clip.status = 'rendering';
  clip.renderError = null;
  try {
    await saveJobState(state);
    const subtitleDocument = await writeAssFile(assFile, sliceCaptions(captions, start, end), {
      mode: subtitleMode,
      ...subtitleStyle
    });
    if (subtitleDocument.plan) await writeJson(captionPlanFile, subtitleDocument.plan);
    await (options.renderClip || renderVerticalClip)({
      videoFile: state.sourceVideo,
      outputFile,
      start,
      end,
      subtitleFile: assFile,
      fontDir: FONTS_DIR,
      cwd: clipDir,
      mode,
      webcamBox,
      quality: edits.renderQuality || 'high',
      signal
    });
    const nextFiles = {
      ...(previousClip.files ?? {}),
      video: outputFile,
      subtitles: assFile,
      metadata: metadataFile
    };
    if (subtitleDocument.plan) nextFiles.captionPlan = captionPlanFile;
    else delete nextFiles.captionPlan;
    const nextClip = {
      ...previousClip,
      start,
      end,
      duration: round(end - start, 3),
      status: 'ready',
      renderError: null,
      renderedAt: new Date().toISOString(),
      renderSettings: {
        mode,
        quality: edits.renderQuality || previousClip.renderSettings?.quality || 'high',
        subtitleMode,
        subtitleStyle: subtitleDocument.plan?.style ?? subtitleStyle,
        captionTiming: subtitleDocument.plan?.timing ?? null,
        webcamBox
      },
      files: nextFiles
    };
    await writeJson(metadataFile, nextClip);
    Object.keys(clip).forEach((key) => delete clip[key]);
    Object.assign(clip, nextClip);
    await saveJobState(state);
    const currentFiles = new Set(Object.values(nextFiles));
    const obsoleteFiles = Object.values(previousClip.files ?? {}).filter((file) => file && !currentFiles.has(file));
    await Promise.all(obsoleteFiles.map((file) => unlink(file).catch(() => {})));
    return clip;
  } catch (error) {
    Object.keys(clip).forEach((key) => delete clip[key]);
    Object.assign(clip, previousClip);
    clip.status = signal?.aborted ? 'cancelled' : 'render_failed';
    clip.renderError = signal?.aborted ? null : error.message;
    await saveJobState(state).catch(() => {});
    await Promise.all([outputFile, assFile, captionPlanFile, metadataFile].map((file) => unlink(file).catch(() => {})));
    throw error;
  }
}

export async function createProcessingQueue({
  file = path.join(JOBS_DIR, 'queue.json'),
  concurrency = Number(process.env.JOB_CONCURRENCY ?? 1),
  retryDelayMs = Number(process.env.JOB_RETRY_DELAY_MS ?? 1000),
  autoStart = true
} = {}) {
  const queue = new PersistentJobQueue({
    file,
    concurrency,
    retryDelayMs,
    autoStart,
    handler: async ({type = 'process', jobId, clipId, edits = {}, options = {}}, context) => {
      const state = await loadJobState(jobId);
      state.error = null;
      state.cancelledAt = null;
      if (type === 'rerender-clip') {
        const clip = await rerenderClip(state, clipId, edits, {...options, signal: context.signal});
        return {jobId, clipId: clip.id, status: clip.status, renderedAt: clip.renderedAt};
      }
      const result = await processJob(state, {...options, signal: context.signal});
      return {jobId: result.id, status: result.status, completedAt: result.completedAt};
    }
  });
  await queue.init();
  return queue;
}

export async function enqueueProcessingJob(queue, state, options = {}, queueOptions = {}) {
  if (!queue || typeof queue.enqueue !== 'function') throw new Error('A processing queue is required');
  return queue.enqueue({jobId: state.id, options}, {id: state.id, ...queueOptions});
}

export async function enqueueClipRerender(queue, state, clipId, edits = {}, queueOptions = {}) {
  if (!queue || typeof queue.enqueue !== 'function') throw new Error('A processing queue is required');
  const queueId = makeId(`rerender-${clipId}`);
  const clip = (state.clips ?? []).find((item) => item.id === clipId);
  if (!clip) throw new Error('Clip no encontrado.');
  clip.renderQueueId = queueId;
  clip.status = 'queued';
  await saveJobState(state);
  await queue.enqueue({type: 'rerender-clip', jobId: state.id, clipId, edits}, {id: queueId, maxAttempts: 2, ...queueOptions});
  return queue.get(queueId);
}

export async function processVideo({videoFile, transcriptFile = null, options = {}}) {
  const state = await createJob({videoFile, transcriptFile});
  return processJob(state, options);
}

