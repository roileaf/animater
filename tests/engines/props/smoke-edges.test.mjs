import test from "node:test";
import assert from "node:assert/strict";
import { smokeEdges } from "../../../scripts/engines/props/smoke-edges.mjs";

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
