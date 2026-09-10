import test from 'node:test';
import assert from 'node:assert/strict';
import {describeReelSound,semanticSoundSelection,chooseReelSound} from '../src/modules/talking-head/sound-usage.js';
import {resolveSoundCue} from '../src/modules/video-studio/sound-families.js';
const selection=semanticSoundSelection({entries:['Camera.wav','money.mp3','ES_Riser Metallic.mp3','Message sound.mp3','whip.wav'].map((sourceName,i)=>({sourceName,file:'sfx/test-'+i+'.wav',durationSeconds:.2}))});
test('special sounds never enter generic rotation',()=>{assert.equal(selection.palette.whoosh.length,2);assert.deepEqual(selection.families,['whoosh']);assert.equal(chooseReelSound(selection,{first:true}).family,'riser');assert.equal(chooseReelSound(selection).family,'whoosh');});
test('money and message require explicit semantic intent and context',()=>{assert.throws(()=>chooseReelSound(selection,{use:'money'}),/soundNote/);assert.equal(chooseReelSound(selection,{use:'message',note:'Aparece un tuit'}).family,'ui');assert.throws(()=>chooseReelSound(selection,{use:'intro'}),/inicio/);assert.equal(describeReelSound('money.mp3').use,'money');});
test('short whip retains room between attack and release',()=>{const c=resolveSoundCue('whoosh',0,1,0,{palette:{whoosh:['sfx/test.wav']},metadata:{'sfx/test.wav':{durationSeconds:.139}}});assert.ok(c.attackSeconds+c.releaseSeconds<c.durationSeconds/2);});

import {soundEdges} from '../src/modules/video-studio/sound-edges.js';
test('silent edges are removed without removing interior pauses',()=>{assert.deepEqual(soundEdges([{start:0,end:1.46},{start:1.6,end:3.07}],3.07),{start:1.43,end:1.6800000000000002});assert.deepEqual(soundEdges([{start:.5,end:.7}],1),{start:0,end:1});});
