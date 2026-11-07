import test from 'node:test';
import assert from 'node:assert/strict';
import {PersistentStates,FADE_MS,actorStates,justApplied,perceivedStates,activeState,stateVisible,storedStateDocument,nativeAuraStates,shownStates,tokenLookChanged} from '../../../scripts/engines/playback/persistent-states.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe,useStateEntry} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
const fear=PF2E_CONDITIONS.find(e=>e.slug==='frightened'),damage=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage'),bless=PF2E_EFFECTS.find(e=>e.name==='Spell Effect: Bless');
const native=(e,id='i')=>({id,uuid:`Actor.a.Item.${id}`,type:e.kind,name:e.name,slug:e.kind==='condition'?e.slug:undefined,sourceId:e.uuid,system:{active:true,value:{isValued:e.kind==='condition',value:1}},active:true});
function fixture(items=[native(fear)]){
 const calls=[],waits=[],actor={items,hasPlayerOwner:true,isOwner:true},token={id:'t',name:'Caster',document:{uuid:'Scene.s.Token.t'},actor,visible:true,isOwner:true,w:100,h:100},states={condition:{enabled:true,scope:'all'},effect:{enabled:true,scope:'all'}};
 let scene='s',tokens=[token],saved=[],ready=true,visibility={isGM:true},pending=false;
 const h={clientId:'client1',ready:()=>ready,sceneId:()=>scene,tokens:()=>tokens,recipes:()=>saved,state:k=>states[k],visibility:()=>visibility,gridSize:()=>100,catalog:()=>[...PF2E_CONDITIONS,...PF2E_EFFECTS].flatMap(e=>[...e.assets,...Object.values(e.damageVariants??{}).flatMap(v=>v.assets),...(e.auraDesign?.layers??[]).flatMap(l=>l.assets),...Object.values(e.auraDesign?.variants??{}).flatMap(v=>v.layers.flatMap(l=>l.assets))]).map(key=>({key,file:'marker.webm',width:400,height:400})),
 end:async name=>{calls.push(['end',name]);const wait=waits.find(w=>w.name===name);if(wait)wait.resolve();},sequence:()=>{let name;const seq={effect:()=>new Proxy({}, {get:(_,method)=>(...args)=>{calls.push([method,...args]);if(method==='name')name=args[0];return proxy;}}),play:options=>{calls.push(['play',options]);if(!pending)return Promise.resolve();return new Promise(resolve=>waits.push({name,resolve}));}};const proxy=new Proxy({}, {get:(_,method)=>(...args)=>{calls.push([method,...args]);if(method==='name')name=args[0];return proxy;}});seq.effect=()=>proxy;return seq;}};
 const manager=new PersistentStates(h);
 return {manager,calls,token,actor,states,items,waits,setScene:v=>scene=v,setTokens:v=>tokens=v,setSaved:v=>saved=v,setReady:v=>ready=v,setVisibility:v=>visibility=v,setPending:v=>pending=v};
}
const flush=()=>new Promise(r=>setTimeout(r,0));
const stateFxCatalog={tokenReady:true,sceneReady:false,presets:[{name:'blur',library:'tokenshade'}],effects:[]};
test('targeted reconcile resolves only changed token, preserves other active and stopped states',async()=>{
 const f=fixture(),second={...f.token,id:'other',document:{uuid:'Scene.s.Token.other'}};
 f.setTokens([f.token,second]);await f.manager.reconcile();await flush();
 const other=[...f.manager.active.values()].find(r=>r.token===second);
 let resolved=0,catalogReads=0;
 const catalog=f.manager.host.catalog;f.manager.host.catalog=()=>{catalogReads++;return catalog();};
 f.manager.host.resolveStateRecipe=(...args)=>{resolved++;return stateRecipe(fear);};
 f.manager.stopped.add('s:Scene.s.Token.other:unrelated');
 await f.manager.reconcile(new Set(['t']));await flush();
 assert.equal(resolved,1);assert.equal(f.manager.active.get(other.key),other);
 assert.ok(f.manager.stopped.has('s:Scene.s.Token.other:unrelated'));
 assert.ok(catalogReads<=2,'one snapshot plus changed record startup, never per-state snapshots');
 await f.manager.destroy();
});
test('debounced targeted changes merge; a global refresh takes precedence',async()=>{
 const f=fixture(),scopes=[];f.manager.reconcile=async scope=>scopes.push(scope);
 f.manager.schedule(['one']);f.manager.schedule(['two']);await new Promise(r=>setTimeout(r,60));
 assert.deepEqual([...scopes[0]],['one','two']);
 f.manager.schedule();f.manager.schedule(['three']);await new Promise(r=>setTimeout(r,60));
 assert.equal(scopes[1],undefined);await f.manager.destroy();
});
test('native expiry, visibility, mesh recreation and catalog FX changes clean document-linked filters',async()=>{
 const entry=PF2E_CONDITIONS.find(e=>e.slug==='concealed'),item=native(entry),f=fixture([item]),retained=new Set();let enabled=true;
 f.token.mesh={uid:1};f.manager.host.resolveStateRecipe=()=>stateRecipe(entry,{fx:enabled,fxCatalog:stateFxCatalog});
 f.manager.host.retainFx=async(stage,{session})=>{assert.equal(stage.destination,f.token);assert.equal(stage.persist,true);retained.add(session);};
 f.manager.host.stopFx=async session=>retained.delete(session);
 await f.manager.reconcile();await flush();assert.equal(retained.size,1);
 const first=[...retained][0];await f.manager.reconcile();await flush();assert.ok(retained.has(first));
 f.token.mesh.uid=2;await f.manager.reconcile();await flush();assert.equal(retained.size,1);assert.ok(!retained.has(first));
 enabled=false;await f.manager.reconcile();await flush();assert.equal(retained.size,0);assert.equal(f.manager.active.size,1,'JB2A remains');
 enabled=true;await f.manager.reconcile();await flush();assert.equal(retained.size,1);
 f.token.visible=false;await f.manager.reconcile();assert.equal(retained.size,0);
 f.token.visible=true;await f.manager.reconcile();await flush();assert.equal(retained.size,1);
 f.actor.items=[];await f.manager.reconcile();assert.equal(retained.size,0);
 await f.manager.destroy();
});
test('a failed optional persistent shader never prevents the native JB2A state layer',async()=>{
 const entry=PF2E_CONDITIONS.find(e=>e.slug==='concealed'),f=fixture([native(entry)]),traces=[];
 f.manager.host.resolveStateRecipe=()=>stateRecipe(entry,{fxCatalog:stateFxCatalog});
 f.manager.host.retainFx=async()=>{throw Error('Shader failed');};f.manager.host.trace=(...args)=>traces.push(args);
 await f.manager.reconcile();await flush();assert.equal(f.calls.filter(c=>c[0]==='play').length,1);
 assert.equal(f.manager.active.size,1);assert.ok(traces.some(t=>t[0]==='Skipped'&&t[1].includes('Shader failed')));
 await f.manager.destroy();
});
test('Frightened and Wounded persistent canvas effects attach centered on small, large and rectangular tokens',async()=>{
 for(const slug of ['frightened','wounded'])for(const [w,h] of [[100,100],[200,200],[100,200]]){
  const entry=PF2E_CONDITIONS.find(e=>e.slug===slug),f=fixture([native(entry)]);
  Object.assign(f.token,{w,h});await f.manager.reconcile();
  assert.deepEqual(f.calls.find(c=>c[0]==='attachTo')[2].offset,{x:0,y:0},`${slug} ${w}x${h}`);
  assert.ok(!f.calls.some(c=>c[0]==='atLocation'), 'offset must be applied only once');
  await f.manager.destroy();
 }
});
test('Unconscious uses its installed edition visible-symbol anchor in native Sequencer playback',async()=>{
 const entry=PF2E_CONDITIONS.find(e=>e.slug==='unconscious');
 for(const edition of ['free','patreon']){
  const media=entry.conditionDesign.layers[0].editions[edition],f=fixture([native(entry)]);
  f.manager.host.catalog=()=>[{key:media.key,file:media.files[0],width:400,height:400}];
  await f.manager.reconcile();
  assert.deepEqual(f.calls.find(c=>c[0]==='anchor')[1],media.anchor);
  assert.deepEqual(f.calls.find(c=>c[0]==='attachTo')[2].offset,{x:0,y:-.2});
  await f.manager.destroy();
 }
});
test('active states start once, attach to native token and Item, stay indefinitely, and end only their own namespace on removal',async()=>{
 const f=fixture();f.setPending(true);await f.manager.reconcile();await f.manager.reconcile();
 assert.equal(f.calls.filter(c=>c[0]==='play').length,1);assert.deepEqual(f.calls.find(c=>c[0]==='play')[1],{local:true});
 assert.ok(f.calls.some(c=>c[0]==='persist'));assert.ok(f.calls.some(c=>c[0]==='temporary'));assert.ok(!f.calls.some(c=>c[0]==='duration'));
 assert.deepEqual(f.calls.find(c=>c[0]==='tieToDocuments')[1],['Scene.s.Token.t','Actor.a.Item.i']);
 assert.equal(f.calls.find(c=>c[0]==='attachTo')[2].bindVisibility,true);
 const name=[...f.manager.active.values()][0].name;assert.ok(name.startsWith('animater-state-client1-'));
 f.actor.items=[];await f.manager.reconcile();await flush();assert.equal(f.manager.active.size,0);assert.ok(f.calls.some(c=>c[0]==='end'&&c[1]===name));
});
test('effect expiry without deletion, secret visibility, and catalog pause remove retained visual layers',async()=>{
 const item=native(bless),f=fixture([item]);await f.manager.reconcile();assert.equal(f.manager.active.size,1);
 item.isExpired=true;await f.manager.reconcile();assert.equal(f.manager.active.size,0);assert.equal(f.actor.items.length,1);
 item.isExpired=false;await f.manager.reconcile();item.system.unidentified=true;f.setVisibility({isGM:false});await f.manager.reconcile();assert.equal(f.manager.active.size,0);
 f.setVisibility({isGM:true});await f.manager.reconcile();f.states.effect.enabled=false;await f.manager.reconcile();assert.equal(f.manager.active.size,0);
});
// The width of each aura reach ring drawn so far (its Zoning footage), in order.
const reachWidths=f=>{let file;return f.calls.flatMap(c=>c[0]==='file'?(file=c[1],[]):c[0]==='size'&&/zoning/.test(file)?[c[1].width]:[]);};
test('native Form a Flock aura covers its ten-foot reach beyond the bearer footprint',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Form a Flock'),item=native(entry),f=fixture([item]);
 item.system.rules=[{key:'Aura',radius:10}];
 f.actor.auras=new Map([[entry.slug,{slug:entry.slug,radius:10,effects:[]}]]);
 await f.manager.reconcile();
 assert.deepEqual(reachWidths(f),[500]);
 await f.manager.destroy();
});
test('prepared radius drives dynamic aura growth, grid distance changes and cleanup',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Manifest Will'),item=native(entry),f=fixture([item]);
 item.system.rules=[{key:'Aura',slug:'manifest-will',radius:'@item.flags.pf2e.auraRadius'}];
 const aura={slug:'manifest-will',radius:10,effects:[]};f.actor.auras=new Map([[aura.slug,aura]]);
 await f.manager.reconcile();const first=[...f.manager.active.values()][0].name;
 assert.equal(reachWidths(f).at(-1),500);
 aura.radius=20;await f.manager.reconcile();
 assert.equal(reachWidths(f).at(-1),900);
 assert.ok(f.calls.some(c=>c[0]==='end'&&c[1]===first));
 f.manager.host.gridDistance=()=>10;await f.manager.reconcile();
 assert.equal(reachWidths(f).at(-1),500);
 f.actor.auras.clear();await f.manager.reconcile();
 assert.ok([...f.manager.active.values()].every(r=>!r.item.animaterAura));
 await f.manager.destroy();
});
test('Demon\'s Knot emits thirty feet from equipment bearer; its penalty recipient stays token-sized',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==="Aura: Demon's Knot"),recipient=native(entry),f=fixture([recipient]);
 assert.equal(stateRecipe(entry).stages.find(s=>s.auraRadius).auraRadius,30);
 const source={id:'knot',uuid:'Actor.a.Item.knot',name:"Demon's Knot",type:'equipment',sourceId:entry.auraSources.find(s=>s.slug==='demons-knot').uuid,system:{rules:[{key:'Aura',slug:'demons-knot',radius:30}]}};
 f.actor.items.push(source);f.actor.auras=new Map([['demons-knot',{slug:'demons-knot',radius:30,effects:[{parent:source,uuid:"Compendium.pf2e.equipment-effects.Item.Aura: Demon's Knot"}]}]]);
 await f.manager.reconcile();
 const fields=[...f.manager.active.values()].filter(r=>r.item.animaterAura);
 assert.equal(fields.length,1);assert.ok(fields[0].recipe.stages.filter(s=>s.auraRadius).every(s=>s.auraRadius===30));
 assert.ok(reachWidths(f).includes(1300),'its reach ring spans thirty feet');
 assert.ok(f.calls.some(c=>c[0]==='size'&&c[1].width===150));
 assert.ok(f.calls.some(c=>c[0]==='tieToDocuments'&&c[1].includes(source.uuid)));
 f.actor.items=[recipient];f.actor.auras.clear();await f.manager.reconcile();
 assert.equal(f.manager.active.size,1);assert.equal([...f.manager.active.values()][0].recipe.stages[0].auraRadius,undefined);
 await f.manager.destroy();
});
test("an aura's own creature shows the aura, not also the effect its aura hands back to it; others keep theirs",()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Manifest Will'),source=native(entry,'src');
 source.system.rules=[{key:'Aura',slug:'manifest-will',radius:30}];
 const self={...native(bless,'self'),flags:{pf2e:{aura:{slug:'manifest-will',origin:'Actor.a'}}}};
 const other={...native(bless,'other'),flags:{pf2e:{aura:{slug:'manifest-will',origin:'Actor.b'}}}};
 const actor={uuid:'Actor.a',items:[source,self,other],auras:new Map([['manifest-will',{slug:'manifest-will',radius:30,effects:[]}]])};
 const ids=actorStates(actor).map(i=>i.animaterAura?'aura':i.id);
 assert.ok(ids.includes('aura'));assert.ok(!ids.includes('self'),'its own copy');assert.ok(ids.includes('other'),"another creature's aura");
});
test('multiple prepared auras from one Item retain separate keys and disappear independently',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.auras?.length===2),item=native(entry),f=fixture([item]);
 item.system.rules=entry.auras.map((a,i)=>({key:'Aura',slug:`${a.slug}-${i}`,radius:10}));
 f.actor.auras=new Map(entry.auras.map((a,i)=>[`${a.slug}-${i}`,{slug:`${a.slug}-${i}`,radius:10+i*5,effects:[]}]));
 assert.equal(nativeAuraStates(f.actor).length,2);await f.manager.reconcile();assert.equal(f.manager.active.size,2);
 f.actor.auras.delete(`${entry.auras[0].slug}-0`);await f.manager.reconcile();assert.equal(f.manager.active.size,1);
 await f.manager.destroy();
});
test('all field layers share one native lifetime and end together when an emitter disappears',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Protective Wards'),item=native(entry),f=fixture([item]);
 item.system.rules=[{key:'Aura',slug:'protective-wards',radius:15}];f.actor.auras=new Map([['protective-wards',{slug:'protective-wards',radius:15,effects:[]}]]);
 await f.manager.reconcile();assert.equal(f.calls.filter(c=>c[0]==='file').length,4);
 const names=f.calls.filter(c=>c[0]==='name').map(c=>c[1]);assert.equal(new Set(names).size,1);
 assert.ok(f.calls.filter(c=>c[0]==='tieToDocuments').every(c=>c[1].includes(item.uuid)));
 f.actor.items=[];f.actor.auras.clear();await f.manager.reconcile();assert.equal(f.manager.active.size,0);
 assert.equal(f.calls.filter(c=>c[0]==='end'&&c[1]===names[0]).length,1);await f.manager.destroy();
});
test('multiple actual contributors to a merged aura retain their own designs and final native radius',()=>{
 const one=PF2E_EFFECTS.find(e=>e.name==='Stance: Shattershields'),two=PF2E_EFFECTS.find(e=>e.name==='Stance: Kindle Inner Flames');
 const a=native(one,'plates'),b=native(two,'embers');for(const item of [a,b])item.system.rules=[{key:'Aura',slug:'kinetic-aura',radius:10}];
 const actor={items:[a,b],auras:new Map([['kinetic-aura',{slug:'kinetic-aura',radius:20,effects:[{parent:a},{parent:b}]}]])};
 const states=nativeAuraStates(actor);assert.deepEqual(states.map(i=>i.animaterAura.entryId),[one.id,two.id]);assert.ok(states.every(i=>i.animaterAura.radius===20));
});
test('lower duplicate and overridden conditions stay quiet; value handover changes tie document',async()=>{
 const lower=native(fear,'low'),higher=native(fear,'high');lower.active=false;higher.system.value.value=2;const f=fixture([lower,higher]);await f.manager.reconcile();assert.equal(f.manager.active.size,1);
 higher.active=false;lower.active=true;await f.manager.reconcile();
 // Same condition key can change backing native Item; never retain its old tie.
 assert.ok(f.calls.filter(c=>c[0]==='tieToDocuments').some(c=>c[1].includes(lower.uuid)));
 lower.active=false;await f.manager.reconcile();assert.equal(f.manager.active.size,0);
});
test('persistent damage types have separate identities and tracks disappear independently',async()=>{
 const fire=native(damage,'fire'),bleed=native(damage,'bleed');fire.system.persistent={damageType:'fire'};bleed.system.persistent={damageType:'bleed'};const f=fixture([fire,bleed]);await f.manager.reconcile();assert.equal(f.manager.active.size,2);
 assert.ok(f.calls.some(c=>c[0]==='file'&&/flames/.test(c[1])));assert.ok(f.calls.some(c=>c[0]==='file'&&/drop/.test(c[1])));
 f.actor.items=[bleed];await f.manager.reconcile();assert.equal(f.manager.active.size,1);
});
test('scene clear, token deletion, and reload rebuild still-active states without stale flags',async()=>{
 const f=fixture();await f.manager.reconcile();const first=[...f.manager.active.values()][0].name;await f.manager.clear();assert.equal(f.manager.accepts(first),false);
 f.setScene('new-scene');await f.manager.reconcile();assert.equal(f.manager.active.size,1);assert.notEqual([...f.manager.active.values()][0].name,first);
 f.setTokens([]);await f.manager.reconcile();assert.equal(f.manager.active.size,0);
 f.setTokens([f.token]);await f.manager.reconcile();f.setReady(false);await f.manager.reconcile();assert.equal(f.manager.active.size,0);await f.manager.destroy();
});
test('local viewer gates never change native documents or reveal unidentified / unseen states',()=>{
 const token={visible:true,isOwner:true,actor:{isOwner:true,hasPlayerOwner:true},document:{}},effect=native(bless);
 effect.system.unidentified=true;assert.equal(stateVisible(effect,token,{isGM:false}),false);
 token.visible=false;assert.equal(stateVisible(effect,token,{isGM:true}),false);token.visible=true;token.document.hidden=true;assert.equal(stateVisible(effect,token,{isGM:false}),false);
 token.document.hidden=false;token.actor.hasPlayerOwner=false;assert.equal(stateVisible(native(fear),token,{secretConditions:true}),false);
 assert.equal(activeState({...native(fear),active:false}),false);assert.equal(activeState({...effect,isExpired:true}),false);
});
test('derived conditions tie to stored granters; granter cycles fail closed; ownership transitions clear visuals',async()=>{
 const grant=native(bless,'grant'),derived={...native(fear,'derived'),isInMemoryOnly:true,appliedBy:grant},f=fixture([grant]);f.actor.conditions={active:[derived]};await f.manager.reconcile();
 assert.ok(f.calls.filter(c=>c[0]==='tieToDocuments').every(c=>!c[1].includes(derived.uuid)));
 assert.equal(storedStateDocument(derived),grant.uuid);derived.appliedBy=derived;assert.equal(storedStateDocument(derived),null);
 const hidden=PF2E_CONDITIONS.find(e=>e.slug==='hidden');f.actor.conditions.active=[native(hidden)];f.actor.items=[];await f.manager.reconcile();f.setVisibility({isGM:false});f.token.isOwner=false;f.actor.isOwner=false;await f.manager.reconcile();assert.equal(f.manager.active.size,0);
});
test('custom edits replace exact layers, disabled recipes stop them, and deletion during startup cancels late-created effects',async()=>{
 const f=fixture(),custom={...stateRecipe(fear),name:'Quiet Fear'};f.states.condition={...useStateEntry({},fear.id),customized:[fear.id]};f.setSaved([custom]);await f.manager.reconcile();const old=[...f.manager.active.values()][0].name;
 f.setSaved([{...custom,stages:custom.stages.map(s=>({...s,scale:1.5}))}]);await f.manager.reconcile();assert.notEqual([...f.manager.active.values()][0].name,old);assert.equal(f.manager.accepts(old),false);
 const fresh=[...f.manager.active.values()][0].name;f.setSaved([{...custom,enabled:false}]);await f.manager.reconcile();assert.equal(f.manager.accepts(fresh),false);assert.equal(f.manager.active.size,0);
 assert.equal(f.manager.accepts('other-module-animation'),true);await f.manager.destroy();
});

