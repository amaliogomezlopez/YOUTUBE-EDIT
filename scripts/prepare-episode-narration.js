#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {mkdir, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeId, parseCliArgs, run} from '../src/lib/utils.js';

const DEFAULTS = Object.freeze({
  clipGapSeconds: 1,
  internalGapSeconds: 0.65,
  compressSilenceAfterSeconds: 1.25,
  silenceDetectionSeconds: 0.35,
  edgePaddingSeconds: 0.12,
  targetLufs: -16,
  truePeakDb: -1.5,
  loudnessRange: 11,
  sampleRate: 48000,
  channels: 2
});

function usage() {
  console.log(`Prepare ordered episode narration

Uso:
  node scripts/prepare-episode-narration.js --input "<episode-dir>"

Opciones:
  --output                    Raíz de runs. Default: <input>/narration/runs
  --clip-gap                  Silencio entre clips. Default: 1
  --internal-gap              Silencio conservado dentro de pausas largas. Default: 0.65
  --compress-silence-after    Comprime pausas internas más largas que este valor. Default: 1.25
  --silence-detection         Duración mínima detectada por FFmpeg. Default: 0.35
  --edge-padding              Margen de seguridad antes/después de voz. Default: 0.12
  --target-lufs               Sonoridad objetivo por clip. Default: -16
  --help                      Muestra esta ayuda

Los clips originales nunca se modifican. Cada ejecución crea una carpeta nueva.`);
}

