import test from 'node:test';
import assert from 'node:assert/strict';
import check from '../src/modules/shorts-studio/rules/checks/shorts-screen-crop-excludes-webcam.js';

test('clean screen validates the whole webcam panel, not just the detected face', () => {
  const scene = {id:'screen',layout:'pip',sourceWidth:1920,sourceHeight:1080,
    webcamBox:{x:1700,y:60,w:120,h:160,sourceBox:{x:1500,y:0,w:420,h:400}},
    screenRegion:{x:0,y:0,w:1600,h:1080,webcamPolicy:'exclude'}};
  assert.equal(check.run({scenes:[scene]}).length, 1);
  const clean = {...scene,screenRegion:{...scene.screenRegion,w:1500}};
  assert.deepEqual(check.run({scenes:[clean]}), []);
  assert.equal(check.run({scenes:[{...clean,pip:{mask:{visible:true}}}]}).length, 1);
  assert.deepEqual(check.run({scenes:[{...scene,screenRegion:{...scene.screenRegion,webcamPolicy:undefined}}]}), []);
});
