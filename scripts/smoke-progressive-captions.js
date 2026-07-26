import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {TMP_DIR, FONTS_DIR, ensureDataDirs, run} from '../src/lib/utils.js';
import {renderVerticalClip} from '../src/lib/ffmpeg.js';
import {writeAssFile} from '../src/lib/subtitles.js';

await ensureDataDirs();
const workspace = await mkdtemp(path.join(TMP_DIR, 'caption-smoke-'));
const source = path.join(workspace, 'source.mp4');
const subtitles = path.join(workspace, 'captions.ass');
const output = path.join(workspace, 'progressive-caption-smoke.mp4');

await run('ffmpeg', [
  '-y', '-f', 'lavfi', '-i', 'color=c=0x1c2530:s=1080x1920:r=30:d=3',
  '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=3',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source
]);

const words = [
  ['donde', 0.18, 0.55], ['por', 0.55, 0.82], ['PRIMERA', 0.82, 1.35],
  ['VEZ', 1.35, 1.72], ['TODO', 1.72, 2.12], ['CAMBIA', 2.12, 2.65]
].map(([text, start, end], index) => ({id: `word-${index + 1}`, text, start, end, confidence: 1}));

const subtitleDocument = await writeAssFile(subtitles, [{id: 'seg-1', start: 0.18, end: 2.65, text: words.map((word) => word.text).join(' '), words}], {
  mode: 'progressive',
  preset: 'progressive-reference',
  font: 'Arial',
  position: 'lower-middle'
});
assert.equal(subtitleDocument.plan.style.outlineSize, 0);
assert.equal(subtitleDocument.plan.style.shadow, 0);
assert.deepEqual(subtitleDocument.plan.pages[0].lines.map((line) => line.role), ['lead', 'hero', 'tail']);
assert.equal(subtitleDocument.plan.pages[0].lines.find((line) => line.role === 'hero').words[0].text, 'PRIMERA');

await renderVerticalClip({
  videoFile: source,
  outputFile: output,
  start: 0,
  end: 3,
  subtitleFile: subtitles,
  fontDir: FONTS_DIR,
  cwd: workspace,
  mode: 'crop',
  quality: 'draft'
});

for (const [name, second] of [['early', 0.7], ['hero', 1.2], ['complete', 2.45]]) {
  await run('ffmpeg', ['-y', '-ss', String(second), '-i', output, '-frames:v', '1', path.join(workspace, `${name}.png`)]);
}

console.log(JSON.stringify({workspace, output, frames: ['early.png', 'hero.png', 'complete.png'].map((name) => path.join(workspace, name))}, null, 2));
