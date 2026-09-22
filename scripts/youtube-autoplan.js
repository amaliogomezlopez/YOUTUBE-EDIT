#!/usr/bin/env node
import path from 'node:path';
import {parseArgs} from 'node:util';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {ffprobe} from '../src/lib/ffmpeg.js';
import {planEdit, compileEditPlan, orderTakes} from '../src/modules/youtube-studio/autoplan.js';
import {buildIntentMessages, retrieveExamples, validateIntents, sentencesOf} from '../src/modules/youtube-studio/intents.js';
import {chatJson} from '../src/lib/llm.js';
import {askAgy} from '../src/lib/agent-cli.js';
import {loadDotEnv} from '../src/lib/utils.js';
import {evaluatePlan, summarizeEvaluation} from '../src/modules/youtube-studio/evaluate.js';
import {qaRender} from '../src/modules/youtube-studio/qa.js';
import {toFcpxml, readFcpxml, diffTimelines} from '../src/modules/youtube-studio/fcpxml.js';
import {resolveBrandKit} from '../src/modules/editorial-memory/kit.js';
import {detectSilences} from '../src/modules/video-studio/silences.js';
import {existsSync} from 'node:fs';
import sharp from 'sharp';
import {captureXPost, captureWebPage} from '../src/modules/video-studio/asset-sourcing.js';

const CHROME = path.resolve('remotion-animations/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');

const CORPUS = path.resolve('data/editorial-memory/corpus');
const USAGE = `Uso:
  youtube-autoplan capture --url URL... [--urls FILE] --output DIR
  youtube-autoplan plan --project DIR --output DIR [--profile JSON] [--exclude ID]... [--intents JSON | --llm | --agent agy [--agent-model M]] [--assets assets.json]
  youtube-autoplan qa --video MP4 --plan edit-plan.json --output DIR
  youtube-autoplan export --plan render-plan.json --output TIMELINE.fcpxml
  youtube-autoplan corrections --plan render-plan.json --edited EDITADO.fcpxml --output JSON
  youtube-autoplan evaluate --plan edit-plan.json --edit corpus/edits/ID.json --output JSON`;
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

