import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecipe,parseImport,planRecipe,previewPlan} from '../../scripts/core/model.mjs';
import {featRecipe} from '../../scripts/catalogs/pf2e/feats/feat-choreography.mjs';
import {AnimaterRuntime} from '../../scripts/engines/playback/runtime.mjs';
import {PF2E_FEATS} from '../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
const source={center:{x:0,y:0}},target={center:{x:300,y:0}};
const stage={kind:'aura',subject:'targets',assets:['jb2a.energy_field'],requiresHit:true};
test('conditional hit cues skip misses and unknown rolls while previews show the branch',()=>{
 const r=validateRecipe({id:'cane',name:'Cane',trigger:'attack',stages:[stage]}),catalog=[{key:'jb2a.energy_field'}],context={source,targets:[target]};
 assert.equal(parseImport(JSON.stringify({schema:1,recipes:[r]}))[0].stages[0].requiresHit,true);
 for(const outcome of [undefined,null,'failure','criticalFailure'])assert.equal(planRecipe(r,catalog,{...context,outcome}).length,0);
 for(const outcome of ['success','criticalSuccess'])assert.equal(planRecipe(r,catalog,{...context,outcome}).length,1);
 assert.equal(planRecipe(r,catalog,{...context,preview:true}).length,1);assert.equal(previewPlan(r,context).length,1);
});
test('native performer metadata survives save and automatic dispatch refuses guessed caster',async()=>{
 const r=featRecipe(PF2E_FEATS.find(f=>f.slug==='bone-burst'));
 assert.equal(r.playbackRoles.source,'thrall');
 assert.equal(validateRecipe(JSON.parse(JSON.stringify(r))).playbackRoles.source,'thrall');
 let played=false;
 const runtime=new AnimaterRuntime({enabled:()=>true,recipes:()=>[],resolveRecipe:()=>r,ready:()=>true,sequence:()=>{played=true;throw Error('unexpected sequence');}});
 await runtime.dispatch({type:'use',item:{name:'Bone Burst'},source,targets:[target]});
 assert.equal(played,false);assert.equal(runtime.log[0].status,'Blocked');assert.match(runtime.log[0].detail,/actual thrall/);
});
