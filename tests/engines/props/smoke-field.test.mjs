import test from "node:test";
import assert from "node:assert/strict";
import { THICK, THIN, DROP_FLOOR, DENSITY_CAP, smokeStep, smokeTier, smokeUpdatesFor, smokeCellsOf, smokeOpeningsOf, wallStandsOpen } from "../../../scripts/engines/props/smoke-field.mjs";

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
  // Breaking one window into a full room must be plain to watch, not a rounding difference.
  assert.ok(one <= none * 0.75, `one opening clears in ${one} of the ${none} a sealed room takes`);
});

test("the venting goes by how far the room stands open, not by how many openings there are", () => {
  // One opening on a room of 25 vents far harder than the same opening on a room of 400: a doorway on a closet is a
  // gale, the same doorway on a great hall is a draught.
  const closet = smokeStep({ cells: [{ i: 12, v: 2 }], sources: [], cols: 5, rows: 5, openings: [0], room: 25 });
  const hall = smokeStep({ cells: [{ i: 12, v: 2 }], sources: [], cols: 5, rows: 5, openings: [0], room: 400 });
  assert.ok(at(hall, 12) > at(closet, 12), `hall ${at(hall, 12)} > closet ${at(closet, 12)}`);
  // With no room given the whole grid is the room, as a room exactly filling the grid would say itself.
  assert.equal(at(smokeStep({ cells: [{ i: 12, v: 2 }], sources: [], cols: 5, rows: 5, openings: [0] }), 12), at(closet, 12));
});

test("the vent is taken once a round, so a door and a window do not compound into an empty room", () => {
  // Under the old rule each opening took its own share of every cell, and a room with two could hold no smoke at all.
  const lit = (openings) => { let cells = []; for (let n = 0; n < 20; n++) cells = smokeStep({ cells, sources: [{ i: 12, rate: 1 }], cols: 5, rows: 5, openings, room: 25 }).cells; return cells; };
  const two = lit([2, 10]);
  assert.ok(two.some((c) => smokeTier(c.v)), "a fire still smokes a room with a door and a window");
  // More openings still vent more: the rule saturates, it never reverses.
  const peak = (cells) => Math.max(0, ...cells.map((c) => c.v));
  assert.ok(peak(lit([2])) > peak(two), `one ${peak(lit([2]))} > two ${peak(two)}`);
  assert.ok(peak(two) > peak(lit([2, 10, 22])), "three vent more than two");
  assert.ok(peak(lit([])) > peak(lit([2])), "sealed holds more than one opening");
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
  assert.ok(n <= 40, `emptied in ${n}`);
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

test("a density that moves less than a store unit writes nothing, a visible move does", () => {
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 3, v: 1.00004 }] }, { scene: sceneWith({ 3: 1 }) }), []);
  assert.equal(smokeUpdatesFor({ cells: [{ i: 3, v: 1.03 }] }, { scene: sceneWith({ 3: 1 }) })[0]["flags.animater.smoke.3"], 1.03);
});

test("stored densities are rounded", () => {
  const u = smokeUpdatesFor({ cells: [{ i: 4, v: 1.23456789 }] }, { scene: {} });
  assert.equal(u[0]["flags.animater.smoke.4"], 1.2346);
});

test("a cell that rounds to nothing is not stored, and is deleted if it was", () => {
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 4, v: 0.00001 }] }, { scene: {} }), []);
  assert.deepEqual(smokeUpdatesFor({ cells: [{ i: 4, v: 0.00001 }] }, { scene: sceneWith({ 4: 0.5 }) }), [{ "flags.animater.smoke.-=4": null }]);
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

// Apply an update the way Foundry merges flags: a keyed write sets, a `-=` delete removes.
const applyTo = (scene, updates) => {
  const smoke = { ...(scene.flags?.animater?.smoke ?? {}) };
  for (const u of updates) for (const [k, v] of Object.entries(u)) {
    const key = k.split(".").pop();
    if (key.startsWith("-=")) delete smoke[key.slice(2)]; else smoke[key] = v;
  }
  return sceneWith(smoke);
};
const toCells = (m) => Object.entries(m).map(([i, v]) => ({ i: Number(i), v }));

test("closed loop: a uniform thin room written, read and stepped actually clears", () => {
  for (const start of [0.03, 0.05, 0.2, 1.5]) {
    let scene = sceneWith(Object.fromEntries(Array.from({ length: 25 }, (_, i) => [i, start])));
    let rounds = 0;
    for (; rounds < 200 && Object.keys(smokeCellsOf(scene)).length; rounds++) {
      const step = smokeStep({ cells: toCells(smokeCellsOf(scene)), sources: [], cols: 5, rows: 5 });
      scene = applyTo(scene, smokeUpdatesFor(step, { scene }));
    }
    assert.ok(rounds < 200, `room at ${start} never cleared`);
    assert.deepEqual(scene.flags.animater.smoke, {}, `room at ${start} left keys stored`);
  }
});

