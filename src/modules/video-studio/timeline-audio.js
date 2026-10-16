import {writeFile} from 'node:fs/promises';
import {ffprobe} from '../../lib/ffmpeg.js';
import {run} from '../../lib/utils.js';

/** Audio clock is sample based; avoid cumulative encoder padding between scenes. */
export function audioFilter(layers,{fps,durationInFrames,soundMix=1},inputOf=layers.map((_,i)=>i)) {
 const total=durationInFrames/fps,filters=[];
 // A file used by several layers is read once and split: hundreds of `-i` overflow the Windows command line.
 const uses=new Map();inputOf.forEach((k,i)=>uses.set(k,[...(uses.get(k)??[]),i]));
 const source=new Map();
 for(const [k,ids] of uses){if(ids.length===1)source.set(ids[0],`[${k}:a:0]`);else{filters.push(`[${k}:a:0]asplit=${ids.length}${ids.map(i=>`[u${i}]`).join('')}`);ids.forEach(i=>source.set(i,`[u${i}]`));}}
 layers.forEach((l,i)=>{
   for(const n of [l.sourceIn,l.duration,l.from,l.volume])if(!Number.isFinite(n)||n<0)throw Error('Audio timeline invalida');
   const volume=l.volume*(l.type==='audio'?soundMix:1);
   // Leading silence is real samples joined with concat: adelay shifts the timestamps of very short
   // pieces instead of padding them, and the final trim then never ends (runaway WAV).
   const delay=Math.round(l.from/fps*48000),body=`${source.get(i)}atrim=start=${l.sourceIn}:duration=${l.duration/fps},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${volume}`;
   filters.push(delay?`${body}[x${i}];anullsrc=r=48000:cl=stereo,atrim=end_sample=${delay},aformat=sample_fmts=fltp:channel_layouts=stereo[s${i}];[s${i}][x${i}]concat=n=2:v=0:a=1[a${i}]`:`${body}[a${i}]`);
 });
 filters.push(layers.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${layers.length}:normalize=0:dropout_transition=0,apad=whole_dur=${total},atrim=end=${total}[mixed]`);
 return filters.join(';');
}
export async function mixTimelineAudio(props,resolveMedia,output) {
 const layers=[];
 for(const l of props.layers){
  if(l.type==='image'||l.type==='gif'||l.type==='text'||(l.type==='audio'&&!props.soundEnabled)||l.volume===0)continue;
  const file=await resolveMedia(l.src),probe=await ffprobe(file);
  if(probe.raw.streams.some(s=>s.codec_type==='audio'))layers.push({...l,file});
 }
 const duration=props.durationInFrames/props.format.fps;
 if(!layers.length){await run('ffmpeg',['-v','error','-n','-f','lavfi','-i','anullsrc=r=48000:cl=stereo','-t',String(duration),'-c:a','pcm_s16le',output]);return;}
 const files=[...new Set(layers.map(l=>l.file))],script=`${output}.filter.txt`;
 await writeFile(script,audioFilter(layers,{...props.format,durationInFrames:props.durationInFrames,soundMix:props.soundMix},layers.map(l=>files.indexOf(l.file))));
 await run('ffmpeg',['-v','error','-n',...files.flatMap(f=>['-i',f]),'-filter_complex_script',script,'-map','[mixed]','-t',String(duration),'-c:a','pcm_s16le',output]);
}