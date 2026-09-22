#!/usr/bin/env node
import path from 'node:path';
import os from 'node:os';
import {parseArgs} from 'node:util';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {discoverCapcutProjects, loadEditTimeline, normalizeEdit} from '../src/modules/editorial-memory/corpus.js';
import {buildStyleProfile, summarizeStyle, quantiles} from '../src/modules/editorial-memory/style-profile.js';
import {buildDecisionExamples, cutPadding} from '../src/modules/editorial-memory/examples.js';
import {transcribeAudio} from '../src/lib/stt.js';
import {ffprobe} from '../src/lib/ffmpeg.js';
import {loadDotEnv, run} from '../src/lib/utils.js';
import {existsSync} from 'node:fs';
import {detectSilences} from '../src/modules/video-studio/silences.js';

const DEFAULT_ROOT = path.join(os.homedir(), 'AppData/Local/CapCut/User Data/Projects/com.lveditor.draft');
const DEFAULT_OUT = path.resolve('data/editorial-memory/corpus');
const USAGE = 'Uso: editorial-corpus scan [--root DIR] [--out DIR] | profile [--exclude ID]... [--recent N] [--output FILE] [--out DIR] | examples --project ID --export MP4 [--out DIR]';
const slug = (id) => id.replace(/[^\w.-]+/g, '_');

try {
  const {values: v, positionals: p} = parseArgs({allowPositionals: true, options: {root: {type: 'string'}, out: {type: 'string'}, project: {type: 'string'}, export: {type: 'string'},
    exclude: {type: 'string', multiple: true}, recent: {type: 'string'}, output: {type: 'string'}}});
  const out = path.resolve(v.out ?? DEFAULT_OUT);
  if (p[0] === 'scan') {
    // Read-only over CapCut: drafts are parsed from disk, never written.
    const projects = await discoverCapcutProjects(v.root ?? DEFAULT_ROOT);
    await mkdir(path.join(out, 'edits'), {recursive: true});
    const index = [];
    for (const project of projects) {
      try {
        const loaded = await loadEditTimeline(project.dir);
        const edit = normalizeEdit(loaded.timeline, {canvas: loaded.canvas});
        const record = {version: 1, kind: 'normalized-edit', project: project.id, draftFile: loaded.file,
          timelineId: loaded.timeline.id, sourceSha256: loaded.sourceSha256, modifiedAt: loaded.modifiedAt, ...edit};
        const file = path.join(out, 'edits', slug(project.id) + '.json');
        await writeFile(file, JSON.stringify(record, null, 2) + '\n');
        index.push({project: project.id, format: edit.format, duration: edit.duration, segments: loaded.segments, file: path.relative(out, file)});
      } catch (error) {
        index.push({project: project.id, error: error.message});
      }
    }
    await writeFile(path.join(out, 'index.json'), JSON.stringify({version: 1, scannedAt: new Date().toISOString(), projects: index}, null, 2) + '\n');
    for (const row of index) console.log(row.error ? `${row.project}: ${row.error}` : `${row.project.padEnd(14)} ${row.format.padEnd(10)} ${String(Math.round(row.duration)).padStart(5)} s  ${row.segments} segmentos`);
  } else if (p[0] === 'profile') {
    const edits = [];
    for (const name of await readdir(path.join(out, 'edits'))) edits.push(JSON.parse(await readFile(path.join(out, 'edits', name), 'utf8')));
    // Tiny timelines are exports or wrappers, not edits with decisions.
    // --exclude keeps a held-out video out of its own evaluation; --recent follows taste as it evolves.
    const excluded = new Set(v.exclude ?? []);
    const usable = edits.filter((e) => e.takes.length + e.inserts.length >= 5 && !excluded.has(e.project));
    const recent = v.recent ? Number(v.recent) : null;
    if (recent != null && !(Number.isInteger(recent) && recent > 0)) throw Error('--recent debe ser un entero positivo');
    const profiles = {};
    for (const format of ['horizontal', 'vertical']) {
      const pool = usable.filter((e) => e.format === format).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, recent ?? Infinity);
      // Cut padding needs the exported audio (written by `examples`); music sits below -30 dB.
      const padding = {lead: [], tail: [], videos: []};
      for (const edit of pool) {
        const wav = path.join(out, 'transcripts', slug(edit.project) + '.wav');
        if (!existsSync(wav)) continue;
        const {lead, tail} = cutPadding(edit, await detectSilences(wav, {noise: -30, minSeconds: 0.08}));
        padding.lead.push(...lead); padding.tail.push(...tail); padding.videos.push(edit.project);
      }
      const speech = {leadSeconds: quantiles(padding.lead), tailSeconds: quantiles(padding.tail), videos: padding.videos, method: 'silencedetect -30 dB sobre la exportacion'};
      profiles[format] = {...buildStyleProfile(pool, {format}), speech, projects: pool.map((e) => e.project), excluded: [...excluded], recent};
    }
    const summary = Object.values(profiles).filter((x) => x.videos).map(summarizeStyle).join('\n');
    if (v.output) await writeFile(path.resolve(v.output), JSON.stringify(profiles, null, 2) + '\n', {flag: 'wx'});
    else {
      await writeFile(path.join(out, 'style-profile.json'), JSON.stringify(profiles, null, 2) + '\n');
      await writeFile(path.join(out, 'ESTILO.md'), summary);
    }
    console.log(summary);
  } else if (p[0] === 'examples') {
    if (!v.project || !v.export) throw Error(USAGE);
    const edit = JSON.parse(await readFile(path.join(out, 'edits', slug(v.project) + '.json'), 'utf8'));
    // The export shares the edit clock only if it is this edit's export.
    const {duration} = await ffprobe(v.export);
    if (Math.abs(duration - edit.duration) > 0.5) throw Error(`La exportacion dura ${duration.toFixed(2)} s y la edicion ${edit.duration} s: no es la misma pieza`);
    await mkdir(path.join(out, 'transcripts'), {recursive: true});
    await mkdir(path.join(out, 'examples'), {recursive: true});
    const transcriptFile = path.join(out, 'transcripts', slug(v.project) + '.json');
    let words;
    if (existsSync(transcriptFile)) words = JSON.parse(await readFile(transcriptFile, 'utf8')).words;
    else {
      await loadDotEnv();
      const wav = path.join(out, 'transcripts', slug(v.project) + '.wav');
      await run('ffmpeg', ['-v', 'error', '-y', '-i', v.export, '-vn', '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
      const segments = await transcribeAudio(wav, {});
      words = segments.flatMap((segment) => segment.words ?? []).map((w) => ({text: String(w.text ?? w.word ?? '').trim(), start: w.start, end: w.end}));
      await writeFile(transcriptFile, JSON.stringify({version: 1, project: v.project, export: path.resolve(v.export), clock: 'edit', words}, null, 2) + '\n');
    }
    const examples = buildDecisionExamples(edit, words, {project: v.project});
    await writeFile(path.join(out, 'examples', slug(v.project) + '.json'), JSON.stringify({version: 1, project: v.project, approval: 'pending', examples}, null, 2) + '\n');
    const counts = {};
    for (const e of examples) counts[e.type] = (counts[e.type] ?? 0) + 1;
    console.log(JSON.stringify({project: v.project, words: words.length, examples: examples.length, counts}, null, 2));
  } else throw Error(USAGE);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
