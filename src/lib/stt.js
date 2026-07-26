import {existsSync, readdirSync} from 'node:fs';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ffprobe} from './ffmpeg.js';
import {ROOT, run} from './utils.js';

const DEFAULT_CHUNK_SECONDS = 10 * 60;
const DEFAULT_OVERLAP_SECONDS = 3;
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000;
const DEFAULT_LOCAL_TIMEOUT_MS = 60 * 60 * 1000;
const DEFAULT_RETRIES = 2;
const FASTER_WHISPER_SCRIPT = fileURLToPath(new URL('../../scripts/faster-whisper-local.py', import.meta.url));
const HF_MODEL_CACHE_KEYS = Object.freeze({
  small: 'models--Systran--faster-whisper-small',
  medium: 'models--Systran--faster-whisper-medium',
  'large-v3': 'models--Systran--faster-whisper-large-v3',
  'large-v3-turbo': 'models--mobiuslabsgmbh--faster-whisper-large-v3-turbo',
  turbo: 'models--mobiuslabsgmbh--faster-whisper-large-v3-turbo'
});

function env(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : '';
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (value != null && typeof value !== 'string') return value;
  }
  return '';
}

function positiveNumber(value, fallback, {allowZero = false} = {}) {
  if (value === '' || value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || (allowZero ? parsed < 0 : parsed <= 0)) return fallback;
  return parsed;
}

