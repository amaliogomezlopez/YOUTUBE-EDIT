import {existsSync} from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {processVideo} from '../src/lib/pipeline.js';
import {ensureDataDirs, ROOT, TMP_DIR, run} from '../src/lib/utils.js';

async function main() {
  await ensureDataDirs();
  const smokeDir = path.join(TMP_DIR, 'smoke');
  await mkdir(smokeDir, {recursive: true});
  const video = path.join(smokeDir, 'input.mp4');
  const transcript = path.join(smokeDir, 'input.srt');
  await run('ffmpeg', [
    '-y',
    '-f', 'lavfi',
    '-i', 'testsrc=size=1280x720:rate=30:duration=30',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:duration=30',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    video
  ], {cwd: ROOT});
  await writeFile(transcript, `1
00:00:00,000 --> 00:00:05,000
No sabes el error brutal que casi destruye este lanzamiento.

2
00:00:05,000 --> 00:00:10,000
La clave fue mirar los datos antes de tocar el producto.

3
00:00:10,000 --> 00:00:15,000
Por eso cambiamos el proceso y el resultado fue mucho mejor.

4
00:00:15,000 --> 00:00:20,000
Nadie habla de este riesgo cuando intenta crecer rapido.

5
00:00:20,000 --> 00:00:25,000
En resumen el sistema debe cortar ruido y mantener payoff.
`, 'utf8');

  const result = await processVideo({
    videoFile: video,
    transcriptFile: transcript,
    options: {
      topN: 2,
      minDuration: 6,
      maxDuration: 14,
      useLlm: false
    }
  });
  if (result.status !== 'done') throw new Error(`Expected done, got ${result.status}`);
  if (result.clips.length !== 2) throw new Error(`Expected 2 clips, got ${result.clips.length}`);
  for (const clip of result.clips) {
    if (!existsSync(clip.files.video)) {
      throw new Error(`Missing rendered clip: ${clip.files.video}`);
    }
  }
  console.log(`Smoke OK: ${result.outputDir}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
