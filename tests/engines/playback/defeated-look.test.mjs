import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFEATED_LOOK,DEFEATED_LOOK_CHOICES,registerDefeatedLook,installDefeatedLook,defeatedStatusId,defeatedStatusOptions,markDefeated,defeatedStates,DEFEATED_RECIPE} from '../../../scripts/engines/playback/defeated-look.mjs';
import {PersistentStates} from '../../../scripts/engines/playback/persistent-states.mjs';

// An ActiveEffect being created: its prepared statuses and a source that updateSource writes into.
function creating(statuses,overlay=true){
 const doc={statuses:new Set(statuses),flags:{core:{overlay}},updates:[],updateSource(changes){this.updates.push(changes);if('flags.core.overlay' in changes)this.flags.core.overlay=changes['flags.core.overlay'];}};
 return {doc,data:{statuses:[...statuses],flags:{core:{overlay}}}};
}
function hooks(mode,config={specialStatusEffects:{DEFEATED:'dead'}}){
 const on=new Map();
 installDefeatedLook({on:(name,fn)=>on.set(name,fn)},{mode:()=>mode,config:()=>config});
 return on;
}

test('the setting is a world choice under module settings, defaulting to Foundry\'s overlay',()=>{
 const registered=[],onChange=()=>{};
 registerDefeatedLook({register:(id,key,data)=>registered.push({id,key,data})},'animater',{onChange});
 assert.equal(registered.length,1);
 const [{id,key,data}]=registered;
 assert.equal(id,'animater');assert.equal(key,DEFEATED_LOOK);assert.equal(key,'defeatedLook');
 assert.equal(data.scope,'world');assert.equal(data.config,true);assert.equal(data.type,String);
 assert.equal(data.default,'overlay');assert.equal(data.onChange,onChange);
 assert.deepEqual(Object.keys(data.choices),['overlay','icon','effect']);
 assert.deepEqual(data.choices,DEFEATED_LOOK_CHOICES);
 assert.match(data.choices.overlay,/Foundry default/);assert.equal(data.choices.icon,'Small icon');assert.equal(data.choices.effect,'Animater effect');
 assert.match(data.hint,/existing/i,'the hint says it applies from now on');
});

test('the defeated status is CONFIG.specialStatusEffects.DEFEATED, normally dead',()=>{
 assert.equal(defeatedStatusId({specialStatusEffects:{DEFEATED:'defeated'}}),'defeated');
 assert.equal(defeatedStatusId({}),'dead');assert.equal(defeatedStatusId(undefined),'dead');
});

test('icon and effect modes clear the overlay flag on a new defeated status; overlay mode leaves it',()=>{
 for(const [mode,expected] of [['overlay',true],['icon',false],['effect',false]]){
  const on=hooks(mode),{doc,data}=creating(['dead']);
  on.get('preCreateActiveEffect')(doc,data,{},'u');
  assert.equal(doc.flags.core.overlay,expected,mode);
  assert.equal(doc.updates.length,expected?0:1,mode);
 }
});

test('other statuses keep their overlay in every mode',()=>{
 for(const mode of ['overlay','icon','effect']){
  const on=hooks(mode),{doc,data}=creating(['unconscious']);
  on.get('preCreateActiveEffect')(doc,data,{},'u');
  assert.equal(doc.flags.core.overlay,true,mode);assert.equal(doc.updates.length,0,mode);
 }
});

test('a defeated status from a system with its own defeated id is cleared too',()=>{
 const on=hooks('icon',{specialStatusEffects:{DEFEATED:'defeated'}});
 const dead=creating(['dead']),defeated=creating(['defeated']);
 on.get('preCreateActiveEffect')(dead.doc,dead.data,{},'u');on.get('preCreateActiveEffect')(defeated.doc,defeated.data,{},'u');
 assert.equal(dead.doc.flags.core.overlay,true);assert.equal(defeated.doc.flags.core.overlay,false);
});

test('turning an existing defeated effect into an overlay is stopped in icon and effect modes',()=>{
 for(const [mode,expected] of [['overlay',true],['icon',false],['effect',false]]){
  const on=hooks(mode),doc={statuses:new Set(['dead']),flags:{core:{}}};
  const nested={flags:{core:{overlay:true}}},flat={'flags.core.overlay':true};
  on.get('preUpdateActiveEffect')(doc,nested,{},'u');on.get('preUpdateActiveEffect')(doc,flat,{},'u');
  assert.equal(nested.flags.core.overlay,expected,mode);assert.equal(flat['flags.core.overlay'],expected,mode);
 }
 const on=hooks('icon'),other={statuses:new Set(['prone']),flags:{core:{}}},changes={flags:{core:{overlay:true}}};
 on.get('preUpdateActiveEffect')(other,changes,{},'u');assert.equal(changes.flags.core.overlay,true,'other statuses untouched');
});

