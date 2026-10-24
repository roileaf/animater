import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync}from'node:child_process';
import {NPC_ACTIONS,PF2E_NPC_ACTION_SOURCE,npcActionPreview,npcAbilityRecipe,findNpcCatalogAction}from'../../scripts/catalogs/pf2e/npc-abilities.mjs';
import {npcActionSemantics}from'../../scripts/catalogs/pf2e/npc-action-semantics.mjs';
const skink=NPC_ACTIONS.find(a=>a.name==='Unsteadying Magnetism');
const npc={type:'npc',name:'Magnetic Skink'};
const event={type:'use',systemId:'pf2e',actor:npc,item:{type:'action',name:'Unsteadying Magnetism',actor:npc,system:{traits:{value:[]},description:{value:"The skink amplifies its magnetic field and tries to pull the metal away from a creature within 20 feet. If that creature is wearing metal armor or holding a metal item, they must attempt a @Check[fortitude|dc:15] save. On a failure, that creature is @UUID[Compendium.pf2e.conditionitems.Item.AJh5ex99aV6VTggg]{Off-Guard} until the start of the skink's next turn."}}}};
test('native NPC catalog lists actual actions and creatures beyond shared designs',()=>{
 assert.ok(NPC_ACTIONS.length>6000);assert.equal(PF2E_NPC_ACTION_SOURCE.total,NPC_ACTIONS.length);
 assert.ok(skink.creatures.includes('Magnetic Skink'));assert.equal(skink.form.id,'magnetism');
 assert.equal(new Set(NPC_ACTIONS.map(a=>a.id)).size,NPC_ACTIONS.length);
 assert.ok(!JSON.stringify(NPC_ACTIONS).includes('description'));
});
test('Magnetic Skink non-damaging magnetism has a fitting targeted design without applying rules or moving documents',()=>{
 assert.equal(findNpcCatalogAction(event),skink);
 const recipe=npcAbilityRecipe(event);assert.equal(recipe.bespoke,'pf2e:npc-magnetism');
 assert.ok(recipe.stages.some(s=>s.label==='Metal pulled inward'&&s.subject==='targets'));
 assert.ok(!recipe.stages.some(s=>['rush','leap','throw'].includes(s.motion)));
 assert.equal(npcAbilityRecipe(event,[],{excluded:[skink.id]}),null);
 assert.equal(npcAbilityRecipe(event,[],{generic:false}),null);
 assert.ok(npcActionPreview(skink.id)?.bespoke);
});
test('catalog source matching survives a renamed actor and fallback remains conservative',()=>{
 const renamed={...event,actor:{type:'npc',name:'Renamed'},item:{...event.item,sourceId:skink.sources[0]}};
 assert.equal(findNpcCatalogAction(renamed),skink);
 assert.equal(npcActionSemantics({name:'Steady Breathing',system:{description:{value:'The creature calmly waits.'}}}),null);
 assert.equal(npcAbilityRecipe({...event,item:{...event.item,name:'Unmapped activity',system:{traits:{value:[]},description:{value:''}}}}),null);
});
test('every indexed native action has a valid preview and coverage metadata',()=>{
 let mapped=0,unmapped=0;
 for(const a of NPC_ACTIONS){if(a.form){assert.ok(npcActionPreview(a.id)?.bespoke,a.name);mapped++;}else{assert.equal(npcActionPreview(a.id),null);unmapped++;}}
 assert.equal(mapped,PF2E_NPC_ACTION_SOURCE.animated);assert.equal(unmapped,0);
});
test('inactive D&D and Daggerheart worlds do not load the large NPC action index',()=>{
 const url=new URL('../../scripts/catalogs/pf2e/npc-abilities.mjs',import.meta.url).href;
 for(const system of ['dnd5e','daggerheart']){
  const code=`globalThis.game={system:{id:${JSON.stringify(system)}}};const {NPC_ACTIONS}=await import(${JSON.stringify(url)});console.log(NPC_ACTIONS.length);`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});
  assert.equal(child.status,0,child.stderr);assert.equal(child.stdout.trim(),'0');
 }
});
