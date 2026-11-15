// The plume at a doorway: a DRAWING of smoke leaving, laid out from what the round already stored.
// It is not a simulation and must never pretend to be one — the air outside a room is not modelled at all, and
// what this pins is that the drawing is honest about the two things it does know: which way the doorway faces and
// how thick the smoke is at it.
import test from "node:test";
import assert from "node:assert/strict";
import { plumePuffs } from "../../../scripts/engines/props/smoke-plume.mjs";
import { smokeVentList, sameVents, SMOKE_VENT_FLAG } from "../../../scripts/engines/props/smoke-round.mjs";

const GRID = { cols: 10, cell: 100, origin: { x: 0, y: 0 } };
// Cell 55 is the square (5,5), whose middle is (550, 550).
const SOUTH = [{ i: 55, dx: 0, dy: 1, v: 2 }];

test("a plume leaves its doorway the way the doorway faces", () => {
  const puffs = plumePuffs(SOUTH, { ...GRID, now: 9000, seed: 7 });
  assert.ok(puffs.length, "a vent with smoke at it pours");
  // Every puff is south of the doorway's middle, and none has run off sideways further than its own spread.
  for (const p of puffs) {
    assert.ok(p.y >= 550 - 1, `south of the door: ${p.y}`);
    assert.ok(Math.abs(p.x - 550) <= 0.45 * 100 + 1, `not blown sideways: ${p.x}`);
  }
  // North-facing is the mirror of it, puff for puff.
  const north = plumePuffs([{ i: 55, dx: 0, dy: -1, v: 2 }], { ...GRID, now: 9000, seed: 7 });
  assert.equal(north.length, puffs.length);
  assert.deepEqual(north.map((p) => Math.round(550 - p.y)), puffs.map((p) => Math.round(p.y - 550)));
});

test("the same vents, clock and seed lay out the same plume, so two screens agree", () => {
  const once = plumePuffs(SOUTH, { ...GRID, now: 12345, seed: 3 });
  const twice = plumePuffs(SOUTH, { ...GRID, now: 12345, seed: 3 });
  assert.deepEqual(once, twice);
  // A different scene wears a different plume at the same moment.
  const elsewhere = plumePuffs(SOUTH, { ...GRID, now: 12345, seed: 4 });
  assert.notDeepEqual(once.map((p) => p.x), elsewhere.map((p) => p.x));
});

test("a thicker vent pours harder, and a wisp pours nothing at all", () => {
  const thin = plumePuffs([{ i: 55, dx: 0, dy: 1, v: 0.4 }], { ...GRID, now: 9000, seed: 7 });
  const thick = plumePuffs([{ i: 55, dx: 0, dy: 1, v: 4 }], { ...GRID, now: 9000, seed: 7 });
  assert.ok(thick.length > thin.length, `${thick.length} > ${thin.length}`);
  const deepest = (list) => Math.max(0, ...list.map((p) => p.alpha));
  assert.ok(deepest(thick) > deepest(thin), "and darker");
  // Smoke on the open air is never painted as deep as the room it came from.
  assert.ok(deepest(thick) <= 0.42 + 1e-9, `${deepest(thick)} stays thin on the air`);
  assert.deepEqual(plumePuffs([{ i: 55, dx: 0, dy: 1, v: 0.05 }], { ...GRID, now: 9000, seed: 7 }), []);
});

test("a vent facing nowhere rises where it stands instead of running off", () => {
  const up = plumePuffs([{ i: 55, dx: 0, dy: 0, v: 2 }], { ...GRID, now: 9000, seed: 7 });
  assert.ok(up.length, "a hole in the roof still smokes");
  for (const p of up) assert.ok(Math.hypot(p.x - 550, p.y - 550) < 100, `stays over its square: ${p.x},${p.y}`);
  // And it swells faster than one running out of a door, which is what rising smoke looks like from above.
  const along = plumePuffs(SOUTH, { ...GRID, now: 9000, seed: 7 });
  assert.ok(Math.max(...up.map((p) => p.r)) > Math.max(...along.map((p) => p.r)));
});

