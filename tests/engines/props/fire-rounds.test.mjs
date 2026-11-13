import test from "node:test";
import assert from "node:assert/strict";
import { fireRoundDue, fireScenesOf, wallBetween, blockedLists, grassCells, fireWarning, FIRE_PERIOD } from "../../../scripts/engines/props/fire-rounds.mjs";

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
});
