import {existsSync} from 'node:fs';
import {readdir, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {ffprobe} from './ffmpeg.js';
import {analyzeAnimationScout} from './animation-scout-llm.js';
import {
  DATA_DIR,
  ROOT,
  clamp,
  ensureDir,
  makeId,
  round,
  run,
  writeJson
} from './utils.js';

export const ANIMATION_SCOUT_DIR = path.join(DATA_DIR, 'review', 'animation-scout');
export const ANIMATION_SCOUT_MODES = Object.freeze(['survey', 'study']);

const DEFAULTS = Object.freeze({
  survey: {
    fps: 2,
    maxFrames: 240,
    resolution: 960,
    motionWindowSeconds: 3
  },
  study: {
    fps: 8,
    maxFrames: 240,
    resolution: 1280,
    motionWindowSeconds: 2
  }
});

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.m4v', '.avi']);

function numberOption(value, fallback, {min = -Infinity, max = Infinity} = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(parsed, min, max);
}

function integerOption(value, fallback, {min = 1, max = 10_000} = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return clamp(parsed, min, max);
}

export function parseScoutTime(value, label = 'timestamp') {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) throw new Error(`${label} no es válido.`);
    return value;
  }
  const text = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  const parts = text.split(':');
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) {
    throw new Error(`${label} debe usar segundos, MM:SS o HH:MM:SS.`);
  }
  const values = parts.map(Number);
  const seconds = parts.length === 3
    ? values[0] * 3600 + values[1] * 60 + values[2]
    : values[0] * 60 + values[1];
  if (!Number.isFinite(seconds) || seconds < 0) throw new Error(`${label} no es válido.`);
  return seconds;
}

