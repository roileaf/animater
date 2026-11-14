import { test } from "node:test";
import assert from "node:assert/strict";
import { smokeSourcesOf } from "../../../scripts/engines/props/smoke-field.mjs";

test("burning things and marked fire lights are sources; a plain hearth is not", () => {
  const s = smokeSourcesOf({ fires: [{ rect: { x: 0, y: 0, w: 100, h: 100 } }],
    lights: [{ x: 250, y: 50, smokes: true }, { x: 450, y: 50, smokes: false }],
    grid: 100, cell: 50, origin: { x: 0, y: 0 }, cols: 10 });
  assert.equal(s.length, 2);
});

test("a source sits in the cell its middle falls in, and the list is sorted by index", () => {
  const s = smokeSourcesOf({ fires: [{ rect: { x: 0, y: 0, w: 100, h: 100 } }],
    lights: [{ x: 250, y: 50, smokes: true }],
    grid: 100, cell: 50, origin: { x: 0, y: 0 }, cols: 10 });
  // The fire's middle is (50, 50): column 1, row 1 of 50px cells. The light stands at (250, 50): column 5, row 1.
  assert.deepEqual(s.map((c) => c.i), [11, 15]);
});

test("the grid's origin is taken off before the cell is worked out", () => {
  const s = smokeSourcesOf({ lights: [{ x: 320, y: 220, smokes: true }], cell: 100, origin: { x: 300, y: 200 }, cols: 4 });
  assert.deepEqual(s, [{ i: 0, rate: 1 }]);
});

test("two sources in one cell add up to one entry", () => {
  const s = smokeSourcesOf({ lights: [{ x: 10, y: 10, smokes: true }, { x: 40, y: 40, smokes: true }], cell: 100, cols: 4 });
  assert.equal(s.length, 1);
  assert.equal(s[0].rate, 2);
});

test("a thing counts for what it covers of a scene square, never under a quarter nor over four", () => {
  const big = smokeSourcesOf({ fires: [{ rect: { x: 0, y: 0, w: 1000, h: 1000 } }], grid: 100, cell: 2000, cols: 1 });
  assert.equal(big[0].rate, 4);
  const tiny = smokeSourcesOf({ fires: [{ rect: { x: 0, y: 0, w: 2, h: 2 } }], grid: 100, cell: 100, cols: 1 });
  assert.equal(tiny[0].rate, 0.25);
  const one = smokeSourcesOf({ fires: [{ rect: { x: 0, y: 0, w: 100, h: 100 } }], grid: 100, cell: 100, cols: 1 });
  assert.equal(one[0].rate, 1);
});

test("a thing may name its own rate", () => {
  const s = smokeSourcesOf({ fires: [{ rect: { x: 0, y: 0, w: 10, h: 10 }, rate: 3 }], grid: 100, cell: 100, cols: 1 });
  assert.equal(s[0].rate, 3);
});

test("nothing off the grid, and nothing malformed, becomes a source", () => {
  const s = smokeSourcesOf({ fires: [{ rect: { x: -500, y: 0, w: 100, h: 100 } }, { rect: { x: 0, y: -500, w: 100, h: 100 } }, { rect: { x: 10, y: 10 } }, null],
    lights: [{ x: 5000, y: 0, smokes: true }, { x: NaN, y: 0, smokes: true }, { x: 0, y: 0 }],
    grid: 100, cell: 100, cols: 4 });
  assert.deepEqual(s, []);
});

test("no sources at all is an empty list, and the call survives no arguments", () => {
  assert.deepEqual(smokeSourcesOf({ cell: 100, cols: 4 }), []);
  assert.deepEqual(smokeSourcesOf(), []);
});
