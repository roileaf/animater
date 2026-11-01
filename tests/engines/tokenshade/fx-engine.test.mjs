import test from 'node:test';
import assert from 'node:assert/strict';
import {animValue, normalizeAnim, compileAnimations, ANIM_TYPES} from '../../../scripts/engines/tokenshade/animation.mjs';
import {SPECS, FILTER_TYPES, specFor, resolveParams} from '../../../scripts/engines/tokenshade/filters/index.mjs';
import {PRESETS, builtinPreset, LIBRARY} from '../../../scripts/engines/tokenshade/presets.mjs';
import {TokenFxEngine, presetFilters} from '../../../scripts/engines/tokenshade/engine.mjs';
import {shaderSource,fieldSource,fieldResolution,fieldSpacing} from '../../../scripts/engines/tokenshade/filter-factory.mjs';
import {tokenFxApi} from '../../../scripts/engines/tokenshade/api.mjs';

class Filter {constructor(vertex,fragment,uniforms){this.uniforms=uniforms;this.enabled=true;this.destroyed=false;}destroy(){this.destroyed=true;}}
const PIXI={Filter,Texture:{EMPTY:{}}};

test('every Token Magic filter type and animation type has an animater implementation',()=>{
  assert.ok(['material','frost','bindings','base','dissolve','wash'].every(t=>specFor(t)),'Tokenshade originals');
  const tmfx=['adjustment','ascii','dot','distortion','crt','oldfilm','glow','outline','colorGradient','bevel','xbloom','shadow','twist','zoomblur','blur','bulgepinch','zapshadow','ray','fog','xfog','electric','wave','shockwave','fire','fumes','smoke','flood','images','field','xray','liquid','xglow','pixel','web','ripples','globes','transform','splash','polymorph','xfire','sprite','spriteMask','replaceColor','ddTint','rgbSplit'];
  assert.deepEqual(tmfx.filter(t=>!specFor(t)),[]);
  assert.equal(ANIM_TYPES.length,20);
  for(const type of ANIM_TYPES)assert.ok(normalizeAnim({animType:type}).animType,type);
});
test('the built-in library has every Token Magic preset name we keep plus Tokenshade originals, every filter known',()=>{
  assert.equal(PRESETS.length,291);
  assert.equal(PRESETS.filter(p=>p.library===LIBRARY.TOKEN).length,246);
  assert.ok(!PRESETS.some(p=>p.name==='DungeonDraft Tint'),'retired: a map-maker tint, not a token look');
  for(const name of ['Burning','Electrocuted','Corroding','Envenomed','Withering','Radiant Burn','Force Jolt','Psychic Warp','Resonance','Spirit Rend','Petrified','Frozen Solid','Entangled','Chained','Netted','Levitate','Marker: Foe','Rune Circle','Frostbitten','Submerged'])assert.ok(builtinPreset(name),name);
  assert.ok(!PRESETS.some(p=>/BW/.test(p.name)),'no Baileywiki names');
  assert.equal(PRESETS.filter(p=>p.library===LIBRARY.REGION).length,45);
  for(const p of PRESETS)for(const f of p.params)assert.ok(specFor(f.filterType),`${p.name}: ${f.filterType}`);
  for(const name of ['fire','glow','electric','blur','distortion','images','spectral-body','warp-field','fire-aura','zoomblur','pure-ice-aura','smoke','fumes'])
    assert.ok(builtinPreset(name),`catalogs use ${name}`);
  assert.ok(Object.isFrozen(PRESETS[0].params[0]),'the shared library cannot be changed by a caller');
  const copy=builtinPreset('fire');copy.params[0].color=1;assert.notEqual(builtinPreset('fire').params[0].color,1);
});
test('every spec yields finite uniforms and reach for its defaults and for every preset that uses it',()=>{
  const ctx={width:100,height:100,size:100};
  const check=(spec,p,label)=>{
    for(const [name,[kind,read]] of Object.entries(spec.uniforms)){
      const v=[].concat(read(p)).map(x=>typeof x==='boolean'?+x:x);
      assert.ok(v.every(Number.isFinite),`${label} ${name} (${kind})`);
    }
    const reach=spec.reach(p,ctx);assert.ok(Number.isFinite(reach)&&reach>=0,`${label} reach`);
    assert.match(shaderSource(spec),/void main\(\)/);
  };
  for(const spec of Object.values(SPECS))check(spec,resolveParams(spec,{}),spec.type);
  for(const p of PRESETS)for(const f of p.params)check(specFor(f.filterType),resolveParams(specFor(f.filterType),f),p.name);
});
test('malformed preset values fall back to defaults instead of reaching a shader',()=>{
  const spec=specFor('glow');
  const p=resolveParams(spec,{outerStrength:'lots',color:'0xff0000',distance:NaN,animated:{},filterType:'glow',extra:{a:1}});
  assert.equal(p.outerStrength,spec.defaults.outerStrength);assert.equal(p.color,0xff0000);assert.equal(p.distance,spec.defaults.distance);
  assert.equal(p.extra,undefined);
});
test('animations are pure functions of time: oscillations, loops, pauses, sync and chaos',()=>{
  const cos=normalizeAnim({animType:'cosOscillation',val1:2,val2:6,loopDuration:1000});
  assert.equal(animValue(cos,0,{local:0,world:0}),2);assert.equal(animValue(cos,0,{local:500,world:0}),6);
  assert.ok(Math.abs(animValue(cos,0,{local:250,world:0})-4)<1e-9);
  const sync=normalizeAnim({animType:'syncCosOscillation',val1:0,val2:1,loopDuration:1000});
  assert.equal(animValue(sync,0,{local:0,world:500}),1,'sync follows the shared world clock');
  const move=normalizeAnim({animType:'move',speed:0.002});assert.equal(animValue(move,3,{local:500,world:0}),4);
  const loops=normalizeAnim({animType:'cosOscillation',val1:0,val2:10,loopDuration:100,loops:2,pauseBetweenDuration:50});
  assert.equal(animValue(loops,0,{local:5000,world:0}),0,'finite loops stop at their final value');
  assert.equal(animValue(loops,0,{local:120,world:0}),0,'held during the pause');
  const color=normalizeAnim({animType:'colorOscillation',val1:0xff0000,val2:0x0000ff,loopDuration:1000});
  assert.equal(animValue(color,0,{local:500,world:0}),0x0000ff);
  const chaos=normalizeAnim({animType:'syncChaoticOscillation',val1:0,val2:1,loopDuration:1000,chaosFactor:.5});
  assert.equal(animValue(chaos,0,{local:0,world:1500,key:'a'}),animValue(chaos,0,{local:999,world:1500,key:'a'}),'same on every client');
  const integer=normalizeAnim({animType:'sinOscillation',val1:1,val2:8,loopDuration:1000,wantInteger:true});
  assert.ok(Number.isInteger(animValue(integer,0,{local:333,world:0})));
  const out={};compileAnimations({time:{animType:'move',speed:1},off:{animType:'move',speed:1,active:false}},{time:0}).sample(out,{local:10,world:0});
  assert.deepEqual(out,{time:10});
});
function fakeToken() {
  const mesh={filters:[{foreign:true}],visible:true,renderable:true,worldAlpha:1,destroyed:false,worldTransform:{a:1,b:0,c:0,d:1,tx:0,ty:0},texture:{orig:{width:100,height:100}},anchor:{x:.5,y:.5},parent:{worldTransform:{a:1,b:0}}};
  return {mesh,visible:true,destroyed:false,w:100,h:100};
}
test('the engine adds its filters after other modules’ ones and removes only its own',()=>{
  const ticker={add(){this.on=true;},remove(){this.on=false;}};
  const engine=new TokenFxEngine({PIXI,ticker:()=>ticker,now:()=>0,world:()=>0});
  const token=fakeToken(),foreign=token.mesh.filters[0];
  const remove=engine.apply(token,builtinPreset('pure-fire-aura'));
  assert.equal(token.mesh.filters[0],foreign);assert.equal(token.mesh.filters.length,4);assert.equal(ticker.on,true);
  remove();assert.deepEqual(token.mesh.filters,[foreign]);assert.equal(ticker.on,false);
  remove();assert.deepEqual(token.mesh.filters,[foreign],'removing twice is harmless');
});
test('the engine follows a redrawn mesh, pauses while hidden and lets go of destroyed tokens',()=>{
  const ticker={add(){},remove(){}};let on=true;
  const engine=new TokenFxEngine({PIXI,ticker:()=>ticker,now:()=>0,world:()=>0,enabled:()=>on});
  const token=fakeToken();engine.apply(token,builtinPreset('glow'));
  const old=token.mesh;token.mesh={...fakeToken().mesh,filters:null};
  engine.tick();assert.equal(token.mesh.filters.length,1);assert.deepEqual(old.filters,[{foreign:true}]);
  token.visible=false;engine.tick();assert.equal(token.mesh.filters[0].enabled,false);
  token.visible=true;on=false;engine.tick();assert.equal(token.mesh.filters[0].enabled,false,'quality setting turns decorative FX off');
  const stone=engine.apply(token,{name:'stone',params:[{filterType:'adjustment',saturation:.1}]},{always:true});
  engine.tick();assert.equal(token.mesh.filters.at(-1).enabled,true,'a state look stays on');stone();
  token.destroyed=true;engine.tick();assert.equal(engine.entries.size,0);
});
test('presets with unknown or disabled filters still show the rest',()=>{
  const filters=presetFilters(PIXI,{name:'x',params:[{filterType:'nope'},{filterType:'glow',enabled:false},{filterType:'outline'}]});
  assert.deepEqual(filters.map(f=>f.spec.type),['outline']);
});
test('a world’s own Token Magic presets are offered only under names animater does not use',()=>{
  const custom={name:'My ward',params:[{filterType:'glow'}]},clash={name:'fire',params:[{filterType:'glow'}]};
  const bw=[{name:'[BW] Overlay Cold Ice',params:[{filterType:'sprite'}]},{name:'BW Turn to Stone',params:[{filterType:'adjustment'}]}];
  const api=tokenFxApi({engine:new TokenFxEngine({PIXI}),tokenMagic:()=>({getPresets:()=>[custom,clash,...bw]}),modules:()=>new Map([['tokenmagic',{active:true}]])});
  const names=api.getPresets('tokenshade').map(p=>p.name);
  assert.ok(names.includes('My ward'));assert.ok(!names.some(n=>/BW/.test(n)),'Baileywiki presets are not offered');assert.equal(names.filter(n=>n==='fire').length,1);
  assert.equal(api.getPresets('tokenshade').find(p=>p.name==='fire'),PRESETS.find(p=>p.name==='fire'),'ours wins');
  const off=tokenFxApi({engine:new TokenFxEngine({PIXI}),tokenMagic:()=>({getPresets:()=>[custom]}),modules:()=>new Map()});
  assert.ok(!off.getPresets('tokenshade').some(p=>p.name==='My ward'),'only while Token Magic is active');
  assert.equal(api.ready(),true);
});
test('silhouette fields: one small pass per frame, sized by the effect, passed through outside the reach',()=>{
  const withField=Object.values(SPECS).filter(s=>s.field);
  assert.ok(['fire','xfire','xglow','glow','electric','smoke','frost','veins'].every(t=>specFor(t).field),'the ring-sampling filters use fields');
  for(const spec of withField){
    assert.match(fieldSource(spec),/vec4 field\(\)/,spec.type);
    assert.match(shaderSource(spec),/fxField\(\)/,`${spec.type} reads its field`);
    assert.doesNotMatch(spec.glsl,/\b(fuelBelow|coverage|innerEdge)\(/,`${spec.type} keeps ring sampling out of its main pass`);
  }
  assert.equal(fieldSource(specFor('adjustment')),null);
  for(const spec of Object.values(SPECS))assert.match(shaderSource(spec),/fxBeyondReach\(0\.0\)/,spec.type);
  assert.equal(fieldResolution(3,1),1/3);assert.equal(fieldResolution(0.2,1),1,'never finer than the input');assert.equal(fieldResolution(100,2),0.25,'never coarser than an eighth');
  assert.equal(fieldSpacing(specFor('fire'),resolveParams(specFor('fire'),{}),{size:200}),3,'3% of the token radius');
  assert.ok(Math.abs(fieldSpacing(specFor('glow'),resolveParams(specFor('glow'),{distance:10}),{size:200})-2)<1e-9,'glow follows its own distance');
});
test('a filter reaches from what the filters ahead of it drew, plus its own padding',()=>{
  const [glow,fire]=presetFilters(PIXI,{name:'x',params:[{filterType:'glow',distance:10},{filterType:'fire'}]},{tokenSize:{width:100,height:100}});
  const target=fakeToken().mesh;target.worldTransform={a:1,b:0,c:0,d:1,tx:200,ty:200};
  glow.measure(target);
  assert.deepEqual([...glow.uniforms.uReach],[150-glow.padding-1,150-glow.padding-1,250+glow.padding+1,250+glow.padding+1]);
  fire.measure(target,glow.padding);
  assert.equal(fire.uniforms.uReach[0],150-glow.padding-fire.padding-1);
});
test('shader warm-up compiles every Tokenshade pass in the background, the way PIXI links it, then lets PIXI build it',async()=>{
  const {warmShaders,tokenshadePrograms,warmOrder}=await import('../../../scripts/engines/tokenshade/warmup.mjs');
  const cache=new Map();
  class Program{constructor(v,f){this.vertexSrc=v;this.fragmentSrc=f;this.glPrograms={};}static from(v,f){const k=v+f;if(!cache.has(k))cache.set(k,new Program(v,f));return cache.get(k);}}
  const P={Filter:{defaultVertexSrc:'vertex'},Program};
  assert.deepEqual(warmOrder(['glow','bevel','fire']),['fire','glow','bevel'],'catalog looks first');
  const programs=tokenshadePrograms(P);
  assert.equal(programs.length,Object.values(SPECS).length+Object.values(SPECS).filter(s=>s.field).length);
  assert.equal(tokenshadePrograms(P)[0],programs[0],'the very programs the filters will use');
  const links=[],bound=[];
  const gl={VERTEX_SHADER:1,FRAGMENT_SHADER:2,LINK_STATUS:3,ACTIVE_ATTRIBUTES:4,
    getExtension:n=>n==='KHR_parallel_shader_compile'?{}:null,isContextLost:()=>false,
    createShader:()=>({}),shaderSource(){},compileShader(){},createProgram:()=>({}),attachShader(){},
    linkProgram:p=>links.push(p),
    getProgramParameter:(p,k)=>k===4?1:true,
    getActiveAttrib:()=>({name:'aVertexPosition'}),bindAttribLocation:(p,i,n)=>bound.push([i,n]),
    deleteShader(){},deleteProgram(){}};
  const built=[];
  const renderer={gl,CONTEXT_UID:7,shader:{generateProgram:({program})=>{built.push(program);program.glPrograms[7]={};}}};
  programs[0].glPrograms[7]={};
  const n=await warmShaders(P,renderer,{tick:0,types:['fire','glow','bevel']});
  assert.equal(n,4,'fire and its field, glow and its field, bevel; fire was already built');
  assert.ok(!built.includes(programs[0]));
  assert.equal(links.length,8,'linked twice each, as PIXI does');
  assert.ok(bound.every(([i,name])=>i===0&&name==='aVertexPosition'));
  assert.equal(await warmShaders(P,{...renderer,gl:{...gl,getExtension:()=>null}}),0,'nothing without background compiling');
  // A client that can distort the map also warms the scene filter, ahead of the token looks.
  const {sceneWarpProgram}=await import('../../../scripts/engines/tokenshade/filters/scene-warp.mjs');
  built.length=0;
  assert.equal(await warmShaders(P,renderer,{tick:0,types:['bevel'],sceneWarp:true}),1);
  assert.deepEqual(built,[sceneWarpProgram(P)],'bevel was built above; the scene filter now');
  // Without background compiling, the scene filter alone is built at once (while the scene loads), and only once.
  const {buildSceneWarpNow}=await import('../../../scripts/engines/tokenshade/warmup.mjs');
  assert.equal(buildSceneWarpNow(P,renderer),false,'with the extension the warm-up does it in the background');
  delete sceneWarpProgram(P).glPrograms[7];
  built.length=0;
  const plain={...renderer,gl:{...gl,getExtension:()=>null}};
  assert.equal(buildSceneWarpNow(P,plain),true);
  assert.deepEqual(built,[sceneWarpProgram(P)]);
  assert.equal(buildSceneWarpNow(P,plain),false,'already built');
  assert.equal(built.length,1);
  delete sceneWarpProgram(P).glPrograms[7];
  assert.equal(buildSceneWarpNow(P,{...plain,gl:{...plain.gl,isContextLost:()=>true}}),false,'not on a lost context');
});
test('the engine knows which tokens a look moves (a transform), not those it only colours',()=>{
  const engine=new TokenFxEngine({PIXI,ticker:()=>({add(){},remove(){}}),now:()=>0,world:()=>0});
  const rocking=fakeToken(),glowing=fakeToken();
  const stop=engine.apply(rocking,{name:'rock',params:[{filterType:'transform',rotation:2}]});
  engine.apply(glowing,builtinPreset('glow'));
  assert.equal(engine.moves(rocking),true);
  assert.equal(engine.moves(glowing),false);
  stop();assert.equal(engine.moves(rocking),false);
});
test('a Transition eases once from its start to its end, then holds there',async()=>{
  const {animValue}=await import('../../../scripts/engines/tokenshade/animation.mjs');
  const a=normalizeAnim({animType:'once',val1:0,val2:1,loopDuration:2000,pauseBetweenDuration:500});
  const at=t=>animValue(a,0,{local:t,world:0});
  assert.equal(at(0),0);assert.equal(at(500),0,'waits out its delay');assert.equal(at(1500),0.5);assert.equal(at(2500),1);assert.equal(at(60000),1,'holds');
});
test('the transition presets play once and hold: becoming a material, leaving, arriving, washing over',()=>{
  const once=p=>p.params.some(f=>Object.values(f.animated??{}).some(a=>a.animType==='once'));
  for(const name of ['Turn to stone','Freeze solid','Burn away','Crumble to ash','Sparkle away','Form from sparkles','Rise from the ashes','Curse takes hold','Poison spreads'])
    assert.ok(once(builtinPreset(name)),name);
  const arrive=builtinPreset('Form from sparkles').params[0].animated.amount;
  assert.deepEqual([arrive.val1,arrive.val2],[1,0],'arriving is leaving played backwards');
});
test('an effect can follow the game: a live value from 0 to 1 sets it between its two ends',async()=>{
  const {animValue}=await import('../../../scripts/engines/tokenshade/animation.mjs');
  const a=normalizeAnim({animType:'driven',source:'hpLost',val1:1,val2:0.3});
  assert.equal(animValue(a,1,{local:0,world:0,drive:{hpLost:0}}),1);
  assert.ok(Math.abs(animValue(a,1,{local:0,world:0,drive:{hpLost:0.5}})-0.65)<1e-9);
  assert.equal(animValue(a,1,{local:0,world:0,drive:null}),1,'no live value yet: the start');
  assert.equal(normalizeAnim({animType:'driven',source:'nonsense'}).source,'hpLost');
});
test('the engine eases live values toward the game, so a hit shades in rather than snapping',async()=>{
  const {TokenFxEngine}=await import('../../../scripts/engines/tokenshade/engine.mjs');
  let hp=0,now=0;const engine=new TokenFxEngine({now:()=>now,drive:()=>({hpLost:hp})});
  const entry={sources:['hpLost'],live:null,liveAt:0};
  assert.equal(engine.liveValues(entry,0).hpLost,0);
  hp=1;now=100;assert.ok(Math.abs(engine.liveValues(entry,100).hpLost-0.25)<1e-9,'a quarter of the way after 100 ms');
  now=1000;assert.equal(engine.liveValues(entry,1000).hpLost,1);
});
test('effects fade in and out over the blend time, so a look that changes crossfades',async()=>{
  const {blendMix,TokenFxEngine}=await import('../../../scripts/engines/tokenshade/engine.mjs');
  assert.equal(blendMix({start:0,fadeMs:700},350),0.5,'half way in');
  assert.equal(blendMix({start:0,fadeMs:700},5000),1);
  assert.equal(blendMix({start:0,leavingAt:1000,fadeMs:700},1350),0.5,'half way out');
  assert.equal(blendMix({start:0,fadeMs:0},0),1,'At once');
  let now=0;const engine=new TokenFxEngine({now:()=>now});
  const entry={token:{},filters:[],mesh:{},fadeMs:700,leavingAt:0};engine.entries.add(entry);engine.detach=()=>{};
  engine.remove(entry);assert.ok(engine.entries.has(entry),'still fading out');assert.equal(entry.leavingAt,0+0||entry.leavingAt);
  engine.drop(entry);assert.ok(!engine.entries.has(entry));
});
test('the live values include light and weather',async()=>{
  const {DRIVE_SOURCES}=await import('../../../scripts/engines/tokenshade/animation.mjs');
  assert.deepEqual(Object.keys(DRIVE_SOURCES),['hpLost','height','turn','darkness','weather']);
  for(const name of ['Glows in the dark','Soaked in the rain','Dusted with snow'])assert.ok(builtinPreset(name),name);
  for(const name of ['Soaked in the rain','Dusted with snow'])assert.ok(builtinPreset(name).params.some(f=>Object.values(f.animated??{}).some(a=>a.animType==='driven'&&a.source==='weather')),`${name} follows the weather (so it stays dry under a roof)`);
  for(const name of ['Flares when targeted','Marked while targeted','Highlighted when selected'])assert.equal(builtinPreset(name),null,name);
  // Under a roof the weather is 0: the snow itself (not only the frost) must go, or a sheltered creature keeps a dusting.
  const frost=builtinPreset('Dusted with snow').params.find(f=>f.filterType==='frost');
  for(const key of ['amount','snow'])assert.ok(frost.animated?.[key]?.source==='weather'&&frost.animated[key].val1===0,`${key} is none without weather`);
});
test('previews make up live values that keep changing and play transitions again and again',async()=>{
  const {simulatedDrive,transitionCycle}=await import('../../../scripts/engines/preview/token-fx-preview.mjs');
  const a=simulatedDrive(0),b=simulatedDrive(1600);
  assert.equal(a.hpLost,1,'starts at full, so even a short preview shows it');assert.equal(a.weather,1);assert.equal(a.turn,1);
  assert.ok(Math.abs(b.hpLost)<1e-9,'then ebbs');assert.notEqual(simulatedDrive(0).turn,simulatedDrive(2100).turn,'switches');
  assert.equal(transitionCycle(builtinPreset('Turn to stone')),2600+1500);
  assert.equal(transitionCycle(builtinPreset('Burning')),0,'a lasting look just plays');
});
test('a valued condition uses its own look when there is one, and strength reaches filters without a strength setting',async()=>{
  const {scaleFilterStrength}=await import('../../../scripts/engines/playback/optional-fx.mjs');
  assert.equal(scaleFilterStrength({filterType:'splash',spread:3},0.55).fxMix,0.55,'a splash is blended with the art');
  assert.equal(scaleFilterStrength({filterType:'glow',outerStrength:4},0.5).outerStrength,2,'a glow still scales its own strength');
  assert.equal(scaleFilterStrength({filterType:'glow',outerStrength:4},0.5).fxMix,undefined);
  for(const n of ['Wounded','Wounded 2','Wounded 3'])assert.ok(builtinPreset(n),n);
  assert.ok(builtinPreset('Wounded 3').params.length>builtinPreset('Wounded').params.length,'more wounds');
});
test('every valued condition grows worse step by step: a look of its own for each value',async()=>{
  const {conditionLook}=await import('../../../scripts/catalogs/shared/condition-looks.mjs');
  const top={drained:4,enfeebled:4,dying:4,doomed:3,sickened:4,frightened:4,stupefied:4,clumsy:4,exhaustion:4};
  for(const [slug,max] of Object.entries(top)){
    const base=conditionLook({slug}).preset;
    for(let v=2;v<=max;v++)assert.ok(builtinPreset(`${base} ${v}`),`${slug} ${v}: ${base} ${v}`);
  }
});
