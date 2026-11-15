// The round's stored smoke cells as the air simulation's input: which cells become sources, at what weight, what the
// air is primed with, and how long a clock step may be.
import test from "node:test";
import assert from "node:assert/strict";
import { ROOM_AIR, airSourcesOf, airPrimeOf, airStepSeconds, AIR_FULL } from "../../../scripts/engines/props/smoke-air.mjs";
import { THICK, THIN, DROP_FLOOR } from "../../../scripts/engines/props/smoke-field.mjs";
import { MIST_AIR } from "../../../scripts/engines/motion/indoor-air.mjs";

const GEO = { cols: 10, cell: 100, origin: { x: 0, y: 0 } };
const FIELD = { x: 0, y: 0, cols: 20, rows: 20, cell: 50 };

test("a cell becomes a source at the weight of its own smoke", () => {
  const thick = airSourcesOf({ 55: THICK }, GEO, FIELD);
  assert.deepEqual(thick, [{ x: 550, y: 550, w: 1 }], "the middle of its square, at full weight");
  assert.equal(airSourcesOf({ 55: THICK * 2 }, GEO, FIELD)[0].w, 1, "thicker than full is still full");
  assert.ok(Math.abs(airSourcesOf({ 55: THIN }, GEO, FIELD)[0].w - THIN / THICK) < 1e-9);
  assert.deepEqual(airSourcesOf({ 55: DROP_FLOOR }, GEO, FIELD), [], "a wisp makes nothing");
  assert.deepEqual(airSourcesOf({ 999: THICK }, GEO, FIELD), [], "a cell off the field is dropped");
  assert.deepEqual(airSourcesOf(null, GEO, FIELD), []);
});

test("the same cells prime the air to what the round already says is there", () => {
  assert.deepEqual(airPrimeOf({ 55: THICK }, GEO), [{ x: 550, y: 550, v: 1 }]);
  assert.deepEqual(airPrimeOf({ 55: DROP_FLOOR }, GEO), []);
});

test("the clock may never be replayed for longer than the cap", () => {
  assert.equal(airStepSeconds(1000, 4000), 3);
  assert.equal(airStepSeconds(1000, 1000), 0);
  assert.equal(airStepSeconds(4000, 1000), 0, "a clock that went backwards steps nothing");
  assert.equal(airStepSeconds(0, 600000), 6, "a tab asleep ten minutes catches up, it does not replay");
  assert.equal(airStepSeconds(0, 600000, { cap: 2 }), 2);
});

test("the room breathes between the fire and the mist", () => {
  for (const key of Object.keys(MIST_AIR)) assert.ok(key in ROOM_AIR, `${key} is set`);
  assert.ok(ROOM_AIR.run > MIST_AIR.run, "smoke streams harder than mist");
  assert.ok(ROOM_AIR.shove > 0, "and a door swinging pushes it");
});

test("a cell is its own source and nothing else, so neighbours never pile up", () => {
  assert.equal(ROOM_AIR.wide, 0);
});

test("the origin moves every cell with it, and a full cell is the thick tier", () => {
  const geo = { cols: 10, cell: 100, origin: { x: 200, y: 300 } };
  const field = { x: 0, y: 0, cols: 40, rows: 40, cell: 50 };
  assert.deepEqual(airSourcesOf({ 12: THICK }, geo, field), [{ x: 450, y: 450, w: 1 }]);
  assert.deepEqual(airPrimeOf({ 12: THICK }, geo), [{ x: 450, y: 450, v: 1 }]);
  assert.equal(AIR_FULL, THICK);
});
