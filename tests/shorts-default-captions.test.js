import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {rm} from 'node:fs/promises';
import {buildShort} from '../src/modules/shorts-studio/build.js';
import {projectDir} from '../src/modules/shorts-studio/constants.js';
import {writeShortsRegistry} from '../src/modules/shorts-studio/registry.js';
import {writeJson} from '../src/lib/utils.js';

async function buildWithPlan(slug, extra) {
  const project=projectDir(slug);
  await writeJson(path.join(project,'manifest.json'),{slug,clips:[{id:'01',file:'unused.mp4',durationSeconds:4,width:1080,height:1920,fps:30,focus:{x:.5,y:.5},transcript:'words.json'}],assets:[]});
  await writeJson(path.join(project,'words.json'),{words:[['Se',.14,.58],['han',.58,.64],['filtrado',.64,1.04],['las',1.04,1.3],['benchmarks',1.3,1.84],['del',1.84,2.2],['nuevo',2.2,2.48],['Gemini',2.48,3],['4',3,3.44],['Pro,',3.44,3.82]].map(([text,start,end])=>({text,start,end}))});
  await writeJson(path.join(project,'short-plan.json'),{sound:{enabled:false},...extra,scenes:[{id:'take',clipId:'01',layout:'full',trim:{start:0,end:4},cameraSound:false,transitionSound:false,cues:[]}]});
  return buildShort({slug});
}

test('a short without caption style uses the long-video green karaoke', async () => {
  const slug='test-default-captions-'+process.pid;
  try {
    const build=await buildWithPlan(slug,{});
    const style=build.captionStyle;
    assert.equal(style.preset,'talking-head-green');
    assert.equal(style.renderer,'styled');
    assert.equal(style.font,'Schibsted Grotesk');
    assert.equal(style.primary,'#FFFFFF');
    assert.equal(style.activeColor,'#43F56C');
    assert.equal(style.outlineSize,5);
    assert.equal(style.mode,'karaoke');
    assert.ok(build.scenes[0].captionPages.every((page)=>page.words.length<=3));
  } finally {
    await rm(projectDir(slug),{recursive:true,force:true});
    await writeShortsRegistry();
  }
});

test('a plan that declares its caption renderer keeps it', async () => {
  const slug='test-theme-captions-'+process.pid;
  try {
    const build=await buildWithPlan(slug,{captionStyle:{renderer:'theme'}});
    assert.equal(build.captionStyle.renderer,'theme');
    assert.equal(build.captionStyle.preset,undefined);
  } finally {
    await rm(projectDir(slug),{recursive:true,force:true});
    await writeShortsRegistry();
  }
});
