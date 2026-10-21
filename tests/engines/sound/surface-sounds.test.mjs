import test from 'node:test';
import assert from 'node:assert/strict';
import {bodySurface,targetSurface,addSurfaceSounds,blowOf,SURFACE_SOUND_PROFILES} from '../../../scripts/engines/sound/surface-sounds.mjs';
import {planRecipe,validateRecipe} from '../../../scripts/core/model.mjs';
import {PF2E_WEAPONS,weaponRecipe,resolveAutomaticWeaponRecipe} from '../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';

const all=Object.values(SURFACE_SOUND_PROFILES).flatMap(([c])=>c.candidates);
const sounds={resolve:c=>all.find(x=>x.file===c.file)??null};
// No sound pack installed: only Animater's bundled recordings resolve.
const bare={resolve:()=>null};
const actor=(name,{traits=[],armor=null,raised=false}={})=>({name,system:{traits:{value:traits}},wornArmor:armor,attributes:{shield:{raised}}});
const dagger=PF2E_WEAPONS.find(w=>w.slug==='dagger');
const installed=r=>r.stages.flatMap(s=>s.assets??[]).map(key=>({key}));

test('a body sounds like what covers it: metal armour, chitin, bone, stone, else flesh',()=>{
 assert.equal(bodySurface(actor('Valeros',{armor:{group:'plate',category:'heavy'}})),'metal');
 assert.equal(bodySurface(actor('Merisiel',{armor:{group:'leather',category:'light'}})),'leather');
 assert.equal(bodySurface(actor('Solar Glass Golem',{traits:['construct','golem']})),'glass');
 assert.equal(bodySurface(actor('Crystal Xorn',{traits:['earth','elemental']})),'glass');
 assert.equal(bodySurface(actor('Kyra',{armor:{group:'chain',category:'medium'}})),'metal');
 assert.equal(bodySurface(actor('Giant Spider',{traits:['animal']})),'crunch');
 assert.equal(bodySurface(actor('Giant Centipede',{traits:['animal']})),'crunch');
 assert.equal(bodySurface(actor('Skeleton Guard',{traits:['undead','skeleton','mindless']})),'crunch');
 assert.equal(bodySurface(actor('Stone Golem',{traits:['construct','golem','mindless']})),'stone');
 assert.equal(bodySurface(actor('Clockwork Soldier',{traits:['construct','clockwork']})),'metal');
 assert.equal(bodySurface(actor('Goblin Warrior',{traits:['goblin','humanoid']})),'flesh');
 assert.equal(bodySurface(actor('Treant',{traits:['plant','wood']})),'crunch');
 assert.equal(bodySurface(actor('Animated Armor',{traits:['construct','mindless']})),'metal');
 // Bestiary misreads, corrected: flesh golems give, bone constructs crack, machines clang, salamanders are solid.
 assert.equal(bodySurface(actor('Flesh Golem',{traits:['construct','golem','mindless']})),'flesh');
 assert.equal(bodySurface(actor('Floating Femur',{traits:['construct','mindless']})),'crunch');
 assert.equal(bodySurface(actor('Murderous Mannequin',{traits:['construct']})),'crunch');
 assert.equal(bodySurface(actor('Mechanical Laborer',{traits:['construct','earth','mindless']})),'metal');
 assert.equal(bodySurface(actor('Clay Golem',{traits:['construct','golem','mindless']})),'stone');
 assert.equal(bodySurface(actor('Salamander',{traits:['elemental','fire']})),'flesh');
 assert.equal(bodySurface(actor('Living Whirlwind',{traits:['air','elemental']})),null);
 assert.equal(bodySurface(actor('Brine Dragon (Adult)',{traits:['dragon','elemental','water']})),'flesh');
 assert.equal(bodySurface(actor('Kyra',{armor:{group:'ceramic',category:'medium'}})),'crunch');
 assert.equal(bodySurface(actor('Animated Broom',{traits:['construct','mindless']})),'crunch');
 // A stat block's armour counts though it is not equipped.
 assert.equal(bodySurface({name:'Akiros Ismort',type:'npc',system:{traits:{value:['human']}},itemTypes:{armor:[{category:'heavy',group:'chain',isEquipped:false}]}}),'metal');
 assert.equal(bodySurface({name:'Orc Scrapper',type:'npc',system:{traits:{value:['orc']}},itemTypes:{armor:[{category:'medium',group:'leather',isEquipped:false}]}}),'leather');
 assert.equal(bodySurface(actor('Ranger',{armor:{group:'wood',category:'medium'}})),'crunch');
 assert.equal(bodySurface(actor('Gelatinous Cube',{traits:['ooze','mindless']})),'squish');
 assert.equal(bodySurface(actor('Water Elemental',{traits:['elemental','water']})),'squish');
 // Nothing solid to strike: a ghost, living flame.
 assert.equal(bodySurface(actor('Ghost',{traits:['undead','incorporeal','spirit']})),null);
 assert.equal(bodySurface(actor('Fire Elemental',{traits:['elemental','fire']})),null);
 assert.equal(targetSurface(actor('Ghost',{traits:['incorporeal']}),'success'),null);
 // "ant" is a word, not a fragment: a giant is not an insect.
 assert.equal(bodySurface(actor('Hill Giant',{traits:['giant','humanoid']})),'flesh');
});
test('a hit sounds on the body, a miss on a raised shield clangs off it, any other miss is silent',()=>{
 const knight=actor('Knight',{armor:{group:'plate',category:'heavy'},raised:true});
 assert.equal(targetSurface(knight,'success'),'metal');
 assert.equal(targetSurface(knight,'criticalSuccess'),'metal');
 assert.equal(targetSurface(knight,'failure'),'shield');
 assert.equal(targetSurface(actor('Goblin'),'failure'),null);
 assert.equal(targetSurface(actor('Goblin'),undefined),null);
});
test('the same dagger sounds different on a spider and on an armoured ally',()=>{
 const recipe=weaponRecipe(dagger,'melee',{soundCatalog:sounds});
 const cue=recipe.stages.find(s=>s.surfaces);
 assert.ok(cue,'the contact has a surface cue');
 assert.equal(cue.subject,'targets');
 for(const surface of ['flesh','leather','metal','shield','crunch','stone','glass','squish','ward'])assert.ok(cue.surfaces[surface]?.length,surface);
 const spider={id:'spider',name:'Giant Spider',actor:actor('Giant Spider',{traits:['animal']})},ally={id:'ally',name:'Valeros',actor:actor('Valeros',{armor:{group:'plate',category:'heavy'}})};
 const surfaceOf=(token,outcome)=>targetSurface(token.actor,outcome);
 const fileOn=(target,outcome='success')=>planRecipe(recipe,installed(recipe),{source:{id:'me'},targets:[target],outcome,surfaceOf,gridSize:100,random:()=>0}).find(s=>s.surfaces)?.soundFile;
 assert.ok(cue.surfaces.crunch.some(x=>x.file===fileOn(spider)));
 assert.ok(cue.surfaces.metal.some(x=>x.file===fileOn(ally)));
 assert.notEqual(fileOn(spider),fileOn(ally));
 assert.equal(fileOn(spider,'failure'),undefined,'a plain miss is silent');
});
test('previews play the flesh recording; no surface cue for bombs, without sounds, or when switched off',()=>{
 const recipe=weaponRecipe(dagger,'melee',{soundCatalog:sounds}),cue=recipe.stages.find(s=>s.surfaces);
 const preview=planRecipe(recipe,installed(recipe),{source:{id:'me'},targets:[{id:'t'}],preview:true,gridSize:100}).find(s=>s.surfaces);
 assert.ok(cue.surfaces.flesh.some(x=>x.file===preview.soundFile));
 assert.equal(weaponRecipe(dagger,'melee',{soundCatalog:sounds,surfaceSound:false}).stages.some(s=>s.surfaces),false);
 assert.equal(weaponRecipe(dagger,'melee',{}).stages.some(s=>s.surfaces),false);
 assert.equal(blowOf({damage:'fire',payload:{style:'splash'}}),null);
 assert.equal(addSurfaceSounds(dagger,[],{sounds,mode:{damage:'piercing'},anchor:null}).length,0);
 // A saved copy keeps its surfaces through validation.
 assert.deepEqual(validateRecipe(recipe).stages.find(s=>s.surfaces).surfaces,cue.surfaces);
});
test('the weapon catalog switch turns surface sounds off',()=>{
 const event={type:'attack',item:{type:'weapon',uuid:`Compendium.pf2e.equipment-srd.Item.${dagger.id}`,name:'Dagger',system:{slug:'dagger'}},weaponMode:'melee'};
 const state={enabled:true,scope:'all',independent:true,preferCatalog:true};
 const on=resolveAutomaticWeaponRecipe(event,state,[],{soundCatalog:sounds,runes:false}),off=resolveAutomaticWeaponRecipe(event,{...state,surfaceSound:false},[],{soundCatalog:sounds,runes:false});
 assert.ok(on.stages.some(s=>s.surfaces));
 assert.equal(off.stages.some(s=>s.surfaces),false);
});

