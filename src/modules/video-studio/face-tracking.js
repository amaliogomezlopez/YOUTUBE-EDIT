import path from 'node:path';
import {readFile, rm} from 'node:fs/promises';
import {detectFacesInFrame, selectTrackedFace} from '../../lib/face-detector.js';
import {parsePpm} from '../../lib/webcam.js';
import {clamp, ensureDir, round, run, TMP_DIR} from '../../lib/utils.js';

/**
 * Tracking de cara para clips de busto parlante a pantalla completa.
 *
 * Se diferencia de `src/lib/webcam.js` a proposito: alli la heuristica asume una
 * webcam pequena incrustada en una esquina de una grabacion de pantalla, con un
 * prior que descarta la mitad izquierda del frame. Aqui la cara es el sujeto y
 * puede estar en cualquier parte, asi que se usa YuNet sin priores de posicion y
 * se devuelve un punto focal normalizado, valido tanto para recortar a 9:16 como
 * para saber que zona del frame 16:9 no se puede tapar con un logo.
 */
export async function trackFace(videoFile, media, options = {}) {
  const samples = Number(options.samples ?? 9);
  const start = media.duration * 0.1;
  const end = Math.max(start + 0.2, media.duration * 0.9);
  const workspace = path.join(TMP_DIR, 'video-studio-face', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await ensureDir(workspace);
  const frames = [];
  try {
    for (let index = 0; index < samples; index += 1) {
      options.signal?.throwIfAborted();
      const at = samples === 1 ? start : start + ((end - start) * index) / (samples - 1);
      const frameFile = path.join(workspace, `frame-${index}.ppm`);
      await run('ffmpeg', [
        '-y',
        '-ss', String(round(at, 3)),
        '-i', videoFile,
        '-frames:v', '1',
        '-vf', 'scale=640:-1',
        '-f', 'image2',
        frameFile
      ], {signal: options.signal, timeoutMs: Number(options.frameTimeoutMs ?? 30_000)});
      const frame = parsePpm(await readFile(frameFile));
      const sx = media.width / frame.width;
      const sy = media.height / frame.height;
      const faces = (await detectFacesInFrame(frame, {confidence: Number(options.confidence ?? 0.6)}))
        .map((face) => ({x: face.x * sx, y: face.y * sy, w: face.w * sx, h: face.h * sy, score: face.score}))
        // Descarta detecciones minusculas (ruido de fondo, posters, reflejos).
        .filter((face) => (face.w * face.h) / (media.width * media.height) >= Number(options.minAreaRatio ?? 0.004));
      frames.push(faces);
    }
  } finally {
    await rm(workspace, {recursive: true, force: true});
  }

  const tracked = selectTrackedFace(frames, {trackIou: 0.15});
  if (!tracked) return null;
  return {
    box: {
      x: Math.round(tracked.x),
      y: Math.round(tracked.y),
      w: Math.round(tracked.w),
      h: Math.round(tracked.h)
    },
    focus: focusFromFace(tracked, media),
    confidence: tracked.confidence,
    detectionScore: tracked.detectionScore,
    method: 'yunet-fullframe'
  };
}

/**
 * Punto focal normalizado (0..1) del encuadre deseado.
 *
 * `y` no es el centro de la cara sino algo por debajo: en un recorte vertical
 * conviene dejar aire sobre la cabeza y encuadrar hasta el pecho, que es como se
 * lee un busto parlante en 9:16.
 */
export function focusFromFace(face, media) {
  const centerX = (face.x + face.w / 2) / media.width;
  const centerY = (face.y + face.h * 0.62) / media.height;
  return {
    x: round(clamp(centerX, 0.12, 0.88), 4),
    y: round(clamp(centerY, 0.12, 0.88), 4),
    faceHeightRatio: round(face.h / media.height, 4)
  };
}

/** Punto focal por defecto cuando no hay deteccion: centro, ligeramente alto. */
export const DEFAULT_FOCUS = {x: 0.5, y: 0.42, faceHeightRatio: 0.28};