test('Play once, then fade: a freshly applied effect plays for a moment and fades; one already on the token stays quiet',async()=>{
 const entry=PF2E_EFFECTS.find(e=>stateRecipe(e).stages.some(s=>s.kind==='aura'&&s.persist&&!s.auraRadius));
 const fresh=fixture([{...native(entry),_stats:{createdTime:Date.now()}}]);fresh.states.effect.fade=true;
 await fresh.manager.reconcile();await flush();
 assert.ok(fresh.calls.some(c=>c[0]==='file'));assert.ok(!fresh.calls.some(c=>c[0]==='persist'),'not lasting');
 assert.ok(fresh.calls.some(c=>c[0]==='duration'&&c[1]===FADE_MS));
 const calls=fresh.calls.length;await fresh.manager.reconcile();await flush();
 assert.equal(fresh.calls.filter((c,i)=>i>=calls&&c[0]==='play').length,0,'it does not replay while the effect lasts');
 await fresh.manager.destroy();
 const old=fixture([{...native(entry),_stats:{createdTime:Date.now()-60000}}]);old.states.effect.fade=true;
 await old.manager.reconcile();await flush();
 assert.equal(old.calls.filter(c=>c[0]==='file').length,0,'a reload does not replay an effect that was already there');
 await old.manager.destroy();
 const lasting=fixture([{...native(entry),_stats:{createdTime:Date.now()-60000}}]);
 await lasting.manager.reconcile();await flush();
 assert.ok(lasting.calls.some(c=>c[0]==='persist'),'the default stays while active');
 await lasting.manager.destroy();
});
test('Play once: hiding, re-showing or redrawing the token never replays it; removing and reapplying does',async()=>{
 const entry=PF2E_EFFECTS.find(e=>stateRecipe(e).stages.some(s=>s.kind==='aura'&&s.persist&&!s.auraRadius));
 for(const stats of [{_stats:{createdTime:Date.now()}},{}]){
  const item={...native(entry),...stats},f=fixture([item]);f.states.effect.fade=true;f.token.mesh={uid:1};
  const plays=()=>f.calls.filter(c=>c[0]==='play').length;
  await f.manager.reconcile();await flush();assert.equal(plays(),1);
  f.token.visible=false;await f.manager.reconcile();await flush();
  f.token.visible=true;await f.manager.reconcile();await flush();
  f.token.mesh.uid=2;await f.manager.reconcile();await flush();
  assert.equal(plays(),1,'seen again (another observer, a redraw): not applied again');
  f.actor.items=[];await f.manager.reconcile();await flush();
  f.actor.items=[{...native(entry),_stats:{createdTime:Date.now()}}];await f.manager.reconcile();await flush();
  assert.equal(plays(),2,'a real reapplication animates');
  await f.manager.destroy();
 }
});
test('justApplied reads the wrapped document of a D&D 5e or Daggerheart state, and an aura its source',()=>{
 assert.equal(justApplied({document:{_stats:{createdTime:1000}}},60000),false);
 assert.equal(justApplied({animaterAura:{source:{_stats:{createdTime:1000}}}},60000),false);
});
test('a token deleted while its animation is queued is not drawn on; missing documents are never tied (no Sequencer errors)',async()=>{
 const gone=fixture();gone.manager.host.tokenAlive=()=>false;
 await gone.manager.reconcile();await flush();
 assert.equal(gone.calls.filter(c=>c[0]==='file'||c[0]==='tieToDocuments'||c[0]==='play').length,0);
 await gone.manager.destroy();
 const partial=fixture();partial.manager.host.documentExists=uuid=>!uuid.includes('Item');
 await partial.manager.reconcile();await flush();
 assert.ok(partial.calls.filter(c=>c[0]==='tieToDocuments').every(c=>c[1].every(u=>!u.includes('Item'))));
 await partial.manager.destroy();
});
test("a saved recipe keeps its own Below tokens choice: a shield dome left on top stays on top",async()=>{
 const effect=PF2E_EFFECTS.find(e=>stateRecipe(e).stages.some(s=>s.kind==='aura'&&s.persist&&!s.auraRadius));
 const custom={...stateRecipe(effect),name:'My Shield',stages:stateRecipe(effect).stages.map(s=>({...s,assets:['jb2a.shield.01.loop.blue'],below:false,scale:1.2}))};
 const f=fixture([native(effect)]);f.states.effect={...useStateEntry({},effect.id),customized:[effect.id]};f.setSaved([custom]);
 await f.manager.reconcile();await flush();
 assert.match(String(f.calls.find(c=>c[0]==='file')?.[1]),/shield/);
 assert.ok(!f.calls.some(c=>c[0]==='belowTokens'),'not forced under the token');
 await f.manager.destroy();
});
test('square opaque token art (no dynamic ring): layers that would hide under it go on top, filling footage at half',async()=>{
 const net=PF2E_EFFECTS.find(e=>e.name==='Effect: Hurl Net');
 const marker=PF2E_EFFECTS.find(e=>stateRecipe(e).stages.some(s=>s.kind==='aura'&&s.persist&&s.below&&!s.auraRadius&&/markers\.(?!chain)/.test(s.assets[0])));
 const round=fixture([native(net)]);await round.manager.reconcile();await flush();
 const roundOpacity=round.calls.find(c=>c[0]==='opacity')[1];assert.ok(round.calls.some(c=>c[0]==='belowTokens'),'round art: under');await round.manager.destroy();
 const sq=fixture([native(net)]);sq.manager.host.opaqueArt=()=>true;await sq.manager.reconcile();await flush();
 assert.ok(!sq.calls.some(c=>c[0]==='belowTokens'),'square art: on top');assert.ok(Math.abs(sq.calls.find(c=>c[0]==='opacity')[1]-roundOpacity/2)<1e-9,'web at half');await sq.manager.destroy();
 const ring=fixture([native(marker)]);ring.manager.host.opaqueArt=()=>true;await ring.manager.reconcile();await flush();
 assert.ok(!ring.calls.some(c=>c[0]==='belowTokens'),'marker ring on top');await ring.manager.destroy();
 // Round art whose frame reaches the edge (Tokenizer portraits) hid a ring just outside it: hollow rings go on top of any token.
 const roundRing=fixture([native(marker)]);await roundRing.manager.reconcile();await flush();
 assert.ok(!roundRing.calls.some(c=>c[0]==='belowTokens'),'marker ring on top of round art too');
 assert.equal(roundRing.calls.find(c=>c[0]==='opacity')[1]>0.5,true,'hollow rings keep their strength');await roundRing.manager.destroy();
 const own=fixture([native(net)]);own.states.effect={...useStateEntry({},net.id),customized:[net.id]};own.setSaved([{...stateRecipe(net),stages:stateRecipe(net).stages.map(s=>({...s,below:true}))}]);own.manager.host.opaqueArt=()=>true;
 await own.manager.reconcile();await flush();assert.ok(own.calls.some(c=>c[0]==='belowTokens'),"a saved recipe's Below tokens is kept");await own.manager.destroy();
});
test("a net's web is drawn under the token, never over the creature's face",async()=>{
 const net=PF2E_EFFECTS.find(e=>e.name==='Effect: Hurl Net');
 const f=fixture([native(net)]);await f.manager.reconcile();await flush();
 assert.match(String(f.calls.find(c=>c[0]==='file')?.[1]),/web/);
 assert.ok(f.calls.some(c=>c[0]==='belowTokens'));
 await f.manager.destroy();
});
test('justApplied: only effects created moments ago count as just applied; unknown creation counts as new',()=>{
 assert.equal(justApplied({_stats:{createdTime:1000}},5000),true);
 assert.equal(justApplied({_stats:{createdTime:1000}},60000),false);
 assert.equal(justApplied({}),true);
});
test('Unconscious hides the Blinded it brings; Blinded and Dazzled alone still count',()=>{
 const c=(slug)=>({type:'condition',slug,name:slug});
 assert.deepEqual(shownStates([c('unconscious'),c('blinded'),c('off-guard')]).map(i=>i.slug),['unconscious','off-guard']);
 assert.deepEqual(shownStates([c('blinded'),c('dazzled')]).map(i=>i.slug),['blinded','dazzled']);
 assert.deepEqual(shownStates([{type:'effect',slug:'blinded'},c('unconscious')]).length,2,'only conditions are folded');
});
test('the selected Dazzled token sees everyone else as Concealed; Blinded changes nothing on others',()=>{
 const me={id:'me'},other={id:'o'};
 assert.deepEqual(perceivedStates(['dazzled'],other,me).map(i=>i.slug),['concealed']);
 assert.deepEqual(perceivedStates(['blinded'],other,me),[]);
 assert.deepEqual(perceivedStates(['dazzled'],me,me),[],'not on the observer itself');
 assert.deepEqual(perceivedStates(['off-guard'],other,me),[]);
 assert.deepEqual(perceivedStates(['dazzled'],other,null),[]);
 const [seen]=perceivedStates(['dazzled'],other,me);assert.deepEqual(shownStates([seen]),[seen],'the stand-in itself still shows');
});
test('Dazzled animates its own token too (JB2A layer and motion), not only how others look',async()=>{
 const entry=PF2E_CONDITIONS.find(e=>e.slug==='dazzled'),f=fixture([native(entry)]),bodies=[];f.manager.host.body={add:(...a)=>bodies.push(a),remove:()=>{}};
 await f.manager.reconcile();await flush();
 assert.ok(f.calls.filter(c=>c[0]==='file').length>0);assert.equal(bodies.length,1);
 await f.manager.destroy();
});
test('Dazzled shows its own Tokenshade look on the token',async()=>{
 const entry=PF2E_CONDITIONS.find(e=>e.slug==='dazzled'),f=fixture([native(entry)]),retained=[];
 f.token.mesh={uid:1};f.manager.host.body={add:()=>{},remove:()=>{}};
 f.manager.host.resolveStateRecipe=()=>stateRecipe(entry,{fxCatalog:{...stateFxCatalog,presets:[{name:'Dazzled',library:'tokenshade'}]}});
 f.manager.host.retainFx=async stage=>{retained.push(stage.fxPreset);};
 await f.manager.reconcile();await flush();
 assert.deepEqual(retained,['Dazzled']);assert.equal(f.calls.filter(c=>c[0]==='file').length,0);
 await f.manager.destroy();
});
test('a perceived Concealed plays tied to the token only, never to its missing stand-in document',async()=>{
 const f=fixture([]);f.manager.host.perceivedStates=token=>perceivedStates(['dazzled'],token,{id:'observer'});
 await f.manager.reconcile();
 const ties=f.calls.filter(c=>c[0]==='tieToDocuments');assert.ok(ties.length);assert.ok(ties.every(c=>c[1].length===1&&c[1][0]==='Scene.s.Token.t'));
 await f.manager.destroy();
});
test('a condition whose value changes (Frightened 2 to 1 at turn end) keeps showing until its replacement plays',async()=>{
 const item=native(fear);item.system.value.value=2;const f=fixture([item]);
 await f.manager.reconcile();await flush();
 const first=[...f.manager.active.values()][0].name;
 f.setPending(true);item.system.value.value=1;
 const done=f.manager.reconcile();await flush();
 assert.ok(!f.calls.some(c=>c[0]==='end'&&c[1]===first),'the old look is still up while the new one loads');
 f.waits.forEach(w=>w.resolve());await done;await flush();
 assert.ok(f.calls.some(c=>c[0]==='end'&&c[1]===first),'then it ends');
 assert.equal(f.manager.active.size,1);
 await f.manager.destroy();
});
test('a value change that sets off several updates at once still keeps the old look until the new one is up',async()=>{
 const item=native(fear);item.system.value.value=2;const f=fixture([item]);
 await f.manager.reconcile();await flush();
 const first=[...f.manager.active.values()][0].name;
 f.setPending(true);item.system.value.value=1;
 // PF2e updates the item, then the actor: two reconciles before the first is done.
 const a=f.manager.reconcile(),b=f.manager.reconcile();await flush();
 assert.ok(!f.calls.some(c=>c[0]==='end'&&c[1]===first),'the old look is still up while the new one loads');
 f.waits.forEach(w=>w.resolve());await Promise.all([a,b]);await flush();
 assert.ok(f.calls.some(c=>c[0]==='end'&&c[1]===first),'then it ends');
 assert.equal(f.manager.active.size,1);
 await f.manager.destroy();
});
test('the old look stays until the new one has faded in, so the plain token never shows between levels',async()=>{
 const item=native(fear);item.system.value.value=2;const f=fixture([item]);f.manager.host.lookBlendMs=()=>60;
 await f.manager.reconcile();await flush();
 const first=[...f.manager.active.values()][0].name;
 item.system.value.value=1;
 const done=f.manager.reconcile();await flush();
 assert.ok(!f.calls.some(c=>c[0]==='end'&&c[1]===first),'still up while the new look fades in');
 await done;await new Promise(r=>setTimeout(r,250));
 assert.ok(f.calls.some(c=>c[0]==='end'&&c[1]===first),'then it ends');
 await f.manager.destroy();
});

