import path from 'node:path';
import {readFile, rm} from 'node:fs/promises';
import {ensureDir, round, run, TMP_DIR} from '../../lib/utils.js';

/**
 * Rejilla de beats de una pista de musica.
 *
 * Una intro no se monta contra la locucion sino contra la musica: si el flash, el
 * corte y la entrada del logo caen "cerca" del golpe en vez de encima, el montaje
 * se percibe flojo aunque cada pieza este bien. Por eso el plan de intro puede
 * anclar con `atBeat`, y para resolverlo hace falta saber donde estan los beats.
 *
 * Se estima sin dependencias nuevas: ffmpeg saca PCM mono a 8 kHz, se calcula la
 * envolvente de energia, y sobre su derivada positiva (la fuerza de ataque) se
 * pasa un filtro de peine para cada tempo candidato. Gana el tempo cuya rejilla
 * acumula mas ataque, y su fase se decide igual. Es suficiente para musica con
 * percusion marcada, que es la que lleva una intro; para el resto, el plan puede
 * fijar `bpm` y `offsetSeconds` a mano y este analisis no se usa.
 */

/** Frecuencia de muestreo del analisis. El tempo no vive en los agudos. */
const SAMPLE_RATE = 8000;
/** Salto de la envolvente: 8 ms da resolucion de sobra para una rejilla de beats. */
const HOP_SAMPLES = 64;
const HOP_SECONDS = HOP_SAMPLES / SAMPLE_RATE;

export const MIN_BPM = 60;
export const MAX_BPM = 190;

export async function analyzeMusicTrack(audioFile, {signal = null, bpm = null, offsetSeconds = null} = {}) {
  const envelope = await onsetEnvelope(audioFile, {signal});
  const durationSeconds = round(envelope.length * HOP_SECONDS, 3);
  if (envelope.length < 64) {
    throw new Error(`La pista ${path.basename(audioFile)} es demasiado corta para estimar el tempo.`);
  }

  const estimated = Number.isFinite(bpm) ? {bpm: Number(bpm), score: null} : estimateTempo(envelope);
  const periodFrames = (60 / estimated.bpm) / HOP_SECONDS;
  const phase = Number.isFinite(offsetSeconds)
    ? {offsetFrames: Number(offsetSeconds) / HOP_SECONDS, score: null, confidence: null}
    : estimatePhase(envelope, periodFrames);

  const beatSeconds = [];
  for (let position = phase.offsetFrames; position < envelope.length; position += periodFrames) {
    beatSeconds.push(round(position * HOP_SECONDS, 3));
  }

  return {
    bpm: round(estimated.bpm, 2),
    offsetSeconds: round(phase.offsetFrames * HOP_SECONDS, 3),
    beatSeconds,
    durationSeconds,
    // Cuanto destaca la rejilla elegida sobre el ataque medio. Por debajo de 1.5 la
    // pista no tiene pulso claro y anclar a beat no aporta nada: el build avisa.
    confidence: phase.confidence === null ? null : round(phase.confidence, 3),
    declared: {
      bpm: Number.isFinite(bpm) ? Number(bpm) : null,
      offsetSeconds: Number.isFinite(offsetSeconds) ? Number(offsetSeconds) : null
    }
  };
}

/**
 * Envolvente de ataque: energia por ventana y derivada positiva. La derivada es lo
 * que marca el golpe; la energia sola sube y baja con la mezcla y da rejillas
 * desplazadas medio beat.
 */
