import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  metadataPathFor,
  renderPathFor,
  writeJsonExclusive,
} from "./lib/output-run.mjs";

const renders = [
  ["Scout-RadialOrbitSummary", "radial-orbit-summary.mp4"],
  ["Scout-ConnectedCardChain", "connected-card-chain.mp4"],
  ["Scout-CapacityMatrix", "capacity-matrix.mp4"],
];
const run = createRunDirectory({
  project: "scout-catalog",
  purpose: "render",
});
const outputRoot = run.directory;
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

const media = [];
const outputs = [];

console.log(`\nEjecución ${run.runId}`);

for (const [compositionId, filename] of renders) {
  const outputPath = renderPathFor(run, filename);
  console.log(`\nRenderizando ${compositionId} -> ${outputPath}`);
  const renderResult = spawnSync(
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
  if (renderResult.error) {
    throw renderResult.error;
  }
  if (renderResult.status !== 0) {
    process.exit(renderResult.status ?? 1);
  }

  const probeResult = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size:stream=codec_name,pix_fmt,width,height,r_frame_rate",
      "-of",
      "json",
      outputPath,
    ],
    {encoding: "utf8"},
  );
  if (probeResult.error) {
    throw probeResult.error;
  }
  if (probeResult.status !== 0) {
    process.stderr.write(probeResult.stderr);
    process.exit(probeResult.status ?? 1);
  }
  media.push({
    compositionId,
    file: filename,
    ...JSON.parse(probeResult.stdout),
  });
  outputs.push(outputPath);
}

const mediaManifestPath = metadataPathFor(run, "media-manifest.json");
writeJsonExclusive(mediaManifestPath, {version: 1, runId: run.runId, media});
outputs.push(mediaManifestPath);

const manifestPath = completeRun(run, {outputs});
console.log(`\nDemos del catálogo scout terminadas en ${outputRoot}`);
console.log(`Manifest: ${manifestPath}`);
