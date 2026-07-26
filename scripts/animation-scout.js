#!/usr/bin/env node
import path from 'node:path';
import {scoutAnimations} from '../src/lib/animation-scout.js';
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';

function usage() {
  console.log(`Shortsmith Animation Scout

Extrae fotogramas densos, crea hojas de contacto, mide cambios visuales y,
opcionalmente, usa un LLM multimodal para preparar un handoff a Remotion.
No transcribe ni extrae audio.

Uso:
  npm run scout:animations -- --source "D:\\videos\\referencia.mp4" --mode survey
  npm run scout:animations -- --source "D:\\videos\\referencia.mp4" --mode study --start 00:42 --end 00:50 --fps 12 --analyze
  npm run scout:animations -- --source "https://youtu.be/..." --mode survey --analyze

Opciones:
  --source          Ruta local o URL admitida por yt-dlp. También acepta --video.
  --mode            survey o study. Default: survey.
  --start           Inicio en segundos, MM:SS o HH:MM:SS.
  --end             Final en segundos, MM:SS o HH:MM:SS.
  --fps             Frames por segundo solicitados. Study usa 8 por defecto; máximo 60.
  --max-frames      Presupuesto de frames. Default: 240.
  --resolution      Ancho máximo de cada frame. Survey 960; study 1280.
  --crop            Recorte opcional x:y:ancho:alto en píxeles.
  --columns         Columnas por hoja de contacto. Default: 4.
  --rows            Filas por hoja de contacto. Default: 3.
  --tile-width      Ancho de cada celda. Default: 320.
  --candidates      Máximo de ventanas heurísticas. Default: 8.
  --goal            Pregunta u objetivo visual específico.
  --analyze         Envía solo las hojas de contacto al LLM visual configurado.
  --out             Carpeta de salida vacía. Default: data/review/animation-scout/<id>.
  --help            Muestra esta ayuda.

Configuración del LLM visual:
  VISION_LLM_PROVIDER=openai-compatible
  VISION_LLM_BASE_URL=https://api.openai.com/v1
  VISION_LLM_API_KEY=...
  VISION_LLM_MODEL=modelo-con-vision
`);
}

function optionalNumber(args, key) {
  if (args[key] === undefined) return undefined;
  const value = Number(args[key]);
  if (!Number.isFinite(value)) throw new Error(`--${key} debe ser numérico.`);
  return value;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (args.help || args.h) {
    usage();
    return;
  }
  const source = args.source || args.video || args._[0];
  if (!source) {
    usage();
    process.exitCode = 1;
    return;
  }
  await loadDotEnv();
  const result = await scoutAnimations(String(source), {
    mode: args.mode,
    start: args.start,
    end: args.end,
    fps: optionalNumber(args, 'fps'),
    maxFrames: optionalNumber(args, 'max-frames'),
    resolution: optionalNumber(args, 'resolution'),
    crop: args.crop,
    columns: optionalNumber(args, 'columns'),
    rows: optionalNumber(args, 'rows'),
    tileWidth: optionalNumber(args, 'tile-width'),
    motionCandidates: optionalNumber(args, 'candidates'),
    goal: args.goal,
    analyze: Boolean(args.analyze),
    outputDir: args.out ? path.resolve(String(args.out)) : undefined,
    onProgress: ({message}) => console.log(`[scout] ${message}`)
  });
  console.log('');
  console.log(`Scouting listo: ${result.id}`);
  console.log(`Carpeta: ${result.jobDir}`);
  console.log(`Hojas: ${result.manifest.contactSheets.length}`);
  console.log(`Frames: ${result.manifest.frames.length} @ ${result.manifest.sampling.effectiveFps} fps`);
  console.log(`Handoff Remotion: ${result.files.remotionHandoff}`);
  if (result.analysis) {
    console.log(`Análisis visual: ${result.files.visualReport}`);
  } else if (result.analysisError) {
    console.error(`Análisis visual: falló · ${result.analysisError}`);
    process.exitCode = 1;
  } else {
    console.log('Análisis visual: pendiente; configura VISION_LLM_* y añade --analyze.');
  }
  for (const warning of result.manifest.warnings) console.warn(`[scout] aviso: ${warning}`);
}

main().catch((error) => {
  console.error(`[scout] ${error.message}`);
  process.exitCode = 1;
});