test("the wind carries a plume, and still air does not", () => {
  const still = plumePuffs(SOUTH, { ...GRID, now: 9000, seed: 7 });
  const blown = plumePuffs(SOUTH, { ...GRID, now: 9000, seed: 7, wind: { x: 1, y: 0 } });
  assert.ok(Math.max(...blown.map((p) => p.x)) > Math.max(...still.map((p) => p.x)) + 100, "blown east");
  // The wind moves it; it does not make more of it.
  assert.equal(blown.length, still.length);
});

test("nothing is laid out for nothing, and a crowd of doorways is capped", () => {
  assert.deepEqual(plumePuffs([], GRID), []);
  assert.deepEqual(plumePuffs(null, GRID), []);
  assert.deepEqual(plumePuffs([{ i: -1, dx: 0, dy: 1, v: 2 }], GRID), [], "a cell off the grid");
  assert.deepEqual(plumePuffs([{ i: 55, dx: 0, dy: 1, v: 0 }], GRID), [], "an opening with no smoke");
  const many = Array.from({ length: 60 }, (_, k) => ({ i: k, dx: 0, dy: 1, v: 4 }));
  assert.ok(plumePuffs(many, { ...GRID, now: 9000, seed: 7 }).length <= 240);
});

// ---- What the round stores for it. ----

test("a vent faces the way out, and one with no way out faces nowhere", () => {
  const cols = 10, rows = 10;
  // The room is the square block of columns 4-6, rows 4-6; everything else is outdoors.
  const inRoom = (i) => { const c = i % cols, r = Math.floor(i / cols); return c >= 4 && c <= 6 && r >= 4 && r <= 6; };
  const at = () => 1.5;
  // 64 is (4,6): its south neighbour is out, so it faces south. 65 is (5,6), the same.
  assert.deepEqual(smokeVentList([65], { cols, rows, indoors: inRoom, at }), [{ i: 65, dx: 0, dy: 1, v: 1.5 }]);
  // 64 is a corner — south AND west are out — so it faces out of the corner, as a unit.
  const corner = smokeVentList([64], { cols, rows, indoors: inRoom, at })[0];
  assert.equal(Math.round(Math.hypot(corner.dx, corner.dy) * 100) / 100, 1, "a unit, not a longer arrow");
  assert.ok(corner.dx < 0 && corner.dy > 0, "south-west");
  // 55 is the middle of the room: an opening with no outdoor neighbour at all (a hole in its roof) faces nowhere.
  assert.deepEqual(smokeVentList([55], { cols, rows, indoors: inRoom, at }), [{ i: 55, dx: 0, dy: 0, v: 1.5 }]);
  // An opening with no smoke at it has nothing to pour.
  assert.deepEqual(smokeVentList([65], { cols, rows, indoors: inRoom, at: () => 0 }), []);
  // Sorted, each cell once, whatever order they came in.
  assert.deepEqual(smokeVentList([65, 64, 65], { cols, rows, indoors: inRoom, at }).map((v) => v.i), [64, 65]);
});

test("a vent list that says the same thing is not written again", () => {
  const vents = [{ i: 65, dx: 0, dy: 1, v: 1.5 }];
  assert.equal(sameVents([{ i: 65, dx: 0, dy: 1, v: 1.5 }], vents), true, "plain objects back from Foundry");
  assert.equal(sameVents([{ i: 65, dx: 0, dy: 1, v: 1.6 }], vents), false, "a vent that thickened");
  assert.equal(sameVents([{ i: 64, dx: 0, dy: 1, v: 1.5 }], vents), false, "a vent that moved");
  assert.equal(sameVents([], vents), false);
  assert.equal(sameVents(undefined, vents), false);
  assert.equal(SMOKE_VENT_FLAG, "smokeVents");
});
