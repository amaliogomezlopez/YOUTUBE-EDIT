import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("data", "transcriptions", "ahorrar-limites");
const outputDir = path.resolve(
  "remotion-animations",
  "out",
  "ahorrar-limites",
  "TRANSCRIPCIONES",
);

const timestamp = (seconds) => {
  const milliseconds = Math.max(0, Math.round(Number(seconds) * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const secs = Math.floor((milliseconds % 60_000) / 1000);
  const millis = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
};

await mkdir(outputDir, { recursive: true });
const files = (await readdir(sourceDir))
  .filter((file) => /^\d+\.json$/.test(file))
  .sort((left, right) => Number.parseInt(left) - Number.parseInt(right));

const complete = ["# Transcripción completa · Ahorrar límites", ""];
for (const file of files) {
  const clipNumber = path.basename(file, ".json");
  const padded = clipNumber.padStart(2, "0");
  const payload = JSON.parse(
    await readFile(path.join(sourceDir, file), "utf8"),
  );
  const segments = Array.isArray(payload.segments) ? payload.segments : [];
  const plainText = segments.map((segment) => segment.text.trim()).join("\n\n");
  const srt = segments
    .map(
      (segment, index) =>
        `${index + 1}\n${timestamp(segment.start)} --> ${timestamp(
          segment.end,
        )}\n${segment.text.trim()}`,
    )
    .join("\n\n");

  await writeFile(
    path.join(outputDir, `${padded}.txt`),
    `${plainText}\n`,
    "utf8",
  );
  await writeFile(path.join(outputDir, `${padded}.srt`), `${srt}\n`, "utf8");
  await writeFile(
    path.join(outputDir, `${padded}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
  complete.push(`## Clip ${clipNumber}`, "", plainText, "");
}

await writeFile(
  path.join(outputDir, "TRANSCRIPCION_COMPLETA.md"),
  `${complete.join("\n")}\n`,
  "utf8",
);

console.log(`Exportadas ${files.length} transcripciones en ${outputDir}`);
