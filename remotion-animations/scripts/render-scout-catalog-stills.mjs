import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  metadataPathFor,
  previewPathFor,
  writeJsonExclusive,
} from "./lib/output-run.mjs";

const compositions = [
  ["Scout-RadialOrbitSummary", "radial-orbit-summary", 8],
  ["Scout-ConnectedCardChain", "connected-card-chain", 8],
  ["Scout-CapacityMatrix", "capacity-matrix", 8],
];
const checkpoints = [0, 0.15, 0.45, 0.75, 0.95];
const run = createRunDirectory({
  project: "scout-catalog",
  purpose: "previews",
});
const outputRoot = run.directory;
const framesRoot = path.join(outputRoot, "previews", "frames");
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

const previewIndex = [];
const outputs = [];
let sequence = 1;

console.log(`\nEjecución ${run.runId}`);

for (const [compositionId, slug, durationSeconds] of compositions) {
  const durationInFrames = durationSeconds * 60;
  for (const checkpoint of checkpoints) {
    const frame = Math.min(
      durationInFrames - 1,
      Math.round((durationInFrames - 1) * checkpoint),
    );
    const filename = `${String(sequence).padStart(3, "0")}.png`;
    const outputPath = previewPathFor(run, "frames", filename);
    console.log(
      `Still ${compositionId} · ${Math.round(checkpoint * 100)} % -> ${filename}`,
    );
    const result = spawnSync(
      process.execPath,
      [
        remotionCli,
        "still",
        "src/index.ts",
        compositionId,
        outputPath,
        `--frame=${frame}`,
        "--image-format=png",
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
    previewIndex.push({
      sequence,
      file: `previews/frames/${filename}`,
      compositionId,
      slug,
      checkpoint,
      frame,
    });
    outputs.push(outputPath);
    sequence += 1;
  }
}

const previewIndexPath = metadataPathFor(run, "preview-index.json");
writeJsonExclusive(previewIndexPath, previewIndex);
outputs.push(previewIndexPath);

const framePattern = path.join(framesRoot, "%03d.png");
const contactSheet = previewPathFor(
  run,
  "contact-sheets",
  "contact-sheet.png",
);
const contactResult = spawnSync(
  "ffmpeg",
  [
    "-n",
    "-framerate",
    "1",
    "-start_number",
    "1",
    "-i",
    framePattern,
    "-vf",
    "scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:color=black,tile=5x3",
    "-frames:v",
    "1",
    contactSheet,
  ],
  {encoding: "utf8", stdio: "inherit"},
);
if (contactResult.error) {
  throw contactResult.error;
}
if (contactResult.status !== 0) {
  process.exit(contactResult.status ?? 1);
}
outputs.push(contactSheet);

for (const [compositionIndex, [, slug]] of compositions.entries()) {
  const timelinePath = previewPathFor(
    run,
    "timelines",
    `${slug}-timeline.png`,
  );
  const timelineResult = spawnSync(
    "ffmpeg",
    [
      "-n",
      "-framerate",
      "1",
      "-start_number",
      String(compositionIndex * checkpoints.length + 1),
      "-i",
      framePattern,
      "-vf",
      "scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:color=black,tile=5x1",
      "-frames:v",
      "1",
      timelinePath,
    ],
    {encoding: "utf8", stdio: "ignore"},
  );
  if (timelineResult.error) {
    throw timelineResult.error;
  }
  if (timelineResult.status !== 0) {
    process.exit(timelineResult.status ?? 1);
  }
  outputs.push(timelinePath);
}

const manifestPath = completeRun(run, {outputs});
console.log(`\nStills del catálogo scout terminados en ${outputRoot}`);
console.log(`Manifest: ${manifestPath}`);
