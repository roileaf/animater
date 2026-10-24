import test from 'node:test';
import assert from 'node:assert/strict';
import {npcAbilityRecipe} from '../../scripts/catalogs/pf2e/npc-abilities.mjs';
import {BREATH_ELEMENTS} from '../../scripts/catalogs/bespoke/pf2e-npc-abilities.mjs';
import {validateRecipe,planRecipe} from '../../scripts/core/model.mjs';
const event=(element,shape,name='Breath Weapon')=>({type:'template',systemId:'pf2e',actor:{type:'npc'},item:{type:'action',name,system:{traits:{value:[element]},description:{value:`@Template[${shape}|distance:30]`}}},area:{type:shape},template:{t:shape==='line'?'ray':'cone'}});
test('every named NPC breath plays its complete native exhalation once, without editorial cropping',()=>{
 for(const element of BREATH_ELEMENTS)for(const shape of ['cone','line']){
  const recipe=npcAbilityRecipe(event(element,shape)),breath=recipe.stages.find(s=>s.stageId==='exhale');
  assert.ok(breath.oneShot,`${element} ${shape} plays once`);
  assert.ok(breath.duration>=6800,`${element} ${shape} retains the full movie, got ${breath.duration}`);
  assert.equal(breath.clipStart,0);assert.equal(breath.clipEnd,0);
  const catalog=recipe.stages.flatMap(s=>s.assets.map(key=>({key})));
  assert.doesNotThrow(()=>planRecipe(recipe,catalog,{source:{id:'npc',center:{x:0,y:0}},targets:[],template:{id:'area'},area:{type:shape,center:{x:0,y:0},endpoint:{x:600,y:0},length:600,width:100,angle:90}}),`${element} ${shape} needs no target selected`);
 }
});
test('unnamed NPC area abilities using breath footage also keep the whole clip',()=>{
 const recipe=npcAbilityRecipe(event('fire','cone','Devastating Blast'));
 const blast=recipe.stages.find(s=>s.stageId==='blast');
 assert.equal(blast.oneShot,true);assert.ok(blast.duration>=8466);
});
test('measured breath families account for playback speed and exit without overriding explicit clips',()=>{
 const make=(extra={})=>validateRecipe({id:'breath-test',name:'Breath',trigger:'template',stages:[{kind:'template',assets:['jb2a.breath_weapons.fire.cone.orange'],duration:2200,oneShot:true,...extra}]}).stages[0];
 assert.ok(make().duration>=8466);
 assert.ok(make({playbackRate:.5,fadeOut:200}).duration>=8466/.5+200);
 assert.equal(make({clipEnd:2000}).duration,2200,'explicit editorial clipping is respected');
});
