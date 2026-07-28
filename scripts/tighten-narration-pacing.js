#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeId, parseCliArgs, run} from '../src/lib/utils.js';
import {
  flattenTranscriptWords,
  transcriptToSrt
} from './export-faster-whisper-transcript.js';

const DEFAULT_MAX_WORD_GAP_SECONDS = 1;
const DEFAULT_RETAINED_GAP_SECONDS = 0.7;

const round = (value, decimals = 3) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

async function probeDuration(file) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    file
  ], {timeoutMs: 30000});
  const duration = Number(stdout.trim());
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error(`No se pudo medir la duración de ${file}`);
  }
  return duration;
}

export function buildPacingKeepRanges({
  durationSeconds,
  words,
  maxWordGapSeconds = DEFAULT_MAX_WORD_GAP_SECONDS,
  retainedGapSeconds = DEFAULT_RETAINED_GAP_SECONDS
}) {
  if (retainedGapSeconds < 0 || maxWordGapSeconds <= retainedGapSeconds) {
    throw new Error('La pausa retenida debe ser menor que la pausa máxima.');
  }
  const ordered = words
    .map((word) => ({
      start: Number(word.start),
      end: Number(word.end)
    }))
    .filter((word) =>
      Number.isFinite(word.start) &&
      Number.isFinite(word.end) &&
      word.end > word.start
    )
    .sort((left, right) => left.start - right.start);
  if (!ordered.length) throw new Error('La transcripción no contiene palabras válidas.');
  const ranges = [];
  const edits = [];
  let cursor = 0;
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const left = ordered[index];
    const right = ordered[index + 1];
    const gap = right.start - left.end;
    if (gap <= maxWordGapSeconds) continue;
    const leftPadding = retainedGapSeconds / 2;
    const rightPadding = retainedGapSeconds - leftPadding;
    const keepEnd = Math.min(durationSeconds, left.end + leftPadding);
    const resumeAt = Math.max(0, right.start - rightPadding);
    if (keepEnd > cursor) {
      ranges.push({startSeconds: cursor, endSeconds: keepEnd});
    }
    edits.push({
      sourceStartSeconds: keepEnd,
      sourceEndSeconds: resumeAt,
      removedSeconds: Math.max(0, resumeAt - keepEnd),
      originalWordGapSeconds: gap,
      retainedWordGapSeconds: retainedGapSeconds
    });
    cursor = Math.max(cursor, resumeAt);
  }
  if (durationSeconds > cursor) {
    ranges.push({startSeconds: cursor, endSeconds: durationSeconds});
  }
  let outputCursor = 0;
  const mapping = ranges.map((range) => {
    const duration = range.endSeconds - range.startSeconds;
    const segment = {
      sourceStartSeconds: round(range.startSeconds, 6),
      sourceEndSeconds: round(range.endSeconds, 6),
      outputStartSeconds: round(outputCursor, 6),
      outputEndSeconds: round(outputCursor + duration, 6)
    };
    outputCursor += duration;
    return segment;
  });
  return {
    ranges,
    edits: edits.map((edit) => ({
      ...Object.fromEntries(
        Object.entries(edit).map(([key, value]) => [key, round(value)])
      )
    })),
    mapping,
    outputDurationSeconds: round(outputCursor, 6)
  };
}

export function mapSourceTimestamp(seconds, mapping) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || !mapping.length) return value;
  const containing = mapping.find((segment) =>
    value >= segment.sourceStartSeconds &&
    value <= segment.sourceEndSeconds
  );
  if (containing) {
    return round(
      containing.outputStartSeconds +
        (value - containing.sourceStartSeconds),
      6
    );
  }
  const previous = [...mapping]
    .reverse()
    .find((segment) => value > segment.sourceEndSeconds);
  if (previous) return previous.outputEndSeconds;
  return mapping[0].outputStartSeconds;
}

export function retimeTranscript(transcript, mapping) {
  return {
    ...transcript,
    timingOrigin: 'word-gap-edit-decision-list',
    segments: (transcript.segments ?? []).map((segment) => ({
      ...segment,
      start: round(mapSourceTimestamp(segment.start, mapping)),
      end: round(mapSourceTimestamp(segment.end, mapping)),
      words: (segment.words ?? []).map((word) => ({
        ...word,
        start: round(mapSourceTimestamp(word.start, mapping)),
        end: round(mapSourceTimestamp(word.end, mapping))
      }))
    }))
  };
}

function filterGraph(ranges) {
  const trims = ranges.map((range, index) =>
    `[0:a:0]atrim=start=${range.startSeconds}:end=${range.endSeconds},` +
    `asetpts=PTS-STARTPTS[a${index}]`
  );
  const inputs = ranges.map((_, index) => `[a${index}]`).join('');
  return [
    ...trims,
    `${inputs}concat=n=${ranges.length}:v=0:a=1,` +
      'aresample=48000,aformat=sample_fmts=s16:channel_layouts=stereo[out]'
  ].join(';');
}

async function writeTranscriptDerivatives(runDirectory, transcript) {
  const base = 'master-narration.faster-whisper';
  const words = flattenTranscriptWords(transcript.segments ?? []);
  const text = (transcript.segments ?? [])
    .map((segment) => String(segment.text ?? '').trim())
    .join('\n');
  await Promise.all([
    writeFile(
      path.join(runDirectory, `${base}.json`),
      `${JSON.stringify(transcript, null, 2)}\n`,
      'utf8'
    ),
    writeFile(path.join(runDirectory, `${base}.txt`), `${text}\n`, 'utf8'),
    writeFile(
      path.join(runDirectory, `${base}.srt`),
      `${transcriptToSrt(transcript.segments ?? [])}\n`,
      'utf8'
    ),
    writeFile(
      path.join(runDirectory, `${base}.words.json`),
      `${JSON.stringify({
        version: 1,
        language: transcript.language ?? null,
        languageProbability: transcript.languageProbability ?? null,
        wordCount: words.length,
        words
      }, null, 2)}\n`,
      'utf8'
    )
  ]);
}