test('the catalog Token motion switch decides whether creatures react to their conditions',async()=>{
 const f=fixture([native(fear)]),bodies=[];f.manager.host.body={add:(name,token,kind)=>bodies.push(kind),remove:()=>{}};
 await f.manager.reconcile();await flush();assert.deepEqual(bodies,['tremble']);
 f.states.condition.motion=false;await f.manager.reconcile();await flush();
 assert.deepEqual(bodies,['tremble'],'Effects only: the visuals replay without the body motion');
 assert.equal(f.manager.active.size,1);
 await f.manager.destroy();
});
test('covers: a condition Animater shows itself is reported, so Automated Animations can be stopped for it',()=>{
 const f=fixture([native(fear)]);
 assert.equal(f.manager.covers(native(fear)),true,'catalog on: Animater shows Frightened');
 f.states.condition.enabled=false;
 assert.equal(f.manager.covers(native(fear)),false,'catalog paused: AA may play it');
 assert.equal(f.manager.covers(null),false);
});
test('an effect handed out by another creature\'s aura is drawn token-sized on the ally, not as the aura ring',async()=>{
 const {grantedByOtherAura}=await import('../../../scripts/engines/playback/persistent-states.mjs');
 const token={actor:{uuid:'Actor.ally'}};
 assert.equal(grantedByOtherAura({flags:{pf2e:{aura:{origin:'Actor.caster',slug:'protective-ward'}}}},token),true);
 assert.equal(grantedByOtherAura({flags:{pf2e:{aura:{origin:'Actor.ally'}}}},token),false,'the aura owner keeps the ring');
 assert.equal(grantedByOtherAura({flags:{pf2e:{}}},token),false,'cast directly on the creature');
});
test('an ally inside Angelic Halo keeps its marker ring at full width, framing the token on top, not squeezed behind the art',async()=>{
 const halo=PF2E_EFFECTS.find(e=>/Angelic Halo/.test(e.name)&&e.auraDesign);
 const ally=fixture([{...native(halo),flags:{pf2e:{aura:{origin:'Actor.caster',slug:'angelic-halo'}}}}]);ally.actor.uuid='Actor.ally';
 await ally.manager.reconcile();await flush();
 assert.match(String(ally.calls.find(c=>c[0]==='file')[1]),/markers\./);
 assert.ok(ally.calls.find(c=>c[0]==='size')[1].width>=150,'the ring reaches past a round token');
 assert.ok(!ally.calls.some(c=>c[0]==='belowTokens'),'a hollow ring frames the token on top');
 await ally.manager.destroy();
});
test('an ally inside someone else\'s aura gets a quiet copy: one layer, dimmer; the owner keeps every layer',async()=>{
 const wards=PF2E_EFFECTS.find(e=>e.name==='Spell Effect: Protective Wards');
 const owner=fixture([native(wards)]);
 await owner.manager.reconcile();await flush();
 const ownerFiles=owner.calls.filter(c=>c[0]==='file').length,ownerOpacity=owner.calls.find(c=>c[0]==='opacity')[1];
 const allyItem={...native(wards),flags:{pf2e:{aura:{origin:'Actor.caster',slug:'protective-ward'}}}};
 const ally=fixture([allyItem]);ally.actor.uuid='Actor.ally';
 await ally.manager.reconcile();await flush();
 assert.ok(ownerFiles>=1);
 assert.equal(ally.calls.filter(c=>c[0]==='file').length,1,'the ally shows one quiet layer');
 assert.ok(ally.calls.find(c=>c[0]==='opacity')[1]<=ownerOpacity*.8+1e-9);
 assert.doesNotMatch(String(ally.calls.find(c=>c[0]==='file')[1]),/template_circle/,"the aura's own glyph, not the generic ring");
 await owner.manager.destroy();await ally.manager.destroy();
});

