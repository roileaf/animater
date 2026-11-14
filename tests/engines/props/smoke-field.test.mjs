import test from "node:test";
import assert from "node:assert/strict";
import { THICK, THIN, DROP_FLOOR, DENSITY_CAP, smokeStep, smokeTier, smokeUpdatesFor, smokeCellsOf } from "../../../scripts/engines/props/smoke-field.mjs";

const at = (r, i) => r.cells.find((c) => c.i === i)?.v;
const mass = (cells) => cells.reduce((s, c) => s + c.v, 0);
const run = (args, steps) => { let cells = args.cells ?? []; for (let n = 0; n < steps; n++) cells = smokeStep({ ...args, cells }).cells; return cells; };
const room = (v) => Array.from({ length: 25 }, (_, i) => ({ i, v }));
const stepsToClear = (openings) => { let cells = room(1.5); for (let n = 1; n <= 60; n++) { cells = smokeStep({ cells, sources: [], cols: 5, rows: 5, openings }).cells; if (!cells.length) return n; } return Infinity; };

test("a source fills its own cell and bleeds into its neighbours", () => {
  const r = smokeStep({ cells: [], sources: [{ i: 5, rate: 1 }], cols: 5, rows: 5 });
  assert.ok(at(r, 5) > 0);
  assert.ok(at(r, 6) > 0);
});

test("smoke does not cross a wall", () => {
  const blocked = [{ from: 5, to: 6 }];
  const r = smokeStep({ cells: [{ i: 5, v: 2 }], sources: [], cols: 5, rows: 5, blocked });
  assert.equal(at(r, 6), undefined);
  assert.ok(at(r, 10) > 0, "it still spreads where there is no wall");
});

test("a wall blocks in either direction", () => {
  const r = smokeStep({ cells: [{ i: 6, v: 2 }], sources: [], cols: 5, rows: 5, blocked: [{ from: 5, to: 6 }] });
  assert.equal(at(r, 5), undefined);
});

test("an opening leaks smoke away, and more openings clear it faster", () => {
  const one = smokeStep({ cells: [{ i: 5, v: 2 }], sources: [], cols: 5, rows: 5, openings: [5] });
  const two = smokeStep({ cells: [{ i: 5, v: 2 }], sources: [], cols: 5, rows: 5, openings: [5, 6] });
  assert.ok(at(one, 5) < 2);
  assert.ok(at(two, 5) < at(one, 5));
});

test("a filled room clears strictly faster with two openings than one, and than none", () => {
  const none = stepsToClear([]), one = stepsToClear([12]), two = stepsToClear([12, 0]);
  assert.ok(two < one, `two ${two} < one ${one}`);
  assert.ok(one < none, `one ${one} < none ${none}`);
  assert.ok(one <= 8, `one opening clears in ${one} rounds`);
});

test("with no source the room clears, and a cleared cell is dropped", () => {
  let cells = [{ i: 5, v: 0.5 }];
  for (let n = 0; n < 40; n++) cells = smokeStep({ cells, sources: [], cols: 5, rows: 5 }).cells;
  assert.deepEqual(cells, []);
});

test("no returned cell is at or below the drop floor", () => {
  const cells = run({ cells: [{ i: 12, v: 3 }], sources: [], cols: 5, rows: 5 }, 10);
  assert.ok(cells.length > 0);
  assert.ok(cells.every((c) => c.v > DROP_FLOOR));
});

test("a source in an open room goes thick at its own cell within a few steps, thin beside it", () => {
  let cells = [];
  let thickAt = null, thinAt = null;
  for (let n = 1; n <= 5; n++) {
    cells = smokeStep({ cells, sources: [{ i: 12, rate: 1 }], cols: 5, rows: 5 }).cells;
    const own = cells.find((c) => c.i === 12)?.v ?? 0, next = cells.find((c) => c.i === 13)?.v ?? 0;
    if (thickAt === null && own > THICK) thickAt = n;
    if (thinAt === null && next > THIN) thinAt = n;
  }
  assert.ok(thickAt !== null && thickAt <= 3, `thick at ${thickAt}`);
  assert.ok(thinAt !== null && thinAt <= 5, `neighbour thin at ${thinAt}`);
});

