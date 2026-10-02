#!/usr/bin/env node
/**
 * Short 9:16 para TikTok, Reels y Shorts a partir de la apertura viral ya montada.
 *
 *   npm run intro:short -- plan       --slug <slug> [--short-slug <otro>] [--force]
 *   npm run intro:short -- render     --slug <slug>
 *   npm run intro:short -- review     --slug <slug> [--deliver]
 *   npm run intro:short -- publishing --slug <slug> [--no-llm]
 *   npm run intro:short -- status     --slug <slug>
 *
 * `<slug>` es el de la apertura (data/intro-viral/<slug>). Cada etapa imprime sus
 * comprobaciones y sale con codigo 1 si la puerta no pasa. El procedimiento esta en
 * .claude/skills/short-desde-intro/SKILL.md.
 */
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {planStage, publishingStage, renderStage, reviewStage, shortPaths, statusStage} from '../src/modules/intro-short/workflow.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
const stage = args._[0];
const slug = typeof args.slug === 'string' ? args.slug : null;
const usage = 'Uso: npm run intro:short -- <plan|render|review|publishing|status> --slug <slug de la apertura>';
const stages = {
  plan: () => planStage({slug, shortSlug: typeof args['short-slug'] === 'string' ? args['short-slug'] : slug, force: Boolean(args.force)}),
  render: () => renderStage({slug}),
  review: () => reviewStage({slug, deliver: Boolean(args.deliver)}),
  publishing: () => publishingStage({slug, useLlm: args['no-llm'] !== true && args.llm !== false}),
  status: () => statusStage({slug})
};
if (!stage || !slug || !stages[stage]) {
  console.error(usage);
  process.exit(1);
}

const result = await stages[stage]();
console.log('');
console.log(`Puerta ${stage}: ${result.ok ? 'SUPERADA' : 'BLOQUEADA'}`);
for (const c of result.checks) {
  const mark = c.warning ? '!' : c.ok ? '✔' : '✖';
  console.log(`  ${mark} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
  if (!c.ok && c.fix) console.log(`      → ${c.fix}`);
}
if (result.report) console.log(`  short: ${JSON.stringify(result.report)}`);
if (result.mp4) console.log(`  mp4: ${result.mp4}`);
if (result.sheet) console.log(`  hoja: ${result.sheet}`);
if (result.review) console.log(`  revision: ${result.review}`);
if (stage === 'plan') console.log(`  cambios del short: ${shortPaths(slug).overrides}`);
if (result.ok && result.next) console.log(`\nSiguiente: ${result.next}`);
process.exit(result.ok ? 0 : 1);
