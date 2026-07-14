import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeYuNetOutputs, selectTrackedFace} from '../src/lib/face-detector.js';

test('YuNet decoder converts grid outputs into source coordinates', () => {
  const cls = new Float32Array(400);
  const obj = new Float32Array(400);
  const bbox = new Float32Array(400 * 4);
  const index = 21;
  cls[index] = 0.9;
  obj[index] = 0.9;
  bbox[index * 4] = 0.5;
  bbox[index * 4 + 1] = 0.5;
  bbox[index * 4 + 2] = Math.log(2);
  bbox[index * 4 + 3] = Math.log(2);
  const faces = decodeYuNetOutputs({cls_32: {data: cls}, obj_32: {data: obj}, bbox_32: {data: bbox}}, {scale: 1, padX: 0, padY: 0});
  assert.equal(faces.length, 1);
  assert.ok(Math.abs(faces[0].x - 16) < 0.01);
  assert.ok(Math.abs(faces[0].y - 16) < 0.01);
  assert.ok(Math.abs(faces[0].w - 64) < 0.01);
  assert.equal(Number(faces[0].score.toFixed(2)), 0.9);
});

test('face tracking requires a stable cluster across sampled frames', () => {
  const frames = [
    [{x: 100, y: 50, w: 50, h: 50, score: 0.9}, {x: 400, y: 200, w: 60, h: 60, score: 0.99}],
    [{x: 104, y: 51, w: 51, h: 50, score: 0.88}],
    [{x: 98, y: 53, w: 49, h: 52, score: 0.91}],
    [],
    [{x: 102, y: 49, w: 50, h: 50, score: 0.9}]
  ];
  const tracked = selectTrackedFace(frames, {minimumFrames: 3});
  assert.ok(tracked);
  assert.equal(tracked.x, 102);
  assert.equal(tracked.confidence, 0.8);
  assert.equal(selectTrackedFace([[{x: 1, y: 1, w: 10, h: 10, score: 1}], [], []], {minimumFrames: 2}), null);
});
