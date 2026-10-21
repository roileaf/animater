import test from 'node:test';
import assert from 'node:assert/strict';
import {bodySurface,targetSurface,withSurfaceSounds,blowOfItem,surfaceAnchor,sizeOf,heftOfItem} from '../../../scripts/engines/sound/surface-sounds.mjs';
import {DND5E_ENTRIES,dndRecipe} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {dhEntries,dhRecipe} from '../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs';
import {SF2E_ENTRIES,sfRecipe} from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {dnd5eTargetOutcomes,withOutcome} from '../../../scripts/systems/outcome.mjs';
import {planRecipe} from '../../../scripts/core/model.mjs';
import {mixSurfaceSound} from '../../../scripts/engines/sound/sound-pitch.mjs';

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
 assert.equal(bodySurface(dnd('Shambling Mound',{type:'plant'})),'wood');
 assert.equal(bodySurface(dnd('Fire Elemental',{type:'elemental'})),null);
 assert.equal(bodySurface(dnd('Earth Elemental',{type:'elemental'})),'stone');
 assert.equal(bodySurface(dnd('Water Elemental',{type:'elemental'})),'squish');
 assert.equal(bodySurface(dnd('Adult Red Dragon',{type:'dragon'})),'flesh');
});
test('D&D 5e protection: a shield blocks a miss, the Shield spell rings, Mage Armor is a ward on a bare body',()=>{
 assert.equal(targetSurface(dnd('Fighter',{armor:['Chain Mail','heavy'],shield:true}),'failure'),'shield');
 assert.equal(targetSurface(dnd('Wizard',{effects:['Shield']}),'failure'),'ward');
 assert.equal(targetSurface(dnd('Wizard',{calc:'mage'}),'success'),'ward');
 assert.equal(targetSurface(dnd('Druid',{effects:['Barkskin']}),'success'),'wood');
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
 assert.equal(blowOfItem({name:'Staff',system:{}},{family:'magic'}),'spell');
 // Bows and crossbows loose arrows, firearms bullets, in every system; attack spells are spells.
 assert.equal(blowOfItem({type:'weapon',system:{group:'bow',damage:{damageType:'piercing'},range:{increment:60}}},{family:'bow'}),'arrow');
 assert.equal(blowOfItem({type:'weapon',system:{type:{value:'martialR',baseItem:'longbow'},range:{value:150},damage:{base:{types:new Set(['piercing'])}}}}),'arrow');
 assert.equal(blowOfItem({type:'weapon',system:{type:{value:'martialR',baseItem:'pistol'},range:{value:30},damage:{base:{types:new Set(['piercing'])}}}}),'bullet');
 assert.equal(blowOfItem({name:'Hunting Rifle',system:{}},{family:'firearm'}),'bullet');
 assert.equal(blowOfItem({type:'spell',system:{}}),'spell');
 // A bow used to club someone is a blunt blow: no range, no arrow.
 assert.equal(blowOfItem({type:'weapon',system:{type:{value:'simpleM',baseItem:'club'},damage:{base:{types:new Set(['bludgeoning'])}}}}),'blunt');
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

test('every hit echoes, rolled anew; a shield or a ward rings longest, and the cue lasts for its tail',()=>{
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'blade',sounds}),cue=recipe.stages.find(s=>s.surfaces);
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 const fighter={id:'f',actor:dnd('Fighter',{armor:['Chain Mail','heavy'],shield:true})},wizard={id:'w',actor:dnd('Wizard',{effects:['Shield']})};
 const cueOn=(target,outcome)=>planRecipe(recipe,installed,{source:{id:'me'},targets:[target],outcome,surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random:()=>0}).find(s=>s.surfaces);
 const block=cueOn(fighter,'failure'),ward=cueOn(wizard,'failure'),hit=cueOn(fighter,'success');
 // Every hit rings in some space; a shield's slap-back and a ward's shimmer ring longest.
 assert.ok(block.echo&&ward.echo&&hit.echo);
 assert.ok(ward.echo.delay>block.echo.delay,'a ward rings longer than a shield');
 // The echo stays under the blow: its first repeat at most a third as loud, and it fades fast.
 for(const e of [block.echo,ward.echo,hit.echo])assert.ok(e.wet<=.3&&e.feedback<=.35);
 assert.ok(hit.echo.wet<block.echo.wet,'a body gives only a hint of room');
 assert.ok(block.duration>cue.surfaces.shield[0].duration,'the tail is not cut');
});

test('flesh bleeds: a hit on flesh adds a blood layer just after the blow; armour does not',()=>{
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'blade',sounds});
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 const plan=(actor,random=()=>.5)=>planRecipe(recipe,installed,{source:{id:'me'},targets:[{id:'t',actor}],outcome:'success',surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random}).filter(s=>s.surfaces);
 const flesh=plan(dnd('Commoner')),plate=plan(dnd('Knight',{armor:['Plate Armor','heavy']}));
 assert.equal(flesh.length,2);assert.ok(/blood-/.test(flesh[1].soundFile));assert.ok(flesh[1].delay>flesh[0].delay);
 assert.equal(plate.length,1);
});