try {
  const {values: v, positionals: p} = parseArgs({allowPositionals: true, options: {
    project: {type: 'string'}, output: {type: 'string'}, profile: {type: 'string'}, exclude: {type: 'string', multiple: true},
    intents: {type: 'string'}, llm: {type: 'boolean'}, agent: {type: 'string'}, 'agent-model': {type: 'string'}, assets: {type: 'string'}, url: {type: 'string', multiple: true}, urls: {type: 'string'}, plan: {type: 'string'}, edit: {type: 'string'}, video: {type: 'string'}, edited: {type: 'string'}}});
  if (p[0] === 'capture') {
    if (!v.output || !(v.url?.length || v.urls)) throw Error(USAGE);
    const urls = [...(v.url ?? []), ...(v.urls ? (await readFile(v.urls, 'utf8')).match(/https:\/\/[^\s)>"']+/g) ?? [] : [])];
    const dir = path.resolve(v.output), assets = [], pending = [];
    for (const url of [...new Set(urls)]) {
      try {
        const asset = /^https:\/\/(x|twitter)\.com\/[^/]+\/status\//.test(url)
          ? await captureXPost(url, {dir, chrome: CHROME, sharp})
          : await captureWebPage(url, {dir, chrome: CHROME});
        const {width, height} = await sharp(asset.file).metadata();
        assets.push({id: 'asset-' + (assets.length + 1), kind: 'image', file: asset.file, width, height, name: asset.text || url, text: asset.text, url});
      } catch (error) {
        pending.push({url, reason: error.message});
      }
    }
    await writeFile(path.join(dir, 'assets.json'), JSON.stringify({version: 1, assets, pending}, null, 2) + '\n');
    console.log(JSON.stringify({captured: assets.length, pending}, null, 2));
  } else if (p[0] === 'plan') {
    if (!v.project || !v.output) throw Error(USAGE);
    const project = path.resolve(v.project);
    const manifest = await readJson(path.join(project, 'manifest.json'));
    const clips = [];
    // Silences reveal false starts the transcriber merged away; cached next to the manifest.
    const silencesFile = path.join(project, 'silences.json');
    const cached = existsSync(silencesFile) ? await readJson(silencesFile) : {};
    for (const clip of manifest.clips) {
      const media = path.resolve('remotion-animations/public', clip.file);
      cached[clip.id] ??= await detectSilences(media, {duration: clip.durationSeconds});
      clips.push({...clip, silences: cached[clip.id], words: clip.transcript ? (await readJson(path.join(project, clip.transcript))).words : []});
    }
    await writeFile(silencesFile, JSON.stringify(cached, null, 2) + '\n');
    const profile = (await readJson(v.profile ?? path.join(CORPUS, 'style-profile.json'))).horizontal;
    // The kit follows the same hold-out as the profile: a video never supplies its own material.
    const excluded = new Set([...(v.exclude ?? []), ...(profile.excluded ?? [])]);
    const edits = [];
    for (const name of await readdir(path.join(CORPUS, 'edits'))) {
      const edit = await readJson(path.join(CORPUS, 'edits', name));
      if (edit.format === 'horizontal' && !excluded.has(edit.project)) edits.push(edit);
    }
    const probe = async (file) => {
      const info = await ffprobe(file);
      return {duration: info.duration, width: info.width, height: info.height};
    };
    const kit = await resolveBrandKit(edits, {probe, readFile});
    let intents = v.intents ? await readJson(v.intents) : {};
    if (v.agent && v.agent !== 'agy') throw Error('Agente no soportado: ' + v.agent);
    if (v.llm || v.agent) {
      // Examples from held-out videos never reach the prompt.
      const bank = [];
      for (const name of await readdir(path.join(CORPUS, 'examples'))) {
        const file = await readJson(path.join(CORPUS, 'examples', name));
        if (!excluded.has(file.project)) bank.push(...file.examples.filter((e) => e.type !== 'none'));
      }
      const {takes} = orderTakes(clips);
      const text = takes.flatMap(sentencesOf).map((s) => s.text).join(' ');
      await loadDotEnv();
      try {
        const messages = buildIntentMessages({takes, examples: retrieveExamples(bank, text)});
        if (v.agent) {
          const answer = await askAgy(messages.map((m) => m.content).join('\n\n'), v['agent-model'] ? {model: v['agent-model']} : {});
          intents = {...validateIntents(answer.json, takes), examples: bank.length, source: 'agy', model: v['agent-model'] ?? 'gemini-3.8-flash-medium', usage: answer.usage, seconds: answer.seconds};
        } else {
          const raw = await chatJson(messages, {temperature: 0.2, maxTokens: 4000});
          intents = {...validateIntents(raw, takes), examples: bank.length};
        }
      } catch (error) {
        // Same contract as the rest of Shortsmith: without an LLM the plan falls back to rules and says so.
        intents = {source: 'fallback', warning: 'LLM no disponible: ' + error.message};
      }
    }
    // Files from the take folder's assets/ subfolder join the captured ones; images need their size.
    const folderAssets = [];
    for (const asset of manifest.assets ?? []) {
      const size = asset.kind === 'image' ? await sharp(path.resolve('remotion-animations/public', asset.file)).metadata() : {};
      folderAssets.push({...asset, width: asset.width ?? size.width, height: asset.height ?? size.height});
    }
    const assets = [...folderAssets, ...(v.assets ? (await readJson(v.assets)).assets : [])];
    const plan = planEdit({clips, profile, kit, intents, assets});
    if (intents.warning) plan.warnings.push(intents.warning);
    const renderPlan = compileEditPlan(plan, {clips, kit, assets});
    await mkdir(v.output, {recursive: true});
    for (const [name, value] of [['edit-plan.json', plan], ['render-plan.json', renderPlan], ['kit.json', kit], ['intents.json', intents], ['pending-assets.json', plan.pendingAssets]]) {
      await writeFile(path.join(v.output, name), JSON.stringify(value, null, 2) + '\n', {flag: 'wx'});
    }
    const counts = {};
    for (const d of plan.decisions) counts[d.type] = (counts[d.type] ?? 0) + 1;
    console.log(JSON.stringify({output: path.resolve(v.output), duration: plan.duration, segments: plan.segments.length, decisions: counts, pendingAssets: plan.pendingAssets, warnings: plan.warnings}, null, 2));
  } else if (p[0] === 'qa') {
    if (!v.video || !v.plan || !v.output) throw Error(USAGE);
    const plan = await readJson(v.plan);
    const report = await qaRender({file: v.video, plan, expected: {width: 1920, height: 1080, duration: plan.duration}, outDir: v.output, sharp});
    await writeFile(path.join(v.output, 'qa.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({passed: report.passed, errors: report.errors, warnings: report.warnings, loudness: report.metrics.loudness, reviewSheet: report.reviewSheet}, null, 2));
    if (!report.passed) process.exitCode = 2;
  } else if (p[0] === 'export' || p[0] === 'corrections') {
    if (!v.plan || !v.output || (p[0] === 'corrections' && !v.edited)) throw Error(USAGE);
    const plan = await readJson(v.plan);
    const resolveFile = (file) => (path.isAbsolute(file) ? file : path.resolve('remotion-animations/public', file));
    // Real media durations: editors reject assets that claim to be longer than the file.
    const durations = {};
    for (const layer of plan.layers) {
      const file = resolveFile(layer.file);
      if (layer.type === 'text') continue;
      if (layer.type !== 'image' && !(file in durations)) durations[file] = (await ffprobe(file)).duration;
    }
    const xml = toFcpxml(plan, {name: path.basename(path.dirname(path.resolve(v.plan))), resolveFile, durations});
    if (p[0] === 'export') {
      await writeFile(v.output, xml, {flag: 'wx'});
      console.log(JSON.stringify({output: path.resolve(v.output), clips: readFcpxml(xml).length}, null, 2));
    } else {
      // The editor's corrected timeline against what was proposed: evidence, pending until promoted.
      const changes = diffTimelines(readFcpxml(xml), readFcpxml(await readFile(v.edited, 'utf8')));
      const record = {version: 1, kind: 'timeline-corrections', plan: path.resolve(v.plan), edited: path.resolve(v.edited), createdAt: new Date().toISOString(),
        scope: 'this-example', approval: 'pending', changes};
      await writeFile(v.output, JSON.stringify(record, null, 2) + '\n', {flag: 'wx'});
      const counts = {};
      for (const c of changes) counts[c.type] = (counts[c.type] ?? 0) + 1;
      console.log(JSON.stringify({output: path.resolve(v.output), changes: counts}, null, 2));
    }
  } else if (p[0] === 'evaluate') {
    if (!v.plan || !v.edit || !v.output) throw Error(USAGE);
    const result = evaluatePlan(await readJson(v.plan), await readJson(v.edit));
    await writeFile(v.output, JSON.stringify(result, null, 2) + '\n', {flag: 'wx'});
    console.log(summarizeEvaluation(result));
  } else throw Error(USAGE);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
