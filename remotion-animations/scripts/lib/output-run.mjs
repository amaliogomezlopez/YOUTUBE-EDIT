import {randomUUID} from "node:crypto";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;

function assertSafeSegment(value, label) {
  const segment = String(value ?? "").trim();
  if (!SAFE_SEGMENT.test(segment) || segment === "." || segment === "..") {
    throw new Error(`${label} no es un segmento de ruta seguro: ${value}`);
  }
  return segment;
}

function assertInside(root, target, label = "La ruta") {
  const relative = path.relative(root, target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} debe quedar dentro de ${root}: ${target}`);
  }
  return relative;
}

function formatTimestamp(value) {
  const date = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha de ejecución no válida: ${value}`);
  }
  return date
    .toISOString()
    .replace(/[-:.]/g, "")
    .replace("Z", "Z");
}

export function writeJsonExclusive(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
}

export function createRunDirectory({
  project,
  purpose = "render",
  outputRoot = path.resolve("out"),
  now = new Date(),
  entropy = randomUUID().slice(0, 8),
  script = path.basename(process.argv[1] || "unknown"),
} = {}) {
  const safeProject = assertSafeSegment(project, "project");
  const safePurpose = assertSafeSegment(purpose, "purpose");
  const safeEntropy = assertSafeSegment(entropy, "entropy");
  const absoluteOutputRoot = path.resolve(outputRoot);
  const runsRoot = path.join(absoluteOutputRoot, safeProject, "runs");
  mkdirSync(runsRoot, {recursive: true});

  const baseRunId = `${formatTimestamp(now)}-${safeEntropy}`;
  let runId;
  let runDirectory;

  for (let attempt = 1; attempt <= 999; attempt += 1) {
    runId =
      attempt === 1
        ? baseRunId
        : `${baseRunId}-${String(attempt).padStart(2, "0")}`;
    runDirectory = path.join(runsRoot, runId);
    try {
      mkdirSync(runDirectory, {recursive: false});
      break;
    } catch (error) {
      if (error?.code !== "EEXIST") {
        throw error;
      }
      runDirectory = null;
    }
  }

  if (!runDirectory || !runId) {
    throw new Error(`No se pudo reservar una ejecución única en ${runsRoot}`);
  }

  const run = Object.freeze({
    version: 1,
    runId,
    project: safeProject,
    purpose: safePurpose,
    createdAt: new Date(now).toISOString(),
    outputRoot: absoluteOutputRoot,
    runsRoot,
    directory: runDirectory,
    script,
  });

  writeJsonExclusive(path.join(runDirectory, "run-start.json"), {
    version: run.version,
    runId: run.runId,
    project: run.project,
    purpose: run.purpose,
    status: "started",
    createdAt: run.createdAt,
    script: run.script,
  });

  return run;
}

export function outputPathFor(run, ...segments) {
  if (!run?.directory) {
    throw new Error("Falta una ejecución de salida válida.");
  }
  if (!segments.length) {
    throw new Error("Falta el nombre del artefacto de salida.");
  }
  const outputPath = path.resolve(run.directory, ...segments.map(String));
  assertInside(run.directory, outputPath, "El artefacto");
  mkdirSync(path.dirname(outputPath), {recursive: true});
  if (existsSync(outputPath)) {
    throw new Error(`Se rechazó sobrescribir un artefacto existente: ${outputPath}`);
  }
  return outputPath;
}

export function renderPathFor(run, ...segments) {
  return outputPathFor(run, "renders", ...segments);
}

export function previewPathFor(run, ...segments) {
  return outputPathFor(run, "previews", ...segments);
}

export function metadataPathFor(run, ...segments) {
  return outputPathFor(run, "metadata", ...segments);
}

export function completeRun(run, {outputs = [], metadata = {}} = {}) {
  const normalizedOutputs = outputs.map((output) => {
    const absolute = path.resolve(output);
    return assertInside(run.directory, absolute, "El artefacto registrado").replace(
      /\\/g,
      "/",
    );
  });
  const resultPath = path.join(run.directory, "run-result.json");
  writeJsonExclusive(resultPath, {
    version: run.version,
    runId: run.runId,
    project: run.project,
    purpose: run.purpose,
    status: "completed",
    createdAt: run.createdAt,
    completedAt: new Date().toISOString(),
    script: run.script,
    outputs: normalizedOutputs,
    metadata,
  });
  return resultPath;
}
