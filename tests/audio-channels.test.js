import test from 'node:test';
import assert from 'node:assert/strict';
import {voiceChannelFilter,analyzeAudioChannels} from '../src/modules/video-studio/audio-channels.js';
import {run} from '../src/lib/utils.js';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
test('repairs left-only, right-only and mono voice but preserves actual stereo',()=>{
 assert.equal(voiceChannelFilter({rmsDb:[-20,-100]}),'pan=stereo|c0=c0|c1=c0');
 assert.equal(voiceChannelFilter({rmsDb:[-100,-20]}),'pan=stereo|c0=c1|c1=c1');
 assert.equal(voiceChannelFilter({rmsDb:[-20]}),'pan=stereo|c0=c0|c1=c0');
 assert.equal(voiceChannelFilter({rmsDb:[-20,-22]}),null);assert.equal(voiceChannelFilter({rmsDb:[-120,-120]}),null);
});
test('real unilateral stereo becomes equal left and right after repair',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'reel-channels-'));
 try{const src=path.join(dir,'source.wav'),out=path.join(dir,'fixed.wav');
 await run('ffmpeg',['-n','-f','lavfi','-i','sine=duration=0.5','-af','pan=stereo|c0=c0|c1=0*c0',src]);
 const before=await analyzeAudioChannels(src);assert.ok(before.imbalanceDb>60);
 await run('ffmpeg',['-n','-i',src,'-af',voiceChannelFilter(before),out]);
 const after=await analyzeAudioChannels(out);assert.equal(after.channels,2);assert.ok(after.imbalanceDb<.01);
 }finally{assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep+'reel-channels-'));await rm(dir,{recursive:true,force:true});}
});
