import test from "node:test";
import assert from "node:assert/strict";
import { areaCatch, fireRoundDue, fireNextLast, fireReseed, fireScenesOf, wallBetween, blockedLists, grassCells, fireWarning, fireBurnedOut, FIRE_PERIOD } from "../../../scripts/engines/props/fire-rounds.mjs";

test("in combat a round comes from the tracker, out of combat from the clock", () => {
  assert.equal(fireRoundDue({ combat: { started: true, round: 3 }, last: { round: 2 } }), true);
  assert.equal(fireRoundDue({ combat: { started: true, round: 3 }, last: { round: 3 } }), false);
  assert.equal(fireRoundDue({ combat: null, now: 10000, last: { at: 3000 }, period: 6000 }), true);
  assert.equal(fireRoundDue({ combat: null, now: 8000, last: { at: 3000 }, period: 6000 }), false);
});

test("only scenes with both switches on, and only for the active GM", () => {
  const on = { id: "s1", flags: { animater: { breakableProps: true, fireSpreads: true } } };
  const half = { id: "s2", flags: { animater: { breakableProps: true } } };
  assert.deepEqual(fireScenesOf([on, half], { activeGM: true }).map((s) => s.id), ["s1"]);
  assert.deepEqual(fireScenesOf([on], { activeGM: false }), []);
});

test("a fire that never ticked is due, a combat not started goes by the clock", () => {
  assert.equal(fireRoundDue({ combat: null, now: 1000, last: null }), true);
  assert.equal(fireRoundDue({ combat: { started: true, round: 1 }, last: null }), true);
  // a combat in the tracker but not begun is no tracker at all: the clock rules
  assert.equal(fireRoundDue({ combat: { started: false, round: 9 }, now: 9000, last: { at: 3000, round: 9 } }), true);
  assert.equal(fireRoundDue({ combat: { started: false, round: 9 }, now: 4000, last: { at: 3000, round: 9 } }), false);
  // the round going back (a GM rewound the tracker) is not a new round
  assert.equal(fireRoundDue({ combat: { started: true, round: 2 }, last: { round: 5 } }), false);
  assert.equal(FIRE_PERIOD, 6000);
});

test("a fire area sets flammable things alight, and only with Fire spreads on", () => {
  const wood = { material: "wood", contents: "none" }, fire = { kind: "area", damageType: "fire" };
  assert.deepEqual(areaCatch({ fireSpreads: true, ...fire, traits: wood }), { heat: 100, burning: true, roundsLeft: 3 });
  // Off: nothing at all changes, the area breaks it as it always has.
  assert.equal(areaCatch({ fireSpreads: false, ...fire, traits: wood }), null);
  // Only a fire area: cold, acid, a missed swing, a slam and a keg's blast all break as before.
  assert.equal(areaCatch({ fireSpreads: true, kind: "area", damageType: "cold", traits: wood }), null);
  assert.equal(areaCatch({ fireSpreads: true, kind: "miss", damageType: "fire", traits: wood }), null);
  assert.equal(areaCatch({ fireSpreads: true, kind: "blast", damageType: "fire", traits: wood }), null);
  // Nothing that takes fire, and nothing already alight.
  assert.equal(areaCatch({ fireSpreads: true, ...fire, traits: { material: "stone", contents: "none" } }), null);
  assert.equal(areaCatch({ fireSpreads: true, ...fire, traits: wood, fire: { burning: true, heat: 100 } }), null);
  // A keg goes off instead of smouldering, and a thing flammable only by what it holds still catches.
  assert.equal(areaCatch({ fireSpreads: true, ...fire, traits: { material: "wood", contents: "powder" } }), null);
  assert.deepEqual(areaCatch({ fireSpreads: true, ...fire, traits: { material: "stone", contents: "books" } }), { heat: 100, burning: true, roundsLeft: 3 });
});

test("a reload or a handover costs a fire nothing: it is seeded, not run", () => {
  // In combat: seeded on the round the tracker stands on, so that round is not run again.
  const combat = { started: true, round: 4 };
  const seeded = fireNextLast({ combat, now: 7000 });
  assert.deepEqual(seeded, { round: 4, at: 7000 });
  assert.equal(fireRoundDue({ combat, now: 7000, last: seeded }), false);
  assert.equal(fireRoundDue({ combat: { started: true, round: 5 }, now: 7000, last: seeded }), true);
  // Out of combat: seeded on the clock, so the next round comes a full period later, not at once.
  const clock = fireNextLast({ combat: null, now: 7000 });
  assert.deepEqual(clock, { at: 7000 });
  assert.equal(fireRoundDue({ combat: null, now: 12000, last: clock }), false);
  assert.equal(fireRoundDue({ combat: null, now: 13000, last: clock }), true);
});

test("a new combat starts a new count: the old combat's last round never holds it back", () => {
  // An old combat ran to round 7 and ended; the ticks out of combat forget its round.
  const ended = fireNextLast({ combat: { started: false, round: 7 }, now: 20000 });
  assert.deepEqual(ended, { at: 20000 });
  // A new combat opens at round 1: its first round is due, though 1 is well behind 7.
  assert.equal(fireRoundDue({ combat: { started: true, round: 1 }, now: 20100, last: ended }), true);
  // And without that forgetting it would have stalled: the round carried over holds every round up to 7 back.
  assert.equal(fireRoundDue({ combat: { started: true, round: 1 }, now: 20100, last: { round: 7, at: 20000 } }), false);
});

