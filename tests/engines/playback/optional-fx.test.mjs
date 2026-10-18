import test from 'node:test';
import assert from 'node:assert/strict';
import {installedFxCatalog,OptionalFxPlayer,fxAvailability,effectOptions,normalizeFxOptions,startTokenFxPreview,scaleFilterStrength,normalizeFxStage} from '../../../scripts/engines/playback/optional-fx.mjs';
import {validateRecipe,planRecipe} from '../../../scripts/core/model.mjs';
import {AnimaterRuntime} from '../../../scripts/engines/playback/runtime.mjs';
import {Workspace} from '../../../scripts/ui/workspace.mjs';
const recipe=stages=>validateRecipe({id:'optional-fx',name:'FX test',trigger:'manual',stages});
const tokenStage={kind:'tokenfx',fxPreset:'Burn',fxLibrary:'tokenshade',subject:'targets',duration:100};
const sceneStage={kind:'scenefx',fxCategory:'particle',fxType:'embers',duration:100};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture() {
  const calls=[], foreign={filterId:'world-burn',filterType:'fire'};
  const filters=[foreign];
  const token={document:{object:{id:'placeable'}}};
  const preset={name:'Burn',library:'tokenshade',params:[{filterType:'fire',color:123},{filterType:'glow'}]};
  // The token FX engine's surface: presets by library, and apply → remove.
  const tm={ready:()=>true,getPresets:library=>library==='tokenshade'?[preset]:[],apply(target,own){
    assert.equal(target,token.document.object);
    calls.push(['token','add',structuredClone(own)]);
    const mine=own.params.map(p=>({...p}));filters.push(...mine);
    return ()=>{calls.push(['token','remove']);for(const m of mine){const i=filters.indexOf(m);if(i>=0)filters.splice(i,1);}};
  }};
  const flags={effects:{core_rain:{type:'rain'}},filters:{core_color:{type:'color'}}};
  const scene={getFlag:(_,name)=>flags[name]};
  const fx={effects:{play:async data=>{calls.push(['scene','add',data]);for(const e of data.effects)flags[e.kind==='particle'?'effects':'filters'][e.id]=e;},
    stop:async data=>{calls.push(['scene','remove',data]);for(const id of data.particles)delete flags.effects[id];for(const id of data.filters)delete flags.filters[id];}}};
  const modules=new Map([['fxmaster',{active:true,version:'8.4.1'}]]);
  const config={particleEffects:{embers:{label:'Embers',parameters:{density:{type:'range',label:'Density',min:0,max:1,step:.1,value:.3},tint:{type:'color',label:'Tint',value:{value:'#ff7700',apply:false}},soundFxEnabled:{type:'checkbox',value:true}}}},filterEffects:{}};
  const host={catalog:()=>installedFxCatalog({modules,tokenFx:tm,fxmaster:fx,config,isGM:true}),tokenFx:()=>tm,fxmaster:()=>fx,scene:()=>scene,trace:(...args)=>calls.push(['trace',...args])};
  const player=new OptionalFxPlayer(host);
  return {player,host,calls,filters,foreign,preset,token,scene,flags,tm,fx,modules};
}
test('optional stages validate, export and route to selected token subjects without JB2A keys',()=>{
  const source={id:'caster'},targets=[{id:'one'},{id:'two'}];
  const r=recipe([{...tokenStage,assets:['jb2a.bad']},sceneStage]);
  assert.deepEqual(r.stages[0].assets,[]);
  assert.equal(r.stages[0].fxPreset,'Burn');
  const plan=planRecipe(r,[],{source,targets});
  assert.deepEqual(plan.filter(s=>s.kind==='tokenfx').map(s=>s.destination),targets);
  assert.equal(plan.filter(s=>s.kind==='scenefx').length,1);
  assert.equal(planRecipe(recipe([sceneStage]),[],{targets:[]}).length,1);
  assert.equal(recipe([{...tokenStage,persist:true}]).stages[0].persist,false);
});
test('native preset discovery exposes safe filter types and tint metadata without shader parameters',()=>{
  const f=fixture(),catalog=f.host.catalog();
  assert.deepEqual(catalog.presets,[{name:'Burn',library:'tokenshade',filterTypes:['fire','glow'],tintable:true}]);
  assert.equal(Object.hasOwn(catalog.presets[0],'params'),false);
  f.tm.ready=()=>false;assert.deepEqual(f.host.catalog().presets,[],'no renderer, no presets');
});
test('private asset audition isolates its session from running choreography and validates selected tokens',async()=>{
  const f=fixture();
  assert.throws(()=>startTokenFxPreview(f.player,tokenStage,{tokens:[]}),/Target a token/);
  const running=f.player.play({...tokenStage,destination:f.token,duration:5000},{session:'recipe',userId:'gm'});
  const preview=startTokenFxPreview(f.player,{...tokenStage,duration:5000},{tokens:[f.token,f.token],session:'audition',userId:'gm'});
  await tick();assert.equal(f.filters.length,5,'duplicate selected token is auditioned once');
  await preview.stop();await preview.done;
  assert.equal(f.filters.length,3);assert.ok([...f.player.active].some(e=>e.session==='recipe'));
  await f.player.stop({session:'recipe'});await running;assert.deepEqual(f.filters,[f.foreign]);
});
test('private audition failure cleans other selected tokens and always uses local preview mode',async()=>{
  const calls=[],removed=[];
  const player={play:async(stage,options)=>{calls.push([stage,options]);if(stage.destination.id==='bad')throw Error('Provider failed');return new Promise(resolve=>{removed.push(resolve);});},
    stop:async options=>{calls.push(['stop',options]);removed.forEach(resolve=>resolve());}};
  const preview=startTokenFxPreview(player,{...tokenStage,duration:999999},{tokens:[{id:'good'},{id:'bad'}],session:'private',userId:'gm'});
  await assert.rejects(preview.done,/Provider failed/);
  assert.ok(calls.slice(0,2).every(([stage,options])=>stage.duration===30000&&options.preview===true&&options.session==='private'));
  assert.deepEqual(calls[2],['stop',{session:'private',userId:'gm'}]);
});
test('transient token presets isolate overlapping sessions and preserve existing filters',async()=>{
  const f=fixture();
  const a=f.player.play({...tokenStage,destination:f.token,duration:5000},{session:'one',userId:'gm',preview:true});
  const b=f.player.play({...tokenStage,destination:f.token,duration:5000},{session:'two',userId:'gm'});
  await tick();
  const additions=f.calls.filter(c=>c[0]==='token' && c[1]==='add');
  assert.equal(additions.length,2);
  assert.equal(f.filters.length,5);
  await f.player.stop({session:'one'});await a;
  assert.equal(f.filters.length,3);
  assert.equal(f.filters[0],f.foreign);
  await f.player.stop({userId:'gm'});await b;
  assert.deepEqual(f.filters,[f.foreign]);
  assert.equal(f.preset.params[0].color,123,'the shared preset is never changed');
});
test('Stop right after a token filter starts removes it',async()=>{
  const f=fixture();
  const play=f.player.play({...tokenStage,destination:f.token,duration:60000},{session:'late',userId:'gm'});
  await tick();await f.player.stop({session:'late'});await play;
  assert.deepEqual(f.filters,[f.foreign]);assert.equal(f.player.active.size,0);
});
test('FXMaster private preview and non-GM playback never mutate the Scene',async()=>{
  const f=fixture();
  await f.player.play(sceneStage,{session:'private',userId:'gm',preview:true});
  f.host.catalog=()=>({...fixture().host.catalog(),isGM:false});
  await f.player.play(sceneStage,{session:'player',userId:'player'});
  assert.equal(f.calls.filter(c=>c[0]==='scene').length,0);
});
test('FXMaster removes only this cast IDs, including partial add failure',async()=>{
  const f=fixture();
  const play=f.player.play({...sceneStage,duration:5000},{session:'cast',userId:'gm'});
  await tick();
  assert.equal(Object.keys(f.flags.effects).length,2);
  await f.player.stop({session:'cast'});await play;
  assert.deepEqual(Object.keys(f.flags.effects),['core_rain']);
  assert.deepEqual(Object.keys(f.flags.filters),['core_color']);
  const original=f.fx.effects.play;
  f.fx.effects.play=async data=>{await original(data);throw Error('Scene update failed');};
  await assert.rejects(f.player.play(sceneStage,{session:'fail',userId:'gm'}),/Scene update failed/);
  assert.deepEqual(Object.keys(f.flags.effects),['core_rain']);
});
test('orphan cleanup expires Animater rows while preserving weather and unexpired casts',async()=>{
  const f=fixture();
  const stale=`apiMacro_animater_${Date.now()-10000}_abc_p`,live=`apiMacro_animater_${Date.now()+60000}_def_p`;
  f.flags.effects[stale]={type:'embers'};f.flags.effects[live]={type:'embers'};
  await f.player.pruneExpired();
  assert.deepEqual(Object.keys(f.flags.effects),['core_rain',live]);
});
test('registry controls use native bounds and suppress unmanaged provider audio',()=>{
  const f=fixture(),cat=f.host.catalog(),effect=cat.effects[0];
  assert.equal(cat.presets[0].name,'Burn');
  assert.equal(effect.fields.some(f=>f.key==='soundFxEnabled'),false);
  const opts=effectOptions({...sceneStage,fxOptions:{density:999,tint:{value:'#00ff00',apply:true},unknown:'bad'}},effect);
  assert.equal(opts.density,1);assert.equal(opts.soundFxEnabled,false);assert.equal(opts.unknown,undefined);
  assert.deepEqual(opts.tint,{value:'#00ff00',apply:true});
  f.tm.ready=()=>false;
  assert.equal(f.host.catalog().tokenReady,false);
  assert.match(fxAvailability(tokenStage,f.host.catalog()),/unavailable/);
  assert.deepEqual(normalizeFxOptions(JSON.parse('{"__proto__":{},"constructor":"bad","density":0.4}')),{density:.4});
});
test('runtime sequences optional stages alongside JB2A without compiling them as media',async()=>{
  const calls=[];
  const effect=new Proxy({},{get:(_,key)=>(...args)=>{calls.push([key,...args]);return effect;}});
  const runtime=new AnimaterRuntime({ready:()=>true,canPlay:()=>true,userId:()=> 'gm',database:{getPathsUnder:()=>[]},
    sequence:()=>({effect:()=>effect,play:async()=>calls.push(['play'])}),
    optionalFx:async(stage,context,opts)=>calls.push(['fx',stage.kind,stage.delay,opts.preview]),endEffects:async()=>{},endSounds:async()=>{}});
  runtime.catalog=[{key:'jb2a.impact.test'}];runtime.wait=async()=>true;
  await runtime.play(recipe([{kind:'cast',assets:['jb2a.impact.test'],stageId:'cast',duration:300},
    {...tokenStage,subject:'source',afterStage:'cast'},sceneStage]),{source:{},targets:[]},{preview:true});
  assert.equal(calls.filter(c=>c[0]==='file').length,1);
  assert.deepEqual(calls.filter(c=>c[0]==='fx').map(c=>c.slice(1)),[['scenefx',0,true],['tokenfx',300,true]]);
});
test('editor shows provider controls and explicit preview limits instead of missing artwork',()=>{
  const f=fixture(),w=Object.create(Workspace.prototype);w.host={fxCatalog:f.host.catalog};
  const token=w.optionalFxControlsHTML(tokenStage,0),scene=w.optionalFxControlsHTML({...sceneStage,fxOptions:{}},1);
  assert.match(token,/Burn/);assert.match(scene,/data-fx-option="density"/);
  assert.match(scene,/Skipped in private preview/);assert.doesNotMatch(scene,/soundFxEnabled/);
  assert.doesNotMatch(w.optionalFxPreviewHTML(tokenStage,0),/Missing asset/);
});
test('token filter recipe preview never covers token artwork with a provider information card',()=>{
  const w=Object.create(Workspace.prototype);
  const html=w.optionalFxPreviewHTML({...tokenStage,fxPreset:'Super-Frost'},0);
  assert.doesNotMatch(html,/an-provider-cue|Local canvas preview/);
});