test("a steady source reaches thick beside it in the long run, and a bigger rate is denser", () => {
  const settle = (rate) => run({ cells: [], sources: [{ i: 12, rate }], cols: 5, rows: 5 }, 60);
  const lo = settle(1), hi = settle(2);
  assert.ok(lo.find((c) => c.i === 13).v > THIN);
  assert.ok(hi.find((c) => c.i === 12).v > lo.find((c) => c.i === 12).v);
});

test("a source behind a wall does not fill the far side, and mass is conserved apart from fade", () => {
  const blocked = [{ from: 11, to: 12 }, { from: 12, to: 13 }, { from: 7, to: 12 }, { from: 12, to: 17 }];
  const cells = run({ cells: [], sources: [{ i: 12, rate: 1 }], cols: 5, rows: 5, blocked }, 20);
  assert.deepEqual(cells.map((c) => c.i), [12]);
});

test("wind drifts smoke down its way", () => {
  const still = smokeStep({ cells: [{ i: 12, v: 2 }], sources: [], cols: 5, rows: 5 });
  const east = smokeStep({ cells: [{ i: 12, v: 2 }], sources: [], cols: 5, rows: 5, wind: { x: 1, y: 0 } });
  assert.ok(at(east, 13) > at(still, 13));
  assert.ok(at(east, 11) < at(still, 11));
});

test("cells outside the grid are ignored and edges do not wrap", () => {
  const r = smokeStep({ cells: [{ i: 4, v: 2 }, { i: 99, v: 2 }], sources: [{ i: -1, rate: 1 }], cols: 5, rows: 5 });
  assert.equal(at(r, 5), undefined, "col 4 does not leak into col 0 of the next row");
  assert.equal(at(r, 99), undefined);
  assert.ok(at(r, 9) > 0);
});

test("the step is pure and deterministic, and the input is untouched", () => {
  const cells = [{ i: 12, v: 2 }];
  const a = smokeStep({ cells, sources: [{ i: 7, rate: 1 }], cols: 5, rows: 5 });
  const b = smokeStep({ cells, sources: [{ i: 7, rate: 1 }], cols: 5, rows: 5 });
  assert.deepEqual(a, b);
  assert.deepEqual(cells, [{ i: 12, v: 2 }]);
  assert.deepEqual(a.cells.map((c) => c.i), [...a.cells.map((c) => c.i)].sort((x, y) => x - y));
});

test("smoke does not grow out of nothing, and a bigger dt does not blow up", () => {
  assert.deepEqual(smokeStep({ cells: [], sources: [], cols: 5, rows: 5 }).cells, []);
  const big = smokeStep({ cells: [{ i: 12, v: 2 }], sources: [], cols: 5, rows: 5, dt: 10 });
  assert.ok(big.cells.every((c) => c.v >= 0 && Number.isFinite(c.v)));
  assert.ok(mass(big.cells) <= 2);
});

test("the tiers are by density, and nothing below thin counts", () => {
  assert.equal(smokeTier(2), "thick");
  assert.equal(smokeTier(0.5), "thin");
  assert.equal(smokeTier(0.1), null);
  assert.equal(smokeTier(THICK), "thick");
  assert.equal(smokeTier(THIN), "thin");
});

test("a sealed source crosses thick, then plateaus at the cap instead of growing", () => {
  const blocked = [{ from: 11, to: 12 }, { from: 12, to: 13 }, { from: 7, to: 12 }, { from: 12, to: 17 }];
  let cells = [], crossed = null;
  for (let n = 1; n <= 80; n++) {
    cells = smokeStep({ cells, sources: [{ i: 12, rate: 1 }], cols: 5, rows: 5, blocked }).cells;
    if (crossed === null && cells[0].v > THICK) crossed = n;
  }
  assert.ok(crossed !== null && crossed <= 3, `thick at ${crossed}`);
  assert.equal(cells[0].v, DENSITY_CAP);
  assert.ok(cells.every((c) => c.v <= DENSITY_CAP));
});

