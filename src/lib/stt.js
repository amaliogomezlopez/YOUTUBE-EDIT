import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {run} from './utils.js';

function env(name) {
  return process.env[name] && process.env[name].trim() ? process.env[name].trim() : '';
}

export async function transcribeAudio(audioFile, options = {}) {
  const provider = options.provider ?? env('TRANSCRIPTION_PROVIDER') ?? env('STT_PROVIDER') ?? 'off';
  if (provider === 'openai') {
    return transcribeOpenAi(audioFile, options);
  }
  if (provider === 'whisper-cli' || provider === 'faster-whisper') {
    return transcribeWhisperCli(audioFile, options);
  }
  if (provider === 'nemotron') {
    return transcribeNemotron(audioFile, options);
  }
  throw new Error('No transcript was provided and STT_PROVIDER is off. Provide --transcript or set STT_PROVIDER=openai, faster-whisper, or nemotron.');
}

async function transcribeOpenAi(audioFile, options = {}) {
  const apiKey = options.apiKey ?? env('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for STT_PROVIDER=openai.');
  const model = options.model ?? env('OPENAI_TRANSCRIBE_MODEL') ?? 'gpt-4o-mini-transcribe';
  const form = new FormData();
  const audioBuffer = await readFile(audioFile);
  form.set('file', new Blob([audioBuffer]), path.basename(audioFile));
  form.set('model', model);
  form.set('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'segment');
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {authorization: `Bearer ${apiKey}`},
    body: form
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI transcription failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const json = await response.json();
  const segments = json.segments ?? [];
  return segments.map((segment, index) => ({
    id: `seg-${index + 1}`,
    start: Number(segment.start),
    end: Number(segment.end),
    text: String(segment.text ?? '').trim(),
    speaker: null,
    confidence: null
  })).filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text);
}

async function transcribeWhisperCli(audioFile, options = {}) {
  const outDir = options.outDir ?? path.dirname(audioFile);
  const command = options.command ?? env('FASTER_WHISPER_COMMAND') ?? env('WHISPER_COMMAND') ?? 'whisper';
  const model = options.model ?? env('TRANSCRIPTION_MODEL') ?? env('WHISPER_MODEL');
  const language = options.language ?? env('TRANSCRIPTION_LANGUAGE') ?? env('WHISPER_LANGUAGE');
  const args = [audioFile, '--output_format', 'json', '--output_dir', outDir];
  if (model) args.push('--model', model);
  if (language && language !== 'auto') args.push('--language', language);
  await run(command, args);
  const output = path.join(outDir, `${path.basename(audioFile, path.extname(audioFile))}.json`);
  const {parseJsonTranscript} = await import('./transcript.js');
  const raw = await readFile(output, 'utf8');
  return parseJsonTranscript(raw);
}

async function transcribeNemotron(audioFile, options = {}) {
  const url = options.url ?? env('NEMOTRON_ASR_URL') ?? env('NEMOTRON_URL');
  if (!url) throw new Error('NEMOTRON_ASR_URL is required for STT_PROVIDER=nemotron.');
  const form = new FormData();
  const audioBuffer = await readFile(audioFile);
  form.set('file', new Blob([audioBuffer]), path.basename(audioFile));
  const model = options.model ?? env('NEMOTRON_ASR_MODEL') ?? env('TRANSCRIPTION_MODEL');
  const language = options.language ?? env('TRANSCRIPTION_LANGUAGE');
  if (model) form.set('model', model);
  if (language && language !== 'auto') form.set('language', language);
  const response = await fetch(url, {
    method: 'POST',
    headers: env('NEMOTRON_ASR_API_KEY') ? {authorization: `Bearer ${env('NEMOTRON_ASR_API_KEY')}`} : undefined,
    body: form
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nemotron transcription failed (${response.status}): ${body.slice(0, 500)}`);
  }
  const body = await response.text();
  const {parseTranscriptText} = await import('./transcript.js');
  return parseTranscriptText(body, response.headers.get('content-type')?.includes('json') ? 'nemotron.json' : 'nemotron.srt');
}