function nonNegativeInteger(value, fallback) {
  if (value === '' || value == null) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getSttConfig(overrides = {}) {
  return {
    provider: firstNonEmpty(overrides.provider, env('TRANSCRIPTION_PROVIDER'), env('STT_PROVIDER'), 'off'),
    model: firstNonEmpty(overrides.model, env('TRANSCRIPTION_MODEL'), env('WHISPER_MODEL')),
    language: firstNonEmpty(overrides.language, env('TRANSCRIPTION_LANGUAGE'), env('WHISPER_LANGUAGE'))
  };
}

export function getSttRuntimeConfig(overrides = {}) {
  const stt = getSttConfig(overrides);
  const chunkSeconds = positiveNumber(
    firstNonEmpty(overrides.chunkSeconds, env('TRANSCRIPTION_CHUNK_SECONDS'), env('STT_CHUNK_SECONDS')),
    DEFAULT_CHUNK_SECONDS
  );
  const requestedOverlap = positiveNumber(
    firstNonEmpty(overrides.overlapSeconds, env('TRANSCRIPTION_CHUNK_OVERLAP_SECONDS'), env('STT_CHUNK_OVERLAP_SECONDS')),
    DEFAULT_OVERLAP_SECONDS,
    {allowZero: true}
  );
  return {
    ...stt,
    chunkSeconds,
    overlapSeconds: Math.min(requestedOverlap, Math.max(0, chunkSeconds - 0.1)),
    timeoutMs: positiveNumber(
      firstNonEmpty(overrides.timeoutMs, env('TRANSCRIPTION_TIMEOUT_MS'), env('STT_TIMEOUT_MS')),
      stt.provider === 'faster-whisper' || stt.provider === 'whisper-cli' ? DEFAULT_LOCAL_TIMEOUT_MS : DEFAULT_TIMEOUT_MS
    ),
    retries: nonNegativeInteger(
      firstNonEmpty(overrides.retries, env('TRANSCRIPTION_RETRIES'), env('STT_RETRIES')),
      DEFAULT_RETRIES
    )
  };
}

export function buildAudioChunks(duration, chunkSeconds = DEFAULT_CHUNK_SECONDS, overlapSeconds = DEFAULT_OVERLAP_SECONDS) {
  const total = positiveNumber(duration, 0, {allowZero: true});
  const size = positiveNumber(chunkSeconds, DEFAULT_CHUNK_SECONDS);
  const overlap = Math.min(positiveNumber(overlapSeconds, 0, {allowZero: true}), Math.max(0, size - 0.1));
  if (!total) return [];
  if (total <= size) return [{index: 0, start: 0, end: total, duration: total}];
  const chunks = [];
  const step = size - overlap;
  for (let start = 0, index = 0; start < total; start += step, index += 1) {
    const end = Math.min(total, start + size);
    chunks.push({index, start, end, duration: end - start});
    if (end >= total) break;
  }
  return chunks;
}

function normalizeText(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function trimRepeatedPrefix(previousText, currentText) {
  const previousWords = String(previousText ?? '').trim().split(/\s+/).filter(Boolean);
  const currentWords = String(currentText ?? '').trim().split(/\s+/).filter(Boolean);
  const max = Math.min(previousWords.length, currentWords.length);
  for (let count = max; count >= 3; count -= 1) {
    const suffix = normalizeText(previousWords.slice(-count).join(' '));
    const prefix = normalizeText(currentWords.slice(0, count).join(' '));
    if (suffix === prefix) return {text: currentWords.slice(count).join(' '), removedWords: count};
  }
  return {text: String(currentText ?? '').trim(), removedWords: 0};
}

function rebaseWords(words, offset) {
  if (!Array.isArray(words)) return undefined;
  const rebased = words.map((word, index) => {
    const start = Number(word.start);
    const end = Number(word.end);
    const text = String(word.text ?? word.word ?? '').trim();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) return null;
    return {
      ...word,
      id: word.id ?? `word-${index + 1}`,
      start: Math.max(0, start + offset),
      end: Math.max(0, end + offset),
      text
    };
  }).filter(Boolean);
  return rebased.length ? rebased : undefined;
}

export function mergeTranscriptChunks(results, {overlapSeconds = DEFAULT_OVERLAP_SECONDS} = {}) {
  const merged = [];
  for (const result of results) {
    const offset = Number(result.start) || 0;
    for (const raw of result.segments ?? []) {
      const localStart = Number(raw.start);
      const localEnd = Number(raw.end);
      const text = String(raw.text ?? '').trim();
      if (!Number.isFinite(localStart) || !Number.isFinite(localEnd) || localEnd <= localStart || !text) continue;
      const words = rebaseWords(raw.words, offset);
      const segment = {
        ...raw,
        start: Math.max(0, localStart + offset),
        end: Math.max(0, localEnd + offset),
        text,
        ...(words ? {words} : {})
      };
      const recent = merged.slice(-8);
      const duplicate = recent.find((candidate) => {
        const nearby = segment.start <= candidate.end + overlapSeconds + 1 && segment.end >= candidate.start - overlapSeconds - 1;
        return nearby && normalizeText(candidate.text) === normalizeText(segment.text);
      });
      if (duplicate) {
        duplicate.end = Math.max(duplicate.end, segment.end);
        continue;
      }
      const previous = merged.at(-1);
      if (previous && segment.start <= previous.end + overlapSeconds + 1) {
        const trimmed = trimRepeatedPrefix(previous.text, segment.text);
        if (!trimmed.text) continue;
        if (trimmed.text !== segment.text) {
          const originalWords = segment.text.split(/\s+/).length;
          const remainingWords = trimmed.text.split(/\s+/).length;
          const removedRatio = (originalWords - remainingWords) / originalWords;
          if (segment.words?.length) {
            segment.words = segment.words.slice(trimmed.removedWords);
            segment.start = segment.words[0]?.start ?? Math.min(segment.end, segment.start + ((segment.end - segment.start) * removedRatio));
          } else {
            segment.start = Math.min(segment.end, segment.start + ((segment.end - segment.start) * removedRatio));
          }
          segment.text = trimmed.text;
        }
      }
      merged.push(segment);
    }
  }
  return merged
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((segment, index) => ({
      ...segment,
      id: `seg-${index + 1}`,
      ...(segment.words?.length ? {
        words: segment.words.map((word, wordIndex) => ({...word, id: `seg-${index + 1}-word-${wordIndex + 1}`}))
      } : {})
    }));
}

function retryableStatus(status) {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(operation, {retries, retryDelayMs = 250}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;
      if (error.retryable === false || error.name === 'AbortError' || error.code === 'ABORT_ERR' || attempt >= retries) throw error;
      await delay(retryDelayMs * (2 ** attempt));
    }
  }
  throw lastError;
}

