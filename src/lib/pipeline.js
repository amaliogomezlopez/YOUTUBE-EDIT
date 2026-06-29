import path from 'node:path';
import {copyFile, writeFile} from 'node:fs/promises';
import {extractAudio, ffprobe, renderVerticalClip} from './ffmpeg.js';
import {enrichCandidatesWithLlm} from './llm.js';
import {findCandidates} from './scoring.js';
import {loadTranscript, sliceCaptions} from './transcript.js';
import {transcribeAudio} from './stt.js';
import {ensureDir, JOBS_DIR, makeId, OUTPUT_DIR, readJson, round, safeFilename, writeJson} from './utils.js';
import {writeAssFile} from './subtitles.js';
import {detectWebcamBox} from './webcam.js';
import {generatePublishingMetadata} from './publishing.js';

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
  try {
    state.status = 'probing';
    await saveJobState(state);
    const media = await ffprobe(state.sourceVideo);
    state.media = {
      duration: round(media.duration, 3),
      width: media.width,
      height: media.height,
      fps: round(media.fps, 3)
    };
    const defaultRenderMode = media.width > media.height ? 'pip' : 'crop';
    const renderMode = options.renderMode ?? defaultRenderMode;
    const warning = sourceQualityWarning(media, renderMode);
    if (warning && !(state.warnings ?? []).includes(warning)) {
      state.warnings = [...(state.warnings ?? []), warning];
      await saveJobState(state);
    }
    let webcamBox = options.webcamBox ?? null;
    if (renderMode === 'pip') {
      state.status = 'detecting-webcam';
      await saveJobState(state);
      webcamBox = await detectWebcamBox(state.sourceVideo, media, options.webcamDetection ?? {});
      state.webcamBox = webcamBox;
    }

    state.status = 'transcribing';
    await saveJobState(state);
    const audioFile = path.join(state.jobDir, 'audio.wav');
    await extractAudio(state.sourceVideo, audioFile);
    let captions;
    if (state.sourceTranscript) {
      captions = await loadTranscript(state.sourceTranscript, media.duration);
    } else {
      captions = await transcribeAudio(audioFile, {
        outDir: state.jobDir,
        provider: options.sttProvider,
        model: options.sttModel,
        language: options.sttLanguage
      });
    }
    await writeJson(path.join(state.jobDir, 'transcript.json'), captions);
    state.transcript = {segments: captions.length};

    state.status = 'generating-metadata';
    await saveJobState(state);
    const publishingMetadata = await generatePublishingMetadata(captions, {useLlm: options.useLlm !== false});
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
        candidates = await enrichCandidatesWithLlm(candidates, {limit: Number(options.llmLimit ?? 15)});
      } catch (error) {
        state.warnings = [
          ...(state.warnings ?? []),
          `LLM enrichment failed; using heuristic scoring: ${error.message}`
        ];
        await saveJobState(state);
      }
    }
    const topN = Number(options.topN ?? 8);
    const selected = candidates.slice(0, topN).map((candidate, index) => ({
      ...candidate,
      rank: index + 1,
      status: 'selected'
    }));
    await writeJson(path.join(state.jobDir, 'candidates.json'), candidates);

    state.status = 'rendering';
    state.clips = selected;
    await saveJobState(state);
    const rendered = [];
    for (const candidate of selected) {
      const clipDir = path.join(state.outputDir, candidate.id);
      await ensureDir(clipDir);
      const clipCaptions = sliceCaptions(captions, candidate.start, candidate.end);
      const assFile = path.join(clipDir, 'captions.ass');
      await writeAssFile(assFile, clipCaptions, {
        mode: options.subtitleMode ?? 'words',
        ...(options.subtitleStyle ?? {})
      });
      const metadataFile = path.join(clipDir, 'metadata.json');
      const outputFile = path.join(clipDir, 'short.mp4');
      await renderVerticalClip({
        videoFile: state.sourceVideo,
        outputFile,
        start: candidate.start,
        end: candidate.end,
        subtitleFile: assFile,
        cwd: clipDir,
        mode: renderMode,
        webcamBox,
        quality: options.renderQuality ?? 'high'
      });
      const metadata = {
        ...candidate,
        files: {
          video: outputFile,
          subtitles: assFile,
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
    state.status = 'failed';
    state.error = {
      message: error.message,
      stack: error.stack
    };
    await saveJobState(state);
    throw error;
  }
}

export async function processVideo({videoFile, transcriptFile = null, options = {}}) {
  const state = await createJob({videoFile, transcriptFile});
  return processJob(state, options);
}

