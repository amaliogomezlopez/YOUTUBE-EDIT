/**
 * Efectos de sonido libres de Openverse (api.openverse.org) para SONIDOS-REELS.
 *
 * Solo se aceptan obras sin obligacion de atribucion: CC0 y marca de dominio
 * publico (PDM). La API se consulta con ese filtro y, ademas, cada resultado se
 * vuelve a comprobar aqui: una licencia que no esta en la lista no se descarga
 * aunque el servidor la devuelva.
 *
 * El flujo tiene dos pasos y una carpeta de por medio:
 *   1. `buscar`: consulta por situacion de montaje, descarga las vistas previas a
 *      `data/openverse-sounds/<situacion>/` (fuera de SONIDOS-REELS, para que el
 *      importador no las recoja) y las mide (pico, ataque, cola).
 *   2. `adoptar`: copia las elegidas a `SONIDOS-REELS/apertura/openverse/` con su
 *      procedencia. Ahi son sonidos de biblioteca (`use: library`): aparecen en
 *      ESCUCHA.html y en preferencias.json, pero no entran en ninguna rotacion
 *      hasta que el usuario los elige. Por eso el nombre nunca empieza por un
 *      prefijo de uso ni contiene money/riser/message (ver `sound-usage.js`).
 *
 * Freesound es casi todo el catalogo de efectos de Openverse, y el `url` que da es
 * la vista previa MP3 de alta calidad: el original exige OAuth de Freesound.
 */
