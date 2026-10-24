import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEWED_ACTIONS} from '../../scripts/catalogs/pf2e/npc-reviewed-a.mjs';
import designs from '../../scripts/catalogs/bespoke/pf2e-npc-reviewed-a.mjs';
import {NPC_ACTIONS} from '../../scripts/catalogs/pf2e/npc-abilities.mjs';
import {validateRecipe,planRecipe} from '../../scripts/core/model.mjs';
import {withoutCatalogMotion} from '../../scripts/catalogs/shared/catalog-motion.mjs';
const review=(name,creature)=>{
 const entry=NPC_ACTIONS.find(a=>a.name===name&&a.creatures.includes(creature));
 assert.ok(entry,`${name} on ${creature}`);const form=REVIEWED_ACTIONS[entry.id];
 assert.ok(form,`Explicit source review: ${name}`);return form;
};

test('reviewed native attacks hand off while trigger-only and spell modification actions retain their own cue',()=>{
 assert.equal(review('Attack of Opportunity','Urthagul').delivery,'strike');
 assert.equal(review('Furious Throw','Cavern Troll').delivery,'strike');
 assert.equal(review('Angled Entry','The Claws of Time').delivery,'spell');
 assert.equal(review('Lasting Darkness','Shimmerthief').delivery,'cue');
 assert.equal(review('Greater Cruelty','Verthok the Reaper').delivery,'cue');
 assert.equal(review('Energizing Incompetence','Oppali').delivery,'cue');
 assert.equal(review('Master Strike','Nai Yan Fei').delivery,'cue');
 assert.equal(review('Death Glide','Lemming Rat').delivery,'cue');
 assert.equal(review('Grasping Hands','Hermean Mutant').targetSelection,'all');
 assert.equal(review('Reposition','Otyugh').targetSelection,'all');
 assert.equal(review('Body Slam','Grauladon').targetSelection,'all');
 for(const [name,creature]of[["Archon's Protection",'Rekhep'],['Cloak in Embers','Ember Fox'],['Gird in Prayer','Shabti Votary']]){
  const form=review(name,creature);assert.equal(form.aim,'target');assert.equal(form.id,'review-a-ward-target');
 }
 assert.equal(review('Harden Chitin','Zecui Horde').id,'review-a-guard');
 assert.equal(review('Reckless Toxin','Doatara the Poisoner').delivery,'cue');
 assert.equal(review('Reckless Toxin','Doatara the Poisoner').aim,'target');
});

test('blood drain has a measured Free energy-strand fallback recolored as blood',()=>{
 const form=review('Chupar','False Devil'),composition=designs[`pf2e:npc-${form.id}`];
 const recipe=validateRecipe({id:'free-blood-check',name:'Chupar',trigger:'use',stages:composition.build({})});
 const plan=planRecipe(recipe,[{key:'jb2a.energy_strands.complete.blue.01'}],{source:{id:'source',center:{x:0,y:0}},targets:[{id:'target',center:{x:100,y:0}}]});
 assert.ok(plan.length);assert.ok(plan.every(s=>s.asset==='jb2a.energy_strands.complete.blue.01'));
 assert.ok(recipe.stages.every(s=>s.tintEnabled&&s.tint==='#a24343'));
});

test('every A review compiles with motion on or off; self cues need no selected creature',()=>{
 assert.equal(Object.keys(REVIEWED_ACTIONS).length,641);
 const source={id:'source',center:{x:0,y:0}},target={id:'target',center:{x:200,y:0}};
 for(const [id,form] of Object.entries(REVIEWED_ACTIONS)){
  const composition=designs[`pf2e:npc-${form.id}`];assert.ok(composition,id);
  const recipe=validateRecipe({id:'reviewed-npc-check',name:id,trigger:form.trigger,stages:composition.build({})});
  for(const moving of [true,false]){
   const selected=moving?recipe:validateRecipe({...recipe,stages:withoutCatalogMotion(recipe.stages)});
   assert.ok(selected.stages.length,`${id}: motion-off keeps a non-impact cue`);
   assert.ok(!selected.stages.some(s=>s.kind==='impact'),`${id}: no invented hit`);
   const catalog=selected.stages.flatMap(s=>s.assets.map(key=>({key})));
   assert.doesNotThrow(()=>planRecipe(selected,catalog,{source,targets:form.aim==='self'?[]:[target]}),id);
  }
 }
});
