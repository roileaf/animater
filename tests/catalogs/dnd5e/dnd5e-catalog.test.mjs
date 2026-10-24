import test from 'node:test';
import assert from 'node:assert/strict';
import {dndEntries,dndRecipe,useDndEntry,dndVariantForEvent,resolveDndAutomaticRecipe,findDndEntry,filterDndEntries} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {catalogNavigation,catalogPageAllowed} from '../../../scripts/catalogs/shared/catalog-system.mjs';
import {dnd5eEvent} from '../../../scripts/systems/adapters.mjs';
import {planRecipe,validateRecipe,matchRecipe} from '../../../scripts/core/model.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
import {dndActorStates,findDndState,dndStateVisible,resolveDndStateRecipe} from '../../../scripts/catalogs/dnd5e/dnd5e-states.mjs';
import {nativeDirection,weaponModes,weaponVisualFamily} from '../../../tools/dnd5e-directions.mjs';
import {ABILITY_SOUND_PROFILES} from '../../../data/ability-sounds.mjs';
const find=(name,kind='spell',edition='2024')=>dndEntries(kind).find(e=>e.name===name&&e.edition===edition);
const context={source:{id:'caster',center:{x:0,y:0},w:100,h:100},targets:Array.from({length:5},(_,i)=>({id:'target-'+i,center:{x:200+i*200,y:200},w:100,h:100})),gridSize:100,template:{id:'template'},area:{type:'cone',center:{x:0,y:0},endpoint:{x:400,y:0},length:400,angle:90,width:100,diameter:400}};
test('catalog navigation shows only the native world system, including direct page guards',()=>{
 for(const systemId of ['pf2e','dnd5e']){const nav=catalogNavigation({systemId});assert.equal(nav.length,systemId==='pf2e'?8:7);assert.ok(nav.every(([, ,label])=>label.startsWith(systemId==='pf2e'?'PF2e':'D&D 5e')));}
 assert.equal(catalogPageAllowed('items',{systemId:'pf2e'}),false);
 assert.deepEqual(catalogNavigation({systemId:'unsupported'}),[]);assert.equal(catalogPageAllowed('spells',{systemId:'unsupported'}),false);
 for(const edition of ['2014','2024'])assert.equal(filterDndEntries('condition',{edition}).length,44,'shared native conditions remain visible in either rules edition');
});
test('all D&D entries validate and have real Free and Patreon fallbacks, with motion independently removable',async()=>{
 const db=await assetDatabases();assert.ok(dndEntries('spell').length>=650);assert.ok(dndEntries('feat').length>=560);assert.ok(dndEntries('condition').length>=14);
 for(const e of dndEntries())for(const v of e.variants){const r=dndRecipe(e,v.id);assert.equal(r.systemId,'dnd5e');assert.equal(r.catalogEntry,e.id);validateRecipe(r);assert.ok(r.stages.every(s=>s.kind!=='motion'||s.duration>=1000));dndRecipe(e,v.id,{motion:false});
  const area=e.variants.find(x=>x.id===v.id)?.recipe.previewArea;const c={...context,area:area?.type==='line'?{...context.area,type:'line'}:area?.type==='cone'?context.area:{center:{x:200,y:0},diameter:400}};
  for(const rows of Object.values(db))assert.ok(planRecipe(r,rows,c).length,e.name+' '+v.label);
 }
});
test('D&D Chain Lightning forks from primary target and never fires a self-directed primary loop',async()=>{
 const r=dndRecipe(find('Chain Lightning')),db=await assetDatabases();const arcs=planRecipe(r,db.patreon,context).filter(s=>s.kind==='travel');
 assert.equal(arcs.length,4);assert.equal(arcs[0].origin,context.source);assert.equal(arcs[0].destination,context.targets[0]);
 for(const arc of arcs.slice(1)){assert.equal(arc.origin,context.targets[0]);assert.notEqual(arc.destination,context.targets[0]);}
 assert.equal(planRecipe(r,db.free,{...context,targets:context.targets.slice(0,1)}).filter(s=>s.kind==='travel').length,1);
});
test('Magic Missile distributes three total darts and upcasting adds total darts, while Eldritch Blast fires one per attack',async()=>{
 const e=find('Magic Missile'),v=e.variants[0],state=useDndEntry({},e.id),item={type:'spell',name:e.name,_stats:{compendiumSource:e.uuid},system:{level:3}};
 const r=resolveDndAutomaticRecipe({type:v.recipe.trigger,systemId:'dnd5e',item,activityId:v.activityId,spellLevel:3},()=>state),db=await assetDatabases();
 assert.equal(planRecipe(r,db.patreon,context).filter(s=>s.kind==='travel').length,5);
 const darts=planRecipe(r,db.patreon,context).filter(s=>s.kind==='travel');assert.equal(new Set(darts.map(s=>s.delay)).size,1,'native darts launch together');
 const contacts=planRecipe(r,db.patreon,context).filter(s=>s.kind==='impact');assert.equal(contacts.length,5);assert.equal(new Set(contacts.map(s=>s.delay)).size,1,'native darts share contact timing');
 assert.equal(planRecipe(dndRecipe(find('Eldritch Blast')),db.free,context).filter(s=>s.kind==='travel'&&s.destination===context.targets[0]).length,1);
});

