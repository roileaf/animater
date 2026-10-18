import test from 'node:test';
import assert from 'node:assert/strict';
import {validateRecipe,previewPlan,parseImport} from '../../scripts/core/model.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe,resolveStateRecipe,useStateEntry} from '../../scripts/catalogs/pf2e/state-catalog.mjs';
import {offsetInGridSquares} from '../../scripts/engines/media/media-preview.mjs';

const source={id:'source',center:{x:0,y:0},w:100,h:100};
const targets=[1,2,3].map((n)=>({id:`target-${n}`,center:{x:n*300,y:n*100},w:100,h:100}));
const context={source,targets,gridSize:100};
const recipe=(stage)=>validateRecipe({id:'audit',name:'Audit',trigger:'manual',stages:[{kind:'impact',assets:['jb2a.impact'],duration:1000,...stage}]});
const state=name=>{const entry=PF2E_EFFECTS.find(e=>e.name===name);assert.ok(entry,name);return entry;};

test('specific contacts select third target and never repeat first when second or third is absent',()=>{
 assert.equal(previewPlan(recipe({targetSelection:'third'}),context)[0].destination.id,'target-3');
 for(const targetSelection of ['second','third'])assert.deepEqual(previewPlan(recipe({targetSelection}),{...context,targets:[targets[0]]}),[]);
 assert.throws(()=>previewPlan(recipe({targetSelection:'third'}),{...context,targets:[]}),/Target at least one/);
 const five=[...targets,{...targets[2],id:'target-4'},{...targets[2],id:'target-5'}];
 assert.equal(previewPlan(recipe({targetSelection:'last',targetLimit:4}),{...context,targets:five})[0].destination.id,'target-4');
});
test('secondary rays originate at first victim rather than recasting from source',()=>{
 const r=recipe({kind:'travel',travelOrigin:'firstTarget',targetSelection:'second'});
 const plan=previewPlan(parseImport(JSON.stringify({schema:1,recipes:[r]}))[0],context);
 assert.equal(plan.length,1);assert.equal(plan[0].origin.id,'target-1');assert.equal(plan[0].endpoint.id,'target-2');
});
test('seven beam cone rays retain native endpoints and individual colors through import',()=>{
 const colors=['#ff0000','#ff8000','#ffff00','#00ff00','#00bfff','#0000ff','#8000ff'];
 const r=recipe({kind:'travel',travelDestination:'area',areaLayout:'fan',fanCount:7,fanColors:colors});
 const imported=parseImport(JSON.stringify({schema:1,recipes:[r]}))[0];
 const plan=previewPlan(imported,{source,targets:[],gridSize:100,area:{type:'cone',center:{x:100,y:100},endpoint:{x:100,y:400},length:300,angle:60}});
 assert.equal(plan.length,7);assert.equal(new Set(plan.map(s=>`${s.endpoint.x},${s.endpoint.y}`)).size,7);
 assert.deepEqual(plan.map(s=>s.tint),colors);assert.ok(plan.every(s=>s.areaFan&&s.colorize&&s.tintEnabled));
});
test('optional sound attenuation survives save/load and invalid gains stay bounded',()=>{
 const r=recipe({kind:'sound',soundFile:'modules/psfx/test.ogg',optionalSound:{profile:'test',gain:.42,cue:0,candidates:[{module:'psfx',file:'modules/psfx/test.ogg',gain:.25,duration:1000}]}});
 const stage=validateRecipe(JSON.parse(JSON.stringify(r))).stages[0];
 assert.equal(stage.optionalSound.gain,.42);assert.equal(stage.optionalSound.candidates[0].gain,.25);
 const invalid=recipe({...r.stages[0],optionalSound:{...r.stages[0].optionalSound,gain:NaN,candidates:[{...r.stages[0].optionalSound.candidates[0],gain:9}]}}).stages[0];
 assert.equal(invalid.optionalSound.gain,1);assert.equal(invalid.optionalSound.candidates[0].gain,1);
});
test('protective effects are wards; word fragments do not invent cold or mental visuals',()=>{
 // Typed resistances are wards themed by their damage type (e.g. ice-ward); never a cold/fire aura.
 for(const name of ['Effect: Blood Booster','Spell Effect: Blood Ward','Effect: Ironblood Stance','Effect: Potion of Acid Resistance','Effect: Potion of Cold Resistance','Effect: Potion of Fire Resistance'])assert.match(state(name).theme,/^(?:shield|[a-z]+-ward)$/,name);
 // Chosen-type effects resolve their element at runtime (choice-ward/elemental), multi-type ones are prismatic wards.
 for(const name of ['Spell Effect: Resist Energy','Spell Effect: Elemental Gift','Spell Effect: Primal Summons'])assert.match(state(name).theme,/^(?:shield|boon|elemental|[a-z]+-ward)$/,name);
 assert.notEqual(state('Spell Effect: Elemental Gift').theme,'fire-ward');
 assert.equal(state('Effect: Harrow-Chosen').theme,'boon');
 assert.equal(state('Effect: Featherlight Fletching').theme,'speed');
 assert.notEqual(state('Effect: Balisse Feather').theme,'flight');
 assert.equal(state('Effect: Potion of Acid Resistance').wardColor,'green');
 // Fire resistance now uses the native fiery shield (already orange) instead of a tinted blue one.
 assert.match(state('Effect: Potion of Fire Resistance').assets[0],/shield_themed\.above\.fire/);
 const fireWard=stateRecipe(state('Effect: Potion of Fire Resistance')).stages[0];
 const acidWard=stateRecipe(state('Effect: Potion of Acid Resistance')).stages[0];
 assert.ok(fireWard.assets[0].includes('.orange')||fireWard.colorize&&fireWard.tint==='#ffad64');
 // Distinct by native footage or by tint.
 assert.ok(fireWard.assets[0]!==acidWard.assets[0]||fireWard.tint!==acidWard.tint);
});
test('persistent rings, shields and chains are readable; markers and damage have their own presentation',()=>{
 const slowed=PF2E_CONDITIONS.find(e=>e.slug==='slowed'),grabbed=PF2E_CONDITIONS.find(e=>e.slug==='grabbed');
 assert.ok(stateRecipe(slowed).stages[0].scale>=1.35);assert.ok(stateRecipe(grabbed).stages[0].scale>=1.5);
 const shield=stateRecipe(state('Spell Effect: Fire Shield')).stages[0];assert.ok(shield.scale>=1.3);assert.ok(shield.opacity>=.8);assert.equal(shield.below,false);
 const damage=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage'),fire=stateRecipe(damage,{damageType:'fire'}).stages[0],bleed=stateRecipe(damage,{damageType:'bleed'}).stages[0];
 assert.ok(fire.scale>bleed.scale);assert.ok(fire.opacity>=.75);assert.equal(bleed.offsetY,0);assert.equal(bleed.below,false);
 const custom=validateRecipe({...stateRecipe(slowed),stages:[{...stateRecipe(slowed).stages[0],scale:.4,opacity:.3}]});
 const setting={...useStateEntry({},slowed.id),customized:[slowed.id]};
 assert.equal(resolveStateRecipe({type:'condition',slug:'slowed',name:'Slowed',system:{}},setting,[custom]).stages[0].scale,.4);
 assert.equal(offsetInGridSquares(bleed,{w:300,h:300},100).y,bleed.offsetY*3);
 assert.equal(offsetInGridSquares({...bleed,offsetUnits:'grid'},{w:300,h:300},100).y,bleed.offsetY);
});
test('Free fallback markers use marker placement (a ring under the token) rather than copying Patreon orbit size',()=>{
 const damage=PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage');
 const entry={...damage,damageVariants:{cold:{assets:['jb2a.aura_themed.01.orbit.loop.cold.blue','jb2a.markers.snowflake.blue'],scale:1.85,opacity:.84,below:false}}};
 const patreon=stateRecipe(entry,{damageType:'cold',catalog:[{key:entry.damageVariants.cold.assets[0]}]}).stages[0];
 const free=stateRecipe(entry,{damageType:'cold',catalog:[{key:entry.damageVariants.cold.assets[1]}]}).stages[0];
 assert.equal(patreon.scale,1.5);assert.equal(free.offsetY,0);assert.equal(free.below,true);
});
