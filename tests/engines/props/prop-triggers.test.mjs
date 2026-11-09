import test from "node:test";
import assert from "node:assert/strict";
import { createAreaWaits, AREA_TTL_MS, impactDelay, missOutcome, weaponDamageType, uuidOwners, ownWallsBeforeCollision, slamTimes, crossedWalls, travelSpan, groundTravel, groundSlams } from "../../../scripts/engines/props/prop-triggers.mjs";
import { motionPhases } from "../../../scripts/engines/motion/motion-path.mjs";
import { pathSpan } from "../../../scripts/engines/motion/motion.mjs";
import { slamPlausible } from "../../../scripts/engines/props/prop-requests.mjs";

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
const barrel = (id, gx, gy) => ({ id, x: gx * 100, y: gy * 100, width: 100, height: 100, rotation: 0, hidden: false, texture: { src: "Barrel_Wood.webp" }, flags: {} });
const right = { x: 1, y: 0 }, rest = { x: 50, y: 150 };
const slamsOf = (stage, tiles) => groundSlams(groundTravel(stage, rest, right, 100), 1, tiles, 100);
test("a charge whose centre crosses a barrel breaks it as it gets there, along its whole run", () => {
  const charge = { kind: "motion", motion: "rush", distance: 4, motionRange: "distance", duration: 1000 };
  const travel = groundTravel(charge, rest, right, 100);
  assert.deepEqual(travel.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) })), [{ x: 50, y: 150 }, { x: 450, y: 150 }]);
  assert.equal(travel[1].p, motionPhases(charge).arrival);
  const [hit, ...more] = slamsOf(charge, [barrel("b", 2, 1), barrel("off", 2, 3)]);
  assert.equal(more.length, 0);
  assert.equal(hit.tile.id, "b");
  assert.ok(Math.abs(hit.p - travel[1].p / 2) < 1e-9);
  assert.deepEqual(hit.path.from, rest);
  assert.equal(Math.round(hit.path.to.x), 450);
  // rolls and dodges run along the ground too (a dodge sidesteps: +y here)
  assert.equal(slamsOf({ ...charge, motion: "roll" }, [barrel("b", 2, 1)]).length, 1);
  assert.deepEqual(slamsOf({ ...charge, motion: "dodge" }, [barrel("b", 0, 3)]).map((s) => s.tile.id), ["b"]);
});
test("a short lunge beside a barrel leaves it; a long one into it smashes it at its peak", () => {
  const lunge = { kind: "motion", motion: "lunge", distance: 0.35, duration: 500 };
  assert.deepEqual(slamsOf(lunge, [barrel("b", 1, 1), barrel("side", 0, 2)]), []);
  const [hit] = slamsOf({ ...lunge, distance: 1 }, [barrel("b", 1, 1)]);
  assert.equal(hit.tile.id, "b");
  assert.ok(hit.p > 0 && hit.p <= 0.5);
});
test("a leap and in-place motions never break what they pass over", () => {
  for (const motion of ["leap", "recoil", "shake", "slam", "collapse", "spin"])
    assert.deepEqual(groundTravel({ kind: "motion", motion, distance: 4, motionRange: "distance", duration: 1000 }, rest, right, 100), [], motion);
  assert.deepEqual(groundTravel({ kind: "motion", motion: "rush", distance: 4 }, null, right, 100), []);
  // a finisher's travel moves the token for real: its forced path breaks what it crosses, not this
  assert.deepEqual(groundTravel({ kind: "motion", motion: "rush", motionOffset: { x: 4, y: 0 }, duration: 1000 }, rest, right, 100), []);
  assert.deepEqual(groundTravel({ kind: "motion", motion: "path", motionFrame: { cos: 1, sin: 0, k: 1 }, duration: 1000 }, rest, right, 100), []);
});
test("a keyframed path breaks a prop it crosses on its second leg, with a path the GM accepts", () => {
  const bend = { kind: "motion", motion: "path", duration: 1000, keyframes: [
    { at: 0, x: 0, y: 0, sharp: true }, { at: 0.5, x: 3, y: 0, sharp: true }, { at: 1, x: 3, y: 3, sharp: true }] };
  const travel = groundTravel(bend, rest, right, 100), far = travel.at(-1);
  assert.ok(travel.length > 2);
  assert.equal(slamPlausible(barrel("leg2", 3, 2), { from: rest, to: far }, { ...rest, size: 1 }, 100), false);
  const slams = slamsOf(bend, [barrel("leg2", 3, 2), barrel("corner", 4, 2)]);
  assert.deepEqual(slams.map((s) => s.tile.id), ["leg2"]);
  assert.ok(slams[0].p > 0.5 * pathSpan(bend) && slams[0].p < pathSpan(bend));
  // the straight line from rest to the furthest point misses the leg: the request names where it crosses instead
  assert.ok(slamPlausible(barrel("leg2", 3, 2), slams[0].path, { ...rest, size: 1 }, 100));
});

test("a token standing on a table lunging or charging leaves the table whole", () => {
  const table = { ...barrel("table", 0, 1), width: 200, height: 200, texture: { src: "Wooden_Table.webp" } };
  assert.deepEqual(slamsOf({ kind: "motion", motion: "lunge", distance: 0.35, duration: 500 }, [table]), []);
  assert.deepEqual(slamsOf({ kind: "motion", motion: "rush", distance: 4, motionRange: "distance", duration: 1000 }, [table]), []);
});
test("a lunge away from an overlapping barrel leaves it; one into it smashes it with a path the GM accepts", () => {
  const b = { ...barrel("b", 0, 1), x: 80 }; // overlaps the mover's square by 20 px, to its right
  const lunge = { kind: "motion", motion: "lunge", distance: 0.35, duration: 500 };
  assert.deepEqual(groundSlams(groundTravel(lunge, rest, { x: -1, y: 0 }, 100), 1, [b], 100), []);
  const [hit] = groundSlams(groundTravel(lunge, rest, right, 100), 1, [b], 100);
  assert.equal(hit?.tile.id, "b");
  assert.ok(slamPlausible(b, hit.path, { ...rest, size: 1 }, 100));
});
test("an area is kept 10 minutes; a roll only an expired area matched is reported", () => {
  let t = 0; const said = []; const w = createAreaWaits({ now: () => t, trace: (m) => said.push(m) });
  assert.equal(AREA_TTL_MS, 600000);
  w.remember({ templateId: "T", itemUuid: "I", actorUuid: "A", testPoint: () => true });
  t = 5 * 60000;
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" })?.templateId, "T");
  assert.deepEqual(said, []);
  t = 11 * 60000;
  assert.equal(w.matchDamage({ itemUuid: "I", actorUuid: "A" }), null);
  assert.equal(said.length, 1);
  assert.match(said[0], /T expired/);
  // a roll for another item says nothing; a forgotten (deleted) area is not reported
  w.matchDamage({ itemUuid: "J", actorUuid: "A" }); w.forget("T"); w.matchDamage({ itemUuid: "I", actorUuid: "A" });
  assert.equal(said.length, 1);
});
