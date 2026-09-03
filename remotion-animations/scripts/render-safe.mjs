import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  previewPathFor,
  renderPathFor,
} from "./lib/output-run.mjs";

const [command, project, compositionId, filename, ...renderArgs] =
  process.argv.slice(2);

if (!["render", "still"].includes(command)) {
  throw new Error("El primer argumento debe ser render o still.");
}
if (!project || !compositionId || !filename) {
  throw new Error(
    "Uso: node scripts/render-safe.mjs <render|still> <project> <compositionId> <filename> [...opciones Remotion]",
  );
}

const run = createRunDirectory({project, purpose: command});
const outputPath =
  command === "still"
    ? previewPathFor(run, filename)
    : renderPathFor(run, filename);
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

// Calidad de encode por defecto: sin flags explicitos, los renders salian con el
// CRF por defecto de Remotion (18) y sin tope de bitrate, por debajo del
// estandar del pipeline ffmpeg (CRF 17, preset slow). El caller puede pisar
// ambos pasando --codec/--crf en la linea de comandos, y el CRF tambien por
// entorno (REMOTION_CRF).
const hasFlag = (name) =>
  renderArgs.some((arg) => arg === name || arg.startsWith(`${name}=`));
const qualityArgs =
  command === "render"
    ? [
        ...(hasFlag("--codec") ? [] : ["--codec=h264"]),
        ...(hasFlag("--crf") ? [] : [`--crf=${process.env.REMOTION_CRF ?? 17}`]),
      ]
    : [];

console.log(`\nEjecución ${run.runId}`);
console.log(`Renderizando ${compositionId} -> ${outputPath}`);
const result = spawnSync(
  process.execPath,
  [
    remotionCli,
    command,
    "src/index.ts",
    compositionId,
    outputPath,
    ...qualityArgs,
    ...renderArgs,
  ],
  {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: "inherit",
  },
);
if (result.error) {
  throw result.error;
}
if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const manifestPath = completeRun(run, {
  outputs: [outputPath],
  metadata: {compositionId},
});
console.log(`\nRender terminado en ${run.directory}`);
console.log(`Manifest: ${manifestPath}`);
