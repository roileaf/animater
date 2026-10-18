import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PF2E_EFFECTS,stateRecipe,resolveStateRecipe} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import {nativeAuraStates} from '../../../scripts/engines/playback/persistent-states.mjs';
import {resolveAsset} from '../../../scripts/core/model.mjs';
import {assetDatabases} from '../../../tools/asset-databases.mjs';
import {assetGeometry} from '../../../tools/spell-asset-selection.mjs';
let libraries;try{libraries=JSON.parse(await readFile(new URL('../../../.cache/persistent-databases.json',import.meta.url),'utf8'));}catch{libraries=await assetDatabases();}
const byKey=Object.fromEntries(Object.entries(libraries).map(([edition,rows])=>[edition,new Map(rows.map(r=>[r.key,r]))]));
const media=(s,edition)=>byKey[edition].get(resolveAsset(s,libraries[edition]));
const entry=name=>{const e=PF2E_EFFECTS.find(e=>e.name===name);assert.ok(e,name);return e;};
const keys=(name,edition)=>stateRecipe(entry(name),{catalog:libraries[edition]}).stages.map(s=>resolveAsset(s,libraries[edition]));
test('ward glyphs, protective sphere, metal plates and wind cloak use different field artwork in both editions',()=>{
 for(const edition of ['free','patreon']){
  assert.match(keys('Aura: Protective Wards',edition).join(' '),/magic_signs.*abjuration/);
  assert.match(keys("Aura: Protector's Sphere",edition).join(' '),/shield|antilife_shell|bubble/);
  assert.match(keys('Stance: Shattershields',edition).join(' '),/aura_themed.*metal/);
  assert.match(keys('Spell Effect: Tempest Cloak',edition).join(' '),/whirl|wind_lines/);
  assert.equal(new Set(['Aura: Protective Wards',"Aura: Protector's Sphere",'Stance: Shattershields','Spell Effect: Tempest Cloak'].map(n=>keys(n,edition).join('|'))).size,4);
 }
});
test('elemental forms and Life Burn follow their actual native aura material, not shared full-form stats or names',()=>{
 for(const edition of ['free','patreon']){
  assert.doesNotMatch(keys('Spell Effect: Element Embodied (Air)',edition).join(' '),/flames|fire/);
  assert.doesNotMatch(keys('Spell Effect: Element Embodied (Earth)',edition).join(' '),/flames|fire/);
  assert.match(keys('Spell Effect: Element Embodied (Metal)',edition).join(' '),/lightning/);
  assert.doesNotMatch(keys('Effect: Life Burn Aura',edition).join(' '),/flames|fire/);
  assert.match(keys('Effect: Life Burn Aura',edition).join(' '),/energy_field|refraction/);
 }
});
test('prepared aura effect parent takes precedence over a shared base kinetic aura rule',()=>{
 const base=entry('Effect: Kinetic Aura'),specific=entry('Stance: Shattershields');
 const item=e=>({uuid:`Actor.a.Item.${e.id}`,type:'effect',name:e.name,sourceId:e.uuid,system:{rules:[{key:'Aura',slug:'kinetic-aura'}]}});
 const b=item(base),s=item(specific),actor={items:[b,s],auras:new Map([['kinetic-aura',{slug:'kinetic-aura',radius:10,effects:[{parent:s,uuid:entry('Effect: Shattershields').uuid}]}]])};
 assert.deepEqual(nativeAuraStates(actor).map(i=>i.animaterAura.entryId),[specific.id]);
});
test('every reviewed field has distinct resolved artwork beyond labels, timing, size or opacity; only same-ability aliases share',()=>{
 const fields=PF2E_EFFECTS.filter(e=>e.auras||e.auraSources);assert.equal(fields.length,117);
 for(const edition of ['free','patreon']){
  const groups=new Map(),structures=new Map();
  for(const e of fields){
   assert.ok(e.auraDesign,e.name);assert.equal(e.auraDesign.reviewedDescriptionHash,e.descriptionHash);
   const r=stateRecipe(e,{catalog:libraries[edition]});assert.equal(r.stages.length,2);
   const key=JSON.stringify(r.stages.map(s=>[media(s,edition).file,s.tintEnabled?s.tint:null]).sort());
   const previous=groups.get(key);if(previous)assert.equal(previous,e.auraDesign.id,`${edition}: ${e.name}`);else groups.set(key,e.auraDesign.id);
   const structure=JSON.stringify(r.stages.map(s=>media(s,edition).key.replace(/\.(?:blue|grey|green|white|black|dark_black|orange|purple|red|yellow|pink|bluepurple|blueteal|greenpurple|greenyellow|purplered|orangeyellow|bluepink|pinkpurple|pinkyellow|orangepurple)$/,'')).sort());
   const old=structures.get(structure);if(old)assert.equal(old,e.auraDesign.id,`${edition} color-independent: ${e.name}`);else structures.set(structure,e.auraDesign.id);
   for(const s of r.stages){assert.equal(assetGeometry(media(s,edition)),'radial');assert.equal(s.scale,1);assert.equal(s.offsetX,0);assert.equal(s.offsetY,0);assert.equal(s.persist,true);assert.ok(!/markers|token_border/.test(s.assets.join(' ')));}
  }
  assert.equal(groups.size,90);assert.equal(structures.size,90);
 }
});
test('native thermal and tradition selections change the field; unspecified choices stay neutral',()=>{
 const thermal=entry('Stance: Thermal Nimbus'),manifest=entry('Aura: Manifest Will');
 const source=flags=>({actor:{flags:{system:flags}},flags:{}});
 const r=(e,flags)=>stateRecipe(e,{catalog:libraries.free,aura:{slug:'test',radius:20,source:source(flags)}});
 assert.match(r(thermal,{kineticist:{thermalNimbus:'cold'}}).stages.map(s=>s.assets).join(' '),/cold/);
 assert.match(r(thermal,{kineticist:{thermalNimbus:'fire'}}).description,/fire/);
 assert.doesNotMatch(r(thermal,{}).stages.map(s=>s.assets).join(' '),/flames|cold/);
 assert.notDeepEqual(r(manifest,{manifestWillTradition:'arcane'}).stages.map(s=>s.assets),r(manifest,{manifestWillTradition:'primal'}).stages.map(s=>s.assets));
});
test('native emitter radius covers every layer; ordinary recipients and custom recipients stay local',()=>{
 const e=entry('Aura: Protective Wards'),item={type:'effect',name:e.name,sourceId:e.uuid,system:{}};
 const state={enabled:true,scope:'all',customized:[e.id]};
 const emitter={...item,animaterAura:{entryId:e.id,slug:'protective-wards',radius:25,source:item}};
 assert.ok(resolveStateRecipe(emitter,state,[],libraries.free).stages.every(s=>s.auraRadius===25));
 assert.ok(resolveStateRecipe(item,state,[],libraries.free).stages.every(s=>s.auraRadius===undefined));
 const custom={...stateRecipe(e),name:'Personal ward',stages:stateRecipe(e).stages.map(s=>({...s,opacity:.75}))};
 const recipe=resolveStateRecipe(item,state,[custom],libraries.free);assert.equal(recipe.name,'Personal ward');assert.ok(recipe.stages.every(s=>s.auraRadius===undefined&&s.opacity===.75));
});
test('circular radar sweeps containing footprint feet are fields, not projectile flights',()=>{
 for(const edition of ['free','patreon'])assert.equal(assetGeometry(libraries[edition].find(r=>r.key.includes('radar.loop.800px.001.sweep.'))),'radial');
});
test('aura provider references use actual native compendium pack IDs',()=>{
 for(const e of PF2E_EFFECTS.filter(e=>e.auraSources))for(const s of e.auraSources)assert.doesNotMatch(s.uuid,/^Compendium\.pf2e\.(equipment|feats|spells)\.Item\./);
 assert.match(entry("Aura: Demon's Knot").auraSources[0].uuid,/^Compendium\.pf2e\.equipment-srd\.Item\./);
});
test('holy and leadership auras never use the screaming-spirit or heart ring motifs (Aura003 styles 002 and 001)',()=>{
 for(const name of ['Spell Effect: Bless','Spell Effect: Benediction','Aura: Angelic Halo','Aura: Righteous Call',"Effect: Marshal's Aura","Effect: Commander's Banner",'Effect: Inspiring Marshal Stance'])
  for(const edition of ['free','patreon'])assert.doesNotMatch(keys(name,edition).join(' '),/aura\.03\.(?:in|out)ward\.00[12]\./,`${name} ${edition}`);
});
