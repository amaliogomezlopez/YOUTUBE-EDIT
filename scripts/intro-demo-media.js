#!/usr/bin/env node
/**
 * Regenera la media sintética del proyecto de intro de referencia (`demo-canal`).
 *
 * La media de los proyectos está ignorada por git, así que el proyecto de referencia
 * no se puede renderizar recién clonado. Este script genera con ffmpeg tres clips y
 * una pista de música con un pulso de 120 BPM, suficientes para comprobar el ciclo
 * completo —ingesta, plan, build, render— sin depender de grabaciones reales.
 *
 * No sustituye a un proyecto de verdad: no hay cara que detectar ni voz que
 * transcribir, así que el proyecto de referencia ancla todo por `atBeat`, que es
 * justamente el ancla canónica de esta superficie.
 *
 *   node scripts/intro-demo-media.js [--out <carpeta>]
 */
import path from 'node:path';
import {ensureDir, parseCliArgs, run, TMP_DIR} from '../src/lib/utils.js';

const args = parseCliArgs(process.argv.slice(2));
const outDir = args.out && args.out !== true
  ? String(args.out)
  : path.join(TMP_DIR, 'intro-demo-canal');
const assetsDir = path.join(outDir, 'ASSETS');
await ensureDir(assetsDir);

/** Los tres clips simulan tres planos distintos del mismo busto parlante. */
const CLIPS = [
  {name: '01.mp4', seconds: 4, pattern: 'testsrc2', tone: 220},
  {name: '02.mp4', seconds: 5, pattern: 'smptebars', tone: 262},
  {name: '03.mp4', seconds: 4, pattern: 'testsrc2', tone: 330}
];

for (const clip of CLIPS) {
  const file = path.join(outDir, clip.name);
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `${clip.pattern}=size=1920x1080:rate=60:duration=${clip.seconds}`,
    '-f', 'lavfi', '-i', `sine=frequency=${clip.tone}:duration=${clip.seconds}:sample_rate=48000`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k',
    '-shortest',
    file
  ]);
  console.log(`clip ${clip.name} (${clip.seconds}s)`);
}

/**
 * Pista con un golpe cada 0,5 s: 120 BPM exactos. El decaimiento exponencial es lo
 * que hace que el estimador de tempo encuentre un ataque claro; una onda continua no
 * tiene golpes que detectar.
 */
const musicFile = path.join(outDir, 'music.wav');
await run('ffmpeg', [
  '-y',
  '-f', 'lavfi',
  '-i', "aevalsrc='0.7*sin(2*PI*70*t)*exp(-14*mod(t,0.5))':d=14:s=44100",
  musicFile
]);
console.log('musica music.wav (120 BPM)');

/** Dos imágenes planas que hacen de logo: una clara y una con acento. */
for (const [name, color] of [['marca-clara.png', 'white'], ['marca-acento.png', '0xFFB300']]) {
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi', '-i', `color=c=${color}:size=512x512:duration=1`,
    '-frames:v', '1',
    path.join(assetsDir, name)
  ]);
}
console.log('assets marca-clara.png, marca-acento.png');

console.log('');
console.log(`media generada en ${outDir}`);
console.log('Ingesta:');
console.log(
  `  npm run intro:ingest -- --source "${outDir}" --slug demo-canal ` +
  `--music "${musicFile}" --no-transcribe --force`
);
