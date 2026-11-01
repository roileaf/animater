import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frameSettings} from '../../scripts/core/frame-settings.mjs';

test('hot callers share primitive reads across frames until invalidated, and re-read after the ttl',()=>{
  let time=0,value=true,reads=0;
  const settings=frameSettings({get:()=>{reads++;return value;},now:()=>time,ttl:2000});
  for(let i=0;i<100;i++){time+=16;assert.equal(settings.get('movementStealth'),true);}
  assert.equal(reads,1,'one read over many frames');
  value=false;settings.invalidate();assert.equal(settings.get('movementStealth'),false);
  assert.equal(reads,2);
  value=true;time+=2500;assert.equal(settings.get('movementStealth'),true,'a change past the hooks is picked up after the ttl');assert.equal(reads,3);
});
test('mutable settings and failures are not cached',()=>{
  let reads=0;
  const settings=frameSettings({get:key=>{reads++;if(key==='missing')throw Error('not registered');return {};},now:()=>1});
  assert.notEqual(settings.get('recipes'),settings.get('recipes'));
  assert.throws(()=>settings.get('missing'));assert.throws(()=>settings.get('missing'));assert.equal(reads,4);
});
test('onChange supplies the new primitive before Foundry updates its backing read cache',()=>{
 let time=1,value='full';
 const settings=frameSettings({get:()=>value,now:()=>time});
 assert.equal(settings.get('quality'),'full');
 settings.changed('quality','balanced');
 assert.equal(settings.get('quality'),'balanced');
 value='balanced';time+=16;assert.equal(settings.get('quality'),'balanced');
});
