import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  renderPathFor,
} from "./lib/output-run.mjs";

const renders = [
  ["Toolkit-LineChartZoom", "toolkit-line-chart-zoom.mp4"],
  ["Toolkit-RisingHistogram", "toolkit-rising-histogram.mp4"],
  ["Toolkit-KineticNumber", "toolkit-kinetic-number.mp4"],
  ["Toolkit-TransversalEffects", "toolkit-transversal-effects.mp4"],
  [
    "Toolkit-TransversalEffects-FinalZoom",
    "toolkit-transversal-effects-final-zoom.mp4",
  ],
  ["Toolkit-TextFocusJourney", "toolkit-text-focus-journey.mp4"],
];

const run = createRunDirectory({
  project: "toolkit",
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

for (const [compositionId, filename] of renders) {
  const outputPath = renderPathFor(run, filename);
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
console.log(`\nDemos del toolkit terminadas en ${outputRoot}`);
console.log(`Manifest: ${manifestPath}`);
