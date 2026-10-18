import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { PF2E_FEATS, PF2E_FEAT_SOURCE, catalogFeat, featRecipe, filterFeats, normalizeFeatCatalogState, useCatalogFeat, findCatalogFeat, resolveAutomaticFeatRecipe, catalogFeatEnabled } from "../../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { classifyFeat, analyzeFeat, plainFeatDescription } from "../../../../tools/feat-semantics.mjs";
import { validateRecipe, planRecipe } from "../../../../scripts/core/model.mjs";
import { timedStages } from "../../../../scripts/engines/playback/composition.mjs";
const audit=JSON.parse(readFileSync(new URL("../../../../data/pf2e-feat-audit.json",import.meta.url),"utf8"));
const named=name=>PF2E_FEATS.find(feat=>feat.name===name);
const eventFor=(feat,type="use")=>({type,item:{type:"feat",name:feat.name,system:{slug:feat.slug,actionType:{value:feat.actionType}},_stats:{compendiumSource:`Compendium.pf2e.feats-srd.Item.${feat.id}`}}});
const token=(id,x)=>({id,center:{x,y:100},document:{x:x-50,y:50,width:1,height:1},actor:{id}});
const context={source:token("s",100),targets:[token("t",400),token("secondary",700)],gridSize:100,gridDistance:5,area:{center:{x:400,y:100},diameter:400}};