// Each player's "Lasting condition animations (this device)" choice.
test('lasting mode: the GM\'s choice by default; a player can keep layers on, play them once, or replay them at turn start', async () => {
  const { lastingFade, LASTING_MODES } = await import('../../../scripts/engines/playback/persistent-states.mjs');
  assert.deepEqual(Object.keys(LASTING_MODES), ['world', 'always', 'turn', 'once']);
  assert.equal(lastingFade(true, 'world'), true);
  assert.equal(lastingFade(false, 'world'), false);
  assert.equal(lastingFade(true, 'always'), false);
  assert.equal(lastingFade(false, 'turn'), true);
  assert.equal(lastingFade(false, 'once'), true);
  assert.equal(lastingFade(true, undefined), true, 'unknown: the GM\'s choice');
});
const auraEntry = () => PF2E_EFFECTS.find(e => stateRecipe(e).stages.some(s => s.kind === 'aura' && s.persist && !s.auraRadius));
test('a player\'s Always visible keeps a layer the GM set to play once; Play once fades a layer the GM keeps', async () => {
  const entry = auraEntry();
  const keep = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }]); keep.states.effect.fade = true; keep.manager.host.lastingMode = () => 'always';
  await keep.manager.reconcile(); await flush();
  assert.ok(keep.calls.some(c => c[0] === 'persist'), 'always visible');
  await keep.manager.destroy();
  const once = fixture([{ ...native(entry), _stats: { createdTime: Date.now() } }]); once.manager.host.lastingMode = () => 'once';
  await once.manager.reconcile(); await flush();
  assert.ok(once.calls.some(c => c[0] === 'duration' && c[1] === FADE_MS), 'played once on application');
  assert.ok(!once.calls.some(c => c[0] === 'persist'));
  const before = once.calls.length; await once.manager.replay(once.token); await flush();
  assert.equal(once.calls.slice(before).filter(c => c[0] === 'play').length, 0, 'Play once never replays at turn start');
  await once.manager.destroy();
});
test('On application and at its turn start: a quiet layer replays briefly when the token\'s turn starts, conditions staggered', async () => {
  const entry = auraEntry();
  const f = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }, { ...native(fear, 'f'), _stats: { createdTime: Date.now() - 60000 } }]);
  f.manager.host.lastingMode = () => 'turn';
  await f.manager.reconcile(); await flush();
  assert.equal(f.calls.filter(c => c[0] === 'file').length, 0, 'already on the token: nothing on reload');
  const traces = []; f.manager.host.trace = (...a) => traces.push(a);
  await f.manager.replay(f.token); await flush();
  assert.ok(f.calls.some(c => c[0] === 'file'), 'replayed at turn start');
  assert.ok(f.calls.filter(c => c[0] === 'duration').every(c => c[1] === FADE_MS), 'briefly, then fades');
  const delays = f.calls.filter(c => c[0] === 'delay').map(c => c[1]);
  assert.ok(Math.max(...delays) >= 350, `the second condition waits its turn (${delays})`);
  assert.ok(!traces.some(t => t[0] === 'Persistent'), 'a replay adds no Activity row');
  const other = { ...f.token, id: 'other', document: { uuid: 'Scene.s.Token.other' } }, before = f.calls.length;
  await f.manager.replay(other); await flush();
  assert.equal(f.calls.slice(before).filter(c => c[0] === 'play').length, 0, 'another token\'s turn replays nothing here');
  await f.manager.destroy();
});
test('the catalog\'s Play once and at turn start replays at turn start when the player follows the catalog', async () => {
  const entry = auraEntry();
  const f = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }]);
  f.states.effect.fade = true; f.states.effect.turn = true;
  await f.manager.reconcile(); await flush();
  assert.equal(f.calls.filter(c => c[0] === 'file').length, 0);
  await f.manager.replay(f.token); await flush();
  assert.ok(f.calls.some(c => c[0] === 'file'), 'replayed from the catalog setting');
  await f.manager.destroy();
  const plain = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }]); plain.states.effect.fade = true;
  await plain.manager.reconcile(); await flush(); await plain.manager.replay(plain.token); await flush();
  assert.equal(plain.calls.filter(c => c[0] === 'file').length, 0, 'plain Play once, then fade never replays');
  await plain.manager.destroy();
  const mine = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }]); mine.states.effect.fade = true; mine.states.effect.turn = true; mine.manager.host.lastingMode = () => 'once';
  await mine.manager.reconcile(); await flush(); await mine.manager.replay(mine.token); await flush();
  assert.equal(mine.calls.filter(c => c[0] === 'file').length, 0, 'a player\'s On application only wins on their screen');
  await mine.manager.destroy();
});
test('Invisible\'s refraction ripple stays under the token, round or square art: on top its whole frame shows as a pale square', async () => {
  const invisible = PF2E_CONDITIONS.find(e => e.slug === 'invisible');
  assert.ok(stateRecipe(invisible).stages.some(s => /refraction/.test(s.assets?.[0] ?? '')), 'Invisible uses a refraction clip');
  for (const square of [false, true]) {
    const f = fixture([{ ...native(invisible), slug: 'invisible' }]);
    if (square) f.manager.host.opaqueArt = () => true;
    await f.manager.reconcile(); await flush();
    assert.ok(f.calls.some(c => c[0] === 'file' && /refraction/.test(c[1])), 'drawn');
    assert.ok(f.calls.some(c => c[0] === 'belowTokens'), `${square ? 'square' : 'round'} art: under the token`);
    await f.manager.destroy();
  }
});
test('lasting flames burn over round token art at half strength; a web on round art stays under', async () => {
 const blaze = PF2E_EFFECTS.find(e => e.name === 'Effect: Blaze');
 assert.ok(stateRecipe(blaze).stages.some(s => /\.flames\./.test(s.assets?.[0] ?? '')), 'Blaze burns with flames footage');
 const f = fixture([native(blaze)]); await f.manager.reconcile(); await flush();
 assert.ok(f.calls.some(c => c[0] === 'file' && /flames/.test(c[1])), 'drawn');
 assert.ok(!f.calls.some(c => c[0] === 'belowTokens'), 'over the token, as the preview shows it');
 assert.ok(f.calls.find(c => c[0] === 'opacity')[1] <= 0.5, 'at half strength, so the face still shows');
 await f.manager.destroy();
});
test('a recipe\'s own Lasting animation choice replaces its catalog\'s, and a player\'s own setting still wins', async () => {
  const entry = auraEntry();
  const own = (lasting) => ({ ...stateRecipe(entry), lasting });
  const once = fixture([{ ...native(entry), _stats: { createdTime: Date.now() } }]); once.manager.host.resolveStateRecipe = () => own('once');
  await once.manager.reconcile(); await flush();
  assert.ok(once.calls.some(c => c[0] === 'duration' && c[1] === FADE_MS), 'this recipe plays once though its catalog stays');
  assert.ok(!once.calls.some(c => c[0] === 'persist'));
  await once.manager.destroy();
  const turn = fixture([{ ...native(entry), _stats: { createdTime: Date.now() } }]); turn.manager.host.resolveStateRecipe = () => own('turn');
  await turn.manager.reconcile(); await flush();
  const before = turn.calls.length; await turn.manager.replay(turn.token); await flush();
  assert.ok(turn.calls.slice(before).some(c => c[0] === 'play'), 'and again at turn start');
  await turn.manager.destroy();
  const stay = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }]); stay.states.effect.fade = true; stay.manager.host.resolveStateRecipe = () => own('lasting');
  await stay.manager.reconcile(); await flush();
  assert.ok(stay.calls.some(c => c[0] === 'persist'), 'stays though its catalog plays once');
  await stay.manager.destroy();
  const player = fixture([{ ...native(entry), _stats: { createdTime: Date.now() - 60000 } }]); player.manager.host.resolveStateRecipe = () => own('once'); player.manager.host.lastingMode = () => 'always';
  await player.manager.reconcile(); await flush();
  assert.ok(player.calls.some(c => c[0] === 'persist'), 'a player\'s Always visible');
  await player.manager.destroy();
});
test('a lasting recipe keeps a valid Lasting animation choice; other recipes and other values drop it', async () => {
  const { validateRecipe } = await import('../../../scripts/core/model.mjs');
  const r = stateRecipe(auraEntry());
  assert.equal(validateRecipe({ ...r, lasting: 'turn' }).lasting, 'turn');
  assert.equal(validateRecipe({ ...r, lasting: '' }).lasting, undefined, 'follow the catalog');
  assert.equal(validateRecipe({ ...r, lasting: 'forever' }).lasting, undefined);
  const action = { ...r, trigger: 'manual', lifecycle: undefined, stages: r.stages.map(s => ({ ...s, persist: false })), lasting: 'once' };
  assert.equal(validateRecipe(action).lasting, undefined, 'not a lasting recipe');
});
test('a token refresh asks for a re-check only when what lasting looks depend on changed',()=>{
 const changed=tokenLookChanged();
 const mesh={},token={visible:true,document:{hidden:false,texture:{src:'a.webp'}},mesh,w:100,h:100,actor:{uuid:'Actor.a'}};
 assert.equal(changed(token),true,'first sight of a token');
 assert.equal(changed(token),false,'hovering, selecting, a distance label: nothing a look depends on');
 token.visible=false;assert.equal(changed(token),true,'hidden from this view');
 token.visible=true;assert.equal(changed(token),true);
 token.mesh={};assert.equal(changed(token),true,'redrawn: a new mesh to tie filters to');
 token.w=200;assert.equal(changed(token),true,'resized');
 token.document.texture.src='b.webp';assert.equal(changed(token),true,'new art');
 token.document.hidden=true;assert.equal(changed(token),true,'GM hid it');
 token.actor={uuid:'Actor.b'};assert.equal(changed(token),true,'another actor');
 assert.equal(changed(token),false);
});
test('a lasting layer Sequencer dropped (its scene re-initializing) is drawn again; one still showing is left alone',async()=>{
 const f=fixture([native(bless)]),alive=new Set();
 f.manager.host.alive=name=>alive.has(name);
 const plays=()=>f.calls.filter(c=>c[0]==='play').length;
 await f.manager.reconcile();await flush();assert.equal(plays(),1);
 const first=[...f.manager.active.values()][0].name;alive.add(first);
 await f.manager.reconcile();await flush();assert.equal(plays(),1,'still showing: not redrawn');
 alive.clear();
 await f.manager.reconcile();await flush();assert.equal(plays(),2,'dropped: drawn again');
 assert.notEqual([...f.manager.active.values()][0].name,first);
 await f.manager.destroy();
});
test('a defeated creature drops its other lasting animations, and gets them back if revived',async()=>{
 const f=fixture([native(fear),native(bless,'b')]);let dead=false;
 f.manager.host.defeated=()=>dead;
 await f.manager.reconcile();await flush();assert.equal(f.manager.active.size,2);
 dead=true;await f.manager.reconcile();await flush();assert.equal(f.manager.active.size,0,'frightened and blessed while dead: no');
 dead=false;await f.manager.reconcile();await flush();assert.equal(f.manager.active.size,2);
 await f.manager.destroy();
});
test('the Subtle switch draws each catalog look smaller, fainter and calmer; your own recipe keeps its look',async()=>{
 const look=async(subtle,saved=[])=>{
  const f=fixture([native(bless)]);f.manager.host.subtle=()=>subtle;f.setSaved(saved);
  await f.manager.reconcile();await flush();
  const width=f.calls.find(c=>c[0]==='size')[1].width,opacity=f.calls.find(c=>c[0]==='opacity')[1];
  await f.manager.destroy();return {width,opacity};
 };
 const full=await look(false),soft=await look(true);
 assert.ok(Math.abs(soft.width-full.width*.75)<1e-9,'smaller');
 assert.ok(Math.abs(soft.opacity-full.opacity*.55)<1e-9,'fainter');
});
test('Aura style Tokenshade draws the reach with a shader field; the accent stays footage',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Protective Wards'),item=native(entry),f=fixture([item]);
 item.system.rules=[{key:'Aura',slug:'protective-wards',radius:15}];f.actor.auras=new Map([['protective-wards',{slug:'protective-wards',radius:15,effects:[]}]]);
 const fields=[],removed=[];f.manager.host.auraStyle=()=>'tokenshade';f.manager.host.auraField={add:(key,o)=>fields.push({key,...o}),remove:key=>removed.push(key)};
 await f.manager.reconcile();await flush();
 assert.equal(fields.length,1);assert.equal(fields[0].feet,15);assert.equal(fields[0].look.motif,'hexes');
 assert.ok(f.calls.filter(c=>c[0]==='file').every(c=>!/zoning|particles/.test(c[1])),'no reach footage');
 assert.ok(f.calls.some(c=>c[0]==='file'),'its accent still plays');
 f.actor.auras.clear();f.actor.items=[];await f.manager.reconcile();assert.ok(removed.includes(fields[0].key));
 await f.manager.destroy();
});
test('Aura style Tokenshade: the on-token accent goes under the token only when asked',async()=>{
 const look=async({style='tokenshade',under,square=false,own=false,mask=false}={})=>{
  const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Protective Wards'),item=native(entry),f=fixture([item]);
  item.system.rules=[{key:'Aura',slug:'protective-wards',radius:15}];f.actor.auras=new Map([['protective-wards',{slug:'protective-wards',radius:15,effects:[]}]]);
  f.manager.host.auraStyle=()=>style;f.manager.host.auraField={add(){},remove(){}};f.manager.host.opaqueArt=()=>square;
  if(under!==undefined)f.manager.host.auraAccentUnder=()=>under;
  if(own){f.states.effect={...useStateEntry({},entry.id),customized:[entry.id]};f.setSaved([stateRecipe(entry)]);}
  if(mask)f.manager.host.resolveStateRecipe=()=>{const recipe=stateRecipe(entry);return{...recipe,stages:recipe.stages.map(s=>s.auraRadius?s:{...s,maskToken:true})};};
  await f.manager.reconcile();await flush();
  const count=name=>f.calls.filter(c=>c[0]===name).length,result={files:count('file'),below:count('belowTokens'),mask:count('mask')};
  await f.manager.destroy();return result;
 };
 // Square art lifts its glyph over the token by default (its refraction always stays under).
 const off=await look({square:true});assert.ok(off.files>0,'it has an accent');assert.ok(off.below<off.files,'default: over the token');
 assert.deepEqual(await look({square:true,under:false}),off,'off is the default');
 const on=await look({square:true,under:true});assert.equal(on.files,off.files,'the same layers');assert.equal(on.below,on.files,'on: every accent under the token');
 const jb2a=await look({style:'jb2a',square:true,under:true});assert.ok(jb2a.below<jb2a.files,'JB2A style ignores it');
 const masked=await look({under:true,mask:true});assert.equal(masked.below,masked.files);assert.equal(masked.mask,0,'cropped to the token it would be hidden whole');
 const mine=await look({square:true,under:true,own:true});assert.ok(mine.below<mine.files,'a recipe of your own keeps its layering');
 // An ally's copy of the aura follows the same switch.
 const halo=PF2E_EFFECTS.find(e=>/Angelic Halo/.test(e.name)&&e.auraDesign);
 const allyBelow=async(style,under)=>{const ally=fixture([{...native(halo),flags:{pf2e:{aura:{origin:'Actor.caster',slug:'angelic-halo'}}}}]);ally.actor.uuid='Actor.ally';ally.manager.host.auraStyle=()=>style;ally.manager.host.auraAccentUnder=()=>under;await ally.manager.reconcile();await flush();const below=ally.calls.some(c=>c[0]==='belowTokens');await ally.manager.destroy();return below;};
 assert.equal(await allyBelow('tokenshade',true),true);assert.equal(await allyBelow('tokenshade',false),false);assert.equal(await allyBelow('jb2a',true),false);
});
test('auras outside combat hide or go subtle; other looks on the token stay',async()=>{
 const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Manifest Will'),aura=native(entry),f=fixture([aura,native(bless,'b')]);
 aura.system.rules=[{key:'Aura',slug:'manifest-will',radius:30}];
 f.actor.auras=new Map([['manifest-will',{slug:'manifest-will',radius:30,effects:[]}]]);
 let calm='hidden';f.manager.host.auraCalm=()=>calm;
 await f.manager.reconcile();await flush();
 assert.deepEqual([...f.manager.active.values()].map(r=>Boolean(r.item.animaterAura)),[false],'only Bless shows');
 calm='subtle';await f.manager.reconcile();await flush();
 const ring=[...f.manager.active.values()].find(r=>r.item.animaterAura);
 assert.ok(ring?.soft,'the aura comes back subtle');
 assert.equal([...f.manager.active.values()].find(r=>!r.item.animaterAura).soft,false,'Bless keeps its full look');
 calm='show';await f.manager.reconcile();await flush();
 assert.equal([...f.manager.active.values()].find(r=>r.item.animaterAura).soft,false,'in combat: full aura');
 await f.manager.destroy();
});
test('reuse timers (Treat Wounds, Battle Medicine immunity) show nothing unless the GM picks one',async()=>{
 const timer=PF2E_EFFECTS.find(e=>e.slug==='effect-treat-wounds-immunity'),f=fixture([native(timer)]);
 await f.manager.reconcile();await flush();
 assert.equal(f.manager.active.size,0);
 f.states.effect=useStateEntry(f.states.effect,timer.id);
 await f.manager.reconcile();await flush();
 assert.equal(f.manager.active.size,1,'picked in the effects catalog: it shows');
 await f.manager.destroy();
});
test('a condition that just landed plays its transition first, then its lasting look; never on a reload', async () => {
 const { conditionTransition } = await import('../../../scripts/catalogs/shared/condition-looks.mjs');
 const { freshlyApplied } = await import('../../../scripts/engines/playback/persistent-states.mjs');
 assert.equal(conditionTransition({ slug: 'petrified' }), 'Turn to stone');
 assert.equal(conditionTransition({ slug: 'persistent-damage', system: { persistent: { damageType: 'poison' } } }), 'Poison spreads');
 assert.equal(conditionTransition({ slug: 'frightened' }), null);
 assert.equal(freshlyApplied({ _stats: { createdTime: 1000 } }, 2000), true);
 assert.equal(freshlyApplied({ _stats: { createdTime: 1000 } }, 600000), false, 'long on: a reload');
 assert.equal(freshlyApplied({}, 2000), false, 'no timestamp never counts as fresh');
 const intros = [];
 const f = fixture([{ ...native(bless), _stats: { createdTime: Date.now() } }]);
 f.manager.host.conditionTransition = (item) => { intros.push(item.name); return 1; };
 await f.manager.reconcile(); await flush(); await new Promise((r) => setTimeout(r, 20)); await flush();
 assert.equal(intros.length, 1, 'asked once as it lands');
 await f.manager.destroy();
});
test('a condition changing value soon after it landed does not replay its landing (Drained 1 to 3 never goes plain)', async () => {
 const intros = [];
 const item = { ...native(fear), _stats: { createdTime: Date.now() } }; item.system.value.value = 1;
 const f = fixture([item]);
 f.manager.host.conditionTransition = (it) => { intros.push(it.name); return 1; };
 await f.manager.reconcile(); await flush(); await new Promise((r) => setTimeout(r, 20)); await flush();
 assert.equal(intros.length, 1, 'it lands once');
 item.system.value.value = 3;
 await f.manager.reconcile(); await flush(); await new Promise((r) => setTimeout(r, 20)); await flush();
 assert.equal(intros.length, 1, 'the new value takes over without landing again');
 await f.manager.destroy();
});
test('a state Animater already shows another way (a Light spell floating as an orb) steps aside, and returns when that stops',async()=>{
 const f=fixture();let elsewhere=true;
 f.manager.host.drawnElsewhere=(item,token)=>elsewhere&&token===f.token;
 await f.manager.reconcile();await flush();
 assert.equal(f.manager.active.size,0,'no catalog look under the orb');
 elsewhere=false;await f.manager.reconcile();await flush();
 assert.equal(f.manager.active.size,1,'the catalog look comes back');
 await f.manager.destroy();
});
test('D&D Exhaustion grows step by step from its level on the actor; other effects have no level',async()=>{
 const {conditionLevel}=await import('../../../scripts/engines/playback/persistent-states.mjs');
 const exhaustion=(level)=>({documentName:'ActiveEffect',name:'Exhaustion',statuses:new Set(['exhaustion']),parent:{system:{attributes:{exhaustion:level}}}});
 assert.deepEqual([1,2,3,4,5,6].map((l)=>conditionLevel(exhaustion(l))),[1,2,2,3,4,4]);
 assert.equal(conditionLevel(exhaustion(0)),0);
 assert.equal(conditionLevel({documentName:'ActiveEffect',name:'Bless',statuses:new Set()}),0);
});
test('Play once: an effect disabled and enabled again plays again, though its document is old (D&D 5e re-applies by re-enabling)',async()=>{
 const entry=PF2E_EFFECTS.find(e=>stateRecipe(e).stages.some(s=>s.kind==='aura'&&s.persist&&!s.auraRadius));
 const item={...native(entry),_stats:{createdTime:Date.now()-600000}},f=fixture([item]);f.states.effect.fade=true;
 await f.manager.reconcile();await flush();
 assert.equal(f.calls.filter(c=>c[0]==='play').length,0,'already on the token: quiet');
 item.system.disabled=true;await f.manager.reconcile();await flush();
 item.system.disabled=false;const before=f.calls.length;await f.manager.reconcile();await flush();
 assert.ok(f.calls.slice(before).some(c=>c[0]==='play'),'enabled again: it plays');
 const after=f.calls.length;await f.manager.reconcile();await flush();
 assert.equal(f.calls.slice(after).filter(c=>c[0]==='play').length,0,'and only once');
 await f.manager.destroy();
});
test('Play once: a recipe of your own plays its whole lasting layer, a catalog look its moment',async()=>{
 const entry=PF2E_EFFECTS.find(e=>stateRecipe(e).stages.some(s=>s.kind==='aura'&&s.persist&&!s.auraRadius));
 const recipe=stateRecipe(entry),own={...recipe,id:'mine',stages:recipe.stages.map(s=>s.kind==='aura'&&s.persist?{...s,delay:0,duration:6000}:s)};
 const f=fixture([{...native(entry),_stats:{createdTime:Date.now()}}]);f.states.effect.fade=true;f.setSaved([own]);f.manager.host.resolveStateRecipe=()=>own;
 await f.manager.reconcile();await flush();
 assert.ok(f.calls.some(c=>c[0]==='duration'&&c[1]===6000));
 await f.manager.destroy();
});

