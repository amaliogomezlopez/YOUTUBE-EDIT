import test from 'node:test';import assert from 'node:assert/strict';
import {compileCameraTrack,cameraAt,cameraCrop,cameraExpression} from '../src/modules/video-studio/camera-track.js';
import {compileScreenCamera} from '../src/modules/shorts-studio/camera-project.js';
function fixture(){const transcript=[{start:0,end:8,text:'Uno dos tres cuatro cinco seis siete ocho',words:Array.from({length:8},(_,i)=>({id:'w'+i,text:['Uno','dos','tres','cuatro','cinco','seis','siete','ocho'][i],start:i,end:i+.8}))}];const entry=box=>({box,reviewed:true,evidence:'Regiones inspeccionadas en imagen fuente.'});return {transcript,manifest:{sourceHash:'abc',width:1920,height:1080,duration:8},regions:{sourceHash:'abc',screen:entry({x:0,y:80,w:1368,h:912}),webcam:entry({x:1374,y:0,w:546,h:532}),targets:[{id:'left',...entry({x:0,y:232,w:720,h:480})}]},plan:{version:1,profile:'screen-smooth',selection:{fromWord:0,toWord:7},cues:[{atWord:1,targetId:'left',sound:'camera'},{atWord:5,targetId:'context',sound:'none',soundNote:'Salida intencional sin efecto.'}]}};}

test('same semantic plan yields identical geometry, captions and fingerprint',()=>{const f=fixture(),a=compileScreenCamera(f),b=compileScreenCamera(structuredClone(f));assert.deepEqual(a,b);assert.equal(a.captions.plan.style.activeColor,'#43F56C');assert.equal(a.captions.plan.style.font,'Schibsted Grotesk');assert.equal(a.captions.plan.timing.source,'word');for(const p of a.captions.plan.pages){assert.ok(p.lines.flatMap(l=>l.words).length<=3);for(const l of p.lines){assert.ok(l.y>=a.layout.screen.y+a.layout.screen.h+12);assert.ok(l.y+l.fontSize*1.3<=1748);}}});
test('compiled crops stay within reviewed screen, seeking does not change them',()=>{const a=compileScreenCamera(fixture()),before=cameraAt(a.track,2.2);cameraAt(a.track,7);assert.deepEqual(cameraAt(a.track,2.2),before);for(let t=0;t<a.duration;t+=1/60){const r=cameraCrop(a.screen,cameraAt(a.track,t));assert.ok(r.x>=a.screen.x&&r.y>=a.screen.y&&r.x+r.w<=a.screen.x+a.screen.w+.001&&r.y+r.h<=a.screen.y+a.screen.h+.001);}});
test('FFmpeg and JS curves agree including clamps and reverse seek samples',()=>{const a=compileScreenCamera(fixture());for(const axis of ['x','y','zoom']){const exp=cameraExpression(a.track,axis).replaceAll('if(','choose(');const evaluate=new Function('on','choose','lt','max','min',`return ${exp}`);for(let i=467;i>=0;i--)assert.ok(Math.abs(evaluate(i,(a,b,c)=>a?b:c,(a,b)=>a<b,Math.max,Math.min)-cameraAt(a.track,i/60)[axis])<1e-6);}});
test('AI cannot inject coordinates, seconds, effects or unknown fields',()=>{for(const extra of [{atSeconds:1},{x:.3},{file:'effect.wav'}]){const f=fixture();Object.assign(f.plan.cues[0],extra);assert.throws(()=>compileScreenCamera(f),/plan.json/);}});
test('unreviewed, stale, duplicate, out of bounds and unknown targets fail',()=>{const mutations=[f=>f.regions.sourceHash='other',f=>f.regions.targets[0].reviewed=false,f=>f.regions.targets[0].box.x=1900,f=>f.regions.targets.push(f.regions.targets[0]),f=>f.plan.cues[0].targetId='invented',f=>f.regions.screen.box.w=1920];for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>compileScreenCamera(f));}});
test('word selection rebases caption and camera clocks together',()=>{const f=fixture();f.plan.selection.fromWord=1;const a=compileScreenCamera(f);assert.equal(a.sourceIn,1);assert.equal(a.track.events[0].time,0);assert.equal(a.captions.plan.pages[0].start,0);});
test('missing sound rationale, overlapping moves and invalid words are rejected',()=>{const mutations=[f=>delete f.plan.cues[1].soundNote,f=>f.plan.cues[1].atWord=2,f=>f.plan.selection.toWord=100,f=>f.plan.cues[0].atWord=99,f=>f.transcript[0].words[2].end=1];for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>compileScreenCamera(f));}});
test('camera-only and captions-only decisions retain explicit disabled states',()=>{const f=fixture();f.plan.sound=false;f.plan.captions=false;const c=compileScreenCamera(f);assert.equal(c.captions,null);assert.equal(c.soundEnabled,false);});

