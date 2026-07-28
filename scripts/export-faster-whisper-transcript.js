#!/usr/bin/env node
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

function pad(value, size = 2) {
  return String(value).padStart(size, '0');
}
export function formatSrtTimestamp(seconds) {
  const safe = Math.max(0, Number(seconds) || 0);
  const milliseconds = Math.round(safe * 1000);
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${pad(hours)}:${pad(minutes)}:${pad(secs)},${pad(millis, 3)}`;
}

export function transcriptToSrt(segments) {
  return segments
    .map((segment, index) => [
      index + 1,
      `${formatSrtTimestamp(segment.start)} --> ${formatSrtTimestamp(segment.end)}`,
      String(segment.text ?? '').trim(),
      ''
    ].join('\n'))
    .join('\n');
}

export function flattenTranscriptWords(segments) {
  let index = 0;
  return segments.flatMap((segment) =>
    (segment.words ?? []).map((word) => ({
      index: index++,
      startSeconds: Number(word.start),
      endSeconds: Number(word.end),
      text: String(word.text ?? '').trim(),
      confidence: Number.isFinite(Number(word.confidence))
        ? Number(word.confidence)
        : null,
      segmentId: String(segment.id ?? '')
    }))
  );
}

function parseArgs(argv) {
  const args = {input: '', output: ''};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--input') args.input = argv[++index] ?? '';
    else if (token.startsWith('--input=')) args.input = token.slice(8);
    else if (token === '--output') args.output = argv[++index] ?? '';
    else if (token.startsWith('--output=')) args.output = token.slice(9);
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Opción desconocida: ${token}`);
  }
  return args;
}

async function exportTranscript({input, output}) {
  const inputFile = path.resolve(input);
  const outputDirectory = path.resolve(output || path.dirname(inputFile));
  const payload = JSON.parse(await readFile(inputFile, 'utf8'));
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  if (!segments.length) throw new Error('La transcripción no contiene segmentos.');
  const words = flattenTranscriptWords(segments);
  const base = path.basename(inputFile).replace(/\.json$/i, '');
  const text = segments.map((segment) => String(segment.text ?? '').trim()).join('\n');
  await mkdir(outputDirectory, {recursive: true});
  const outputs = {
    text: path.join(outputDirectory, `${base}.txt`),
    srt: path.join(outputDirectory, `${base}.srt`),
    words: path.join(outputDirectory, `${base}.words.json`)
  };
  await writeFile(outputs.text, `${text}\n`, 'utf8');
  await writeFile(outputs.srt, `${transcriptToSrt(segments)}\n`, 'utf8');
  await writeFile(outputs.words, `${JSON.stringify({
    version: 1,
    language: payload.language ?? null,
    languageProbability: payload.languageProbability ?? null,
    wordCount: words.length,
    words
  }, null, 2)}\n`, 'utf8');
  return outputs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log('Uso: node scripts/export-faster-whisper-transcript.js --input <transcript.json> [--output <dir>]');
    return;
  }
  if (!args.input) throw new Error('Falta --input <transcript.json>.');
  const outputs = await exportTranscript(args);
  for (const [kind, file] of Object.entries(outputs)) {
    console.log(`${kind}: ${file}`);
  }
}

const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isEntryPoint) {
  main().catch((error) => {
    console.error(`Error: ${error.message}`);
    process.exitCode = 1;
  });
}
