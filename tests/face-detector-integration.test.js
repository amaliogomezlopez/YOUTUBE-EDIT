import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import test from 'node:test';
import {ffprobe} from '../src/lib/ffmpeg.js';
import {detectWebcamBox} from '../src/lib/webcam.js';

const fixture = 'samples/input/GLM52.mp4';

test('YuNet detects a stable webcam in the local real-video fixture', {skip: !existsSync(fixture), timeout: 60_000}, async () => {
  const media = await ffprobe(fixture);
  const box = await detectWebcamBox(fixture, media, {sampleCount: 5});
  assert.equal(box?.method, 'yunet-face-tracking');
  assert.ok(box.confidence >= 0.6);
  assert.ok(box.w > 0 && box.h > 0);
  assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.w <= media.width && box.y + box.h <= media.height);
});