test('punctuated decimal stays whole and future green-preset words remain white',()=>{const f=fixture();f.transcript[0].words[2].text='4';f.transcript[0].words[3].text='.7,';const c=compileScreenCamera(f);const display=c.captions.plan.pages.flatMap(p=>p.lines.flatMap(l=>l.words));assert.ok(display.some(w=>w.text==='4.7,'));assert.ok(!display.some(w=>w.text==='.7,'));assert.ok(!c.captions.ass.includes('\\1a&H70&'));});


test('invalid source metadata, backwards word ends and whitespace rationale fail early',()=>{
 const mutations=[f=>f.manifest.duration=undefined,f=>f.manifest.width=Infinity,f=>f.transcript=null,f=>f.transcript[0].words[0].start=-1,f=>f.transcript[0].words[1].end=9,f=>f.transcript[0].words[0].end=2.5,f=>f.plan.cues[1].soundNote='         ',f=>f.regions.webcam.box.x=1374.5,f=>f.regions.webcam.box.w=547];
 for(const mutate of mutations){const f=fixture();mutate(f);assert.throws(()=>compileScreenCamera(f));}
});

import {validateCameraSource,cameraSoundFilter} from '../src/modules/shorts-studio/camera-render.js';
import {spawnSync} from 'node:child_process';
test('build verifies actual media geometry and requires an audio stream',()=>{
 const manifest=fixture().manifest,media={width:1920,height:1080,duration:8,raw:{streams:[{codec_type:'video'},{codec_type:'audio'}]}};
 assert.doesNotThrow(()=>validateCameraSource(manifest,media));
 assert.throws(()=>validateCameraSource({...manifest,width:2000},media),/Manifest/);
 assert.throws(()=>validateCameraSource({...manifest,duration:NaN},media),/Manifest/);
 assert.throws(()=>validateCameraSource(manifest,{...media,raw:{streams:[{codec_type:'video'}]}}),/audio/);
});
test('44.1 kHz and 48 kHz effects retain intended pitch and playback duration',()=>{
 for(const sampleRate of [44100,48000])for(const rate of [1,1.2]){
  const filter=cameraSoundFilter({playbackRate:rate,durationSeconds:1,attackSeconds:0,releaseSeconds:0,volume:1,startSeconds:0});
  const result=spawnSync('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:sample_rate='+sampleRate+':duration=1','-af',filter,'-f','f32le','-ac','1','pipe:1'],{maxBuffer:1000000});
  assert.equal(result.status,0,result.stderr?.toString());
  const samples=result.stdout.length/4;assert.ok(Math.abs(samples/48000-1/rate)<.002);
  let crossings=0;for(let i=1;i<samples;i++)if(result.stdout.readFloatLE((i-1)*4)<=0&&result.stdout.readFloatLE(i*4)>0)crossings++;
  assert.ok(Math.abs(crossings/(samples/48000)-440*rate)<3);
 }
});
