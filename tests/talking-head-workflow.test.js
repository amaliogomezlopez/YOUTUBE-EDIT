import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,writeFile,rm,mkdir,copyFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {scheduleShots,scheduleSelections,scheduleFingerprint} from '../src/modules/talking-head/shot-schedule.js';
import {planTalkingHead,profiles} from '../src/modules/talking-head/planner.js';
import {importFolderSounds} from '../src/modules/video-studio/folder-sounds.js';
import {resolveSoundCue} from '../src/modules/video-studio/sound-families.js';
import {auditWords,reelPaths,validateResource} from '../src/modules/talking-head/workflow.js';
import {run} from '../src/lib/utils.js';
import approvedStyle from '../src/modules/shorts-studio/rules/checks/shorts-talking-head-approved-style.js';
const fixture=()=>({manifest:{clips:[{id:'01',durationSeconds:13}],assets:[]},transcripts:{'01':{words:Array.from({length:30},(_,i)=>({text:'palabra-'+i,start:.2+i*.4,end:.52+i*.4,timing:'word'}))}},selections:[{clipId:'01',fromWord:0,toWord:29,reason:'Toma completa'}],silences:{},budget:profiles.editorial});

test('schedule covers the full edited clock in 3-5s word-anchored windows',()=>{
 const c=fixture(),s=scheduleShots(c);
 assert.equal(s.shots[0].frame,0);assert.equal(s.shots.at(-1).endFrame,s.durationInFrames);
 for(const [i,shot] of s.shots.entries()) {assert.ok(shot.durationSeconds>=3 && shot.durationSeconds<=5);assert.ok(Number.isInteger(shot.atWord));if(i)assert.equal(s.shots[i-1].endFrame,shot.frame);}
 assert.deepEqual(s,scheduleShots(c));
});
test('short takes share visual windows across cuts without replaying the transition sound',()=>{
 const c=fixture();c.selections=[{clipId:'01',fromWord:0,toWord:3,reason:'Hook'},{clipId:'01',fromWord:4,toWord:29,reason:'Cuerpo'}];
 const s=scheduleShots(c),resources=Object.fromEntries(s.shots.map(shot=>[shot.id,{assetId:shot.id,reason:'Contexto'}]));
 c.manifest.assets=s.shots.map(shot=>({id:shot.id,provenance:{source:'https://example.org/source',license:'test'}}));
 const selections=scheduleSelections(c.selections,s,resources),p=planTalkingHead({...c,selections});
 assert.equal(selections[1].visuals[0].assetId,selections[0].visuals[0].assetId);
 assert.equal(selections[1].visuals[0].sound,false);
 assert.ok(selections[1].visuals[0].trimSeconds>1);
 assert.equal(p.scenes.reduce((n,scene)=>n+Math.round((scene.trim.end-scene.trim.start)*60),0),s.durationInFrames);
});
test('confirmed silence uses exactly the same ranges in scheduler and planner',()=>{
 const c=fixture();for (const w of c.transcripts['01'].words.slice(10)){w.start+=2;w.end+=2;}c.manifest.clips[0].durationSeconds+=2;c.silences={'01':[{start:4.2,end:6.1}]};
 const s=scheduleShots(c);assert.equal(s.ranges.length,2);
 const resources=Object.fromEntries(s.shots.map(shot=>[shot.id,{assetId:shot.id,reason:'Contexto'}]));c.manifest.assets=s.shots.map(shot=>({id:shot.id,provenance:{source:'https://example.org',license:'test'}}));
 const p=planTalkingHead({...c,selections:scheduleSelections(c.selections,s,resources)});
 assert.equal(p.scenes.reduce((n,scene)=>n+Math.round((scene.trim.end-scene.trim.start)*60),0),s.durationInFrames);
});
test('impossible rhythm and unsafe paths fail with useful errors',()=>{
 const c=fixture();c.selections[0].toWord=1;assert.throws(()=>scheduleShots(c),/No se puede repartir/);
 assert.throws(()=>reelPaths('../outside'),/slug/);assert.throws(()=>reelPaths('talking-head-..'),/slug/);
});
test('fingerprint invalidates research after transcript or cut changes',()=>{
 const c=fixture(),before=scheduleFingerprint(c);c.transcripts['01'].words[2].text='correccion';assert.notEqual(scheduleFingerprint(c),before);
});
test('resources and karaoke reject missing sources, approximate timing and invalid trims',()=>{
 const r={localFile:'a.png',sourcePage:'https://example.org/article',kind:'web-capture',label:'Fuente',license:'editorial excerpt',reason:'Muestra la noticia'};
 assert.doesNotThrow(()=>validateResource(r,{id:'a'}));assert.throws(()=>validateResource({...r,sourcePage:'file:///x'},{id:'a'}),/HTTPS/);assert.throws(()=>validateResource({...r,trimSeconds:-2},{id:'a'}),/trimSeconds/);
 assert.ok(auditWords([{start:0,end:1,text:'hola',timing:'approximate'}],2).some(i=>i.blocking));
 assert.ok(auditWords([{start:1,end:2},{start:1.5,end:2.3}],3).some(i=>i.blocking));
});
test('approved profile pins readable karaoke, gentle zoom and selected folder audio',()=>{
 const plan=planTalkingHead({...fixture(),manifest:{clips:fixture().manifest.clips,assets:[{id:'a',provenance:{source:'https://example.org',license:'test'}}]},selections:[{...fixture().selections[0],visuals:[{atWord:0,assetId:'a',reason:'contexto'}]}]});
 assert.equal(plan.scenes[0].cues[0].mediaZoom,1.025);assert.equal(plan.scenes[0].cues[0].mediaFit,'contain');assert.equal(plan.scenes[0].cues[0].mediaTransition,'cut');
 const context={...plan,captionStyle:{...plan.captionStyle,uppercase:true},soundSelectionStatus:'user-folder',soundPalette:{whoosh:['sfx/user-reel-a.wav']},soundCues:[{file:'sfx/library-pop.wav'}]};
 assert.ok(approvedStyle.run(context).some(i=>i.message.includes('carpeta')));
});
test('drop-folder import is idempotent, deduplicates files and preserves duration/removed render assets',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'reel-sfx-'));
 try {
  const folder=path.join(root,'sounds'),publicRoot=path.join(root,'public'),manifestFile=path.join(root,'import.json');await mkdir(folder);
  const file=path.join(folder,'Mi barrido favorito.wav');
  await run('ffmpeg',['-n','-f','lavfi','-i','sine=frequency=600:duration=1.25','-c:a','pcm_s16le',file]);
  await copyFile(file,path.join(folder,'duplicado.wav'));
  const first=await importFolderSounds({folder,publicRoot,manifestFile});assert.equal(first.entries.length,1);assert.equal(first.status,'user-folder');
  const cue=resolveSoundCue('whoosh',0,.45,0,first);assert.ok(cue.durationSeconds>1.2);assert.equal(cue.playbackRate,1);
  const second=await importFolderSounds({folder,publicRoot,manifestFile});assert.deepEqual(second.entries,first.entries);
  await rm(file);await rm(path.join(folder,'duplicado.wav'));
  const removed=await importFolderSounds({folder,publicRoot,manifestFile});assert.equal(removed.status,'empty');
  const media=await run('ffprobe',['-v','error',path.join(publicRoot,cue.file)]);assert.equal(media.stderr,'');
  await writeFile(path.join(folder,'roto.mp3'),'not audio');
  await assert.rejects(importFolderSounds({folder,publicRoot,manifestFile}),/roto.mp3/);
 } finally {assert.ok(path.resolve(root).startsWith(path.resolve(tmpdir())+path.sep+'reel-sfx-'));await rm(root,{recursive:true,force:true});}
});
