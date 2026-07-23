#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

function parseArgs(argv) {
  const result = {dryRun: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta el valor de --${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

function usage() {
  console.log('Uso: node refine-clips.mjs --job <job-id> --spec <clips.json> [--dry-run]');
}

function captionsInside(captions, start, end) {
  return captions.filter((caption) => Number(caption.end) > start && Number(caption.start) < end);
}

function applyEditorialFields(clip, item, captions) {
  const selected = captionsInside(captions, Number(item.start), Number(item.end));
  if (!selected.length) throw new Error(`${clip.id}: el rango no contiene transcripción`);
  clip.text = selected.map((caption) => caption.text).join(' ').replace(/\s+/g, ' ').trim();
  clip.sourceCaptionIds = selected.map((caption) => caption.id).filter(Boolean);
  if (Number.isFinite(Number(item.rank))) clip.rank = Number(item.rank);
  if (!item.title) return;
  clip.suggestedTitle = String(item.title).trim();
  if (!clip.publishing) return;
  clip.publishing.title = clip.suggestedTitle;
  clip.publishing.titleVariants = [
    clip.suggestedTitle,
    ...(clip.publishing.titleVariants ?? []).filter((title) => title !== clip.suggestedTitle)
  ].slice(0, 5);
  if (clip.publishing.youtube_shorts) {
    clip.publishing.youtube_shorts.title = clip.suggestedTitle;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.job || !args.spec) {
    usage();
    process.exitCode = 1;
    return;
  }

  const projectRoot = process.cwd();
  const pipelineFile = path.join(projectRoot, 'src', 'lib', 'pipeline.js');
  if (!existsSync(pipelineFile)) {
    throw new Error('Ejecuta este script desde la raíz de D:\\2-YOUTUBE-EDIT');
  }

  const specFile = path.resolve(String(args.spec));
  const rawSpec = JSON.parse(await readFile(specFile, 'utf8'));
  const items = Array.isArray(rawSpec) ? rawSpec : rawSpec.clips;
  if (!Array.isArray(items) || !items.length) throw new Error('La especificación debe contener un array de clips');

  const {loadJobState, rerenderClip, saveJobState} = await import(pathToFileURL(pipelineFile).href);
  const state = await loadJobState(String(args.job));
  const transcriptFile = path.join(state.jobDir, 'transcript.json');
  const captions = JSON.parse(await readFile(transcriptFile, 'utf8'));

  for (const item of items) {
    const clip = (state.clips ?? []).find((candidate) => candidate.id === item.clipId);
    if (!clip) throw new Error(`Clip no encontrado: ${item.clipId}`);
    const start = Number(item.start);
    const end = Number(item.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      throw new Error(`${clip.id}: rango inválido`);
    }
    if (end > Number(state.media?.duration ?? 0) || end - start > 180) {
      throw new Error(`${clip.id}: rango fuera del vídeo o superior a 180 segundos`);
    }

    const title = String(item.title ?? clip.suggestedTitle ?? '').trim();
    console.log(`${args.dryRun ? '[DRY]' : '[RENDER]'} #${item.rank ?? clip.rank} ${clip.id} ${start.toFixed(2)}-${end.toFixed(2)} ${title}`);
    if (args.dryRun) continue;

    applyEditorialFields(clip, item, captions);
    await rerenderClip(state, clip.id, {
      start,
      end,
      subtitleMode: item.subtitleMode ?? 'progressive',
      subtitleStyle: {preset: item.subtitlePreset ?? 'progressive-punchy'},
      renderQuality: item.quality ?? 'high',
      ...(item.renderMode ? {renderMode: item.renderMode} : {}),
      ...(item.webcamBox ? {webcamBox: item.webcamBox} : {})
    });
  }

  if (!args.dryRun) {
    state.clips.sort((a, b) => Number(a.rank ?? 999) - Number(b.rank ?? 999));
    await saveJobState(state);
    console.log(`Listo: ${state.outputDir}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
