import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_SPELLS,catalogSpellReady,catalogSpellEnabled,useCatalogSpell,spellRecipe} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {planRecipe} from '../../scripts/core/model.mjs';
import {assetDatabases} from '../../tools/asset-databases.mjs';

test('Antlion Trap has a playable native sand-pit footprint without casting-time save movement',()=>{
 const spell=PF2E_SPELLS.find(s=>s.slug==='antlion-trap');
 assert.equal(catalogSpellReady(spell),true,'native sand terrain must not be left unconfigured');
 assert.equal(catalogSpellEnabled(spell.id,useCatalogSpell({},spell.id)),true);
 const recipe=spellRecipe(spell,undefined,{sound:false});
 assert.equal(recipe.enabled,true);
 assert.equal(recipe.trigger,'template');
 assert.deepEqual(recipe.previewArea,{type:'burst',value:15});
 const area=recipe.stages.filter(s=>s.kind==='template');
 assert.ok(area.length>=2,'sand basin and inward particles need separate area layers');
 assert.ok(area.every(s=>s.assets.length>0&&s.below===true));
 assert.ok(recipe.stages.every(s=>s.kind!=='motion'||s.subject==='source'),'Reflex results occur on entering/starting a turn, not when the pit is cast');
 assert.ok(recipe.stages.every(s=>!s.assets.some(k=>/^jb2a\.(?:cast_generic|impact|magic_signs)\./.test(k))));
});

test('both JB2A editions retain the sand funnel and inward grain direction at the placed footprint',async()=>{
 const spell=PF2E_SPELLS.find(s=>s.slug==='antlion-trap');
 const recipe=spellRecipe(spell,undefined,{sound:false});
 const databases=await assetDatabases();
 for(const [edition,db] of Object.entries(databases)){
  for(const diameter of [600,800]){
   const template={id:'pit'},area={type:'circle',center:{x:300,y:400},diameter};
   const plan=planRecipe(recipe,db,{source:{id:'caster'},targets:[],template,area,gridSize:100});
   assert.equal(plan.length,3,edition);
   assert.match(plan[0].asset,/^jb2a\.template_circle\.vortex\.loop\./,edition);
   assert.match(plan[1].asset,/^jb2a\.particles\.swirl\./,edition);
   assert.match(plan[2].asset,/^jb2a\.particles\.inward\./,edition);
   assert.ok(plan.every(s=>s.destination===template&&s.scale===1&&s.below),edition);
   assert.ok(plan.every(s=>s.duration===6000&&s.colorize&&s.tintEnabled),edition);
   assert.deepEqual(plan.map(s=>s.delay),[0,250,450],edition);
  }
 }
});