function finiteNumber(value, fallback, label) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} debe ser numérico.`);
  return parsed;
}

function round(value, decimals = 3) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function naturalClipNumber(file) {
  const stem = path.basename(file, path.extname(file));
  return /^\d+$/.test(stem) ? Number(stem) : Number.POSITIVE_INFINITY;
}

function mediaExtension(file) {
  return new Set(['.mkv', '.mp4', '.mov', '.m4a', '.mp3', '.wav', '.flac', '.aac']).has(
    path.extname(file).toLowerCase()
  );
}

async function probeAudio(file) {
  const {stdout} = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'a:0',
    '-show_entries', 'format=duration:stream=codec_name,sample_rate,channels',
    '-of', 'json',
    file
  ], {timeoutMs: 30000});
  const payload = JSON.parse(stdout);
  const durationSeconds = Number(payload.format?.duration);
  const stream = payload.streams?.[0];
  if (!stream || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error(`No se encontró audio válido en ${file}`);
  }
  return {
    durationSeconds,
    codec: stream.codec_name,
    sampleRate: Number(stream.sample_rate),
    channels: Number(stream.channels)
  };
}

async function measureLoudness(file) {
  const {stderr} = await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i', file,
    '-map', '0:a:0',
    '-vn',
    '-af', 'loudnorm=I=-16:LRA=11:TP=-1.5:print_format=json',
    '-f', 'null',
    '-'
  ], {timeoutMs: 120000});
  const blocks = stderr.match(/\{\s*"input_i"[\s\S]*?\}/g) ?? [];
  if (!blocks.length) throw new Error(`FFmpeg no devolvió loudnorm para ${file}`);
  const measured = JSON.parse(blocks.at(-1));
  const inputThreshold = Number(measured.input_thresh);
  if (!Number.isFinite(inputThreshold)) {
    throw new Error(`FFmpeg no devolvió input_thresh válido para ${file}`);
  }
  return {
    inputLufs: Number(measured.input_i),
    inputTruePeakDb: Number(measured.input_tp),
    inputLra: Number(measured.input_lra),
    inputThresholdDb: inputThreshold
  };
}

export function parseSilenceDetection(stderr, durationSeconds) {
  const events = [];
  for (const line of stderr.split(/\r?\n/)) {
    const startMatch = /silence_start:\s*([0-9.]+)/.exec(line);
    if (startMatch) {
      events.push({startSeconds: Number(startMatch[1]), endSeconds: null});
      continue;
    }
    const endMatch = /silence_end:\s*([0-9.]+)\s*\|\s*silence_duration:\s*([0-9.]+)/.exec(line);
    if (!endMatch) continue;
    const open = [...events].reverse().find((event) => event.endSeconds === null);
    if (!open) continue;
    open.endSeconds = Number(endMatch[1]);
    open.durationSeconds = Number(endMatch[2]);
  }
  return events
    .filter((event) => Number.isFinite(event.startSeconds))
    .map((event) => {
      const endSeconds = Number.isFinite(event.endSeconds) ? event.endSeconds : durationSeconds;
      return {
        startSeconds: Math.max(0, Math.min(durationSeconds, event.startSeconds)),
        endSeconds: Math.max(0, Math.min(durationSeconds, endSeconds)),
        durationSeconds: Math.max(0, endSeconds - event.startSeconds)
      };
    })
    .filter((event) => event.endSeconds > event.startSeconds);
}

async function detectSilences(file, durationSeconds, thresholdDb, minimumSeconds) {
  const {stderr} = await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-i', file,
    '-map', '0:a:0',
    '-vn',
    '-af', `silencedetect=noise=${round(thresholdDb, 2)}dB:d=${minimumSeconds}`,
    '-f', 'null',
    '-'
  ], {timeoutMs: 120000});
  return parseSilenceDetection(stderr, durationSeconds);
}

export function buildKeepRanges({
  durationSeconds,
  silences,
  internalGapSeconds = DEFAULTS.internalGapSeconds,
  compressSilenceAfterSeconds = DEFAULTS.compressSilenceAfterSeconds,
  edgePaddingSeconds = DEFAULTS.edgePaddingSeconds
}) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('durationSeconds debe ser positivo.');
  }
  const ordered = [...silences].sort((a, b) => a.startSeconds - b.startSeconds);
  const leading = ordered.find((silence) => silence.startSeconds <= 0.05);
  const trailing = [...ordered]
    .reverse()
    .find((silence) => silence.endSeconds >= durationSeconds - 0.05);
  const trimStart = leading
    ? Math.max(0, Math.min(durationSeconds, leading.endSeconds - edgePaddingSeconds))
    : 0;
  const trimEnd = trailing
    ? Math.max(trimStart, Math.min(durationSeconds, trailing.startSeconds + edgePaddingSeconds))
    : durationSeconds;
  if (trimEnd - trimStart < 0.1) {
    throw new Error('La detección de silencio no encontró voz suficiente.');
  }

  const compressedSilences = ordered.filter((silence) => (
    silence.startSeconds > trimStart &&
    silence.endSeconds < trimEnd &&
    silence.durationSeconds > compressSilenceAfterSeconds
  ));
  const ranges = [];
  let cursor = trimStart;
  for (const silence of compressedSilences) {
    const retained = Math.min(internalGapSeconds, silence.durationSeconds);
    const leftPad = retained / 2;
    const rightPad = retained - leftPad;
    const end = Math.min(trimEnd, silence.startSeconds + leftPad);
    if (end - cursor >= 0.02) ranges.push({startSeconds: cursor, endSeconds: end});
    cursor = Math.max(cursor, silence.endSeconds - rightPad);
  }
  if (trimEnd - cursor >= 0.02) ranges.push({startSeconds: cursor, endSeconds: trimEnd});
  if (!ranges.length) ranges.push({startSeconds: trimStart, endSeconds: trimEnd});

  return {
    trimStartSeconds: round(trimStart),
    trimEndSeconds: round(trimEnd),
    ranges: ranges.map((range) => ({
      startSeconds: round(range.startSeconds),
      endSeconds: round(range.endSeconds)
    })),
    compressedSilences: compressedSilences.map((silence) => ({
      startSeconds: round(silence.startSeconds),
      endSeconds: round(silence.endSeconds),
      originalDurationSeconds: round(silence.durationSeconds),
      retainedDurationSeconds: round(Math.min(internalGapSeconds, silence.durationSeconds))
    }))
  };
}

function filterGraph(ranges, options) {
  const trims = ranges.map((range, index) => (
    `[0:a:0]atrim=start=${range.startSeconds}:end=${range.endSeconds},asetpts=PTS-STARTPTS[a${index}]`
  ));
  const inputs = ranges.map((_, index) => `[a${index}]`).join('');
  const channelLayout = options.channels === 1 ? 'mono' : 'stereo';
  return [
    ...trims,
    `${inputs}concat=n=${ranges.length}:v=0:a=1,` +
      `aresample=${options.sampleRate},` +
      `aformat=sample_fmts=s16:channel_layouts=${channelLayout},` +
      `loudnorm=I=${options.targetLufs}:LRA=${options.loudnessRange}:TP=${options.truePeakDb}:linear=true[out]`
  ].join(';');
}

async function renderClipAudio(sourceFile, outputFile, keep, options) {
  await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-n',
    '-i', sourceFile,
    '-filter_complex', filterGraph(keep.ranges, options),
    '-map', '[out]',
    '-vn',
    '-ar', String(options.sampleRate),
    '-ac', String(options.channels),
    '-c:a', 'pcm_s16le',
    outputFile
  ], {timeoutMs: 180000});
  return probeAudio(outputFile);
}

function concatEscape(file) {
  return path.resolve(file).replaceAll('\\', '/').replaceAll("'", "'\\''");
}

function secondsLabel(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

async function writeReadme(runDir, manifest) {
  const rows = manifest.clips.map((clip) => (
    `| ${clip.clipNumber} | ${clip.sourceFile} | ${clip.originalDurationSeconds.toFixed(3)} s | ` +
    `${clip.processedDurationSeconds.toFixed(3)} s | ${secondsLabel(clip.masterStartSeconds)} |`
  ));
  const markdown = `# Narración maestra

