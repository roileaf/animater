import test from 'node:test';
import assert from 'node:assert/strict';
import {NPC_ACTIONS,PF2E_NPC_ACTION_SOURCE,npcActionPreview,npcAbilityRecipe,findNpcCatalogAction} from '../../scripts/catalogs/pf2e/npc-abilities.mjs';
import {REVIEWED_NPC_ACTIONS} from '../../scripts/catalogs/pf2e/npc-reviewed-actions.mjs';
import {planRecipe} from '../../scripts/core/model.mjs';
import {PATH_MOTIONS} from '../../scripts/engines/motion/motion-path.mjs';

const source={id:'npc',center:{x:100,y:100},w:100,h:100};
const target={id:'target',center:{x:400,y:100},w:100,h:100};
const eventFor=a=>({type:a.form.trigger,systemId:'pf2e',actor:{type:'npc',name:'Renamed native NPC'},item:{type:'action',name:a.name,sourceId:a.sources[0],system:{traits:{value:a.traits},description:{value:''}}}});

test('every remaining native action receives an explicit source-level choice and valid cue',()=>{
 assert.equal(Object.keys(REVIEWED_NPC_ACTIONS).length,1921);
 assert.equal(NPC_ACTIONS.filter(a=>!a.form).length,0);
 assert.equal(PF2E_NPC_ACTION_SOURCE.animated,NPC_ACTIONS.length);
 assert.equal(PF2E_NPC_ACTION_SOURCE.reviewed,1921);
 for(const [id,review] of Object.entries(REVIEWED_NPC_ACTIONS)){
  const action=NPC_ACTIONS.find(a=>a.id===id);
  assert.ok(action,id);assert.equal(action.coverage,'reviewed');
  const {rationale,...form}=review;assert.deepEqual(action.form,form,`${action.name}: generated metadata is current`);
  assert.ok(review.rationale?.length>=10,action.name);
  assert.ok(npcActionPreview(id)?.bespoke,action.name);
  assert.equal(npcAbilityRecipe(eventFor(action),[],{generic:false})?.bespoke,`pf2e:npc-${review.id}`,`${action.name}: native event reaches its explicit design`);
  assert.ok(['use','template'].includes(review.trigger),action.name);
 }
});

test('explicit multi-recipient controls retain every selected creature',()=>{
 const second={...target,id:'second',center:{x:500,y:100}};
 const actions=NPC_ACTIONS.filter(a=>a.coverage==='reviewed'&&a.form.targetSelection==='all');
 assert.ok(actions.length>=5);
 for(const a of actions){
  const recipe=npcActionPreview(a.id),catalog=recipe.stages.flatMap(s=>s.assets.map(key=>({key})));
  const plan=planRecipe(recipe,catalog,{source,targets:[target,second],gridSize:100,outcome:'success'});
  const recipients=new Set(plan.filter(s=>s.subject==='targets').map(s=>s.destination?.id));
  assert.ok(recipients.has('target')&&recipients.has('second'),a.name);
 }
});

test('reviewed actions plan with native routing, including targetless self cues and motion disabled',()=>{
 for(const a of NPC_ACTIONS.filter(a=>a.coverage==='reviewed'))for(const motion of [true,false]){
  const recipe=npcActionPreview(a.id,{motion});
  assert.ok(recipe,`${a.name}: motion=${motion}`);
  const catalog=recipe.stages.flatMap(s=>s.assets.map(key=>({key})));
  const context={source,targets:a.form.aim==='self'?[]:[target],gridSize:100,template:{id:'area'},area:{type:'cone',center:source.center,endpoint:{x:700,y:100},length:600,width:100,angle:90},outcome:'success'};
  assert.doesNotThrow(()=>planRecipe(recipe,catalog,context),`${a.name}: motion=${motion}`);
  if(!motion)assert.ok(!recipe.stages.some(s=>s.kind==='motion'),a.name);
  assert.ok(!recipe.stages.some(s=>s.kind==='motion'&&PATH_MOTIONS.has(s.motion)),`${a.name}: cosmetic cues do not force movement`);
  if(a.form.delivery==='strike'||a.form.delivery==='spell'){
   assert.equal(a.form.aim,'self',a.name);
   assert.ok(!recipe.stages.some(s=>['travel','projectile','impact'].includes(s.kind)),`${a.name}: native follow-up owns the hit`);
  }
 }
});

test('reviewed source matching works without heuristics, honors overrides and exact exclusions',()=>{
 const actions=NPC_ACTIONS.filter(a=>a.coverage==='reviewed');
 for(const a of [actions[0],actions[Math.floor(actions.length/2)],actions.at(-1)]){
  const event=eventFor(a);
  assert.equal(findNpcCatalogAction(event),a);
  const foreign={...event,item:{...event.item,sourceId:'Compendium.sf2e.test.Actor.foreign.Item.action'}};
  assert.equal(findNpcCatalogAction(foreign),null,'foreign same-name source never selects a native review');
  assert.ok(npcAbilityRecipe(event,[],{generic:false}),a.name);
  assert.equal(npcAbilityRecipe(event,[],{excluded:[a.id]}),null);
  const mine={id:'custom',name:'Custom cue',match:a.name,trigger:a.form.trigger,enabled:true,stages:[{kind:'aura',subject:'source',assets:['jb2a.impact.001.orange']}]};
  assert.equal(npcAbilityRecipe(event,[mine]).id,'custom');
  assert.equal(npcAbilityRecipe(event,[{...mine,enabled:false}]),null);
 }
 const unknown={type:'use',actor:{type:'npc'},item:{type:'action',name:'Wholly unknown custom regression action',system:{traits:{value:[]},description:{value:''}}}};
 assert.equal(npcAbilityRecipe(unknown),null);
 const customSameName={type:'use',actor:{type:'npc',name:'Unrelated custom creature'},item:{type:'action',name:actions[0].name,system:{traits:{value:[]},description:{value:''}}}};
 assert.equal(findNpcCatalogAction(customSameName),null,'name alone cannot replace live custom semantics with a native review');
});
