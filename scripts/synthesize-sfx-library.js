#!/usr/bin/env node
/**
 * ANM-D01 / ANM-D02 — Expande catalog/sound/recipes.json a:
 *   1. la librería WAV determinista `public/sfx/amaliometria-<familia>-<nn>.wav`
 *   2. el catálogo consumible `catalog/sound/sfx.json`
 *
 * La síntesis es local, determinista y libre de licencias de terceros: cada
 * variante es una expresión cerrada evaluada por ffmpeg (`aevalsrc`).
 *
 *   node scripts/synthesize-sfx-library.js [--force] [--dry-run]
 */
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdir, readFile, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RECIPES_FILE = path.join(
  ROOT, 'remotion-animations', 'catalog', 'sound', 'recipes.json'
);
const CATALOG_FILE = path.join(
  ROOT, 'remotion-animations', 'catalog', 'sound', 'sfx.json'
);
const SFX_DIRECTORY = path.join(ROOT, 'remotion-animations', 'public', 'sfx');

function round(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function variantNumber(index) {
  return String(index + 1).padStart(2, '0');
}

/** `[base, step]` → valor determinista de la variante `index`. */
function resolveParams(params = {}, index) {
  return Object.fromEntries(
    Object.entries(params).map(([key, [base, step = 0]]) => [
      key,
      round(base + step * index, 4)
    ])
  );
}

function applyTemplate(template, values) {
  return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (!(key in values)) {
      throw new Error(`Parámetro ${key} sin valor en "${template}".`);
    }
    return String(values[key]);
  });
}

function assertCommaFree(expression, familyId) {
  if (expression.includes(',')) {
    throw new Error(
      `La expresión de ${familyId} contiene una coma; ffmpeg la leería como ` +
      'separador de filtros. Reescríbela sin funciones multiargumento.'
    );
  }
}

export function buildVariantSpec(family, index) {
  const {recipe} = family;
  const values = resolveParams(recipe.params, index);
  const filterValues = resolveParams(recipe.filterParams, index);
  const [durationBase, durationStep = 0] = recipe.durationSeconds;
  const durationSeconds = round(durationBase + durationStep * index, 3);
  const expression = applyTemplate(recipe.expression, values);
  assertCommaFree(expression, family.id);
  // Canal derecho microdesafinado: da anchura estéreo sin duplicar el fichero.
  const rightExpression = expression.replace(/\bt\b/g, '(t*1.0018)');
  const filters = recipe.filters
    ? applyTemplate(recipe.filters, filterValues)
    : '';
  return {
    id: `${family.id}-${variantNumber(index)}`,
    file: `sfx/amaliometria-${family.id}-${variantNumber(index)}.wav`,
    durationSeconds,
    volume: round(
      family.defaultVolume * (1 + ((index % 3) - 1) * 0.06), 3
    ),
    expression,
    rightExpression,
    filters
  };
}

function ffmpegArgs(spec) {
  const chain = [
    spec.filters,
    `afade=t=in:st=0:d=0.004`,
    `afade=t=out:st=${round(Math.max(0.01, spec.durationSeconds - 0.03), 3)}:d=0.03`,
    'alimiter=limit=0.89',
    'aformat=sample_fmts=s16:sample_rates=48000:channel_layouts=stereo'
  ].filter(Boolean).join(',');
  return [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi',
    '-i',
    `aevalsrc=${spec.expression}|${spec.rightExpression}:s=48000:d=${spec.durationSeconds}`,
    '-af', chain,
    '-c:a', 'pcm_s16le'
  ];
}

function runFfmpeg(args, outputFile) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', [...args, outputFile], {stdio: ['ignore', 'ignore', 'pipe']});
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg salió con código ${code}: ${stderr.trim()}`));
    });
  });
}

async function fileExists(file) {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

async function sha256File(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

export async function synthesizeLibrary({force = false, dryRun = false} = {}) {
  const recipes = JSON.parse(await readFile(RECIPES_FILE, 'utf8'));
  await mkdir(SFX_DIRECTORY, {recursive: true});
  const families = [];
  let created = 0;
  let reused = 0;

  for (const family of recipes.families) {
    const variants = [];
    for (let index = 0; index < recipes.variantsPerFamily; index += 1) {
      const spec = buildVariantSpec(family, index);
      const outputFile = path.join(ROOT, 'remotion-animations', 'public', spec.file);
      if (!dryRun) {
        if (force || !(await fileExists(outputFile))) {
          await runFfmpeg(ffmpegArgs(spec), outputFile);
          created += 1;
        } else {
          reused += 1;
        }
      }
      variants.push({
        id: spec.id,
        file: spec.file,
        durationSeconds: spec.durationSeconds,
        volume: spec.volume,
        provenance: 'Síntesis local determinista con ffmpeg (aevalsrc).',
        license: 'propio',
        sha256: dryRun ? null : await sha256File(outputFile)
      });
    }
    families.push({
      id: family.id,
      role: family.role,
      useFor: family.useFor,
      cooldownSeconds: family.cooldownSeconds,
      maxSharePercent: family.maxSharePercent,
      loopable: Boolean(family.loopable),
      defaultVolume: family.defaultVolume,
      variants
    });
  }

  const catalog = {
    version: 1,
    catalogFamily: 'sound',
    generatedBy: 'scripts/synthesize-sfx-library.js',
    designPrinciple: recipes.designPrinciple,
    format: recipes.format,
    selectionPolicy: {
      rule: 'El cue pide una familia, nunca un fichero. El selector elige la variante.',
      steps: [
        'Descartar variantes en cooldown para el episodio en curso.',
        'Elegir la menos usada; empatar por rotación round-robin sembrada.',
        'Aplicar jitter determinista de tono (±3 %) y ganancia (±1,5 dB).',
        'Registrar el uso para que el validador sound-variety pueda auditarlo.'
      ]
    },
    families,
    legacyAliases: recipes.legacyAliases.map ?? recipes.legacyAliases,
    totals: {
      families: families.length,
      variants: families.reduce((sum, family) => sum + family.variants.length, 0)
    }
  };

  if (!dryRun) {
    await writeFile(CATALOG_FILE, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
  }
  return {catalog, created, reused};
}

async function main() {
  const force = process.argv.includes('--force');
  const dryRun = process.argv.includes('--dry-run');
  const {catalog, created, reused} = await synthesizeLibrary({force, dryRun});
  console.log(
    `Familias: ${catalog.totals.families} · variantes: ${catalog.totals.variants} ` +
    `· nuevas: ${created} · reutilizadas: ${reused}`
  );
  console.log(`Catálogo escrito en ${path.relative(ROOT, CATALOG_FILE)}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