test('arrows, bullets and spells each sound their own way',async()=>{
 const {PF2E_WEAPONS,weaponRecipe}=await import('../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs');
 const bow=PF2E_WEAPONS.find(w=>w.slug==='longbow'),bowCue=weaponRecipe(bow,'ranged',{soundCatalog:sounds}).stages.find(s=>s.surfaces);
 assert.equal(bowCue.blow,'arrow');assert.ok(bowCue.surfaces.wood.some(x=>/arrow-wood/.test(x.file)));
 const gun=PF2E_WEAPONS.find(w=>w.modes.some(m=>m.family==='firearm'&&m.mode==='ranged'));
 const gunCue=weaponRecipe(gun,'ranged',{soundCatalog:sounds}).stages.find(s=>s.surfaces);
 assert.equal(gunCue.blow,'bullet');assert.ok(gunCue.surfaces.metal.some(x=>/bullet-metal|ricochet/.test(x.file)));
 // A spell keeps its own impact: it rings on a ward or metal, and adds nothing on flesh.
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'spell',sounds}),cue=recipe.stages.find(s=>s.surfaces);
 assert.ok(cue.surfaces.ward&&cue.surfaces.metal&&!cue.surfaces.flesh);
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 const on=(actor,outcome)=>planRecipe(recipe,installed,{source:{id:'me'},targets:[{id:'t',actor}],outcome,surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random:()=>0}).filter(s=>s.surfaces&&s.stageId.endsWith('-surface'));
 assert.equal(on(dnd('Commoner'),'success').length,0);
 assert.equal(on(dnd('Knight',{armor:['Plate Armor','heavy']}),'success').length,1);
 assert.equal(on(dnd('Wizard',{effects:['Shield']}),'failure').length,1);
});

test('each element meets a surface its own way: fire sizzles, lightning zaps, cold cracks, acid hisses',()=>{
 // The element comes from the cast (the chosen element) or the spell's damage, in any system.
 assert.equal(blowOfItem({type:'spell',system:{damage:{a:{type:'fire'}}}}),'fire');
 assert.equal(blowOfItem({type:'spell',system:{damage:{parts:[{types:new Set(['lightning'])}]}}}),'electricity');
 assert.equal(blowOfItem({type:'spell',system:{}},{element:'cold'}),'cold');
 assert.equal(blowOfItem({type:'spell',system:{damage:{a:{type:'acid'}}}}),'acid');
 assert.equal(blowOfItem({type:'spell',system:{damage:{a:{type:'force'}}}}),'spell');
 const ls=longsword(),base=dndRecipe(ls,ls.variants[0].id,{sounds});
 const cueOf=blow=>withSurfaceSounds(base,{blow,sounds}).stages.find(s=>s.surfaces);
 const file=(blow,surface)=>cueOf(blow).surfaces[surface].map(x=>x.file).join(' ');
 assert.match(file('fire','flesh'),/fire-(sear|burst)/);
 assert.match(file('electricity','flesh'),/electric-arc/);
 assert.match(file('electricity','metal'),/electric-arc/);
 assert.match(file('cold','flesh'),/frost-crack/);
 assert.match(file('acid','metal'),/acid-fizz/);
 assert.match(file('fire','ward'),/ward-chime/);
 // Unlike a plain spell, an element is heard on a bare body.
 const recipe=withSurfaceSounds(base,{blow:'fire',sounds}),installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 assert.equal(planRecipe(recipe,installed,{source:{id:'me'},targets:[{id:'t',actor:dnd('Commoner')}],outcome:'success',surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random:()=>0}).filter(s=>s.surfaces&&s.stageId.endsWith('-surface')).length,1);
});

test('Starfinder guns: projectiles are bullets, energy weapons their element, grenades have no single blow; Daggerheart cards are spells',()=>{
 const gun=(group,type)=>({type:'weapon',system:{group,damage:{damageType:type},range:{increment:60}}});
 assert.equal(blowOfItem(gun('projectile','piercing')),'bullet');
 assert.equal(blowOfItem(gun('sniper','piercing')),'bullet');
 assert.equal(blowOfItem(gun('laser','fire')),'fire');
 assert.equal(blowOfItem(gun('shock','electricity')),'electricity');
 assert.equal(blowOfItem(gun('cryo','cold')),'cold');
 assert.equal(blowOfItem(gun('corrosive','acid')),'acid');
 assert.equal(blowOfItem(gun('sonic','sonic')),'spell');
 assert.equal(blowOfItem(gun('grenade','piercing')),null);
 assert.equal(blowOfItem({type:'domainCard',name:'Book of Ava',system:{}}),'spell');
});