export async function tightenNarrationPacing(sourceRun, cliOptions = {}) {
  const sourceDirectory = path.resolve(sourceRun);
  const sourceAudio = path.join(sourceDirectory, 'master-narration.wav');
  const sourceTranscript = path.join(
    sourceDirectory,
    'master-narration.faster-whisper.json'
  );
  if (!existsSync(sourceAudio) || !existsSync(sourceTranscript)) {
    throw new Error('El run de origen necesita WAV máster y transcripción por palabras.');
  }
  const maxWordGapSeconds = Number(
    cliOptions.maxWordGapSeconds ?? DEFAULT_MAX_WORD_GAP_SECONDS
  );
  const retainedGapSeconds = Number(
    cliOptions.retainedGapSeconds ?? DEFAULT_RETAINED_GAP_SECONDS
  );
  const transcript = JSON.parse(await readFile(sourceTranscript, 'utf8'));
  const durationSeconds = await probeDuration(sourceAudio);
  const words = (transcript.segments ?? []).flatMap((segment) => segment.words ?? []);
  const pacing = buildPacingKeepRanges({
    durationSeconds,
    words,
    maxWordGapSeconds,
    retainedGapSeconds
  });
  const outputRoot = path.resolve(
    cliOptions.outputRoot ?? path.dirname(sourceDirectory)
  );
  const runId = makeId('narration-paced');
  const runDirectory = path.join(outputRoot, runId);
  await mkdir(runDirectory, {recursive: true});
  const startedAt = new Date().toISOString();
  const settings = {
    maxWordGapSeconds,
    retainedGapSeconds,
    sampleRate: 48000,
    channels: 2
  };
  await writeFile(
    path.join(runDirectory, 'run-start.json'),
    `${JSON.stringify({
      version: 1,
      runId,
      startedAt,
      sourceRun: sourceDirectory,
      settings
    }, null, 2)}\n`,
    'utf8'
  );
  const masterWav = path.join(runDirectory, 'master-narration.wav');
  await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-n',
    '-i', sourceAudio,
    '-filter_complex', filterGraph(pacing.ranges),
    '-map', '[out]',
    '-vn',
    '-ar', '48000',
    '-ac', '2',
    '-c:a', 'pcm_s16le',
    masterWav
  ], {timeoutMs: 180000});
  const masterM4a = path.join(runDirectory, 'master-narration.m4a');
  await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-n',
    '-i', masterWav,
    '-vn',
    '-c:a', 'aac',
    '-b:a', '192k',
    masterM4a
  ], {timeoutMs: 180000});
  const outputDurationSeconds = await probeDuration(masterWav);
  const retimed = retimeTranscript(transcript, pacing.mapping);
  await writeTranscriptDerivatives(runDirectory, retimed);
  const completedAt = new Date().toISOString();
  const timeline = {
    version: 1,
    runId,
    startedAt,
    completedAt,
    sourceRun: sourceDirectory,
    originalFilesModified: false,
    settings,
    sourceDurationSeconds: round(durationSeconds),
    masterDurationSeconds: round(outputDurationSeconds),
    removedDurationSeconds: round(durationSeconds - outputDurationSeconds),
    editCount: pacing.edits.length,
    edits: pacing.edits,
    mapping: pacing.mapping
  };
  await Promise.all([
    writeFile(
      path.join(runDirectory, 'narration-timeline.json'),
      `${JSON.stringify(timeline, null, 2)}\n`,
      'utf8'
    ),
    writeFile(
      path.join(runDirectory, 'legacy-time-map.json'),
      `${JSON.stringify({
        version: 1,
        sourceRun: sourceDirectory,
        mapping: pacing.mapping
      }, null, 2)}\n`,
      'utf8'
    ),
    writeFile(
      path.join(runDirectory, 'run-result.json'),
      `${JSON.stringify({
        version: 1,
        runId,
        status: 'completed',
        completedAt,
        masterDurationSeconds: round(outputDurationSeconds),
        removedDurationSeconds: round(durationSeconds - outputDurationSeconds),
        editCount: pacing.edits.length,
        files: {
          masterWav: 'master-narration.wav',
          masterM4a: 'master-narration.m4a',
          transcript: 'master-narration.faster-whisper.json',
          timeMap: 'legacy-time-map.json'
        }
      }, null, 2)}\n`,
      'utf8'
    )
  ]);
  return {runDirectory, timeline};
}

function usage() {
  console.log(`Ajusta el ritmo de una narración usando los tiempos de palabra.

Uso:
  node scripts/tighten-narration-pacing.js --source-run "<narration-run>"

Opciones:
  --output             Raíz de runs. Default: carpeta del run de origen
  --max-word-gap       Comprime pausas mayores que este valor. Default: 1
  --retained-gap       Pausa conservada. Default: 0.7`);
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }
  const sourceRun = args['source-run'] ?? args._[0];
  if (!sourceRun) {
    usage();
    process.exitCode = 1;
    return;
  }
  const result = await tightenNarrationPacing(sourceRun, {
    outputRoot: args.output,
    maxWordGapSeconds: args['max-word-gap'],
    retainedGapSeconds: args['retained-gap']
  });
  console.log(`Narración ajustada: ${result.runDirectory}`);
  console.log(`Duración eliminada: ${result.timeline.removedDurationSeconds.toFixed(3)} s`);
  console.log(`Pausas corregidas: ${result.timeline.editCount}`);
}

const invoked =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(`[pacing] ${error.message}`);
    process.exitCode = 1;
  });
}
