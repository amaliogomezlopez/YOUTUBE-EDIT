#!/usr/bin/env node
import fs from 'node:fs/promises';import path from 'node:path';import {parseArgs} from 'node:util';
import {run,readJson,writeJson} from '../src/lib/utils.js';
import {compileScreenCamera,CAMERA_PLAN_SCHEMA,contentHash} from '../src/modules/shorts-studio/camera-project.js';
import {compareEditorialCandidates} from '../src/modules/video-studio/camera-review.js';
const {values:v}=parseArgs({options:{project:{type:'string'},models:{type:'string'},output:{type:'string'}}});
if(!v.project||!v.models||!v.output)throw Error('Uso: --project <camera-project> --models id1,id2 --output <carpeta-nueva>');
const models=v.models.split(',');if(models.length<2||new Set(models).size!==models.length||models.some(m=>!/^[-a-z0-9]+$/.test(m)))throw Error('Se requieren modelos distintos');
const project=path.resolve(v.project),dir=path.resolve(v.output);await fs.mkdir(dir,{recursive:false});
const manifest=await readJson(path.join(project,'manifest.json')),transcript=await readJson(path.join(project,'transcript.json')),regions=await readJson(path.join(project,'regions.json'));
const words=transcript.flatMap(s=>s.words??[]),schema=path.join(dir,'schema.json');await writeJson(schema,CAMERA_PLAN_SCHEMA);
const prompt='No uses herramientas ni modifiques archivos. Devuelve solo el JSON del schema. Elige 20-30 segundos con sentido completo. screen-smooth, captions true, sound true. Cues separados al menos 1.15 segundos. atWord es indice global. context recupera la pantalla completa. Regiones ya revisadas; no se evalua vision. Evita focos sin cambio visible y palabras de baja confianza. Datos: '+JSON.stringify({words:words.map((w,index)=>({index,...w})),regions});await fs.writeFile(path.join(dir,'prompt.txt'),prompt);
const candidates=[];
for(const model of models){
 const started=performance.now();let response,transportError=null,raw='';
 try{const r=await run('agy',['--model',model,'--disable-slash-commands','--print-timeout','180s','--output-format','json','--json-schema',schema,'--print',prompt],{cwd:dir,timeoutMs:200000});raw=r.stdout;}catch(e){transportError=e.message;raw=e.stdout??'';}
 await fs.writeFile(path.join(dir,model+'.raw.txt'),raw);
 try{response=JSON.parse(raw.split(/\r?\n/).find(l=>l.trim().startsWith('{')));}catch{response={status:'ERROR',error:transportError??'Respuesta no JSON'};}
 const plan=response.structured_output;let validation={passed:false,error:'No hay plan'};
 if(plan)try{const c=compileScreenCamera({plan,manifest,transcript,regions});validation={passed:true,duration:c.duration,withinRequestedDuration:c.duration>=20&&c.duration<=30};}catch(e){validation={passed:false,error:e.message};}
 candidates.push({model,sourceHash:manifest.sourceHash,transcriptHash:contentHash(transcript),regionsHash:contentHash(regions),plan:plan??{selection:null,cues:[]},elapsedMs:response.duration_seconds?response.duration_seconds*1000:performance.now()-started,status:response.status,error:response.error??transportError,usage:response.usage??null,validation});
 await writeJson(path.join(dir,'candidates.json'),candidates);
}
const report=compareEditorialCandidates(candidates);await writeJson(path.join(dir,'comparison.json'),report);console.log(JSON.stringify({dir,report}));
