import test from 'node:test';
import assert from 'node:assert/strict';
import {weaponSources} from '../../tools/pf2e-weapon-source.mjs';
import {analyzeWeapon} from '../../tools/weapon-semantics.mjs';
import {weaponSoundDirection,featSoundDirection} from '../../tools/ability-sound-semantics.mjs';
import {PF2E_FEATS} from '../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {spellSources} from '../../tools/pf2e-source.mjs';
import {soundDirection} from '../../tools/spell-sound-semantics.mjs';
import {PF2E_SPELLS} from '../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {UTILITY_SPELL_DESIGNS} from '../../scripts/catalogs/pf2e/spells/spell-utility-designs.mjs';
const sources=await weaponSources();
const nativeSpells=await spellSources();
const direction=(name,use)=>{const row=sources.weapons.find(r=>r.source.name===name);assert.ok(row,name);const w=analyzeWeapon(row.source,row.path);return weaponSoundDirection(w,w.modes.find(m=>!use||m.mode===use));};
test('native bow and black-powder construction retains audible identity',()=>{
 for(const [name,profile]of [['Shortbow','shortbow'],['Longbow','longbow'],['Arquebus','arquebus'],['Flintlock Musket','musket'],['Flintlock Pistol','pistol']])assert.equal(direction(name).profile,profile,name);
});
test('wooden staff and edged polearm do not use metal staff or spear-thrust audio',()=>{
 assert.equal(direction('Staff').profile,'staff');
 assert.equal(direction('Scythe').profile,'polearmBlade');
 assert.equal(direction('Katana').profile,'katana');
 assert.equal(direction('Hatchet','thrown').profile,'thrownAxe');
});
test('water bladder, plant sack and pressure bomb do not all sound like pottery',()=>{
 assert.equal(direction('Water Bomb (Lesser)').profile,'bomb-water');
 assert.equal(direction('Twigjack Sack (Lesser)').profile,'bomb-thorns');
 assert.equal(direction('Pressure Bomb (Lesser)').profile,'bomb-pressure');
 assert.equal(direction('Boulder Seed').profile,'bomb-soft');
});
test('restorative strike separates restoration from physical contact; wind boomerang avoids wooden throw audio',()=>{
 assert.equal(featSoundDirection(PF2E_FEATS.find(f=>f.slug==='restorative-strike')).profile,'restorativeStrike');
 assert.equal(featSoundDirection(PF2E_FEATS.find(f=>f.slug==='aerial-boomerang')).profile,'wind');
});
test('full native cloud, internal-heating and flaming-armory descriptions avoid external attack sounds',()=>{
 for(const [name,motif,profile]of [['Ash Cloud','ashVeil','wind'],['Ashen Wind','ashVeil','wind'],['Mist','mistVeil',''],['Boil Blood','boilingBlood',''],['Blazing Armory','flamingArmory','fireIgnition'],['Uncontrollable Dance','compelledDance','']]){
  const item=PF2E_SPELLS.find(s=>s.name===name),source=nativeSpells.spells.find(r=>r.source._id===item.id).source;
  assert.equal(soundDirection({...item,design:{...item.design,motif}},source).profile,profile,name);
 }
});
const utilityDirection=slug=>{
 const item=PF2E_SPELLS.find(s=>s.slug===slug),source=nativeSpells.spells.find(r=>r.source._id===item.id).source;
 return soundDirection({...item,design:{...item.design,motif:UTILITY_SPELL_DESIGNS[slug][0]}},source);
};
test('utility reinforcement and promised restoration do not masquerade as arrival or immediate healing',()=>{
 assert.equal(utilityDirection('fortify-summoning').profile,'transform');
 assert.equal(utilityDirection('healers-blessing').profile,'bless');
});
test('explicit hook flight and companion pocket departure get their own action-phase cues',()=>{
 assert.equal(utilityDirection('retrieving-hook').profile,'objectWhoosh');
 assert.equal(utilityDirection('pet-cache').profile,'pocketTransition');
});
test('utility sensing, scent, temporary vitality, quiet timers and player speech keep deliberate quiet decisions',()=>{
 for(const slug of ['blindness','deafness','mist-sight','share-vision','object-reading','translate','imprint-message','negate-aroma','verminous-lure','endure','return-the-favor','synchronize','watchdog','liberating-command','the-parrots-whisper','animate-rope','quick-sort','groom-companion']){
  const result=utilityDirection(slug);assert.equal(result.profile,'',slug);
  assert.doesNotMatch(result.reason,/No unambiguous audible effect/,slug+' requires the reviewed domain reason');
 }
});
test('every reviewed quiet utility decision survives a misleading inherited sonic theme',()=>{
 const audible=new Set(['summonFortitude','healerPromise','retrievingHook','companionPocket']);
 for(const [slug,[motif]]of Object.entries(UTILITY_SPELL_DESIGNS)){
  if(audible.has(motif))continue;
  const item=PF2E_SPELLS.find(s=>s.slug===slug),source=nativeSpells.spells.find(r=>r.source._id===item.id).source;
  const result=soundDirection({...item,theme:'sonic',design:{...item.design,motif,damageDice:1}},source);
  assert.equal(result.profile,'',slug);assert.doesNotMatch(result.reason,/No unambiguous audible effect/,slug);
 }
});
test('tiny shooting stars use light-flight semantics despite native fire damage',()=>{
 const item=PF2E_SPELLS.find(s=>s.slug==='spray-of-stars'),source=nativeSpells.spells.find(r=>r.source._id===item.id).source;
 assert.equal(soundDirection({...item,design:{...item.design,motif:'coneStarFan'}},source).profile,'starFlight');
});
