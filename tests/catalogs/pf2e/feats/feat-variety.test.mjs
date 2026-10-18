import test from "node:test";
import assert from "node:assert/strict";
import { PF2E_FEATS, featRecipe } from "../../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { visibleFeatComposition } from "../../../../scripts/catalogs/pf2e/feats/feat-direction.mjs";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { planRecipe } from "../../../../scripts/core/model.mjs";
import { timedStages } from "../../../../scripts/engines/playback/composition.mjs";
const audit=JSON.parse(readFileSync(new URL("../../../../data/pf2e-feat-audit.json",import.meta.url),"utf8"));

const visibleComposition=feat=>visibleFeatComposition(featRecipe(feat));
const named=name=>{const feat=PF2E_FEATS.find(f=>f.name===name);assert.ok(feat,name);return feat;};
const token=(id,x)=>({id,center:{x,y:100},document:{width:1,height:1}});
const source=token("source",100),targets=[1,2,3,4].map(i=>token(`target-${i}`,100+i*200));
const keys=audit.coverage.patreon.used.map(key=>({key}));
const planned=(name,selected=targets)=>planRecipe(featRecipe(named(name)),keys,{source,targets:selected,gridSize:100});

test("Double Slice and Twin Takedown have distinct visible attacks and cadence", () => {
  const slice = PF2E_FEATS.find((f) => f.slug === "double-slice");
  const takedown = PF2E_FEATS.find((f) => f.slug === "twin-takedown");
  assert.notDeepEqual(visibleComposition(slice), visibleComposition(takedown),
    "Two named rationales must not disguise identical playback");
  const a=featRecipe(slice).stages.filter(s=>s.kind==="impact"),b=featRecipe(takedown).stages.filter(s=>s.kind==="impact");
  assert.equal(a.length,2);assert.equal(b.length,2);assert.notEqual(a[1].delay-a[0].delay,b[1].delay-b[0].delay);
  assert.ok(!featRecipe(slice).stages.some(s=>s.kind==="sprite"));assert.ok(featRecipe(takedown).stages.some(s=>s.kind==="sprite"));
});

test("active feat catalog has no exact shared playback hidden behind names and IDs", () => {
  const seen = new Map(), duplicates = [];
  for (const feat of PF2E_FEATS) {
    const key = JSON.stringify(visibleComposition(feat));
    if (seen.has(key)) duplicates.push(`${seen.get(key)} / ${feat.name}`);
    else seen.set(key, feat.name);
  }
  assert.equal(duplicates.length, 0, `${duplicates.length} duplicate compositions; examples: ${duplicates.slice(0, 15).join("; ")}`);
});

test("each edition keeps visible feat variety with token motion and copies removed",()=>{
  for(const [edition,coverage] of Object.entries(audit.coverage)){
    const keys=new Set(coverage.used),seen=new Map();
    for(const feat of PF2E_FEATS){
      const key=JSON.stringify(visibleFeatComposition(featRecipe(feat,{motion:false}),keys,{motion:false}));
      assert.ok(!seen.has(key),`${edition}: ${seen.get(key)} duplicates ${feat.name}`);seen.set(key,feat.name);
    }
    assert.equal(seen.size,2338);
  }
});

test("all active feats preserve full-description semantic provenance and art direction",()=>{
  assert.equal(audit.source.reviewed,2338);assert.deepEqual(audit.source.unreviewed,[]);
  for(const feat of PF2E_FEATS){
    assert.equal(feat.review?.fullDescriptionRead,true,feat.name);
    assert.equal(feat.review.descriptionHash,createHash("sha256").update(feat.description).digest("hex"));
    assert.ok(feat.direction?.shape,feat.name);assert.ok(feat.evidence?.length,feat.name);assert.ok(feat.visualDirection,feat.name);
  }
});

