import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SF2E_SOURCE,sfEntries,sfEntry,sfRecipe,findSfEntry,sfVariantForEvent,useSfEntry,normalizeSfCatalogState,resolveSfAutomaticRecipe,sfCatalogProfile} from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {sfActorStates,sfStateVisible,resolveSfStateRecipe,sfStateHost} from '../../../scripts/catalogs/sf2e/sf2e-states.mjs';
import {sf2eEvent,pf2eEvent} from '../../../scripts/systems/adapters.mjs';
import {catalogNavigation,catalogPageAllowed,sfSettingKey} from '../../../scripts/catalogs/shared/catalog-system.mjs';
import {planRecipe,matchRecipe,validateRecipe} from '../../../scripts/core/model.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
import {DndCatalogWorkspace} from '../../../scripts/ui/dnd5e-catalog-ui.mjs';
import {activeState} from '../../../scripts/engines/playback/persistent-states.mjs';
import {SOUND_PROFILES} from '../../../data/spell-sounds.mjs';
import {ABILITY_SOUND_PROFILES} from '../../../data/ability-sounds.mjs';
const find=(name,kind='spell')=>sfEntries(kind).find(e=>e.name===name);
const native=entry=>({id:'owned',uuid:'Actor.a.Item.owned',type:entry.nativeType,name:entry.name,slug:entry.slug,sourceId:entry.uuid,system:{active:true,value:{isValued:false}},active:true});
const context={source:{id:'caster',center:{x:100,y:100},w:100,h:100},targets:[{id:'target',center:{x:500,y:100},w:100,h:100}],gridSize:100,gridDistance:5,template:{id:'area'},area:{type:'cone',center:{x:100,y:100},endpoint:{x:500,y:100},diameter:400,length:400,width:100,angle:90}};
test('SF2e catalog is native, complete for active sources, and isolated from PF2e/D&D',async()=>{
 assert.equal(SF2E_SOURCE.version,'1.5.1');assert.deepEqual(SF2E_SOURCE.counts,{spell:432,feat:681,action:174,feature:3,weapon:192,condition:46,effect:400});
 const audit=JSON.parse(await readFile(new URL('../../../data/sf2e-catalog-validation.json',import.meta.url),'utf8'));
 assert.equal(audit.issues.length,0);assert.equal(sfEntries().length+audit.excluded.length,SF2E_SOURCE.sourceDocuments);
 assert.ok(sfEntries().every(e=>e.uuid.startsWith(`Compendium.sf2e.${e.pack}.Item.`)&&e.systemId==='sf2e'));
 assert.ok(!sfEntries('feat').some(e=>e.name==='Hologram Skeptic'||e.name==='Suppressing Fire'));
 assert.equal(new Set(sfEntries().map(e=>e.uuid)).size,sfEntries().length);
 const nav=catalogNavigation({systemId:'sf2e'});assert.equal(nav.length,8);assert.ok(nav.every(e=>e[2].startsWith('SF2e')));assert.equal(catalogPageAllowed('items',{systemId:'sf2e'}),false);
 assert.equal(sfSettingKey('spell'),'sf2eSpellCatalog');
 const entry=find('Supercharge Weapon'),recipe=sfRecipe(entry);assert.equal(findSfEntry({systemId:'pf2e',item:native(entry)}),null);assert.equal(matchRecipe([recipe],{type:recipe.trigger,systemId:'pf2e',item:native(entry)}),null);
});
test('every SF2e usage plays with both JB2A editions and keeps native IDs on customized recipes',async()=>{
 const db=await assetDatabases();
 for(const entry of sfEntries())for(const variant of entry.variants){
  const recipe=sfRecipe(entry,variant.id,{sounds:null});assert.equal(recipe.systemId,'sf2e');assert.equal(recipe.itemUuid,entry.uuid);assert.equal(recipe.catalogEntry,entry.id);assert.equal(recipe.description,'');assert.ok(recipe.stages.length,entry.name);
  assert.equal(sfEntry(recipe.id),entry);validateRecipe(recipe);
  const c={...context,area:recipe.previewArea?.type==='line'?{...context.area,type:'line'}:recipe.previewArea?.type==='cone'?context.area:{...context.area,type:'burst'}};
  for(const [edition,rows]of Object.entries(db))assert.ok(planRecipe(recipe,rows,c).length,`${entry.name} ${variant.id} ${edition}`);
  if(!entry.state)assert.ok(sfRecipe(entry,variant.id,{motion:false,sounds:null}).stages.every(s=>s.kind!=='motion'));
 }
});
test('SF2e lasers are laser footage, grenade payloads land, and native Area Fire waits for placement',()=>{
 const laser=find('Laser Pistol','weapon');assert.ok(laser);assert.ok(sfRecipe(laser,'ranged').stages.find(s=>s.kind==='travel').assets.every(k=>k.startsWith('jb2a.lasershot.')));
 const grenade=sfEntries('weapon').find(e=>e.name.startsWith('Frag Grenade'));assert.ok(grenade);assert.ok(grenade.variants.some(v=>v.weaponMode==='thrown'));
 const area=grenade.variants.find(v=>v.id==='area');assert.equal(area.recipe.trigger,'template');assert.equal(area.recipe.previewArea.type,'burst');assert.ok(area.recipe.stages.some(s=>s.kind==='template'));
 const plasma=find('Plasma Cannon','weapon');assert.equal(plasma.variants.find(v=>v.id==='area').recipe.previewArea.value,10);
 for(const [name,type,size]of [['Arc Emitter','cone',20],['Flamethrower','cone',15],['Numbing Beam Rifle','line',60],['Machine Gun','cone',20],['Rotolaser','cone',15]]){
  const variant=find(name,'weapon').variants.find(v=>v.id==='area');assert.ok(variant,name);assert.deepEqual(variant.recipe.previewArea,{type,value:size});
  if(['Machine Gun','Rotolaser'].includes(name))assert.equal(variant.label,'Auto-Fire');
 }
 assert.ok(area.recipe.stages.some(s=>s.kind==='travel'&&s.travelDestination==='area'),'grenade flies into its placed burst');
 const state=useSfEntry({},plasma.id),event={type:'use',systemId:'sf2e',item:native(plasma)};
 assert.equal(resolveSfAutomaticRecipe(event,()=>state),null);assert.equal(resolveSfAutomaticRecipe({...event,type:'template'},()=>state).trigger,'template');
});
test('native heightened Jump changes movement semantics and optional SF sounds resolve real profiles',()=>{
 const entry=find('Jump');assert.ok(entry);
 assert.ok(sfRecipe(entry,'cast',{castRank:1,sounds:null}).stages.some(s=>s.kind==='motion'&&s.motion==='leap'));
 assert.ok(sfRecipe(entry,'cast',{castRank:3,sounds:null}).stages.every(s=>s.motion!=='leap'),'heightened grants later jumps; it does not jump immediately');
 const profiles={...SOUND_PROFILES,...ABILITY_SOUND_PROFILES};
 for(const e of sfEntries())for(const v of e.variants){if(e.state||!v.soundProfile)continue;assert.ok(profiles[v.soundProfile],`${e.name}/${v.soundProfile}`);}
 const grenade=sfEntries('weapon').find(e=>e.name.startsWith('Frag Grenade')),recipe=sfRecipe(grenade,'area',{sounds:{resolve:c=>c}});
 assert.ok(recipe.stages.some(s=>s.kind==='sound'&&s.afterStage===recipe.stages.find(s=>s.kind==='template').stageId),'area contact audio anchors to blast');
});
test('Supercharge Weapon empowers its target without shooting and catalog automation honors customization/exclusion',()=>{
 const entry=find('Supercharge Weapon'),recipe=sfRecipe(entry),event={type:recipe.trigger,systemId:'sf2e',item:native(entry)};
 assert.ok(!recipe.stages.some(s=>['travel','projectile'].includes(s.kind)));assert.ok(recipe.stages.some(s=>s.subject==='targets'));
 const state=useSfEntry({},entry.id);assert.equal(state.scope,'selected');assert.equal(resolveSfAutomaticRecipe(event,()=>state).catalogEntry,entry.id);
 assert.equal(resolveSfAutomaticRecipe(event,()=>({...state,excluded:[entry.id]})),null);
 assert.equal(resolveSfAutomaticRecipe(event,()=>({...state,selected:[],customized:[entry.id]}),[{...recipe,enabled:false}],{customEnabled:false}),null);
 assert.deepEqual(normalizeSfCatalogState({...state,selected:['pf2e-foreign',entry.id,entry.id]}).selected,[entry.id]);
});
test('SF2e events use SF flags, recorded targets/cast rank and native weapon usages; privacy is preserved',()=>{
 const origin={uuid:'Actor.a.Item.i',castRank:5},message={id:'m',author:{id:'u'},item:{type:'spell',system:{}},flags:{sf2e:{origin,context:{type:'spell-attack-roll',target:{token:'Scene.s.Token.t'},outcome:'success'}}},speaker:{token:'c',scene:'s'},isRoll:true};
 const event=sf2eEvent(message,'u');assert.equal(event.systemId,'sf2e');assert.equal(event.type,'attack');assert.equal(event.castRank,5);assert.equal(event.targetUuid,'Scene.s.Token.t');assert.equal(event.itemUuid,origin.uuid);
 assert.equal(pf2eEvent({...message,item:undefined},'u'),null);
 for(const change of [{author:{id:'other'}},{content:'<div class="">old</div><div class="reroll-second reroll-discard">new</div>',flags:{sf2e:{...message.flags.sf2e,context:{...message.flags.sf2e.context,isReroll:true}}}}])assert.equal(sf2eEvent({...message,...change},'u'),null);
 for(const change of [{blind:true},{whisper:['u']}])assert.match(sf2eEvent({...message,...change},'u').skipped,/stays hidden/);
 const grenade={...message,item:{type:'weapon',system:{group:'grenade',range:70}},flags:{sf2e:{context:{type:'attack-roll'}}}};assert.equal(sf2eEvent(grenade,'u').weaponMode,'thrown');
 assert.equal(sf2eEvent({...grenade,flags:{sf2e:{context:{type:'attack-roll',altUsage:'melee'}}}},'u').weaponMode,'melee');
 assert.equal(sf2eEvent({...grenade,isRoll:false,flags:{sf2e:{origin,context:{type:'area-fire',area:{type:'burst',value:10}}}}},'u').type,'use');
});
test('SF condition Items and effect-backed Suppressed use condition settings and expire with their native document',()=>{
 const suppressed=find('Suppressed','condition');assert.equal(suppressed.nativeType,'effect');const item=native(suppressed);
 assert.equal(sfStateHost.stateKind(item),'condition');assert.equal(activeState(item),true);assert.equal(resolveSfStateRecipe(item,useSfEntry({},suppressed.id)).lifecycle,'document');
 item.isExpired=true;assert.equal(activeState(item),false);
 const invisible=find('Invisible','condition');assert.equal(sfStateVisible(native(invisible),{visible:true,document:{},actor:{}},{isGM:false}),false);assert.equal(sfStateVisible(native(invisible),{visible:true,document:{},actor:{isOwner:true}},{isGM:false}),true);
 const actor={items:[item,native(invisible)],conditions:{active:[native(invisible)]}};assert.equal(sfActorStates(actor).length,2);
});
test('native SF prepared aura radius grows the emitter rather than the recipient',()=>{
 const entry=sfEntries('effect').find(e=>e.state.auraSources?.length),link=entry.state.auraSources[0];
 const source={id:'emitter',uuid:'Actor.a.Item.emitter',type:'feat',name:'Native emitter',sourceId:link.uuid,system:{rules:[{key:'Aura',slug:link.slug,radius:20}]}},actor={items:[source],auras:new Map([[link.slug,{slug:link.slug,radius:20,effects:[{parent:source,uuid:entry.uuid}]}]])};
 const states=sfActorStates(actor);assert.equal(states.length,1);assert.equal(states[0].animaterAura.radius,20);
 const recipe=resolveSfStateRecipe(states[0],useSfEntry({},entry.id));assert.ok(recipe.stages.every(s=>s.auraRadius===20));
 const recipient=resolveSfStateRecipe(native(entry),useSfEntry({},entry.id));assert.ok(recipient.stages.every(s=>!s.auraRadius));
});
test('SF workspace uses native IDs for details and never exposes D&D edition controls',async()=>{
 const calls=[],states={};const w={page:'spells',stageIndex:0,host:{environment:()=>({systemId:'sf2e',ready:true}),sfCatalogState:k=>states[k],setSfCatalogState:async(k,v)=>{states[k]={...states[k],...v};},recipes:()=>[],soundCatalog:()=>null,resolveItem:async uuid=>({sheet:{render:async()=>calls.push(uuid)}})},recipePreviewHTML:()=>'',render(){},recipe(){return ui.recipe();}};
 const ui=new DndCatalogWorkspace(w,sfCatalogProfile),html=ui.html();assert.ok(html.includes('SF2E'));assert.ok(html.includes('Rank 10'));assert.ok(!html.includes('2014')&&!html.includes('D&D')&&!html.includes('PF2e'));
 await ui.action('dnd-details',{});assert.equal(calls[0],ui.entry().uuid);await ui.action('dnd-use',{});assert.ok(states.spell.selected.includes(ui.entry().id));
});

