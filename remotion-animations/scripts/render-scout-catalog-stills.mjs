import {mkdirSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const compositions = [
  ["Scout-RadialOrbitSummary", "radial-orbit-summary", 8],
  ["Scout-ConnectedCardChain", "connected-card-chain", 8],
  ["Scout-CapacityMatrix", "capacity-matrix", 8],
];
const checkpoints = [0, 0.15, 0.45, 0.75, 0.95];
const outputRoot = path.resolve("out", "scout-catalog", "PREVIEWS");
const framesRoot = path.join(outputRoot, "frames");
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

mkdirSync(framesRoot, {recursive: true});
const previewIndex = [];
let sequence = 1;

for (const [compositionId, slug, durationSeconds] of compositions) {
  const durationInFrames = durationSeconds * 60;
  for (const checkpoint of checkpoints) {
    const frame = Math.min(
      durationInFrames - 1,
      Math.round((durationInFrames - 1) * checkpoint),
    );
    const filename = `${String(sequence).padStart(3, "0")}.png`;
    const outputPath = path.join(framesRoot, filename);
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
      file: `frames/${filename}`,
      compositionId,
      slug,
      checkpoint,
      frame,
    });
    sequence += 1;
  }
}

writeFileSync(
  path.join(outputRoot, "preview-index.json"),
  `${JSON.stringify(previewIndex, null, 2)}\n`,
  "utf8",
);

const framePattern = path.join(framesRoot, "%03d.png");
const contactSheet = path.join(outputRoot, "contact-sheet.png");
const contactResult = spawnSync(
  "ffmpeg",
  [
    "-y",
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

for (const [compositionIndex, [, slug]] of compositions.entries()) {
  const timelinePath = path.join(outputRoot, `${slug}-timeline.png`);
  const timelineResult = spawnSync(
    "ffmpeg",
    [
      "-y",
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
}

console.log(`\nStills del catálogo scout terminados en ${outputRoot}`);
