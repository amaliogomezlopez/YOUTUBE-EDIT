import path from 'node:path';
import {existsSync} from 'node:fs';
import {run} from '../../lib/utils.js';
import {ffprobe} from '../../lib/ffmpeg.js';
import {parseSilences} from './visual-analysis.js';

export function soundEdges(silences,duration) {
 const first=silences[0],last=silences.at(-1);
 const start=first?.start<=.001?Math.max(0,first.end-.03):0;
 const end=last?.end>=duration-.01?Math.min(duration,last.start+.08):duration;
 return end>start?{start,end}:{start:0,end:duration};
}
/** Remove only silent edges from playback copies; preserve interior pauses/reverb. */
export async function alignFolderSoundEdges(imported,publicRoot) {
 const entries=[];
 for(const e of imported.entries) {
  const source=path.join(publicRoot,e.file);
  const measured=await run('ffmpeg',['-hide_banner','-i',source,'-af','silencedetect=noise=-45dB:d=0.04','-f','null','-']);
  const edges=soundEdges(parseSilences(measured.stderr,e.durationSeconds),e.durationSeconds);
  const file=e.file.replace('.wav','-aligned.wav'),target=path.join(publicRoot,file);
  if(!existsSync(target))await run('ffmpeg',['-n','-ss',String(edges.start),'-i',source,'-t',String(edges.end-edges.start),'-ar','48000','-ac','2','-c:a','pcm_s16le',target]);
  entries.push({...e,originalFile:e.file,file,durationSeconds:(await ffprobe(target)).duration,sourceDurationSeconds:e.durationSeconds,edgeTrim:edges});
 }
 return {...imported,entries,warnings:entries.filter(e=>e.durationSeconds>3).map(e=>e.sourceName+': cola audible superior a 3 s; revisar solapes.')};
}
