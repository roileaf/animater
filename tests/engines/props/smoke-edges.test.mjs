import test from "node:test";
import assert from "node:assert/strict";
import { smokeEdges, smokeEdgeSpecs, smokeGridOf, smokeCellList, syncSmokeEdges, smokeFenceLevels, smokeLevelOf, smokeLevelReal, storedSmokeGrid } from "../../../scripts/engines/props/smoke-edges.mjs";
import { smokeLevelFor } from "../../../scripts/engines/props/smoke-round.mjs";
import { smokeCellsOf } from "../../../scripts/engines/props/smoke-field.mjs";
import { registerSmokeFence, smokeEdgeMaker } from "../../../scripts/engines/props/smoke-fence.mjs";

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

// Sixteen characters each, as a real Foundry document id is: the smoke only ever names a level the scene still has
// AND whose id is a document id (smoke-edges.mjs smokeLevelReal), which is also what smokeRegionData demands.
const L1 = "levelAAAAAAAAAAA", L2 = "levelBBBBBBBBBBB";
const mkLevel = (id) => ({ id, edges: new Map() });
// A scene shaped like Foundry's: dimensions, a flags bag, levels, an initializedEdges switch.
const scene = (cells, { grid, levels = [mkLevel(L1)], ready = true, flags = {} } = {}) => ({
  dimensions: { size: 100, width: 800, height: 600 },
  flags: { animater: { smoke: cells, ...(grid ? { smokeGrid: grid } : {}), ...flags } },
  levels, firstLevel: levels[0], initializedEdges: ready,
});
const mk = (spec) => ({ ...spec });

test("the stored map's string keys become numeric cell indices", () => {
  assert.deepEqual(smokeCellList({ 5: 2, 12: 0.4 }), [{ i: 5, v: 2 }, { i: 12, v: 0.4 }]);
  assert.equal(typeof smokeCellList({ 5: 2 })[0].i, "number");
});

