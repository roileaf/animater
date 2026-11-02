import test from 'node:test';
import assert from 'node:assert/strict';
import {npcAbilityRecipe} from '../../scripts/catalogs/pf2e/npc-abilities.mjs';
import {BREATH_ELEMENTS} from '../../scripts/catalogs/bespoke/pf2e-npc-abilities.mjs';
import {validateRecipe,planRecipe} from '../../scripts/core/model.mjs';
const event=(element,shape,name='Breath Weapon')=>({type:'template',systemId:'pf2e',actor:{type:'npc'},item:{type:'action',name,system:{traits:{value:[element]},description:{value:`@Template[${shape}|distance:30]`}}},area:{type:shape},template:{t:shape==='line'?'ray':'cone'}});
test('every named NPC breath plays from just before it forms to its fade: out at once, never a slow fizz',()=>{
 for(const element of BREATH_ELEMENTS)for(const shape of ['cone','line']){
  const recipe=npcAbilityRecipe(event(element,shape)),breath=recipe.stages.find(s=>s.stageId==='exhale');
  assert.ok(breath.oneShot,`${element} ${shape} plays once`);
  // The window skips the clip's slow build-up at the mouth and ends once it has faded, not on its last frames of haze.
  assert.ok(breath.clipEnd>breath.clipStart,`${element} ${shape} plays a window of its clip`);
  assert.equal(breath.duration,breath.clipEnd-breath.clipStart,`${element} ${shape} lasts its window`);
  assert.ok(breath.duration<=4500,`${element} ${shape} is over in a few seconds, got ${breath.duration}`);
  // Its targets react once the breath has reached them.
  const hit=recipe.stages.find(s=>s.kind==='motion'&&s.subject==='targets');
  assert.equal(hit.afterStage,'exhale');assert.ok(hit.startOffset>=800&&hit.startOffset<=2000,`${element} ${shape}: targets react when it is out, at ${hit.startOffset}`);
  // Its light flashes as the breath leaves the mouth, not while it still gathers there.
  assert.ok(breath.lightDelay>0&&breath.lightDelay<=hit.startOffset,`${element} ${shape} lights up as it comes out, at ${breath.lightDelay}`);
  // A breath's own colour, not its clip tinted over again.
  const own={fire:['cone','line'],electricity:['line'],cold:['cone'],acid:['line'],poison:['cone']};
  if(own[element]?.includes(shape))assert.ok(!breath.tintEnabled,`${element} ${shape} plays its own colours`);
  const catalog=recipe.stages.flatMap(s=>s.assets.map(key=>({key})));
  assert.doesNotThrow(()=>planRecipe(recipe,catalog,{source:{id:'npc',center:{x:0,y:0}},targets:[],template:{id:'area'},area:{type:shape,center:{x:0,y:0},endpoint:{x:600,y:0},length:600,width:100,angle:90}}),`${element} ${shape} needs no target selected`);
 }
});
test('a sonic breath is drawn by Tokenshade as sound rolling out, not another element’s footage recoloured',()=>{
 for(const shape of ['cone','line']){
  const breath=npcAbilityRecipe(event('sonic',shape)).stages.find(s=>s.stageId==='exhale');
  assert.equal(breath.areaLook,'tokenshade',`sonic ${shape}`);
 }
 assert.equal(npcAbilityRecipe(event('fire','cone')).stages.find(s=>s.stageId==='exhale').areaLook,undefined,'the others keep their footage');
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
