import {mkdirSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const compositions = [
  ["ALV4-01-CosteCreciente", "01", 7],
  ["ALV4-09-DesgloseTokens", "09", 8],
  ["ALV4-12-VentanaContexto", "12", 5],
  ["ALV4-15-AtencionDispersa", "15", 8],
  ["ALV4-19-TresSkills", "19", 8],
  ["ALV4-21-MarkdownClutter", "21", 9],
  ["ALV4-23-BucleRevision", "23", 8],
  ["ALV4-26-Memoria", "26", 8],
  ["ALV4-29-HorasPico", "29", 6],
];
const checkpoints = [0, 0.15, 0.45, 0.75, 0.95];
const outputRoot = path.resolve(
  "out",
  "ahorrar-limites-v4-final",
  "PREVIEWS",
);
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

for (const [compositionId, clipNumber, durationSeconds] of compositions) {
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
      clipNumber: Number(clipNumber),
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
const contactSheet = path.join(outputRoot, "contact-sheet-v4.png");
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
    "scale=384:216:force_original_aspect_ratio=decrease,pad=384:216:(ow-iw)/2:(oh-ih)/2:color=black,tile=5x9",
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

for (const [compositionIndex, [, clipNumber]] of compositions.entries()) {
  const timelinePath = path.join(outputRoot, `${clipNumber}-timeline.png`);
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
      "scale=384:216:force_original_aspect_ratio=decrease,pad=384:216:(ow-iw)/2:(oh-ih)/2:color=black,tile=5x1",
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

console.log(`\nStills y hoja de contacto terminados en ${outputRoot}`);
