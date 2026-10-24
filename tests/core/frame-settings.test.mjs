import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frameSettings} from '../../scripts/core/frame-settings.mjs';

test('hot callers share primitive reads within a frame, never stale across frames or invalidation',()=>{
  let frame=1,value=true,reads=0;
  const settings=frameSettings({get:()=>{reads++;return value;},frame:()=>frame});
  for(let i=0;i<100;i++)assert.equal(settings.get('movementStealth'),true);
  assert.equal(reads,1);
  value=false;settings.invalidate();assert.equal(settings.get('movementStealth'),false);
  assert.equal(reads,2);
  value=true;frame++;assert.equal(settings.get('movementStealth'),true);assert.equal(reads,3);
});
test('mutable settings and failures are not cached',()=>{
  let reads=0;
  const settings=frameSettings({get:key=>{reads++;if(key==='missing')throw Error('not registered');return {};},frame:()=>1});
  assert.notEqual(settings.get('recipes'),settings.get('recipes'));
  assert.throws(()=>settings.get('missing'));assert.throws(()=>settings.get('missing'));assert.equal(reads,4);
});
test('onChange supplies the new primitive before Foundry updates its backing read cache',()=>{
 let frame=1,value='full';
 const settings=frameSettings({get:()=>value,frame:()=>frame});
 assert.equal(settings.get('quality'),'full');
 settings.changed('quality','balanced');
 assert.equal(settings.get('quality'),'balanced');
 value='balanced';frame++;assert.equal(settings.get('quality'),'balanced');
});
