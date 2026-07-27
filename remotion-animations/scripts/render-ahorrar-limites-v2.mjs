import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  renderPathFor,
} from "./lib/output-run.mjs";

const renders = [
  ["ALV2-03-Input-90", "03", "03_tokens_entrada_90_v2.mp4"],
  ["ALV2-06-Harness", "06", "06_harness_flujo_v2.mp4"],
  ["ALV2-10-Carga", "10", "10_carga_contexto_v2.mp4"],
  ["ALV2-13-Contexto", "13", "13_contexto_acumulado_v2.mp4"],
  ["ALV2-17-Un-Prompt", "17", "17_una_lectura_varias_tareas_v2.mp4"],
  ["ALV2-22-Skills", "22", "22_rango_skills_10_30_v2.mp4"],
  ["ALV2-24-Chat-Nuevo", "24", "24_chat_nuevo_v2.mp4"],
  ["ALV2-27-Subagentes", "27", "27_orquestador_subagentes_v2.mp4"],
];

const run = createRunDirectory({
  project: "ahorrar-limites-v2",
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
console.log(`\nRenders V2 terminados en ${outputRoot}`);
console.log(`Manifest: ${manifestPath}`);
