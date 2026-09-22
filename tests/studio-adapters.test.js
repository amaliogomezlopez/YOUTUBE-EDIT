import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';
import {assertRenderCapability} from '../src/modules/video-studio/render-adapters.js';import {transitionSamples,compareEditorialCandidates} from '../src/modules/video-studio/camera-review.js';
import {freezeProject,loadFrozenProject} from '../src/modules/video-studio/project-lock.js';import {contentHash} from '../src/modules/shorts-studio/camera-project.js';import {ROOT,writeJson} from '../src/lib/utils.js';
const build=()=>({format:{width:1080,height:1920,fps:60},durationInFrames:180,scenes:[{from:0,durationInFrames:180,camera:'static',transitionIn:'cut',cues:[],screenCamera:{track:{events:[{time:0,end:1.15},{time:1.8,end:2.95}]}}}],captionStyle:{mode:'karaoke',baseFontSize:68,primary:'#FFFFFF',accent:'#43F56C',uppercase:true,font:'Schibsted Grotesk',renderer:'styled',emphasis:'color'},clipVolume:1,soundMix:1});
test('adapters reject unavailable engines and unsupported effects without fallback',()=>{const b=build();assert.doesNotThrow(()=>assertRenderCapability('ffmpeg',b));assert.throws(()=>assertRenderCapability('pixi',b));b.music={file:'x'};assert.throws(()=>assertRenderCapability('ffmpeg',b));assert.doesNotThrow(()=>assertRenderCapability('remotion',b));});
test('FFmpeg rejects custom style, overlays, multiple scenes and wrong format',()=>{for(const mutate of [b=>b.captionStyle.font='other',b=>b.scenes[0].label='x',b=>b.scenes.push(b.scenes[0]),b=>b.format.fps=30]){const b=build();mutate(b);assert.throws(()=>assertRenderCapability('ffmpeg',b));}});
test('transition review includes boundaries, midpoint and scene cuts with no out-of-range frames',()=>{const b=build(),frames=transitionSamples(b);assert.deepEqual(frames,[0,35,69,70,107,108,143,177,178,179]);b.scenes.push({from:120,durationInFrames:60});assert.ok(transitionSamples(b).includes(119));});
test('comparison refuses incomparable evidence and never declares a semantic winner',()=>{const a={model:'a',sourceHash:'s',transcriptHash:'t',regionsHash:'r',plan:{selection:{fromWord:1,toWord:4},cues:[]}},b={...a,model:'b'};const r=compareEditorialCandidates([a,b]);assert.equal(r.semanticWinner,null);assert.equal(r.pairs[0].sameSelection,true);assert.throws(()=>compareEditorialCandidates([a,{...b,regionsHash:'different'}]));});
test('frozen versions preserve media after originals change and reject tampering/stale plans',async()=>{
 const dir=await fs.mkdtemp(path.join(ROOT,'data/tmp/lock-test-')),name='projects/_lock-tests/'+path.basename(dir)+'.txt',media=path.join(ROOT,'remotion-animations/public',name);await fs.mkdir(path.dirname(media),{recursive:true});await fs.writeFile(media,'unique '+dir);
 const plan={scenes:[]},manifest={clips:[],assets:[]},b={...build(),scenes:[],backgroundImage:name,projectInputsHash:contentHash({plan,manifest,transcripts:[]})};
 await writeJson(path.join(dir,'short-plan.json'),plan);await writeJson(path.join(dir,'manifest.json'),manifest);await writeJson(path.join(dir,'short-build.json'),b);
 const frozen=await freezeProject(dir);await fs.writeFile(media,'changed original');assert.equal((await loadFrozenProject(dir,frozen.id)).id,frozen.id);
 await writeJson(path.join(dir,'short-plan.json'),{scenes:[{}]});await assert.rejects(()=>freezeProject(dir),/shorts:build/);
 await writeJson(path.join(frozen.dir,'short-build.json'),{});await assert.rejects(()=>loadFrozenProject(dir,frozen.id),/Build congelado/);
});

import {shortCaptionPagesToAss} from '../src/lib/subtitles.js';
test('ASS adapter preserves shared page boundaries and word anchors',()=>{
 const ass=shortCaptionPagesToAss([{fromFrame:60,durationInFrames:60,words:[{text:'UNO',fromFrame:60,toFrame:90},{text:'DOS',fromFrame:90,toFrame:120}]}],{fps:60,rect:{left:54,top:1570,width:892,height:160},style:{font:'Schibsted Grotesk',baseFontSize:68,primary:'#FFFFFF',accent:'#43F56C',activeColor:'#43F56C',preset:'talking-head-green',tracking:0,outlineSize:2,shadow:3,uppercase:true}});
 assert.ok(ass.includes('0:00:01.00,0:00:01.50'));assert.ok(ass.includes('0:00:01.50,0:00:02.00'));assert.ok(ass.includes('UNO'));assert.ok(ass.includes('DOS'));
});
