import fs from 'node:fs/promises';
import path from 'node:path';
import {run, ROOT, readJson, writeJson} from '../../lib/utils.js';
import {ffprobe} from '../../lib/ffmpeg.js';
import {cameraExpression} from '../video-studio/camera-track.js';
import {hashMedia} from '../video-studio/folder-sounds.js';
import {analyzeAudioChannels,voiceChannelFilter} from '../video-studio/audio-channels.js';
import {finalizeShortAudio,verifyShortMedia} from '../video-studio/render-quality.js';
import {resolveSoundCue} from '../video-studio/sound-families.js';
import {loadTalkingHeadSounds} from '../talking-head/sounds.js';
import {createRunDirectory,completeRun} from '../../../remotion-animations/scripts/lib/output-run.mjs';
import {compileScreenCamera,contentHash} from './camera-project.js';

export async function buildCameraProject(project){
 const manifest=await readJson(path.join(project,'manifest.json'));
 const plan=await readJson(path.join(project,'plan.json'));
 const transcript=await readJson(path.join(project,'transcript.json'));
 const regions=await readJson(path.join(project,'regions.json'));
 if(contentHash(transcript)!==manifest.transcriptHash)throw Error('La transcripcion cambio: preparar un proyecto nuevo para reanclar');
 if(await hashMedia(manifest.source)!==manifest.sourceHash)throw Error('El video fuente cambio: preparar un proyecto nuevo');
 const media=await ffprobe(manifest.source);
 validateCameraSource(manifest,media);
 const compiled=compileScreenCamera({manifest,plan,transcript,regions});
 const selection=compiled.soundEnabled?await loadTalkingHeadSounds():{status:'disabled'};
 const choices=selection.palette?.whoosh;
 const palette=choices?.length?{camera:choices}:undefined;
 let occurrence=0;
 compiled.soundCues=compiled.soundEnabled?compiled.track.events.filter(e=>e.sound).map(e=>resolveSoundCue('camera',e.time,e.sound.intensity,occurrence++,{palette,metadata:selection.metadata})):[];
 for(const cue of compiled.soundCues){cue.hash=await hashMedia(path.join(ROOT,'remotion-animations/public',cue.file));}
 compiled.soundStatus=selection.status;
 compiled.fingerprint=contentHash({camera:compiled.fingerprint,soundCues:compiled.soundCues});
 await writeJson(path.join(project,'compiled.json'),compiled);
 return {compiled,manifest,plan,regions,transcript};
}
const filterPath=p=>p.replaceAll('\\','/').replaceAll(':','\\:').replaceAll("'","\\'");
export async function renderCameraProject(project,{log=()=>{},resolved=null}={}){
 const {compiled:c,manifest,plan,regions,transcript}=resolved??await buildCameraProject(project);
 const runInfo=createRunDirectory({project:'shorts-camera',purpose:'render',outputRoot:path.join(ROOT,'data/output')});
 const dir=runInfo.directory,{screen:s,face:f}=c.layout;
 await writeJson(path.join(dir,'compiled.json'),c);
 await writeJson(path.join(dir,'manifest.json'),manifest);
 await writeJson(path.join(dir,'transcript.json'),transcript);
 await writeJson(path.join(dir,'plan.json'),plan);
 await writeJson(path.join(dir,'regions.json'),regions);
 const ass=path.join(dir,'captions.ass');if(c.captions)await fs.writeFile(ass,c.captions.ass);
 const z=cameraExpression(c.track,'zoom'),x=cameraExpression(c.track,'x'),y=cameraExpression(c.track,'y');
 const a=c.screen,b=c.webcam;
 const background=`color=c=0x0b1420:s=1080x1920:r=60:d=${c.duration},drawbox=x=${s.x-3}:y=${s.y-3}:w=${s.w+6}:h=${s.h+6}:color=0x344252:t=fill,drawbox=x=${f.x-3}:y=${f.y-3}:w=${f.w+6}:h=${f.h+6}:color=0x657583:t=fill[bg]`;
 const filters=[background,`[0:v]setpts=PTS-STARTPTS,fps=60,split=2[a][b]`,
 `[a]crop=${a.w}:${a.h}:${a.x}:${a.y}:exact=1,zoompan=z='${z}':x='max(0,min(iw-iw/zoom,iw*(${x})-iw/zoom/2))':y='max(0,min(ih-ih/zoom,ih*(${y})-ih/zoom/2))':d=1:s=${s.w}x${s.h}:fps=60[screen]`,
 `[b]crop=${b.w}:${b.h}:${b.x}:${b.y}:exact=1,scale=${f.w}:${f.h}:force_original_aspect_ratio=increase,crop=${f.w}:${f.h}[face]`,
 `[bg][screen]overlay=${s.x}:${s.y}:shortest=1[stage]`,
 `[stage][face]overlay=${f.x}:${f.y}:shortest=1${c.captions?`,ass=filename=captions.ass:fontsdir='${filterPath(resolved?.fontsDir??path.join(ROOT,'assets/fonts'))}'`:''},format=yuv420p[out]`];
 const audioChannels=await analyzeAudioChannels(manifest.source);
 const voice=voiceChannelFilter(audioChannels);
 filters.push(`[0:a]asetpts=PTS-STARTPTS${voice?','+voice:''},aformat=channel_layouts=stereo[voice]`);
 const inputs=[];
 for(const [i,cue] of c.soundCues.entries()){
  inputs.push('-i',path.join(ROOT,'remotion-animations/public',cue.file));
  filters.push(`[${i+1}:a]${cameraSoundFilter(cue)}[s${i}]`);
 }
 if(c.soundCues.length)filters.push(`[voice]${c.soundCues.map((_,i)=>`[s${i}]`).join('')}amix=inputs=${c.soundCues.length+1}:duration=first:normalize=0[audio]`);
 const filterFile=path.join(dir,'render.ffmpeg.txt');await fs.writeFile(filterFile,filters.join(';'));
 const draft=path.join(dir,'mixed.mp4'),output=path.join(dir,'short.mp4'),start=performance.now();
 log('Render FFmpeg: '+dir);
 await run('ffmpeg',['-n','-loglevel','error','-ss',String(c.sourceIn),'-t',String(c.duration),'-i',manifest.source,...inputs,'-filter_complex_script',filterFile,'-map','[out]','-map',c.soundCues.length?'[audio]':'[voice]','-t',String(c.duration),'-c:v','libx264','-preset','veryfast','-crf','17','-threads','4','-c:a','aac','-ar','48000','-ac','2','-movflags','+faststart',draft],{cwd:dir,timeoutMs:600000});
 await finalizeShortAudio(draft,output,{duration:c.duration,overwrite:false});
 const qa=await verifyShortMedia(output,{duration:c.duration});
 if(Math.abs((await ffprobe(output)).fps-60)>.01)qa.errors.push('FPS distintos de 60');qa.passed=!qa.errors.length;
 qa.renderSeconds=(performance.now()-start)/1000;qa.planFingerprint=c.fingerprint;
 const frames=[];
 for(const fraction of [0,.15,.45,.75,.95]){const frame=path.join(dir,'review-'+Math.round(fraction*100)+'.jpg');await run('ffmpeg',['-n','-loglevel','error','-ss',String(c.duration*fraction),'-i',output,'-frames:v','1',frame]);frames.push(frame);}
 await writeJson(path.join(dir,'qa.json'),qa);
 if(!qa.passed)throw Error('QA tecnico fallido: '+qa.errors.join('; ')+' — '+dir);
 completeRun(runInfo,{outputs:[output,...frames,ass].filter(p=>c.captions||p!==ass),metadata:{fingerprint:c.fingerprint,qa,editorialStatus:'in-review'}});
 return {output,qa,run:dir};
}

// Validate the actual media, not only editable manifest values.
export function validateCameraSource(manifest,media){
 if(!media.raw.streams.some(s=>s.codec_type==='audio'))throw Error('La toma requiere audio de voz');
 if(media.width!==manifest.width||media.height!==manifest.height||!Number.isFinite(manifest.duration)||Math.abs(media.duration-manifest.duration)>.03)throw Error('Manifest no coincide con la geometria/duracion del video; preparar de nuevo');
}
export function cameraSoundFilter(cue){
 const duration=cue.durationSeconds/cue.playbackRate;
 const release=Math.min(cue.releaseSeconds,duration*.25);
 return `aresample=48000,asetrate=48000*${cue.playbackRate},aresample=48000,atrim=duration=${duration},asetpts=PTS-STARTPTS,afade=t=in:d=${Math.min(cue.attackSeconds,duration*.1)},afade=t=out:st=${Math.max(0,duration-release)}:d=${release},volume=${cue.volume},adelay=${Math.round(cue.startSeconds*1000)}:all=1`;
}
