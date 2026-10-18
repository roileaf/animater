import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_WEAPONS,resolveAutomaticWeaponRecipe} from '../../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {weaponRunes,withRuneFlourishes} from '../../../../scripts/catalogs/pf2e/weapons/weapon-runes.mjs';
import {resolveSfAutomaticRecipe,sfCatalogProfile} from '../../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {validateRecipe,planRecipe,MAX_STAGES} from '../../../../scripts/core/model.mjs';
import {MEDIA_DURATIONS} from '../../../../data/media-durations.mjs';
const weapon=slug=>PF2E_WEAPONS.find(w=>w.slug===slug);
const on={enabled:true};
const event=(w,mode,runes)=>({type:'attack',weaponMode:mode,item:{type:'weapon',name:w.name,system:{slug:w.slug,...(runes?{runes}:{})},_stats:{compendiumSource:`Compendium.pf2e.equipment-srd.Item.${w.id}`}}});
const runeStages=r=>r.stages.filter(s=>s.stageId.includes('-rune-'));

test('weaponRunes reads PF2e fundamental and property runes, modern and legacy shapes',()=>{
 assert.deepEqual(weaponRunes({system:{runes:{potency:2,striking:3,property:['greaterFlaming','frost','returning']}}}),{potency:2,striking:3,property:['greaterFlaming','frost','returning']});
 assert.deepEqual(weaponRunes({system:{potencyRune:{value:1},strikingRune:{value:'greaterStriking'},propertyRune1:{value:'shock'},propertyRune2:{value:null}}}),{potency:1,striking:2,property:['shock']});
 assert.deepEqual(weaponRunes({system:{}}),{potency:0,striking:0,property:[]});
 assert.deepEqual(weaponRunes(null),{potency:0,striking:0,property:[]});
});

test('a runeless Strike plays the catalog recipe unchanged',()=>{
 const w=weapon('longsword');
 const plain=resolveAutomaticWeaponRecipe(event(w,'melee'),on);
 assert.deepEqual(resolveAutomaticWeaponRecipe(event(w,'melee',{potency:0,striking:0,property:[]}),on),plain);
 assert.equal(runeStages(plain).length,0);
});

test('property runes add one on-hit element accent each, timed off the weapon contact',()=>{
 const w=weapon('longsword');
 const r=resolveAutomaticWeaponRecipe(event(w,'melee',{potency:0,striking:0,property:['flaming','frost','shock']}),on);
 assert.deepEqual(validateRecipe(r),r);
 const contact=r.stages.find(s=>s.stageId.endsWith('-contact'));
 const added=runeStages(r);
 assert.deepEqual(added.map(s=>s.stageId.split('-rune-')[1]),['flaming','frost','shock']);
 for(const s of added){
  assert.equal(s.kind,'impact');assert.equal(s.requiresHit,true);
  assert.equal(s.afterStage,contact.stageId);assert.equal(s.timingAnchor,'start');
  assert.ok(s.assets.every(k=>k.startsWith('jb2a.')));
 }
 assert.match(added[0].assets[0],/fire/);assert.match(added[1].assets[0],/frost|ice/);assert.match(added[2].assets[0],/lightning/);
 assert.ok(added[1].startOffset>added[0].startOffset,'accents stagger');
 assert.match(added[0].label,/Flaming rune/);
});

test('greater property runes play larger than their base rune; unknown runes add nothing',()=>{
 const w=weapon('longsword');
 const base=runeStages(resolveAutomaticWeaponRecipe(event(w,'melee',{property:['corrosive']}),on))[0];
 const greater=runeStages(resolveAutomaticWeaponRecipe(event(w,'melee',{property:['greaterCorrosive']}),on))[0];
 assert.ok(greater.scale>base.scale);assert.match(greater.label,/Greater corrosive/);
 assert.equal(runeStages(resolveAutomaticWeaponRecipe(event(w,'melee',{property:['madeUpRune','']}),on)).length,0);
 // The same look never doubles (flaming + greater flaming would be invalid PF2e anyway).
 assert.equal(runeStages(resolveAutomaticWeaponRecipe(event(w,'melee',{property:['flaming','greaterFlaming']}),on)).length,1);
});

