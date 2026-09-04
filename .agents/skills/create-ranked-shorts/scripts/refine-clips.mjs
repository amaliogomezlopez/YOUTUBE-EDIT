#!/usr/bin/env node
import {existsSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeJson} from '../../../../src/lib/utils.js';

function parseArgs(argv) {
  const result = {dryRun: false};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') {
      result.dryRun = true;
      continue;
    }
    if (!['--job', '--spec'].includes(arg)) throw new Error(`Argumento desconocido: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Falta el valor de ${arg}`);
    result[arg.slice(2)] = value;
    index += 1;
  }
  return result;
}

function prepareRefinements(state, items, captions) {
  if (!Array.isArray(items) || !items.length) throw new Error('La especificación debe contener un array de clips');
  const seen = new Set();
  return items.map((item) => {
    const clip = (state.clips ?? []).find((candidate) => candidate.id === item?.clipId);
    if (!clip) throw new Error(`Clip no encontrado: ${item?.clipId}`);
    if (seen.has(clip.id)) throw new Error(`Clip duplicado: ${clip.id}`);
    seen.add(clip.id);
    const start = Number(item.start ?? clip.start);
    const end = Number(item.end ?? clip.end);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end - start < 1 || end - start > 180 || !(end <= Number(state.media?.duration))) {
      throw new Error(`${clip.id}: el rango debe durar entre 1 y 180 segundos y quedar dentro del vídeo`);
    }
    if (item.rank !== undefined && (!Number.isInteger(item.rank) || item.rank < 1)) throw new Error(`${clip.id}: rank debe ser un entero positivo`);
    if (item.title !== undefined && (typeof item.title !== 'string' || !item.title.trim())) throw new Error(`${clip.id}: título vacío o inválido`);
    const selected = captions.filter((caption) => Number(caption.end) > start && Number(caption.start) < end);
    if (!selected.length) throw new Error(`${clip.id}: el rango no contiene transcripción`);
    for (const key of ['subtitleStyle', 'editing']) {
      if (item[key] !== undefined && (!item[key] || typeof item[key] !== 'object' || Array.isArray(item[key]))) throw new Error(`${clip.id}: ${key} debe ser un objeto`);
    }
    const edits = {start, end};
    for (const key of ['subtitleMode', 'renderMode', 'webcamBox', 'editing']) {
      if (item[key] !== undefined) edits[key] = item[key];
    }
    if (item.quality !== undefined) edits.renderQuality = item.quality;
    if (item.subtitleStyle !== undefined || item.subtitlePreset !== undefined) {
      edits.subtitleStyle = {...item.subtitleStyle, ...(item.subtitlePreset !== undefined ? {preset: item.subtitlePreset} : {})};
    }
    return {clip, item, edits, sourceCaptionIds: selected.map((caption) => caption.id).filter(Boolean)};
  });
}

function applyEditorialFields(clip, item, sourceCaptionIds) {
  // The renderer owns mounted text, duration and the current artifact paths.
  clip.sourceCaptionIds = sourceCaptionIds;
  if (item.rank !== undefined) clip.rank = item.rank;
  if (item.title === undefined) return;
  clip.suggestedTitle = item.title.trim();
  if (!clip.publishing) return;
  clip.publishing.title = clip.suggestedTitle;
  clip.publishing.titleVariants = [clip.suggestedTitle, ...(clip.publishing.titleVariants ?? []).filter((title) => title !== clip.suggestedTitle)].slice(0, 5);
  if (clip.publishing.youtube_shorts) clip.publishing.youtube_shorts.title = clip.suggestedTitle;
}

export async function refineClips({state, items, captions, dryRun = false, rerenderClip, saveJobState, persistMetadata = writeJson, log = console.log}) {
  // Validate the entire batch before the first render; dry-run uses the same preflight.
  const prepared = prepareRefinements(state, items, captions);
  for (const {clip, item, edits, sourceCaptionIds} of prepared) {
    log(`${dryRun ? '[DRY]' : '[RENDER]'} #${item.rank ?? clip.rank} ${clip.id} ${edits.start.toFixed(2)}-${edits.end.toFixed(2)} ${item.title ?? clip.suggestedTitle ?? ''}`);
    if (dryRun) continue;
    const rendered = await rerenderClip(state, clip.id, edits);
    applyEditorialFields(rendered, item, sourceCaptionIds);
    if (rendered.files?.metadata) await persistMetadata(rendered.files.metadata, rendered);
    state.clips.sort((a, b) => Number(a.rank ?? 999) - Number(b.rank ?? 999));
    // Persist each completed clip even if a later render fails.
    await saveJobState(state);
  }
  if (!dryRun) log(`Listo: ${state.outputDir}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.job || !args.spec) throw new Error('Uso: node refine-clips.mjs --job <job-id> --spec <clips.json> [--dry-run]');
  const pipelineFile = path.join(process.cwd(), 'src', 'lib', 'pipeline.js');
  if (!existsSync(pipelineFile)) throw new Error('Ejecuta este script desde la raíz del proyecto Shortsmith');
  const rawSpec = JSON.parse(await readFile(path.resolve(args.spec), 'utf8'));
  const {loadJobState, rerenderClip, saveJobState} = await import(pathToFileURL(pipelineFile).href);
  const state = await loadJobState(args.job);
  const captions = JSON.parse(await readFile(path.join(state.jobDir, 'transcript.json'), 'utf8'));
  await refineClips({state, items: Array.isArray(rawSpec) ? rawSpec : rawSpec?.clips, captions, dryRun: args.dryRun, rerenderClip, saveJobState});
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
