import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_EFFECTS,PF2E_CONDITIONS,stateRecipe,resolveStateRecipe,useStateEntry} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
const entry=name=>{const row=PF2E_EFFECTS.find(e=>e.name===name);assert.ok(row,name);return row;};
test('speed penalties and penalties that end on healing are not enhancements',()=>{
 for(const name of ['Spell Effect: Equal Footing (Success)','Effect: Glue Bomb','Effect: Hamstring','Effect: Sight Prey (Speed Penalty)','Effect: Chthonic Mucus'])assert.equal(entry(name).theme,'slow',name);
 for(const name of ['Effect: Remove Face','Effect: -2 circumstance penalty to attack rolls until healed','Effect: Spore Feedback'])assert.equal(entry(name).theme,'curse',name);
});
test('mental unholy penalties, choice injuries and literal light keep native semantics',()=>{
 for(const name of ['Effect: Whisper Earworm (Critical Failure)','Effect: Aura of Sophistry (Unholy)','Spell Effect: Synesthesia (Success)'])assert.equal(entry(name).theme,'mind',name);
 for(const name of ['Spell Effect: Necrotize (Failure)','Effect: Called Shot','Effect: Targeting Finisher','Effect: Wither Away'])assert.equal(entry(name).theme,'curse',name);
 for(const name of ['Effect: Draft of Stellar Radiance','Effect: Shimmering Dust'])assert.equal(entry(name).theme,'light',name);
 assert.equal(entry('Effect: Fiddle').theme,'music');
 assert.equal(entry('Effect: Talented Tap Shoes').theme,'speed');
});
test('timed condition variants reuse the parent condition look',()=>{
 for(const [name,slug] of [['Effect: Dazzled until end of your next turn','dazzled'],['Effect: Off-Guard until end of your next turn','off-guard']]){
  const parent=PF2E_CONDITIONS.find(e=>e.slug===slug);
  assert.deepEqual(stateRecipe(entry(name)).stages.map(s=>s.assets),stateRecipe(parent).stages.map(s=>s.assets),name);
 }
});
test('core conditions without a literal cue still get an identity beyond a plain ring',()=>{
 for(const slug of ['clumsy','encumbered','enfeebled','fatigued','immobilized','paralyzed','hostile'])
  assert.ok(stateRecipe(PF2E_CONDITIONS.find(e=>e.slug===slug)).stages.some(s=>!/token_border/.test(s.assets.join())),slug);
 assert.match(stateRecipe(PF2E_CONDITIONS.find(e=>e.slug==='immobilized')).stages[0].assets.join(),/markers\.chain/);
});
test('chosen-element effects never default to fire and resolve the native selection',()=>{
 for(const name of ['Effect: Energized Cartridge','Effect: Alchemical Strike','Spell Effect: Elemental Motion','Spell Effect: Elemental Betrayal','Effect: Erraticannon','Effect: Energy Shield Tunic'])
  assert.doesNotMatch(stateRecipe(entry(name)).stages[0].assets.join(),/flames|fire/,name);
 const tunic=entry('Effect: Energy Shield Tunic'),item=e=>({type:'effect',name:tunic.name,sourceId:tunic.uuid,flags:{system:{rulesSelections:{resistance:e}}},system:{}});
 const state=useStateEntry({},tunic.id);
 assert.match(resolveStateRecipe(item('fire'),state,[]).stages[0].assets.join(),/shield_themed\.above\.fire/);
 assert.match(resolveStateRecipe(item('cold'),state,[]).stages[0].assets.join(),/shield_themed\.above\.ice/);
 const acid=resolveStateRecipe(item('acid'),state,[]).stages[0];assert.match(acid.assets[0],/markers\.shield\.green/,'a compact ward marker, never the hex dome');
 const motion=entry('Spell Effect: Elemental Motion');
 assert.match(resolveStateRecipe({type:'effect',name:motion.name,sourceId:motion.uuid,flags:{system:{rulesSelections:{spellEffectElementalMotion:'water'}}},system:{}},useStateEntry({},motion.id),[]).stages[0].assets.join(),/bubble/);
});
test('resistance wards take the damage type look; effects of one theme are told apart',()=>{
 assert.match(entry('Effect: Potion of Fire Resistance').assets[0],/shield_themed\.above\.fire/);
 assert.match(entry('Effect: Potion of Cold Resistance').assets[0],/shield_themed\.above\.ice/);
 // Effects of one theme take its variants in turn instead of all sharing one animation.
 for(const theme of ['boon','neutral','penalty','defense'])assert.ok(new Set(PF2E_EFFECTS.filter(e=>e.theme===theme).map(e=>e.editions.patreon.key)).size>1,theme);
 // Siblings sharing a name stem never share an animation (shades of one count as one).
 const lightning=PF2E_EFFECTS.filter(e=>/^Effect: Lightning (?:Armillary|Catcher|Powered|Rod)$/.test(e.name)).map(e=>e.editions.patreon.key.split('.').slice(0,-1).join('.'));
 assert.equal(lightning.length,4);
 assert.equal(new Set(lightning).size,4);
 assert.ok(!PF2E_EFFECTS.some(e=>/shield\.01\./.test(e.editions.patreon.key)),'no hex-dome wards on tokens');
});