export function formatScoutTime(seconds) {
  const totalMillis = Math.max(0, Math.round(Number(seconds || 0) * 1000));
  const millis = totalMillis % 1000;
  const totalSeconds = Math.floor(totalMillis / 1000);
  const secs = totalSeconds % 60;
  const mins = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const prefix = hours > 0 ? `${String(hours).padStart(2, '0')}:` : '';
  return `${prefix}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

function isRemoteSource(source) {
  try {
    const url = new URL(String(source));
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

async function resolveDownloadedFile(sourceDir, stdout) {
  const reported = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1);
  if (reported && existsSync(reported)) return path.resolve(reported);
  const files = (await readdir(sourceDir))
    .filter((file) => VIDEO_EXTENSIONS.has(path.extname(file).toLowerCase()))
    .sort();
  if (!files.length) throw new Error('yt-dlp terminó sin producir un archivo de vídeo reconocible.');
  return path.join(sourceDir, files[0]);
}

async function downloadVideoSource(source, sourceDir, options = {}) {
  await ensureDir(sourceDir);
  const template = path.join(sourceDir, 'source.%(ext)s');
  let result;
  try {
    result = await (options.runCommand ?? run)('yt-dlp', [
      '--no-playlist',
      '--no-progress',
      '--merge-output-format', 'mp4',
      '--print', 'after_move:filepath',
      '-o', template,
      '--',
      source
    ], {signal: options.signal, timeoutMs: Number(options.downloadTimeoutMs ?? 60 * 60 * 1000)});
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(
        'yt-dlp no está instalado. En Windows: winget install yt-dlp.yt-dlp. '
        + 'También puedes analizar un archivo local con --source.'
      );
    }
    const detail = String(error.stderr || error.message || '').trim().split(/\r?\n/).slice(-3).join(' · ');
    throw new Error(`No se pudo descargar la referencia con yt-dlp${detail ? `: ${detail}` : ''}`);
  }
  return resolveDownloadedFile(sourceDir, result.stdout);
}

async function resolveVideoSource(source, jobDir, options = {}) {
  if (isRemoteSource(source)) {
    options.onProgress?.({stage: 'download', message: 'Descargando la referencia visual con yt-dlp'});
    const localFile = await downloadVideoSource(source, path.join(jobDir, 'source'), options);
    return {
      kind: 'url',
      input: source,
      displayName: source,
      localFile
    };
  }
  const localFile = path.resolve(String(source));
  if (!existsSync(localFile)) throw new Error(`No existe el vídeo fuente: ${localFile}`);
  const info = await stat(localFile);
  if (!info.isFile()) throw new Error(`La fuente no es un archivo: ${localFile}`);
  return {
    kind: 'local',
    input: source,
    displayName: path.basename(localFile),
    localFile
  };
}

export function parseScoutCrop(value, media) {
  if (!value) return null;
  const parts = String(value).split(':').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error('--crop debe usar x:y:ancho:alto en píxeles.');
  }
  const [x, y, width, height] = parts.map(Math.round);
  if (x < 0 || y < 0 || width < 2 || height < 2) {
    throw new Error('--crop contiene valores fuera de rango.');
  }
  if (x + width > media.width || y + height > media.height) {
    throw new Error(`--crop excede el vídeo de ${media.width}x${media.height}.`);
  }
  return {x, y, width, height};
}

function scoutRange(media, mode, options = {}) {
  const start = parseScoutTime(options.start, '--start') ?? 0;
  const sourceDuration = Number(media.durationSeconds);
  let end = parseScoutTime(options.end, '--end');
  if (start >= sourceDuration) {
    throw new Error(`--start (${start}s) está después del final del vídeo (${round(sourceDuration, 2)}s).`);
  }
  if (end == null) {
    end = mode === 'study' && options.start != null
      ? Math.min(sourceDuration, start + 8)
      : sourceDuration;
  }
  end = Math.min(end, sourceDuration);
  if (end <= start) throw new Error('--end debe ser posterior a --start.');
  return {
    startSeconds: round(start, 3),
    endSeconds: round(end, 3),
    durationSeconds: round(end - start, 3)
  };
}

export function createSamplingPlan({
  mode = 'survey',
  durationSeconds,
  sourceFps,
  fps,
  maxFrames,
  resolution
}) {
  if (!ANIMATION_SCOUT_MODES.includes(mode)) throw new Error(`Modo de scouting no válido: ${mode}`);
  const defaults = DEFAULTS[mode];
  const requestedFps = numberOption(fps, defaults.fps, {min: 0.05, max: 60});
  const boundedBySource = sourceFps > 0 ? Math.min(requestedFps, sourceFps) : requestedFps;
  const resolvedMaxFrames = integerOption(maxFrames, defaults.maxFrames, {min: 1, max: 5_000});
  const frameLimitedFps = Math.min(boundedBySource, resolvedMaxFrames / Math.max(durationSeconds, 0.001));
  const effectiveFps = Math.max(0.01, frameLimitedFps);
  const estimatedFrames = Math.max(1, Math.min(
    resolvedMaxFrames,
    Math.ceil(durationSeconds * effectiveFps)
  ));
  return {
    requestedFps: round(requestedFps, 4),
    effectiveFps: round(effectiveFps, 6),
    sourceFps: round(sourceFps, 4),
    maxFrames: resolvedMaxFrames,
    estimatedFrames,
    resolution: integerOption(resolution, defaults.resolution, {min: 320, max: 3840}),
    cappedByFrameBudget: effectiveFps + 0.0001 < boundedBySource
  };
}

async function extractScoutFrames(videoFile, framesDir, range, sampling, crop, options = {}) {
  await ensureDir(framesDir);
  const filters = [];
  if (crop) filters.push(`crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}`);
  filters.push(`fps=${sampling.effectiveFps}`);
  filters.push(
    `scale=w='min(${sampling.resolution},iw)':h=-2:flags=lanczos+accurate_rnd+full_chroma_int`
  );
  filters.push('setsar=1');
  const args = [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', videoFile
  ];
  if (range.startSeconds > 0) args.push('-ss', String(range.startSeconds));
  args.push(
    '-t', String(range.durationSeconds),
    '-vf', filters.join(','),
    '-frames:v', String(sampling.maxFrames),
    '-q:v', '3',
    path.join(framesDir, 'frame-%06d.jpg')
  );
  await (options.runCommand ?? run)('ffmpeg', args, {
    signal: options.signal,
    timeoutMs: Number(options.extractTimeoutMs ?? 60 * 60 * 1000)
  });
  return (await readdir(framesDir))
    .filter((file) => /^frame-\d+\.jpg$/i.test(file))
    .sort()
    .map((file) => path.join(framesDir, file));
}

async function tinyGrayscale(file) {
  const {data} = await sharp(file)
    .resize(32, 32, {fit: 'fill'})
    .grayscale()
    .raw()
    .toBuffer({resolveWithObject: true});
  return data;
}

export function frameChangeScore(previous, current) {
  if (!previous || !current || previous.length !== current.length) return 1;
  let total = 0;
  for (let index = 0; index < previous.length; index += 1) {
    total += Math.abs(previous[index] - current[index]);
  }
  return round(total / (previous.length * 255), 5);
}

export function classifyFrameChange(score) {
  if (score == null) return 'first';
  if (score < 0.006) return 'hold';
  if (score < 0.025) return 'subtle-motion';
  if (score < 0.18) return 'motion';
  return 'probable-cut';
}

async function inspectFrames(frameFiles, range, sampling, jobDir, options = {}) {
  const frames = [];
  let previous = null;
  for (let index = 0; index < frameFiles.length; index += 1) {
    options.signal?.throwIfAborted();
    const file = frameFiles[index];
    const current = await tinyGrayscale(file);
    const changeScore = index === 0 ? null : frameChangeScore(previous, current);
    const timestampSeconds = round(
      Math.min(range.endSeconds, range.startSeconds + index / sampling.effectiveFps),
      3
    );
    frames.push({
      index: index + 1,
      timestampSeconds,
      timestamp: formatScoutTime(timestampSeconds),
      path: file,
      relativePath: path.relative(jobDir, file).replace(/\\/g, '/'),
      changeScore,
      changeKind: classifyFrameChange(changeScore)
    });
    previous = current;
  }
  return frames;
}

function temporalOverlap(a, b) {
  const overlap = Math.max(0, Math.min(a.endSeconds, b.endSeconds) - Math.max(a.startSeconds, b.startSeconds));
  return overlap / Math.max(0.001, Math.min(
    a.endSeconds - a.startSeconds,
    b.endSeconds - b.startSeconds
  ));
}

export function rankMotionWindows(frames, options = {}) {
  if (!Array.isArray(frames) || frames.length < 2) return [];
  const fps = numberOption(options.fps, 2, {min: 0.01, max: 120});
  const windowSeconds = numberOption(options.windowSeconds, 3, {min: 0.5, max: 12});
  const windowSize = Math.max(2, Math.round(windowSeconds * fps));
  const step = Math.max(1, Math.round(windowSize / 3));
  const candidates = [];
  for (let start = 0; start < frames.length - 1; start += step) {
    const slice = frames.slice(start, Math.min(frames.length, start + windowSize));
    if (slice.length < 2) continue;
    const scores = slice.map((frame) => Number(frame.changeScore)).filter(Number.isFinite);
    if (!scores.length) continue;
    const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    const activeRatio = scores.filter((score) => score >= 0.012).length / scores.length;
    const cutRatio = scores.filter((score) => score >= 0.18).length / scores.length;
    const peak = Math.max(...scores);
    const sustainedScore = Math.max(0, mean * (0.55 + activeRatio) - cutRatio * 0.06);
    if (activeRatio < 0.12 && mean < 0.008) continue;
    candidates.push({
      startSeconds: slice[0].timestampSeconds,
      endSeconds: slice.at(-1).timestampSeconds,
      frameStart: slice[0].index,
      frameEnd: slice.at(-1).index,
      meanChange: round(mean, 5),
      peakChange: round(peak, 5),
      activeRatio: round(activeRatio, 3),
      probableCutRatio: round(cutRatio, 3),
      score: round(sustainedScore, 5),
      kind: cutRatio > 0.35 ? 'cut-heavy' : activeRatio > 0.55 ? 'sustained-motion' : 'intermittent-motion'
    });
  }
  const selected = [];
  for (const candidate of candidates.sort((a, b) => b.score - a.score)) {
    if (selected.some((item) => temporalOverlap(item, candidate) > 0.5)) continue;
    selected.push(candidate);
    if (selected.length >= integerOption(options.limit, 8, {min: 1, max: 30})) break;
  }
  return selected.sort((a, b) => a.startSeconds - b.startSeconds);
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function labelSvg(width, height, frame) {
  const score = frame.changeScore == null ? 'inicio' : `Δ ${frame.changeScore.toFixed(3)}`;
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#111722"/>
  <text x="12" y="24" fill="#f5f7fb" font-family="Arial, sans-serif" font-size="17" font-weight="700">#${String(frame.index).padStart(4, '0')} · ${escapeXml(frame.timestamp)}</text>
  <text x="${width - 12}" y="24" text-anchor="end" fill="#8ca0b8" font-family="Arial, sans-serif" font-size="14">${escapeXml(score)}</text>
</svg>`);
}