test('the finisher body ending marks Defeated with the overlay only in overlay mode',async()=>{
 assert.deepEqual(defeatedStatusOptions('overlay'),{active:true,overlay:true});
 assert.deepEqual(defeatedStatusOptions('icon'),{active:true,overlay:false});
 assert.deepEqual(defeatedStatusOptions('effect'),{active:true,overlay:false});
 assert.deepEqual(defeatedStatusOptions('nonsense'),{active:true,overlay:true},'an unknown value is the default');
 for(const [mode,overlay] of [['overlay',true],['icon',false],['effect',false]]){
  const calls=[];await markDefeated({toggleStatusEffect:async(...args)=>calls.push(args)},mode,{specialStatusEffects:{DEFEATED:'dead'}});
  assert.deepEqual(calls,[['dead',{active:true,overlay}]],mode);
 }
 await markDefeated(null,'icon');
});

test('a defeated state is offered only in effect mode, for the defeated status only',()=>{
 const dead={id:'e1',uuid:'Actor.a.ActiveEffect.e1',statuses:new Set(['dead']),disabled:false},prone={id:'e2',uuid:'Actor.a.ActiveEffect.e2',statuses:new Set(['prone'])};
 const actor={uuid:'Actor.a',effects:[dead,prone]};
 assert.deepEqual(defeatedStates(actor,{mode:'overlay',statusId:'dead'}),[]);
 assert.deepEqual(defeatedStates(actor,{mode:'icon',statusId:'dead'}),[]);
 const [state,...rest]=defeatedStates(actor,{mode:'effect',statusId:'dead'});
 assert.equal(rest.length,0);assert.equal(state.uuid,dead.uuid);assert.equal(state.animaterRecipe,DEFEATED_RECIPE);
 assert.deepEqual(defeatedStates({effects:[{...dead,disabled:true}]},{mode:'effect',statusId:'dead'}),[]);
 assert.ok(DEFEATED_RECIPE.stages.some(s=>s.kind==='aura'&&s.persist),'a lasting layer');
 assert.ok(DEFEATED_RECIPE.stages.some(s=>s.assets.some(a=>/toll_the_dead\.grey\.skull_smoke/.test(a))));
});

test('in effect mode a lasting state starts on defeat, shows in Now playing, and ends when the status is removed',async()=>{
 const calls=[],bodies=[],dead={id:'e1',uuid:'Scene.s.Token.t.Actor.a.ActiveEffect.e1',statuses:new Set(['dead'])};
 const actor={uuid:'Actor.a',items:[],effects:[],hasPlayerOwner:false};
 const token={id:'t',name:'Orc',document:{uuid:'Scene.s.Token.t'},actor,visible:true,w:100,h:100};
 let mode='effect';
 const proxy=new Proxy({},{get:(_,method)=>(...args)=>{calls.push([method,...args]);return proxy;}});
 const manager=new PersistentStates({clientId:'c',ready:()=>true,sceneId:()=>'s',tokens:()=>[token],recipes:()=>[],
  state:()=>({enabled:false}),visibility:()=>({isGM:true}),gridSize:()=>100,
  catalog:()=>[{key:'jb2a.toll_the_dead.grey.skull_smoke.01',file:'skull.webm',width:400,height:400}],
  sequence:()=>({effect:()=>proxy,play:async o=>calls.push(['play',o])}),end:async name=>calls.push(['end',name]),
  body:{add:(name,_t,kind)=>bodies.push(['add',name,kind]),remove:name=>bodies.push(['remove',name])},
  builtinStates:t=>defeatedStates(t.actor,{mode,statusId:'dead'})});
 await manager.reconcile();assert.equal(manager.active.size,0,'not defeated yet');
 actor.effects=[dead];await manager.reconcile();
 assert.equal(manager.active.size,1);assert.equal(calls.filter(c=>c[0]==='play').length,1);
 assert.ok(calls.some(c=>c[0]==='persist'));
 assert.deepEqual(calls.find(c=>c[0]==='tieToDocuments')[1],['Scene.s.Token.t',dead.uuid]);
 assert.ok(bodies.some(b=>b[0]==='add'&&b[2]==='stone'),'the body is drained of colour');
 const [row]=manager.running();assert.equal(row.name,'Defeated');assert.equal(row.on,'Orc');
 await manager.stop(row.key);assert.equal(manager.active.size,0,'Stop in Now playing ends it');
 await manager.reconcile();assert.equal(manager.active.size,0,'and it stays off while defeated');
 actor.effects=[];await manager.reconcile();actor.effects=[dead];await manager.reconcile();assert.equal(manager.active.size,1,'defeated again: it shows again');
 const name=[...manager.active.values()][0].name;
 actor.effects=[];await manager.reconcile();
 assert.equal(manager.active.size,0);assert.ok(calls.some(c=>c[0]==='end'&&c[1]===name),'removed: it ends');
 assert.ok(bodies.some(b=>b[0]==='remove'&&b[1]===name));
 actor.effects=[dead];mode='icon';await manager.reconcile();assert.equal(manager.active.size,0,'icon mode: no animation');
 await manager.destroy();
});
