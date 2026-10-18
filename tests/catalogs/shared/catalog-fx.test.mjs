import test from 'node:test';
import assert from 'node:assert/strict';
import {catalogFxSettings,withCatalogFx,catalogFxDesign} from '../../../scripts/catalogs/shared/catalog-fx.mjs';
import {PF2E_SPELLS,spellRecipe} from '../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {PF2E_FEATS,featRecipe} from '../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs';
import {PF2E_WEAPONS,weaponRecipe} from '../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs';
import {PF2E_CONDITIONS,PF2E_EFFECTS,stateRecipe} from '../../../scripts/catalogs/pf2e/state-catalog.mjs';
import {DND5E_ENTRIES,dndRecipe} from '../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {SF2E_ENTRIES,sfRecipe} from '../../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {planRecipe,validateRecipe,MAX_STAGES} from '../../../scripts/core/model.mjs';
import {Workspace} from '../../../scripts/ui/workspace.mjs';
const fxCatalog={tokenReady:true,sceneReady:true,isGM:true,
 presets:['fire','pure-ice-aura','electric','fumes','smoke','glow','hexa-field','earth-field','water-field','blur','distortion','spectral-body','warp-field','fire-aura','zoomblur'].map(name=>({name,library:'tokenshade'})),
 effects:[{type:'screenShake',category:'filter'},{type:'clouds',category:'particle'},{type:'rain',category:'particle'}]};
const fx=r=>r.stages.filter(s=>s.catalogFx);
const spell=(name,options={})=>spellRecipe(PF2E_SPELLS.find(e=>e.name===name),undefined,{fxCatalog,...options});
const media=r=>r.stages.flatMap(s=>s.assets.map(key=>({key})));
const source={id:'source',center:{x:0,y:0}},targets=Array.from({length:5},(_,i)=>({id:`t${i}`,center:{x:300+i*100,y:0}}));