test('retained filters ignore sample duration, preserve other presets and remove only their own session',async()=>{
 const f=fixture();
 const release=await f.player.retain({...tokenStage,destination:f.token,duration:1,persist:true},{session:'condition',userId:'state:client'});
 await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(f.filters.length,3);assert.equal(f.player.active.size,1);
 await f.player.stop({userId:'gm'});assert.equal(f.filters.length,3);
 await f.player.stop({session:'condition'});await release();
 assert.deepEqual(f.filters,[f.foreign]);assert.equal(f.player.active.size,0);
 assert.equal(f.calls.filter(c=>c[0]==='token'&&c[1]==='remove').length,1);
});
test('color overrides affect cloned colored layers without altering installed preset animations',async()=>{
 const f=fixture();f.preset.params[0].animated={color:{active:true},intensity:{active:true}};
 const original=structuredClone(f.preset);
 const release=await f.player.retain({...tokenStage,destination:f.token,fxTint:'#a2dc48'},{session:'acid'});
 const own=f.calls.find(c=>c[0]==='token'&&c[1]==='add')[2];
 assert.equal(own.params[0].color,0xa2dc48);assert.equal(own.params[0].animated.color,undefined);
 assert.equal(own.params[0].animated.intensity.active,true);assert.deepEqual(f.preset,original);
 await release();assert.deepEqual(f.filters,[f.foreign]);
});
test('a condition stopped before its release removes its filter exactly once',async()=>{
 const f=fixture();
 const release=await f.player.retain({...tokenStage,destination:f.token},{session:'condition'});
 await f.player.stop({session:'condition'});await release();
 assert.deepEqual(f.filters,[f.foreign]);assert.equal(f.player.active.size,0);
 assert.equal(f.calls.filter(c=>c[0]==='token'&&c[1]==='remove').length,1);
});
test('retained filters clean partial provider failures and missing providers stay inert',async()=>{
 const f=fixture();
 f.tm.apply=()=>{throw Error('Shader load failed');};
 await assert.rejects(f.player.retain({...tokenStage,destination:f.token},{session:'failure'}),/Shader load failed/);
 assert.deepEqual(f.filters,[f.foreign]);assert.equal(f.player.active.size,0);
 f.tm.ready=()=>false;
 const release=await f.player.retain({...tokenStage,destination:f.token},{session:'absent'});await release();
 assert.equal(f.player.active.size,0);
});

