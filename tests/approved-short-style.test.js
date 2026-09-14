import assert from 'node:assert/strict';
import test from 'node:test';
import check from '../src/modules/shorts-studio/rules/checks/shorts-approved-white-captions.js';

const style = {approvedStyle:'white-dynamic-v1',font:'Schibsted Grotesk',primary:'#FFFFFF',accent:'#FFFFFF',activeColor:'#FFFFFF',outlineSize:5,mode:'karaoke',emphasis:'off'};
test('approved white style is opt-in and preserves compound caption units', () => {
  assert.deepEqual(check.run({captionStyle:{font:'Arial'}}), []);
  assert.deepEqual(check.run({captionStyle:style,scenes:[{captionPages:[{words:[{text:'Computer Use'}]}]}]}), []);
});
test('approved white style rejects color, outline and pagination regressions', () => {
  for (const change of [{primary:'#FFFF00'},{outlineSize:2},{font:'Arial'},{mode:'progressive'}]) {
    assert.ok(check.run({captionStyle:{...style,...change}}).length);
  }
  assert.ok(check.run({captionStyle:style,scenes:[{id:'one',captionPages:[{words:[{text:'dos'},{text:'palabras'}]}]}]}).length);
});
