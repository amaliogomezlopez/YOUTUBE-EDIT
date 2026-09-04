import {spawnSync} from "node:child_process";
import path from "node:path";
import {
  completeRun,
  createRunDirectory,
  previewPathFor,
} from "./lib/output-run.mjs";

const compositions = [
  ["Catalog-Icons-01", "icons-01.png", 90],
  ["Catalog-Icons-02", "icons-02.png", 90],
  ["Catalog-Icons-03", "icons-03.png", 90],
  ["Catalog-Drawings", "drawings.png", 150],
];
const run = createRunDirectory({
  project: "visual-catalog",
  purpose: "previews",
});
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);
const outputs = [];

console.log(`\nEjecución ${run.runId}`);
for (const [compositionId, filename, frame] of compositions) {
  const outputPath = previewPathFor(run, "catalog", filename);
  console.log(`Still ${compositionId} -> ${outputPath}`);
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
  outputs.push(outputPath);
}

const manifestPath = completeRun(run, {
  outputs,
  metadata: {
    catalog: {
      icons: 51,
      drawings: 17,
    },
  },
});
console.log(`\nCatálogo visual renderizado en ${run.directory}`);
console.log(`Manifest: ${manifestPath}`);
