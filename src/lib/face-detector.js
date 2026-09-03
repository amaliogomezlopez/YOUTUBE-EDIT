import path from 'node:path';
import {existsSync} from 'node:fs';
import {ROOT} from './utils.js';

const INPUT_SIZE = 640;
const STRIDES = [8, 16, 32];
let sessionPromise = null;

function modelPath(options = {}) {
  return options.modelPath || process.env.FACE_DETECTION_MODEL || path.join(ROOT, 'assets', 'models', 'yunet', 'face_detection_yunet_2023mar.onnx');
}

async function getSession(options = {}) {
  const file = modelPath(options);
  if (!existsSync(file)) throw new Error('YuNet face model is not installed.');
  if (!sessionPromise) {
    sessionPromise = import('onnxruntime-node').then(({InferenceSession}) => InferenceSession.create(file, {executionProviders: ['cpu']}));
  }
  return sessionPromise;
}

function frameTensor(frame, Tensor) {
  const scale = Math.min(INPUT_SIZE / frame.width, INPUT_SIZE / frame.height);
  const scaledWidth = Math.max(1, Math.round(frame.width * scale));
  const scaledHeight = Math.max(1, Math.round(frame.height * scale));
  const padX = Math.floor((INPUT_SIZE - scaledWidth) / 2);
  const padY = Math.floor((INPUT_SIZE - scaledHeight) / 2);
  const plane = INPUT_SIZE * INPUT_SIZE;
  const values = new Float32Array(plane * 3);
  for (let y = 0; y < scaledHeight; y += 1) {
    const sourceY = Math.min(frame.height - 1, Math.floor(y / scale));
    for (let x = 0; x < scaledWidth; x += 1) {
      const sourceX = Math.min(frame.width - 1, Math.floor(x / scale));
      const source = (sourceY * frame.width + sourceX) * 3;
      const target = (y + padY) * INPUT_SIZE + x + padX;
      values[target] = frame.data[source + 2];
      values[plane + target] = frame.data[source + 1];
      values[plane * 2 + target] = frame.data[source];
    }
  }
  return {tensor: new Tensor('float32', values, [1, 3, INPUT_SIZE, INPUT_SIZE]), transform: {scale, padX, padY}};
}

function iou(a, b) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  return intersection / Math.max(1, a.w * a.h + b.w * b.h - intersection);
}

function nms(boxes, threshold = 0.3) {
  const selected = [];
  for (const candidate of boxes.slice().sort((a, b) => b.score - a.score)) {
    if (!selected.some((item) => iou(item, candidate) > threshold)) selected.push(candidate);
  }
  return selected;
}

export function decodeYuNetOutputs(outputs, transform, options = {}) {
  const threshold = Number(options.confidence ?? 0.72);
  const candidates = [];
  for (const stride of STRIDES) {
    const cls = outputs[`cls_${stride}`]?.data;
    const obj = outputs[`obj_${stride}`]?.data;
    const bbox = outputs[`bbox_${stride}`]?.data;
    if (!cls || !obj || !bbox) continue;
    const gridWidth = INPUT_SIZE / stride;
    for (let index = 0; index < cls.length; index += 1) {
      const score = Math.sqrt(Math.max(0, cls[index]) * Math.max(0, obj[index]));
      if (score < threshold) continue;
      const row = Math.floor(index / gridWidth);
      const column = index % gridWidth;
      const cx = (column + bbox[index * 4]) * stride;
      const cy = (row + bbox[index * 4 + 1]) * stride;
      const width = Math.exp(Math.min(8, bbox[index * 4 + 2])) * stride;
      const height = Math.exp(Math.min(8, bbox[index * 4 + 3])) * stride;
      const x = (cx - width / 2 - transform.padX) / transform.scale;
      const y = (cy - height / 2 - transform.padY) / transform.scale;
      candidates.push({x, y, w: width / transform.scale, h: height / transform.scale, score});
    }
  }
  return nms(candidates, Number(options.nmsThreshold ?? 0.3)).slice(0, Number(options.maxFaces ?? 20));
}

export async function detectFacesInFrame(frame, options = {}) {
  const [{Tensor}, session] = await Promise.all([import('onnxruntime-node'), getSession(options)]);
  const {tensor, transform} = frameTensor(frame, Tensor);
  const outputs = await session.run({input: tensor});
  return decodeYuNetOutputs(outputs, transform, options);
}

export function selectTrackedFace(frames, options = {}) {
  const minimumFrames = Math.max(2, Number(options.minimumFrames ?? Math.ceil(frames.length * 0.45)));
  const clusters = [];
  for (const detections of frames) {
    for (const face of detections) {
      const normalized = options.normalize ? options.normalize(face) : face;
      let cluster = clusters.find((item) => iou(item.anchor, normalized) >= Number(options.trackIou ?? 0.18));
      if (!cluster) {
        cluster = {anchor: normalized, faces: []};
        clusters.push(cluster);
      }
      if (!cluster.faces.some((item) => item.frame === detections)) cluster.faces.push({...normalized, frame: detections});
      cluster.anchor = normalized;
    }
  }
  const best = clusters.filter((cluster) => cluster.faces.length >= minimumFrames)
    .sort((a, b) => b.faces.length - a.faces.length || average(b.faces.map((face) => face.score)) - average(a.faces.map((face) => face.score)))[0];
  if (!best) return null;
  return {
    x: median(best.faces.map((face) => face.x)),
    y: median(best.faces.map((face) => face.y)),
    w: median(best.faces.map((face) => face.w)),
    h: median(best.faces.map((face) => face.h)),
    confidence: Number((best.faces.length / Math.max(1, frames.length)).toFixed(2)),
    detectionScore: Number(average(best.faces.map((face) => face.score)).toFixed(3)),
    // `withFaces` expone la membresia del cluster ganador: cada cara conserva en
    // `frame` la referencia al array de detecciones de su muestra, que es como
    // el caller la reconduce al indice temporal sin rehacer la agrupacion.
    ...(options.withFaces ? {faces: best.faces} : {})
  };
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}
