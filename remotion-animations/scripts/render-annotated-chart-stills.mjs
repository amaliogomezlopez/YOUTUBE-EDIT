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
  "Chart-Annotated-Editorial",
  "Chart-Annotated-Documentary",
  "Chart-Annotated-Market",
];
const checkpoints = [0, 0.15, 0.45, 0.75, 0.95];
const contactSheetColumns = 5;
const contactSheetRows = Math.ceil(
  (compositions.length * checkpoints.length) / contactSheetColumns,
);
const durationInFrames = 9 * 60;
const run = createRunDirectory({
  project: "annotated-chart",
  purpose: "previews",
});
const framesRoot = path.join(run.directory, "previews", "frames");
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);
const outputs = [];
const previewIndex = [];
let sequence = 1;

console.log(`\nEjecución ${run.runId}`);
for (const compositionId of compositions) {
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

const contactSheetPath = previewPathFor(
  run,
  "contact-sheets",
  "annotated-chart-art-directions.png",
);
const contactSheetResult = spawnSync(
  "ffmpeg",
  [
    "-n",
    "-framerate",
    "1",
    "-start_number",
    "1",
    "-i",
    path.join(framesRoot, "%03d.png"),
    "-vf",
    `scale=384:216:force_original_aspect_ratio=decrease,pad=384:216:(ow-iw)/2:(oh-ih)/2:color=black,tile=${contactSheetColumns}x${contactSheetRows}`,
    "-frames:v",
    "1",
    "-update",
    "1",
    contactSheetPath,
  ],
  {encoding: "utf8", stdio: "inherit"},
);
if (contactSheetResult.error) {
  throw contactSheetResult.error;
}
if (contactSheetResult.status !== 0) {
  process.exit(contactSheetResult.status ?? 1);
}
outputs.push(contactSheetPath);

const manifestPath = completeRun(run, {
  outputs,
  metadata: {
    compositions,
    checkpoints,
    soundDecision:
      "QA silencioso; Chart-Annotated-Range-Audio conserva cues opcionales.",
  },
});
console.log(`\nQA de gráficas anotadas terminado en ${run.directory}`);
console.log(`Manifest: ${manifestPath}`);
