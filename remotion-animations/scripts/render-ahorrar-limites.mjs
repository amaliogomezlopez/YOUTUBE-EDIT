import { mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const renders = [
  ["AL03-Input-90", "03", "03_tokens_entrada_90.mp4"],
  ["AL06-Harness-Taller", "06", "06_harness_taller.mp4"],
  ["AL10-Claude-vs-Pi", "10", "10_claude_code_vs_pi.mp4"],
  ["AL13-Bola-Contexto", "13", "13_bola_nieve_contexto.mp4"],
  ["AL17-Un-Prompt", "17", "17_un_prompt_varias_tareas.mp4"],
  ["AL22-Skills-10-30", "22", "22_rango_skills_10_30.mp4"],
  ["AL24-Chat-Nuevo", "24", "24_chat_nuevo_revision_critica.mp4"],
  ["AL27-Subagentes", "27", "27_orquestador_subagentes.mp4"],
];

const outputRoot = path.resolve("out", "ahorrar-limites");
const remotionCli = path.resolve(
  "node_modules",
  "@remotion",
  "cli",
  "remotion-cli.js",
);

for (const [compositionId, clipNumber, filename] of renders) {
  const clipOutput = path.join(outputRoot, clipNumber);
  mkdirSync(clipOutput, { recursive: true });
  const outputPath = path.join(clipOutput, filename);
  console.log(`\nRenderizando ${compositionId} -> ${outputPath}`);
  const result = spawnSync(
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
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`\nRenders terminados en ${outputRoot}`);