import path from 'node:path';
import {execFile} from 'node:child_process';
import {copyFile, readFile, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {DATA_DIR, ROOT, ensureDir, readJson, writeJson} from '../../lib/utils.js';
import {measureLoudness, sfxGainDb} from './sound-loudness.js';

export const OPENVERSE_AUDIO_SEARCH = 'https://api.openverse.org/v1/audio/';
export const OPENVERSE_TOKEN_URL = 'https://api.openverse.org/v1/auth_tokens/token/';
/** Licencias que no obligan a citar al autor. */
export const ATTRIBUTION_FREE_LICENSES = new Set(['cc0', 'pdm']);
export const OPENVERSE_STAGING_DIR = path.join(DATA_DIR, 'openverse-sounds');
export const OPENVERSE_LIBRARY_DIR = path.join(ROOT, 'SONIDOS-REELS', 'apertura', 'openverse');
export const OPENVERSE_PROVENANCE_FILE = path.join(OPENVERSE_LIBRARY_DIR, 'procedencia.json');
/** Hosts de los que se aceptan descargas: los CDN de las fuentes de Openverse. */
const DOWNLOAD_HOSTS = new Set(['cdn.freesound.org', 'upload.wikimedia.org']);

/**
 * Busquedas por situacion de montaje (`SOUND_SITUATIONS` de intro-studio). `ms` es
 * la duracion util que la situacion admite y `peak` donde debe estar el golpe:
 * `start` (ataque inmediato: impacto, clic) o `end` (crece hasta el corte: riser,
 * whoosh inverso). `token` es la palabra del nombre del fichero adoptado: nunca un
 * prefijo de uso ni una palabra semantica, para que el sonido quede como biblioteca.
 */
export const OPENVERSE_SITUATIONS = {
  arranque: {token: 'arranque', queries: ['riser', 'uplifter', 'build up'], ms: [1500, 6000], peak: 'end'},
  'toma-nueva': {token: 'toma', queries: ['camera shutter', 'shutter click'], ms: [120, 800], peak: 'start'},
  'entrar-broll': {token: 'entrar', queries: ['whoosh', 'swoosh'], ms: [250, 1000], peak: 'any'},
  'salir-broll': {token: 'salir', queries: ['whip swish', 'swish'], ms: [120, 700], peak: 'any'},
  'zoom-inverso': {token: 'zoominv', queries: ['reverse whoosh', 'backwards whoosh', 'reverse swoosh', 'reverse cymbal'], ms: [400, 1800], peak: 'end'},
  captura: {token: 'captura', queries: ['pop', 'bubble pop'], ms: [60, 500], peak: 'start'},
  glitch: {token: 'glitch', queries: ['glitch', 'digital glitch'], ms: [120, 900], peak: 'any'},
  papel: {token: 'papel', queries: ['paper flip', 'paper'], ms: [200, 1300], peak: 'any'},
  zoom: {token: 'zoom', queries: ['camera zoom', 'camera shutter'], ms: [150, 900], peak: 'start'},
  'golpe-palabra': {token: 'golpe', queries: ['bass hit', 'impact boom'], ms: [250, 1500], peak: 'start'},
  remate: {token: 'remate', queries: ['cinematic impact', 'boom impact'], ms: [600, 2500], peak: 'start'},
  cifra: {token: 'cifra', queries: ['ding', 'bell notification'], ms: [150, 1300], peak: 'start'},
  dinero: {token: 'caja', queries: ['cash register', 'coins'], ms: [300, 2500], peak: 'start'},
  mensaje: {token: 'aviso', queries: ['notification', 'chat notification'], ms: [150, 900], peak: 'start'},
  titular: {token: 'titular', queries: ['keyboard typing', 'typewriter'], ms: [500, 3000], peak: 'any'},
  clic: {token: 'clic', queries: ['mouse click', 'ui click'], ms: [30, 350], peak: 'start'}
};

/**
 * Palabras que `sound-usage.js` lee como uso semantico en cualquier parte del nombre.
 * Los prefijos de uso no hacen falta aqui: el nombre siempre empieza por `ov_`.
 */
const RESERVED_WORDS = /money|dinero|riser|message|mensaje/gi;

export function slugTitle(title, max = 32) {
  return String(title ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(RESERVED_WORDS, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, max).replace(/-+$/g, '') || 'sonido';
}

/** Nombre del fichero adoptado: `ov_<situacion>_<titulo>_<id8>.<ext>`. */
export function adoptedFileName(situationId, candidate) {
  const situation = OPENVERSE_SITUATIONS[situationId];
  if (!situation) throw new Error(`Situacion desconocida: ${situationId}`);
  const ext = (candidate.filetype || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp3';
  return `ov_${situation.token}_${slugTitle(candidate.title)}_${candidate.id.slice(0, 8)}.${ext}`;
}

/** Normaliza un resultado de la API; `null` si su licencia obliga a atribuir. */
export function normalizeOpenverseAudio(result) {
  const license = String(result?.license ?? '').toLowerCase();
  if (!ATTRIBUTION_FREE_LICENSES.has(license)) return null;
  let host;
  try { host = new URL(result.url).hostname; } catch { return null; }
  if (!DOWNLOAD_HOSTS.has(host)) return null;
  return {
    id: result.id,
    title: result.title,
    creator: result.creator ?? null,
    license,
    licenseVersion: result.license_version ?? null,
    licenseUrl: result.license_url ?? null,
    source: result.source ?? result.provider ?? null,
    landingUrl: result.foreign_landing_url ?? null,
    url: result.url,
    filetype: result.filetype ?? path.extname(new URL(result.url).pathname).slice(1),
    durationMs: Number(result.duration) || null,
    tags: (result.tags ?? []).map((tag) => tag.name).filter(Boolean)
  };
}

/** Token OAuth opcional (cliente registrado): sube el limite anonimo de 200/dia. */
export async function openverseToken({fetchImpl = fetch, env = process.env} = {}) {
  if (env.OPENVERSE_ACCESS_TOKEN) return env.OPENVERSE_ACCESS_TOKEN;
  if (!env.OPENVERSE_CLIENT_ID || !env.OPENVERSE_CLIENT_SECRET) return null;
  const response = await fetchImpl(OPENVERSE_TOKEN_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({grant_type: 'client_credentials', client_id: env.OPENVERSE_CLIENT_ID, client_secret: env.OPENVERSE_CLIENT_SECRET})
  });
  if (!response.ok) throw new Error(`Openverse no ha dado token (HTTP ${response.status}).`);
  return (await response.json()).access_token;
}

export async function searchOpenverseAudio(query, {pageSize = 20, page = 1, source = 'freesound', token = null, fetchImpl = fetch} = {}) {
  const url = new URL(OPENVERSE_AUDIO_SEARCH);
  url.search = new URLSearchParams({
    q: query,
    license: [...ATTRIBUTION_FREE_LICENSES].join(','),
    length: 'shortest',
    page_size: String(pageSize),
    page: String(page),
    ...(source ? {source} : {})
  }).toString();
  const response = await fetchImpl(url, {headers: {Accept: 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})}});
  if (response.status === 429) throw new Error('Openverse ha limitado las peticiones (20/min y 200/dia sin clave). Espera o configura OPENVERSE_CLIENT_ID/OPENVERSE_CLIENT_SECRET.');
  if (!response.ok) throw new Error(`Openverse respondio con HTTP ${response.status}.`);
  const body = await response.json();
  return (body.results ?? []).map(normalizeOpenverseAudio).filter(Boolean);
}

