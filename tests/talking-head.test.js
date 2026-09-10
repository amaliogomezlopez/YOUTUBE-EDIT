import test from 'node:test';
import assert from 'node:assert/strict';
import {planTalkingHead} from '../src/modules/talking-head/planner.js';
import {slotRect,SHORT_GEOMETRY} from '../src/modules/shorts-studio/geometry.js';
const words=[{start:1,end:1.4,text:'Hola'},{start:1.4,end:2,text:'mundo'},{start:4,end:4.5,text:'Seguimos'},{start:4.5,end:5,text:'aqui'}];
const input=()=>({manifest:{clips:[{id:'01',durationSeconds:7}],assets:[{id:'a',kind:'image',provenance:{source:'own',license:'own'}}]},transcripts:{'01':{words}},silences:{'01':[{start:2,end:4}]},selections:[{clipId:'01',fromWord:0,toWord:3,reason:'toma completa',visuals:[{atWord:0,assetId:'a',reason:'contexto'}]}]});
test('talking-head removes confirmed silence and preserves every spoken word',()=>{
 const p=planTalkingHead(input());assert.equal(p.scenes.length,2);
 for(const word of words) assert.ok(p.scenes.some(s=>s.trim.start<=word.start && s.trim.end>=word.end));
 assert.ok(p.scenes[1].trim.start-p.scenes[0].trim.end>1.5);
 assert.equal(p.scenes[1].cues[0].atWord,2);assert.equal(p.scenes[1].cues[0].sound,false);
 assert.equal(p.scenes[0].layout,'talking-head');
});
test('unconfirmed silence is preserved',()=>{const x=input();x.silences={};assert.equal(planTalkingHead(x).scenes.length,1);});
test('rejects invalid word anchors and unsourced assets',()=>{
 const x=input();x.selections[0].visuals[0].atWord=1;assert.throws(()=>planTalkingHead(x),/primer recurso/);
 x.selections[0].visuals[0].atWord=0;delete x.manifest.assets[0].provenance;assert.throws(()=>planTalkingHead(x),/procedencia/);
});
test('broll and presenter occupy distinct halves; captions remain safe',()=>{
 const panel=slotRect('broll-panel','talking-head');const face=SHORT_GEOMETRY.clip['talking-head'];
 assert.equal(panel.top+panel.height,face.top);assert.equal(panel.width,face.width);
 assert.ok(SHORT_GEOMETRY.captionBottom['talking-head']<=SHORT_GEOMETRY.safeBottom);
});

test('selection padding never reintroduces an excluded neighbouring word',()=>{
 const x=input();x.selections[0].fromWord=1;x.selections[0].toWord=1;x.selections[0].visuals[0].atWord=1;
 const p=planTalkingHead(x);assert.equal(p.scenes[0].trim.start,words[0].end);assert.ok(p.scenes[0].trim.end<=words[2].start);
});
