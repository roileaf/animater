import test from "node:test";
import assert from "node:assert/strict";
import { smokeEdges, smokeEdgeSpecs, smokeGridOf, smokeCellList, syncSmokeEdges } from "../../../scripts/engines/props/smoke-edges.mjs";
import { smokeCellsOf } from "../../../scripts/engines/props/smoke-field.mjs";

const g = { cols: 4, rows: 4, origin: { x: 0, y: 0 }, cell: 50 };
const T = (...is) => is.map((i) => ({ i, v: 2 }));
const len = (s) => Math.abs(s.a.x - s.b.x) + Math.abs(s.a.y - s.b.y);

test("one thick cell is fenced by four edges", () => {
  assert.equal(smokeEdges([{ i: 5, v: 2 }], g).length, 4);
});

test("two thick cells side by side share no interior edge, and their run is merged", () => {
  const e = smokeEdges([{ i: 5, v: 2 }, { i: 6, v: 2 }], g);
  assert.equal(e.length, 4, "a 2x1 block is still four edges");
  assert.ok(e.some((s) => Math.abs(s.a.x - s.b.x) === 100 || Math.abs(s.a.y - s.b.y) === 100), "a run is merged, not two segments");
});

test("thin smoke emits no edge at all", () => {
  assert.deepEqual(smokeEdges([{ i: 5, v: 0.5 }], g), []);
});

test("a hole in the middle of a cloud is fenced too", () => {
  const e = smokeEdges(T(1, 2, 3, 5, 7, 9, 10, 11), g);
  assert.ok(e.length > 4, "the inner hole has its own boundary");
});

test("the same cells always give the same edges", () => {
  const a = smokeEdges([{ i: 5, v: 2 }, { i: 9, v: 2 }], g);
  assert.deepEqual(a, smokeEdges([{ i: 9, v: 2 }, { i: 5, v: 2 }], g));
});

test("a ring around a clear hole: outer 4 edges plus the hole's 4, all merged", () => {
  const big = { cols: 5, rows: 5, origin: { x: 0, y: 0 }, cell: 10 };
  const ring = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!(r === 1 && c === 1)) ring.push(r * 5 + c);
  const e = smokeEdges(T(...ring), big);
  assert.equal(e.length, 8);
  assert.deepEqual(e.map(len).sort((a, b) => a - b), [10, 10, 10, 10, 30, 30, 30, 30]);
});

test("an L shape is six edges", () => {
  // cells 0,4,8 (column) and 9,10 (foot)
  const e = smokeEdges(T(0, 4, 8, 9), g);
  assert.equal(e.length, 6);
});

test("a solid NxN block is four edges, however big", () => {
  const big = { cols: 8, rows: 8, origin: { x: 0, y: 0 }, cell: 10 };
  const all = []; for (let i = 0; i < 64; i++) all.push(i);
  const e = smokeEdges(T(...all), big);
  assert.equal(e.length, 4);
  assert.ok(e.every((s) => len(s) === 80));
});

test("regions touching only at a corner: still fenced, collinear sides that meet end to end merge", () => {
  // cell 0 and cell 5: the shared corner (50,50) lies on a horizontal and a vertical line of both
  const e = smokeEdges(T(0, 5), g);
  assert.equal(e.length, 6, "4 outer sides of 50 plus the two merged 100 runs through the corner");
  assert.deepEqual(e.map(len).sort((a, b) => a - b), [50, 50, 50, 50, 100, 100]);
});

test("a region flush against the grid edge is fenced on the grid edge too", () => {
  const e = smokeEdges(T(0, 1), g);
  assert.equal(e.length, 4);
  assert.ok(e.some((s) => s.a.x === 0 && s.b.x === 0), "left side on the grid edge");
  assert.ok(e.some((s) => s.a.y === 0 && s.b.y === 0), "top side on the grid edge");
});

test("origin offsets the pixels", () => {
  const e = smokeEdges([{ i: 0, v: 2 }], { ...g, origin: { x: 100, y: 200 } });
  assert.deepEqual(e[0], { a: { x: 100, y: 200 }, b: { x: 150, y: 200 } });
});

test("a thin cell beside a thick one is not fenced", () => {
  const e = smokeEdges([{ i: 5, v: 2 }, { i: 6, v: 0.5 }], g);
  assert.equal(e.length, 4);
  assert.ok(e.every((s) => Math.max(s.a.x, s.b.x) <= 100));
});

test("THICK is pinned: 1.1 fences, 1.09 does not", () => {
  assert.equal(smokeEdges([{ i: 5, v: 1.1 }], g).length, 4);
  assert.deepEqual(smokeEdges([{ i: 5, v: 1.09 }], g), []);
});

