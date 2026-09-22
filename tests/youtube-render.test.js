import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {fromCapcut,fromSnapshot} from '../src/modules/youtube-studio/render-plan.js';
import {sampleCurve} from '../src/modules/video-studio/timeline-curves.js';
import {packageRender,verifyRenderPackage,resolveInside} from '../src/modules/youtube-studio/render-package.js';
const reference=()=>({kind:'capcut-editorial-reference',timeUnit:'microseconds',sourceSha256:'hash',timelines:[{id:'t',duration:5000000,tracks:[{type:'video',segments:[{native:{id:'s',material_id:'v',speed:1,target_timerange:{start:1000000,duration:3000000},source_timerange:{start:2000000,duration:3000000},uniform_scale:{on:true},common_keyframes:[{property_type:'KFTypeScaleX',keyframe_list:[{curveType:'Line',time_offset:2000000,values:[1]},{curveType:'Line',time_offset:4000000,values:[1.5]}]}]}}]}],materials:{videos:[{native:{id:'v',path:'v.mp4',width:1920,height:1080,type:'video'}}]}}]});
test('CapCut selection rebases source keys and trims without resetting zoom; adjacent endpoint quantization',()=>{
 const plan=fromCapcut(reference(),{timelineId:'t',from:2,to:3,keyframeClock:'source'}),l=plan.layers[0];
 assert.equal(l.sourceIn,3);assert.equal(l.from,0);assert.equal(l.duration,30);
 assert.equal(sampleCurve(l.curves.scaleX,0,1),1.25);assert.equal(sampleCurve(l.curves.scaleY,1,1),1.5);
 assert.throws(()=>fromCapcut(reference(),{timelineId:'t',from:0,to:3}),/keyframeClock/);
 const r=reference();r.timelines[0].tracks[0].segments[0].native.common_keyframes[0].keyframe_list[0].curveType='Bezier';
 assert.throws(()=>fromCapcut(r,{timelineId:'t',from:0,to:3,keyframeClock:'source'}),/Curva/);
});
test('unsupported layers are explicitly reported, never presented as complete',()=>{
 const r=reference();r.timelines[0].tracks.push({type:'sticker',segments:[{native:{id:'sticker',material_id:'missing',target_timerange:{start:0,duration:5000000}}}]});
 const p=fromCapcut(r,{timelineId:'t',from:0,to:3,keyframeClock:'source'});
 assert.equal(p.warnings.length,1);assert.equal(p.warnings[0].segmentId,'sticker');
 assert.throws(()=>fromSnapshot({id:'wrong',payload:{kind:'youtube-edit-example'}}),/Snapshot/);
});
test('packages verify hashes, forbid replacement and reject public path traversal',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'youtube-render-'));
 try {
  const root=path.join(dir,'public');await mkdir(root);await writeFile(path.join(root,'v.mp4'),'synthetic media for copy/hash only');
  const plan=fromCapcut(reference(),{timelineId:'t',from:1,to:2,keyframeClock:'source'});
  const pkg=await packageRender(plan,{publicRoot:root,packageName:'test'});
  assert.equal((await verifyRenderPackage(pkg,root)).layers.length,1);
  await assert.rejects(packageRender(plan,{publicRoot:root,packageName:'test'}),/EEXIST/);
  await writeFile(path.join(dir,'outside.mp4'),'outside');await assert.rejects(resolveInside(root,'../outside.mp4'),/fuera/);
  await writeFile(path.join(root,pkg.payload.assets[0].file),'tamper');
  await assert.rejects(verifyRenderPackage(pkg,root),/modificada/);
  pkg.payload.props.durationInFrames=99;await assert.rejects(verifyRenderPackage(pkg,root),/Paquete modificado/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
import {audioFilter} from '../src/modules/video-studio/timeline-audio.js';
import {recordFeedback} from '../src/modules/youtube-studio/feedback.js';
import {fingerprint} from '../src/modules/youtube-studio/memory.js';
test('Bezier interpolates time and value control points, not a linear guess',()=>{
 const keys=[{time:0,value:1,easing:'bezier',outControl:{time:.2,value:0}},{time:1,value:2,easing:'bezier',inControl:{time:-.2,value:0}}];
 assert.ok(Math.abs(sampleCurve(keys,.5,0)-1.5)<1e-8);
 assert.ok(sampleCurve(keys,.1,0)<1.1);assert.equal(sampleCurve(keys,2,0),2);
});
test('audio uses absolute sample delays and disables automatic normalization',()=>{
 const filter=audioFilter([{type:'video',sourceIn:2,duration:30,from:15,volume:1},{type:'audio',sourceIn:0,duration:45,from:0,volume:.1}],{fps:30,durationInFrames:45,soundMix:.5});
 assert.match(filter,/adelay=24000S/);assert.match(filter,/volume=0.05/);assert.match(filter,/normalize=0/);assert.match(filter,/atrim=duration=1.5/);
});
test('feedback binds actual quote and frame to version without approving a global rule',()=>{
 const payload={kind:'youtube-render-package',props:{durationInFrames:90,format:{fps:30},layers:[{id:'s',type:'video',from:0,duration:90,sourceIn:5}]},provenance:{snapshotId:'example'}};
 const pkg={id:fingerprint(payload),payload};const note=recordFeedback(pkg,{frame:30,category:'camera',quote:'Less zoom in this example'});
 assert.equal(note.payload.activeLayers[0].sourceSeconds,6);assert.equal(note.payload.approval,'pending');assert.equal(note.payload.scope,'this-example');
 assert.throws(()=>recordFeedback(pkg,{frame:90,category:'camera',quote:'x'}),/Frame/);
});
test('CapCut track order controls overlaps even when segment render indexes differ',()=>{
 const r=reference();r.timelines[0].tracks[0].segments[0].native.track_render_index=1;r.timelines[0].tracks[0].segments[0].native.render_index=99;
 const higher=structuredClone(r.timelines[0].tracks[0]);higher.segments[0].native.id='higher';higher.segments[0].native.track_render_index=2;higher.segments[0].native.render_index=1;r.timelines[0].tracks.push(higher);
 assert.deepEqual(fromCapcut(r,{timelineId:'t',from:1,to:2,keyframeClock:'source'}).layers.map(l=>l.id),['s','higher']);
});
test('word-anchored snapshots reuse the shared camera track and verify source identity',()=>{
 const track={keys:[{time:0,zoom:1,x:.5,y:.5},{time:1,zoom:1.2,x:.7,y:.5}],events:[{sound:null}]};
 const payload={kind:'youtube-edit-example',clips:[{id:'v',file:'projects/youtube/clip.mp4',sourceHash:'hash',width:1920,height:1080}],build:{surface:'youtube',format:{width:1920,height:1080,fps:30},durationInFrames:60,scenes:[{id:'s',clipId:'v',sourceHash:'hash',sourceIn:3,fromFrame:0,durationInFrames:60,track}]}};
 const result=fromSnapshot({id:fingerprint(payload),payload});assert.deepEqual(result.layers[0].camera,track);assert.equal(result.layers[0].sourceIn,3);
 payload.build.scenes[0].track.events=[{sound:{family:'tick'}}];assert.throws(()=>fromSnapshot({id:fingerprint(payload),payload}),/Resolver sonido/);
});import {CAPCUT_STICKER_BASE} from '../src/modules/youtube-studio/render-plan.js';
import {resolveCapcutStickers} from '../src/modules/editorial-memory/capcut.js';
test('CapCut GIF stickers become gif layers with the calibrated base scale',async()=>{
 const r=reference();r.timelines[0].materials.stickers=[{native:{id:'st',type:'sticker',path:'C:/cache/st'}}];
 r.timelines[0].tracks.push({type:'sticker',segments:[{native:{id:'sub',material_id:'st',speed:1,target_timerange:{start:0,duration:5000000},clip:{scale:{x:.5,y:.5},transform:{x:.8,y:-.8}}}}]});
 const files={'C:/cache/st/config.json':JSON.stringify({effect:{Link:[{type:'InfoSticker',format:'gif',path:'final.gif'}]}})};
 const stickers=await resolveCapcutStickers(r,'t',{readFile:async f=>{if(!(f in files))throw Error('ENOENT');return files[f];},probe:async()=>({width:280,height:280})});
 assert.deepEqual(stickers,{st:{file:'C:/cache/st/final.gif',width:280,height:280}});
 const layer=fromCapcut(r,{timelineId:'t',from:0,to:3,keyframeClock:'source',stickers}).layers.find(l=>l.id==='sub');
 assert.equal(layer.type,'gif');assert.equal(layer.width,280);assert.equal(layer.transform.scaleX,.5*CAPCUT_STICKER_BASE);
});
test('missing media fails even for calibration unless a substitution is declared',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'youtube-missing-'));
 try {
  const root=path.join(dir,'public');await mkdir(root);await writeFile(path.join(root,'v.mp4'),'video');
  const r=reference();r.timelines[0].materials.images=[{native:{id:'img',type:'photo',path:path.join(dir,'gone.png'),width:10,height:10}}];
  r.timelines[0].tracks.push({type:'video',segments:[{native:{id:'cap',material_id:'img',speed:1,target_timerange:{start:1000000,duration:1000000}}}]});
  const plan=fromCapcut(r,{timelineId:'t',from:1,to:2,keyframeClock:'source'});
  await assert.rejects(packageRender(plan,{publicRoot:root,packageName:'a',allowIncomplete:true}),/Recurso ausente/);
  const replacement=path.join(dir,'recovered.png');await writeFile(replacement,'png');
  const fixed=fromCapcut(r,{timelineId:'t',from:1,to:2,keyframeClock:'source',substitutions:{[path.join(dir,'gone.png')]:replacement}});
  assert.deepEqual(fixed.provenance.substitutions,[{layerId:'cap',from:path.join(dir,'gone.png'),to:replacement}]);
  assert.equal((await packageRender(fixed,{publicRoot:root,packageName:'b'})).payload.props.layers.length,2);
 } finally {await rm(dir,{recursive:true,force:true});}
});