test("stored zero and junk keys are deleted, not left for ever", () => {
  const scene = sceneWith({ 1: 0, 2: "x", 3: null, 4: NaN, 5: 0.5 });
  const [u] = smokeUpdatesFor({ cells: [] }, { scene });
  assert.deepEqual(Object.keys(u).sort(), [1, 2, 3, 4, 5].map((k) => `flags.animater.smoke.-=${k}`));
  assert.deepEqual(applyTo(scene, [u]).flags.animater.smoke, {});
});

// ---- Where the smoke gets out: the openings of a scene's walls (smokeOpeningsOf). ----

// A 10-wide grid of 50px cells over a scene whose own square is 100px.
// NOWHERE: no cell is in a room, so every open wall leads out. Said in so many words, never assumed.
const NOWHERE = () => false;
const G = { grid: 100, cell: 50, origin: { x: 0, y: 0 }, cols: 10, indoors: NOWHERE };

test("an open door, and an open or broken window, are openings; a closed one is not", () => {
  const g = { grid: 100, cell: 50, origin: { x: 0, y: 0 }, cols: 10, indoors: NOWHERE };
  const open = { c: [100, 100, 200, 100], door: 1, ds: 1 };
  const shut = { c: [300, 100, 400, 100], door: 1, ds: 0 };
  const broken = { c: [500, 100, 600, 100], door: 0, flags: { animater: { breakWall: { windowKind: "glass", broken: {} } } } };
  const o = smokeOpeningsOf({ walls: [open, shut, broken], ...g });
  assert.ok(o.length >= 2);
});

test("only a wall that really stands open counts, and each kind is told apart", () => {
  // A door: open (ds 1) yes, shut (0) and locked (2) no. A secret door counts as a door.
  assert.equal(wallStandsOpen({ door: 1, ds: 1 }), true);
  assert.equal(wallStandsOpen({ door: 2, ds: 1 }), true);
  assert.equal(wallStandsOpen({ door: 1, ds: 0 }), false);
  assert.equal(wallStandsOpen({ door: 1, ds: 2 }), false);
  // A window that opens and closes: only while it stands open.
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { window: "glassWindow", windowOpen: true } } }), true);
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { window: "glassWindow" } } }), false);
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { window: "glassWindow", windowOpen: false } } }), false);
  // An empty frame, and anything of ours broken through: a smashed window, a battered door, a breached wall.
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { window: "open" } } }), true);
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { breakWall: { broken: { kind: "window" } } } } }), true);
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { breakWall: { broken: { kind: "wall" } } } } }), true);
  // A plain wall, a wall marked breakable but whole, and nothing at all.
  assert.equal(wallStandsOpen({ door: 0 }), false);
  assert.equal(wallStandsOpen({ door: 0, flags: { animater: { breakWall: { window: true } } } }), false);
  assert.equal(wallStandsOpen(null), false);
});

test("an opening stands on the cells BOTH sides of its wall, since a doorway vents either room", () => {
  // The wall runs along y = 100, the line between row 1 and row 2 of 50px cells, from x = 100 to x = 200: columns 2
  // and 3 of each row, and NOT column 4, which it only touches the corner of.
  const o = smokeOpeningsOf({ walls: [{ c: [100, 100, 200, 100], door: 1, ds: 1 }], ...G });
  assert.deepEqual(o, [12, 13, 22, 23]);
  // Nothing a row further away.
  assert.ok(!o.includes(32) && !o.includes(2));
});

test("a shut scene has no openings at all", () => {
  assert.deepEqual(smokeOpeningsOf({ walls: [{ c: [100, 100, 200, 100], door: 1, ds: 0 }, { c: [0, 0, 0, 500] }], ...G }), []);
  assert.deepEqual(smokeOpeningsOf({ walls: [], ...G }), []);
  assert.deepEqual(smokeOpeningsOf({ indoors: NOWHERE }), []);
});

test("the openings are sorted, told once each, and never off the grid", () => {
  const twice = { c: [100, 100, 200, 100], door: 1, ds: 1 };
  const o = smokeOpeningsOf({ walls: [twice, { ...twice }], ...G });
  assert.deepEqual(o, [...new Set(o)].sort((a, b) => a - b));
  // Right of the grid (10 columns of 50px: 500px wide) and above its top, both dropped.
  assert.deepEqual(smokeOpeningsOf({ walls: [{ c: [900, 100, 1000, 100], door: 1, ds: 1 }], ...G }), []);
  assert.deepEqual(smokeOpeningsOf({ walls: [{ c: [100, -400, 200, -400], door: 1, ds: 1 }], ...G }), []);
});

test("a wall with no usable segment is left out", () => {
  for (const c of [null, undefined, [1, 2], [1, 2, 3, "x"], [NaN, 0, 1, 1]]) {
    assert.deepEqual(smokeOpeningsOf({ walls: [{ c, door: 1, ds: 1 }], ...G }), [], JSON.stringify(c));
  }
  // A wall of no length at all still names the cell it stands on.
  assert.deepEqual(smokeOpeningsOf({ walls: [{ c: [125, 125, 125, 125], door: 1, ds: 1 }], ...G }), [22]);
});

