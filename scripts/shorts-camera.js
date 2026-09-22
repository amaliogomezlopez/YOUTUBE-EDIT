#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';
import {parseArgs} from 'node:util';
import {ffprobe,extractAudio} from '../src/lib/ffmpeg.js';
import {transcribeAudio} from '../src/lib/stt.js';
import {run,readJson,writeJson} from '../src/lib/utils.js';
import {hashMedia} from '../src/modules/video-studio/folder-sounds.js';
import {CAMERA_PLAN_SCHEMA,contentHash} from '../src/modules/shorts-studio/camera-project.js';
import {buildCameraProject,renderCameraProject} from '../src/modules/shorts-studio/camera-render.js';
const {values,args,positionals}=parseArgs({allowPositionals:true,options:{project:{type:'string'},video:{type:'string'},transcript:{type:'string'},regions:{type:'string'}}});
const command=positionals[0],project=values.project&&path.resolve(values.project);
if(!project||!['prepare','build','render'].includes(command))throw Error('Uso: node scripts/shorts-camera.js prepare|build|render --project <carpeta> [--video <archivo> --transcript <JSON> --regions <JSON>]');
if(command!=='prepare')throw Error('Este piloto se integra ahora en Shorts: npm run shorts:project -- adopt-camera --project '+project+' --slug <nombre>; despues shorts:build y shorts:render --slug <nombre> --engine ffmpeg|remotion');
if(command==='prepare'){
 if(!values.video)throw Error('Falta --video');
 const source=path.resolve(values.video),media=await ffprobe(source);
 // Exclusive directory: existing plans, anchors and source evidence are never replaced.
 await fs.mkdir(project,{recursive:false});
 let transcript;
 if(values.transcript)transcript=await readJson(path.resolve(values.transcript));
 else {const audio=path.join(project,'voice.wav');await extractAudio(source,audio);transcript=await transcribeAudio(audio,{provider:'faster-whisper',model:'small',language:'es',device:'cpu',computeType:'int8',outDir:project});}
 if(!Array.isArray(transcript)||!transcript.flatMap(s=>s.words??[]).length)throw Error('Se requiere JSON de segmentos con palabras');
 const words=transcript.flatMap(s=>s.words??[]),sourceHash=await hashMedia(source);
 await writeJson(path.join(project,'manifest.json'),{version:1,source,sourceHash,transcriptHash:contentHash(transcript),width:media.width,height:media.height,duration:media.duration});
 await writeJson(path.join(project,'transcript.json'),transcript);
 await fs.writeFile(path.join(project,'words.txt'),words.map((w,i)=>`${i}\t${w.start.toFixed(3)}\t${w.end.toFixed(3)}\t${w.text}`).join('\n'));
 await writeJson(path.join(project,'plan.schema.json'),CAMERA_PLAN_SCHEMA);
 await writeJson(path.join(project,'plan.json'),{version:1,profile:'screen-smooth',selection:{fromWord:0,toWord:words.length-1},captions:true,sound:true,cues:[]});
 const regions=values.regions?await readJson(path.resolve(values.regions)):{sourceHash,screen:{box:null,reviewed:false,evidence:''},webcam:{box:null,reviewed:false,evidence:''},targets:[]};
 if(regions.sourceHash!==sourceHash)throw Error('Regiones de otro video');
 await writeJson(path.join(project,'regions.json'),regions);
 for(const [i,fraction] of [0,.25,.5,.75,.95].entries())await run('ffmpeg',['-n','-loglevel','error','-ss',String(media.duration*fraction),'-i',source,'-frames:v','1','-vf','scale=960:-2',path.join(project,`source-${i}.jpg`)]);
 await fs.writeFile(path.join(project,'AGENT.md'),'Leer words.txt y revisar source-*.jpg. Completar regions.json solo tras inspeccion visual; reviewed no es una aprobacion del usuario. Editar plan.json segun plan.schema.json: elegir palabras y targetId, no segundos ni coordenadas. Para contenido que cambia, comprobar tambien los frames de cada foco. build rechaza zonas sin evidencia, cambios de fuente y tiempos invalidos. render produce MP4 y QA sin navegador. No aprobar automaticamente la semantica por pasar QA tecnico.');
 console.log(JSON.stringify({project,status:'needs-editorial-plan',words:words.length}));
}else if(command==='build'){const {compiled}=await buildCameraProject(project);console.log(JSON.stringify({project,fingerprint:compiled.fingerprint,duration:compiled.duration,status:'validated'}));}
else console.log(JSON.stringify(await renderCameraProject(project,{log:console.log})));
