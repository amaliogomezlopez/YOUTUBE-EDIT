import path from 'node:path';
import {existsSync} from 'node:fs';
import {execFile} from 'node:child_process';
import {run} from '../../lib/utils.js';
import {ffprobe} from '../../lib/ffmpeg.js';
import {parseSilences} from './visual-analysis.js';

export function soundEdges(silences,duration) {
 const first=silences[0],last=silences.at(-1);
 const start=first?.start<=.001?Math.max(0,first.end):0;
 const end=last?.end>=duration-.01?Math.min(duration,last.start):duration;
 if(end<=start) throw new Error('El efecto no contiene sonido audible');
 return {start,end};
}
/** Remove only silent edges from playback copies; preserve interior pauses/reverb. */
export async function alignFolderSoundEdges(imported,publicRoot) {
 const entries=[];
 for(const e of imported.entries) {
  const source=path.join(publicRoot,e.file);
  const measured=await run('ffmpeg',['-hide_banner','-i',source,'-af','silencedetect=noise=-45dB:d=0.02','-f','null','-']);
  const edges=soundEdges(parseSilences(measured.stderr,e.durationSeconds),e.durationSeconds);
  const file=e.file.replace('.wav','-aligned-v2.wav'),target=path.join(publicRoot,file);
  if(!existsSync(target))await run('ffmpeg',['-n','-ss',String(edges.start),'-i',source,'-t',String(edges.end-edges.start),'-ar','48000','-ac','2','-c:a','pcm_s16le',target]);
  entries.push({...e,originalFile:e.file,file,durationSeconds:(await ffprobe(target)).duration,sourceDurationSeconds:e.durationSeconds,edgeTrim:edges});
 }
 return {...imported,entries,warnings:entries.filter(e=>e.durationSeconds>3).map(e=>e.sourceName+': cola audible superior a 3 s; revisar solapes.')};
}

/** Indice del bloque de mayor amplitud en PCM mono de 16 bits. */
export function peakIndex(pcm, blockSamples = 128) {
  const samples = Math.floor(pcm.length / 2);
  let best = 0, bestBlock = 0;
  for (let block = 0; block * blockSamples < samples; block++) {
    const end = Math.min(samples, (block + 1) * blockSamples);
    for (let i = block * blockSamples; i < end; i++) {
      const value = Math.abs(pcm.readInt16LE(i * 2));
      if (value > best) { best = value; bestBlock = block; }
    }
  }
  return bestBlock;
}

/**
 * Segundo en el que un efecto alcanza su pico. Un whoosh inverso crece hasta el
 * golpe: para que el golpe caiga en el corte hay que conocer ese instante, no el
 * final del fichero (que conserva la caida hasta -45 dB).
 */
export function measurePeakSeconds(file, {sampleRate = 44100, blockSamples = 128} = {}) {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sampleRate), '-f', 's16le', '-'],
      {encoding: 'buffer', maxBuffer: 1 << 28}, (error, stdout) => {
        if (error) return reject(error);
        resolve(Math.round(peakIndex(stdout, blockSamples) * blockSamples / sampleRate * 1000) / 1000);
      });
  });
}
