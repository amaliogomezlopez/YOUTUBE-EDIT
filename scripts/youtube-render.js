#!/usr/bin/env node
import path from 'node:path';
import {parseArgs} from 'node:util';
import {writeFile,mkdir,copyFile,cp} from 'node:fs/promises';
import {fromSnapshot,fromCapcut} from '../src/modules/youtube-studio/render-plan.js';
import {packageRender,verifyRenderPackage,loadPackage,savePackage} from '../src/modules/youtube-studio/render-package.js';
import {run} from '../src/lib/utils.js';
import {mixTimelineAudio} from '../src/modules/video-studio/timeline-audio.js';
import {createRunDirectory,completeRun} from '../remotion-animations/scripts/lib/output-run.mjs';
const root=path.resolve('remotion-animations'),publicRoot=path.join(root,'public');
try {
 const {values:v,positionals:p}=parseArgs({allowPositionals:true,options:{snapshot:{type:'string'},reference:{type:'string'},timeline:{type:'string'},from:{type:'string'},to:{type:'string'},package:{type:'string'},project:{type:'string'},'allow-incomplete':{type:'boolean'},'keyframe-clock':{type:'string'},frame:{type:'string'},'sound-disabled':{type:'boolean'}}});
 const command=p[0];
 if(!['prepare','render','still'].includes(command)||p.length!==1||!v.project)throw Error('Uso: youtube-render prepare --project SLUG (--snapshot JSON | --reference JSON --timeline ID --from S --to S --keyframe-clock source) [--allow-incomplete]; render|still --project SLUG --package JSON [--frame N] [--sound-disabled]');
 if(command==='prepare'){
   if(Boolean(v.snapshot)===Boolean(v.reference))throw Error('Seleccionar snapshot o referencia');
   const plan=v.snapshot?fromSnapshot(await loadPackage(v.snapshot)):fromCapcut(await loadPackage(v.reference),{timelineId:v.timeline,from:Number(v.from??0),to:Number(v.to),keyframeClock:v['keyframe-clock']});
   const job=createRunDirectory({project:v.project,purpose:'prepare',outputRoot:path.join(root,'out')});
   await writeFile(path.join(job.directory,'render-plan.json'),JSON.stringify(plan,null,2),{flag:'wx'});
   const pkg=await packageRender(plan,{publicRoot,packageName:'render-'+job.runId,allowIncomplete:v['allow-incomplete']});
   const file=path.join(job.directory,'render-package.json');await savePackage(file,pkg);
   completeRun(job,{outputs:[file],metadata:{id:pkg.id,incomplete:pkg.payload.incomplete}});
   console.log(JSON.stringify({package:file,id:pkg.id,warnings:pkg.payload.warnings},null,2));
 } else {
   if(!v.package)throw Error('--package requerido');
   const pkg=await loadPackage(v.package),props=structuredClone(await verifyRenderPackage(pkg,publicRoot));
   if(v['sound-disabled'])props.soundEnabled=false;
   const prepared=createRunDirectory({project:v.project,purpose:'verified-props',outputRoot:path.join(root,'out')});
   const isolatedPublic=path.join(prepared.directory,'public');
   await cp(path.join(publicRoot,'fonts'),path.join(isolatedPublic,'fonts'),{recursive:true,errorOnExist:true,force:false});
   for(const asset of pkg.payload.assets){const dest=path.join(isolatedPublic,asset.file);await mkdir(path.dirname(dest),{recursive:true});await copyFile(path.join(publicRoot,asset.file),dest);}
   await verifyRenderPackage(pkg,isolatedPublic);
   const propsFile=path.join(prepared.directory,'props.json');await writeFile(propsFile,JSON.stringify(props),{flag:'wx'});
   completeRun(prepared,{outputs:[propsFile],metadata:{packageId:pkg.id,packageFile:path.resolve(v.package)}});
   const args=['scripts/render-safe.mjs',command,v.project,'YouTube-Timeline',command==='still'?'preview.png':v['sound-disabled']?'pilot_voice.mp4':'pilot_audio.mp4','--props='+propsFile,'--concurrency=2','--public-dir='+isolatedPublic];
   if(command==='still'){const frame=Number(v.frame??0);if(!Number.isInteger(frame)||frame<0||frame>=props.durationInFrames)throw Error('Frame fuera de rango');args.push('--frame='+frame);}
   else args.push('--codec=h264','--crf=17','--pixel-format=yuv420p','--muted');
   const rendered=await run(process.execPath,args,{cwd:root,onStdout:t=>process.stdout.write(t),onStderr:t=>process.stderr.write(t)});
   if(command==='render'){
     const resultFile=rendered.stdout.match(/Manifest: ([^\r\n]+)/)?.[1];
     if(!resultFile)throw Error('Render sin manifest');
     const result=await loadPackage(resultFile),video=path.resolve(path.dirname(resultFile),result.outputs[0]);
     const mixRun=createRunDirectory({project:v.project,purpose:'mix',outputRoot:path.join(root,'out')});
     const audio=path.join(mixRun.directory,'mix.wav'),output=path.join(mixRun.directory,'pilot.mp4');
     await mixTimelineAudio(props,src=>path.join(isolatedPublic,src),audio);
     await run('ffmpeg',['-v','error','-n','-i',video,'-i',audio,'-map','0:v:0','-map','1:a:0','-c:v','copy','-c:a','aac','-b:a','320k','-ar','48000','-t',String(props.durationInFrames/props.format.fps),'-movflags','+faststart',output]);
     completeRun(mixRun,{outputs:[output,audio],metadata:{packageId:pkg.id,videoRun:resultFile,soundEnabled:props.soundEnabled}});
     console.log('Final MP4: '+output);
   }
 }
} catch(e){console.error(e.message);if(e.stderr)console.error(e.stderr);process.exitCode=1;}