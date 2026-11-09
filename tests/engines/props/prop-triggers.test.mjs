import test from "node:test";
import assert from "node:assert/strict";
import { createAreaWaits, impactDelay, missOutcome, weaponDamageType, uuidOwners, ownWallsBeforeCollision, slamTimes, slamReachable } from "../../../scripts/engines/props/prop-triggers.mjs";

test("an area breaks nothing until its spell's damage is rolled", () => {
  let t = 0; const w = createAreaWaits({ now: () => t });
  w.remember({ templateId: "T", itemUuid: "I", actorUuid: "A", testPoint: () => true });
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "B" }), null);
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" })?.templateId, "T");
});
test("a deleted or expired area breaks nothing", () => {
  let t = 0; const w = createAreaWaits({ now: () => t, ttl: 1000 });
  w.remember({ templateId: "T", itemUuid: "I", actorUuid: "A", testPoint: () => true }); w.forget("T");
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" }), null);
  w.remember({ templateId: "U", itemUuid: "I", actorUuid: "A", testPoint: () => true }); t = 1001;
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" }), null);
});
test("the newest matching area wins; another item never matches", () => {
  let t = 0; const w = createAreaWaits({ now: () => t });
  w.remember({ templateId: "old", itemUuid: "I", actorUuid: "A", testPoint: () => true }); t = 10;
  w.remember({ templateId: "new", itemUuid: "I", actorUuid: "A", testPoint: () => true });
  w.remember({ templateId: "other", itemUuid: "J", actorUuid: "A", testPoint: () => true });
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" }).templateId, "new");
  w.forget("new");
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" }).templateId, "old");
  assert.equal(w.matchDamage({ itemUuid: null, actorUuid: "A" }), null);
});
test("an area waits for its recipe's impact, and asks for each prop once", () => {
  let t = 100; const w = createAreaWaits({ now: () => t });
  w.remember({ templateId: "T", itemUuid: "I", actorUuid: "A", testPoint: () => true });
  assert.equal(w.delayFor(w.matchDamage({ itemUuid: "I", actorUuid: "A" })), 0);
  w.played("T", 900);
  assert.equal(w.delayFor(w.matchDamage({ itemUuid: "I", actorUuid: "A" })), 800);
  t = 1000;
  assert.equal(w.delayFor(w.matchDamage({ itemUuid: "I", actorUuid: "A" })), 0);
  assert.equal(w.claim("T", "barrel"), true);
  assert.equal(w.claim("T", "barrel"), false);
  assert.equal(w.claim("T", "crate"), true);
});
test("impact: the first area or impact stage, else a flight's arrival, else at once", () => {
  assert.equal(impactDelay([{ kind: "cast", delay: 0 }, { kind: "projectile", delay: 200, duration: 1000 }, { kind: "template", delay: 900 }]), 900);
  assert.equal(impactDelay([{ kind: "projectile", delay: 200, duration: 1000 }]), 750);
  assert.equal(impactDelay([{ kind: "sound", delay: 300 }]), 0);
  assert.equal(impactDelay(null), 0);
});
test("miss outcomes: failure is a miss, a critical failure stays one, a hit is none", () => {
  assert.equal(missOutcome("failure"), "miss");
  assert.equal(missOutcome("criticalFailure"), "criticalFailure");
  assert.equal(missOutcome("success"), null);
  assert.equal(missOutcome("hidden"), null);
  assert.equal(missOutcome(undefined), null);
});
test("a weapon's main damage type, from the item (PF2e weapon and NPC attack, D&D 5e)", () => {
  assert.equal(weaponDamageType({ system: { damage: { damageType: "slashing" } } }), "slashing");
  assert.equal(weaponDamageType({ system: { damageRolls: { a: { damage: "1d8", damageType: "bludgeoning" } } } }), "bludgeoning");
  assert.equal(weaponDamageType({ system: { damage: { base: { types: new Set(["lightning"]) } } } }), "electricity");
  assert.equal(weaponDamageType({ system: { damage: { base: { types: ["piercing"] } } } }), "piercing");
  assert.equal(weaponDamageType({ system: { damage: { parts: [["1d6", "fire"]] } } }), "fire");
  assert.equal(weaponDamageType({ system: {} }), null);
  assert.equal(weaponDamageType(null), null);
});
test("an item and its owner from a uuid (a token's own actor included)", () => {
  assert.deepEqual(uuidOwners("Actor.a1.Item.i1.Activity.x"), { itemUuid: "Actor.a1.Item.i1", actorUuid: "Actor.a1" });
  assert.deepEqual(uuidOwners("Scene.s.Token.t.Actor.a1.Item.i1"), { itemUuid: "Scene.s.Token.t.Actor.a1.Item.i1", actorUuid: "Scene.s.Token.t.Actor.a1" });
  assert.deepEqual(uuidOwners("Compendium.x.y.Item.z"), { itemUuid: "Compendium.x.y.Item.z", actorUuid: null });
  assert.deepEqual(uuidOwners(null), { itemUuid: null, actorUuid: null });
});
test("a breakable prop's own walls never stop a forced path; every other wall does", () => {
  const own = new Set(["w1", "w2"]);
  assert.equal(ownWallsBeforeCollision([], own), false);
  assert.equal(ownWallsBeforeCollision([["w1"], ["w2", "w1"]], own), false);
  assert.equal(ownWallsBeforeCollision([["w1"], ["w3"]], own), true);
  // a crossing whose walls are unknown blocks
  assert.equal(ownWallsBeforeCollision([[]], own), true);
  assert.equal(ownWallsBeforeCollision([["w1"]], new Set()), true);
});
test("a slam counts within the mover's size of its centre, as the GM measures it", () => {
  const barrel = { x: 200, y: 0, width: 100, height: 100 };
  assert.equal(slamReachable(barrel, { x: 150, y: 50 }, 1, 100), true);
  assert.equal(slamReachable(barrel, { x: 100, y: 50 }, 1, 100), true);
  assert.equal(slamReachable(barrel, { x: 50, y: 50 }, 1, 100), false);
  assert.equal(slamReachable(barrel, { x: 50, y: 50 }, 2, 100), true);
});
test("each prop on a forced path is reached at its share of the travel", () => {
  const t = (id, x, y) => ({ id, x, y, width: 100, height: 100 });
  const times = slamTimes({ x: 50, y: 50 }, { x: 450, y: 50 }, [t("far", 300, 0), t("near", 100, 0)], 1000);
  assert.deepEqual(times.map((s) => [s.tile.id, s.ms]), [["near", 250], ["far", 750]]);
  // no travel (an instant move) asks at once; past the ends it clamps
  assert.deepEqual(slamTimes({ x: 0, y: 0 }, { x: 0, y: 0 }, [t("a", 0, 0)], 0).map((s) => s.ms), [0]);
  assert.deepEqual(slamTimes({ x: 50, y: 50 }, { x: 150, y: 50 }, [t("b", 300, 0)], 400).map((s) => s.ms), [400]);
});
