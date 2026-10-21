import test from 'node:test';
import assert from 'node:assert/strict';
import {bodySurface,targetSurface,withSurfaceSounds,blowOfItem,surfaceAnchor} from '../../../scripts/engines/sound/surface-sounds.mjs';
import {DND5E_ENTRIES,dndRecipe} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {dhEntries,dhRecipe} from '../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs';
import {SF2E_ENTRIES,sfRecipe} from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {dnd5eTargetOutcomes,withOutcome} from '../../../scripts/systems/outcome.mjs';
import {planRecipe} from '../../../scripts/core/model.mjs';

// Every recording resolves, as if every sound pack were installed.
const sounds={resolve:c=>({...c,duration:c.duration??500,gain:c.gain??1})};
// D&D 5e actors: a creature type, the armour and shield in the AC, active effects by name.
const dnd=(name,{type='humanoid',subtype='',armor=null,shield=false,calc='default',effects=[]}={})=>({name,system:{details:{type:{value:type,subtype}},attributes:{ac:{calc,equippedArmor:armor&&{name:armor[0],system:{type:{value:armor[1]}}},equippedShield:shield?{name:'Shield'}:null}}},items:[],effects:effects.map(name=>({name}))});
const longsword=()=>DND5E_ENTRIES.find(e=>e.kind==='weapon'&&e.slug==='longsword');

