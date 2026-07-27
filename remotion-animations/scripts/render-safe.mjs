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
