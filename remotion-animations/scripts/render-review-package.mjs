import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import sharp from "sharp";
import {
  completeRun,
  createRunDirectory,
  metadataPathFor,
  previewPathFor,
  writeJsonExclusive,
} from "./lib/output-run.mjs";

const parseArgs = (argv) => {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) result[key] = true;
    else {
      result[key] = value;
      index += 1;
    }
  }
  return result;
};

const args = parseArgs(process.argv.slice(2));
const defaultCompositions = [
  "Pattern-Screenshot-Spotlight",
  "Pattern-Before-After-Wipe",
  "Pattern-Common-Baseline",
  "Pattern-Timeline-Milestones",
  "Pattern-Ranking",
  "Pattern-Accumulation",
  "Pattern-Funnel-Filter",
  "Pattern-Branch-Merge",
  "Pattern-Photo-Parallax",
];
const checkpoints = String(args.checkpoints || "0.08,0.32,0.58,0.82,0.94")
  .split(",")
  .map(Number)
  .filter((value) => value >= 0 && value <= 1);
const durationInFrames = 8 * 60;
const reviewRoot = path.resolve("..", "data", "review", "remotion");
const sessionFile = args.session
  ? path.join(
      reviewRoot,
      `${String(args.session).replace(/\.json$/i, "")}.json`,
    )
  : null;
const session = sessionFile
  ? JSON.parse(readFileSync(sessionFile, "utf8"))
  : null;
const variants = session
  ? session.variants
  : defaultCompositions.map((compositionId) => ({
      id: compositionId.toLowerCase(),
      label: compositionId.replace(/^Pattern-/, "").replaceAll("-", " "),
      compositionId,
      props: null,
    }));
const run = createRunDirectory({
  project: session?.projectId || "motion-library",
  purpose: "review-package",
});
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);
const outputs = [];
const previewIndex = [];
const propsFiles = new Map();
let sequence = 1;

if (session) {
  for (const variant of variants) {
    const propsPath = metadataPathFor(run, `props-${variant.id}.json`);
    writeJsonExclusive(propsPath, variant.props);
    propsFiles.set(variant.id, propsPath);
    outputs.push(propsPath);
  }
}

