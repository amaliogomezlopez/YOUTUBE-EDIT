import path from 'node:path';import sharp from 'sharp';import {run,writeJson} from '../../lib/utils.js';
import {cameraAt,cameraCrop} from './camera-track.js';
export function transitionSamples(build){
 const fps=build.format.fps,max=build.durationInFrames-1,frames=new Set([0,max]);
 for(const scene of build.scenes){if(scene.from>0)for(const f of [scene.from-1,scene.from,scene.from+1])frames.add(Math.max(0,Math.min(max,f)));
 for(const e of scene.screenCamera?.track.events??[])for(const t of [e.time-1/fps,e.time,(e.time+e.end)/2,e.end,e.end+1/fps])frames.add(Math.max(0,Math.min(max,scene.from+Math.round(t*fps))));}
 return [...frames].sort((a,b)=>a-b);
}
export async function reviewTransitions(video,build,dir){
 const samples=[];for(const frame of transitionSamples(build)){
  const scene=build.scenes.find(s=>frame>=s.from&&frame<s.from+s.durationInFrames),c=scene?.screenCamera;
  const crop=c?cameraCrop(c.screen,cameraAt(c.track,(frame-scene.from)/build.format.fps)):null;
  const file=path.join(dir,'transition-'+String(frame).padStart(6,'0')+'.jpg');
  await run('ffmpeg',['-n','-v','error','-ss',String(frame/build.format.fps),'-i',video,'-frames:v','1',file]);
  const stats=await sharp(file).stats(),metadata=await sharp(file).metadata();
  samples.push({frame,file,crop,frameSizePassed:metadata.width===build.format.width&&metadata.height===build.format.height,blankSuspected:stats.entropy<.1,geometryPassed:!crop||crop.x>=c.screen.x-.01&&crop.y>=c.screen.y-.01&&crop.x+crop.w<=c.screen.x+c.screen.w+.01&&crop.y+crop.h<=c.screen.y+c.screen.h+.01});
 }
 const tiles=await Promise.all(samples.map(s=>sharp(s.file).resize(216,384).jpeg().toBuffer()));
 const contactSheet=path.join(dir,'transition-contact-sheet.jpg');await sharp({create:{width:1080,height:384*Math.ceil(tiles.length/5),channels:3,background:'#111111'}}).composite(tiles.map((input,i)=>({input,left:(i%5)*216,top:Math.floor(i/5)*384}))).jpeg().toFile(contactSheet);
 const report={passed:samples.every(s=>s.geometryPassed&&s.frameSizePassed),contactSheet,warnings:samples.filter(s=>s.blankSuspected).map(s=>'Posible frame vacio: '+s.frame),semanticReview:'pending',samples};await writeJson(path.join(dir,'transition-review.json'),report);return report;
}
export function compareEditorialCandidates(candidates){
 if(candidates.length<2)throw Error('Se requieren al menos dos candidatos');
 const reference=candidates[0];
 for(const c of candidates)if(c.sourceHash!==reference.sourceHash||c.transcriptHash!==reference.transcriptHash||c.regionsHash!==reference.regionsHash)throw Error('Comparacion requiere la misma fuente, transcripcion y regiones');
 return {version:1,semanticWinner:null,note:'Metricas estructurales; no demuestran calidad editorial ni un ganador.',candidates:candidates.map(c=>({model:c.model,status:c.status??'unspecified',error:c.error??null,usage:c.usage??null,sourceHash:c.sourceHash,transcriptHash:c.transcriptHash,regionsHash:c.regionsHash,selection:c.plan.selection,profile:c.plan.profile,targets:c.plan.cues.map(e=>({atWord:e.atWord,targetId:e.targetId})),cueCount:c.plan.cues.length,elapsedMs:c.elapsedMs??null,cost:c.cost??null,validation:c.validation??'not-run'})),pairs:candidates.slice(1).map(c=>({a:reference.model,b:c.model,sameSelection:JSON.stringify(reference.plan.selection)===JSON.stringify(c.plan.selection),sameCues:JSON.stringify(reference.plan.cues)===JSON.stringify(c.plan.cues)}))};
}
