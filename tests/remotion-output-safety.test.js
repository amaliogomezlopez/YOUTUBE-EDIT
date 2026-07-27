import assert from "node:assert/strict";
import {existsSync} from "node:fs";
import {mkdir, readFile, rm, writeFile} from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  completeRun,
  createRunDirectory,
  metadataPathFor,
  outputPathFor,
  previewPathFor,
  renderPathFor,
} from "../remotion-animations/scripts/lib/output-run.mjs";

const testRoot = path.resolve(
  "remotion-animations",
  "out",
  `.output-safety-test-${process.pid}`,
);

test.before(async () => {
  await mkdir(testRoot, {recursive: true});
});

test.after(async () => {
  await rm(testRoot, {recursive: true, force: true});
});

test("cada ejecución reserva una carpeta distinta incluso con el mismo ID base", async () => {
  const options = {
    project: "collision-test",
    outputRoot: testRoot,
    now: new Date("2026-07-26T12:34:56.789Z"),
    entropy: "fixed",
    script: "test",
  };
  const first = createRunDirectory(options);
  const sentinel = renderPathFor(first, "clip.mp4");
  await writeFile(sentinel, "primera ejecución", "utf8");

  const second = createRunDirectory(options);

  assert.notEqual(first.directory, second.directory);
  assert.equal(second.runId, `${first.runId}-02`);
  assert.equal(await readFile(sentinel, "utf8"), "primera ejecución");
  assert.equal(existsSync(path.join(first.directory, "run-start.json")), true);
  assert.equal(existsSync(path.join(second.directory, "run-start.json")), true);
});

test("rechaza escapar de la ejecución y reutilizar un nombre existente", async () => {
  const run = createRunDirectory({
    project: "path-test",
    outputRoot: testRoot,
    entropy: "safe",
    script: "test",
  });
  const output = renderPathFor(run, "03", "clip.mp4");
  await writeFile(output, "original", "utf8");

  assert.throws(
    () => renderPathFor(run, "03", "clip.mp4"),
    /rechazó sobrescribir/,
  );
  assert.throws(
    () => outputPathFor(run, "..", "fuera.mp4"),
    /debe quedar dentro/,
  );
  assert.equal(await readFile(output, "utf8"), "original");
});

test("el cierre de ejecución registra salidas una sola vez", async () => {
  const run = createRunDirectory({
    project: "manifest-test",
    outputRoot: testRoot,
    entropy: "manifest",
    script: "test",
  });
  const output = renderPathFor(run, "clip.mp4");
  await writeFile(output, "render", "utf8");
  const resultPath = completeRun(run, {outputs: [output]});
  const result = JSON.parse(await readFile(resultPath, "utf8"));

  assert.equal(result.status, "completed");
  assert.deepEqual(result.outputs, ["renders/clip.mp4"]);
  assert.throws(
    () => completeRun(run, {outputs: [output]}),
    (error) => error?.code === "EEXIST",
  );
});

test("separa renders, previews y metadatos dentro de cada ejecución", async () => {
  const run = createRunDirectory({
    project: "organized-test",
    outputRoot: testRoot,
    entropy: "organized",
    script: "test",
  });
  const render = renderPathFor(run, "clip.mp4");
  const preview = previewPathFor(run, "frames", "001.png");
  const metadata = metadataPathFor(run, "preview-index.json");

  assert.equal(
    path.relative(run.directory, render).replaceAll("\\", "/"),
    "renders/clip.mp4",
  );
  assert.equal(
    path.relative(run.directory, preview).replaceAll("\\", "/"),
    "previews/frames/001.png",
  );
  assert.equal(
    path.relative(run.directory, metadata).replaceAll("\\", "/"),
    "metadata/preview-index.json",
  );
});
