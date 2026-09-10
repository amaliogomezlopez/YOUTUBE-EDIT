import {selectTalkingHeadSounds,validateSoundRatings} from '../src/modules/talking-head/sound-preferences.js';
import {resolveSoundCue} from '../src/modules/video-studio/sound-families.js';
import {buildCaptionPages} from '../src/modules/video-studio/captions.js';
import test from 'node:test';
import assert from 'node:assert/strict';
test('favorites exclude unchosen sounds and retain score order',()=>{
 const s=selectTalkingHeadSounds({ratings:{'air-01':3,'air-03':5,'ui-02':0}});
 assert.deepEqual(s.families,['whoosh']);assert.deepEqual(s.palette.whoosh,['sfx/amaliometria-whoosh-03.wav','sfx/amaliometria-whoosh-01.wav']);
 assert.equal(s.status,'user-ranked');
 assert.equal(resolveSoundCue('whoosh',1,1,1,{palette:s.palette}).file,s.palette.whoosh[1]);
 assert.equal(resolveSoundCue('whoosh',1,1,1,{palette:s.palette}).playbackRate,1);
});
test('provisional selection is varied and never claims user approval',()=>{const s=selectTalkingHeadSounds(null);assert.equal(s.status,'provisional');assert.ok(s.families.length>=3);assert.ok(Object.values(s.palette).flat().every(f=>!f.includes('library-')));});
test('ratings reject unknown files and invalid scores',()=>{assert.throws(()=>validateSoundRatings({'../audio':5}));assert.throws(()=>validateSoundRatings({'air-01':6}));assert.throws(()=>validateSoundRatings({'air-01':3.5}));});
test('strict short captions do not merge an orphan into a fourth word',()=>{
 const words=Array.from({length:4},(_,i)=>({text:['uno','dos','tres','cuatro'][i],start:i*.2,end:(i+1)*.2}));
 const pages=buildCaptionPages(words,{startSeconds:0,endSeconds:1},{maxWords:3,strictMaxWords:true});assert.deepEqual(pages.map(p=>p.words.length),[3,1]);
});

test('transcript end overlap never overlays two caption pages',()=>{
 const words=[{text:'generar',start:0,end:.44},{text:'imagen',start:.44,end:.78},{text:'con',start:.78,end:1.04},{text:'el',start:1.02,end:1.18},{text:'nuevo',start:1.18,end:1.38},{text:'modelo',start:1.38,end:1.62}];
 const pages=buildCaptionPages(words,{startSeconds:0,endSeconds:2},{maxWords:3,strictMaxWords:true});
 assert.equal(pages.length,2);assert.ok(pages[0].endSeconds<=pages[1].startSeconds);
 const endFrame=Math.round(pages[0].endSeconds*60),nextFrame=Math.round(pages[1].startSeconds*60);assert.ok(endFrame<=nextFrame);
});