test("preparations, crafts and form changes do not prematurely attack",()=>{
  for(const name of ["Analyze Weakness","Artokus's Fire","Armor in Earth","Bespell Strikes","Poison Weapon","Chain Infusion"]){
    const feat=PF2E_FEATS.find(f=>f.name===name);assert.ok(feat,name);
    assert.ok(!featRecipe(feat).stages.some(s=>["travel","projectile"].includes(s.kind)||s.assets.some(key=>/melee_generic|unarmed_strike|bullet\.|arrow\./.test(key))),name);
  }
  const guard=PF2E_FEATS.find(f=>f.name==="Abjure Harm");assert.equal(guard.motif,"guard");
  const blast=PF2E_FEATS.find(f=>f.name==="Aether Blast");assert.equal(blast.motif,"elementTarget");
});

test("single strikes stay single; mixed sequences and deferred return keep distinct topology",()=>{
  for(const name of ["Vicious Swing","Tiger Slash","Draining Strike"]){const feat=PF2E_FEATS.find(f=>f.name===name);assert.ok(feat,name);const contacts=featRecipe(feat).stages.filter(s=>s.kind==="impact");assert.equal(contacts.reduce((sum,s)=>sum+s.repeats,0),1,name);}
  const mixed=featRecipe(PF2E_FEATS.find(f=>f.name==="Drifter's Juke"));assert.equal(mixed.stages.filter(s=>s.kind==="travel").length,1);assert.equal(mixed.stages.filter(s=>s.kind==="impact").length,1);
  const boom=featRecipe(PF2E_FEATS.find(f=>f.name==="Aerial Boomerang"));assert.equal(boom.stages.filter(s=>s.kind==="travel").length,1);assert.ok(!boom.stages.some(s=>s.travelOrigin==="target"));
});

test("perceptual fingerprint ignores IDs, labels and disabled filters",()=>{
  // Disabling an enabled tint is a real visible change, so sample an untinted feat.
  const recipe=PF2E_FEATS.map(f=>featRecipe(f)).find(r=>!r.stages.some(s=>s.tintEnabled)),copy=structuredClone(recipe);
  for(const stage of copy.stages){stage.label="Other title";stage.tint="#123456";stage.tintEnabled=false;}
  assert.deepEqual(visibleFeatComposition(recipe),visibleFeatComposition(copy));
});

test("one piercing route can end at last selected target without duplicating its shot",()=>{
  const token=(id,x)=>({id,center:{x,y:100},document:{width:1,height:1}}),source=token("source",100),targets=[token("near",300),token("far",500)];
  const feat=PF2E_FEATS.find(f=>f.slug==="sudden-charge");
  const sample={...feat,motif:"throughShot",direction:{contacts:{count:1}}};
  const recipe=featRecipe(sample),catalog=Object.values(feat.assets).flat().map(key=>({key}));
  const plan=planRecipe(recipe,catalog,{source,targets,gridSize:100});
  assert.equal(plan.filter(s=>s.kind==="travel").length,1);assert.equal(plan.find(s=>s.kind==="travel").destination.id,"far");
});

test("multi-Strike activities keep declared total and same-foe restrictions",()=>{
  for(const [name,count,same] of [["Time Dilation Cascade",6,false],["Impossible Flurry",6,false],["Haft Beatdown",4,true],["Five Breaths, One Death",5,true],["Blazing Streak",4,false],["Path of Iron",3,false]]){
    const contacts=planned(name).filter(s=>s.kind==="impact");
    assert.equal(contacts.length,count,name);
    if(same)assert.ok(contacts.every(s=>s.destination===targets[0]),`${name}: same foe`);
  }
});

test("Triangle Shot launches three parallel arrows at one foe",()=>{
  const flights=planned("Triangle Shot").filter(s=>s.kind==="travel");
  assert.equal(flights.length,3);assert.equal(new Set(flights.map(s=>s.delay)).size,1);
  assert.equal(new Set(flights.map(s=>s.offsetY)).size,3);
  assert.ok(flights.every(s=>s.destination===targets[0]&&s.asset.startsWith("jb2a.arrow.physical")));
});