test('reviewed status colors, actual weapon footage and native follow-up locality survive generation',()=>{
 const dagger=find('Dagger','weapon'),bow=find('Longbow','weapon');
 assert.ok(dagger.variants.find(v=>v.weaponMode==='thrown').recipe.stages.find(s=>s.kind==='travel').assets.every(k=>/dagger|kunai/.test(k)));
 assert.ok(bow.variants.find(v=>v.weaponMode==='ranged').recipe.stages.find(s=>s.kind==='travel').assets.every(k=>/arrow\.physical/.test(k)));
 assert.equal(find('Antimagic Field').theme,'dispel');
 const chill=find('Chill Touch','spell','2014');assert.ok(chill.reviewed);assert.equal(chill.variants[0].recipe.stages.some(s=>s.kind==='travel'),false);
 const poisoned=dndEntries('condition').find(e=>e.statusId==='poisoned');assert.ok(poisoned.variants[0].recipe.stages[0].assets.every(k=>k.includes('green')));
});

test('native enchanted attacks preserve actual active damage parts without lighting their ordinary attack',()=>{
 const entry=find('Flame Tongue Longsword','weapon','2014');assert.ok(entry);
 const plain=entry.variants.find(v=>v.weaponMode==='melee'&&!/Flaming/i.test(v.label)),flaming=entry.variants.find(v=>v.weaponMode==='melee'&&/Flaming/i.test(v.label));
 assert.ok(plain&&flaming);assert.equal(plain.recipe.stages.some(s=>s.label==='Native magical material'),false);
 assert.ok(flaming.recipe.stages.some(s=>s.label==='Native magical material'&&s.assets.some(k=>/fire|orange/.test(k))));
 assert.equal(flaming.soundProfile,'enchanted-sword-fire');assert.equal(plain.soundProfile,'sword');
 const energy=find('Energy Bow','weapon');assert.ok(energy.variants.some(v=>v.weaponMode==='ranged'));assert.ok(energy.variants.every(v=>v.recipe.trigger==='manual'&&v.recipe.playbackRoles.reason.includes('base weapon')));
 const holy=find('Holy Avenger','weapon');assert.ok(holy.variants.filter(v=>v.weaponMode).every(v=>!v.recipe.stages.some(s=>s.label==='Native magical material')),'zero-valued conditional radiant rider stays out of ordinary attacks');
 const wall=find('Prismatic Wall');assert.ok(wall.variants.filter(v=>v.recipe.previewArea).every(v=>v.recipe.stages.filter(s=>s.kind==='template').length===7));
});

