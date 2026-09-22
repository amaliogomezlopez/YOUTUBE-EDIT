import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultQualityArgs} from '../remotion-animations/scripts/lib/render-quality.mjs';
import {resolveRenderPerformance, resolveEncoder, remotionPerformanceArgs} from '../src/modules/video-studio/render-performance.js';

test('NVENC and bitrate pass through the wrapper without CRF, even with env CRF',()=>{
  const options=remotionPerformanceArgs(resolveRenderPerformance({encoder:'nvenc'}),'high');
  const args=[...defaultQualityArgs('render',options,{REMOTION_CRF:'17'}),...options];
  assert.ok(args.includes('--hardware-acceleration=required'));
  assert.ok(args.includes('--video-bitrate=24M'));
  assert.ok(!args.some(a=>a.startsWith('--crf')));
  assert.deepEqual(defaultQualityArgs('still',[]),[]);
  assert.ok(defaultQualityArgs('render',[]).includes('--crf=17'));
});

test('CPU keeps CRF and GPU probe fails before starting a required render',async()=>{
  const options=remotionPerformanceArgs(resolveRenderPerformance({encoder:'cpu'}));
  assert.ok(options.includes('--crf=17'));
  assert.ok(!options.some(a=>a.startsWith('--video-bitrate')));
  const probe=async()=>{throw Error('no driver');};
  assert.equal(await resolveEncoder('auto',{probe}),'cpu');
  await assert.rejects(resolveEncoder('nvenc',{probe}),/NVENC no disponible/);
  assert.equal(await resolveEncoder('cpu',{probe:async()=>assert.fail('CPU must not probe')}),'cpu');
  const controller=new AbortController();controller.abort();
  await assert.rejects(resolveEncoder('auto',{signal:controller.signal,probe}));
});

test('invalid performance values fail early',()=>{
  for(const options of [{encoder:'bad'},{concurrency:0},{concurrency:99},{gl:'bad'}]) assert.throws(()=>resolveRenderPerformance(options));
});

import {mkdtemp, readFile, stat, rm, utimes} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {run} from '../src/lib/utils.js';
import {defaultCutClip} from '../src/modules/shorts-studio/from-long-video.js';

test('intermediate cache reuses exact cuts and invalidates range and source changes',async(t)=>{
  const root=await mkdtemp(path.join(tmpdir(),'shortsmith-cut-cache-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const videoFile=path.join(root,'source.mp4');const outputFile=path.join(root,'cut.mp4');
  await run('ffmpeg',['-v','error','-f','lavfi','-i','color=s=256x256:r=30:d=2','-f','lavfi','-i','sine=duration=2','-c:v','libx264','-c:a','aac','-shortest',videoFile]);
  const args={videoFile,outputFile,start:0,durationSeconds:1};
  await defaultCutClip(args);
  const before=await stat(outputFile);
  const key=JSON.parse(await readFile(outputFile+'.cache.json','utf8')).key;
  await defaultCutClip(args);
  assert.equal((await stat(outputFile)).mtimeMs,before.mtimeMs);
  await defaultCutClip({...args,start:0.5});
  const changedKey=JSON.parse(await readFile(outputFile+'.cache.json','utf8')).key;
  assert.notEqual(changedKey,key);
  const source=await stat(videoFile);
  await utimes(videoFile,source.atime,new Date(source.mtimeMs+2000));
  await defaultCutClip({...args,start:0.5});
  assert.notEqual(JSON.parse(await readFile(outputFile+'.cache.json','utf8')).key,changedKey);
});