test('all native catalog builders add installed provider stages and preserve their base choreography',()=>{
 const builders=[
  ...PF2E_SPELLS.map(e=>o=>spellRecipe(e,undefined,o)),
  ...PF2E_FEATS.map(e=>o=>featRecipe(e,o)),
  ...PF2E_WEAPONS.flatMap(e=>e.modes.map(m=>o=>weaponRecipe(e,m.mode,o))),
  ...[...PF2E_CONDITIONS,...PF2E_EFFECTS].map(e=>o=>stateRecipe(e,o)),
  ...DND5E_ENTRIES.flatMap(e=>e.variants.map(v=>o=>dndRecipe(e,v.id,o))),
  ...SF2E_ENTRIES.flatMap(e=>e.variants.map(v=>o=>sfRecipe(e,v.id,o))),
 ];
 let enhanced=0;
 for(const build of builders){
  const base=build({fx:false}),r=build({fxCatalog});
  assert.deepEqual(r.stages.filter(s=>!s.catalogFx),base.stages,r.name);
  assert.deepEqual(validateRecipe(r),r,r.name);
  assert.ok(r.stages.length<=MAX_STAGES,r.name);
  if(fx(r).length)enhanced++;
 }
 // Wards, rushes and element accents now require fiction evidence (fewer, truer FX).
 assert.ok(enhanced>1100,`${enhanced} matching recipes`);
});
test('native description evidence rejects misleading healing and ward metadata',()=>{
 assert.equal(fx(spell('Arcane Explosion'))[0].fxProfile,'force');
 assert.equal(fx(spell('Befitting Attire')).length,0);
 assert.equal(fx(spell('Brain Drain')).length,0);
 assert.equal(fx(spell('Heal'))[0].fxProfile,'healing');
 // JB2A shield art already draws the barrier; Token Magic's large hexa dome is not stacked on it.
 assert.ok(!fx(spell('Shield')).some(s=>s.fxProfile==='ward'));
 for(const name of ['Antidote','Armor Tampered With (Success)','A Little Bird Told Me...']){
  const e=PF2E_EFFECTS.find(e=>e.name===`Effect: ${name}`);
  assert.ok(e);assert.equal(fx(stateRecipe(e,{fxCatalog})).length,0,name);
 }
});
test('elemental contacts, source rushes and teleport departure use different body treatments',()=>{
 assert.equal(fx(spell('Ignition'))[0].fxPreset,'fire');
 assert.equal(fx(spell('Frostbite'))[0].fxPreset,'pure-ice-aura');
 assert.equal(fx(spell('Force Barrage'))[0].fxPreset,'glow');
 const rush=featRecipe(PF2E_FEATS.find(e=>e.slug==='sudden-charge'),{fxCatalog});
 assert.equal(fx(rush)[0].fxPreset,'zoomblur');assert.equal(fx(rush)[0].subject,'source');
 assert.equal(rush.stages.find(s=>s.stageId===fx(rush)[0].afterStage).motion,'rush');
 assert.equal(fx(spell('Translocate'))[0].fxPreset,'warp-field');
 const acid=PF2E_WEAPONS.find(e=>e.name==='Acid Flask (Lesser)');
 assert.ok(acid);{const s=fx(weaponRecipe(acid,acid.modes[0].mode,{fxCatalog}))[0];assert.ok(['Corroding','glow'].includes(s.fxPreset),s.fxPreset);assert.equal(s.fxTint,'','the acid look is already coloured');}
 const sword=PF2E_WEAPONS.find(e=>e.name==='Longsword');assert.ok(sword);
 assert.equal(fx(weaponRecipe(sword,'melee',{fxCatalog})).length,0);
});
test('linked electric contacts follow each chain hop without doubling target staggering',()=>{
 const r=spell('Chain Lightning'),plan=planRecipe(r,media(r),{source,targets,gridSize:100,preview:true});
 const accent=fx(r)[0];assert.equal(accent.fxProfile,'electricity');
 const contacts=plan.filter(s=>s.stageId===accent.afterStage),filters=plan.filter(s=>s.stageId===accent.stageId);
 assert.equal(filters.length,5);
 assert.deepEqual(filters.map(s=>[s.destination.id,s.delay]),contacts.map(s=>[s.destination.id,s.delay]));
 assert.ok(new Set(filters.map(s=>s.delay)).size>1);
});
test('Force Barrage only filters hit recipients; spell templates do not gain a target requirement',()=>{
 const r=spell('Force Barrage'),plan=planRecipe(r,media(r),{source,targets,gridSize:100,preview:true});
 const accent=fx(r)[0],filters=plan.filter(s=>s.stageId===accent.stageId),contacts=plan.filter(s=>s.stageId===accent.afterStage);
 assert.deepEqual(new Set(filters.map(s=>s.destination.id)),new Set(contacts.map(s=>s.destination.id)));
 const areaSpell=spell('Fireball'),template={id:'template',center:{x:300,y:0}};
 assert.ok(fx(areaSpell).length);
 const areaPlan=planRecipe(areaSpell,media(areaSpell),{source,targets:[],template,area:{type:'circle',center:template.center,radius:300},gridSize:100,preview:true});
 assert.ok(areaPlan.some(s=>s.kind==='template'));assert.ok(!areaPlan.some(s=>s.kind==='tokenfx'));
});
test('shared scene effects are restricted to explicit weather and earthquake spells',()=>{
 for(const [name,type] of [['Earthquake','screenShake'],['Control Weather','clouds'],['Storm of Vengeance','rain']]){
  const s=fx(spell(name)).find(s=>s.kind==='scenefx');assert.ok(s,name);assert.equal(s.fxType,type);
 }
 for(const name of ['Fireball','Lightning Bolt','Mist','Ignition'])assert.ok(!fx(spell(name)).some(s=>s.kind==='scenefx'),name);
});
test('provider removal, catalog switches and portable imports preserve base recipe readiness',()=>{
 const e=PF2E_SPELLS.find(e=>e.name==='Ignition'),base=spellRecipe(e,undefined,{fx:false});
 assert.equal(withCatalogFx(base,e,{fxCatalog:{...fxCatalog,tokenReady:false,sceneReady:false}}),base);
 assert.equal(withCatalogFx(base,e,{fx:false,fxCatalog}),base);
 const w=Object.create(Workspace.prototype);w.host={fxCatalog:()=>({presets:[],effects:[],tokenReady:false,sceneReady:false}),catalog:()=>media(base)};
 w.motionBlocked=()=>false;
 assert.equal(w.status(spell('Ignition')),'Ready to play');
 assert.deepEqual(catalogFxSettings({settings:{get:(_,key)=>key==='catalogTokenFx'?false:true}}),{token:false,scene:true,looks:'tokenshade'});
 const previous={game:globalThis.game,PIXI:globalThis.PIXI};
 try{
  // The built-in engine is ready wherever there is a renderer; no other module needed.
  globalThis.game={modules:new Map(),settings:{get:()=>true},user:{isGM:true}};
  globalThis.PIXI={Filter:class {}};
  assert.equal(fx(spellRecipe(e)).length,1,'automatic builder uses the built-in token FX');
  globalThis.game.settings.get=()=>false;assert.deepEqual(spellRecipe(e).stages,base.stages);
 }finally{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}}
});
test('condition filters remain document-linked; temporary previews retain finite sample times',()=>{
 const concealed=stateRecipe(PF2E_CONDITIONS.find(e=>e.slug==='concealed'),{fxCatalog}),s=fx(concealed)[0];
 assert.equal(s.fxPreset,'blur');assert.equal(s.persist,true);assert.equal(s.subject,'source');
 const damage=stateRecipe(PF2E_CONDITIONS.find(e=>e.slug==='persistent-damage'),{damageType:'fire',fxCatalog});
 assert.equal(fx(damage)[0].fxPreset,'fire');assert.equal(fx(damage)[0].persist,true);
 assert.equal(planRecipe(concealed,media(concealed),{source,targets:[]}).find(s=>s.kind==='tokenfx').duration,6000);
 const w=Object.create(Workspace.prototype);w.host={fxCatalog:()=>fxCatalog,catalogFxSettings:()=>({token:false,scene:true}),setCatalogFxSetting:()=>{}};
 const html=w.catalogFxControlsHTML({});assert.match(html,/Catalog: Tokenshade/);assert.match(html,/Catalog: FXMaster/);assert.match(html,/catalogTokenFx[\s\S]*?aria-checked="false"/);
 assert.match(w.optionalFxControlsHTML(s,1),/Filter stays while the condition or effect is on the token/);
});

