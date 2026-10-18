import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const data=JSON.parse(await readFile(new URL("../../../data/dnd5e-native-directions.json",import.meta.url),"utf8"));
const find=(name,edition,activity="")=>data.directions.find(row=>row.name===name&&row.edition===edition&&(!activity||row.activityName===activity));

test("D&D chain lightning branches from the first victim",()=>{
  for(const edition of ["2014","2024"]){
    const row=find("Chain Lightning",edition);
    assert.equal(row.targeting,"first-target-fan");
    assert.equal(row.counts.secondaryTargets,3);
    assert.equal(row.counts.secondaryRangeFeet,30);
  }
});
test("simultaneous automatic darts and individually rolled rays stay distinct",()=>{
  assert.equal(find("Magic Missile","2024").counts.base,3);
  assert.equal(find("Magic Missile","2024").counts.simultaneousArrival,true);
  assert.equal(find("Eldritch Blast","2024").counts.perAttackRoll,1);
  assert.equal(find("Scorching Ray","2024").counts.perAttackRoll,1);
});
test("native editions of Chill Touch preserve different delivery",()=>{
  assert.equal(find("Chill Touch","2014").delivery,"local");
  assert.equal(find("Chill Touch","2024").delivery,"contact");
});
test("damage followups do not replay the initial flight",()=>{
  const row=find("Acid Arrow","2024","Lingering Acid Damage");
  assert.equal(row.delivery,"local");
  assert.equal(row.origin,"target");
  assert.equal(row.followup,true);
  assert.equal(find("Heat Metal","2024","Reheat").origin,"target");
});
test("oil is unlit, and weapon flight requires actual attack mode",()=>{
  assert.equal(find("Oil","2024","Throw").theme,"oil");
  assert.equal(find("Oil","2024","Throw").requiresIgnitionEvent,true);
  assert.equal(find("Dagger","2024").delivery,"weapon-mode");
  assert.deepEqual(find("Dagger","2024").modes,["melee","thrown"]);
});
test("linked spells delegate full payload and keys remain unambiguous",()=>{
  const delegated=data.directions.filter(row=>row.delivery==="delegate");
  assert.ok(delegated.length);
  assert.ok(delegated.every(row=>row.trigger==="use"&&row.motion==="none"));
  assert.equal(new Set(data.directions.map(row=>row.uuid+"::"+row.activityId)).size,data.directions.length);
});
test("Prismatic Spray has eight rays while Prismatic Wall has seven layers",()=>{
  assert.equal(find("Prismatic Spray","2024","Cast").counts.visualRays,8);
  assert.equal(find("Prismatic Wall","2024","Create Wall").counts.layers,7);
  assert.equal(find("Prismatic Spray","2024","Indigo Save (Con)").delivery,"local");
});
