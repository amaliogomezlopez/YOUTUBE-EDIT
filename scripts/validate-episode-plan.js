#!/usr/bin/env node
/**
 * ANM-A07 — `npm run episode:plan:validate`
 *
 * Verifica el plan completo antes de bundlear: anclaje, targets, densidad,
 * sonido, variedad, assets locales y las reglas del canal.
 *
 *   npm run episode:plan:validate -- --plan data/.../visual-plan.json \
 *     [--words <transcript.json>] [--channel finance-cavaliers] [--json <salida>]
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {
  formatValidationReport,
  validateEpisodePlan
} from '../src/modules/editorial-video/visuals/plan-validator.js';
import {buildEpisodeQaReport} from '../src/modules/editorial-video/visuals/episode-qa.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {
    plan: '',
    words: '',
    coverage: '',
    channel: 'finance-cavaliers',
    json: '',
    qa: '',
    silentProps: '',
    strict: true
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--allow-warnings') {
      args.strict = false;
      continue;
    }
    if (!token.startsWith('--')) continue;
    // `--silent-props` y `--silentProps` son la misma opción.
    const key = token.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (key in args) args[key] = argv[++index] ?? '';
    else if (key === 'help' || key === 'h') args.help = true;
    else throw new Error(`Opción desconocida: ${token}`);
  }
  return args;
}

async function readJson(file, fallback = null) {
  if (!file) return fallback;
  return JSON.parse(await readFile(path.resolve(ROOT, file), 'utf8'));
}

/** Acepta `{words: [...]}`, `{segments:[{words}]}` o un array plano. */
function extractWords(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.words)) return payload.words;
  if (Array.isArray(payload.segments)) {
    return payload.segments.flatMap((segment) => segment.words ?? []);
  }
  return [];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.plan) {
    console.log(
      'Uso: npm run episode:plan:validate -- --plan <visual-plan.json> ' +
      '[--words <transcript.json>] [--coverage <cue-coverage.json>] ' +
      '[--channel <id>] [--json <salida>] [--qa <episode-qa.json>] ' +
      '[--silent-props <render-props-silent.json>] [--allow-warnings]\n\n' +
      'Las reglas cuyo contexto no se aporte se informan como «no evaluable», ' +
      'nunca como incumplimiento.'
    );
    return;
  }
  const plan = await readJson(args.plan);
  const words = extractWords(await readJson(args.words, []));
  const coveragePayload = await readJson(args.coverage, []);
  const coverage = Array.isArray(coveragePayload)
    ? coveragePayload
    : coveragePayload?.scenes ?? [];

  const result = await validateEpisodePlan({
    plan,
    words,
    coverage,
    channelId: args.channel,
    root: ROOT,
    // Sin `--silent-props` el validador no puede saber si el build generó la
    // variante silenciosa: se declara ausencia de contexto, no incumplimiento.
    artifacts: args.silentProps ? {silentPropsFile: args.silentProps} : null
  });

  console.log(formatValidationReport(result));
  if (args.json) {
    await writeFile(
      path.resolve(ROOT, args.json),
      `${JSON.stringify({
        ok: result.ok,
        summary: result.summary,
        issues: result.issues,
        reports: result.reports
      }, null, 2)}\n`,
      'utf8'
    );
    console.log(`\nInforme escrito en ${args.json}`);
  }
  if (args.qa) {
    await writeFile(
      path.resolve(ROOT, args.qa),
      `${JSON.stringify(buildEpisodeQaReport(result), null, 2)}
`,
      'utf8'
    );
    console.log(`Plan de QA escrito en ${args.qa}`);
  }
  if (!result.ok) {
    console.error('\nEl plan no valida: corrige los errores antes de bundlear.');
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.stack ?? error.message);
    process.exitCode = 1;
  });
}
