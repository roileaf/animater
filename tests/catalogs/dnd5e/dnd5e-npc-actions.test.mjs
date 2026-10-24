import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {DND_NPC_ACTIONS,DND_NPC_ACTION_SOURCE,findDndNpcAction,dndNpcActionPreview,resolveDndNpcAction} from '../../../scripts/catalogs/dnd5e/dnd5e-npc-actions.mjs';
import {resolveDndAutomaticRecipe,dndEntry} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {planRecipe,validateRecipe} from '../../../scripts/core/model.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
import {eligibleNpcActivity} from '../../../tools/build-dnd5e-npc-actions.mjs';

const context={source:{id:'npc',center:{x:0,y:0},w:100,h:100},targets:[{id:'target',center:{x:300,y:0},w:100,h:100}],gridSize:100,template:{id:'area'},area:{type:'cone',center:{x:0,y:0},endpoint:{x:500,y:0},length:500,angle:60,width:100,diameter:500}};
const state=()=>({enabled:true,motion:true,sound:true});
function eventFor(action){const match=action.matches[0];return {systemId:'dnd5e',type:action.trigger,actor:{name:action.creatures[0],type:'npc'},item:{id:'copied-item',name:action.name,type:'feat',_stats:{compendiumSource:match.source},system:{source:{rules:action.edition}}},activityId:match.activityId,activityName:action.activityName,activity:{_id:match.activityId,name:action.activityName,type:action.activityType},targets:context.targets};}

test('native NPC audit covers every eligible activity identity, while passive helpers stay excluded',()=>{
 assert.equal(DND_NPC_ACTION_SOURCE.actors,722);assert.equal(DND_NPC_ACTION_SOURCE.activityOccurrences,1593);
 assert.equal(DND_NPC_ACTION_SOURCE.excludedPassiveActivities,103);
 assert.equal(DND_NPC_ACTIONS.reduce((n,a)=>n+a.matches.length,0),1593);
 for(const a of DND_NPC_ACTIONS){assert.ok(a.matches.length);assert.ok(a.creatures.length);assert.ok(a.form.rationale);assert.equal(findDndNpcAction(eventFor(a))?.id,a.id);}
 for(const activation of ['','turnStart','turnEnd'])assert.equal(eligibleNpcActivity({activation:{type:activation}}),false);
});

test('all native/reviewed/delegated previews validate and resolve real Free and Patreon media',async()=>{
 const db=await assetDatabases();
 for(const a of DND_NPC_ACTIONS)for(const motion of [true,false]){const r=dndNpcActionPreview(a.id,{motion});assert.ok(r,a.name+' '+a.form.id);assert.equal(r.systemId,'dnd5e');validateRecipe(r);
  for(const [edition,assets] of Object.entries(db)){let p;try{p=planRecipe(r,assets,context);}catch(error){throw new Error(`${a.name} / ${a.activityName} ${a.form.id} ${edition}: ${error.message}`,{cause:error});}assert.ok(p.length,`${a.name} ${a.activityName} ${edition}`);assert.ok(p.some(s=>s.kind!=='motion'&&s.kind!=='sound'),`${a.name} visible ${edition}`);}
 }
});

test('exact source+activity matching keeps different dragon breaths separate and handles regenerated copies',()=>{
 const fire=DND_NPC_ACTIONS.find(a=>a.name==='Breath Weapons'&&a.activityName==='Fire Breath'),sleep=DND_NPC_ACTIONS.find(a=>a.name==='Breath Weapons'&&a.activityName==='Sleep Breath');
 assert.ok(fire.form.id.includes('fire'));assert.ok(sleep.form.id.includes('other'));
 assert.notEqual(findDndNpcAction(eventFor(fire)).id,findDndNpcAction(eventFor(sleep)).id);
 const ev=eventFor(fire);ev.item._stats={};ev.actor._stats={compendiumSource:fire.matches[0].source.split('.Item.')[0]};ev.item.id=fire.matches[0].source.split('.Item.')[1];assert.equal(findDndNpcAction(ev)?.id,fire.id);
 const player=eventFor(fire);player.actor.type='character';assert.equal(findDndNpcAction(player),null);
 const unknown=eventFor(fire);unknown.item._stats={};unknown.actor.name='Unrelated creature';assert.equal(findDndNpcAction(unknown),null);
});

test('NPC global switch, entry state and exclusions cannot resurrect disabled catalog actions',()=>{
 const a=DND_NPC_ACTIONS.find(a=>a.coverage==='reviewed'&&!dndEntry(a.native?.entryId)&&a.name==='Healing Touch'),ev=eventFor(a);
 assert.ok(resolveDndAutomaticRecipe(ev,state));
 assert.equal(resolveDndAutomaticRecipe(ev,state,[],{npcEnabled:false}),null);
 assert.equal(resolveDndAutomaticRecipe(ev,state,[],{npcExcluded:[a.id]}),null);
 assert.equal(resolveDndAutomaticRecipe(ev,()=>({enabled:false})),null);
 assert.equal(resolveDndAutomaticRecipe(ev,()=>({enabled:true,scope:'selected'})),null);
 const native=DND_NPC_ACTIONS.find(a=>a.native&&a.trigger==='use'),ne=eventFor(native);
 assert.ok(resolveDndAutomaticRecipe(ne,state));assert.equal(resolveDndAutomaticRecipe(ne,state,[],{npcEnabled:false}),null);
 assert.equal(resolveDndAutomaticRecipe(ne,()=>({enabled:true,excluded:[native.native.entryId]})),null);
});

test('custom overrides and paused native activity recipes retain priority over NPC fallback',()=>{
 const a=DND_NPC_ACTIONS.find(a=>a.coverage==='reviewed'&&a.name==='Detect'),ev=eventFor(a);
 const custom=validateRecipe({...dndNpcActionPreview(a.id),id:'my-npc-custom',name:'Detect',match:'Detect',activityId:ev.activityId,enabled:true});
 const found=resolveDndAutomaticRecipe(ev,state,[custom]);assert.equal(found?.id,custom.id);
 assert.equal(resolveDndAutomaticRecipe(ev,state,[{...custom,enabled:false}]),null);
 assert.equal(resolveDndNpcAction(ev,[{...custom,enabled:false}]),null);
});

test('cast activities delegate to the actual spell and never replay a second feature cue',()=>{
 for(const a of DND_NPC_ACTIONS.filter(a=>a.delegated)){assert.equal(resolveDndNpcAction(eventFor(a)),null);assert.equal(resolveDndAutomaticRecipe(eventFor(a),state),null);}
});

test('native catalog and NPC module import in either order; inactive systems avoid D&D NPC data',()=>{
 for(const first of ['dnd5e-catalog','dnd5e-npc-actions']){
  const result=spawnSync(process.execPath,['--input-type=module','-e',`await import('./scripts/catalogs/dnd5e/${first}.mjs'); const m=await import('./scripts/catalogs/dnd5e/dnd5e-npc-actions.mjs'); if(!m.DND_NPC_ACTIONS.length)process.exit(2);`],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);
 }
 const inactive=spawnSync(process.execPath,['--input-type=module','-e',`globalThis.game={system:{id:'sf2e'}};const m=await import('./scripts/catalogs/dnd5e/dnd5e-npc-actions.mjs');if(m.DND_NPC_ACTIONS.length)process.exit(2);`],{encoding:'utf8'});assert.equal(inactive.status,0,inactive.stderr);
});
