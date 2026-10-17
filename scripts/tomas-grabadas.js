#!/usr/bin/env node
/**
 * Tomas numeradas (1.mkv, 2.mkv...) desde una carpeta de OBS con salidas separadas, para
 * los montajes que esperan tomas numeradas (`edit`, `youtube:escritorio`, `intro:viral`).
 *
 *   npm run tomas -- --recordings "<VIDEOS_RECORDED>" --out data/youtube-src/<slug> [--video camara|mezcla] [--order oldest|newest] [--offset S] [--dry-run]
 *
 * - Orden: de la toma mas antigua a la mas nueva salvo `--order newest` (lo pide el autor).
 * - Imagen: la de CAMARA por defecto (la cara a pantalla completa); `--video mezcla` deja
 *   la pantalla con la webcam incrustada. El audio siempre es el de la mezcla, la unica
 *   salida que lo tiene, desplazado por el desfase medido de cada toma.
 * - `tomas.json` dice que fichero original es cada numero, su desfase y su PANTALLA, para
 *   recortar de ahi los recursos de pantalla.
 */
import {mkdir, writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {parseCliArgs} from '../src/lib/utils.js';
import {cutCameraWithMixAudio, listRecordedTakes, measureCameraOffset, settleOffsets} from '../src/modules/video-studio/recorded-takes.js';

const USAGE = 'Uso: npm run tomas -- --recordings DIR --out DIR [--video camara|mezcla] [--order oldest|newest] [--offset S] [--dry-run]';
const args = parseCliArgs(process.argv.slice(2));
const video = String(args.video ?? 'camara');
const order = String(args.order ?? 'oldest');
if (!args.recordings || args.recordings === true || !args.out || args.out === true || !['camara', 'mezcla'].includes(video) || !['oldest', 'newest'].includes(order)) {
  console.error(USAGE);
  process.exit(1);
}

const takes = await listRecordedTakes(String(args.recordings), {order});
if (!takes.length) {
  console.error(`No hay tomas separadas en ${args.recordings}: falta CAMARA/ o no hay "CAMARA <toma>" para ninguna toma de la raiz.`);
  process.exit(1);
}
takes.forEach((t, i) => console.log(`${i + 1}. ${t.name}${t.screen ? '' : '  (sin PANTALLA)'}`));
if (args['dry-run']) process.exit(0);

const measured = {};
for (const t of takes) {
  if (video === 'mezcla') continue;
  measured[t.name] = args.offset !== undefined ? {lag: Number(args.offset), r: null, manual: true} : await measureCameraOffset(t.camera, t.mix);
  if (!measured[t.name].manual) console.log(`desfase ${t.name}: ${measured[t.name].lag.toFixed(3)} s (r ${measured[t.name].r.toFixed(2)})`);
}
const offsets = video === 'mezcla' ? {} : settleOffsets(measured);

const out = String(args.out);
await mkdir(out, {recursive: true});
const index = [];
for (const [i, t] of takes.entries()) {
  const file = path.join(out, `${i + 1}.mkv`);
  if (video === 'mezcla') {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', t.mix, '-map', '0:v:0', '-map', '0:a:0', '-c', 'copy', file], {encoding: 'utf8'});
    if (r.status !== 0) throw new Error(`ffmpeg fallo en ${file}: ${r.stderr}`);
  } else {
    cutCameraWithMixAudio(t, null, offsets[t.name].lag, file);
    if (offsets[t.name].fallback) console.log(`  ${t.name}: correlacion baja, uso la mediana ${offsets[t.name].lag.toFixed(3)} s`);
  }
  index.push({take: i + 1, file: path.basename(file), source: t.name, video, mix: t.mix, camera: t.camera, screen: t.screen, offset: offsets[t.name] ?? null});
  console.log(`✔ ${i + 1}.mkv ← ${t.name}`);
}
await writeFile(path.join(out, 'tomas.json'), JSON.stringify({recordings: path.resolve(String(args.recordings)), order, video, clock: video === 'camara' ? 'camara' : 'mezcla', takes: index}, null, 2) + '\n');
console.log(`\ntomas.json en ${out}. Siguiente: el montaje sobre esa carpeta (edit, youtube:escritorio o intro:viral).`);
