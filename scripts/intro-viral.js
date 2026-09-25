#!/usr/bin/env node
/**
 * Apertura viral de un video largo, paso a paso y con puertas.
 *
 *   npm run intro:viral -- start  --source <carpeta> --clips 1,2,3 --slug <slug> --music <pista>
 *   npm run intro:viral -- assets --slug <slug> [--force]
 *   npm run intro:viral -- plan   --slug <slug>
 *   npm run intro:viral -- render --slug <slug>
 *   npm run intro:viral -- review --slug <slug> [--deliver]
 *   npm run intro:viral -- status --slug <slug>
 *   npm run intro:viral -- variants --slug <slug> [--render] [--only a-v3,b-serif]
 *
 * Cada etapa imprime sus comprobaciones y sale con codigo 1 si la puerta no pasa.
 * El procedimiento completo esta en .claude/skills/intro-viral/SKILL.md.
 */
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {
  assetsStage, planStage, renderStage, reviewStage, startStage, statusStage, variantsStage, workspacePaths
} from '../src/modules/intro-viral/workflow.js';

await loadDotEnv();
const args = parseCliArgs(process.argv.slice(2));
const stage = args._[0];
const slug = typeof args.slug === 'string' ? args.slug : null;
const usage = 'Uso: npm run intro:viral -- <start|assets|plan|render|review|status|variants> --slug <slug> (ver scripts/intro-viral.js)';

if (!stage || !slug) {
  console.error(usage);
  process.exit(1);
}

const stages = {
  start: () => startStage({
    source: typeof args.source === 'string' ? args.source : null,
    clips: String(args.clips ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    slug,
    music: typeof args.music === 'string' ? args.music : undefined
  }),
  assets: () => assetsStage({slug, force: Boolean(args.force)}),
  plan: () => planStage({slug}),
  render: () => renderStage({slug}),
  review: () => reviewStage({slug, deliver: Boolean(args.deliver)}),
  status: () => statusStage({slug}),
  variants: () => variantsStage({
    slug,
    render: Boolean(args.render),
    only: typeof args.only === 'string' ? args.only.split(',').map((s) => s.trim()) : null
  })
};
if (!stages[stage]) {
  console.error(usage);
  process.exit(1);
}
if (stage === 'start' && !String(args.clips ?? '').trim()) {
  console.error('start necesita --clips (por ejemplo --clips 1,2,3)');
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
if (result.report) console.log(`  plan: ${JSON.stringify(result.report)}`);
if (result.assets) console.log(`  recursos para la escaleta: ${result.assets.join(', ') || 'ninguno'}`);
if (result.sheet) console.log(`  hoja: ${result.sheet}`);
if (result.review) console.log(`  revision: ${result.review}`);
const paths = workspacePaths(slug);
if (stage === 'start' && result.ok) {
  console.log('');
  console.log(`Trabajo en ${paths.dir}:`);
  console.log(`  1. Lee ${paths.transcript}`);
  console.log(`  2. Pide recursos en ${paths.requests}`);
  console.log(`  3. Rellena ${paths.escaleta} con las tablas de la skill`);
}
if (result.ok && result.next) console.log(`\nSiguiente: ${result.next}`);
process.exit(result.ok ? 0 : 1);