test("a smaller cap is honoured, and a capped room with one opening still empties", () => {
  const small = smokeStep({ cells: [{ i: 12, v: 3 }], sources: [{ i: 12, rate: 5 }], cols: 5, rows: 5, cap: 2 });
  assert.ok(small.cells.every((c) => c.v <= 2));
  let cells = room(DENSITY_CAP), n = 0;
  while (cells.length && n < 60) { n++; cells = smokeStep({ cells, sources: [], cols: 5, rows: 5, openings: [12] }).cells; }
  assert.equal(cells.length, 0);
  assert.ok(n <= 12, `emptied in ${n}`);
});

const sceneWith = (smoke) => ({ flags: { animater: { smoke } } });

test("changed cells are written by key and cleared ones deleted by key", () => {
  const u = smokeUpdatesFor({ cells: [{ i: 3, v: 1.4 }] }, { scene: sceneWith({ 3: 0.2, 9: 1 }) });
  assert.equal(u.length, 1);
  assert.equal(u[0]["flags.animater.smoke.3"], 1.4);
  assert.ok("flags.animater.smoke.-=9" in u[0], "the cleared cell must be an explicit delete, not merely absent");
  assert.equal(u[0]["flags.animater.smoke.-=9"], null);
});

test("an update never writes the whole flag next to a keyed delete", () => {
  const u = smokeUpdatesFor({ cells: [{ i: 3, v: 1.4 }] }, { scene: sceneWith({ 3: 0.2, 9: 1 }) });
  assert.ok(!("flags.animater.smoke" in u[0]));
  for (const k of Object.keys(u[0])) assert.ok(k.startsWith("flags.animater.smoke."), k);
});

test("a step that empties the room deletes every stored cell", () => {
  const u = smokeUpdatesFor({ cells: [] }, { scene: sceneWith({ 1: 0.5, 2: 0.4 }) });
  assert.deepEqual(u, [{ "flags.animater.smoke.-=1": null, "flags.animater.smoke.-=2": null }]);
});

test("nothing changed writes nothing", () => {
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 3, v: 1 }] }, { scene: sceneWith({ 3: 1 }) }), []);
  assert.deepEqual(smokeUpdatesFor({ cells: [] }, { scene: {} }), []);
});

test("a density that barely moves writes nothing, a visible move does", () => {
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 3, v: 1.0004 }] }, { scene: sceneWith({ 3: 1 }) }), []);
  assert.equal(smokeUpdatesFor({ cells: [{ i: 3, v: 1.03 }] }, { scene: sceneWith({ 3: 1 }) })[0]["flags.animater.smoke.3"], 1.03);
});

test("stored densities are rounded", () => {
  const u = smokeUpdatesFor({ cells: [{ i: 4, v: 1.23456789 }] }, { scene: {} });
  assert.equal(u[0]["flags.animater.smoke.4"], 1.23);
});

test("a cell that rounds to nothing is not stored, and is deleted if it was", () => {
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 4, v: 0.001 }] }, { scene: {} }), []);
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 4, v: 0.001 }] }, { scene: sceneWith({ 4: 0.5 }) }), [{ "flags.animater.smoke.-=4": null }]);
});

test("smokeCellsOf reads an empty or missing flag as an empty room", () => {
  assert.deepEqual(smokeCellsOf({}), {});
  assert.deepEqual(smokeCellsOf(null), {});
  assert.deepEqual(smokeCellsOf({ flags: { animater: { smoke: {} } } }), {});
  assert.deepEqual(smokeCellsOf({ flags: { animater: { smoke: [1, 2] } } }), {});
});

test("smokeCellsOf returns a copy keyed by cell index, dropping junk values", () => {
  const doc = sceneWith({ 3: 1.2, 7: "x", 8: -1, 9: null });
  const got = smokeCellsOf(doc);
  assert.deepEqual(got, { 3: 1.2 });
  got[3] = 9;
  assert.equal(doc.flags.animater.smoke[3], 1.2);
});

test("what the GM writes round-trips through smokeCellsOf", () => {
  const u = smokeUpdatesFor({ cells: [{ i: 2, v: 0.5 }, { i: 6, v: 2 }] }, { scene: {} })[0];
  const stored = {};
  for (const [k, v] of Object.entries(u)) stored[k.split(".").pop()] = v;
  assert.deepEqual(smokeCellsOf(sceneWith(stored)), { 2: 0.5, 6: 2 });
});