// Every weapon property rune in PF2e 8.6.1 and SF2e 1.6.1 (identical lists).
const PROPERTY_RUNES=`ancestralEchoing.anchoring.ashen.astral.authorized.bane.bloodbane.bloodthirsty.bolkasBlessing.brilliant.called.coating.conducting.corrosive.crushing.cunning.dancing.deathdrinking.deflecting.decaying.demolishing.disrupting.earthbinding.energizing.energyVulnerability.extending.fanged.fearsome.flaming.flickering.flurrying.frost.ghostTouch.giantKilling.greaterGiantKilling.greaterAnchoring.greaterAshen.greaterAstral.greaterBloodbane.greaterBolkasBlessing.greaterBrilliant.greaterCorrosive.greaterCrushing.greaterDecaying.greaterDisrupting.greaterEnergyVulnerability.greaterExtending.greaterFanged.greaterFearsome.greaterFlaming.greaterFrost.greaterHauling.greaterImpactful.greaterKolssOath.greaterRooting.greaterShock.greaterThundering.greaterTruddsStrength.grievous.hauling.holy.hopeful.hooked.impactful.impossible.keen.kinWarding.kolssOath.majorFanged.majorRooting.merciful.nightmare.pacifying.returning.rooting.serrating.shifting.shock.shockwave.speed.spellStoring.swarming.thundering.truddsStrength.trueRooting.underwater.unholy.vorpal.wounding`.split('.');
const known=key=>Object.hasOwn(MEDIA_DURATIONS,key)||Object.keys(MEDIA_DURATIONS).some(k=>k.startsWith(key+'.'));
test('every PF2e and SF2e property rune has a look made of real JB2A media',()=>{
 assert.equal(PROPERTY_RUNES.length,89);
 const w=weapon('longsword'),looks=new Map();
 for(const slug of PROPERTY_RUNES){
  const [s]=runeStages(resolveAutomaticWeaponRecipe(event(w,'melee',{property:[slug]}),on));
  assert.ok(s,`${slug} adds a stage`);
  // The rune's own lead clip is a measured JB2A key (element runes share the weapon accents).
  assert.ok(known(s.assets[0]),`${slug}: ${s.assets[0]} is a measured JB2A key`);
  const base=s.stageId.split('-rune-')[1];
  looks.set(base,JSON.stringify([s.assets[0],s.tint??null]));
 }
 assert.equal(looks.size,62,'62 base runes');
 // Distinct runes read differently: no two share the same lead clip and tint.
 assert.equal(new Set(looks.values()).size,looks.size,[...looks].filter(([,v],i,all)=>all.findIndex(([,o])=>o===v)!==i).map(([k])=>k).join());
});
test('major and true rune tiers outsize greater ones',()=>{
 const w=weapon('longsword'),scale=slug=>runeStages(resolveAutomaticWeaponRecipe(event(w,'melee',{property:[slug]}),on))[0];
 assert.ok(scale('majorFanged').scale>scale('greaterFanged').scale);assert.match(scale('majorFanged').label,/^Major fanged rune/);
 assert.ok(scale('trueRooting').scale>scale('greaterRooting').scale);
});

test('potency adds a weapon glint and striking enlarges the contact, scaling per tier',()=>{
 const w=weapon('longsword'),plain=resolveAutomaticWeaponRecipe(event(w,'melee'),on);
 const contactScale=r=>r.stages.find(s=>s.stageId.endsWith('-contact')).scale;
 const glint=r=>r.stages.find(s=>s.stageId.endsWith('-rune-potency'));
 const tiers=[1,2,3].map(t=>resolveAutomaticWeaponRecipe(event(w,'melee',{potency:t,striking:t}),on));
 for(const r of tiers)assert.deepEqual(validateRecipe(r),r);
 assert.ok(contactScale(tiers[0])>contactScale(plain));
 assert.ok(contactScale(tiers[1])>contactScale(tiers[0]));assert.ok(contactScale(tiers[2])>contactScale(tiers[1]));
 assert.ok(glint(tiers[0])&&glint(tiers[2]).scale>glint(tiers[0]).scale);
 assert.ok(glint(tiers[2]).opacity>glint(tiers[0]).opacity);
 assert.equal(glint(tiers[0]).requiresHit,true);
 // Striking alone enlarges without a glint.
 const striking=resolveAutomaticWeaponRecipe(event(w,'melee',{striking:2}),on);
 assert.equal(glint(striking),undefined);assert.ok(contactScale(striking)>contactScale(plain));
});

test('ranged Strikes anchor rune accents on the arrival, after the flight',()=>{
 const w=weapon('longbow');
 const r=resolveAutomaticWeaponRecipe(event(w,'ranged',{potency:1,striking:1,property:['shock']}),on);
 const accent=r.stages.find(s=>s.stageId.endsWith('-accent'));
 const [shock]=runeStages(r).filter(s=>s.stageId.endsWith('-rune-shock'));
 assert.equal(shock.afterStage,accent.stageId);
 const plain=resolveAutomaticWeaponRecipe(event(w,'ranged'),on);
 assert.ok(accent.scale>plain.stages.find(s=>s.stageId.endsWith('-accent')).scale);
 const context={source:{id:'s',center:{x:100,y:100}},targets:[{id:'t',center:{x:600,y:100}}],gridSize:100,outcome:'success'};
 const catalog=r.stages.flatMap(s=>s.assets).map(key=>({key}));
 assert.ok(planRecipe(r,catalog,context).some(s=>s.stageId?.endsWith('-rune-shock')));
});

