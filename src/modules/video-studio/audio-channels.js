import {run} from '../../lib/utils.js';
/** Measure actual signal per channel: a stereo header does not prove stereo sound. */
export async function analyzeAudioChannels(file,{signal}={}) {
 const result=await run('ffmpeg',['-hide_banner','-i',file,'-vn','-af','astats=metadata=0:reset=0','-f','null','-'],{signal});
 const levels=[];let channel=null;
 for(const line of result.stderr.split(/\r?\n/)) {
  const index=line.match(/Channel: (\d+)/);if(index){channel=Number(index[1])-1;continue;}
  if(line.includes('Overall'))channel=null;
  const rms=line.match(/RMS level dB: ([-\w.]+)/);
  if(rms && channel!==null)levels[channel]=rms[1]==='-inf'?-120:Number(rms[1]);
 }
 if(!levels.length || !levels.every(Number.isFinite))throw new Error('No se pudieron medir los canales de audio');
 return {rmsDb:levels,channels:levels.length,imbalanceDb:levels.length===2?Math.abs(levels[0]-levels[1]):0};
}
export function voiceChannelFilter({rmsDb}) {
 if(rmsDb.length===1)return 'pan=stereo|c0=c0|c1=c0';
 if(rmsDb.length===2 && Math.abs(rmsDb[0]-rmsDb[1])>=24 && Math.min(...rmsDb)<-60 && Math.max(...rmsDb)>-60) {
  const dominant=rmsDb[0]>rmsDb[1]?0:1;
  return 'pan=stereo|c0=c'+dominant+'|c1=c'+dominant;
 }
 return null;
}
