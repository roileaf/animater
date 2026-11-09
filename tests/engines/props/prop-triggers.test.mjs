import test from "node:test";
import assert from "node:assert/strict";
import { createAreaWaits, impactDelay, missOutcome, weaponDamageType, uuidOwners, ownWallsBeforeCollision, slamTimes, crossedWalls, travelSpan } from "../../../scripts/engines/props/prop-triggers.mjs";

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
test("remembering prunes expired areas", () => {
  let t = 0; const w = createAreaWaits({ now: () => t, ttl: 1000 });
  w.remember({ templateId: "T", itemUuid: "I", actorUuid: "A", testPoint: () => true }); t = 1500;
  w.remember({ templateId: "U", itemUuid: "J", actorUuid: "A", testPoint: () => true });
  assert.equal(w.size(), 1);
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
test("the walls each crossing meets, from the move test's report (v14 wall edges included)", () => {
  const v14 = { id: "wall.X", object: { documentName: "Wall", id: "X" } };
  const placeable = { id: "Y", object: { document: { id: "Y" } } };
  const bare = { id: "wall.Z" }, bounds = { id: "innerBounds", object: null };
  assert.deepEqual(crossedWalls([{ edges: new Set([v14]) }, { edges: new Set([placeable, bare]) }, { edges: new Set([bounds]) }]), [["X"], ["Y", "Z"], ["innerBounds"]]);
  assert.deepEqual(crossedWalls([{ edges: new Set([{ id: "wallpaper" }]) }]), [["wallpaper"]]);
  assert.deepEqual(crossedWalls([{}]), [[]]);
  assert.deepEqual(crossedWalls(null), []);
  // a v14 crossing of a prop's own wall no longer stops the mover
  assert.equal(ownWallsBeforeCollision(crossedWalls([{ edges: new Set([v14]) }]), new Set(["X"])), false);
});
test("the travel's own span: the moving motions' start to end", () => {
  assert.deepEqual(travelSpan([{ kind: "impact", delay: 0, duration: 2000 }, { kind: "motion", delay: 300, duration: 500, motionOffset: { x: 2, y: 0 } }, { kind: "motion", delay: 0, duration: 100 }]), { start: 300, end: 800 });
  assert.deepEqual(travelSpan([{ kind: "motion", delay: 0, duration: 100 }]), { start: 0, end: 0 });
});
test("each prop on a forced path is reached at its share of the travel", () => {
  const t = (id, x, y) => ({ id, x, y, width: 100, height: 100 });
  const times = slamTimes({ x: 50, y: 50 }, { x: 450, y: 50 }, [t("far", 300, 0), t("near", 100, 0)], { start: 0, end: 1000 });
  assert.deepEqual(times.map((s) => [s.tile.id, s.ms]), [["near", 250], ["far", 750]]);
  // spread over the travel itself, not its wind-up
  assert.deepEqual(slamTimes({ x: 50, y: 50 }, { x: 450, y: 50 }, [t("near", 100, 0)], { start: 400, end: 800 }).map((s) => s.ms), [500]);
  // no travel (an instant move) asks at once; past the ends it clamps
  assert.deepEqual(slamTimes({ x: 0, y: 0 }, { x: 0, y: 0 }, [t("a", 0, 0)], { start: 0, end: 0 }).map((s) => s.ms), [0]);
  assert.deepEqual(slamTimes({ x: 50, y: 50 }, { x: 150, y: 50 }, [t("b", 300, 0)], { start: 0, end: 400 }).map((s) => s.ms), [400]);
});
