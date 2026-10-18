import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_WEAPONS,filterWeapons,findCatalogWeapon,useCatalogWeapon,resolveAutomaticWeaponRecipe,weaponRecipe} from '../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {pf2eEvent} from '../../scripts/systems/adapters.mjs';

const wraps=()=>PF2E_WEAPONS.find(w=>w.slug==='handwraps-of-mighty-blows');
const ownedWraps=(slug='handwraps-of-mighty-blows')=>({type:'weapon',name:'Renamed wraps',system:{category:'unarmed',traits:{otherTags:['handwraps-of-mighty-blows']}},isEquipped:true,isInvested:true,_stats:{compendiumSource:`Compendium.pf2e.equipment-srd.Item.${PF2E_WEAPONS.find(w=>w.slug===slug)?.id}`}});
const strike=(wrap=ownedWraps())=>({type:'attack',weaponMode:'melee',item:{type:'weapon',name:'Fist',system:{slug:'basic-unarmed',category:'unarmed',group:'brawling',damage:{damageType:'bludgeoning'},traits:{value:['unarmed']}},actor:{itemTypes:{weapon:[wrap]}}}});

test('Handwraps and related native rune equipment remain searchable in weapon catalog',()=>{
 for(const slug of ['handwraps-of-mighty-blows','dragon-handwraps','restorative-handwraps','amphisbaena-handwraps','bloodknuckles']){
  const w=PF2E_WEAPONS.find(w=>w.slug===slug);assert.ok(w,`${slug} is missing`);
  assert.equal(w.strikeBinding,'unarmed');assert.deepEqual(w.modes.map(m=>m.mode),['melee']);
  assert.equal(w.modes[0].damage,'bludgeoning','Preview basic unarmed contact, not storage damage on worn wraps');
  assert.ok(weaponRecipe(w).stages.some(s=>s.kind==='impact'));
 }
 assert.ok(filterWeapons({search:'Handwraps of Mighty Blows'}).some(w=>w.id===wraps().id));
});

test('Handwraps preserve permanent rune finishes without inventing activation benefits',()=>{
 const find=slug=>PF2E_WEAPONS.find(w=>w.slug===slug);
 assert.ok(find('dragon-handwraps').modes[0].elements.includes('fire'));
 assert.ok(find('bloodknuckles').modes[0].elements.includes('bleed'));
 assert.equal(find('amphisbaena-handwraps').modes[0].element,'physical','Twin Venom Strike poison is an activation');
 assert.equal(find('restorative-handwraps').modes[0].element,'physical','Critical Flurry healing is conditional');
});

test('PF2e synthetic Fist roll resolves worn invested Handwraps, including renamed equipment',()=>{
 assert.ok(wraps());
 const item=strike().item;
 const event=pf2eEvent({id:'fist',author:{id:'u'},isRoll:true,item,actor:item.actor,flags:{pf2e:{context:{type:'attack-roll'}}}},'u');
 assert.equal(findCatalogWeapon(event)?.id,wraps()?.id);
 const recipe=resolveAutomaticWeaponRecipe(event,useCatalogWeapon({},wraps()?.id),[],{customEnabled:false});
 assert.equal(recipe?.id,weaponRecipe(wraps()).id);
 assert.ok(recipe.stages.find(s=>s.kind==='impact').assets.every(k=>k.includes('unarmed_strike')));
});

test('Handwraps routing respects investment, native first active pair, exclusions, attack type and saved customization',()=>{
 const w=wraps();assert.ok(w);
 const state=useCatalogWeapon({},w.id),event=strike();
 for(const property of ['isEquipped','isInvested'])assert.equal(findCatalogWeapon(strike({...ownedWraps(),[property]:false})),null);
 assert.equal(findCatalogWeapon({...event,item:{...event.item,system:{category:'martial'}}}),null);
 assert.equal(resolveAutomaticWeaponRecipe({...event,type:'use'},state),null);
 assert.equal(resolveAutomaticWeaponRecipe({...event,type:'damage'},state),null);
 assert.equal(resolveAutomaticWeaponRecipe(event,{...state,excluded:[w.id]}),null);
 const dragon=ownedWraps('dragon-handwraps');
 const multiple={...event,item:{...event.item,actor:{itemTypes:{weapon:[dragon,ownedWraps()]}}}};
 assert.equal(findCatalogWeapon(multiple).slug,'dragon-handwraps');
 assert.equal(resolveAutomaticWeaponRecipe(multiple,state),null,'Never choose a selected second pair over PF2e active first pair');
 const custom={...weaponRecipe(w),name:'Edited unarmed animation'};
 const configured={...state,customized:[`${w.id}:melee`]};
 assert.equal(resolveAutomaticWeaponRecipe(event,configured,[custom],{customEnabled:false})?.name,custom.name);
 const disabled={...custom,enabled:false};
 assert.equal(resolveAutomaticWeaponRecipe(event,configured,[disabled],{customEnabled:false}),null);
});