test('rune accents only play on a hit',()=>{
 const w=weapon('longsword');
 const r=resolveAutomaticWeaponRecipe(event(w,'melee',{potency:2,property:['flaming']}),on);
 const catalog=r.stages.flatMap(s=>s.assets).map(key=>({key}));
 const context=outcome=>({source:{id:'s',center:{x:100,y:100}},targets:[{id:'t',center:{x:200,y:100}}],gridSize:100,outcome});
 assert.ok(!planRecipe(r,catalog,context('failure')).some(s=>s.stageId?.includes('-rune-')));
 assert.ok(planRecipe(r,catalog,context('criticalSuccess')).some(s=>s.stageId?.includes('-rune-')));
});

test('rune flourishes can be turned off',()=>{
 const w=weapon('longsword');
 const plain=resolveAutomaticWeaponRecipe(event(w,'melee'),on);
 assert.deepEqual(resolveAutomaticWeaponRecipe(event(w,'melee',{potency:3,striking:3,property:['flaming','holy']}),on,[],{runes:false}),plain);
});

test('saved recipes are never decorated with runes',()=>{
 const w=weapon('longsword');
 const saved=validateRecipe({id:'mine',name:'Mine',trigger:'attack',match:'Longsword',enabled:true,stages:[{kind:'impact',assets:['jb2a.impact.005.white']}]});
 const r=resolveAutomaticWeaponRecipe(event(w,'melee',{potency:3,property:['flaming']}),on,[saved]);
 assert.equal(r.id,'mine');assert.equal(runeStages(r).length,0);
});

test('rune layers stay within the stage limit and keep property runes before the glint',()=>{
 const stages=Array.from({length:MAX_STAGES-2},(_,i)=>({kind:'impact',stageId:i?`x-s${i}`:'x-contact',assets:['jb2a.impact.005.white']}));
 const recipe=validateRecipe({id:'x',name:'X',trigger:'attack',weaponMode:'melee',stages});
 const r=withRuneFlourishes(recipe,{system:{runes:{potency:3,striking:3,property:['flaming','frost','shock']}}});
 assert.equal(r.stages.length,MAX_STAGES);
 assert.deepEqual(runeStages(r).map(s=>s.stageId.split('-rune-')[1]),['flaming','frost']);
 assert.deepEqual(validateRecipe(r),r);
 const full=validateRecipe({...recipe,stages:Array.from({length:MAX_STAGES},(_,i)=>({...stages[0],stageId:i?`x-s${i}`:'x-contact'}))});
 assert.equal(withRuneFlourishes(full,{system:{runes:{property:['flaming']}}}).stages.length,MAX_STAGES);
});

test('recipes with no impact to anchor on are left alone',()=>{
 const recipe=validateRecipe({id:'y',name:'Y',trigger:'attack',stages:[{kind:'motion',stageId:'y-motion',assets:[],motion:'lunge'}]});
 assert.deepEqual(withRuneFlourishes(recipe,{system:{runes:{potency:2,property:['flaming']}}}),recipe);
});

test('SF2e weapon Strikes carry the same rune layer',()=>{
 const entry=sfCatalogProfile.entries('weapon').find(e=>e.variants.some(v=>v.recipe.trigger==='attack'));
 const variant=entry.variants.find(v=>v.recipe.trigger==='attack');
 const ev=runes=>({type:'attack',systemId:'sf2e',weaponMode:variant.weaponMode,itemUuid:entry.uuid,item:{type:'weapon',name:entry.name,system:{slug:entry.slug,...(runes?{runes}:{})}}});
 const stateFor=()=>({enabled:true});
 const plain=resolveSfAutomaticRecipe(ev(),stateFor);
 assert.ok(plain);
 const r=resolveSfAutomaticRecipe(ev({potency:1,striking:1,property:['flaming']}),stateFor);
 assert.ok(runeStages(r).some(s=>s.stageId.endsWith('-rune-flaming')));
 assert.deepEqual(validateRecipe(r),r);
 assert.deepEqual(resolveSfAutomaticRecipe(ev({potency:1,property:['flaming']}),stateFor,[],{runes:false}),plain);
});
