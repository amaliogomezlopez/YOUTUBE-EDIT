import fs from 'node:fs/promises';import path from 'node:path';
import {readJson,writeJson,run} from '../../lib/utils.js';
import {projectDir,mediaDir,staticPath} from './constants.js';import {buildCameraProject} from './camera-render.js';
import {hashMedia} from '../video-studio/folder-sounds.js';import {ffprobe} from '../../lib/ffmpeg.js';
export async function adoptCameraProject(sourceProject,slug){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))throw Error('Slug invalido');
 const old=await buildCameraProject(sourceProject),project=projectDir(slug),media=mediaDir(slug);
 await fs.mkdir(project,{recursive:false});await fs.mkdir(media,{recursive:true});
 const file=path.join(media,'camera-source.mp4');
 await run('ffmpeg',['-n','-v','error','-i',old.manifest.source,'-map','0:v:0','-map','0:a:0','-c:v','libx264','-crf','17','-preset','veryfast','-c:a','aac','-movflags','+faststart',file],{timeoutMs:600000});
 const sourceHash=await hashMedia(file),probe=await ffprobe(file),regions={...old.regions,sourceHash};
 await writeJson(path.join(project,'transcript.json'),{words:old.transcript.flatMap(s=>s.words??[])});
 await writeJson(path.join(project,'manifest.json'),{clips:[{id:'camera',file:staticPath(slug,'camera-source.mp4'),width:probe.width,height:probe.height,durationSeconds:probe.duration,sourceHash,transcript:'transcript.json',webcamBox:regions.webcam.box}],assets:[]});
 const palette={camera:[...new Set(old.compiled.soundCues.map(c=>c.file))]};
 const metadata=Object.fromEntries(old.compiled.soundCues.map(c=>[c.file,{durationSeconds:c.durationSeconds}]));
 await writeJson(path.join(project,'short-plan.json'),{format:{width:1080,height:1920,fps:60},captions:{mode:'karaoke',maxWords:3},captionStyle:{renderer:'styled',font:'Schibsted Grotesk',mode:'karaoke',uppercase:true,baseFontSize:68,primary:'#FFFFFF',accent:'#43F56C',activeColor:'#43F56C',emphasis:'color'},sound:{enabled:old.plan.sound!==false,mix:1,clipVolume:1,...(palette.camera.length?{palette,metadata}:{})},scenes:[{id:'camera-1',clipId:'camera',layout:'pip',camera:'static',transitionIn:'cut',captions:old.plan.captions!==false,screenCamera:{plan:old.plan,regions}}]});
 return {project,slug};
}
