import test from 'node:test';
import assert from 'node:assert/strict';
import {PF2E_SPELLS,spellRecipe,automaticCatalogRecipe,catalogSpellEnabled,useCatalogSpell,resolveAutomaticRecipe} from '../../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs';
import {validateRecipe,planRecipe} from '../../../../scripts/core/model.mjs';
import {spellSources} from '../../../../tools/pf2e-source.mjs';
import {analyzeSpellDescription} from '../../../../tools/spell-semantics.mjs';
import {assetDatabases} from '../../../../tools/asset-databases.mjs';
import {SPECIFIC_FALLBACK_DESIGNS,SPECIFIC_FALLBACK_MOTIFS,describedMaterialArea} from '../../../../scripts/catalogs/pf2e/spells/spell-specific-fallbacks.mjs';
import {withUnconfiguredSpell} from '../../../helpers/catalog-fixtures.mjs';
const get=name=>PF2E_SPELLS.find(s=>s.name===name);
const event=s=>({type:s.trigger,item:{type:'spell',name:s.name,system:{slug:s.slug},_stats:{compendiumSource:`Compendium.pf2e.spells-srd.Item.${s.id}`}}});

test('unfinished catalog records have no fabricated animation, media, motion, sound or automatic fallback',async()=>{
 await withUnconfiguredSpell('500 Toads',async s=>{
  assert.equal(s.quality,'unconfigured',s.name);
  assert.equal(s.design.sharedCount,0,s.name);
  const draft=spellRecipe(s,undefined,{sounds:{packs:[]}});
  assert.equal(draft.enabled,false,s.name);
  assert.deepEqual(draft.stages.map(p=>p.assets),[[]],s.name);
  assert.equal(automaticCatalogRecipe(event(s),{enabled:true}),null,s.name);
  assert.equal(catalogSpellEnabled(s.id,{enabled:true,scope:'all'}),false,s.name);
  assert.throws(()=>useCatalogSpell({},s.id),/needs configuration/);
  assert.throws(()=>validateRecipe(draft),/database key/);
 const configured=spellRecipe(s);
 configured.enabled=true;configured.stages[0].assets=['jb2a.custom.toad'];
 assert.equal(resolveAutomaticRecipe(event(s),{enabled:true,selected:[s.id],preferCatalog:true},[configured]).id,configured.id,'a stale built-in preference cannot hide a configured custom animation');
 });
});

test('explicit replacements retain native full-description evidence and intended motifs',async()=>{
 const native=await spellSources();
 for(const [slug,[motif]] of Object.entries(SPECIFIC_FALLBACK_DESIGNS)){
  const records=PF2E_SPELLS.filter(s=>s.slug.replace(/-legacy$/,'')===slug);
  assert.ok(records.length,slug);
  for(const s of records){
   const item=native.spells.find(e=>e.source._id===s.id).source;
   const analysis=analyzeSpellDescription(item,{slug:s.slug,theme:s.theme,kind:s.kind,delivery:s.delivery});
   assert.equal(analysis.descriptionHash,s.design.descriptionHash,slug);
   assert.equal(analysis.motif,motif,slug);
   assert.equal(analysis.unavailable,false,slug);
   assert.ok(analysis.descriptionChars>40,slug);
  }
 }
});

test('Countless Eyes, Containment and Bone Flense use their actual target roles in both JB2A editions',async()=>{
 const databases=await assetDatabases();
 for(const [edition,db] of Object.entries(databases)){
  for(const [name,families] of [['Countless Eyes',['eyes']],['Containment',['bubble','shield']],['Bone Flense',['glint','shimmer']]]){
   const s=get(name),recipe=spellRecipe(s);
   const plan=planRecipe(recipe,db,{source:{id:'caster'},targets:[{id:'recipient'}]});
   assert.deepEqual(plan.map(p=>p.asset.split('.')[1]),families.length===1?['eyes','eyes']:families,`${edition}/${name}`);
   assert.ok(plan.every(p=>p.destination.id==='recipient'),name);
   assert.ok(!recipe.stages.some(p=>p.kind==='motion'),name);
  }
 }
});

