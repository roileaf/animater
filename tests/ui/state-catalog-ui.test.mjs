import test from 'node:test';
import assert from 'node:assert/strict';
import {stateCatalogHTML} from '../../scripts/ui/state-catalog-ui.mjs';
import {handleStateCatalogAction} from '../../scripts/catalogs/pf2e/state-catalog-actions.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe,useStateEntry,stateEntryEnabled,normalizeStateCatalogState} from '../../scripts/catalogs/pf2e/state-catalog.mjs';
import {openCatalogDetails} from '../../scripts/catalogs/shared/catalog-details.mjs';
function view(entry,env={},auraVariant='default'){
 const kind=entry.kind,w={page:kind==='condition'?'conditions':'effects',selectedState:{[kind]:entry.id},stateFilters:{[kind]:{search:entry.name}},statePages:{[kind]:0},stateDamageType:'fire',stateAuraVariant:auraVariant,busy:false,recipePreviewHTML:()=>'<div data-recipe-scene></div>',host:{recipes:()=>[],stateCatalogState:()=>({}),environment:()=>({systemId:'pf2e',ready:true,...env})}};
 return stateCatalogHTML(w);
}
test('conditions and effects expose opt-in sustained controls, native details, highlighted finite preview and customization',()=>{
 for(const e of [PF2E_CONDITIONS[0],PF2E_EFFECTS[0]]){
  const html=view(e);assert.match(html,/Use animation/);assert.match(html,/Customize/);assert.match(html,/data-action="item-details"/);assert.match(html,/data-action="state-auto"/);assert.match(html,/Stays until removed/);assert.match(html,/data-stage-drag="0"/);assert.match(html,/data-recipe-progress/);assert.doesNotMatch(html,/Ability description|data-action="play"/);
 }
});
test('persistent damage exposes true type variants and controls cannot configure another system or preview',()=>{
 const e=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage'),html=view(e);assert.match(html,/data-state-damage/);assert.match(html,/value="fire" selected/);assert.match(html,/value="bleed"/);
 for(const env of [{demo:true},{systemId:'dnd5e'},{ready:false}])assert.match(view(e,env),/data-action="use-state" disabled/);
});
test('choice-dependent aura previews expose actual materials and layer explanations instead of the old generic bearer marker',()=>{
 const e=PF2E_EFFECTS.find(e=>e.name==='Stance: Thermal Nimbus'),html=view(e,{},'cold');
 assert.match(html,/data-state-aura-variant/);assert.match(html,/value="cold" selected/);assert.match(html,/Cold thermal currents/);
 assert.match(html,/Live aura follows the native PF2e choice/);assert.doesNotMatch(html,/translucent shield surrounds/);
 assert.match(html,/data-stage-drag="1"/);
});
test('state title buttons open native conditionitems/effect compendium Item sheets',async()=>{
 for(const e of [PF2E_CONDITIONS[0],PF2E_EFFECTS.find(e=>e.name==='Spell Effect: Bless')]){
  let got,rendered=false;await openCatalogDetails({host:{environment:()=>({}),resolveItem:async uuid=>{got=uuid;return {sheet:{render:async()=>rendered=true}}}}},e.kind,e.id);assert.equal(got,e.uuid);assert.equal(rendered,true);
 }
});
test('customize retains selected variant and uses that version for this entry only',async()=>{
 const e=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage');let saved=[],state={};
 const w={page:'conditions',selectedState:{condition:e.id},recipe:()=>stateRecipe(e,{damageType:'fire'}),dirty:new Set(),render:()=>{},host:{environment:()=>({systemId:'pf2e',ready:true}),recipes:()=>saved,save:async rows=>saved=rows,stateCatalogState:()=>state,setStateCatalogState:async(k,change)=>state={...state,...change}}};
 await handleStateCatalogAction(w,'copy-state',{dataset:{}});assert.equal(saved[0].stateDamageType,'fire');assert.equal(w.page,'recipes');
 assert.equal(state.enabled,true);assert.equal(state.scope,'selected','only this entry turns on');assert.ok(state.customized.includes(e.id));assert.ok(stateEntryEnabled(e.id,normalizeStateCatalogState(state)));
 w.dirty.add(saved[0].id);await assert.rejects(handleStateCatalogAction(w,'enable-state-custom',{dataset:{}}),/Save/);w.dirty.clear();await handleStateCatalogAction(w,'enable-state-custom',{dataset:{}});assert.equal(state.enabled,true);assert.ok(state.customized.includes(e.id));
});
