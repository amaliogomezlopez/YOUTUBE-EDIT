import {mkdirSync, writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import path from "node:path";

const renders = [
  ["Scout-RadialOrbitSummary", "radial-orbit-summary.mp4"],
  ["Scout-ConnectedCardChain", "connected-card-chain.mp4"],
  ["Scout-CapacityMatrix", "capacity-matrix.mp4"],
];
const outputRoot = path.resolve("out", "scout-catalog");
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

mkdirSync(outputRoot, {recursive: true});
const media = [];

for (const [compositionId, filename] of renders) {
  const outputPath = path.join(outputRoot, filename);
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
}

writeFileSync(
  path.join(outputRoot, "media-manifest.json"),
  `${JSON.stringify({version: 1, media}, null, 2)}\n`,
  "utf8",
);

console.log(`\nDemos del catálogo scout terminadas en ${outputRoot}`);
