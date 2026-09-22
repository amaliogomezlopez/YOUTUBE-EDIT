#!/usr/bin/env node
/**
 * One command from a folder of takes to a reviewed first cut:
 * ingest -> capture -> plan -> package -> render -> QA -> REVIEW.md.
 * Every step is the existing CLI, so an agent can also run them one by one.
 */
import path from 'node:path';
import {parseArgs} from 'node:util';
import {existsSync} from 'node:fs';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {run} from '../src/lib/utils.js';
import {reviewMarkdown} from '../src/modules/youtube-studio/review.js';

const USAGE = 'Uso: npm run edit -- --source DIR --slug SLUG [--urls NOTAS.txt] [--url URL]... [--intents JSON | --llm | --agent agy [--agent-model M]] [--no-render]';
const node = (script, args, {allowFail = false} = {}) => run(process.execPath, [script, ...args], {
  onStdout: (t) => process.stdout.write(t), onStderr: (t) => process.stderr.write(t)
}).catch((error) => {
  if (allowFail) return error;
  throw error;
});

try {
  const {values: v} = parseArgs({options: {source: {type: 'string'}, slug: {type: 'string'}, urls: {type: 'string'}, url: {type: 'string', multiple: true},
    intents: {type: 'string'}, llm: {type: 'boolean'}, agent: {type: 'string'}, 'agent-model': {type: 'string'}, 'no-render': {type: 'boolean'}, profile: {type: 'string'}}});
  if (!v.source || !v.slug) throw Error(USAGE);
  const project = path.join('remotion-animations', 'projects', `youtube-${v.slug}`);
  const out = path.join('data', 'editorial-memory', 'autoplan', v.slug);
  await mkdir(out, {recursive: true});
  const steps = [];

  if (!existsSync(path.join(project, 'manifest.json'))) {
    await node('scripts/youtube-studio.js', ['ingest', '--source', path.resolve(v.source), '--slug', v.slug]);
    steps.push('ingesta');
  } else steps.push('ingesta reutilizada');

  const assetsFile = path.join(out, 'assets', 'assets.json');
  if ((v.urls || v.url?.length) && !existsSync(assetsFile)) {
    await node('scripts/youtube-autoplan.js', ['capture', '--output', path.join(out, 'assets'), ...(v.urls ? ['--urls', v.urls] : []), ...(v.url ?? []).flatMap((u) => ['--url', u])]);
    steps.push('capturas');
  }

  const planDir = path.join(out, 'plan-' + new Date().toISOString().replace(/[:.]/g, '-'));
  await node('scripts/youtube-autoplan.js', ['plan', '--project', project, '--output', planDir,
    ...(v.profile ? ['--profile', v.profile] : []), ...(existsSync(assetsFile) ? ['--assets', assetsFile] : []),
    ...(v.intents ? ['--intents', v.intents] : []), ...(v.llm ? ['--llm'] : []),
    ...(v.agent ? ['--agent', v.agent] : []), ...(v['agent-model'] ? ['--agent-model', v['agent-model']] : [])]);
  steps.push('plan');

  let video = null, qa = null;
  if (!v['no-render']) {
    const prepared = await node('scripts/youtube-render.js', ['prepare', '--project', v.slug, '--render-plan', path.join(planDir, 'render-plan.json')]);
    const pkg = JSON.parse(prepared.stdout.slice(prepared.stdout.indexOf('{'))).package;
    const rendered = await node('scripts/youtube-render.js', ['render', '--project', v.slug, '--package', pkg]);
    video = /Final MP4: ([^\r\n]+)/.exec(rendered.stdout)?.[1] ?? null;
    if (!video) throw Error('El render no devolvio MP4');
    const qaDir = path.join(planDir, 'qa');
    await node('scripts/youtube-autoplan.js', ['qa', '--video', video, '--plan', path.join(planDir, 'edit-plan.json'), '--output', qaDir], {allowFail: true});
    qa = JSON.parse(await readFile(path.join(qaDir, 'qa.json'), 'utf8'));
    steps.push('render', 'qa');
  }

  const plan = JSON.parse(await readFile(path.join(planDir, 'edit-plan.json'), 'utf8'));
  await writeFile(path.join(planDir, 'REVIEW.md'), reviewMarkdown({slug: v.slug, steps, planFile: path.join(planDir, 'edit-plan.json'), plan, video, qa}));
  console.log(`\nRevision: ${path.resolve(planDir, 'REVIEW.md')}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
