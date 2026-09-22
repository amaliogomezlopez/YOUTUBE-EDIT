import test from 'node:test';
import assert from 'node:assert/strict';
import {extractCapcutReference} from '../src/modules/editorial-memory/capcut.js';
const child=()=>({id:'inner',duration:2500000,fps:30,tracks:[{id:'v',type:'video',segments:[{id:'s',material_id:'m',source_timerange:{start:400000,duration:2500000},target_timerange:{start:0,duration:2500000},volume:0.001,clip:{scale:{x:1.2,y:1.2}},common_keyframes:[{property_type:'KFTypeScaleX',keyframe_list:[{time_offset:400000,values:[1.2]}]}],extra_material_refs:['transition']}]}],materials:{videos:[{id:'m',path:'original.mkv',crop:{upper_left_x:0.1},team_id:'private'}],transitions:[{id:'transition',duration:333333,name:'Acercar'}]}});
test('CapCut preserves nested timeline clocks, transforms, references and native keyframes',()=>{
  const inner=child();const root={id:'root',tracks:[],materials:{drafts:[{id:'compound',draft:inner}]},platform:{device_id:'secret'}};
  const input=JSON.stringify(root);const result=extractCapcutReference(input);
  assert.equal(result.timelines.length,2);assert.equal(result.timelines[1].parent.materialId,'compound');
  const s=result.timelines[1].tracks[0].segments[0].native;
  assert.deepEqual(s,inner.tracks[0].segments[0]);assert.equal(result.renderable,false);assert.equal(result.styleApproved,false);
  assert.equal(result.timelines[1].materials.videos[0].native.team_id,undefined);
  assert.deepEqual(result.timelines[1].materials.videos[0].omittedFields,['team_id']);
  assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(!JSON.stringify(result).includes('private'));
  assert.equal(result.sourceSha256,extractCapcutReference(input).sourceSha256);
  s.clip.scale.x=3;assert.equal(inner.tracks[0].segments[0].clip.scale.x,1.2);
});
test('CapCut rejects unreadable formats and invalid timing without guessing',()=>{
  assert.throws(()=>extractCapcutReference('encrypted'),/legible/);
  assert.throws(()=>extractCapcutReference('{}'),/no reconocida/);
  const d=child();d.tracks[0].segments[0].target_timerange.start=0.5;
  assert.throws(()=>extractCapcutReference(JSON.stringify(d)),/temporal invalido/);
});