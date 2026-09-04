import {mkdir, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {clamp, run, TMP_DIR} from './utils.js';
import {webcamPanel} from '../modules/video-studio/webcam-art.js';
import {detectFacesInFrame, selectTrackedFace} from './face-detector.js';

export function parsePpm(buffer) {
  let offset = 0;
  function token() {
    while (offset < buffer.length && /\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
    if (buffer[offset] === 35) {
      while (offset < buffer.length && buffer[offset] !== 10) offset += 1;
      return token();
    }
    const start = offset;
    while (offset < buffer.length && !/\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
    return buffer.subarray(start, offset).toString('ascii');
  }
  const magic = token();
  if (magic !== 'P6') throw new Error('Expected binary PPM frame.');
  const width = Number(token());
  const height = Number(token());
  const max = Number(token());
  if (max !== 255) throw new Error('Expected 8-bit PPM frame.');
  if (buffer[offset] === 13 && buffer[offset + 1] === 10) offset += 2;
  else offset += 1;
  return {width, height, data: buffer.subarray(offset)};
}

function isSkin(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return r > 75 && g > 38 && b > 20 && max - min > 15 && r > g * 1.05 && r > b * 1.18;
}

function buildIntegral(mask, width, height) {
  const integral = new Uint32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y += 1) {
    let row = 0;
    for (let x = 1; x <= width; x += 1) {
      row += mask[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + row;
    }
  }
  return integral;
}

function rectSum(integral, width, x, y, w, h) {
  const stride = width + 1;
  const x2 = x + w;
  const y2 = y + h;
  return integral[y2 * stride + x2] - integral[y * stride + x2] - integral[y2 * stride + x] + integral[y * stride + x];
}

function detectInFrame(frame) {
  const {width, height, data} = frame;
  const mask = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 3, p += 1) {
    mask[p] = isSkin(data[i], data[i + 1], data[i + 2]) ? 1 : 0;
  }
  const integral = buildIntegral(mask, width, height);
  let best = null;
  const minW = Math.round(width * 0.08);
  const maxW = Math.round(width * 0.28);
  const step = Math.max(6, Math.round(width / 80));
  const candidateWidths = [];
  for (let w = minW; w <= maxW; w += Math.round(width * 0.035)) candidateWidths.push(w);
  for (const w of candidateWidths) {
    for (const aspect of [4 / 3, 16 / 10, 1]) {
      const h = Math.round(w / aspect);
      if (h < height * 0.1 || h > height * 0.42) continue;
      for (let y = 0; y <= height - h; y += step) {
        for (let x = 0; x <= width - w; x += step) {
          const skin = rectSum(integral, width, x, y, w, h);
          const density = skin / (w * h);
          if (density < 0.035) continue;
          const rightPrior = Math.max(x / width, 1 - (x + w) / width);
          const topPrior = 1 - y / height;
          const cornerPrior = Math.max(topPrior, y / height);
          const sizePrior = 1 - Math.abs(w / width - 0.24);
          const score = density * 3.2 + rightPrior * 0.55 + cornerPrior * 0.3 + sizePrior * 0.12;
          if (!best || score > best.score) {
            best = {x, y, w, h, score, density};
          }
        }
      }
    }
  }
  return best;
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function isCornerWebcamFace(face, media, options = {}) {
  const areaRatio = (face.w * face.h) / (media.width * media.height);
  const centerX = (face.x + face.w / 2) / media.width;
  const centerY = (face.y + face.h / 2) / media.height;
  const sideLimit = Number(options.maxSideCenter ?? 0.32);
  const sideAnchored = centerX <= sideLimit || centerX >= 1 - sideLimit;
  const edgeLimit = Number(options.maxTopCenter ?? 0.42);
  const topAnchored = centerY <= edgeLimit || centerY >= 1 - edgeLimit;
  return areaRatio <= Number(options.maxFaceAreaRatio ?? 0.08) && sideAnchored && topAnchored;
}

export function webcamBoxForTrackedFace(trackedFace, media) {
  const headroom = trackedFace.h * 0.4;
  const below = trackedFace.h * 0.35;
  const height = Math.max(24, trackedFace.h + headroom + below);
  const width = height * 4 / 5;
  const centerX = trackedFace.x + trackedFace.w / 2;
  let x = centerX - width / 2;
  let y = trackedFace.y - headroom;
  x = clamp(x, 0, media.width - 24);
  y = clamp(y, 0, media.height - 24);
  const w = clamp(width, 24, media.width - x);
  const h = clamp(w * 5 / 4, 24, media.height - y);
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(w),
    h: Math.round(h),
    confidence: trackedFace.confidence,
    detectionScore: trackedFace.detectionScore,
    method: 'yunet-face-tracking'
  };
}

/**
 * Rango temporal de muestreo de la deteccion.
 *
 * Sin `window`, el historico: del 8% al 88% del video completo (los extremos
 * suelen ser intro/outro y confunden la mediana). Con `window` (un candidato del
 * scoring), el muestreo se hace dentro de la ventana con un inset del 5% en
 * cada extremo, porque el corte del short puede entrar a mitad de un plano.
 */
export function sampleRange(duration, window = null) {
  if (window && Number.isFinite(window.startSeconds) && Number.isFinite(window.endSeconds)) {
    const span = Math.max(0.2, window.endSeconds - window.startSeconds);
    const inset = span * 0.05;
    const start = clamp(window.startSeconds + inset, 0, duration);
    const end = clamp(window.endSeconds - inset, start + 0.2, duration);
    return {start, end};
  }
  const start = Math.max(8, duration * 0.08);
  const end = Math.max(start + 1, duration * 0.88);
  return {start, end};
}

export async function detectWebcamBox(videoFile, media, options = {}) {
  const samples = Number(options.samples ?? 7);
  const {start, end} = sampleRange(media.duration, options.window);
  const sampleDir = path.join(TMP_DIR, 'webcam-detect', String(Date.now()));
  await mkdir(sampleDir, {recursive: true});
  const detections = [];
  let representativeFrame = null;
  const cornerFaceFrames = [];
  const allFaceFrames = [];
  let faceDetectorAvailable = options.faceDetection !== false;
  try {
    for (let i = 0; i < samples; i += 1) {
      options.signal?.throwIfAborted();
      const t = start + ((end - start) * i) / Math.max(1, samples - 1);
      const frameFile = path.join(sampleDir, `frame-${i}.ppm`);
      await run('ffmpeg', [
        '-y',
        '-ss', String(t),
        '-i', videoFile,
        '-frames:v', '1',
        '-vf', 'scale=640:-1',
        '-pix_fmt', 'rgb24',
        '-f', 'image2',
        frameFile
      ], {signal: options.signal, timeoutMs: Number(options.frameTimeoutMs ?? 30_000)});
      const frame = parsePpm(await readFile(frameFile));
      if (i === Math.floor(samples/2)) representativeFrame = frame;
      if (faceDetectorAvailable) {
        try {
          const sx = media.width / frame.width;
          const sy = media.height / frame.height;
          const faces = (await detectFacesInFrame(frame, options.faceDetectionOptions ?? {})).map((face) => ({
            x: face.x * sx, y: face.y * sy, w: face.w * sx, h: face.h * sy, score: face.score
          })).filter((face) => {
            const areaRatio = (face.w * face.h) / (media.width * media.height);
            return areaRatio > 0.004 && areaRatio < 0.45;
          });
          allFaceFrames.push(faces);
          cornerFaceFrames.push(faces.filter((face) => isCornerWebcamFace(face, media, options)));
        } catch (error) {
          if (options.signal?.aborted) throw error;
          faceDetectorAvailable = false;
          cornerFaceFrames.length = 0;
          allFaceFrames.length = 0;
        }
      }
      const detection = detectInFrame(frame);
      if (detection) {
        const sx = media.width / frame.width;
        const sy = media.height / frame.height;
        detections.push({
          x: detection.x * sx,
          y: detection.y * sy,
          w: detection.w * sx,
          h: detection.h * sy,
          score: detection.score,
          density: detection.density
        });
      }
    }
  } finally {
    await rm(sampleDir, {recursive: true, force: true});
  }

  const trackedFace = faceDetectorAvailable
    ? selectTrackedFace(cornerFaceFrames, {minimumFrames: Math.ceil(samples * 0.45)})
    : null;
  if (trackedFace) {
    const box = webcamBoxForTrackedFace(trackedFace, media);
    if (representativeFrame) box.sourceBox = webcamPanel(representativeFrame, trackedFace, media) ?? undefined;
    return box;
  }
  const talkingFace = faceDetectorAvailable
    ? selectTrackedFace(allFaceFrames, {minimumFrames: Math.ceil(samples * 0.45)})
    : null;
  if (talkingFace) {
    return {
      method: 'talking-head-face',
      layout: 'crop',
      confidence: talkingFace.confidence,
      faceBox: {
        x: Math.round(talkingFace.x),
        y: Math.round(talkingFace.y),
        w: Math.round(talkingFace.w),
        h: Math.round(talkingFace.h)
      }
    };
  }
  if (detections.length < Math.ceil(samples * Number(options.minimumSkinCoverage ?? 0.6))) return null;
  const x = median(detections.map((item) => item.x));
  const y = median(detections.map((item) => item.y));
  const w = median(detections.map((item) => item.w));
  const h = median(detections.map((item) => item.h));
  // The detector often locks onto the face area. Recover the surrounding
  // webcam rectangle asymmetrically: streamers usually need more headroom than
  // chest room, and symmetric padding can still cut hair/forehead.
  const faceH = h;
  const headroom = faceH * 0.4;
  const height = faceH + headroom + faceH * 0.35;
  const width = height * 4 / 5;
  const centerX = x + w / 2;
  const box = {
    x: Math.round(clamp(centerX - width / 2, 0, media.width - 8)),
    y: Math.round(clamp(y - headroom, 0, media.height - 8)),
    w: Math.round(clamp(width, 24, media.width)),
    h: Math.round(clamp(height, 24, media.height)),
    confidence: Number(Math.min(0.75, detections.length / samples).toFixed(2)),
    method: 'skin-window-sampling'
  };
  box.w = Math.min(box.w, media.width - box.x - 2);
  box.h = Math.min(box.w * 5 / 4, media.height - box.y - 2);
  if (!isCornerWebcamFace(box, media, options)) return null;
  return box;
}