/** Envolvente en dB por bloques de PCM mono de 16 bits. */
export function envelope(pcm, {sampleRate, blockSeconds = 0.01}) {
  const block = Math.max(1, Math.round(sampleRate * blockSeconds));
  const samples = Math.floor(pcm.length / 2);
  const db = [];
  for (let start = 0; start < samples; start += block) {
    let max = 0;
    for (let i = start; i < Math.min(samples, start + block); i++) max = Math.max(max, Math.abs(pcm.readInt16LE(i * 2)));
    db.push(max ? 20 * Math.log10(max / 32768) : -120);
  }
  return {db, blockSeconds: block / sampleRate};
}

/**
 * Medidas que deciden si un efecto sirve: donde empieza a sonar (-30 dB bajo el
 * pico), donde esta el pico y cuanto dura lo audible. Es la misma idea de
 * "duracion util a -30 dB, ataque y cola" con la que se eligieron los de Mixkit.
 */
export function measureEnvelope({db, blockSeconds}) {
  let peakDb = -120, peakBlock = 0;
  db.forEach((value, index) => { if (value > peakDb) { peakDb = value; peakBlock = index; } });
  const floor = peakDb - 30;
  const first = db.findIndex((value) => value >= floor);
  let last = db.length - 1;
  while (last > 0 && db[last] < floor) last--;
  const at = (index) => Math.round(index * blockSeconds * 1000) / 1000;
  return {
    peakDb: Math.round(peakDb * 10) / 10,
    onsetSeconds: at(Math.max(0, first)),
    peakSeconds: at(peakBlock),
    endSeconds: at(last + 1),
    usefulSeconds: at(last + 1 - Math.max(0, first)),
    peakPosition: last > first ? Math.round((peakBlock - first) / (last + 1 - first) * 100) / 100 : 0
  };
}

export function measureAudio(file, {sampleRate = 22050} = {}) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', '-'],
      {encoding: 'buffer', maxBuffer: 1 << 28}, (error, stdout) => {
        if (error) return reject(error);
        resolve(measureEnvelope(envelope(stdout, {sampleRate})));
      });
  });
}

/**
 * Puntuacion 0..1 de un candidato medido para una situacion. Penaliza lo que en
 * montaje se nota: duracion fuera de rango, silencio al principio (el golpe llega
 * tarde al corte), pico mal colocado y nivel muy bajo.
 */
export function scoreCandidate(situationId, measured) {
  const {ms: [min, max], peak} = OPENVERSE_SITUATIONS[situationId];
  const useful = measured.usefulSeconds * 1000;
  const reasons = [];
  let score = 1;
  if (useful < min) { score -= Math.min(0.6, (min - useful) / min); reasons.push('corto'); }
  if (useful > max) { score -= Math.min(0.6, (useful - max) / max); reasons.push('largo'); }
  // Un riser o un whoosh inverso empiezan bajos a proposito: su golpe es el final.
  if (peak !== 'end' && measured.onsetSeconds > 0.05) { score -= Math.min(0.3, measured.onsetSeconds); reasons.push('silencio inicial'); }
  if (peak === 'start' && measured.peakPosition > 0.35) { score -= 0.3; reasons.push('pico tardio'); }
  if (peak === 'end' && measured.peakPosition < 0.6) { score -= 0.35; reasons.push('no crece hasta el corte'); }
  if (measured.peakDb < -24) { score -= 0.2; reasons.push('nivel bajo'); }
  return {score: Math.max(0, Math.round(score * 100) / 100), reasons};
}

