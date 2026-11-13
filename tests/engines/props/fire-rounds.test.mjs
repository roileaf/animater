import test from "node:test";
import assert from "node:assert/strict";
import { areaCatch, areaCellCatch, areaCellsLit, fireAwake, fireRoundDue, fireNextLast, fireReseed, fireScenesOf, wallBetween, blockedLists, grassCells, fireWarning, fireBurnedOut, FIRE_PERIOD } from "../../../scripts/engines/props/fire-rounds.mjs";
import { CELL_ROUNDS, HEAT_CATCH } from "../../../scripts/engines/props/fire-spread.mjs";

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

test("a fire area sets the grass it covers alight too, and only where the ground burns", () => {
  const fire = { fireSpreads: true, kind: "area", damageType: "fire" };
  assert.deepEqual(areaCellCatch({ ...fire, burns: true }), { heat: HEAT_CATCH, burning: true, roundsLeft: CELL_ROUNDS });
  // Off: a fireball over a meadow does exactly what it did before this feature, which is nothing to the grass.
  assert.equal(areaCellCatch({ ...fire, fireSpreads: false, burns: true }), null);
  // Only a fire area, and only a region whose ground burns.
  assert.equal(areaCellCatch({ ...fire, damageType: "cold", burns: true }), null);
  assert.equal(areaCellCatch({ ...fire, kind: "miss", burns: true }), null);
  assert.equal(areaCellCatch({ ...fire, burns: false }), null);
  // Already alight, or charred for good: nothing to light.
  assert.equal(areaCellCatch({ ...fire, burns: true, cell: { heat: HEAT_CATCH, burning: true, roundsLeft: 2 } }), null);
  assert.equal(areaCellCatch({ ...fire, burns: true, cell: { charred: true, heat: 0, burning: false } }), null);
  // Merely warm: the area finishes what the spread started.
  assert.deepEqual(areaCellCatch({ ...fire, burns: true, cell: { heat: 60, burning: false, roundsLeft: 0 } }),
    { heat: HEAT_CATCH, burning: true, roundsLeft: CELL_ROUNDS });
});

test("a fireball on an open meadow lights the squares it covers, by name, and no others", () => {
  // Two regions of grass, one of bare stone. The area covers squares 1 and 2 of the meadow and square 0 of the yard.
  const covered = new Set(["10,10", "20,10", "0,0"]);
  const cells = (pts) => pts.map(([i, x, y], n) => ({ i, point: { x, y }, saved: n === 2 ? { heat: HEAT_CATCH, burning: true, roundsLeft: 2 } : null }));
  const regions = [
    { id: "meadow", burns: true, cells: cells([[1, 10, 10], [2, 20, 10], [3, 30, 10], [4, 99, 99]]) },
    { id: "yard", burns: false, cells: cells([[0, 0, 0]]) },
  ];
  const lit = areaCellsLit({ regions, inArea: (p) => covered.has(`${p.x},${p.y}`), fireSpreads: true, kind: "area", damageType: "fire" });
  assert.deepEqual(lit.lit, [{ regionId: "meadow", i: 1 }, { regionId: "meadow", i: 2 }]);
  assert.equal(lit.regions.length, 1);
  assert.deepEqual(lit.regions[0], { _id: "meadow",
    "flags.animater.fireCells.1": { heat: HEAT_CATCH, burning: true, roundsLeft: CELL_ROUNDS },
    "flags.animater.fireCells.2": { heat: HEAT_CATCH, burning: true, roundsLeft: CELL_ROUNDS } });
  // Each square is written at its own path: Foundry merges an object flag, so the squares already saved stand.
  assert.ok(Object.keys(lit.regions[0]).every((k) => k === "_id" || /^flags\.animater\.fireCells\.\d+$/.test(k)));
  // Nothing at all with the switch off, with another damage type, or without a shape to ask.
  assert.deepEqual(areaCellsLit({ regions, inArea: () => true, fireSpreads: false, kind: "area", damageType: "fire" }).lit, []);
  assert.deepEqual(areaCellsLit({ regions, inArea: () => true, fireSpreads: true, kind: "area", damageType: "cold" }).lit, []);
  assert.deepEqual(areaCellsLit({ regions, inArea: null, fireSpreads: true, kind: "area", damageType: "fire" }).lit, []);
  // A shape that throws is a shape that holds nothing.
  assert.deepEqual(areaCellsLit({ regions, inArea: () => { throw new Error("no shape"); }, fireSpreads: true, kind: "area", damageType: "fire" }).lit, []);
});

test("a scene with every fire cold is left alone, and the least spark wakes it", () => {
  const tile = (fire) => ({ flags: { animater: { prop: { fire } } } });
  const region = (decorFire, fireCells) => ({ flags: { animater: { decorFire, fireCells } } });
  const cold = { tiles: [tile(null), tile({ heat: 90, burning: false, roundsLeft: 0 })],
    regions: [region({ "crate:1:1:a": { heat: 60, burning: false, roundsLeft: 0 } }, { 3: { charred: true, heat: 0, burning: false } }), region({}, {})] };
  // Warm props, a warm decoration and burnt-out grass are not a fire: the round does no work at all.
  assert.equal(fireAwake(cold), false);
  assert.equal(fireAwake({}), false);
  assert.equal(fireAwake(), false);
  // A burning tile, a burning decoration, a burning square or a burning oil spill each wake it.
  assert.equal(fireAwake({ ...cold, tiles: [...cold.tiles, tile({ heat: 100, burning: true, roundsLeft: 3 })] }), true);
  assert.equal(fireAwake({ ...cold, regions: [region({ "crate:1:1:a": { heat: 100, burning: true, roundsLeft: 2 } }, {})] }), true);
  assert.equal(fireAwake({ ...cold, regions: [region({}, { 4: { heat: 100, burning: true, roundsLeft: 2 } })] }), true);
  assert.equal(fireAwake({ ...cold, spills: 1 }), true);
  // A square that is charred AND marked burning is still out: charred is for good.
  assert.equal(fireAwake({ tiles: [], regions: [region({}, { 4: { heat: 100, burning: true, charred: true } })] }), false);
});

test("the GM's warning names the thing the fire is heading for", () => {
  assert.equal(fireWarning("Bookshelf"), "The fire is spreading toward the bookshelf.");
  assert.equal(fireWarning(""), "The fire is spreading toward the prop.");
  assert.equal(fireBurnedOut("Stone chest"), "The fire burns out: the stone chest is scorched but still stands.");
});
