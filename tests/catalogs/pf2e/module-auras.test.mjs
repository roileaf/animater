import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_EFFECTS,stateRecipe,findStateEntry,filterStateCatalog} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import {moduleActive} from '../../../scripts/catalogs/pf2e/module-auras.mjs';
import {nativeAuraStates} from '../../../scripts/engines/playback/persistent-states.mjs';
import {resolveAsset} from '../../../scripts/core/model.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
const libraries=await assetDatabases();
const mods=PF2E_EFFECTS.filter(e=>e.modules);

test('PF2e Workbench and patreon-v3 auras are catalog entries of their own',()=>{
 // 15 module auras, 4 of them shipped by both modules: one entry each.
 assert.equal(mods.length,11);
 assert.equal(new Set(mods.map(e=>e.name)).size,11);
 assert.deepEqual([...new Set(mods.flatMap(e=>e.modules))].sort(),['patreon-v3','xdy-pf2e-workbench']);
 const anthem=mods.find(e=>e.uuid==='Compendium.xdy-pf2e-workbench.xdy-pf2e-workbench-items.Item.KIPV1TiPCzlhuAzo');
 assert.equal(anthem.name,'Aura: Courageous Anthem');assert.equal(anthem.auras[0].slug,'aura-effect-inspire-courage');
 // The effect on the performer was made from the module's compendium: it is found by that source.
 assert.equal(findStateEntry({type:'effect',name:'Aura: Courageous Anthem',_stats:{compendiumSource:anthem.uuid}})?.id,anthem.id);
 // patreon-v3's copy is the same entry: leaving out Courageous Anthem leaves out both.
 assert.equal(findStateEntry({type:'effect',name:'Aura: Courageous Anthem',_stats:{compendiumSource:'Compendium.patreon-v3.effects.Item.RR8MSbHqxJdQxh2e'}})?.id,anthem.id);
 assert.deepEqual(anthem.modules,['xdy-pf2e-workbench','patreon-v3']);
});
test('each module aura draws a field at its radius that resolves in both JB2A editions',()=>{
 for(const e of mods)for(const edition of ['free','patreon']){
  const r=stateRecipe(e,{catalog:libraries[edition],aura:{slug:e.auras[0].slug,radius:25,source:{}}});
  assert.ok(r.stages.length>=1,e.name);
  for(const s of r.stages){assert.equal(s.auraRadius,25,`${e.name}: ${s.label}`);assert.ok(resolveAsset(s,libraries[edition]),`${e.name} (${edition}): ${s.label} has no installed asset`);}
 }
});
test('the performer of a Workbench anthem shows the aura, not the spell effect it hands out',()=>{
 const e=mods.find(m=>m.name==='Aura: Courageous Anthem');
 const source={uuid:'Actor.a.Item.x',type:'effect',name:e.name,_stats:{compendiumSource:e.uuid},system:{rules:[{key:'Aura',slug:'aura-effect-inspire-courage'}]}};
 const actor={items:[source],auras:new Map([['aura-effect-inspire-courage',{slug:'aura-effect-inspire-courage',radius:60,effects:[{parent:source,uuid:'Compendium.pf2e.spell-effects.Item.beReeFroAx24hj83'}]}]])};
 assert.deepEqual(nativeAuraStates(actor).map(i=>i.animaterAura.entryId),[e.id]);
});
test('module auras are listed only while their module is active',()=>{
 const was=globalThis.game;
 try{
  globalThis.game={modules:new Map([['xdy-pf2e-workbench',{active:true}],['patreon-v3',{active:false}]])};
  const shown=filterStateCatalog('effect',{search:'aura:'}).filter(e=>e.modules).map(e=>e.name);
  assert.ok(shown.includes('Aura: Courageous Anthem'),'shipped by an active module');
  assert.ok(!shown.includes('Aura: Song of Strength'),'only patreon-v3 ships it, and it is off');
  assert.equal(moduleActive({name:'Spell Effect: Bless'}),true,'PF2e entries always');
 }finally{globalThis.game=was;}
});
