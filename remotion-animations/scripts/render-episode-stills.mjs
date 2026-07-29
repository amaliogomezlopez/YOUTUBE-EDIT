/**
 * Red de regresión visual del episodio.
 *
 * Renderiza tres stills deterministas por escena (entrada, medio, salida) de la
 * composición `Finance-Cavaliers-Episode` y los reduce a un hash perceptual.
 * Sin esta red no se puede tocar el router de escenas: no habría forma de saber
 * qué escenas cambian de píxeles y cuáles no. Ese fue exactamente el motivo por
 * el que ANM-E03 llevaba parado.
 *
 *   node scripts/render-episode-stills.mjs --update      # escribe la baseline
 *   node scripts/render-episode-stills.mjs --check       # compara contra ella
 *   node scripts/render-episode-stills.mjs --check --scenes scene-041,scene-042
 *
 * El bundle y el navegador se abren una sola vez; `remotion still` por CLI
 * volvería a empaquetar en cada frame y haría inviable la comparación.
 */
import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {bundle} from "@remotion/bundler";
import {openBrowser, renderStill, selectComposition} from "@remotion/renderer";
import {
  hashDistance,
  luminanceStats,
  perceptualHash,
} from "./lib/perceptual-hash.mjs";

const REPO_ROOT = path.resolve("..");
const COMPOSITION_ID = "Finance-Cavaliers-Episode";
/** Un dHash de 64 bits tolera ruido de antialiasing; 6 bits es ~9 % del hash. */
const DEFAULT_TOLERANCE = 6;

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
const mode = args.update ? "update" : "check";
const propsPath = path.resolve(
  REPO_ROOT,
  String(
    args.props ||
      "data/channels/finance-cavaliers/episodes/1/visuals/render-props.json",
  ),
);
const baselinePath = path.resolve(
  REPO_ROOT,
  String(
    args.baseline ||
      "tests/fixtures/visual-regression/episode-finance-cavaliers-001.json",
  ),
);
const tolerance = Number(args.tolerance ?? DEFAULT_TOLERANCE);
const sceneFilter = typeof args.scenes === "string"
  ? new Set(String(args.scenes).split(",").map((value) => value.trim()))
  : null;
const frameDirectory = args["keep-frames"]
  ? path.resolve(REPO_ROOT, String(args["keep-frames"]))
  : null;

const inputProps = JSON.parse(readFileSync(propsPath, "utf8"));
const scenes = [...inputProps.scenes].sort(
  (left, right) => left.startSeconds - right.startSeconds,
);

/**
 * Tres muestras por escena. La entrada y la salida se separan 0,35 s de la
 * frontera: justo en el corte el frame pertenece a la transición y cualquier
 * desplazamiento de una centésima cambiaría de escena, no de contenido.
 */
const EDGE_MARGIN_SECONDS = 0.35;
const checkpointsFor = (scene, nextScene, durationSeconds) => {
  const start = scene.startSeconds;
  const end = Math.min(
    nextScene ? nextScene.startSeconds : scene.endSeconds,
    durationSeconds,
  );
  const span = Math.max(0.1, end - start);
  const margin = Math.min(EDGE_MARGIN_SECONDS, span / 4);
  return [
    {label: "entrada", seconds: start + margin},
    {label: "medio", seconds: start + span / 2},
    {label: "salida", seconds: end - margin},
  ];
};

