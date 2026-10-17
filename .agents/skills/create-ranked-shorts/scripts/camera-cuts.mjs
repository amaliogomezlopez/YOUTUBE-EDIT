#!/usr/bin/env node
/**
 * Cortes de cámara para Shorts cuando la grabación viene separada (OBS):
 *   <grabaciones>/<toma>.mkv                 mezcla: pantalla + webcam incrustada, la única con audio
 *   <grabaciones>/CAMARA/CAMARA <toma>.mkv   webcam a pantalla completa, muda
 *   <grabaciones>/PANTALLA/PANTALLA <toma>.mkv
 *
 * Cada short sale como una carpeta con un clip numerado por tramo (1.mkv, 2.mkv...): vídeo
 * de la cámara y audio de la mezcla, listos para `npm run shorts:ingest`. Los tiempos del
 * spec van en el reloj de la cámara. El desfase cámara→mezcla se mide por toma
 * (`src/modules/video-studio/recorded-takes.js`); `--offset` lo fija a mano.
 *
 *   node .agents/skills/create-ranked-shorts/scripts/camera-cuts.mjs --recordings DIR --spec cortes.json --out DIR [--offset S] [--dry-run]
 *
 * spec: {"shorts": [{"slug": "gemini-argon", "take": "2026-10-16 21-06-15", "segments": [[2.2, 41.9], [63.4, 67.6]]}]}
 */
import {existsSync} from 'node:fs';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {cutCameraWithMixAudio, measureCameraOffset, probeDuration, settleOffsets} from '../../../../src/modules/video-studio/recorded-takes.js';

function parseArgs(argv) {
  const out = {dryRun: false};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') {out.dryRun = true; continue;}
    if (!['--recordings', '--spec', '--out', '--offset'].includes(arg)) throw new Error(`Argumento desconocido: ${arg}`);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`Falta el valor de ${arg}`);
    out[arg.slice(2)] = value;
    i += 1;
  }
  if (!out.recordings || !out.spec || !out.out) throw new Error('Uso: --recordings DIR --spec cortes.json --out DIR [--offset S] [--dry-run]');
  return out;
}

const args = parseArgs(process.argv.slice(2));
const spec = JSON.parse(await readFile(args.spec, 'utf8'));
if (!Array.isArray(spec.shorts) || !spec.shorts.length) throw new Error('El spec necesita "shorts": [...]');
const files = (take) => ({camera: path.join(args.recordings, 'CAMARA', `CAMARA ${take}.mkv`), mix: path.join(args.recordings, `${take}.mkv`)});

// Validate the whole batch before measuring or cutting anything.
for (const short of spec.shorts) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(short.slug ?? '')) throw new Error(`Slug invalido: ${short.slug}`);
  const {camera, mix} = files(short.take);
  for (const f of [camera, mix]) if (!existsSync(f)) throw new Error(`${short.slug}: no existe ${f}`);
  const length = probeDuration(camera);
  for (const seg of short.segments ?? []) {
    if (!(Array.isArray(seg) && seg[1] > seg[0] && seg[0] >= 0 && seg[1] <= length + 0.05)) throw new Error(`${short.slug}: tramo ${JSON.stringify(seg)} fuera de la toma (${length.toFixed(2)} s)`);
  }
  if (!short.segments?.length) throw new Error(`${short.slug}: sin segments`);
  const total = short.segments.reduce((a, [s, e]) => a + e - s, 0);
  console.log(`${short.slug}: ${short.segments.length} tramo(s), ${total.toFixed(1)} s de la toma ${short.take}`);
}
if (args.dryRun) process.exit(0);

const measured = {};
for (const take of [...new Set(spec.shorts.map((s) => s.take))]) {
  if (args.offset !== undefined) {measured[take] = {lag: Number(args.offset), r: null, manual: true}; continue;}
  const {camera, mix} = files(take);
  measured[take] = await measureCameraOffset(camera, mix);
  console.log(`desfase ${take}: ${measured[take].lag.toFixed(3)} s (r ${measured[take].r.toFixed(2)})`);
}
const offsets = settleOffsets(measured);
for (const [take, o] of Object.entries(offsets)) if (o.fallback) console.log(`  ${take}: correlacion baja, uso la mediana ${o.lag.toFixed(3)} s`);

for (const short of spec.shorts) {
  const dir = path.join(args.out, short.slug);
  await mkdir(dir, {recursive: true});
  const take = files(short.take);
  short.segments.forEach((seg, i) => cutCameraWithMixAudio(take, seg, offsets[short.take].lag, path.join(dir, `${i + 1}.mkv`)));
  await writeFile(path.join(dir, 'camera-cuts.json'), JSON.stringify({take: short.take, ...take, offset: offsets[short.take], segments: short.segments, clock: 'camara'}, null, 2) + '\n');
  console.log(`✔ ${dir}`);
}
