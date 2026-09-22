import test from 'node:test';
import assert from 'node:assert/strict';
import {compileYoutubePlan} from '../src/modules/youtube-studio/plan.js';
import {snapshot,compareEdits} from '../src/modules/youtube-studio/memory.js';
import {prepareYoutube,writeNew} from '../src/modules/youtube-studio/project.js';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {hashMedia} from '../src/modules/video-studio/folder-sounds.js';
const budget={maxZoom:4,transitionSeconds:.8,minHoldSeconds:3,maxCuesPerMinute:8,silencePaddingSeconds:.18};
function fixture() {
  const words=Array.from({length:40},(_,i)=>({text:'palabra'+i,start:i,end:i+.6}));
  const clips=[{id:'01',sourceHash:'a'.repeat(64),width:3840,height:2160,durationSeconds:40,words}];
  const plan={version:1,profile:'youtube-calm-v1',scenes:[{id:'intro',clipId:'01',selection:{fromWord:1,toWord:39},
    regions:{figure:{subject:'screen',reviewed:true,evidence:'Grafica completa revisada en la fuente',sourceHash:'a'.repeat(64),
      fromSeconds:0,toSeconds:40,box:{x:900,y:450,w:900,h:600}}},
    cues:[{atWord:5,subject:'screen',intent:'explanation',targetId:'figure',zoom:1.5,
      reason:'Explica la diferencia entre columnas',sound:false,soundNote:'Mantener continuidad de voz'},
      {atWord:15,subject:'context',intent:'context',reason:'Recuperar el contexto',sound:false,soundNote:'Retorno discreto'}]}]};
  return {plan,clips,budget};
}
test('horizontal multi-clip plan preserves source words, source trim and output clock',()=>{
  const x=fixture();x.plan.scenes.push({...structuredClone(x.plan.scenes[0]),id:'outro',selection:{fromWord:20,toWord:39},cues:[]});
  const b=compileYoutubePlan(x);
  assert.equal(b.format.width,1920);assert.ok(Math.abs(b.scenes[0].sourceIn-.82)<1e-9);
  assert.equal(b.scenes[0].track.events[0].time,5-.82);
  assert.equal(b.scenes[1].fromFrame,b.scenes[0].durationInFrames);
  assert.equal(b.capabilities.render,true);assert.equal(b.review.editorial,'pending');
});
test('camera rejects wrong source, partial temporal evidence, cut targets and overly dense motion',()=>{
  for(const mutate of [
    x=>x.plan.scenes[0].regions.figure.sourceHash='wrong',
    x=>x.plan.scenes[0].regions.figure.toSeconds=10,
    x=>x.plan.scenes[0].regions.figure.reviewed=false,
    x=>x.plan.scenes[0].cues[0].zoom=4,
    x=>x.plan.scenes[0].cues[1].atWord=6,
    x=>x.plan.scenes[0].cues[0].atWord=0,
    x=>x.plan.scenes[0].cues[0].soundNote='',
    x=>x.clips[0].width=1080,
    x=>x.plan.scenes[0].transition='fade',
    x=>x.plan.scenes[0].cues[0].atSeconds=5,
    x=>x.clips[0].words[4].start=-1,
    x=>x.plan.scenes.push(structuredClone(x.plan.scenes[0]))
  ]) {const x=fixture();mutate(x);assert.throws(()=>compileYoutubePlan(x));}
});
test('webcam opinion focus uses reviewed face and reports pixel enlargement',()=>{
  const x=fixture(),s=x.plan.scenes[0];s.regions.face={...s.regions.figure,subject:'webcam',box:{x:3000,y:1300,w:600,h:600}};
  Object.assign(s.cues[0],{subject:'webcam',intent:'opinion',targetId:'face',zoom:3});
  const b=compileYoutubePlan(x);assert.equal(b.scenes[0].track.events[0].target.zoom,3);assert.ok(b.warnings.length);
  s.cues[0].intent='explanation';assert.throws(()=>compileYoutubePlan(x),/Intencion/);
});
test('memory preserves originals, records style differences, rejects changed transcript or tampering',()=>{
  const x=fixture();const before=snapshot({...x,build:compileYoutubePlan(x)});
  const afterInput=structuredClone(x);afterInput.plan.scenes[0].cues[0].zoom=1.8;
  const after=snapshot({...afterInput,build:compileYoutubePlan(afterInput)});
  const report=compareEdits(before,after);assert.equal(report.changes.length,1);
  assert.equal(report.feedback.editorial,'pending');assert.equal(before.payload.plan.scenes[0].cues[0].zoom,1.5);
  const changed=structuredClone(afterInput);changed.clips[0].words[0].text='otra';
  assert.throws(()=>compareEdits(before,snapshot({...changed,build:compileYoutubePlan(changed)})),/transcripciones/);
  after.payload.plan.profile='tamper';assert.throws(()=>compareEdits(before,after),/Snapshot/);
});
test('disk preparation hashes real media and refuses path escape or evidence overwrite',async()=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'youtube-studio-'));
  const media=path.join(root,'media'),project=path.join(root,'project');
  await mkdir(media);await mkdir(project);
  const source=path.join(media,'clip.mp4');await writeFile(source,'synthetic hash fixture, not a render');
  const x=fixture();x.clips[0].sourceHash=await hashMedia(source);
  x.plan.scenes[0].regions.figure.sourceHash=x.clips[0].sourceHash;
  await writeFile(path.join(project,'words.json'),JSON.stringify({words:x.clips[0].words}));
  await writeFile(path.join(project,'youtube-plan.json'),JSON.stringify(x.plan));
  const manifest={surface:'youtube',clips:[{...x.clips[0],words:undefined,file:'clip.mp4',transcript:'words.json'}],assets:[]};
  await writeFile(path.join(project,'manifest.json'),JSON.stringify(manifest));
  const result=await prepareYoutube({project,mediaRoot:media});
  assert.equal(result.payload.clips[0].sourceHash,x.clips[0].sourceHash);
  const output=path.join(root,'snapshot.json');await writeNew(output,result);
  await assert.rejects(()=>writeNew(output,result),{code:'EEXIST'});
  manifest.clips[0].transcript='../media/clip.mp4';
  await writeFile(path.join(project,'manifest.json'),JSON.stringify(manifest));
  await assert.rejects(()=>prepareYoutube({project,mediaRoot:media}),/fuera/);
});