Run: \`${manifest.runId}\`

- Clips: ${manifest.clips.length}, ordenados numéricamente.
- Duración original acumulada: ${manifest.originalDurationSeconds.toFixed(3)} s.
- Duración maestra: ${manifest.masterDurationSeconds.toFixed(3)} s.
- Separación entre clips: ${manifest.settings.clipGapSeconds} s.
- Pausas internas superiores a ${manifest.settings.compressSilenceAfterSeconds} s: reducidas a ${manifest.settings.internalGapSeconds} s.
- Sonoridad por clip: ${manifest.settings.targetLufs} LUFS; pico verdadero máximo ${manifest.settings.truePeakDb} dBTP.
- Los archivos fuente no se modificaron.

| Clip | Fuente | Original | Procesado | Inicio máster |
| ---: | --- | ---: | ---: | ---: |
${rows.join('\n')}

## Archivos

- \`master-narration.wav\`: máster PCM 48 kHz estéreo para edición y transcripción.
- \`master-narration.m4a\`: copia AAC para escucha.
- \`narration-timeline.json\`: trazabilidad completa, detección de silencios y tiempos.
- \`concat.txt\`: orden reproducible del montaje.
- \`segments/\`: audios procesados por clip.
`;
  await writeFile(path.join(runDir, 'README.md'), markdown, 'utf8');
}