test('A customized aura goes by its own Area look, whatever the Aura style',async()=>{
 const run=async(style,stageChange)=>{
  const entry=PF2E_EFFECTS.find(e=>e.name==='Aura: Protective Wards'),item=native(entry),f=fixture([item]);
  item.system.rules=[{key:'Aura',slug:'protective-wards',radius:15}];f.actor.auras=new Map([['protective-wards',{slug:'protective-wards',radius:15,effects:[]}]]);
  const fields=[];f.manager.host.auraStyle=()=>style;f.manager.host.auraField={add:(key,o)=>fields.push(o),remove(){}};
  const design=stateRecipe(entry),at=design.stages.findIndex(s=>s.kind==='aura'&&s.persist),own={...design,stages:design.stages.map((s,i)=>i===at?{...s,auraRadius:15,...stageChange}:s)};
  f.manager.host.recipes=()=>[own];f.manager.host.resolveStateRecipe=()=>own;
  await f.manager.reconcile();await flush();await f.manager.destroy();
  return {fields};
 };
 const chosen=await run('jb2a',{areaLook:'tokenshade',areaMotif:'frost',tintEnabled:true,tint:'#112233'});
 assert.equal(chosen.fields.length,1,'Tokenshade by its own choice');assert.equal(chosen.fields[0].look.motif,'frost');assert.equal(chosen.fields[0].look.color,0x112233);
 const kept=await run('tokenshade',{});
 assert.equal(kept.fields.length,0,'saved without the choice: its footage, as before');
});