test('D&D 5e creatures: armour by name and weight, creature types, ghosts and elementals by name',()=>{
 assert.equal(bodySurface(dnd('Knight',{armor:['Plate Armor','heavy']})),'metal');
 assert.equal(bodySurface(dnd('Guard',{armor:['Chain Shirt','medium']})),'metal');
 assert.equal(bodySurface(dnd('Scout',{armor:['Leather Armor','light']})),'leather');
 assert.equal(bodySurface(dnd('Orc',{armor:['Hide Armor','medium']})),'leather');
 assert.equal(bodySurface(dnd('Commoner')),'flesh');
 assert.equal(bodySurface(dnd('Giant Spider',{type:'beast'})),'crunch');
 assert.equal(bodySurface(dnd('Skeleton',{type:'undead'})),'crunch');
 assert.equal(bodySurface(dnd('Ghost',{type:'undead'})),null);
 assert.equal(bodySurface(dnd('Iron Golem',{type:'construct'})),'metal');
 assert.equal(bodySurface(dnd('Stone Golem',{type:'construct'})),'stone');
 assert.equal(bodySurface(dnd('Gelatinous Cube',{type:'ooze'})),'squish');
 assert.equal(bodySurface(dnd('Shambling Mound',{type:'plant'})),'crunch');
 assert.equal(bodySurface(dnd('Fire Elemental',{type:'elemental'})),null);
 assert.equal(bodySurface(dnd('Earth Elemental',{type:'elemental'})),'stone');
 assert.equal(bodySurface(dnd('Water Elemental',{type:'elemental'})),'squish');
 assert.equal(bodySurface(dnd('Adult Red Dragon',{type:'dragon'})),'flesh');
});
test('D&D 5e protection: a shield blocks a miss, the Shield spell rings, Mage Armor is a ward on a bare body',()=>{
 assert.equal(targetSurface(dnd('Fighter',{armor:['Chain Mail','heavy'],shield:true}),'failure'),'shield');
 assert.equal(targetSurface(dnd('Wizard',{effects:['Shield']}),'failure'),'ward');
 assert.equal(targetSurface(dnd('Wizard',{calc:'mage'}),'success'),'ward');
 assert.equal(targetSurface(dnd('Druid',{effects:['Barkskin']}),'success'),'crunch');
 assert.equal(targetSurface(dnd('Commoner'),'failure'),null);
});
test('Daggerheart: equipped armour by name; adversaries by name',()=>{
 const dh=(name,armor)=>({name,system:{},items:armor?[{type:'armor',name:armor,system:{equipped:true}}]:[],effects:[]});
 assert.equal(bodySurface(dh('Seraphine','Full Plate Armor')),'metal');
 assert.equal(bodySurface(dh('Rook','Gambeson Armor')),'leather');
 assert.equal(bodySurface(dh('Wren','Leather Armor')),'leather');
 assert.equal(bodySurface(dh('Giant Scorpion')),'crunch');
 assert.equal(bodySurface(dh('Bandit')),'flesh');
});
test('every system: the blow comes from the weapon used',()=>{
 assert.equal(blowOfItem({system:{damage:{damageType:'slashing'}}}),'blade');
 assert.equal(blowOfItem({system:{damage:{base:{types:new Set(['piercing'])}}}}),'pierce');
 assert.equal(blowOfItem({name:'Broadsword',system:{}},{family:'hammer'}),'blunt');
 assert.equal(blowOfItem({name:'Staff',system:{}},{family:'magic'}),null);
 assert.equal(blowOfItem({system:{damage:{base:{types:new Set(['fire'])}}}}),null);
});
test('D&D 5e, Daggerheart and SF2e catalog weapons gain a surface cue at their blow',()=>{
 const ls=longsword(),dhSword=dhEntries('weapon').find(e=>/sword/i.test(e.name)),sfSword=SF2E_ENTRIES.find(e=>e.kind==='weapon'&&/sword/i.test(e.name));
 for(const [label,recipe,anchor] of [['dnd5e',dndRecipe(ls,ls.variants[0].id,{sounds}),'1-contact'],['daggerheart',dhRecipe(dhSword,dhSword.variants[0].id,{sounds}),'hit-contact'],['sf2e',sfRecipe(sfSword,sfSword.variants[0].id,{sounds}),`${sfSword.variants[0].recipe.id}-contact`]]){
  assert.equal(surfaceAnchor(recipe.stages).stageId,anchor,label);
  const cue=withSurfaceSounds(recipe,{blow:'blade',sounds}).stages.find(s=>s.surfaces);
  assert.ok(cue?.surfaces.metal?.length&&cue.surfaces.ward?.length,label);
  assert.equal(cue.afterStage,anchor,label);
 }
 // A recipe without sound cues (the catalog's sounds switched off) stays silent.
 assert.equal(withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds:null}),{blow:'blade',sounds}).stages.some(s=>s.surfaces),false);
});
test('several D&D targets each get their own hit or miss, and each its own surface',()=>{
 const targets=[{token:'Scene.s.Token.a',ac:12},{token:'Scene.s.Token.b',ac:20}];
 assert.deepEqual(dnd5eTargetOutcomes([{total:15}],targets),{a:'success',b:'failure'});
 assert.deepEqual(dnd5eTargetOutcomes([{total:3,isCritical:true}],targets),{a:'criticalSuccess',b:'criticalSuccess'});
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'blade',sounds}),cue=recipe.stages.find(s=>s.surfaces);
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 const knight={id:'a',actor:dnd('Knight',{armor:['Plate Armor','heavy']})},wizard={id:'b',actor:dnd('Wizard',{effects:['Shield']})};
 const plan=planRecipe({...recipe,stages:recipe.stages.map(s=>s.surfaces?{...s,targetSelection:'all'}:s)},installed,{source:{id:'me'},targets:[knight,wizard],outcome:null,targetOutcomes:{a:'success',b:'failure'},surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random:()=>0});
 const cues=plan.filter(s=>s.surfaces);
 assert.ok(cue.surfaces.metal.some(x=>x.file===cues.find(c=>c.destination===knight)?.soundFile));
 assert.ok(cue.surfaces.ward.some(x=>x.file===cues.find(c=>c.destination===wizard)?.soundFile));
});
test('a surface cue survives a miss: on the swing that still cuts the air, or at the blow’s time when the hit is gone',()=>{
 // Melee: the swing stays on a miss, and so does the cue that follows it.
 const ls=longsword(),melee=withOutcome(withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'blade',sounds}),{outcome:'failure',type:'attack'});
 assert.equal(melee.stages.find(s=>s.surfaces)?.afterStage,'1-contact');
 // Ranged: the arrow's arrival on the target is dropped; the cue keeps the time it would have struck.
 const bow=DND5E_ENTRIES.find(e=>e.kind==='weapon'&&e.slug==='longbow');
 const ranged=withOutcome(withSurfaceSounds(dndRecipe(bow,bow.variants[0].id,{sounds}),{blow:'pierce',sounds}),{outcome:'failure',type:'attack'});
 const cue=ranged.stages.find(s=>s.surfaces);
 assert.ok(cue,'kept');assert.ok(!cue.afterStage);assert.ok(cue.delay>0);
 assert.equal(ranged.stages.some(s=>s.stageId==='1-accent'),false);
});