test("stored thick smoke (string keys) produces a fence at the right place", () => {
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

test("a stored geometry wins over the scene's current size, so a resize cannot slide the fence", () => {
  // Written when the grid was 50 px and 4 columns wide: cell 5 is column 1, row 1 -> pixels 50..100.
  const resized = scene({ 5: 2 }, { grid: { cols: 4, cell: 50, level: L1 } });
  const specs = smokeEdgeSpecs(resized, smokeCellsOf);
  const xs = specs.flatMap((s) => [s.a.x, s.b.x]), ys = specs.flatMap((s) => [s.a.y, s.b.y]);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [50, 100, 50, 100]);
  // Without it the same cell lands elsewhere (8 columns of 100 px: column 5, row 0).
  assert.notDeepEqual(specs, smokeEdgeSpecs(scene({ 5: 2 }), smokeCellsOf));
  assert.equal(storedSmokeGrid(scene({}, { grid: { cols: 0, cell: 50 } }), {}), null, "unusable geometry falls back");
});

test("only the smoke's own level is fenced; with none stored, the scene's first level", () => {
  const a = mkLevel(L1), b = mkLevel(L2);
  assert.deepEqual(smokeFenceLevels(scene({ 9: 2 }, { levels: [a, b], grid: { cols: 8, cell: 100, level: L2 } })).map((l) => l.id), [L2]);
  assert.deepEqual(smokeFenceLevels(scene({ 9: 2 }, { levels: [a, b] })).map((l) => l.id), [L1]);
});

// ---- THE one rule: a level counts only while the scene still has it, and nothing ever names one that is gone. ----

test("a level the scene no longer has names nothing, by either side", () => {
  const a = mkLevel(L1), b = mkLevel(L2);
  assert.equal(smokeLevelReal(scene({}, { levels: [a, b] }), L2), true);
  assert.equal(smokeLevelReal(scene({}, { levels: [a] }), L2), false, "the scene does not hold it");
  // Not a document id at all: sixteen characters is what Foundry writes, and what smokeRegionData accepts.
  for (const bad of ["gone", "", null, undefined, 7, L1 + "x"]) assert.equal(smokeLevelReal(scene({}, { levels: [a] }), bad), false, JSON.stringify(bad));
  // A scene that lists no levels cannot contradict anything, so there a document id passes and junk still does not.
  assert.equal(smokeLevelReal({ levels: [] }, L1), true);
  assert.equal(smokeLevelReal({ levels: [] }, "gone"), false);
});

test("deleting the level the smoke was stored on leaves the reader and the writer agreeing", () => {
  const a = mkLevel(L1), b = mkLevel(L2);
  // Stored on the upper floor while it exists: both sides say so, and the fence is on it.
  const both = scene({ 9: 2 }, { levels: [a, b], grid: { cols: 8, cell: 100, level: L2 } });
  assert.equal(smokeLevelOf(both), L2);
  assert.equal(smokeLevelFor(both, []), L2);
  assert.deepEqual(smokeFenceLevels(both).map((l) => l.id), [L2]);
  // That level is now deleted. Neither side may go on naming it: this was the bug, where the writer moved the field
  // to a live level while every reader kept the dead id, so smokeFenceLevels returned [] and thick smoke stopped
  // blocking sight while the smoke was still stored and still drawn.
  const dead = scene({ 9: 2 }, { levels: [a], grid: { cols: 8, cell: 100, level: L2 } });
  assert.notEqual(smokeLevelOf(dead), L2, "the reader does not hand back a dead level");
  assert.notEqual(smokeLevelFor(dead, []), L2, "nor does the writer");
  assert.equal(smokeLevelOf(dead), L1, "both fall back to the scene's own level");
  assert.equal(smokeLevelFor(dead, []), L1);
  assert.deepEqual(smokeFenceLevels(dead).map((l) => l.id), [L1], "and the fence is somewhere, not nowhere");
  // A scene listing NO levels at all cannot contradict a stored id, so both sides go on naming it and agree; the
  // fence then holds nothing, because there is no level to hold it, which is the truth rather than a disagreement.
  const bare = scene({ 9: 2 }, { levels: [], grid: { cols: 8, cell: 100, level: L2 } });
  assert.equal(smokeLevelOf(bare), L2);
  assert.equal(smokeLevelFor(bare, []), L2);
  assert.deepEqual(smokeFenceLevels(bare), []);
  // And junk stored on such a scene names nothing on either side, so smokeRegionData is never handed it.
  const junk = scene({ 9: 2 }, { levels: [], grid: { cols: 8, cell: 100, level: "gone" } });
  assert.equal(smokeLevelOf(junk), null);
  assert.equal(smokeLevelFor(junk, []), null);
});

test("syncSmokeEdges adds to the target level only and removes the old fence from every level", () => {
  const a = mkLevel(L1), b = mkLevel(L2), specs = smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf);
  const ids = syncSmokeEdges([a, b], [a], specs, mk, []);
  assert.equal(a.edges.size, 4);
  assert.equal(b.edges.size, 0);
  syncSmokeEdges([a, b], [b], specs, mk, ids); // the smoke moved up a floor
  assert.equal(a.edges.size, 0);
  assert.equal(b.edges.size, 4);
});

// --- the registered hooks, driven the way Foundry drives them ---

function rig() {
  const handlers = {};
  const hooks = { on: (name, fn) => { (handlers[name] ??= []).push(fn); } };
  const built = [];
  class Edge { constructor(a, b, o) { Object.assign(this, { a, b, o }); built.push(this); } }
  const perception = [];
  const canvas = { scene: null, perception: { update: (o) => perception.push(o) } };
  registerSmokeFence({ hooks, moduleId: "animater", cellsOf: smokeCellsOf, env: () => ({ Edge, NORMAL: 20, canvas }) });
  return { handlers, built, perception, canvas };
}

test("the fence registers on initializeEdges and updateScene, by those exact names", () => {
  const { handlers } = rig();
  assert.deepEqual(Object.keys(handlers).sort(), ["initializeEdges", "updateScene"]);
  assert.equal(handlers.initializeEdges.length, 1);
});

