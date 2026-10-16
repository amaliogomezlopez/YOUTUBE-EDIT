/**
 * Sonoridad de efectos frente a la voz.
 *
 * Igualar efectos por pico (lo que hace el importador de SONIDOS-REELS) no iguala lo
 * que se oye: un boom denso y un clic fino con el mismo pico a -3 dBFS suenan con
 * una diferencia de 10 dB o mas. Aqui se mide la sonoridad momentanea maxima del
 * efecto (EBU R128, ventana de 400 ms) y se coloca a una distancia fija por debajo
 * de la sonoridad integrada de la voz, segun la situacion de montaje.
 */
import path from 'node:path';
import {existsSync} from 'node:fs';
import {readJson, run, writeJson} from '../../lib/utils.js';

/**
 * LU por debajo de la voz (sonoridad integrada) a la que debe quedar el pico de
 * sonoridad momentanea de cada efecto. Provisional hasta que el usuario lo valide
 * de oido: la demo de `sonidos:openverse` existe para eso.
 *
 * Criterio: lo que remata (golpe, remate, dinero) queda mas cerca de la voz; lo
 * que acompana un corte (whoosh, obturador) mas lejos; lo de interfaz (clic, pop)
 * es lo mas bajo porque se repite y cansa antes.
 */
export const SFX_LEVELS_LU = {
  arranque: -7,
  'toma-nueva': -10,
  'entrar-broll': -9,
  'salir-broll': -10,
  'zoom-inverso': -8,
  captura: -11,
  glitch: -10,
  papel: -11,
  zoom: -10,
  'golpe-palabra': -6,
  remate: -5,
  cifra: -9,
  dinero: -7,
  mensaje: -10,
  titular: -12,
  clic: -13
};
export const DEFAULT_SFX_LEVEL_LU = -9;
/** Techo de pico de un efecto tras la ganancia: deja aire al limitador de la mezcla. */
export const SFX_PEAK_CEILING_DB = -2;
/** La voz de los clips sale de la ingesta a -14 LUFS (`media-ingest.js`). */
export const VOICE_TARGET_LUFS = -14;

/** Max de M y la I del log de ebur128 (`framelog=verbose`). */
export function parseEbur128(stderr) {
  let maxMomentary = -Infinity;
  for (const match of stderr.matchAll(/ M:\s*(-?[\d.]+)/g)) maxMomentary = Math.max(maxMomentary, Number(match[1]));
  const integrated = Number(stderr.match(/Summary:[\s\S]*?I:\s*(-?[\d.]+) LUFS/)?.[1]);
  const truePeak = Number(stderr.match(/Summary:[\s\S]*?Peak:\s*(-?[\d.]+) dBFS/)?.[1]);
  return {
    maxMomentaryLufs: Number.isFinite(maxMomentary) ? maxMomentary : null,
    integratedLufs: Number.isFinite(integrated) ? integrated : null,
    truePeakDb: Number.isFinite(truePeak) ? truePeak : null
  };
}

/**
 * Mide un fichero (o un tramo con `start`/`duration`). Se rellena con medio segundo
 * de silencio para que un efecto mas corto que la ventana de 400 ms tenga medida.
 */
export async function measureLoudness(file, {start, duration} = {}) {
  const args = ['-hide_banner', '-nostats', '-loglevel', 'verbose'];
  if (start !== undefined) args.push('-ss', String(start));
  if (duration !== undefined) args.push('-t', String(duration));
  args.push('-i', file, '-vn', '-af', 'apad=pad_dur=0.5,ebur128=framelog=verbose:peak=true', '-f', 'null', '-');
  const {stderr} = await run('ffmpeg', args);
  return parseEbur128(stderr);
}

/**
 * Ganancia en dB para que el efecto quede `SFX_LEVELS_LU[situacion]` por debajo de
 * la voz, sin que su pico pase de `SFX_PEAK_CEILING_DB`.
 */
export function sfxGainDb({situation, voiceLufs = VOICE_TARGET_LUFS, momentaryLufs, peakDb, levels = SFX_LEVELS_LU}) {
  if (!Number.isFinite(momentaryLufs)) throw new Error('Efecto sin medida de sonoridad');
  const target = voiceLufs + (levels[situation] ?? DEFAULT_SFX_LEVEL_LU);
  let gain = target - momentaryLufs;
  if (Number.isFinite(peakDb)) gain = Math.min(gain, SFX_PEAK_CEILING_DB - peakDb);
  return Math.round(gain * 10) / 10;
}