function headerSvg(width, height, text, accent = '#42C7F5') {
  return Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#080c13"/>
  <rect x="0" y="0" width="8" height="${height}" fill="${accent}"/>
  <text x="24" y="27" fill="#f5f7fb" font-family="Arial, sans-serif" font-size="20" font-weight="700">${escapeXml(text)}</text>
  <text x="24" y="50" fill="#8ca0b8" font-family="Arial, sans-serif" font-size="14">Orden cronológico: izquierda → derecha, arriba → abajo</text>
</svg>`);
}

async function renderContactCell(frame, width, imageHeight, labelHeight) {
  const image = await sharp(frame.path)
    .resize(width, imageHeight, {fit: 'contain', background: '#030509'})
    .jpeg({quality: 90, chromaSubsampling: '4:4:4'})
    .toBuffer();
  return sharp({
    create: {
      width,
      height: imageHeight + labelHeight,
      channels: 3,
      background: '#030509'
    }
  }).composite([
    {input: image, left: 0, top: 0},
    {input: labelSvg(width, labelHeight, frame), left: 0, top: imageHeight}
  ]).jpeg({quality: 90, chromaSubsampling: '4:4:4'}).toBuffer();
}

async function createContactSheets(frames, sheetsDir, context, options = {}) {
  await ensureDir(sheetsDir);
  const columns = integerOption(options.columns, 4, {min: 2, max: 6});
  const rows = integerOption(options.rows, 3, {min: 1, max: 6});
  const tileWidth = integerOption(options.tileWidth, 320, {min: 180, max: 640});
  const labelHeight = 38;
  const headerHeight = 64;
  const gutter = 10;
  const outer = 16;
  const sourceRatio = context.frameWidth / Math.max(1, context.frameHeight);
  const imageHeight = Math.round(clamp(tileWidth / sourceRatio, 140, 430));
  const cellHeight = imageHeight + labelHeight;
  const perSheet = columns * rows;
  const groups = [];
  for (let index = 0; index < frames.length; index += perSheet) {
    groups.push(frames.slice(index, index + perSheet));
  }
  const sheets = [];
  for (let sheetIndex = 0; sheetIndex < groups.length; sheetIndex += 1) {
    options.signal?.throwIfAborted();
    const group = groups[sheetIndex];
    const sheetWidth = outer * 2 + columns * tileWidth + (columns - 1) * gutter;
    const sheetHeight = outer * 2 + headerHeight + rows * cellHeight + (rows - 1) * gutter;
    const cells = await Promise.all(
      group.map((frame) => renderContactCell(frame, tileWidth, imageHeight, labelHeight))
    );
    const composites = cells.map((input, index) => ({
      input,
      left: outer + (index % columns) * (tileWidth + gutter),
      top: outer + headerHeight + Math.floor(index / columns) * (cellHeight + gutter)
    }));
    const title = `${context.mode.toUpperCase()} · hoja ${sheetIndex + 1}/${groups.length} · ${context.displayName} · ${context.effectiveFps} fps`;
    composites.unshift({
      input: headerSvg(sheetWidth - outer * 2, headerHeight, title),
      left: outer,
      top: outer
    });
    const file = path.join(sheetsDir, `sheet-${String(sheetIndex + 1).padStart(3, '0')}.jpg`);
    await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 3,
        background: '#05080d'
      }
    }).composite(composites).jpeg({quality: 92, chromaSubsampling: '4:4:4'}).toFile(file);
    sheets.push({
      index: sheetIndex + 1,
      path: file,
      relativePath: path.relative(context.jobDir, file).replace(/\\/g, '/'),
      width: sheetWidth,
      height: sheetHeight,
      startSeconds: group[0].timestampSeconds,
      endSeconds: group.at(-1).timestampSeconds,
      frames: group.map((frame) => ({
        index: frame.index,
        timestampSeconds: frame.timestampSeconds,
        timestamp: frame.timestamp,
        changeScore: frame.changeScore,
        changeKind: frame.changeKind
      }))
    });
  }
  return sheets;
}

function sourceMediaMetadata(probe) {
  const video = probe.raw?.streams?.find((stream) => stream.codec_type === 'video') ?? {};
  const audio = probe.raw?.streams?.find((stream) => stream.codec_type === 'audio') ?? null;
  return {
    durationSeconds: round(probe.duration, 3),
    width: probe.width,
    height: probe.height,
    fps: round(probe.fps, 4),
    videoCodec: video.codec_name ?? null,
    pixelFormat: video.pix_fmt ?? null,
    hasAudio: Boolean(audio),
    audioCodec: audio?.codec_name ?? null
  };
}

function buildRemotionHandoff(manifest, analysis) {
  const candidates = analysis?.animationCandidates?.length
    ? analysis.animationCandidates
    : manifest.motionWindows.map((window, index) => ({
      id: `heuristic-window-${String(index + 1).padStart(2, '0')}`,
      startSeconds: window.startSeconds,
      endSeconds: window.endSeconds,
      confidence: null,
      observed: `Cambio visual ${window.kind}; revisar las hojas de contacto antes de usarlo.`,
      remotionPlan: {}
    }));
  return {
    version: 1,
    kind: 'shortsmith-animation-scout-handoff',
    generatedAt: new Date().toISOString(),
    scoutId: manifest.id,
    source: {
      input: manifest.source.input,
      localFile: manifest.source.localFile,
      range: manifest.range
    },
    evidence: {
      manifestFile: manifest.files.manifest,
      contactSheets: manifest.contactSheets.map((sheet) => sheet.path),
      visualReport: analysis ? manifest.files.visualReport : null,
      transcriptUsed: false,
      note: 'La evidencia de estilo es exclusivamente visual. No usarla como respaldo factual de la pieza final.'
    },
    styleFingerprint: analysis?.styleFingerprint ?? null,
    candidates,
    remotionSystem: {
      patternCatalog: path.join(ROOT, 'remotion-animations', 'catalog', 'animation-patterns.json'),
      effectCatalog: path.join(ROOT, 'remotion-animations', 'catalog', 'animation-effects.json'),
      animationSpecSchema: path.join(ROOT, 'remotion-animations', 'schemas', 'animation-spec.schema.json'),
      toolkit: path.join(ROOT, 'remotion-animations', 'src', 'motion', 'Toolkit.tsx'),
      effects: path.join(ROOT, 'remotion-animations', 'src', 'motion', 'Effects.tsx')
    },
    builderRules: [
      'Tratar la referencia como lenguaje visual, no como evidencia factual.',
      'Comprobar el candidato en las hojas de contacto y conservar sus incertidumbres.',
      'Si este informe es survey, repetir el rango elegido en mode=study a 8-12 fps antes de implementar.',
      'Crear después un animation-spec.json respaldado por la transcripción o fuente editorial del proyecto final.',
      'Reutilizar Toolkit.tsx y Effects.tsx antes de crear geometría duplicada.',
      'Implementar el movimiento con useCurrentFrame(), useVideoConfig() e interpolaciones con easing explícito.'
    ]
  };
}

function markdownReport(manifest, analysis, handoff) {
  const candidates = handoff.candidates.length
    ? handoff.candidates.map((candidate) => (
      `- **${candidate.id}** · ${formatScoutTime(candidate.startSeconds)} → ${formatScoutTime(candidate.endSeconds)}`
      + `${candidate.confidence == null ? '' : ` · confianza ${candidate.confidence}`}`
      + `\n  ${candidate.observed || candidate.whyWorthStudying || 'Revisar visualmente.'}`
    )).join('\n')
    : '- No se detectaron candidatos automáticamente. Revisa las hojas de contacto.';
  const warnings = manifest.warnings.length
    ? manifest.warnings.map((warning) => `- ${warning}`).join('\n')
    : '- Ninguno.';
  return `# Scouting visual de animaciones

## Resultado

- ID: \`${manifest.id}\`
- Fuente: \`${manifest.source.displayName}\`
- Rango: ${formatScoutTime(manifest.range.startSeconds)} → ${formatScoutTime(manifest.range.endSeconds)}
- Modo: \`${manifest.mode}\`
- Muestreo: ${manifest.sampling.effectiveFps} fps (${manifest.frames.length} frames)
- LLM visual: ${analysis
    ? `sí · ${analysis.model}`
    : manifest.analysis?.error
      ? `falló · ${manifest.analysis.error}`
      : 'no ejecutado'}
- Transcripción: no utilizada

## Candidatos

${candidates}

## Archivos

- Manifest: \`${manifest.files.manifest}\`
- Hojas de contacto: \`${path.dirname(manifest.contactSheets[0]?.path || manifest.files.manifest)}\`
- Informe visual: ${analysis ? `\`${manifest.files.visualReport}\`` : 'pendiente; ejecuta de nuevo con `--analyze`'}
- Handoff para Remotion: \`${manifest.files.remotionHandoff}\`

## Advertencias

${warnings}

## Flujo recomendado

1. Si este trabajo usa modo \`survey\`, elige un candidato y repite solo ese rango con \`--mode study --fps 8\` o \`--fps 12\`.
2. Revisa las hojas de contacto densas y el informe visual.
3. Usa el handoff como referencia al invocar \`create-remotion-animations\`.
4. Genera un \`animation-spec.json\` para la pieza final con evidencia editorial propia.
5. Implementa y valida los stills 0/15/45/75/95 antes del render final.
`;
}