test("a combat on one scene never gives another scene's fire a free round", () => {
  // A is in the middle of its own combat at round 5; B's combat is just starting, so every scene is re-seeded.
  const aCombat = { started: true, round: 5 };
  const lasts = new Map([["A", { round: 5, at: 1000 }], ["B", { at: 1000 }]]);
  const after = fireReseed(lasts, { combatOf: (id) => (id === "A" ? aCombat : null), now: 4000 });
  assert.deepEqual(after.get("A"), { round: 5, at: 1000 }); // A keeps its own count and the time it last ran
  assert.equal(fireRoundDue({ combat: aCombat, now: 4000, last: after.get("A") }), false);
  // ... and A's own next round still comes when the tracker moves on.
  assert.equal(fireRoundDue({ combat: { started: true, round: 6 }, now: 4000, last: after.get("A") }), true);
  // B, out of combat until its own combat is read, keeps the clock it was on: no round granted by the re-seed.
  assert.deepEqual(after.get("B"), { at: 1000 });
  assert.equal(fireRoundDue({ combat: null, now: 4000, last: after.get("B") }), false);
  assert.equal(fireReseed(null, {}).size, 0);
});

test("a wall between two points stops fire, one beside them does not", () => {
  const wall = { c: [50, -50, 50, 50] };
  assert.equal(wallBetween({ x: 0, y: 0 }, { x: 100, y: 0 }, [wall]), true);
  assert.equal(wallBetween({ x: 0, y: 0 }, { x: 40, y: 0 }, [wall]), false);
  assert.equal(wallBetween({ x: 60, y: 0 }, { x: 100, y: 0 }, [wall]), false);
  // a wall along the line never cuts it, and a malformed one is ignored
  assert.equal(wallBetween({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ c: [0, 0, 100, 0] }]), false);
  assert.equal(wallBetween({ x: 0, y: 0 }, { x: 100, y: 0 }, [{ c: [1, 2] }, {}]), false);
});

test("blocked lists name the sources a wall cuts a target off from", () => {
  const walls = [{ c: [175, -100, 175, 300] }];
  const sources = [{ id: "fire", rect: { x: 0, y: 0, w: 100, h: 100 } }, { id: "cell:4", rect: { x: 200, y: 0, w: 100, h: 100 } }];
  const targets = [{ key: "crate", rect: { x: 300, y: 0, w: 100, h: 100 } }, { key: "near", rect: { x: 100, y: 0, w: 100, h: 100 } }];
  const blocked = blockedLists({ targets, sources, walls, reach: 400 });
  assert.deepEqual(blocked.get("crate"), ["fire"]); // the wall stands between the crate and the far fire only
  assert.deepEqual(blocked.get("near"), ["cell:4"]);
  // out of reach is never tested, and no walls means no lists at all
  assert.equal(blockedLists({ targets, sources, walls, reach: 50 }).has("crate"), false);
  assert.equal(blockedLists({ targets, sources, walls: [] }).size, 0);
});

test("a target is never blocked from itself", () => {
  const rect = { x: 0, y: 0, w: 100, h: 100 };
  const blocked = blockedLists({ targets: [{ key: "cell:0", rect }], sources: [{ id: "cell:0", rect }], walls: [{ c: [-100, -100, 100, 100] }], reach: 100 });
  assert.equal(blocked.size, 0);
});

test("grass squares are laid out on a snapped grid, so their indices keep", () => {
  const g = grassCells({ bounds: { x: 120, y: 220, w: 200, h: 100 }, cell: 100 });
  assert.deepEqual(g.origin, { x: 100, y: 200 });
  assert.equal(g.cols, 3);
  assert.equal(g.rows, 2);
  assert.deepEqual(g.indices, [0, 1, 2, 3, 4, 5]);
  // the same shape read again gives the same indices, whatever order it is read in
  assert.deepEqual(grassCells({ bounds: { x: 120, y: 220, w: 200, h: 100 }, cell: 100 }).indices, g.indices);
});

test("only the squares whose middle is in the shape, and nothing past the cap", () => {
  const kept = grassCells({ bounds: { x: 0, y: 0, w: 200, h: 200 }, cell: 100, inside: (p) => p.x < 100 });
  assert.deepEqual(kept.indices, [0, 2]);
  assert.deepEqual(grassCells({ bounds: { x: 0, y: 0, w: 10000, h: 10000 }, cell: 100, cap: 100 }).indices, []);
  assert.deepEqual(grassCells({ bounds: null }).indices, []);
  assert.deepEqual(grassCells({ bounds: { x: 0, y: 0, w: 0, h: 0 } }).indices, []);
});

test("the GM's warning names the thing the fire is heading for", () => {
  assert.equal(fireWarning("Bookshelf"), "The fire is spreading toward the bookshelf.");
  assert.equal(fireWarning(""), "The fire is spreading toward the prop.");
  assert.equal(fireBurnedOut("Stone chest"), "The fire burns out: the stone chest is scorched but still stands.");
});
