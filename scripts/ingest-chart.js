import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  ingestAnnotatedChart,
  slugifyChartProject
} from '../src/lib/chart-ingestion.js';
import {loadTranscript} from '../src/lib/transcript.js';
import {ROOT, loadDotEnv} from '../src/lib/utils.js';
import {validateChartIngestionInput} from '../src/lib/schema-validation.js';
import {
  completeRun,
  createRunDirectory,
  metadataPathFor,
  writeJsonExclusive
} from '../remotion-animations/scripts/lib/output-run.mjs';

const HELP = `Ingesta una gráfica para AnnotatedChartScene.

Uso:
  npm run remotion:ingest:chart -- --input <chart-ingestion-input.json>

Opciones:
  --llm              Usa LLM_* para seleccionar anotaciones.
  --vision           Usa VISION_LLM_* para proponer región y ejes visibles.
  --allow-proposed   Genera props aunque la calibración necesite revisión.
  --help             Muestra esta ayuda.

Sin --llm y --vision todo el proceso es local y determinista.
Las propuestas visuales o de serie nunca se consideran confirmadas
automáticamente.`;

function parseArgs(argv) {
  const args = {
    input: '',
    useLlm: false,
    useVision: false,
    allowProposed: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--llm') args.useLlm = true;
    else if (token === '--vision') args.useVision = true;
    else if (token === '--allow-proposed') args.allowProposed = true;
    else if (token === '--input') args.input = argv[++index] || '';
    else if (token.startsWith('--input=')) args.input = token.slice('--input='.length);
    else throw new Error(`Opción desconocida: ${token}`);
  }
  return args;
}

function resolveFrom(baseDirectory, value) {
  if (!value) return '';
  return path.resolve(baseDirectory, String(value));
}

async function loadInput(inputFile) {
  const absolute = path.resolve(inputFile);
  const baseDirectory = path.dirname(absolute);
  const raw = JSON.parse(await readFile(absolute, 'utf8'));
  validateChartIngestionInput(raw);
  if (raw.transcript && raw.transcriptFile) {
    throw new Error('Usa transcript o transcriptFile, no ambos.');
  }
  if (raw.series && raw.seriesFile) {
    throw new Error('Usa series o seriesFile, no ambos.');
  }
  const input = {
    ...raw,
    imageFile: resolveFrom(baseDirectory, raw.imageFile),
    transcriptFile: raw.transcriptFile
      ? resolveFrom(baseDirectory, raw.transcriptFile)
      : undefined
  };
  if (raw.seriesFile) {
    const seriesPayload = JSON.parse(
      await readFile(resolveFrom(baseDirectory, raw.seriesFile), 'utf8')
    );
    input.series = Array.isArray(seriesPayload)
      ? seriesPayload
      : seriesPayload.series;
  }
  if (input.transcriptFile) {
    const captions = await loadTranscript(input.transcriptFile);
    input.transcript = captions.map((caption) => caption.text).join(' ');
    if (captions.length) {
      input.sourceInSeconds ??= captions[0].start;
      input.sourceOutSeconds ??= captions.at(-1).end;
    }
    delete input.transcriptFile;
    input.transcriptFile = resolveFrom(baseDirectory, raw.transcriptFile);
  }
  delete input.seriesFile;
  return {input, inputFile: absolute};
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }
  if (!args.input) throw new Error('Falta --input <archivo.json>.');
  await loadDotEnv();
  const loaded = await loadInput(args.input);
  const outputRoot = path.join(ROOT, 'remotion-animations', 'out');
  const project = slugifyChartProject(
    loaded.input.project || 'chart-ingestion'
  );
  const run = createRunDirectory({
    project,
    purpose: 'chart-ingestion',
    outputRoot,
    script: path.basename(fileURLToPath(import.meta.url))
  });
  const result = await ingestAnnotatedChart(loaded.input, {
    useLlm: args.useLlm,
    useVision: args.useVision,
    allowProposed: args.allowProposed
  });
  const outputs = [];
  const reportPath = metadataPathFor(run, 'chart-ingestion-report.json');
  writeJsonExclusive(reportPath, {
    ...result,
    props: result.props ? 'metadata/annotated-chart-props.json' : null,
    animationSpec: result.animationSpec ? 'metadata/animation-spec.json' : null,
    inputFile: loaded.inputFile
  });
  outputs.push(reportPath);
  if (result.props) {
    const propsPath = metadataPathFor(run, 'annotated-chart-props.json');
    writeJsonExclusive(propsPath, result.props);
    outputs.push(propsPath);
  }
  if (result.animationSpec) {
    const specPath = metadataPathFor(run, 'animation-spec.json');
    writeJsonExclusive(specPath, result.animationSpec);
    outputs.push(specPath);
  }
  const resultPath = completeRun(run, {
    outputs,
    metadata: {
      patternId: result.patternId,
      renderReady: result.renderReady,
      calibrationStatus: result.calibration.status,
      selectionMode: result.selection.mode,
      warningCount: result.warnings.length
    }
  });
  console.log(`Ingestión terminada: ${run.directory}`);
  console.log(`Render ready: ${result.renderReady ? 'sí' : 'no'}`);
  console.log(`Calibración: ${result.calibration.status}`);
  console.log(`Selector: ${result.selection.mode}`);
  if (result.warnings.length) {
    for (const warning of result.warnings) console.log(`Warning: ${warning}`);
  }
  console.log(`Manifest: ${resultPath}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
});