test("every side of a cell honours a non-zero origin and a non-round cell size", () => {
  const e = smokeEdges([{ i: 5, v: 2 }], { cols: 4, rows: 4, origin: { x: -20, y: 1000 }, cell: 37 });
  assert.deepEqual(e, [
    { a: { x: 17, y: 1037 }, b: { x: 54, y: 1037 } },
    { a: { x: 17, y: 1037 }, b: { x: 17, y: 1074 } },
    { a: { x: 54, y: 1037 }, b: { x: 54, y: 1074 } },
    { a: { x: 17, y: 1074 }, b: { x: 54, y: 1074 } },
  ]);
});

test("a clear cell between two runs on one grid line keeps them two segments", () => {
  const e = smokeEdges(T(4, 6), g);
  assert.equal(e.length, 8, "two separate cells, four sides each, nothing spans the gap");
  assert.ok(e.every((s) => len(s) === 50));
});

test("a duplicated cell index fences once", () => {
  assert.equal(smokeEdges([{ i: 5, v: 2 }, { i: 5, v: 3 }], g).length, 4);
});

test("cell indices outside the grid are ignored", () => {
  assert.deepEqual(smokeEdges([{ i: 16, v: 2 }, { i: -1, v: 2 }], g), []);
});

// ---- the Foundry-facing half: stored grid -> fence, and surviving a reset ----

const scene = (cells) => ({ dimensions: { size: 100, width: 800, height: 600 }, flags: { animater: { smoke: cells } } });
const level = () => ({ edges: new Map() });
const mk = (spec) => ({ ...spec });

test("the stored map's string keys become numeric cell indices", () => {
  assert.deepEqual(smokeCellList({ 5: 2, 12: 0.4 }), [{ i: 5, v: 2 }, { i: 12, v: 0.4 }]);
  assert.equal(typeof smokeCellList({ 5: 2 })[0].i, "number");
});

test("without Number() the fence would be empty: stored thick smoke does produce edges", () => {
  // cols = 8 for an 800 px canvas of 100 px squares; cell 9 is column 1, row 1.
  const specs = smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf);
  assert.equal(specs.length, 4);
  const xs = specs.flatMap((s) => [s.a.x, s.b.x]), ys = specs.flatMap((s) => [s.a.y, s.b.y]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [100, 200, 100, 200]);
});

test("thin smoke, no smoke and a canvas of unknown size all give no edges", () => {
  assert.deepEqual(smokeEdgeSpecs(scene({ 9: 0.5 }), smokeCellsOf), []);
  assert.deepEqual(smokeEdgeSpecs(scene({}), smokeCellsOf), []);
  assert.deepEqual(smokeEdgeSpecs({ dimensions: {}, flags: { animater: { smoke: { 9: 2 } } } }, smokeCellsOf), []);
  assert.equal(smokeGridOf({ size: 100, width: 850, height: 600 }).cols, 9, "a partial last column still counts");
});

test("edge ids are Animater's own and the same smoke gives the same ids", () => {
  const a = smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf).map((s) => s.id);
  assert.ok(a.every((id) => id.startsWith("animater.smoke.")));
  assert.deepEqual(a, smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf).map((s) => s.id));
});

test("a reset that empties every level is repaired by rebuilding from the stored grid alone", () => {
  const s = scene({ 9: 2, 10: 2 });
  const levels = [level(), level()];
  const first = syncSmokeEdges(levels, smokeEdgeSpecs(s, smokeCellsOf), mk, []);
  assert.equal(first.length, 4);
  for (const l of levels) assert.equal(l.edges.size, 4);
  for (const l of levels) l.edges.clear(); // what a scene save / level change / redraw does
  const again = syncSmokeEdges(levels, smokeEdgeSpecs(s, smokeCellsOf), mk, first);
  assert.deepEqual(again, first);
  for (const l of levels) assert.equal(l.edges.size, 4);
});

test("a changed grid replaces the old fence rather than adding to it", () => {
  const levels = [level()];
  const before = syncSmokeEdges(levels, smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf), mk, []);
  const after = syncSmokeEdges(levels, smokeEdgeSpecs(scene({ 20: 2 }), smokeCellsOf), mk, before);
  assert.equal(levels[0].edges.size, 4);
  for (const id of before) assert.ok(!levels[0].edges.has(id), "the old fence is gone");
  for (const id of after) assert.ok(levels[0].edges.has(id));
});

test("smoke that clears leaves no edges behind", () => {
  const levels = [level()];
  const ids = syncSmokeEdges(levels, smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf), mk, []);
  syncSmokeEdges(levels, smokeEdgeSpecs(scene({}), smokeCellsOf), mk, ids);
  assert.equal(levels[0].edges.size, 0);
});

test("walls already in the set are never touched", () => {
  const levels = [level()];
  levels[0].edges.set("wall.abc", { wall: true });
  const ids = syncSmokeEdges(levels, smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf), mk, []);
  syncSmokeEdges(levels, [], mk, ids);
  assert.deepEqual([...levels[0].edges.keys()], ["wall.abc"]);
});
