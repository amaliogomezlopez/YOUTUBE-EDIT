import {ffprobe} from '../../lib/ffmpeg.js';
import {run} from '../../lib/utils.js';

/** Audio clock is sample based; avoid cumulative encoder padding between scenes. */
export function audioFilter(layers,{fps,durationInFrames,soundMix=1}) {
 const total=durationInFrames/fps,filters=[];
 layers.forEach((l,i)=>{
   for(const n of [l.sourceIn,l.duration,l.from,l.volume])if(!Number.isFinite(n)||n<0)throw Error('Audio timeline invalida');
   const volume=l.volume*(l.type==='audio'?soundMix:1);
   filters.push(`[${i}:a:0]atrim=start=${l.sourceIn}:duration=${l.duration/fps},asetpts=PTS-STARTPTS,aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=${volume},adelay=${Math.round(l.from/fps*48000)}S:all=1[a${i}]`);
 });
 filters.push(layers.map((_,i)=>`[a${i}]`).join('')+`amix=inputs=${layers.length}:normalize=0:dropout_transition=0,apad,atrim=duration=${total}[mixed]`);
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
 await run('ffmpeg',['-v','error','-n',...layers.flatMap(l=>['-i',l.file]),'-filter_complex',audioFilter(layers,{...props.format,durationInFrames:props.durationInFrames,soundMix:props.soundMix}),'-map','[mixed]','-c:a','pcm_s16le',output]);
}