for (const variant of variants) {
  for (const checkpoint of checkpoints) {
    const frame = Math.min(
      durationInFrames - 1,
      Math.round((durationInFrames - 1) * checkpoint),
    );
    const filename = `${String(sequence).padStart(3, "0")}.png`;
    const outputPath = previewPathFor(run, "frames", filename);
    const cliArgs = [
      remotionCli,
      "still",
      "src/index.ts",
      variant.compositionId,
      outputPath,
      `--frame=${frame}`,
      "--image-format=png",
    ];
    if (propsFiles.has(variant.id)) {
      cliArgs.push(`--props=${propsFiles.get(variant.id)}`);
    }
    console.log(
      `${variant.label} · ${Math.round(checkpoint * 100)} % -> ${filename}`,
    );
    const result = spawnSync(process.execPath, cliArgs, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
    previewIndex.push({
      sequence,
      file: `previews/frames/${filename}`,
      variantId: variant.id,
      label: variant.label,
      compositionId: variant.compositionId,
      checkpoint,
      frame,
      absolutePath: outputPath,
    });
    outputs.push(outputPath);
    sequence += 1;
  }
}

const qaFrames = [];
for (const preview of previewIndex) {
  const image = sharp(preview.absolutePath);
  const metadata = await image.metadata();
  const {data, info} = await image
    .resize(64, 36, {fit: "fill"})
    .removeAlpha()
    .raw()
    .toBuffer({resolveWithObject: true});
  const luminances = [];
  for (let index = 0; index < data.length; index += info.channels) {
    luminances.push(
      0.2126 * data[index] +
        0.7152 * data[index + 1] +
        0.0722 * data[index + 2],
    );
  }
  const mean =
    luminances.reduce((sum, value) => sum + value, 0) / luminances.length;
  const variance =
    luminances.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
    luminances.length;
  qaFrames.push({
    sequence: preview.sequence,
    variantId: preview.variantId,
    label: preview.label,
    compositionId: preview.compositionId,
    checkpoint: preview.checkpoint,
    frame: preview.frame,
    width: metadata.width,
    height: metadata.height,
    sha256: createHash("sha256")
      .update(readFileSync(preview.absolutePath))
      .digest("hex"),
    luminanceMean: Number(mean.toFixed(3)),
    luminanceVariance: Number(variance.toFixed(3)),
    blankRisk: variance < 8,
  });
}

const blocking = qaFrames
  .filter((frame) => frame.blankRisk)
  .map((frame) => ({
    severity: "blocking",
    code: "BLANK_FRAME_RISK",
    message: `${frame.label} parece vacío en ${Math.round(
      frame.checkpoint * 100,
    )} %.`,
    frame: frame.sequence,
  }));
const qaReport = {
  version: 1,
  generatedAt: new Date().toISOString(),
  passed: blocking.length === 0,
  score: Math.max(0, 100 - blocking.length * 25),
  checks: {
    frameCount: qaFrames.length,
    blankFrameRisks: blocking.length,
    labelledContactSheet: true,
    immutableRun: true,
  },
  issues: blocking,
  frames: qaFrames,
};
const qaPath = metadataPathFor(run, "visual-qa.json");
writeJsonExclusive(qaPath, qaReport);
outputs.push(qaPath);

const cellWidth = 400;
const cellHeight = 270;
const labelHeight = 46;
const columns = Math.min(5, Math.max(1, checkpoints.length));
const rows = Math.ceil(previewIndex.length / columns);
const composites = [];
for (let index = 0; index < previewIndex.length; index++) {
  const preview = previewIndex[index];
  const thumbnail = await sharp(preview.absolutePath)
    .resize(cellWidth, cellHeight - labelHeight, {
      fit: "contain",
      background: "#05090D",
    })
    .png()
    .toBuffer();
  const label = Buffer.from(
    `<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#0C141B"/>
      <text x="12" y="19" fill="#C6FF4A" font-family="Arial" font-size="12" font-weight="700">${preview.label}</text>
      <text x="12" y="36" fill="#93A2AD" font-family="Arial" font-size="10">${preview.compositionId} · ${Math.round(preview.checkpoint * 100)} % · frame ${preview.frame}</text>
    </svg>`,
  );
  const left = (index % columns) * cellWidth;
  const top = Math.floor(index / columns) * cellHeight;
  composites.push({input: thumbnail, left, top});
  composites.push({
    input: label,
    left,
    top: top + cellHeight - labelHeight,
  });
}
const contactSheetPath = previewPathFor(
  run,
  "contact-sheets",
  "review-labelled.png",
);
await sharp({
  create: {
    width: columns * cellWidth,
    height: rows * cellHeight,
    channels: 4,
    background: "#05090D",
  },
})
  .composite(composites)
  .png()
  .toFile(contactSheetPath);
outputs.push(contactSheetPath);

const publicIndex = previewIndex.map(({absolutePath, ...entry}) => entry);
const indexPath = metadataPathFor(run, "preview-index.json");
writeJsonExclusive(indexPath, publicIndex);
outputs.push(indexPath);

const manifestPath = completeRun(run, {
  outputs,
  metadata: {
    sessionId: session?.id || null,
    variants: variants.map((variant) => ({
      id: variant.id,
      compositionId: variant.compositionId,
    })),
    checkpoints,
    qaPassed: qaReport.passed,
    soundDecision:
      "Previews respetan soundEnabled; los stills no reproducen audio.",
  },
});
console.log(`\nPaquete de revisión terminado: ${run.directory}`);
console.log(`QA: ${qaReport.passed ? "SUPERADO" : "BLOQUEADO"} · ${qaReport.score}/100`);
console.log(`Manifest: ${manifestPath}`);