async function fetchWithTimeout(url, init, {timeoutMs, fetchImpl = globalThis.fetch, signal: externalSignal}) {
  const controller = new AbortController();
  let timedOut = false;
  const relayAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal?.aborted) relayAbort();
  else externalSignal?.addEventListener('abort', relayAbort, {once: true});
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new Error(`STT request timed out after ${timeoutMs} ms`));
  }, timeoutMs);
  try {
    return await fetchImpl(url, {...init, signal: controller.signal});
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(`STT request timed out after ${timeoutMs} ms`);
      timeoutError.code = 'ETIMEDOUT';
      throw timeoutError;
    }
    if (externalSignal?.aborted) error.retryable = false;
    throw error;
  } finally {
    clearTimeout(timer);
    externalSignal?.removeEventListener('abort', relayAbort);
  }
}

export async function transcribeAudio(audioFile, options = {}) {
  const config = getSttRuntimeConfig(options);
  if (!['openai', 'whisper-cli', 'faster-whisper', 'nemotron'].includes(config.provider)) {
    throw new Error('No transcript was provided and STT_PROVIDER is off. Provide --transcript or set STT_PROVIDER=openai, faster-whisper, or nemotron.');
  }

  const probe = options.probe ?? ffprobe;
  const media = await probe(audioFile);
  const chunks = buildAudioChunks(media.duration, config.chunkSeconds, config.overlapSeconds);
  if (chunks.length <= 1) return transcribeWithProvider(audioFile, {...options, ...config});

  const workspace = await (options.makeTempDir ?? mkdtemp)(path.join(tmpdir(), 'shortsmith-stt-'));
  const results = [];
  try {
    for (const chunk of chunks) {
      options.signal?.throwIfAborted();
      const chunkFile = path.join(workspace, `chunk-${String(chunk.index + 1).padStart(4, '0')}.wav`);
      await (options.createChunk ?? createAudioChunk)(audioFile, chunkFile, chunk, options);
      const segments = options.transcribeChunk
        ? await options.transcribeChunk(chunkFile, chunk, {...options, ...config, outDir: workspace})
        : await transcribeWithProvider(chunkFile, {...options, ...config, outDir: workspace});
      results.push({...chunk, segments});
    }
    return mergeTranscriptChunks(results, {overlapSeconds: config.overlapSeconds});
  } finally {
    await (options.cleanup ?? rm)(workspace, {recursive: true, force: true});
  }
}

async function createAudioChunk(audioFile, outputFile, chunk, options = {}) {
  const runCommand = options.runCommand ?? run;
  await runCommand('ffmpeg', [
    '-y', '-ss', String(chunk.start), '-i', audioFile, '-t', String(chunk.duration),
    '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', outputFile
  ], {timeoutMs: getSttRuntimeConfig(options).timeoutMs, signal: options.signal});
}

function transcribeWithProvider(audioFile, options) {
  if (options.provider === 'openai') return transcribeOpenAi(audioFile, options);
  if (options.provider === 'faster-whisper' && !options.command) return transcribeFasterWhisperLocal(audioFile, options);
  if (options.provider === 'whisper-cli' || options.provider === 'faster-whisper') return transcribeWhisperCli(audioFile, options);
  return transcribeNemotron(audioFile, options);
}

