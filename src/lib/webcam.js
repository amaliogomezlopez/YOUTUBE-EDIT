import {mkdir, readFile, rm} from 'node:fs/promises';
import path from 'node:path';
import {clamp, run, TMP_DIR} from './utils.js';
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
  while (offset < buffer.length && /\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
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
        for (let x = Math.round(width * 0.3); x <= width - w; x += step) {
          const skin = rectSum(integral, width, x, y, w, h);
          const density = skin / (w * h);
          if (density < 0.035) continue;
          const rightPrior = x / width;
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

export function webcamBoxForTrackedFace(trackedFace, media) {
  const centerX = (trackedFace.x + trackedFace.w / 2) / media.width;
  const anchoredRight = centerX >= 0.72;
  const anchoredLeft = centerX <= 0.28;
  const padTop = trackedFace.h * 0.9;
  const padBottom = trackedFace.h * 0.65;
  let x;
  let w;
  if (anchoredRight) {
    x = clamp(trackedFace.x - trackedFace.w * 0.25, 0, media.width - 24);
    w = media.width - x;
  } else if (anchoredLeft) {
    x = 0;
    w = clamp(trackedFace.x + trackedFace.w * 1.25, 24, media.width);
  } else {
    const padX = trackedFace.w * 0.85;
    x = clamp(trackedFace.x - padX, 0, media.width - 24);
    w = clamp(trackedFace.w + padX * 2, 24, media.width - x);
  }
  const y = clamp(trackedFace.y - padTop, 0, media.height - 24);
  const h = clamp(trackedFace.h + padTop + padBottom, 24, media.height - y);
  return {
    x: Math.round(x),
    y: Math.round(y),
    w: Math.round(Math.min(w, media.width - x)),
    h: Math.round(Math.min(h, media.height - y)),
    confidence: trackedFace.confidence,
    detectionScore: trackedFace.detectionScore,
    method: 'yunet-face-tracking'
  };
}

export async function detectWebcamBox(videoFile, media, options = {}) {
  const samples = Number(options.samples ?? 7);
  const start = Math.max(8, media.duration * 0.08);
  const end = Math.max(start + 1, media.duration * 0.88);
  const sampleDir = path.join(TMP_DIR, 'webcam-detect', String(Date.now()));
  await mkdir(sampleDir, {recursive: true});
  const detections = [];
  const faceFrames = [];
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
        '-f', 'image2',
        frameFile
      ], {signal: options.signal, timeoutMs: Number(options.frameTimeoutMs ?? 30_000)});
      const frame = parsePpm(await readFile(frameFile));
      if (faceDetectorAvailable) {
        try {
          const sx = media.width / frame.width;
          const sy = media.height / frame.height;
          const faces = (await detectFacesInFrame(frame, options.faceDetectionOptions ?? {})).map((face) => ({
            x: face.x * sx, y: face.y * sy, w: face.w * sx, h: face.h * sy, score: face.score
          })).filter((face) => {
            const areaRatio = (face.w * face.h) / (media.width * media.height);
            const centerX = (face.x + face.w / 2) / media.width;
            const centerY = (face.y + face.h / 2) / media.height;
            const edgeDistance = Math.min(centerX, 1 - centerX, centerY, 1 - centerY);
            return areaRatio <= Number(options.maxFaceAreaRatio ?? 0.1) && edgeDistance <= Number(options.maxEdgeDistance ?? 0.34);
          });
          faceFrames.push(faces);
        } catch (error) {
          if (options.signal?.aborted) throw error;
          faceDetectorAvailable = false;
          faceFrames.length = 0;
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

  const trackedFace = faceDetectorAvailable ? selectTrackedFace(faceFrames, {minimumFrames: Math.ceil(samples * 0.45)}) : null;
  if (trackedFace) {
    return webcamBoxForTrackedFace(trackedFace, media);
  }
  if (detections.length < Math.ceil(samples * Number(options.minimumSkinCoverage ?? 0.6))) return null;
  const x = median(detections.map((item) => item.x));
  const y = median(detections.map((item) => item.y));
  const w = median(detections.map((item) => item.w));
  const h = median(detections.map((item) => item.h));
  // The detector often locks onto the face area. Recover the surrounding
  // webcam rectangle asymmetrically: streamers usually need more headroom than
  // chest room, and symmetric padding can still cut hair/forehead.
  const touchesTop = y < media.height * 0.08;
  const touchesRight = x + w > media.width * 0.78;
  const padX = w * (touchesRight ? 0.7 : 0.5);
  const padTop = h * (touchesTop ? 0.35 : 0.95);
  const padBottom = h * 0.95;
  const box = {
    x: Math.round(clamp(x - padX, 0, media.width - 8)),
    y: Math.round(clamp(y - padTop, 0, media.height - 8)),
    w: Math.round(clamp(w + padX * 2, 24, media.width)),
    h: Math.round(clamp(h + padTop + padBottom, 24, media.height)),
    confidence: Number(Math.min(0.75, detections.length / samples).toFixed(2)),
    method: 'skin-window-sampling'
  };
  box.w = Math.min(box.w, media.width - box.x - 2);
  box.h = Math.min(box.h, media.height - box.y - 2);
  return box;
}