const main = async () => {
  console.log(`Props: ${propsPath}`);
  console.log(`Escenas: ${scenes.length} · modo: ${mode}`);
  const serveUrl = await bundle({
    entryPoint: path.resolve("src", "index.ts"),
    onProgress: (percent) => {
      if (percent === 100) console.log("Bundle listo.");
    },
  });
  const composition = await selectComposition({
    serveUrl,
    id: COMPOSITION_ID,
    inputProps,
  });
  const {fps, durationInFrames} = composition;
  const durationSeconds = durationInFrames / fps;
  const browser = await openBrowser("chrome");
  if (frameDirectory) mkdirSync(frameDirectory, {recursive: true});

  const frames = [];
  try {
    for (let index = 0; index < scenes.length; index++) {
      const scene = scenes[index];
      if (sceneFilter && !sceneFilter.has(scene.id)) continue;
      const checkpoints = checkpointsFor(
        scene,
        scenes[index + 1],
        durationSeconds,
      );
      for (const checkpoint of checkpoints) {
        const frame = Math.max(
          0,
          Math.min(durationInFrames - 1, Math.round(checkpoint.seconds * fps)),
        );
        const output = frameDirectory
          ? path.join(frameDirectory, `${scene.id}-${checkpoint.label}.png`)
          : null;
        const {buffer} = await renderStill({
          composition,
          serveUrl,
          inputProps,
          frame,
          imageFormat: "png",
          output,
          puppeteerInstance: browser,
        });
        const png = buffer ?? readFileSync(output);
        frames.push({
          sceneId: scene.id,
          kind: scene.kind,
          patternId: scene.patternId ?? null,
          checkpoint: checkpoint.label,
          frame,
          hash: await perceptualHash(png),
          ...(await luminanceStats(png)),
        });
      }
      process.stdout.write(
        `\r${frames.length} stills · ${scene.id} (${scene.kind})            `,
      );
    }
  } finally {
    await browser.close({silent: true});
  }
  process.stdout.write("\n");

  const snapshot = {
    version: 1,
    compositionId: COMPOSITION_ID,
    episodeId: inputProps.episodeId,
    fps,
    durationInFrames,
    hashAlgorithm: "dhash-64",
    toleranceBits: tolerance,
    generatedAt: new Date().toISOString(),
    frames,
  };

  if (mode === "update") {
    mkdirSync(path.dirname(baselinePath), {recursive: true});
    writeFileSync(baselinePath, `${JSON.stringify(snapshot, null, 2)}\n`);
    console.log(`Baseline escrita: ${baselinePath}`);
    console.log(`${frames.length} frames · ${scenes.length} escenas`);
    return;
  }

  const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
  const previous = new Map(
    baseline.frames.map((entry) => [
      `${entry.sceneId}:${entry.checkpoint}`,
      entry,
    ]),
  );
  const changed = new Map();
  const missing = [];
  for (const entry of frames) {
    const key = `${entry.sceneId}:${entry.checkpoint}`;
    const before = previous.get(key);
    if (!before) {
      missing.push(key);
      continue;
    }
    const distance = hashDistance(before.hash, entry.hash);
    if (distance <= tolerance) continue;
    const record = changed.get(entry.sceneId) ?? {
      sceneId: entry.sceneId,
      kind: entry.kind,
      patternBefore: before.patternId,
      patternAfter: entry.patternId,
      checkpoints: [],
    };
    record.checkpoints.push({
      checkpoint: entry.checkpoint,
      distanceBits: distance,
      luminanceBefore: before.luminanceMean,
      luminanceAfter: entry.luminanceMean,
    });
    changed.set(entry.sceneId, record);
  }

  console.log(
    `\nEscenas comparadas: ${new Set(frames.map((f) => f.sceneId)).size} · ` +
      `frames: ${frames.length} · tolerancia: ${tolerance} bits`,
  );
  if (missing.length) {
    console.log(`\nSin baseline (${missing.length}): ${missing.join(", ")}`);
  }
  if (!changed.size) {
    console.log("Ninguna escena cambia de píxeles.");
    return;
  }
  console.log(`\n— ESCENAS QUE CAMBIAN (${changed.size}) —`);
  for (const record of changed.values()) {
    const patternNote =
      record.patternBefore === record.patternAfter
        ? record.patternAfter
        : `${record.patternBefore} → ${record.patternAfter}`;
    console.log(
      `  ${record.sceneId} (${record.kind} · ${patternNote}): ` +
        record.checkpoints
          .map((item) => `${item.checkpoint} ${item.distanceBits}b`)
          .join(", "),
    );
  }
  if (args.strict) process.exitCode = 1;
};

await main();