async function transcribeOpenAi(audioFile, options = {}) {
  const apiKey = firstNonEmpty(options.apiKey, env('OPENAI_API_KEY'));
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for STT_PROVIDER=openai.');
  const model = firstNonEmpty(options.model, env('OPENAI_TRANSCRIBE_MODEL'), 'gpt-4o-mini-transcribe');
  return withRetries(async () => {
    const form = new FormData();
    const audioBuffer = await readFile(audioFile);
    form.set('file', new Blob([audioBuffer]), path.basename(audioFile));
    form.set('model', model);
    form.set('response_format', 'verbose_json');
    form.append('timestamp_granularities[]', 'segment');
    const response = await fetchWithTimeout('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: {authorization: `Bearer ${apiKey}`}, body: form
    }, options);
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`OpenAI transcription failed (${response.status}): ${body.slice(0, 500)}`);
      error.retryable = retryableStatus(response.status);
      throw error;
    }
    const json = await response.json();
    return (json.segments ?? []).map((segment, index) => ({
      id: `seg-${index + 1}`, start: Number(segment.start), end: Number(segment.end),
      text: String(segment.text ?? '').trim(), speaker: null, confidence: null
    })).filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text);
  }, options);
}

async function transcribeWhisperCli(audioFile, options = {}) {
  const config = getSttRuntimeConfig(options);
  const outDir = options.outDir ?? path.dirname(audioFile);
  const command = options.command || env('FASTER_WHISPER_COMMAND') || env('WHISPER_COMMAND') || 'whisper';
  const args = [audioFile, '--output_format', 'json', '--output_dir', outDir];
  if (config.model) args.push('--model', config.model);
  if (config.language && config.language !== 'auto') args.push('--language', config.language);
  args.push('--word_timestamps', 'True');
  await withRetries(() => (options.runCommand ?? run)(command, args, {timeoutMs: config.timeoutMs, signal: options.signal}), config);
  const output = path.join(outDir, `${path.basename(audioFile, path.extname(audioFile))}.json`);
  const {parseJsonTranscript} = await import('./transcript.js');
  return parseJsonTranscript(await readFile(output, 'utf8'));
}

function fasterWhisperPython(options = {}) {
  const configured = firstNonEmpty(options.python, env('FASTER_WHISPER_PYTHON'));
  if (configured) return configured;
  const local = process.platform === 'win32'
    ? path.join(ROOT, '.venv-whisper', 'Scripts', 'python.exe')
    : path.join(ROOT, '.venv-whisper', 'bin', 'python');
  return existsSync(local) ? local : (process.platform === 'win32' ? 'python' : 'python3');
}

function isCompleteFasterWhisperModel(directory) {
  const requiredFiles = ['model.bin', 'config.json', 'tokenizer.json'];
  const hasVocabulary = existsSync(path.join(directory, 'vocabulary.txt')) || existsSync(path.join(directory, 'vocabulary.json'));
  return hasVocabulary && requiredFiles.every((file) => existsSync(path.join(directory, file)));
}

function cachedHuggingFaceModel(model, options = {}) {
  const cacheKey = HF_MODEL_CACHE_KEYS[model];
  if (!cacheKey) return null;
  const hfHome = firstNonEmpty(env('HF_HOME'), path.join(homedir(), '.cache', 'huggingface'));
  const hubRoot = firstNonEmpty(options.hfHubRoot, env('HF_HUB_CACHE'), env('HUGGINGFACE_HUB_CACHE'), path.join(hfHome, 'hub'));
  const snapshotsRoot = path.join(hubRoot, cacheKey, 'snapshots');
  if (!existsSync(snapshotsRoot)) return null;
  try {
    const snapshots = readdirSync(snapshotsRoot, {withFileTypes: true})
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(snapshotsRoot, entry.name));
    return snapshots.find(isCompleteFasterWhisperModel) ?? null;
  } catch {
    return null;
  }
}

function resolveFasterWhisperModel(model, downloadRoot, options = {}) {
  if (!model || path.isAbsolute(model) || model.includes('/') || model.includes('\\')) return model;
  const localModel = path.join(downloadRoot, model);
  if (isCompleteFasterWhisperModel(localModel)) return localModel;
  return cachedHuggingFaceModel(model, options) ?? model;
}

