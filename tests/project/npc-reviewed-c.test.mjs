import test from 'node:test';
import assert from 'node:assert/strict';
import {REVIEWED_ACTIONS} from '../../scripts/catalogs/pf2e/npc-reviewed-c.mjs';
import designs from '../../scripts/catalogs/bespoke/pf2e-npc-reviewed-c.mjs';
import {validateRecipe,planRecipe} from '../../scripts/core/model.mjs';
import {withoutCatalogMotion} from '../../scripts/catalogs/shared/catalog-motion.mjs';

test('all 640 source-specific shard C reviews name an authored cue and explain native delivery',()=>{
 const entries=Object.entries(REVIEWED_ACTIONS);
 assert.equal(entries.length,640);
 for(const[source,review]of entries){
  assert.match(source,/^action-/);assert.ok(designs[`pf2e:npc-${review.id}`],source);
  assert.ok(review.rationale.length>40,source);assert.equal(review.trigger,'use');
  assert.ok(['cue','strike','spell'].includes(review.delivery));
 }
});

test('every used cue plans with and without token motion, without document movement or invented attack payloads',()=>{
 const source={id:'source',center:{x:0,y:0},w:100,h:100},target={id:'target',center:{x:300,y:0},w:100,h:100};
 const ids=new Set(Object.values(REVIEWED_ACTIONS).map(r=>r.id));
 for(const id of ids){
  const descriptor=designs[`pf2e:npc-${id}`],raw=descriptor.build({recipe:{id:'sample',name:'Sample'},entry:{},options:{}});
  const recipe=validateRecipe({id:'sample',name:id,trigger:'use',stages:raw});
  for(const s of recipe.stages){assert.equal(s.persist,false,id);assert.ok(!['rush','leap','roll','path','dodge','throw','lunge'].includes(s.motion),`${id}: no document route or target direction required`);}
  for(const stages of [recipe.stages,withoutCatalogMotion(recipe.stages)]){
   assert.ok(stages.length,`${id}: effects-only must retain the real cue`);
   const catalog=stages.flatMap(s=>s.assets.map(key=>({key,width:400,height:400})));
   assert.ok(planRecipe({...recipe,stages},catalog,{source,targets:[target],gridSize:100}).length,id);
  }
  const mappings=Object.values(REVIEWED_ACTIONS).filter(r=>r.id===id);
  if(mappings.some(r=>r.delivery==='strike'||r.delivery==='spell'))assert.ok(!recipe.stages.some(s=>['impact','travel','projectile','template'].includes(s.kind)),`${id}: native action owns the payload`);
  if(mappings.every(r=>r.aim==='self')){
   const catalog=recipe.stages.flatMap(s=>s.assets.map(key=>({key,width:400,height:400})));
   assert.doesNotThrow(()=>planRecipe(recipe,catalog,{source,targets:[],gridSize:100}),id);
  }
 }
});
test('blood, binding and soul cues resolve the verified Free blue-strand fallback',()=>{
 const catalog=[{key:'jb2a.energy_strands.complete.blue.01',width:400,height:400}];
 const source={id:'s',center:{x:0,y:0}},target={id:'t',center:{x:200,y:0}};
 for(const name of ['fury','bloodtarget','spellblood','blood','grip','soul','bind']){
  const raw=designs[`pf2e:npc-review-c-${name}`].build({});
  const recipe=validateRecipe({id:'sample',name,trigger:'use',stages:raw});
  const plan=planRecipe(recipe,catalog,{source,targets:[target],gridSize:100});
  assert.ok(plan.some(s=>s.asset==='jb2a.energy_strands.complete.blue.01'),name);
 }
});
