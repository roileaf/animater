import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecipe,planRecipe} from '../../scripts/core/model.mjs';

test('optional target links preserve source playback, still play selected links, and do not weaken required attacks',()=>{
 const recipe=validateRecipe({id:'link',name:'Ally connection',trigger:'manual',stages:[
  {kind:'cast',assets:['jb2a.glint.blue'],delay:0,duration:2000},
  {kind:'travel',assets:['jb2a.energy_beam.blue'],delay:300,duration:2000,optionalTargets:true},
 ]});
 const db=recipe.stages.flatMap(s=>s.assets.map(key=>({key,file:`${key}.webm`})));
 const source={id:'caster',center:{x:0,y:0}},context={source,targets:[]};
 assert.equal(recipe.stages[1].optionalTargets,true);
 assert.deepEqual(planRecipe(recipe,db,context).map(s=>s.kind),['cast']);
 assert.deepEqual(planRecipe(recipe,db,{...context,targets:[{id:'ally',center:{x:200,y:0}}]}).map(s=>s.kind),['cast','travel']);
 recipe.stages[1].optionalTargets=false;
 assert.throws(()=>planRecipe(recipe,db,context),/Target at least one token/);
});
