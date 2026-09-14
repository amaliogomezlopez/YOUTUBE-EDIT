import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCaptionStyle} from '../src/lib/captions/presets.js';
import {buildCaptionPages} from '../src/modules/video-studio/captions.js';
import check from '../src/modules/shorts-studio/rules/checks/shorts-talking-head-karaoke.js';
test('green karaoke keeps an orphan out of a full three-unit page',()=>{
 const style=resolveCaptionStyle({preset:'talking-head-green'});
 const words=['uno','dos','tres','fin'].map((text,i)=>({text,start:i*.2,end:(i+1)*.2}));
 const pages=buildCaptionPages(words,{startSeconds:0,endSeconds:1},{...style,mode:'karaoke'});
 assert.deepEqual(pages.map(p=>p.words.length),[3,1]);
 const context={captionStyle:{...style,mode:'karaoke'},scenes:[{captionPages:pages}]};
 assert.deepEqual(check.run(context),[]);
 assert.ok(check.run({...context,captionStyle:{...context.captionStyle,emphasis:'off'}}).length);
 assert.ok(check.run({...context,scenes:[{captionPages:[{words}]}]}).length);
 assert.deepEqual(check.run({captionStyle:{preset:'karaoke-highlight'}}),[]);
});
