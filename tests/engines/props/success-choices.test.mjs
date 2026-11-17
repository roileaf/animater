import test from "node:test";
import assert from "node:assert/strict";
import { FORCE_CHOICES, PICK_CHOICES, MAX_FORCE_DAMAGE, forceOpenChoices, pickLockChoices, forceDamageResult, lockHeldProgress } from "../../../scripts/engines/props/success-choices.mjs";
import { forceOpenResult } from "../../../scripts/engines/props/force-open.mjs";

const pf = (outcome, total, dc = 15) => ({ rolls: [{ total, dice: [{ faces: 20, total }] }], flags: { pf2e: { context: { outcome, dc: { value: dc } } } } });

test("breaking it open is always on offer, and is what the roll already did", () => {
  for (const sys of ["pf2e", "dnd5e", "daggerheart", "draw-steel"]) {
    assert.equal(forceOpenChoices({ system: sys })[0], "break", sys);
    assert.ok(forceOpenChoices({ system: sys }).includes("none"), `${sys} can also rule that it does not open`);
  }
  for (const key of ["break", "open", "damage", "none"]) assert.ok(FORCE_CHOICES[key], key);
});

test("opening it unbroken is a critical success's to offer, and only a critical's", () => {
  assert.ok(forceOpenChoices({ system: "pf2e", crit: true }).includes("open"));
  assert.ok(!forceOpenChoices({ system: "pf2e", crit: false }).includes("open"), "an ordinary success breaks the door, as the rules say");
  assert.ok(!forceOpenChoices({ system: "pf2e" }).includes("open"));
});

test("a door takes a measured blow only where doors have HP at all", () => {
  assert.ok(forceOpenChoices({ system: "pf2e" }).includes("damage"));
  // Nowhere else has a door with Hardness and HP, so nowhere else is offered a blow to take off it.
  for (const sys of ["dnd5e", "sf2e", "daggerheart", "draw-steel"]) {
    assert.ok(!forceOpenChoices({ system: sys }).includes("damage"), sys);
  }
});

test("the critical a roll reports is the one its own system has", () => {
  assert.equal(forceOpenResult({ system: "pf2e", message: pf("criticalSuccess", 26), dc: 15 }).crit, true);
  assert.equal(forceOpenResult({ system: "pf2e", message: pf("success", 16), dc: 15 }).crit, false);
  // Read from the total where the system did not say: ten over the DC is a critical by PF2e's own degrees.
  const bare = (total) => ({ rolls: [{ total, dice: [{ faces: 20, total: 10 }] }] });
  assert.equal(forceOpenResult({ system: "pf2e", message: bare(25), dc: 15 }).crit, true);
  assert.equal(forceOpenResult({ system: "pf2e", message: bare(24), dc: 15 }).crit, false);
  // Draw Steel's third tier is its critical; Daggerheart's matching duality dice are its.
  assert.equal(forceOpenResult({ system: "draw-steel", message: { rolls: [{ product: 3, total: 18 }] }, material: "stone" }).crit, true);
  assert.equal(forceOpenResult({ system: "draw-steel", message: { rolls: [{ product: 2, total: 13 }] }, material: "wood" }).crit, false);
  assert.equal(forceOpenResult({ system: "daggerheart", message: { rolls: [{ total: 8, dHope: { total: 4 }, dFear: { total: 4 } }] }, dc: 13 }).crit, true);
  // D&D 5e has no critical on an ability check, so a 5e door never offers to be pushed open unbroken.
  const nat20 = { rolls: [{ total: 25, dice: [{ faces: 20, total: 20 }] }] };
  assert.equal(forceOpenResult({ system: "dnd5e", message: nat20, dc: 15 }).crit, false);
  assert.ok(!forceOpenChoices({ system: "dnd5e", crit: forceOpenResult({ system: "dnd5e", message: nat20, dc: 15 }).crit }).includes("open"));
});

test("the blow the GM measures goes through the door's own Hardness, and may finish it", () => {
  // A wooden door is Hardness 5, HP 20, Broken Threshold 10 (door-attack.mjs, Table 11-4).
  const hit = forceDamageResult({ own: {}, material: "wood", damage: 12 });
  assert.equal(hit.dealt, 7, "Hardness 5 comes off first");
  assert.equal(hit.hp, 13);
  assert.equal(hit.broken, false);
  assert.equal(hit.cracked, false, "13 is over its Broken Threshold of 10");
  assert.match(hit.line, /13 of 20 HP left/);

  // Past the Broken Threshold it is visibly cracked, and at nothing left it breaks.
  assert.equal(forceDamageResult({ own: {}, material: "wood", damage: 16 }).cracked, true);
  const done = forceDamageResult({ own: { hp: 4 }, material: "wood", damage: 20 });
  assert.equal(done.broken, true);
  assert.equal(done.hp, 0);

  // A blow that does not get past the Hardness does nothing at all, and says so.
  const nothing = forceDamageResult({ own: {}, material: "stone", damage: 9 });
  assert.equal(nothing.dealt, 0);
  assert.equal(nothing.hp, 56);
  assert.match(nothing.line, /does not get past its Hardness 14/);

  // Nonsense in the box is no damage, never a crash or a door quietly destroyed.
  for (const bad of [undefined, null, "", "lots", NaN, -5]) assert.equal(forceDamageResult({ own: {}, material: "wood", damage: bad }).dealt, 0, String(bad));
  assert.equal(forceDamageResult({ own: {}, material: "wood", damage: 1e9 }).hp, 0, "and a huge one is still only enough to break it");
  assert.ok(MAX_FORCE_DAMAGE >= 999);
});

test("a lock the GM holds shut sits on the brink, so nothing that was won is taken back", () => {
  assert.equal(lockHeldProgress(4), 3);
  assert.equal(lockHeldProgress(1), 0, "a lock that takes one success has nothing to hold");
  assert.equal(lockHeldProgress(0), 0);
  assert.equal(lockHeldProgress(undefined), 0);
  assert.deepEqual(pickLockChoices(), ["open", "none"]);
  for (const key of ["open", "none"]) assert.ok(PICK_CHOICES[key], key);
});