async function download(url, file, fetchImpl) {
  if (!DOWNLOAD_HOSTS.has(new URL(url).hostname)) throw new Error(`Host no permitido: ${url}`);
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`Descarga fallida (HTTP ${response.status}): ${url}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 5 * 1024 * 1024) throw new Error(`Fichero demasiado grande para un efecto: ${url}`);
  await writeFile(file, bytes);
}

/**
 * Busca, descarga a la carpeta de candidatos, mide y ordena. Lo ya descargado no se
 * vuelve a pedir. Escribe `data/openverse-sounds/<situacion>/candidatos.json`.
 */
export async function findSituationSounds(situationId, {queries, limit = 6, perQuery = 20, throttleMs = 3500, stagingDir = OPENVERSE_STAGING_DIR, fetchImpl = fetch, log = () => {}} = {}) {
  const situation = OPENVERSE_SITUATIONS[situationId];
  if (!situation) throw new Error(`Situacion desconocida: ${situationId}. Validas: ${Object.keys(OPENVERSE_SITUATIONS).join(', ')}`);
  const dir = path.join(stagingDir, situationId);
  await ensureDir(dir);
  const token = await openverseToken({fetchImpl});
  const seen = new Map();
  // Sin clave el limite es 20 peticiones por minuto: una cada 3 s no lo roza.
  for (const [index, query] of (queries ?? situation.queries).entries()) {
    if (index && !token) await new Promise((resolve) => setTimeout(resolve, throttleMs));
    for (const candidate of await searchOpenverseAudio(query, {pageSize: perQuery, token, fetchImpl})) {
      if (!seen.has(candidate.id)) seen.set(candidate.id, {...candidate, query});
    }
  }
  // La duracion que declara la API filtra antes de descargar: holgura x2 sobre el rango.
  const [min, max] = situation.ms;
  const plausible = [...seen.values()].filter((c) => !c.durationMs || (c.durationMs >= min * 0.5 && c.durationMs <= max * 2.5));
  const measured = [];
  for (const candidate of plausible.slice(0, limit * 3)) {
    const file = path.join(dir, `${candidate.id.slice(0, 8)}.${candidate.filetype || 'mp3'}`);
    try {
      if (!existsSync(file)) await download(candidate.url, file, fetchImpl);
      const audio = await measureAudio(file);
      const loudness = await measureLoudness(file);
      measured.push({...candidate, file, audio, loudness, ...scoreCandidate(situationId, audio)});
    } catch (error) {
      log(`${candidate.title}: ${error.message}`);
    }
  }
  // Una busqueda nueva suma candidatos; no borra los de antes (pueden estar ya adoptados
  // o elegidos para la demo). A los antiguos sin medida de sonoridad se les completa.
  const previous = await readJson(path.join(dir, 'candidatos.json')).catch(() => null);
  for (const old of previous?.candidates ?? []) {
    if (measured.some((c) => c.id === old.id) || !existsSync(old.file)) continue;
    measured.push(old.loudness ? old : {...old, loudness: await measureLoudness(old.file)});
  }
  measured.sort((a, b) => b.score - a.score || a.audio.onsetSeconds - b.audio.onsetSeconds);
  const report = {version: 1, situation: situationId, licenses: [...ATTRIBUTION_FREE_LICENSES], searchedAt: new Date().toISOString(), candidates: measured};
  await writeJson(path.join(dir, 'candidatos.json'), report);
  return {...report, top: measured.slice(0, limit)};
}

/**
 * Copia candidatos elegidos a SONIDOS-REELS/apertura/openverse/ y registra su
 * procedencia. Devuelve los nombres tal como los usa preferencias.json.
 */
export async function adoptSounds(situationId, ids, {stagingDir = OPENVERSE_STAGING_DIR, libraryDir = OPENVERSE_LIBRARY_DIR} = {}) {
  const report = await readJson(path.join(stagingDir, situationId, 'candidatos.json')).catch(() => null);
  if (!report) throw new Error(`No hay candidatos de ${situationId}: ejecuta antes "buscar".`);
  await ensureDir(libraryDir);
  const provenanceFile = path.join(libraryDir, 'procedencia.json');
  const provenance = await readJson(provenanceFile).catch(() => ({version: 1, nota: 'Efectos de Openverse sin obligacion de atribucion (CC0/PDM).', sounds: {}}));
  const adopted = [];
  for (const id of ids) {
    const candidate = report.candidates.find((c) => c.id.startsWith(id));
    if (!candidate) throw new Error(`${id} no esta entre los candidatos de ${situationId}.`);
    if (!ATTRIBUTION_FREE_LICENSES.has(candidate.license)) throw new Error(`${candidate.title}: licencia ${candidate.license} exige atribucion.`);
    const name = adoptedFileName(situationId, candidate);
    await copyFile(candidate.file, path.join(libraryDir, name));
    provenance.sounds[name] = {
      situation: situationId, openverseId: candidate.id, title: candidate.title, creator: candidate.creator,
      license: candidate.license, licenseVersion: candidate.licenseVersion, licenseUrl: candidate.licenseUrl,
      source: candidate.source, landingUrl: candidate.landingUrl, url: candidate.url, adoptedAt: new Date().toISOString(),
      audio: candidate.audio,
      // Sonoridad medida y ganancia que lo deja a su distancia de una voz a -14 LUFS.
      loudness: candidate.loudness ?? null,
      gainDb: candidate.loudness ? sfxGainDb({situation: situationId, momentaryLufs: candidate.loudness.maxMomentaryLufs, peakDb: candidate.loudness.truePeakDb}) : null
    };
    adopted.push(`apertura/openverse/${name}`);
  }
  await writeJson(provenanceFile, provenance);
  return adopted;
}

/** Lee el `candidatos.json` de una situacion (para la demo y la escucha). */
export async function readCandidates(situationId, {stagingDir = OPENVERSE_STAGING_DIR} = {}) {
  return JSON.parse(await readFile(path.join(stagingDir, situationId, 'candidatos.json'), 'utf8'));
}
