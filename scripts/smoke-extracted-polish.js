import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {FONTS_DIR, TMP_DIR, ensureDataDirs, run} from '../src/lib/utils.js';
import {renderVerticalClip, buildVerticalFilter} from '../src/lib/ffmpeg.js';
import {writeAssFile} from '../src/lib/subtitles.js';

await ensureDataDirs();
const workspace = await mkdtemp(path.join(TMP_DIR, 'extracted-polish-'));
const source = path.join(workspace, 'source.mp4');
const subtitles = path.join(workspace, 'captions.ass');
const karaokeOut = path.join(workspace, 'karaoke.mp4');
const pipOut = path.join(workspace, 'pip.mp4');

await run('ffmpeg', [
  '-y', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=1920x1080:rate=30',
  '-f', 'lavfi', '-i', 'sine=frequency=220:sample_rate=48000:duration=3',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', source
]);

const words = [
  ['donde', 0.18, 0.55], ['por', 0.55, 0.82], ['PRIMERA', 0.82, 1.35],
  ['VEZ', 1.35, 1.72], ['TODO', 1.72, 2.12], ['CAMBIA', 2.12, 2.65]
].map(([text, start, end], index) => ({id: `word-${index + 1}`, text, start, end, confidence: 1}));

const document = await writeAssFile(subtitles, [{
  id: 'seg-1', start: 0.18, end: 2.65,
  text: words.map((word) => word.text).join(' '),
  words
}], {mode: 'karaoke', preset: 'karaoke-highlight'});

assert.equal(document.plan.renderer, 'ass-karaoke');
assert.equal(document.plan.style.font, 'Schibsted Grotesk');
assert.match(document.ass, /\\1c&H6AFF7C&/);
assert.match(document.ass, /\\1a&H70&/);

await renderVerticalClip({
  videoFile: source,
  outputFile: karaokeOut,
  start: 0,
  end: 3,
  subtitleFile: subtitles,
  fontDir: FONTS_DIR,
  cwd: workspace,
  mode: 'crop',
  quality: 'draft',
  media: {width: 1920, height: 1080}
});

const filter = buildVerticalFilter({
  mode: 'pip',
  webcamBox: {x: 1400, y: 40, w: 400, h: 500},
  sourceWidth: 1920,
  sourceHeight: 1080
});
assert.equal(filter.includes('overlay=-130:'), false);
assert.match(filter, /pad=iw\+6:ih\+6:3:3:white/);

await renderVerticalClip({
  videoFile: source,
  outputFile: pipOut,
  start: 0,
  end: 2,
  mode: 'pip',
  webcamBox: {x: 1400, y: 40, w: 400, h: 500},
  quality: 'draft',
  media: {width: 1920, height: 1080}
});

for (const [name, file, second] of [
  ['karaoke', karaokeOut, 1.1],
  ['pip', pipOut, 0.8]
]) {
  await run('ffmpeg', ['-y', '-ss', String(second), '-i', file, '-frames:v', '1', path.join(workspace, `${name}.png`)]);
}

console.log(JSON.stringify({
  workspace,
  karaokeOut,
  pipOut,
  frames: ['karaoke.png', 'pip.png'].map((name) => path.join(workspace, name))
}, null, 2));