test('without any sound pack, every surface but an ooze still sounds from the bundled recordings',()=>{
 const cue=weaponRecipe(dagger,'melee',{soundCatalog:bare}).stages.find(s=>s.surfaces);
 for(const surface of ['flesh','leather','metal','shield','crunch','stone','glass','ward'])assert.ok(cue.surfaces[surface]?.every(x=>x.file.startsWith('modules/animater/assets/sounds/surfaces/')),surface);
 assert.equal(cue.surfaces.squish,undefined);
});
test('each hit varies slightly in pitch and loudness',()=>{
 const recipe=weaponRecipe(dagger,'melee',{soundCatalog:sounds}),ally={id:'ally',actor:actor('Valeros',{armor:{group:'plate',category:'heavy'}})};
 const plan=r=>planRecipe(recipe,installed(recipe),{source:{id:'me'},targets:[ally],outcome:'success',surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random:()=>r}).find(s=>s.surfaces);
 const low=plan(0),high=plan(.99);
 assert.ok(low.pitch>=.92&&high.pitch<=1.08&&low.pitch<high.pitch);
 assert.ok(low.volume<high.volume);
});

test("magical protection: a wizard's Shield rings on a miss, Mystic Armor on a hit; real plate still clangs",()=>{
 const wizard=(...slugs)=>({...actor('Ezren',{armor:null}),itemTypes:{armor:[],effect:slugs.map(slug=>({slug}))}});
 assert.equal(targetSurface(wizard('spell-effect-shield'),'failure'),'ward');
 assert.equal(targetSurface(wizard('spell-effect-shield'),'success'),'flesh');
 assert.equal(targetSurface(wizard('spell-effect-mystic-armor'),'success'),'ward');
 assert.equal(targetSurface(wizard('spell-effect-glass-shield'),'failure'),'glass');
 assert.equal(targetSurface(wizard('spell-effect-armor-of-bones'),'success'),'crunch');
 assert.equal(targetSurface(wizard('spell-effect-stoneskin'),'criticalSuccess'),'stone');
 assert.equal(targetSurface(wizard('effect-rage'),'failure'),null);
 const paladin={...actor('Seelah',{armor:{group:'plate',category:'heavy'}}),itemTypes:{armor:[],effect:[{slug:'spell-effect-protection'}]}};
 assert.equal(targetSurface(paladin,'success'),'metal');
});

test(`stat-block armour: padded and clothes sound like leather; a stat block's "with mage armor" is not an active spell; illusions are silent`,()=>{
 // "AC 21 with mage armor": the AC once she casts it. Only an active spell effect counts.
 assert.equal(targetSurface({name:'Voz Lirayne',type:'npc',system:{traits:{value:['human','humanoid']},attributes:{ac:{details:'21 with mage armor'}}},itemTypes:{armor:[],effect:[]}},'success'),'flesh');
 const npc=(name,armor,details='',traits=['human','humanoid'])=>({name,type:'npc',system:{traits:{value:traits},attributes:{ac:{details}}},itemTypes:{armor,effect:[]}});
 assert.equal(bodySurface(npc('Pirate',[{category:'light',group:null,isEquipped:false}])),'leather');
 assert.equal(bodySurface(npc('Juggernaut',[{category:'heavy',group:null,isEquipped:false}])),'metal');
 assert.equal(bodySurface(npc('Phantasmal Protagonist',[],'',['illusion','mental'])),null);
 assert.equal(bodySurface(npc('Storm Lord',[],'',['air','elemental'])),null);
 assert.equal(bodySurface(npc('Air Mephit',[],'',['air','elemental'])),'flesh');
});