test("the initializeEdges callback fences a scene whose edges the engine has just cleared", () => {
  const { handlers, built } = rig();
  const s = scene({ 9: 2, 10: 2 }, { levels: [mkLevel(L1), mkLevel(L2)], grid: { cols: 8, cell: 100, level: L1 } });
  handlers.initializeEdges[0](s);
  assert.equal(s.levels[0].edges.size, 4);
  assert.equal(s.levels[1].edges.size, 0, "the other floor is left alone");
  for (const l of s.levels) l.edges.clear(); // a scene save, level change or redraw
  handlers.initializeEdges[0](s); // the engine calls the hook again
  assert.equal(s.levels[0].edges.size, 4, "rebuilt from the stored grid, though nothing changed");
  assert.equal(built.length, 8);
});

test("the callback does nothing before the scene's edges are initialized, and never throws", () => {
  const { handlers } = rig();
  const s = scene({ 9: 2 }, { ready: false });
  assert.doesNotThrow(() => handlers.initializeEdges[0](s));
  assert.equal(s.levels[0].edges.size, 0);
  assert.doesNotThrow(() => handlers.initializeEdges[0](null));
});

test("the edge is a wall that blocks sight and nothing else", () => {
  const made = [];
  class Edge { constructor(a, b, o) { made.push({ a, b, o }); } }
  smokeEdgeMaker({ Edge, NORMAL: 20 })({ id: "animater.smoke.x", a: { x: 0, y: 0 }, b: { x: 100, y: 0 } });
  assert.deepEqual(made[0].o, { id: "animater.smoke.x", type: "wall", sight: 20 });
  for (const k of ["light", "darkness", "move", "sound"]) assert.ok(!(k in made[0].o), k);
});

test("an update to the stored smoke refits the fence and nudges vision; an unrelated one does not", () => {
  const { handlers, perception, canvas } = rig();
  const s = scene({}, { grid: { cols: 8, cell: 100, level: L1 } });
  canvas.scene = s;
  handlers.initializeEdges[0](s);
  assert.equal(s.levels[0].edges.size, 0);
  s.flags.animater.smoke = { 9: 2 };
  handlers.updateScene[0](s, { name: "x" });
  handlers.updateScene[0](s, { flags: { other: { smoke: {} } } });
  assert.equal(s.levels[0].edges.size, 0, "unrelated updates are ignored");
  assert.equal(perception.length, 0);
  handlers.updateScene[0](s, { flags: { animater: { smoke: { 9: 2 } } } });
  assert.equal(s.levels[0].edges.size, 4);
  assert.deepEqual(perception, [{ initializeVision: true, refreshVision: true }]);
  handlers.updateScene[0](s, { flags: { animater: { smoke: { 9: 2 } } } });
  assert.equal(perception.length, 1, "no change, no nudge");
  s.flags.animater.smoke = {};
  handlers.updateScene[0](s, { flags: { animater: { smoke: { "-=9": null } } } });
  assert.equal(s.levels[0].edges.size, 0, "cleared smoke leaves no fence");
  assert.equal(perception.length, 2);
});

test("a change of stored level or geometry also refits the fence", () => {
  const { handlers } = rig();
  const a = mkLevel(L1), b = mkLevel(L2);
  const s = scene({ 9: 2 }, { levels: [a, b], grid: { cols: 8, cell: 100, level: L1 } });
  handlers.initializeEdges[0](s);
  assert.equal(a.edges.size, 4);
  s.flags.animater.smokeGrid.level = L2;
  handlers.updateScene[0](s, { flags: { animater: { smokeGrid: { level: L2 } } } });
  assert.equal(a.edges.size, 0);
  assert.equal(b.edges.size, 4);
});

test("walls already in the set are never touched", () => {
  const a = mkLevel(L1);
  a.edges.set("wall.abc", { wall: true });
  const ids = syncSmokeEdges([a], [a], smokeEdgeSpecs(scene({ 9: 2 }), smokeCellsOf), mk, []);
  syncSmokeEdges([a], [a], [], mk, ids);
  assert.deepEqual([...a.edges.keys()], ["wall.abc"]);
});
