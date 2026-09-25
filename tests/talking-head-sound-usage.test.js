import test from 'node:test';
import assert from 'node:assert/strict';
import {describeReelSound,semanticSoundSelection,chooseReelSound} from '../src/modules/talking-head/sound-usage.js';
import {resolveSoundCue} from '../src/modules/video-studio/sound-families.js';
const selection=semanticSoundSelection({entries:['Camera.wav','money.mp3','ES_Riser Metallic.mp3','Message sound.mp3','whip.wav'].map((sourceName,i)=>({sourceName,file:'sfx/test-'+i+'.wav',durationSeconds:.2}))});
test('special sounds never enter generic rotation',()=>{assert.equal(selection.palette.whoosh.length,2);assert.deepEqual(selection.families,['whoosh']);assert.equal(chooseReelSound(selection,{first:true}).family,'riser');assert.equal(chooseReelSound(selection).family,'whoosh');});
test('money and message require explicit semantic intent and context',()=>{assert.throws(()=>chooseReelSound(selection,{use:'money'}),/soundNote/);assert.equal(chooseReelSound(selection,{use:'message',note:'Aparece un tuit'}).family,'ui');assert.throws(()=>chooseReelSound(selection,{use:'intro'}),/inicio/);assert.equal(describeReelSound('money.mp3').use,'money');});
test('short whip retains room between attack and release',()=>{const c=resolveSoundCue('whoosh',0,1,0,{palette:{whoosh:['sfx/test.wav']},metadata:{'sfx/test.wav':{durationSeconds:.139}}});assert.ok(c.attackSeconds+c.releaseSeconds<c.durationSeconds/2);});

import {soundEdges} from '../src/modules/video-studio/sound-edges.js';
test('silent edges are removed without removing interior pauses',()=>{assert.deepEqual(soundEdges([{start:0,end:1.46},{start:1.6,end:3.07}],3.07),{start:1.46,end:1.6});assert.deepEqual(soundEdges([{start:.5,end:.7}],1),{start:0,end:1});});

import {syncReelSoundTiming} from '../src/modules/talking-head/sound-timing.js';
test('riser ends on next actual visual cut and other sounds start on it',()=>{
 const c={fps:60,scenes:[{from:0,cues:[{id:'a',type:'broll',assetId:'one',fromFrame:7,soundUse:'intro'},{id:'b',type:'broll',assetId:'two',fromFrame:201,soundUse:'transition'}]}],soundCues:[{cueId:'a',durationSeconds:1.707,startSeconds:.12},{cueId:'b',durationSeconds:.2,startSeconds:3.36}]};
 syncReelSoundTiming(c);assert.equal(Math.round(c.soundCues[0].startSeconds*60)+Math.round(c.soundCues[0].durationSeconds*60),201);assert.equal(c.soundCues[1].startSeconds,201/60);
});
test('riser skips continuity cuts and rejects missing or too early visual changes',()=>{
 const c={fps:60,scenes:[{from:0,cues:[{id:'a',type:'broll',assetId:'same',soundUse:'intro',fromFrame:0}]},{from:60,cues:[{id:'b',type:'broll',assetId:'same',fromFrame:0},{id:'c',type:'broll',assetId:'new',fromFrame:120}]}],soundCues:[{cueId:'a',durationSeconds:2,startSeconds:0}]};
 syncReelSoundTiming(c);assert.equal(c.soundCues[0].startSeconds,1);
 c.soundCues[0].durationSeconds=4;assert.throws(()=>syncReelSoundTiming(c),/no cabe/);c.scenes.pop();assert.throws(()=>syncReelSoundTiming(c),/cambio/);
});
test('wholly silent effects are rejected instead of being timed as real audio',()=>{assert.throws(()=>soundEdges([{start:0,end:2}],2),/audible/);});
test('usos de montaje por prefijo o subcarpeta: fuera de la paleta de los Reels',()=>{
 assert.equal(describeReelSound('impacto-grave_short-bass-hit_mixkit-2299.wav').use,'impact-low');
 assert.equal(describeReelSound('whoosh-in_fast-whoosh_mixkit-1490.wav').use,'whoosh-in');
 assert.equal(describeReelSound('ding-dato_dry-popup.wav').use,'data');
 assert.equal(describeReelSound('impactos\\golpe.wav').use,'impact-low');
 assert.equal(describeReelSound('clicks/raton.wav').use,'click');
 assert.equal(describeReelSound('remate_money-drop.wav').use,'impact-finisher','el prefijo manda sobre la palabra money');
 const s=semanticSoundSelection({entries:['whip.wav','impacto-grave_a.wav','clic_b.wav','Message sound.mp3'].map((sourceName,i)=>({sourceName,file:'sfx/e-'+i+'.wav',durationSeconds:.2}))});
 assert.deepEqual(s.palette.whoosh,['sfx/e-0.wav']);
 assert.deepEqual(s.palette.ui,['sfx/e-3.wav'],'un clic nunca suena en un mensaje');
 assert.equal(Object.values(s.palette).flat().includes('sfx/e-1.wav'),false);
 assert.ok(s.metadata['sfx/e-1.wav']);
 assert.deepEqual(s.families,['whoosh']);
});