test('lasting conditions show a quiet Tokenshade look instead of JB2A, or JB2A only when the catalog says so',async()=>{
 const {PRESETS}=await import('../../../scripts/engines/tokenshade/presets.mjs');
 const {CONDITION_LOOK_PRESETS,conditionLookStrength}=await import('../../../scripts/catalogs/shared/condition-looks.mjs');
 for(const name of CONDITION_LOOK_PRESETS)assert.ok(PRESETS.some(p=>p.name===name),`${name} exists`);
 const shade={tokenReady:true,sceneReady:false,isGM:true,effects:[],presets:PRESETS.map(p=>({name:p.name,library:p.library}))};
 const cond=slug=>PF2E_CONDITIONS.find(e=>e.slug===slug);
 const petrified=stateRecipe(cond('petrified'),{fxCatalog:shade});
 assert.deepEqual(petrified.stages.filter(s=>!['sound','motion'].includes(s.kind)).map(s=>[s.kind,s.fxPreset,s.persist,s.fxEssential]),[['tokenfx','Petrified',true,true]]);
 assert.equal(stateRecipe(cond('frightened'),{fxCatalog:shade}).stages.find(s=>s.kind==='tokenfx').fxPreset,'Wintry Pallor');
 const fire=stateRecipe(cond('persistent-damage'),{damageType:'fire',fxCatalog:shade}).stages.find(s=>s.kind==='tokenfx');
 assert.equal(fire.fxPreset,'Burning');assert.equal(fire.fxStrength,.6);
 assert.equal(stateRecipe(cond('stunned'),{fxCatalog:shade}).stages.find(s=>s.kind==='tokenfx').fxPreset,'Dazed');
 // JB2A mode: the JB2A layers play and no Tokenshade filter is added to the condition.
 const jb2a={...shade,conditionLooks:'jb2a'};
 for(const slug of ['petrified','stunned','frightened']){
  const r=stateRecipe(cond(slug),{fxCatalog:jb2a});
  assert.ok(r.stages.some(s=>s.kind==='aura'),slug);assert.ok(!r.stages.some(s=>s.kind==='tokenfx'),slug);
 }
 assert.ok(!stateRecipe(cond('persistent-damage'),{damageType:'fire',fxCatalog:jb2a}).stages.some(s=>s.kind==='tokenfx'));
 assert.ok(stateRecipe(cond('petrified'),{fxCatalog:{...shade,tokenReady:false}}).stages.some(s=>s.kind==='aura'),'without Tokenshade the JB2A layers play');
 assert.ok(stateRecipe(cond('petrified'),{fxCatalog:shade,fx:false}).stages.some(s=>s.kind==='aura'),'catalog filters off keeps JB2A');
 assert.deepEqual([0,1,2,3,4].map(conditionLookStrength),[1,.55,.7,.85,1]);
});

test('every catalogued condition in every system has its own Tokenshade look',async()=>{
 const {PRESETS}=await import('../../../scripts/engines/tokenshade/presets.mjs');
 const {conditionLook}=await import('../../../scripts/catalogs/shared/condition-looks.mjs');
 const {sfEntries}=await import('../../../scripts/catalogs/sf2e/sf2e-catalog.mjs');
 const {dndEntries}=await import('../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs');
 const {dhEntries}=await import('../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs');
 for(const [system,list] of [['pf2e',PF2E_CONDITIONS],['sf2e',sfEntries('condition')],['dnd5e',dndEntries('condition')],['daggerheart',dhEntries('condition')]])
  for(const e of list){const look=conditionLook(e);assert.ok(look&&PRESETS.some(p=>p.name===look.preset),`${system} ${e.slug??e.name}`);}
 assert.equal(conditionLook({slug:'persistent-damage'},{damageType:'bleed'}).preset,'Bleeding');
});
test('the condition look switch is one world setting, Tokenshade unless set to JB2A',async()=>{
 const {conditionLookMode,nextConditionLookMode,conditionLookSwitchHTML}=await import('../../../scripts/catalogs/shared/condition-look-choice.mjs');
 assert.equal(conditionLookMode(undefined),'tokenshade');assert.equal(conditionLookMode('jb2a'),'jb2a');
 assert.equal(nextConditionLookMode('tokenshade'),'jb2a');assert.equal(nextConditionLookMode('jb2a'),'tokenshade');
 assert.match(conditionLookSwitchHTML('jb2a'),/aria-checked="false"[^>]*data-action="condition-looks"[^>]*>JB2A</);
 const settings=values=>({settings:{get:(_,key)=>values[key]}});
 assert.equal(catalogFxSettings(settings({conditionLooks:'jb2a'})).looks,'jb2a');
 assert.equal(catalogFxSettings(settings({})).looks,'tokenshade');
});
