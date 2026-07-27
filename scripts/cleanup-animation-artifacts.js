#!/usr/bin/env node
import {
  ANIMATION_CLEANUP_CONFIRMATION,
  cleanupAnimationArtifacts
} from '../src/lib/animation-artifact-cleanup.js';

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Argumento desconocido: ${arg}`);
    const [rawKey, inlineValue] = arg.slice(2).split(/=(.*)/s, 2);
    const key = rawKey.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (['apply', 'includeIncomplete', 'includeLegacy', 'json', 'help'].includes(key)) {
      options[key] = true;
      continue;
    }
    const value = inlineValue ?? argv[++index];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Falta el valor de --${rawKey}.`);
    }
    options[key] = value;
  }
  return options;
}

function formatBytes(value) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let amount = Number(value) || 0;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  return `${amount.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function printHelp() {
  console.log(`Limpieza segura de artefactos de animación

Uso:
  npm run cleanup:animations -- [opciones]

Opciones:
  --scope all|remotion|scout      Alcance. Default: all.
  --project <slug>                Limita los runs; exige --scope remotion.
  --older-than-days <n>           Antigüedad mínima. Default: 30.
  --keep-last <n>                 Runs conservados por proyecto/ámbito. Default: 3.
  --include-incomplete            Incluye ejecuciones sin manifest final.
  --include-legacy                Incluye salidas Remotion anteriores a /runs.
  --apply                         Ejecuta el borrado; sin esto solo simula.
  --confirm ${ANIMATION_CLEANUP_CONFIRMATION}
                                  Confirmación obligatoria junto a --apply.
  --json                          Salida JSON.
  --help                          Muestra esta ayuda.

La herramienta nunca toca vídeos fuente, código, assets, .env ni chats.`);
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const result = await cleanupAnimationArtifacts({
  dryRun: !args.apply,
  confirm: args.confirm,
  scope: args.scope,
  project: args.project,
  olderThanDays: args.olderThanDays,
  keepLast: args.keepLast,
  includeIncomplete: args.includeIncomplete,
  includeLegacy: args.includeLegacy
});

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

console.log(result.dryRun ? 'SIMULACIÓN: no se ha borrado nada.' : 'LIMPIEZA APLICADA.');
console.log(
  `Revisados: ${result.scanned} · candidatos: ${result.count} · espacio: ${formatBytes(result.bytes)}`
);
if (result.legacyExcluded) {
  console.log(
    `Salidas legacy excluidas: ${result.legacyExcluded} (usa --include-legacy para revisarlas).`
  );
}
for (const item of result.candidates) {
  console.log(`- ${item.scope} · ${item.project || '-'} · ${item.id} · ${formatBytes(item.bytes)}`);
}
if (result.dryRun && result.count) {
  console.log('');
  console.log('Para borrar exactamente esta clase de candidatos, repite con:');
  console.log(`  --apply --confirm=${ANIMATION_CLEANUP_CONFIRMATION}`);
}
