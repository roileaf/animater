import test from 'node:test';
import assert from 'node:assert/strict';
import {animValue, normalizeAnim, compileAnimations, ANIM_TYPES} from '../../../scripts/engines/tokenshade/animation.mjs';
import {SPECS, FILTER_TYPES, specFor, resolveParams} from '../../../scripts/engines/tokenshade/filters/index.mjs';
import {PRESETS, builtinPreset, LIBRARY} from '../../../scripts/engines/tokenshade/presets.mjs';
import {TokenFxEngine, presetFilters} from '../../../scripts/engines/tokenshade/engine.mjs';
import {shaderSource} from '../../../scripts/engines/tokenshade/filter-factory.mjs';
import {tokenFxApi} from '../../../scripts/engines/tokenshade/api.mjs';

class Filter {constructor(vertex,fragment,uniforms){this.uniforms=uniforms;this.enabled=true;this.destroyed=false;}destroy(){this.destroyed=true;}}
const PIXI={Filter,Texture:{EMPTY:{}}};

test('every Token Magic filter type and animation type has an animater implementation',()=>{
  assert.ok(['material','frost','bindings','base'].every(t=>specFor(t)),'Tokenshade originals');
  const tmfx=['adjustment','ascii','dot','distortion','crt','oldfilm','glow','outline','colorGradient','bevel','xbloom','shadow','twist','zoomblur','blur','bulgepinch','zapshadow','ray','fog','xfog','electric','wave','shockwave','fire','fumes','smoke','flood','images','field','xray','liquid','xglow','pixel','web','ripples','globes','transform','splash','polymorph','xfire','sprite','spriteMask','replaceColor','ddTint','rgbSplit'];
  assert.deepEqual(tmfx.filter(t=>!specFor(t)),[]);
  assert.equal(ANIM_TYPES.length,18);
  for(const type of ANIM_TYPES)assert.ok(normalizeAnim({animType:type}).animType,type);
});
test('the built-in library has all 116 Token Magic preset names plus Tokenshade originals, every filter known',()=>{
  assert.equal(PRESETS.length,164);
  assert.equal(PRESETS.filter(p=>p.library===LIBRARY.TOKEN).length,119);
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
