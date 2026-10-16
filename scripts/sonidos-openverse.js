#!/usr/bin/env node
/**
 * Efectos libres de Openverse (CC0 / dominio publico, sin atribucion) para SONIDOS-REELS.
 *
 *   npm run sonidos:openverse -- situaciones
 *   npm run sonidos:openverse -- buscar --situacion zoom [--q "camera shutter"] [--n 6]
 *   npm run sonidos:openverse -- adoptar --situacion zoom --id 1a2b3c4d,5e6f7a8b
 *   npm run sonidos:openverse -- demo --video TOMA.mkv [--broll a.png,b.png] [--out demo.mp4]
 *
 * `buscar` descarga vistas previas a data/openverse-sounds/ (fuera de SONIDOS-REELS) y
 * las ordena por medida. `adoptar` copia las elegidas a SONIDOS-REELS/apertura/openverse/
 * con su procedencia: quedan como biblioteca, sin entrar en ninguna rotacion hasta que se
 * eligen en ESCUCHA.html / preferencias.json. `demo` monta un video corto 16:9 con el
 * mejor candidato de cada situacion para escucharlos en contexto.
 */
import path from 'node:path';
import {loadDotEnv, parseCliArgs} from '../src/lib/utils.js';
import {OPENVERSE_SITUATIONS, adoptSounds, findSituationSounds} from '../src/modules/video-studio/openverse-sounds.js';
import {renderSoundDemo} from '../src/modules/video-studio/openverse-demo.js';

await loadDotEnv();
const [command, ...rest] = process.argv.slice(2);
const args = parseCliArgs(rest);
const list = (value) => String(value ?? '').split(',').map((item) => item.trim()).filter(Boolean);

try {
  if (command === 'situaciones') {
    for (const [id, s] of Object.entries(OPENVERSE_SITUATIONS)) console.log(`${id.padEnd(14)} ${s.ms[0]}-${s.ms[1]} ms  pico ${s.peak.padEnd(5)}  ${s.queries.join(' | ')}`);
  } else if (command === 'buscar') {
    const situations = args.situacion === 'todas' ? Object.keys(OPENVERSE_SITUATIONS) : list(args.situacion);
    if (!situations.length) throw new Error('Falta --situacion (o --situacion todas). Ver: npm run sonidos:openverse -- situaciones');
    for (const situation of situations) {
      const result = await findSituationSounds(situation, {queries: args.q ? list(args.q) : undefined, limit: Number(args.n) || 6, log: (line) => console.warn('  ' + line)});
      console.log(`\n${situation}: ${result.candidates.length} candidatos medidos (CC0/PDM)`);
      for (const c of result.top) {
        console.log(`  ${c.id.slice(0, 8)}  ${c.score.toFixed(2)}  ${c.audio.usefulSeconds.toFixed(2)}s  pico ${c.audio.peakSeconds.toFixed(2)}s  ${c.license}  ${c.title.slice(0, 48)}${c.reasons.length ? '  [' + c.reasons.join(', ') + ']' : ''}`);
      }
    }
  } else if (command === 'adoptar') {
    if (!args.situacion || !args.id) throw new Error('Uso: adoptar --situacion <id> --id <id8,...>');
    const names = await adoptSounds(args.situacion, list(args.id));
    console.log('Copiados a SONIDOS-REELS (biblioteca de la apertura):');
    for (const name of names) console.log('  ' + name);
    console.log('Para que salgan en ESCUCHA.html: npm run talking-head -- sounds && npm run sonidos:escucha');
  } else if (command === 'demo') {
    if (!args.video) throw new Error('Falta --video con una toma a camara.');
    const out = await renderSoundDemo({
      video: path.resolve(args.video),
      broll: list(args.broll).map((file) => path.resolve(file)),
      out: args.out ? path.resolve(args.out) : undefined,
      start: Number(args.start) || 0,
      log: (line) => console.log(line)
    });
    console.log('Demo: ' + out);
  } else {
    throw new Error('Comandos: situaciones | buscar | adoptar | demo');
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
