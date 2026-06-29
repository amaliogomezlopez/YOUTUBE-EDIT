#!/usr/bin/env node
import {existsSync} from 'node:fs';
import path from 'node:path';
import {ensureDataDirs, loadDotEnv, parseCliArgs} from './lib/utils.js';
import {processVideo} from './lib/pipeline.js';

function usage() {
  console.log(`Shortsmith MVP

Usage:
  npm run process -- --video path/to/video.mp4 --transcript path/to/transcript.srt --top 5

Options:
  --video         Required. Source video.
  --transcript    Optional SRT, VTT, JSON, or plain text transcript.
  --top           Number of shorts to render. Default: 8.
  --min           Minimum clip duration in seconds. Default: 18.
  --max           Maximum clip duration in seconds. Default: 60.
  --render-mode   crop, fit, or pip. Default: pip for horizontal videos, crop for vertical.
  --quality       draft, standard, or high. Default: high.
  --subtitle-mode words or lines. Default: words.
  --stt-provider  openai, faster-whisper, whisper-cli, or nemotron when no transcript is provided.
  --stt-model     Optional transcription model.
  --stt-language  Optional language, e.g. es or auto.
  --no-llm        Disable LLM enrichment even if env vars exist.
`);
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === '-h') {
    usage();
    return;
  }
  if (command !== 'process') {
    throw new Error(`Unknown command: ${command}`);
  }
  const args = parseCliArgs(rest);
  await loadDotEnv();
  if (!args.video) {
    usage();
    process.exitCode = 1;
    return;
  }
  const video = path.resolve(String(args.video));
  const transcript = args.transcript ? path.resolve(String(args.transcript)) : null;
  if (!existsSync(video)) throw new Error(`Video not found: ${video}`);
  if (transcript && !existsSync(transcript)) throw new Error(`Transcript not found: ${transcript}`);

  await ensureDataDirs();
  console.log('Processing video...');
  const result = await processVideo({
    videoFile: video,
    transcriptFile: transcript,
    options: {
      topN: Number(args.top ?? 8),
      minDuration: Number(args.min ?? 18),
      maxDuration: Number(args.max ?? 60),
      renderMode: args['render-mode'],
      renderQuality: args.quality ?? 'high',
      subtitleMode: args['subtitle-mode'] ?? 'words',
      sttProvider: args['stt-provider'],
      sttModel: args['stt-model'],
      sttLanguage: args['stt-language'],
      useLlm: !args['no-llm']
    }
  });
  console.log(`Done: ${result.id}`);
  console.log(`Output: ${result.outputDir}`);
  for (const clip of result.clips) {
    console.log(`#${clip.rank} score=${clip.viralScore} ${clip.files.video}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