test('optional catalog token accents never block base playback when the sync channel is unavailable',async()=>{
 const f=fixture(),calls=[],effect=new Proxy({},{get:(_,key)=>(...args)=>{calls.push(key);return effect;}});
 const runtime=new AnimaterRuntime({ready:()=>true,canPlay:()=>true,canSyncMotion:()=>false,fxCatalog:f.host.catalog,userId:()=> 'gm',
  sequence:()=>({effect:()=>effect,play:async()=>{}}),optionalFx:async()=>calls.push('fx'),endEffects:async()=>{},endSounds:async()=>{}});
 runtime.catalog=[{key:'jb2a.impact.test'}];runtime.wait=async()=>true;
 const stages=[{kind:'cast',assets:['jb2a.impact.test'],stageId:'base',duration:100},{...tokenStage,subject:'source',catalogFx:true,fxProfile:'fire',afterStage:'base'}];
 await runtime.play(recipe(stages),{source:{},targets:[]});
 assert.ok(calls.includes('file'));assert.ok(!calls.includes('fx'));assert.ok(runtime.log.some(e=>e.status==='Skipped'&&e.detail.includes('synchronization')));
 await assert.rejects(runtime.play(recipe(stages.map(s=>({...s,catalogFx:false}))),{source:{},targets:[]}),/token-motion channel/);
});
test('Strength fades a token filter by scaling every transparency setting it has, animated ones too',()=>{
 const bevel={filterType:'bevel',lightAlpha:.8,shadowAlpha:.6,thickness:3,alphaDiscard:false,animated:{lightAlpha:{val1:.4,val2:1},thickness:{val1:1,val2:5}}};
 scaleFilterStrength(bevel,.5);
 assert.equal(bevel.lightAlpha,.4);assert.equal(bevel.shadowAlpha,.3);assert.equal(bevel.thickness,3,'non-alpha settings untouched');
 assert.equal(bevel.alphaDiscard,false);assert.deepEqual(bevel.animated.lightAlpha,{val1:.2,val2:.5});assert.deepEqual(bevel.animated.thickness,{val1:1,val2:5});
 const glow={filterType:'glow',outerStrength:7,innerStrength:0,quality:.5};scaleFilterStrength(glow,.5);assert.equal(glow.outerStrength,3.5,'glow fades through its strength');assert.equal(glow.quality,.5);
 const aura={filterType:'xglow',auraIntensity:2,alphaTolerance:.5};scaleFilterStrength(aura,.5);assert.equal(aura.auraIntensity,1);assert.equal(aura.alphaTolerance,.5,'tolerances are not fades');
 const full={filterType:'glow',outerStrength:7};scaleFilterStrength(full,1);assert.equal(full.outerStrength,7,'full strength changes nothing');
 assert.equal(normalizeFxStage({kind:'tokenfx',fxPreset:'bevel'}).fxStrength,1);
 assert.equal(normalizeFxStage({kind:'tokenfx',fxPreset:'bevel',fxStrength:0}).fxStrength,.1);
 assert.equal(normalizeFxStage({kind:'tokenfx',fxPreset:'bevel',fxStrength:'.4'}).fxStrength,.4);
});
test('a condition look is kept through validation and shown even when decorative token filters are off',async()=>{
  const f=fixture();let options;
  f.tm.apply=(token,preset,opts)=>{options=opts;return ()=>{};};
  assert.equal(normalizeFxStage({kind:'tokenfx',fxPreset:'Burn',fxEssential:true}).fxEssential,true);
  assert.equal(normalizeFxStage({kind:'tokenfx',fxPreset:'Burn'}).fxEssential,undefined);
  const release=await f.player.retain({...tokenStage,destination:f.token,fxEssential:true},{session:'c'});
  assert.equal(options.always,true);await release();
});