async function ensureFreshJobDirectory(jobDir) {
  if (!existsSync(jobDir)) {
    await ensureDir(jobDir);
    return;
  }
  const entries = await readdir(jobDir);
  if (entries.length) {
    throw new Error(`La carpeta de salida ya contiene archivos: ${jobDir}`);
  }
}

export async function scoutAnimations(source, options = {}) {
  if (!source) throw new Error('Falta --source con una ruta local o URL.');
  const mode = String(options.mode || 'survey').toLowerCase();
  if (!ANIMATION_SCOUT_MODES.includes(mode)) {
    throw new Error(`--mode debe ser uno de: ${ANIMATION_SCOUT_MODES.join(', ')}.`);
  }

  const id = String(options.id || makeId('animation-scout'));
  const jobDir = options.outputDir
    ? path.resolve(String(options.outputDir))
    : path.join(ANIMATION_SCOUT_DIR, id);
  await ensureFreshJobDirectory(jobDir);

  options.onProgress?.({stage: 'source', message: 'Resolviendo la fuente visual'});
  const resolvedSource = await resolveVideoSource(source, jobDir, options);
  const probe = await ffprobe(resolvedSource.localFile, {signal: options.signal});
  const media = sourceMediaMetadata(probe);
  if (!media.durationSeconds || !media.width || !media.height) {
    throw new Error('El archivo no contiene una pista de vídeo válida.');
  }
  const range = scoutRange(media, mode, options);
  const crop = parseScoutCrop(options.crop, media);
  const sampling = createSamplingPlan({
    mode,
    durationSeconds: range.durationSeconds,
    sourceFps: media.fps,
    fps: options.fps,
    maxFrames: options.maxFrames,
    resolution: options.resolution
  });
  const warnings = [];
  if (sampling.cappedByFrameBudget) {
    warnings.push(
      `El presupuesto de ${sampling.maxFrames} frames redujo el muestreo de `
      + `${sampling.requestedFps} a ${sampling.effectiveFps} fps. Aumenta --max-frames o acorta el rango.`
    );
  }
  if (mode === 'study' && sampling.effectiveFps <= 2) {
    warnings.push('El estudio quedó en 2 fps o menos; acorta el rango o aumenta --max-frames para reconstruir movimiento.');
  }

  options.onProgress?.({
    stage: 'extract',
    message: `Extrayendo hasta ${sampling.maxFrames} frames a ${sampling.effectiveFps} fps`
  });
  const framesDir = path.join(jobDir, 'frames');
  const frameFiles = await extractScoutFrames(
    resolvedSource.localFile,
    framesDir,
    range,
    sampling,
    crop,
    options
  );
  if (!frameFiles.length) throw new Error('FFmpeg no extrajo ningún fotograma.');

  options.onProgress?.({stage: 'motion-profile', message: 'Midiendo cambios visuales entre frames'});
  const frames = await inspectFrames(frameFiles, range, sampling, jobDir, options);
  const motionWindows = rankMotionWindows(frames, {
    fps: sampling.effectiveFps,
    windowSeconds: DEFAULTS[mode].motionWindowSeconds,
    limit: options.motionCandidates
  });

  options.onProgress?.({stage: 'contact-sheets', message: 'Componiendo hojas de contacto cronológicas'});
  const frameWidth = crop?.width ?? media.width;
  const frameHeight = crop?.height ?? media.height;
  const contactSheets = await createContactSheets(
    frames,
    path.join(jobDir, 'contact-sheets'),
    {
      mode,
      displayName: resolvedSource.displayName,
      effectiveFps: sampling.effectiveFps,
      frameWidth,
      frameHeight,
      jobDir
    },
    {
      columns: options.columns,
      rows: options.rows,
      tileWidth: options.tileWidth,
      signal: options.signal
    }
  );

  const files = {
    manifest: path.join(jobDir, 'manifest.json'),
    motionProfile: path.join(jobDir, 'motion-profile.json'),
    visualReport: path.join(jobDir, 'visual-analysis.json'),
    remotionHandoff: path.join(jobDir, 'remotion-handoff.json'),
    readme: path.join(jobDir, 'README.md')
  };
  const manifest = {
    version: 1,
    id,
    createdAt: new Date().toISOString(),
    mode,
    goal: String(options.goal || '').trim() || null,
    source: {
      kind: resolvedSource.kind,
      input: resolvedSource.input,
      displayName: resolvedSource.displayName,
      localFile: resolvedSource.localFile
    },
    media,
    range,
    crop,
    sampling,
    frames,
    motionWindows,
    contactSheets,
    warnings,
    privacy: {
      transcriptUsed: false,
      audioExtracted: false,
      videoUploadedToLlm: false,
      contactSheetsUploadRequested: Boolean(options.analyze),
      contactSheetsMayHaveBeenUploadedToLlm: false
    },
    analysis: {
      requested: Boolean(options.analyze),
      completed: false,
      model: null,
      error: null
    },
    files
  };
  await writeJson(files.manifest, manifest);
  await writeJson(files.motionProfile, {version: 1, scoutId: id, frames, motionWindows});

  let analysis = null;
  let analysisError = null;
  if (options.analyze) {
    manifest.privacy.contactSheetsMayHaveBeenUploadedToLlm = true;
    try {
      const analyzed = await analyzeAnimationScout(manifest, {
        ...options.vision,
        goal: options.goal,
        fetch: options.fetch,
        sleep: options.sleep,
        signal: options.signal,
        onProgress: options.onProgress
      });
      analysis = analyzed.report;
      manifest.analysis.completed = true;
      manifest.analysis.model = analysis.model;
      await writeJson(files.visualReport, analysis);
      const batchesDir = path.join(jobDir, 'analysis-batches');
      await ensureDir(batchesDir);
      for (let index = 0; index < analyzed.batches.length; index += 1) {
        await writeJson(
          path.join(batchesDir, `batch-${String(index + 1).padStart(3, '0')}.json`),
          analyzed.batches[index]
        );
      }
    } catch (error) {
      analysisError = error;
      manifest.analysis.error = error.message;
      warnings.push(`El análisis visual falló: ${error.message}`);
      await writeJson(path.join(jobDir, 'visual-analysis-error.json'), {
        generatedAt: new Date().toISOString(),
        message: error.message
      });
    }
  }

  const handoff = buildRemotionHandoff(manifest, analysis);
  await writeJson(files.manifest, manifest);
  await writeJson(files.remotionHandoff, handoff);
  await writeFile(files.readme, markdownReport(manifest, analysis, handoff), 'utf8');
  options.onProgress?.({stage: 'complete', message: 'Scouting visual completado'});
  return {
    id,
    jobDir,
    manifest,
    analysis,
    analysisError: analysisError?.message ?? null,
    handoff,
    files
  };
}