test('the engine layers each hit: a layer by its chance, every layer on a crit, timed after the blow, never the same sound twice running',()=>{
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'fire',sounds});
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 const plan=(outcome,random)=>planRecipe(recipe,installed,{source:{id:'me'},targets:[{id:'t',actor:dnd('Commoner')}],outcome,surfaceOf:(t,o)=>targetSurface(t.actor,o),gridSize:100,random}).filter(s=>s.surfaces);
 // Dice high: the flame burst (70%) does not fire on a plain hit, but a critical hit plays every layer.
 assert.equal(plan('success',()=>.99).length,1);
 const crit=plan('criticalSuccess',()=>.99);
 assert.equal(crit.length,2);assert.ok(/fire-burst/.test(crit[1].soundFile));
 assert.ok(crit[1].delay>=crit[0].delay,'a layer lands after the blow');
 // Ten hits in a row never repeat the previous recording.
 let last=null,seq=0;
 for(let i=0;i<10;i++){const r=()=>{seq=(seq*9301+49297)%233280;return seq/233280;};const cue=plan('success',r)[0];assert.notEqual(cue.soundFile,last);last=cue.soundFile;}
});

test('a big body and a heavy weapon land lower; size comes from the system or the token',()=>{
 assert.equal(sizeOf({size:'huge'}),2);
 assert.equal(sizeOf({system:{traits:{size:'tiny'}}}),-2);
 assert.equal(sizeOf({},{document:{width:3}}),2);
 assert.equal(sizeOf({},{document:{width:0.5}}),-2);
 assert.equal(heftOfItem({system:{properties:new Set(['hvy','two'])}}),'heavy');
 assert.equal(heftOfItem({system:{traits:{value:['agile','finesse']}}}),'light');
 assert.equal(heftOfItem({system:{burden:'twoHanded'}}),'heavy');
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'blade',sounds,heft:'heavy'});
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key}));
 const cue=size=>planRecipe(recipe,installed,{source:{id:'me'},targets:[{id:'t',actor:dnd('Ogre')}],outcome:'success',surfaceOf:(t,o)=>targetSurface(t.actor,o),sizeOf:()=>size,gridSize:100,random:()=>.5}).find(s=>s.stageId.endsWith('-surface'));
 assert.ok(cue(2).pitch<cue(0).pitch&&cue(0).pitch<cue(-2).pitch,'huge lower than medium, medium lower than tiny');
});
test('a busy moment keeps at most six surface sounds on this client, and drops layers first',()=>{
 const ls=longsword(),recipe=withSurfaceSounds(dndRecipe(ls,ls.variants[0].id,{sounds}),{blow:'blade',sounds});
 const installed=recipe.stages.flatMap(s=>s.assets??[]).map(key=>({key})),voices=[];let clock=1000;
 const hit=()=>planRecipe(recipe,installed,{source:{id:'me'},targets:[{id:'t',actor:dnd('Commoner')}],outcome:'criticalSuccess',surfaceOf:(t,o)=>targetSurface(t.actor,o),voices,now:()=>clock,gridSize:100,random:()=>.5}).filter(s=>s.surfaces);
 const counts=Array.from({length:8},()=>hit().length);
 assert.equal(counts[0],2,'a crit on flesh: the cue and its blood');
 assert.equal(counts[3],1,'past three, layers drop');
 assert.equal(counts[6],0,'past six, nothing more');
 clock+=5000;assert.equal(hit().length,2,'once they have played, it sounds again');
});
test("each player's mix: their level, how much blood, how much echo",()=>{
 const cue=()=>({volume:.8,animaterSurface:'cue',animaterEcho:{wet:.2}}),blood=()=>({volume:.6,animaterSurface:'blood'});
 assert.equal(mixSurfaceSound(cue(),{volume:.5,gore:'full',echo:1}).volume,.4);
 assert.equal(mixSurfaceSound(blood(),{volume:1,gore:'off',echo:1}).volume,0);
 assert.ok(Math.abs(mixSurfaceSound(blood(),{volume:1,gore:'subtle',echo:1}).volume-.24)<1e-9);
 assert.equal(mixSurfaceSound(cue(),{volume:1,gore:'full',echo:0}).animaterEcho.wet,0);
 // Other sounds are never touched.
 assert.equal(mixSurfaceSound({volume:.7},{volume:0,gore:'off',echo:0}).volume,.7);
});

test('containers, scenery and traps sound like what they are made of',()=>{
 const thing=(name,type,traits=[])=>bodySurface({name,type,system:{traits:{value:traits}},items:[]});
 assert.equal(thing('Altar','loot'),'stone');assert.equal(thing('Coffin','loot'),'wood');assert.equal(thing('Iron Chest','loot'),'metal');
 assert.equal(thing('Rat Nest','loot'),'leather');assert.equal(thing('Falling Shelves','hazard',['trap']),'wood');
 assert.equal(thing('Poison Dart Trap','hazard',['trap']),'stone');assert.equal(thing('Spectral Choir','hazard',['haunt']),null);
});