async function transcribeFasterWhisperLocal(audioFile, options = {}) {
  const config = getSttRuntimeConfig(options);
  const outDir = options.outDir ?? path.dirname(audioFile);
  const output = path.join(outDir, `${path.basename(audioFile, path.extname(audioFile))}.faster-whisper.json`);
  const requestedModel = config.model || env('FASTER_WHISPER_MODEL') || 'small';
  const downloadRoot = firstNonEmpty(options.downloadRoot, env('FASTER_WHISPER_MODEL_DIR'), path.join(ROOT, 'data', 'models', 'faster-whisper'));
  const model = resolveFasterWhisperModel(requestedModel, downloadRoot, options);
  const device = firstNonEmpty(options.device, env('FASTER_WHISPER_DEVICE'), 'cuda');
  const computeType = firstNonEmpty(options.computeType, env('FASTER_WHISPER_COMPUTE_TYPE'), device === 'cpu' ? 'int8' : 'float16');
  const args = [
    FASTER_WHISPER_SCRIPT,
    '--audio', audioFile,
    '--output', output,
    '--model', model,
    '--device', device,
    '--compute-type', computeType,
    '--beam-size', String(nonNegativeInteger(firstNonEmpty(options.beamSize, env('FASTER_WHISPER_BEAM_SIZE')), 5))
  ];
  if (config.language && config.language !== 'auto') args.push('--language', config.language);
  const initialPrompt = firstNonEmpty(options.initialPrompt, env('FASTER_WHISPER_INITIAL_PROMPT'));
  if (initialPrompt) args.push('--initial-prompt', initialPrompt.slice(0, 1200));
  args.push('--download-root', downloadRoot);
  if (options.vadFilter !== false) args.push('--vad-filter');
  try {
    await (options.runCommand ?? run)(fasterWhisperPython(options), args, {
      timeoutMs: config.timeoutMs,
      signal: options.signal,
      env: {PYTHONIOENCODING: 'utf-8'}
    });
  } catch (error) {
    const detail = String(error.stderr || error.message || '').trim().split(/\r?\n/).filter(Boolean).slice(-3).join(' · ');
    throw new Error(`Faster-Whisper local failed${detail ? `: ${detail}` : ''}`);
  }
  const {parseJsonTranscript} = await import('./transcript.js');
  return parseJsonTranscript(await readFile(output, 'utf8'));
}

async function transcribeNemotron(audioFile, options = {}) {
  const url = firstNonEmpty(options.url, env('NEMOTRON_ASR_URL'), env('NEMOTRON_URL'));
  if (!url) throw new Error('NEMOTRON_ASR_URL is required for STT_PROVIDER=nemotron.');
  return withRetries(async () => {
    const form = new FormData();
    const audioBuffer = await readFile(audioFile);
    form.set('file', new Blob([audioBuffer]), path.basename(audioFile));
    const model = firstNonEmpty(options.model, env('NEMOTRON_ASR_MODEL'), env('TRANSCRIPTION_MODEL'));
    const language = firstNonEmpty(options.language, env('TRANSCRIPTION_LANGUAGE'));
    if (model) form.set('model', model);
    if (language && language !== 'auto') form.set('language', language);
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      headers: env('NEMOTRON_ASR_API_KEY') ? {authorization: `Bearer ${env('NEMOTRON_ASR_API_KEY')}`} : undefined,
      body: form
    }, options);
    if (!response.ok) {
      const body = await response.text();
      const error = new Error(`Nemotron transcription failed (${response.status}): ${body.slice(0, 500)}`);
      error.retryable = retryableStatus(response.status);
      throw error;
    }
    const body = await response.text();
    const {parseTranscriptText} = await import('./transcript.js');
    return parseTranscriptText(body, response.headers.get('content-type')?.includes('json') ? 'nemotron.json' : 'nemotron.srt');
  }, options);
}