/**
 * Situacion de montaje de cada familia de sonido (`SOUND_SITUATIONS` de intro-studio),
 * para que un efecto pedido por familia sepa a que distancia de la voz va.
 */
export const FAMILY_SITUATION = {
  riser: 'arranque', shutter: 'toma-nueva', whoosh: 'entrar-broll', whip: 'salir-broll',
  rewind: 'zoom-inverso', pop: 'captura', reveal: 'captura', glitch: 'glitch', paper: 'papel',
  camera: 'zoom', boom: 'golpe-palabra', hit: 'golpe-palabra', impact: 'remate',
  tick: 'cifra', chime: 'cifra', money: 'dinero', message: 'mensaje', typing: 'titular', ui: 'clic'
};

/** Metadata de un efecto importado: duracion y, si se midio, su sonoridad. */
export function soundMetadata(entry, durationSeconds = entry.durationSeconds) {
  return {
    durationSeconds,
    ...(Number.isFinite(entry.momentaryLufs) ? {momentaryLufs: entry.momentaryLufs} : {}),
    ...(Number.isFinite(entry.truePeakDb) ? {truePeakDb: entry.truePeakDb} : {})
  };
}

/**
 * Volumen lineal (0..1) de un efecto medido, pedido por familia: su distancia a la
 * voz y la intensidad del plan como ajuste relativo. `null` si no esta medido.
 */
export function calibratedVolume(familyId, metadata, intensity = 1) {
  if (!Number.isFinite(metadata?.momentaryLufs)) return null;
  const gain = sfxGainDb({situation: FAMILY_SITUATION[familyId], momentaryLufs: metadata.momentaryLufs, peakDb: metadata.truePeakDb})
    + 20 * Math.log10(Math.max(0.01, intensity));
  return Math.round(Math.min(1, 10 ** (gain / 20)) * 1000) / 1000;
}

/** Efectos de SONIDOS-REELS. */
export const USER_SFX = /^sfx\/user-reel-[a-z0-9-]+\.wav$/;
/** Cualquier efecto de `public/sfx`, tambien la libreria sintetica (montaje viral). */
export const ANY_SFX = /^sfx\/[a-z0-9-]+\.wav$/;

/**
 * Completa la sonoridad de los efectos del usuario que la metadata no trae (planes
 * escritos antes de medirla, paletas copiadas dentro del plan). Lo medido se guarda
 * en `public/sfx/loudness-index.json`: el contenido de un `user-reel-<hash>` no
 * cambia, asi que cada fichero se mide una sola vez.
 */
export async function withSfxLoudness(metadata, files, {publicRoot, pattern = USER_SFX}) {
  const wanted = [...new Set(files)].filter((file) => pattern.test(file) && !Number.isFinite(metadata?.[file]?.momentaryLufs));
  if (!wanted.length) return metadata;
  const indexFile = path.join(publicRoot, 'sfx', 'loudness-index.json');
  const index = await readJson(indexFile).catch(() => ({version: 1, files: {}}));
  let changed = false;
  for (const file of wanted) {
    if (index.files[file] || !existsSync(path.join(publicRoot, file))) continue;
    const measured = await measureLoudness(path.join(publicRoot, file));
    index.files[file] = {momentaryLufs: measured.maxMomentaryLufs, truePeakDb: measured.truePeakDb};
    changed = true;
  }
  if (changed) await writeJson(indexFile, index);
  const out = {...(metadata ?? {})};
  for (const file of wanted) if (index.files[file]) out[file] = {...out[file], ...index.files[file]};
  return out;
}

/**
 * Metadata de sonoridad de la libreria sintetica (`SOUND_FAMILIES`), para que un
 * efecto de libreria tambien salga calibrado. Se mezcla por debajo de la del usuario.
 */
export async function libraryLoudness({publicRoot, files}) {
  return withSfxLoudness({}, files, {publicRoot, pattern: ANY_SFX});
}