test("pinned complete feats compendium accounts for every active and passive item",()=>{
  assert.equal(PF2E_FEAT_SOURCE.version,"8.6.0");assert.equal(PF2E_FEAT_SOURCE.total,6366);assert.equal(PF2E_FEATS.length,2338);
  assert.equal(PF2E_FEAT_SOURCE.excluded,4028);assert.equal(audit.sourceAudit.length,6366);assert.equal(new Set(PF2E_FEATS.map(f=>f.id)).size,2338);
  assert.equal(PF2E_FEAT_SOURCE.count+PF2E_FEAT_SOURCE.excluded,PF2E_FEAT_SOURCE.total);
  assert.deepEqual(PF2E_FEAT_SOURCE.actionTypes,{action:1639,free:219,reaction:480});
  assert.equal(audit.issues.length,0);
  for(const feat of PF2E_FEATS){assert.ok(["action","reaction","free"].includes(feat.actionType));assert.equal(feat.trigger,"use");assert.equal(feat.classification,"native-active");assert.ok(feat.img);}
});
test("full descriptions have source provenance and hashes, not unsubstantiated hand-review claims",()=>{
  for(const feat of PF2E_FEATS){assert.equal(feat.descriptionHash,createHash("sha256").update(feat.description).digest("hex"));assert.ok(feat.path.startsWith("packs/pf2e/feats/"));assert.ok(feat.sourceUrl.includes(PF2E_FEAT_SOURCE.sha));assert.ok(feat.rationale);assert.match(feat.sourceBlob,/^[a-f0-9]{40}$/);}
});
test("passive grants and uncertain timed embedded activities stay excluded",()=>{
  const item=(actionType,description)=>({type:"feat",system:{actionType:{value:actionType},actions:{value:null},description:{value:description}}});
  assert.equal(classifyFeat(item("passive","You gain the lay on hands focus spell.")).classification,"passive-grant");
  assert.equal(classifyFeat(item("passive","You gain a 1st-level monk feat.")).included,false);
  assert.equal(classifyFeat(item("passive","You can spend 10 minutes tending injuries.")).classification,"passive-embedded-activity-review");
  assert.equal(classifyFeat(item("passive","Increase your hit points.")).included,false);
  for(const activity of ["action","reaction","free"])assert.equal(classifyFeat(item(activity,"You use this ability.")).included,true);
  assert.ok(!PF2E_FEATS.some(f=>f.name==="Basic Devotion"));
});
test("every generated recipe plans fully in each edition with bounded optional motion",()=>{
  for(const [edition,coverage] of Object.entries(audit.coverage)){
    // Coverage.used records the builder's sampled targets. Optional second-
    // victim stages may require selected keys absent from that one-target plan.
    const catalog=[...new Set([...coverage.used,...PF2E_FEATS.flatMap(f=>f.selections.filter(s=>s.edition===edition).map(s=>s.key))])].map(key=>({key}));
    for(const feat of PF2E_FEATS){
      const recipe=validateRecipe(featRecipe(feat)),plan=planRecipe(recipe,catalog,context);
      assert.ok(plan.length,`${edition}/${feat.name}`);assert.ok(recipe.stages.length<=8);
      assert.equal(recipe.itemUuid,`Compendium.pf2e.feats-srd.Item.${feat.id}`);
      for(const stage of recipe.stages){if(stage.kind==="motion"){const path=["rush","leap","roll","dodge"].includes(stage.motion);assert.ok(stage.duration>=(path?1300:800));assert.ok(stage.intensity<=(path ? .8 : .65));assert.ok(stage.distance<=(path?12:.25));}assert.equal(stage.persist,false);}
      const noMotion=featRecipe(feat,{motion:false});assert.ok(!noMotion.stages.some(s=>s.kind==="motion"));assert.ok(planRecipe(noMotion,catalog,context).length);
    }
  }
});
test("actual exact composition sharing counts include all stage media/settings",()=>{
  const hashes=new Map();
  for(const feat of PF2E_FEATS){const recipe=featRecipe(feat),hash=createHash("sha256").update(JSON.stringify(recipe.stages.map(({stageId,label,afterStage,...stage})=>({...stage,afterIndex:afterStage?recipe.stages.findIndex(p=>p.stageId===afterStage):-1})))).digest("hex");assert.equal(hash,feat.compositionHash);hashes.set(hash,(hashes.get(hash)??0)+1);}
  assert.equal(hashes.size,PF2E_FEAT_SOURCE.distinctCompositions);for(const feat of PF2E_FEATS)assert.equal(feat.sharedCount,hashes.get(feat.compositionHash));
});
test("native feat matching cannot animate spells, passive parents or generic weapon attacks",()=>{
  const feat=named("Sudden Charge"),event=eventFor(feat),state=useCatalogFeat({},feat.id);
  assert.equal(findCatalogFeat(event).id,feat.id);assert.equal(catalogFeat(`pf2e-feat-${feat.id}`).id,feat.id);
  assert.equal(findCatalogFeat({...event,item:{...event.item,type:"spell"}}),null);
  assert.equal(findCatalogFeat({...event,item:{...event.item,type:"weapon"}}),null);
  assert.equal(findCatalogFeat({...event,item:{...event.item,system:{actionType:{value:"passive"}}}}),null);
  assert.equal(resolveAutomaticFeatRecipe({...event,type:"attack"},state,[]),null);
  assert.ok(resolveAutomaticFeatRecipe(event,state,[]));
});
test("separate opt-in state, per-feat enablement and disabled saved overrides are respected",()=>{
  const feat=named("Battle Medicine"),event=eventFor(feat),recipe=featRecipe(feat);
  assert.equal(resolveAutomaticFeatRecipe(event,{},[]),null);
  const state=useCatalogFeat({},feat.id);assert.equal(state.scope,"selected");assert.equal(state.independent,true);assert.equal(catalogFeatEnabled(feat.id,state),true);
  const other=named("Sudden Charge");assert.equal(catalogFeatEnabled(other.id,state),false);
  assert.equal(resolveAutomaticFeatRecipe(event,{enabled:true,scope:"all"},[{...recipe,enabled:false}]),null);
  assert.ok(resolveAutomaticFeatRecipe(event,state,[{...recipe,enabled:false}]));
  const custom={...recipe,id:"custom-feat",name:"Edited feat"};assert.equal(resolveAutomaticFeatRecipe(event,{enabled:true,scope:"all",customized:[feat.id]},[custom]).id,"custom-feat");
  assert.equal(resolveAutomaticFeatRecipe(event,{enabled:true,scope:"all",excluded:[feat.id]},[],{customEnabled:false}),null);
  assert.deepEqual(normalizeFeatCatalogState({selected:[feat.id,feat.id,"invalid"],motion:false}).selected,[feat.id]);
});
test("actions, reactions and free actions activate only through their own feat use event",()=>{
  for(const activity of ["action","reaction","free"]){const feat=PF2E_FEATS.find(f=>f.actionType===activity),state=useCatalogFeat({},feat.id);assert.ok(resolveAutomaticFeatRecipe(eventFor(feat),state,[]));for(const type of ["attack","damage","effect","template"])assert.equal(resolveAutomaticFeatRecipe(eventFor(feat,type),state,[]),null);}
});
test("filters preserve native level/activity/category/class and design metadata",()=>{
  for(const [filter,value] of [["activity","reaction"],["level",1],["category","skill"],["classTrait","fighter"],["quality","signature"],["theme","water"]]){
    const results=filterFeats({[filter]:value});assert.ok(results.length,filter);for(const feat of results)assert.ok(filter==="classTrait"?feat.classTraits.includes(value):filter==="activity"?feat.actionType===value:feat[filter]===value);
  }
  assert.equal(filterFeats({search:"Sudden Charge"}).length,1);
});
test("notable martial and restorative feats have description-specific choreography",()=>{
  const charge=featRecipe(named("Sudden Charge"));assert.ok(charge.stages.some(s=>s.kind==="sprite"));assert.ok(charge.stages.some(s=>s.kind==="motion"&&s.motion==="rush"));assert.ok(charge.stages.some(s=>s.kind==="impact"&&s.timingAnchor==="arrival"));
  const heavy=featRecipe(named("Vicious Swing"));assert.equal(heavy.stages.filter(s=>s.kind==="impact").length,1);
  const double=featRecipe(named("Double Slice"));assert.equal(double.stages.filter(s=>s.kind==="impact").length,2);assert.notEqual(double.stages[1].rotation,double.stages[3].rotation);
  const fear=featRecipe(named("Intimidating Strike"));assert.ok(fear.stages.find(s=>s.kind==="aura").delay>fear.stages.find(s=>s.kind==="impact").delay);
  for(const name of ["Battle Medicine","Fresh Produce"]){const recipe=featRecipe(named(name));assert.ok(!recipe.stages.some(s=>s.kind==="travel"||s.kind==="projectile"));assert.ok(recipe.stages.every(s=>s.kind==="impact"||s.subject==="targets"));}
});
test("kineticist support guards defenders and Four Winds animates chosen allies",()=>{
  const wave=featRecipe(named("Deflecting Wave"));assert.ok(!wave.stages.some(s=>s.kind==="impact"||s.subject==="targets"||s.kind==="travel"));
  const winds=named("Four Winds");assert.equal(winds.subject,"targets");assert.ok(winds.notes.some(n=>n.startsWith("Target the affected")));assert.ok(featRecipe(winds).stages.some(s=>s.kind==="aura"&&s.subject==="targets"));
  const analyzed=analyzeFeat({name:"Safe Elements",system:{traits:{value:["kineticist"]},description:{value:"You protect selected allies."}}},"packs/pf2e/feats/safe-elements.json");assert.equal(analyzed.subject,"targets");assert.equal(analyzed.motif,"targetGuard");
});
test("Flying Flame hops between ordered targets and preserves measured full clip",()=>{
  const feat=named("Flying Flame"),recipe=featRecipe(feat),plan=planRecipe(recipe,audit.coverage.patreon.used.map(key=>({key})),{...context,targets:[token("t1",400),token("t2",600)]});
  const flights=plan.filter(s=>s.kind==="travel");assert.equal(flights.length,2);assert.equal(flights[0].travelOrigin,"previousTarget");assert.equal(flights[1].origin.id,"t1");
  const launch=recipe.stages.find(s=>s.kind==="travel"),landing=recipe.stages.find(s=>s.kind==="impact");assert.equal(landing.afterStage,launch.stageId);assert.equal(launch.oneShot,true);
  for(const key of launch.assets)if(feat.mediaTiming[key])assert.ok(launch.duration>=feat.mediaTiming[key].duration);
  assert.ok(timedStages(recipe).every(s=>Number.isFinite(s.delay)&&Number.isFinite(s.duration)));
});
test("nested PF2e damage/check/template tags preserve delivery without leaking formula tails",()=>{
  const text=plainFeatDescription('<p>You fire a beam in a @Template[line|distance:60] that deals @Damage[(2*@actor.level)d6[force]|options:area-damage] with @Check[reflex|against:class-spell|basic].</p>');
  assert.match(text,/line area template distance 60/);assert.match(text,/damage force/);assert.match(text,/reflex check/);assert.doesNotMatch(text,/options:area|\]|@actor/);
  const design=analyzeFeat({name:"Test beam",system:{description:{value:text},traits:{value:[]}}},"packs/pf2e/feats/test-beam.json");assert.equal(design.motif,"ray");assert.equal(design.theme,"force");
});
test("Aether Beam and Alchemical Shot carry their described beam and physical shot",()=>{
  const beam=named("Aether Beam"),shot=named("Alchemical Shot");assert.equal(beam.motif,"ray");assert.equal(shot.motif,"alchemicalShot");
  const beamRecipe=featRecipe(beam),shotRecipe=featRecipe(shot);assert.ok(beamRecipe.stages.find(s=>s.kind==="travel").assets.every(key=>/energy_beam|disintegrate|energy_conduit/.test(key)));assert.equal(beamRecipe.stages.find(s=>s.kind==="travel").label,"Directed beam");
  assert.ok(shotRecipe.stages.find(s=>s.kind==="travel").assets.every(key=>key.startsWith("jb2a.bullet.")));assert.ok(shotRecipe.stages.some(s=>s.label==="Load alchemical contents"));
  assert.ok(featRecipe(named("Sudden Charge")).stages.find(s=>s.kind==="impact").assets.every(key=>/melee_generic\.slash|sword\.melee/.test(key)));
});
test("stance follows reviewed recipient without prematurely firing granted attacks",()=>{
  for(const feat of PF2E_FEATS.filter(f=>f.motif==="stance")){
    const recipe=featRecipe(feat);
    assert.ok(!recipe.stages.some(s=>s.kind==="travel"||s.assets.some(key=>/melee_generic|unarmed_strike|bullet\.|arrow\./.test(key))),feat.name);
    assert.ok(recipe.stages.filter(s=>["aura","motion"].includes(s.kind)).every(s=>s.subject===feat.subject),feat.name);
  }
  const rider=featRecipe(named("War Rider Stance"));
  assert.equal(rider.stages.find(s=>s.kind==="aura").subject,"targets","Aura belongs to selected dragon companion");
});
test("spellshape holds preparation at source rather than firing next spell",()=>{
  for(const feat of PF2E_FEATS.filter(f=>f.motif==="spellshape")){assert.ok(featRecipe(feat).stages.every(s=>s.kind==="cast"||s.subject==="source"),feat.name);}
});
