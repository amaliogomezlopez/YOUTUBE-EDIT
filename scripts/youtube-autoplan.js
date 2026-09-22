#!/usr/bin/env node
import path from 'node:path';
import {parseArgs} from 'node:util';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {ffprobe} from '../src/lib/ffmpeg.js';
import {planEdit, compileEditPlan, orderTakes} from '../src/modules/youtube-studio/autoplan.js';
import {buildIntentMessages, retrieveExamples, validateIntents, sentencesOf} from '../src/modules/youtube-studio/intents.js';
import {chatJson} from '../src/lib/llm.js';
import {loadDotEnv} from '../src/lib/utils.js';
import {evaluatePlan, summarizeEvaluation} from '../src/modules/youtube-studio/evaluate.js';
import {resolveBrandKit} from '../src/modules/editorial-memory/kit.js';
import {detectSilences} from '../src/modules/video-studio/silences.js';
import {existsSync} from 'node:fs';
import sharp from 'sharp';
import {captureXPost, captureWebPage} from '../src/modules/video-studio/asset-sourcing.js';

const CHROME = path.resolve('remotion-animations/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe');

const CORPUS = path.resolve('data/editorial-memory/corpus');
const USAGE = `Uso:
  youtube-autoplan capture --url URL... [--urls FILE] --output DIR
  youtube-autoplan plan --project DIR --output DIR [--profile JSON] [--exclude ID]... [--intents JSON | --llm] [--assets assets.json]
  youtube-autoplan evaluate --plan edit-plan.json --edit corpus/edits/ID.json --output JSON`;
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

try {
  const {values: v, positionals: p} = parseArgs({allowPositionals: true, options: {
    project: {type: 'string'}, output: {type: 'string'}, profile: {type: 'string'}, exclude: {type: 'string', multiple: true},
    intents: {type: 'string'}, llm: {type: 'boolean'}, assets: {type: 'string'}, url: {type: 'string', multiple: true}, urls: {type: 'string'}, plan: {type: 'string'}, edit: {type: 'string'}}});
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
    if (v.llm) {
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
        const raw = await chatJson(buildIntentMessages({takes, examples: retrieveExamples(bank, text)}), {temperature: 0.2, maxTokens: 4000});
        intents = {...validateIntents(raw, takes), examples: bank.length};
      } catch (error) {
        // Same contract as the rest of Shortsmith: without an LLM the plan falls back to rules and says so.
        intents = {source: 'fallback', warning: 'LLM no disponible: ' + error.message};
      }
    }
    const assets = v.assets ? (await readJson(v.assets)).assets : [];
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