test("Magnetic Pinions uses one fragment per selected foe, up to three",()=>{
  for(const selected of [targets.slice(0,1),targets.slice(0,2),targets]){
    const plan=planned("Magnetic Pinions",selected),flights=plan.filter(s=>s.kind==="travel"),contacts=plan.filter(s=>s.kind==="impact");
    assert.equal(flights.length,Math.min(3,selected.length));assert.equal(contacts.length,flights.length);
    assert.equal(new Set(flights.map(s=>s.destination.id)).size,flights.length);
  }
});

test("ordered chaining lands before next hop without doubled target stagger",()=>{
  for(const name of ["Flying Flame","Controlled Bullet"]){
    const plan=planned(name),flights=plan.filter(s=>s.kind==="travel").sort((a,b)=>a.delay-b.delay),contacts=plan.filter(s=>s.kind==="impact").sort((a,b)=>a.delay-b.delay);
    assert.equal(flights.length,4,name);assert.equal(contacts.length,4,name);
    for(let i=0;i<flights.length;i++){
      assert.equal(flights[i].origin,i?targets[i-1]:source,name);
      if(i+1<flights.length)assert.ok(contacts[i].delay<=flights[i+1].delay,`${name}: contact before next hop`);
      assert.equal(contacts[i].delay-flights[i].delay,contacts[0].delay-flights[0].delay,`${name}: stable landing offset`);
    }
  }
  const consequences=planned("Chain Reaction"),initial=consequences.filter(s=>s.kind==="travel"),contacts=consequences.filter(s=>s.kind==="impact").sort((a,b)=>a.delay-b.delay);
  assert.equal(initial.length,1);assert.equal(initial[0].origin,source);assert.equal(initial[0].destination,targets[0]);
  assert.equal(contacts.length,targets.length);assert.deepEqual(contacts.map(s=>s.destination),targets);
  assert.ok(contacts[0].delay>=initial[0].delay);
  for(let i=1;i<contacts.length;i++)assert.ok(contacts[i].delay>contacts[i-1].delay,"Native improbable consequences advance without a literal bouncing bullet");
});

test("mixed attacks preserve order, thrown footage and different recipients",()=>{
  const infiltration=planned("Infiltration Assassination");
  assert.ok(infiltration.find(s=>s.kind==="impact").delay<infiltration.find(s=>s.kind==="travel").delay);
  const blitz=planned("Triggerbrand Blitz").filter(s=>s.kind==="impact"||s.kind==="travel");
  assert.equal(blitz.length,3);assert.equal(new Set(blitz.map(s=>s.destination.id)).size,3);
  const rebound=planned("Rebounding Assault").filter(s=>s.kind==="travel");
  assert.equal(rebound.length,3);assert.match(rebound[0].asset,/\.throw\./);assert.match(rebound[1].asset,/^jb2a\.bullet\./);
  assert.equal(rebound[2].origin,targets[0]);assert.equal(rebound[2].endpoint,source);
  const catcher=named("Throw and Catch"),steps=timedStages(featRecipe(catcher)),returning=steps.find(s=>s.travelOrigin==="target"),cut=steps.find(s=>s.kind==="impact");
  assert.ok(cut.delay>=returning.delay+Math.max(...returning.assets.map(k=>catcher.mediaTiming[k]?.contact??returning.duration)),"Return reaches hand before melee");
});

test("recovery uses affected ally; Restorative Strike never heals attacked enemy",()=>{
  const dressing=planned("Mage's Field Dressing").filter(s=>!["motion","sprite"].includes(s.kind));
  assert.ok(dressing.every(s=>s.destination!==source));
  const restorative=planned("Restorative Strike");
  assert.equal(restorative.filter(s=>s.kind==="impact").length,1);
  assert.ok(restorative.filter(s=>s.kind==="cast"||s.kind==="aura").every(s=>s.destination===source));
  const phoenix=planned("Ruby Resurrection");assert.ok(phoenix.every(s=>s.destination===source));
  assert.ok(phoenix.some(s=>s.assets.some(key=>key.includes("fireball.explosion"))));
});