test('SF2e catalog keeps the lasting animation choice so Play once, then fade sticks', () => {
 assert.equal(normalizeSfCatalogState({}).fade, false);
 assert.equal(normalizeSfCatalogState({fade:true}).fade, true);
 assert.equal(normalizeSfCatalogState({...normalizeSfCatalogState({fade:true}),motion:false}).fade, true);
});
// Ground marks: grenades name the mark their element leaves on the floor (engines/marks/ground-marks.mjs).
test('SF2e elemental grenades carry their markElement',()=>{
 const grenade=name=>sfEntries('weapon').find(e=>e.name===name);
 for(const v of grenade('Incendiary Grenade (Commercial)').variants)assert.equal(sfRecipe(grenade('Incendiary Grenade (Commercial)'),v.id).markElement,'fire');
 assert.equal(sfRecipe(grenade('Degradation Grenade (Commercial)')).markElement,'acid');
 // Its theme is not its damage: foam and stench grenades, a frag's shrapnel and a laser's beam leave none.
 for(const name of ['Hardening Foam Grenade (Commercial)','Miasmatic Grenade (Commercial)','Frag Grenade (Commercial)'])assert.equal(sfRecipe(grenade(name)).markElement,undefined,name);
 assert.equal(sfRecipe(sfEntries('weapon').find(e=>e.group==='laser')).markElement,undefined);
});
