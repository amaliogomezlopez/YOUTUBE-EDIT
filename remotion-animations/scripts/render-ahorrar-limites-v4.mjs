import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  renderPathFor,
} from "./lib/output-run.mjs";

const renders = [
  ["ALV4-01-Coste", "01", "01_coste_creciente_v4.mp4"],
  ["ALV4-09-Tokens", "09", "09_miles_tokens_antes_v4.mp4"],
  ["ALV4-12-Ventana", "12", "12_ventana_contexto_v4.mp4"],
  ["ALV4-15-Atencion", "15", "15_atencion_dispersa_v4.mp4"],
  ["ALV4-19-Skills", "19", "19_una_skill_por_cosa_v4.mp4"],
  ["ALV4-21-Markdown", "21", "21_markdown_contamina_v4.mp4"],
  ["ALV4-23-Bucle", "23", "23_bucle_revision_v4.mp4"],
  ["ALV4-26-Memoria", "26", "26_memoria_coste_v4.mp4"],
  ["ALV4-29-Pico", "29", "29_horas_pico_v4.mp4"],
];

const run = createRunDirectory({
  project: "ahorrar-limites-v4",
  purpose: "render",
});
const outputRoot = run.directory;

const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);
const outputs = [];

console.log(`\nEjecución ${run.runId}`);

for (const [compositionId, clipNumber, filename] of renders) {
  const outputPath = renderPathFor(run, clipNumber, filename);
  console.log(`\nRenderizando ${compositionId} -> ${outputPath}`);
  const result = spawnSync(
    process.execPath,
    [
      remotionCli,
      "render",
      "src/index.ts",
      compositionId,
      outputPath,
      "--codec=h264",
      "--crf=17",
      "--image-format=png",
      "--pixel-format=yuv420p",
      "--concurrency=8",
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
  outputs.push(outputPath);
}

const manifestPath = completeRun(run, {outputs});
console.log(`\nRenders V4 terminados en ${outputRoot}`);
console.log(`Manifest: ${manifestPath}`);