async function onsetEnvelope(audioFile, {signal} = {}) {
  const workspace = path.join(TMP_DIR, 'video-studio-music');
  await ensureDir(workspace);
  const pcmFile = path.join(workspace, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pcm`);
  try {
    await run('ffmpeg', [
      '-y',
      '-i', audioFile,
      '-ac', '1',
      '-ar', String(SAMPLE_RATE),
      '-f', 's16le',
      pcmFile
    ], {signal});
    const buffer = await readFile(pcmFile);
    const samples = new Int16Array(buffer.buffer, buffer.byteOffset, Math.floor(buffer.length / 2));

    const frames = Math.floor(samples.length / HOP_SAMPLES);
    const energy = new Float64Array(frames);
    for (let frame = 0; frame < frames; frame += 1) {
      let sum = 0;
      const base = frame * HOP_SAMPLES;
      for (let offset = 0; offset < HOP_SAMPLES; offset += 1) {
        const value = samples[base + offset] / 32768;
        sum += value * value;
      }
      energy[frame] = Math.sqrt(sum / HOP_SAMPLES);
    }

    const onset = new Float64Array(frames);
    for (let frame = 1; frame < frames; frame += 1) {
      onset[frame] = Math.max(0, energy[frame] - energy[frame - 1]);
    }
    return onset;
  } finally {
    await rm(pcmFile, {force: true});
  }
}

/**
 * Tempo por filtro de peine. Para cada periodo candidato se mide el ataque medio por
 * golpe de la rejilla en su mejor fase.
 *
 * La media por golpe, y no la suma, es lo que evita que 180 BPM gane siempre a 90:
 * con la suma un tempo doble acumula el doble de puntos aunque la mitad caigan en
 * silencio.
 *
 * Pero la media deja un empate real: en una pista de 120 BPM, la rejilla de 60 cae
 * sobre un golpe en todos sus beats igual que la de 120, solo que en la mitad de
 * ellos. Los dos puntuan lo mismo, y elegir el primero devuelve la mitad del tempo
 * (el error de octava clasico). Entre candidatos empatados gana el mas rapido, que
 * es el unico que explica *todos* los golpes: si la pista fuera de 60 de verdad, la
 * rejilla de 120 caeria en silencio la mitad de las veces y su media bajaria.
 *
 * El margen de empate es amplio a proposito: la diferencia entre una rejilla que
 * explica todos los golpes y una que explica la mitad es un factor 2, muy por debajo
 * de este umbral, mientras que dos rejillas que explican los mismos golpes se
 * separan solo por como caen los ataques respecto a las ventanas de analisis.
 */
const OCTAVE_TIE_RATIO = 0.85;

export function estimateTempo(onset, {minBpm = MIN_BPM, maxBpm = MAX_BPM} = {}) {
  const candidates = [];
  for (let candidate = minBpm; candidate <= maxBpm; candidate += 0.5) {
    const periodFrames = (60 / candidate) / HOP_SECONDS;
    if (periodFrames >= onset.length) continue;
    const {score} = estimatePhase(onset, periodFrames);
    candidates.push({bpm: candidate, score});
  }
  if (!candidates.length) return {bpm: 120, score: 0};

  const bestScore = Math.max(...candidates.map((candidate) => candidate.score));
  const tied = candidates.filter((candidate) => candidate.score >= bestScore * OCTAVE_TIE_RATIO);
  return tied.reduce((fastest, candidate) => (candidate.bpm > fastest.bpm ? candidate : fastest));
}

/**
 * Fase de la rejilla: el desplazamiento inicial cuyo peine acumula mas ataque.
 * Se prueban todos los desplazamientos de un periodo con paso de un frame (8 ms),
 * que es mas fino que el margen de +-60 ms con el que se juzga un golpe.
 */
export function estimatePhase(onset, periodFrames) {
  const total = onset.reduce((sum, value) => sum + value, 0);
  const mean = total / Math.max(1, onset.length);
  let best = {offsetFrames: 0, score: -Infinity, confidence: null};
  const steps = Math.max(1, Math.round(periodFrames));
  for (let offset = 0; offset < steps; offset += 1) {
    let sum = 0;
    let beats = 0;
    for (let position = offset; position < onset.length; position += periodFrames) {
      // El golpe rara vez cae exactamente en el frame de la rejilla, y su ataque
      // puede repartirse entre dos ventanas. Se acumula el ataque de +-2 frames
      // (+-16 ms) en vez de tomar el maximo: con el maximo, un golpe partido entre
      // dos ventanas puntua menos que el mismo golpe alineado, y eso basta para que
      // el tempo correcto pierda contra su mitad.
      const center = Math.round(position);
      let attack = 0;
      for (let window = -2; window <= 2; window += 1) {
        const index = center + window;
        if (index < 0 || index >= onset.length) continue;
        attack += onset[index];
      }
      sum += attack;
      beats += 1;
    }
    const score = beats ? sum / beats : 0;
    if (score > best.score) {
      best = {offsetFrames: offset, score, confidence: mean > 0 ? score / mean : null};
    }
  }
  return best;
}

/** Beat mas cercano a un instante, para resolver `atBeat` negativo o fuera de rango. */
export function beatAt(beatSeconds, index) {
  if (!beatSeconds?.length) return null;
  const position = index < 0 ? beatSeconds.length + index : index;
  return beatSeconds[position] ?? null;
}