export async function prepareEpisodeNarration(inputDir, cliOptions = {}) {
  const input = path.resolve(inputDir);
  if (!existsSync(input)) throw new Error(`No existe la carpeta de entrada: ${input}`);
  const settings = {
    ...DEFAULTS,
    clipGapSeconds: finiteNumber(cliOptions.clipGapSeconds, DEFAULTS.clipGapSeconds, '--clip-gap'),
    internalGapSeconds: finiteNumber(cliOptions.internalGapSeconds, DEFAULTS.internalGapSeconds, '--internal-gap'),
    compressSilenceAfterSeconds: finiteNumber(
      cliOptions.compressSilenceAfterSeconds,
      DEFAULTS.compressSilenceAfterSeconds,
      '--compress-silence-after'
    ),
    silenceDetectionSeconds: finiteNumber(
      cliOptions.silenceDetectionSeconds,
      DEFAULTS.silenceDetectionSeconds,
      '--silence-detection'
    ),
    edgePaddingSeconds: finiteNumber(cliOptions.edgePaddingSeconds, DEFAULTS.edgePaddingSeconds, '--edge-padding'),
    targetLufs: finiteNumber(cliOptions.targetLufs, DEFAULTS.targetLufs, '--target-lufs')
  };
  if (settings.clipGapSeconds < 0 || settings.internalGapSeconds < 0) {
    throw new Error('Las pausas no pueden ser negativas.');
  }
  if (settings.compressSilenceAfterSeconds <= settings.internalGapSeconds) {
    throw new Error('--compress-silence-after debe ser mayor que --internal-gap.');
  }

  const entries = (await readdir(input, {withFileTypes: true}))
    .filter((entry) => entry.isFile() && mediaExtension(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => {
      const numberDelta = naturalClipNumber(a) - naturalClipNumber(b);
      return Number.isFinite(numberDelta) && numberDelta !== 0
        ? numberDelta
        : a.localeCompare(b, 'es', {numeric: true});
    });
  if (!entries.length) throw new Error(`No hay clips de audio o vídeo en ${input}`);
  const duplicateNumbers = entries
    .map(naturalClipNumber)
    .filter(Number.isFinite)
    .filter((number, index, values) => values.indexOf(number) !== index);
  if (duplicateNumbers.length) {
    throw new Error(`Hay números de clip duplicados: ${[...new Set(duplicateNumbers)].join(', ')}`);
  }

  const outputRoot = path.resolve(cliOptions.outputRoot ?? path.join(input, 'narration', 'runs'));
  const runId = makeId('narration');
  const runDir = path.join(outputRoot, runId);
  const segmentsDir = path.join(runDir, 'segments');
  await mkdir(segmentsDir, {recursive: true});
  const startedAt = new Date().toISOString();
  await writeFile(path.join(runDir, 'run-start.json'), `${JSON.stringify({
    version: 1,
    runId,
    startedAt,
    inputDirectory: input,
    settings
  }, null, 2)}\n`, 'utf8');

  const clips = [];
  for (const [index, entry] of entries.entries()) {
    const sourceFile = path.join(input, entry);
    const clipNumber = Number.isFinite(naturalClipNumber(entry)) ? naturalClipNumber(entry) : index + 1;
    console.log(`[audio] ${index + 1}/${entries.length} · analizando ${entry}`);
    const probe = await probeAudio(sourceFile);
    const loudness = await measureLoudness(sourceFile);
    const silences = await detectSilences(
      sourceFile,
      probe.durationSeconds,
      loudness.inputThresholdDb,
      settings.silenceDetectionSeconds
    );
    const keep = buildKeepRanges({
      durationSeconds: probe.durationSeconds,
      silences,
      internalGapSeconds: settings.internalGapSeconds,
      compressSilenceAfterSeconds: settings.compressSilenceAfterSeconds,
      edgePaddingSeconds: settings.edgePaddingSeconds
    });
    const outputFile = path.join(segmentsDir, `${String(clipNumber).padStart(2, '0')}.wav`);
    const processed = await renderClipAudio(sourceFile, outputFile, keep, settings);
    clips.push({
      clipNumber,
      sourceFile,
      sourceName: entry,
      processedFile: path.relative(runDir, outputFile).replaceAll('\\', '/'),
      originalDurationSeconds: round(probe.durationSeconds),
      processedDurationSeconds: round(processed.durationSeconds),
      sourceAudio: {
        codec: probe.codec,
        sampleRate: probe.sampleRate,
        channels: probe.channels
      },
      loudness,
      silenceThresholdDb: loudness.inputThresholdDb,
      detectedSilences: silences.map((silence) => ({
        startSeconds: round(silence.startSeconds),
        endSeconds: round(silence.endSeconds),
        durationSeconds: round(silence.durationSeconds)
      })),
      ...keep
    });
  }

  const gapFile = path.join(runDir, `gap-${settings.clipGapSeconds.toFixed(2)}s.wav`);
  if (settings.clipGapSeconds > 0 && clips.length > 1) {
    await run('ffmpeg', [
      '-hide_banner',
      '-nostats',
      '-n',
      '-f', 'lavfi',
      '-i', `anullsrc=r=${settings.sampleRate}:cl=${settings.channels === 1 ? 'mono' : 'stereo'}`,
      '-t', String(settings.clipGapSeconds),
      '-c:a', 'pcm_s16le',
      gapFile
    ], {timeoutMs: 30000});
  }

  let masterCursor = 0;
  const concatLines = [];
  for (const [index, clip] of clips.entries()) {
    clip.masterStartSeconds = round(masterCursor);
    clip.masterEndSeconds = round(masterCursor + clip.processedDurationSeconds);
    masterCursor = clip.masterEndSeconds;
    concatLines.push(`file '${concatEscape(path.join(runDir, clip.processedFile))}'`);
    if (index < clips.length - 1 && settings.clipGapSeconds > 0) {
      concatLines.push(`file '${concatEscape(gapFile)}'`);
      masterCursor = round(masterCursor + settings.clipGapSeconds);
    }
  }
  const concatFile = path.join(runDir, 'concat.txt');
  await writeFile(concatFile, `${concatLines.join('\n')}\n`, 'utf8');
  const masterWav = path.join(runDir, 'master-narration.wav');
  await run('ffmpeg', [
    '-hide_banner',
    '-nostats',
    '-n',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-vn',
    '-ar', String(settings.sampleRate),
    '-ac', String(settings.channels),
    '-c:a', 'pcm_s16le',
    masterWav
  ], {timeoutMs: 180000});
  const masterM4a = path.join(runDir, 'master-narration.m4a');
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
  const masterProbe = await probeAudio(masterWav);
  const manifest = {
    version: 1,
    runId,
    startedAt,
    completedAt: new Date().toISOString(),
    inputDirectory: input,
    originalFilesModified: false,
    settings,
    originalDurationSeconds: round(clips.reduce((sum, clip) => sum + clip.originalDurationSeconds, 0)),
    masterDurationSeconds: round(masterProbe.durationSeconds),
    files: {
      masterWav: 'master-narration.wav',
      masterM4a: 'master-narration.m4a',
      concat: 'concat.txt',
      segmentsDirectory: 'segments'
    },
    clips
  };
  await writeFile(
    path.join(runDir, 'narration-timeline.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8'
  );
  await writeReadme(runDir, manifest);
  await writeFile(path.join(runDir, 'run-result.json'), `${JSON.stringify({
    version: 1,
    runId,
    status: 'completed',
    completedAt: manifest.completedAt,
    masterDurationSeconds: manifest.masterDurationSeconds,
    files: manifest.files
  }, null, 2)}\n`, 'utf8');
  return {runDir, manifest};
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }
  const input = args.input ?? args._[0];
  if (!input) {
    usage();
    process.exitCode = 1;
    return;
  }
  const result = await prepareEpisodeNarration(input, {
    outputRoot: args.output,
    clipGapSeconds: args['clip-gap'],
    internalGapSeconds: args['internal-gap'],
    compressSilenceAfterSeconds: args['compress-silence-after'],
    silenceDetectionSeconds: args['silence-detection'],
    edgePaddingSeconds: args['edge-padding'],
    targetLufs: args['target-lufs']
  });
  console.log('');
  console.log(`Narración lista: ${result.runDir}`);
  console.log(`Duración maestra: ${result.manifest.masterDurationSeconds.toFixed(3)} s`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((error) => {
    console.error(`[audio] ${error.message}`);
    process.exitCode = 1;
  });
}
