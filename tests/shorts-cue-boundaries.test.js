import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rm} from 'node:fs/promises';
import {buildShort} from '../src/modules/shorts-studio/build.js';
import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {writeShortsRegistry} from '../src/modules/shorts-studio/registry.js';
import {writeJson} from '../src/lib/utils.js';

test('adjacent word-anchored cues share a frame boundary after rounding', async () => {
  const slug='test-cue-boundaries-'+process.pid;
  const project=projectDir(slug);
  try {
    await writeJson(path.join(project,'manifest.json'),{slug,clips:[{id:'01',file:'unused.mp4',durationSeconds:3,width:1080,height:1920,fps:30,focus:{x:.5,y:.5},transcript:'words.json'}],assets:[]});
    await writeJson(path.join(project,'words.json'),{words:[{text:'Uno',start:.01,end:.3},{text:'Dos',start:1.02,end:1.3},{text:'Tres',start:2.03,end:2.5}]});
    await writeJson(path.join(project,'short-plan.json'),{sound:{enabled:false},scenes:[{id:'take',clipId:'01',layout:'full',trim:{start:0,end:3},cameraSound:false,transitionSound:false,cues:[
      {type:'label',slot:'overlay-top',text:'A',atWord:0,holdSeconds:1.01,sound:false,soundNote:'Test'},
      {type:'label',slot:'overlay-top',text:'B',atWord:1,holdSeconds:1.01,sound:false,soundNote:'Test'},
      {type:'label',slot:'overlay-top',text:'C',atWord:2,holdSeconds:.97,sound:false,soundNote:'Test'}
    ]}]});
    const build=await buildShort({slug});
    const cues=build.scenes[0].cues;
    assert.equal(cues[0].fromFrame+cues[0].durationInFrames,cues[1].fromFrame);
    assert.equal(cues[1].fromFrame+cues[1].durationInFrames,cues[2].fromFrame);
    assert.equal(cues[2].fromFrame+cues[2].durationInFrames,build.scenes[0].durationInFrames);
  } finally {
    await rm(project,{recursive:true,force:true});
    await writeShortsRegistry();
  }
});