test('deferred effects never replay their later hits, and no replacement adds a generic casting seal',()=>{
 for(const name of ['Delay Consequence','Bone Flense','Contingency','Sparkleskin','Angelic Halo','Alarm','Celestial Brand']){
  const recipe=spellRecipe(get(name));
  assert.ok(recipe.enabled,name);
  assert.ok(!recipe.stages.some(p=>p.kind==='motion'||p.assets.some(k=>/^jb2a\.(impact|fireball|melee_|cast_generic)/.test(k))),name);
 }
 for(const s of PF2E_SPELLS.filter(s=>SPECIFIC_FALLBACK_MOTIFS[s.design.motif]))
  assert.ok(!spellRecipe(s).stages.some(p=>/Casting seal/.test(p.label)||p.assets.some(k=>k.startsWith('jb2a.cast_generic'))),s.name);
 const halo=spellRecipe(get('Angelic Halo'));
 assert.ok(halo.stages.some(p=>p.kind==='cast'&&p.label==='Halo above caster'));
 assert.ok(halo.stages.some(p=>p.kind==='template'));
 const eyes=spellRecipe(get('Countless Eyes'));
 assert.equal(eyes.stages[0].scale,1.15);
});

test('material fields require visible description evidence, not just damage type or area shape',()=>{
 const area={kind:'spell',delivery:'burst',theme:'earth'};
 assert.equal(describedMaterialArea('Energy ripples through the earth and destabilizes the ground.',area),'materialArea-earth');
 assert.equal(describedMaterialArea('An army of undead rises and claws at creatures, dealing bludgeoning damage.',area),null);
 assert.equal(describedMaterialArea('You suffuse the area with peaceful, quiet air.',{...area,theme:'wind'}),null);
 assert.equal(describedMaterialArea('A moment of tranquility settles. Creatures feel at ease. Later, mist may appear.',{...area,theme:'water'}),null);
 for(const delivery of ['cone','line','ritual','point','target'])
  assert.equal(describedMaterialArea('A sandstorm spreads over the area.',{...area,delivery}),null,delivery);
 assert.equal(describedMaterialArea('A sandstorm spreads over the area.',{...area,kind:'ritual'}),null);
 for(const name of ['Zombie Horde','Dome of Tranquility','Voice on the Breeze','Divine Armageddon','Gritty Wheeze'])
  assert.equal(get(name).design.unavailable,false,name);
});

test('fog, static, sand and inhaled air keep their described material and direction in both JB2A editions',async()=>{
 const databases=await assetDatabases();
 for(const [name,family] of [['Frozen Fog','fog_cloud'],['Solid Fog','fog_cloud'],['Thunder Echo','static_electricity'],['Control Sand','particles'],['Vacuum','wind_lines'],['Powerful Inhalation','wind_lines']]){
  const s=get(name),recipe=spellRecipe(s);
  assert.equal(recipe.enabled,true,name);
  assert.ok(!recipe.stages.some(p=>p.kind==='motion'||p.assets.some(k=>/^jb2a\.(impact|cast_generic)/.test(k))),name);
  for(const [edition,db] of Object.entries(databases)){
   const plan=planRecipe(recipe,db,{source:{id:'caster'},targets:[],template:{id:'area'},area:{type:'circle',center:{x:300,y:300},diameter:400}});
   assert.ok(plan.length>0,`${edition}/${name}`);
   const materialMatches=asset=>asset.split('.')[1]===family ||
    (name==='Frozen Fog'&&asset.startsWith('jb2a.ambient_fog.001.complete.large.blue')) ||
    (name==='Solid Fog'&&asset.startsWith('jb2a.template_circle.smoke.001.complete.800px.001.white'));
   assert.ok(plan.every(p=>materialMatches(p.asset)),`${edition}/${name}: ${plan.map(p=>p.asset)}`);
  }
  if(family==='wind_lines')assert.ok(recipe.stages[0].tracks.filter(t=>/^scale\./.test(t.property)).every(t=>t.from>t.to),name);
  if(family==='particles')assert.equal(recipe.stages[0].tint,'#cba66a',name);
 }
});