test("the openings are pure: the walls are untouched and the answer is the same every time", () => {
  const walls = [{ c: [100, 100, 200, 100], door: 1, ds: 1 }];
  const before = JSON.stringify(walls);
  const a = smokeOpeningsOf({ walls, ...G }), b = smokeOpeningsOf({ walls, ...G });
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(walls), before);
});

test("the scene's own square stands in for the cell size when none is given", () => {
  // grid 100, no cell: the cells are 100px, so the wall along y = 100 stands on rows 0 and 1 of columns 1 and 2.
  const o = smokeOpeningsOf({ walls: [{ c: [100, 100, 200, 100], door: 1, ds: 1 }], grid: 100, cols: 10, indoors: NOWHERE });
  assert.deepEqual(o, [1, 11]);
});

test("an opening really does vent the room it stands in", () => {
  const walls = [{ c: [0, 100, 100, 100], door: 1, ds: 1 }];
  const openings = smokeOpeningsOf({ walls, grid: 100, cell: 100, origin: { x: 0, y: 0 }, cols: 5, indoors: NOWHERE });
  assert.ok(openings.length, "the doorway names cells");
  const shut = run({ cells: room(1.5), sources: [], cols: 5, rows: 5, openings: [], room: 25 }, 6);
  const vented = run({ cells: room(1.5), sources: [], cols: 5, rows: 5, openings, room: 25 }, 6);
  assert.ok(mass(vented) < mass(shut) * 0.9, `${mass(vented)} < ${mass(shut)}`);
});

// ---- An open wall is an opening only where it leads OUT. ----

// A 10x10 grid of 100px cells. The house is columns 1-4, rows 1-4, and a partition runs down x = 300 inside it, so
// columns 1-2 are the taproom and columns 3-4 the back room. Everything else is out of doors.
const H = { grid: 100, cell: 100, origin: { x: 0, y: 0 }, cols: 10 };
const inHouse = (i) => { const c = i % 10, r = (i - c) / 10; return c >= 1 && c <= 4 && r >= 1 && r <= 4; };
const openDoor = (c) => ({ c, door: 1, ds: 1 });
const smashedWindow = (c) => ({ c, door: 0, flags: { animater: { breakWall: { broken: { kind: "window" } } } } });

test("a house wall's open door is an opening; an inside door between two rooms is not", () => {
  // The front door stands in the house's west wall, x = 100 between row 2's outdoor cell 20 and indoor cell 21.
  const front = smokeOpeningsOf({ walls: [openDoor([100, 200, 100, 300])], ...H, indoors: inHouse });
  assert.ok(front.includes(21), "the cell inside the front door stands open");
  // The inside door is in the partition at x = 300, between indoor cells 22 and 23. Both sides are rooms.
  assert.deepEqual(smokeOpeningsOf({ walls: [openDoor([300, 200, 300, 300])], ...H, indoors: inHouse }), [],
    "an inside door vents nothing: it carries the smoke next door instead");
  // Told apart on the SAME scene, and by nothing but which side is a room.
  const both = smokeOpeningsOf({ walls: [openDoor([100, 200, 100, 300]), openDoor([300, 200, 300, 300])], ...H, indoors: inHouse });
  assert.ok(both.includes(21) && !both.includes(23), JSON.stringify(both));
});

test("a broken window in an outside wall is an opening; in an inside wall it is not", () => {
  const outer = smokeOpeningsOf({ walls: [smashedWindow([100, 200, 100, 300])], ...H, indoors: inHouse });
  assert.ok(outer.includes(21));
  assert.deepEqual(smokeOpeningsOf({ walls: [smashedWindow([300, 200, 300, 300])], ...H, indoors: inHouse }), []);
  // The same for a window swung open rather than smashed.
  const swung = (c) => ({ c, door: 0, flags: { animater: { window: "glassWindow", windowOpen: true } } });
  assert.ok(smokeOpeningsOf({ walls: [swung([100, 200, 100, 300])], ...H, indoors: inHouse }).includes(21));
  assert.deepEqual(smokeOpeningsOf({ walls: [swung([300, 200, 300, 300])], ...H, indoors: inHouse }), []);
});

test("off the map is as far out as a cell can be: a door in the map's own edge still vents", () => {
  const edge = (i) => i % 10 === 0 ? true : inHouse(i);
  // x = 0 is the map's west edge: one side of this door is no cell at all.
  assert.ok(smokeOpeningsOf({ walls: [openDoor([0, 200, 0, 300])], ...H, indoors: edge }).includes(20));
});

test("with no indoors predicate nothing is an opening, so the smoke stays in", () => {
  const walls = [openDoor([100, 200, 100, 300]), smashedWindow([300, 200, 300, 300])];
  assert.deepEqual(smokeOpeningsOf({ walls, ...H }), [], "no predicate: it cannot tell an outside door from an inside one");
  for (const indoors of [null, undefined, true, "yes", {}]) {
    assert.deepEqual(smokeOpeningsOf({ walls, ...H, indoors }), [], JSON.stringify(indoors));
  }
  // The permissive reading is a caller's to ask for in so many words.
  assert.ok(smokeOpeningsOf({ walls, ...H, indoors: NOWHERE }).length > 0);
});