test('D&D physical bases keep their weapon shape and natural energy attacks use thematic footage and sound',()=>{
 for(const [base,family]of [['longsword','sword'],['lighthammer','hammer'],['trident','spear'],['warpick','pick']])assert.equal(weaponVisualFamily({name:base,system:{type:{baseItem:base}}}),family);
 const sword=find('Flame Tongue Longsword','weapon','2014');
 for(const v of sword.variants.filter(v=>v.weaponMode==='melee'))assert.ok(v.recipe.stages.find(s=>s.label==='Physical contact').assets.every(k=>/sword|slashing|slash/.test(k)),'longsword is never bludgeoning footage');
 for(const name of ['Necrotic Ray','Force Bolt','Poison Ray']){
  const entry=find(name,'weapon');assert.ok(entry,name);
  for(const v of entry.variants.filter(v=>v.weaponMode==='ranged')){assert.equal(v.soundNamespace,'spell');assert.ok(!['ranged','sword','unarmed'].includes(v.soundProfile));assert.ok(v.recipe.stages.find(s=>s.kind==='travel').assets.every(k=>!k.includes('arrow.physical')));}
 }
 for(const name of ['Boulder','Rock','Rock Launch']){const entry=find(name,'weapon');assert.ok(entry,name);for(const v of entry.variants.filter(v=>v.weaponMode==='ranged'))assert.ok(v.recipe.stages.find(s=>s.kind==='travel').assets.some(k=>k.includes('boulder')),name+' uses thrown stone footage');}
 for(const entry of dndEntries('item').filter(e=>/^(Acid|Alchemist's Fire|Oil)( \((vial|flask)\))?$/.test(e.name)))for(const v of entry.variants.filter(v=>v.recipe.stages.some(s=>s.kind==='travel'))){
  assert.equal(v.soundNamespace,'spell');assert.ok(!['sword','dagger','unarmed'].includes(v.soundProfile),entry.name+' sound matches payload');
  assert.ok(v.recipe.stages.find(s=>s.kind==='travel').assets.every(k=>k.includes('throwable.throw.flask')));
 }
});
test('D&D native activity and selected attack mode pick melee versus thrown without replaying on use or damage',()=>{
 const e=find('Dagger','weapon'),state=useDndEntry({},e.id),item={type:'weapon',name:e.name,_stats:{compendiumSource:e.uuid}},subject={id:e.variants[0].activityId,item,attack:{type:{value:'melee'}}};
 for(const [native,expected]of [['oneHanded','melee'],['thrownTwoHanded','thrown']]){const event=dnd5eEvent('attack',subject,{rolls:[{options:{attackMode:native}}]});const r=resolveDndAutomaticRecipe(event,()=>state);assert.equal(r.weaponMode,expected);}
 assert.equal(resolveDndAutomaticRecipe(dnd5eEvent('use',subject),()=>state),null);assert.equal(resolveDndAutomaticRecipe(dnd5eEvent('damage',subject),()=>state),null);
 assert.equal(dndVariantForEvent(e,{type:'attack',activityId:'unknown',activityName:'unknown',weaponMode:'thrown'}),null);
});

test('every eligible D&D weapon release/contact/material cue has an actual synchronized sound stage',()=>{
 const sounds={resolve:c=>c};
 for(const entry of dndEntries('weapon'))for(const variant of entry.variants){
  if(variant.soundNamespace!=='ability')continue;
  const recipe=dndRecipe(entry,variant.id,{sounds}),audio=recipe.stages.filter(s=>s.kind==='sound');
  for(const cue of ABILITY_SOUND_PROFILES[variant.soundProfile]??[]){
   if(variant.soundExcludeRoles?.includes(cue.role))continue;
   const hasAnchor=cue.role==='release'?recipe.stages.some(s=>s.kind==='travel'||s.kind==='projectile'):['contact','impact'].includes(cue.role)?recipe.stages.some(s=>s.kind==='impact'):false;
   // Bespoke designs may choose a closer sound profile (e.g. natural piercing for a beak); they still need audio.
   if(hasAnchor)assert.ok(recipe.bespoke?audio.length:audio.some(s=>s.label.startsWith(cue.label)),entry.name+' / '+variant.label+' / '+cue.label);
  }
  for(const cue of audio){const anchor=recipe.stages.find(s=>s.stageId===cue.afterStage);assert.ok(anchor);assert.equal(cue.timingAnchor,'start');}
 }
 const dagger=find('Dagger','weapon');assert.equal(dndRecipe(dagger,dagger.variants.find(v=>v.weaponMode==='melee').id,{sounds}).stages.filter(s=>s.kind==='sound').length,1);
 assert.equal(dndRecipe(dagger,dagger.variants.find(v=>v.weaponMode==='thrown').id,{sounds}).stages.filter(s=>s.kind==='sound').length,2);
 const flame=find('Flame Tongue Longsword','weapon','2014');assert.equal(dndRecipe(flame,flame.variants.find(v=>/Flaming/.test(v.label)).id,{sounds}).stages.filter(s=>s.kind==='sound').length,2);
});
test('recorded D&D targets and private roll suppression use native activity data',()=>{
 const subject={id:'native',item:{type:'spell'},name:'Cast'};const event=dnd5eEvent('use',subject,{results:{message:{id:'m',system:{targets:[{token:'Scene.s.Token.a'},{token:'Scene.s.Token.b'}]}}}});
 assert.deepEqual(event.targetUuids,['Scene.s.Token.a','Scene.s.Token.b']);assert.equal(event.activityId,'native');
 assert.match(dnd5eEvent('use',subject,{results:{message:{data:{blind:true}}}}).skipped,/blind roll/);
 const spell={...subject,item:{type:'spell',system:{level:1}},getRollData:()=>({item:{level:4}})};
 const native=dnd5eEvent('damage',spell,{rolls:[{parent:{id:'roll',system:{level:5,targets:[{token:'Scene.s.Token.recorded'}]}}}]});
 assert.equal(native.spellLevel,5);assert.deepEqual(native.targetUuids,['Scene.s.Token.recorded']);assert.equal(dnd5eEvent('use',spell).spellLevel,4);
 assert.match(dnd5eEvent('attack',spell,{rolls:[{parent:{blind:true}}]}).skipped,/^Cast: a blind roll/);
});
test('same spell name matches native source and edition; foreign bound recipes never cross systems',()=>{
 const e=find('Fireball');assert.equal(findDndEntry({item:{type:'spell',name:'Renamed',_stats:{compendiumSource:e.uuid}}}),e);
 assert.equal(findDndEntry({item:{type:'spell',name:'Fireball',system:{source:{rules:'2014'}}}}).edition,'2014');
 const r=validateRecipe({id:'foreign',name:'Foreign',trigger:'use',itemUuid:'Compendium.pf2e.spells-srd.Item.x',stages:[{kind:'aura',assets:['jb2a.test']} ]});
 assert.equal(matchRecipe([r],{type:'use',systemId:'dnd5e',item:{uuid:r.itemUuid}}),null);
});
test('D&D native conditions follow active transferred effects and stop for suppression; invisible cues stay private',()=>{
 const actor={uuid:'Actor.a',statuses:new Set(),appliedEffects:[{uuid:'Actor.a.Item.i.ActiveEffect.e',active:true,statuses:new Set(['poisoned']),target:{documentName:'Actor'}},{uuid:'bad',active:false,statuses:new Set(['stunned'])}]};
 const states=dndActorStates(actor);assert.equal(states.length,1);assert.equal(states[0].statusId,'poisoned');const e=findDndState(states[0]);assert.ok(e);
 const r=resolveDndStateRecipe(states[0],useDndEntry({},e.id));assert.equal(r.lifecycle,'document');assert.ok(r.stages.every(s=>s.persist));
 actor.appliedEffects[0].isSuppressed=true;assert.deepEqual(dndActorStates(actor),[]);
 for(const statusId of ['invisible','hiding']){
  assert.equal(dndStateVisible({statusId},{visible:true,document:{},actor:{}},{isGM:false}),false);
  assert.equal(dndStateVisible({statusId},{visible:true,document:{},actor:{isOwner:true}},{isGM:false}),true);
  assert.equal(dndStateVisible({statusId},{visible:true,document:{},actor:{}},{isGM:true}),true);
 }
});
test('native semantics distinguish actual rays, healing, unlit Oil and follow-up damage',()=>{
 const row={source:{name:'Oil',type:'consumable',system:{}},description:'Oil can later ignite after fire damage.',edition:'2024'};
 assert.equal(nativeDirection(row,{type:'save',_id:'throw',name:'Throw'}).theme,'water');
 const tool=nativeDirection({...row,source:{name:'Mason’s Tools',type:'tool',system:{}}},{type:'check',_id:'check',activation:{type:'action'}});
 assert.equal(tool.trigger,'manual');assert.equal(tool.sound,null);assert.equal(tool.motion,'none');
 for(const e of dndEntries())for(const v of e.variants.filter(v=>v.rationale.startsWith('Native ability or tool check.'))){assert.equal(v.recipe.trigger,'manual');assert.equal(v.soundProfile,null);assert.equal(v.recipe.playbackRoles.reason,v.rationale);assert.ok(v.recipe.stages.every(s=>s.kind!=='motion'));}
 const acid={...row,source:{name:'Acid Arrow',type:'spell',system:{}}};assert.equal(nativeDirection(acid,{type:'damage',_id:'after',name:'Follow-up'}).delivery,'contact');
 assert.deepEqual(weaponModes({system:{type:{value:'simpleM'},properties:['thr']}},{type:'attack',attack:{type:{value:'melee'}}}),['melee','thrown']);
 assert.deepEqual(weaponModes({system:{type:{value:'',baseItem:'longbow'}}},{type:'attack',attack:{type:{}}}),['ranged']);
 assert.deepEqual(weaponModes({system:{type:{value:'martialR',baseItem:'longbow'}}},{type:'attack',attack:{type:{value:'melee'}}}),['melee']);
 assert.deepEqual(weaponModes({system:{type:{value:'natural'},range:{value:30,reach:5}}},{type:'attack',attack:{type:{value:'melee'}}}),['melee','ranged']);
 for(const name of ['Acid',"Alchemist's Fire",'Oil'])for(const entry of dndEntries('item').filter(e=>e.name===name)){
  for(const variant of entry.variants.filter(v=>v.recipe.stages.some(s=>s.kind==='travel'))){
   assert.ok(variant.recipe.stages.find(s=>s.kind==='travel').assets.every(k=>k.includes('throwable.throw.flask')),name+' uses flask footage');
   assert.equal(variant.recipe.stages.some(s=>s.kind==='cast'),false,name+' has no magical casting circle');
  }
 }
});

test('audit fixes: art families match the fiction and one-shot stages stay short',()=>{
 const keys=(e,label)=>e.variants.filter(v=>!label||v.label===label).flatMap(v=>v.recipe.stages.flatMap(s=>s.assets));
 assert.ok(keys(find('Hellish Rebuke')).some(k=>/green/.test(k)),'2024 Hellish Rebuke flames are green');
 for(const ed of ['2014','2024'])assert.ok(!keys(find('Wall of Stone','spell',ed)).some(k=>/breath_weapons/.test(k)),'Wall of Stone is not fire breath');
 assert.ok(!keys(find('Web','feat','2014'),'attack').some(k=>/spell_projectile/.test(k)),'web shot is not a skull projectile');
 for(const e of dndEntries().filter(e=>['spell','feat','item'].includes(e.kind)))for(const v of e.variants)for(const s of v.recipe.stages){
  if(!s.persist&&!['travel','motion','sound'].includes(s.kind))assert.ok(s.duration<=4500,`${e.name} / ${v.label} / ${s.label} ${s.duration}ms`);
  assert.ok(!s.assets.some(k=>/sphere_of_annihilation/.test(k))||/annihilation/i.test(e.name),`${e.name} uses an annihilation sphere`);
 }
 for(const name of ['Multiattack','Parry','Uncanny Dodge'])for(const v of find(name,'feat','2014').variants)assert.ok(!v.recipe.stages.some(s=>s.kind==='cast'),name+' has no casting circle');
});

test('lasting areas loop on their template; blasts and cast-time areas play once', () => {
  const persisted = (name, edition = '2024') => find(name, 'spell', edition).variants.some(v => v.recipe.stages.some(s => s.kind === 'template' && s.persist));
  for (const name of ['Fog Cloud', 'Web', 'Cloudkill', 'Darkness']) assert.ok(persisted(name), name);
  for (const name of ['Fireball', 'Fear', 'Hypnotic Pattern', 'Burning Hands']) assert.ok(!persisted(name), name);
  // An emanation centred on the caster lasts and moves with them.
  const guardians = find('Spirit Guardians').variants.flatMap(v => v.recipe.stages).find(s => s.kind === 'template');
  assert.ok(guardians.persist && guardians.followSource);
  assert.ok(!find('Fog Cloud').variants[0].recipe.stages.find(s => s.kind === 'template').followSource, 'a placed cloud stays put');
  const fog = find('Fog Cloud').variants[0].recipe.stages.find(s => s.kind === 'template');
  assert.ok(fog.assets.every(k => !k.includes('.complete.')), 'lasting fog uses its loop footage');
  // Call Lightning's storm lasts; each bolt from it is a single event.
  const call = find('Call Lightning', 'spell', '2014').variants;
  assert.ok(call.find(v => v.label === 'Cast').recipe.stages.some(s => s.persist));
  assert.ok(!call.filter(v => /Lightning Bolt/.test(v.label)).some(v => v.recipe.stages.some(s => s.persist)));
});

test('official-book copies resolve to their SRD entry and activity', () => {
  const book = {type:'spell',name:"Evard's Black Tentacles",system:{source:{rules:'2024'},identifier:'evards-black-tentacles'}};
  assert.equal(findDndEntry({item:book})?.name,'Black Tentacles');
  assert.equal(findDndEntry({item:{type:'spell',name:"Bigby's Hand",system:{source:{rules:'2024'}}}})?.name,'Arcane Hand');
  // A book activity with its own id and name still finds the SRD activity of the same kind.
  const fireball=find('Fireball'),variant=fireball.variants.find(v=>v.recipe.trigger==='template');
  const event={type:'template',activityId:'bookActivity0001',activityName:'Cast Fireball',activity:{type:variant.activityType}};
  assert.equal(dndVariantForEvent(fireball,event)?.id,variant.id);
});

test('a save spell cast before targeting plays on its damage roll', () => {
  const entry=find('Sacred Flame'),variant=entry.variants[0];
  const item={uuid:'Actor.a.Item.sacred',type:'spell',name:'Sacred Flame',system:{source:{rules:'2024'}}};
  const stateFor=()=>({enabled:true});
  const cast={type:'use',item,activityId:variant.activityId,activity:{type:variant.activityType},targets:[]};
  assert.equal(resolveDndAutomaticRecipe(cast,stateFor),null);
  assert.match(cast.skipReason,/damage roll/);
  const damage={type:'damage',item,targets:[{id:'t'}]};
  assert.equal(resolveDndAutomaticRecipe(damage,stateFor)?.catalogEntry,entry.id);
  assert.equal(resolveDndAutomaticRecipe({...damage},stateFor),null,'only the waiting cast plays once');
});

test('official-book entries join only for active book modules', async () => {
  const {addDndBookEntries,dndEntry}=await import('../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs');
  const book={id:'dnd5e-test-book-spell',uuid:'Compendium.dnd-test-book.spells.Item.x',name:'Test Book Spell',kind:'spell',edition:'2024',level:1,variants:[],requires:'dnd-test-book'};
  assert.equal(addDndBookEntries([book],()=>false),0);
  assert.equal(dndEntry(book.id),null);
  assert.equal(addDndBookEntries([book],id=>id==='dnd-test-book'),1);
  assert.equal(findDndEntry({item:{type:'spell',name:'x',_stats:{compendiumSource:book.uuid}}})?.id,book.id);
});
// Ground marks: thrown flasks name the mark their contents leave on the floor (engines/marks/ground-marks.mjs).
test('D&D thrown flasks carry their markElement',()=>{
 const item=(name,edition)=>find(name,'item',edition);
 assert.equal(dndRecipe(item("Alchemist's Fire",'2024')).markElement,'fire');
 assert.equal(dndRecipe(item("Alchemist's Fire",'2014')).markElement,'fire');
 assert.equal(dndRecipe(item('Acid','2024')).markElement,'acid');
 assert.equal(dndRecipe(item('Acid (vial)','2014')).markElement,'acid');
 assert.equal(dndRecipe(item('Flask of Holy Water','2014')).markElement,undefined);
 assert.equal(dndRecipe(item('Oil Flask','2014')).markElement,undefined);
});

test('NPC natural attacks match across feature and weapon kinds',()=>{
 const bite=findDndEntry({item:{type:'feat',name:'Bite',system:{source:{rules:'2024'}}}});
 assert.equal(bite?.kind,'weapon');assert.equal(bite.edition,'2024');
 assert.equal(findDndEntry({item:{type:'weapon',name:'Constrict',system:{source:{rules:'2024'}}}})?.kind,'feat');
 // An entry of the item's own kind still wins.
 const hooves=findDndEntry({item:{type:'weapon',name:'Hooves',system:{source:{rules:'2024'}}}});
 assert.equal(hooves?.kind,'weapon');
 assert.equal(findDndEntry({item:{type:'feat',name:'Cunning Action',system:{source:{rules:'2024'}}}})?.kind,'feat');
 assert.equal(findDndEntry({item:{type:'spell',name:'Bite'}}),null,'spells never borrow a weapon entry');
});
test('legacy compendium sources without .Item. match their entry by id',()=>{
 const bite=dndEntries('weapon').find(e=>e.uuid==='Compendium.dnd5e.monsterfeatures.Item.WdpSeGqhZpptz37y');
 assert.equal(findDndEntry({item:{type:'weapon',name:'Renamed',_stats:{compendiumSource:'Compendium.dnd5e.monsterfeatures.WdpSeGqhZpptz37y'}}}),bite);
 assert.equal(findDndEntry({item:{type:'feat',name:'Renamed',flags:{core:{sourceId:'Compendium.dnd5e.monsterfeatures.WdpSeGqhZpptz37y'}}}}),bite,'the source names its entry whatever the kind');
 // The 2014 Hooves source is a utility feature; the statblock's weapon attack keeps the weapon entry.
 const hooves=findDndEntry({item:{type:'weapon',name:'Hooves',system:{source:{rules:'2014'}},_stats:{compendiumSource:'Compendium.dnd5e.monsterfeatures.re3oXQ3Xg4Z3Fr6O'}}});
 assert.equal(hooves?.kind,'weapon');
 assert.equal(findDndEntry({item:{type:'weapon',name:'Unknown thing',_stats:{compendiumSource:'Compendium.dnd5e.monsterfeatures.re3oXQ3Xg4Z3Fr6O'}}})?.id,'dnd5e-monsterfeatures-re3oXQ3Xg4Z3Fr6O','with no same-kind name, the source entry');
 assert.equal(findDndEntry({item:{type:'feat',name:'x',_stats:{compendiumSource:'Compendium.dnd5e.monsterfeatures.Item.re3oXQ3Xg4Z3Fr6O'}}})?.id,'dnd5e-monsterfeatures-re3oXQ3Xg4Z3Fr6O');
});
test('NPC activities with their own ids pick a design leniently, never a manual one',()=>{
 const unknown=(type,activityType,extra={})=>({type,activityId:'npcActivity00001',activityName:'Bite',activity:{type:activityType},...extra});
 const gore=find('Gore','weapon');
 assert.equal(dndVariantForEvent(gore,unknown('attack','attack',{weaponMode:'melee'}))?.id,gore.variants[0].id,'several of the same kind: the first');
 const moving=gore.variants.find(v=>v.activityName==='Moving Attack');
 assert.equal(dndVariantForEvent(gore,{type:'attack',activityId:moving.activityId,activity:{type:'attack'}})?.id,moving.id,'an exact activity still wins');
 const cunning=dndEntries('feat').find(e=>e.id==='dnd5e-classes24-phbrgeCunningAct');
 assert.equal(dndVariantForEvent(cunning,unknown('use','utility'))?.id,cunning.variants[0].id);
 // 2014 Breath Weapons save; the entry's design is a utility.
 const breath=find('Breath Weapons','feat','2014');
 assert.equal(dndVariantForEvent(breath,unknown('use','save'))?.id,breath.variants[0].id);
 assert.equal(dndVariantForEvent(breath,unknown('attack','save')),null,'no attack design to borrow');
 const sleep=find('Sleep','spell','2014');
 assert.equal(dndVariantForEvent(sleep,unknown('template','damage'))?.id,sleep.variants[0].id);
 assert.equal(dndVariantForEvent(sleep,unknown('damage','damage')),null,'plays once, on its template');
 // Manual designs stay manual: Mage Hand's conjuring never borrows the control design.
 const hand14=find('Mage Hand','spell','2014'),hand24=find('Mage Hand','spell','2024');
 assert.equal(dndVariantForEvent(hand14,unknown('use','summon')),null);
 assert.equal(dndVariantForEvent(hand24,unknown('use','summon')),null);
 assert.equal(dndVariantForEvent(hand24,unknown('use','utility')),null,'a manual-only entry stays manual');
 const constrict=find('Constrict','feat');
 assert.equal(dndVariantForEvent(constrict,unknown('use','check')),null,'its escape check is a manual design');
 assert.equal(dndVariantForEvent(constrict,unknown('use','attack'))?.recipe.trigger,'use');
});
