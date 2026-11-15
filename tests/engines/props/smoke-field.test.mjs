import test from "node:test";
import assert from "node:assert/strict";
import { THICK, THIN, DROP_FLOOR, DENSITY_CAP, smokeStep, smokeTier, smokeUpdatesFor, smokeCellsOf, smokeOpeningsOf, wallStandsOpen, smokeWalls, frameStandsOpen } from "../../../scripts/engines/props/smoke-field.mjs";
import { blockingWalls } from "../../../scripts/engines/props/prop-walls.mjs";
import { CLOSING_WINDOWS, windowSenses, closesWindow } from "../../../scripts/engines/motion/window-state.mjs";
import { wallBreakUpdate } from "../../../scripts/engines/props/wall-break.mjs";
import { wallBetween } from "../../../scripts/engines/props/fire-rounds.mjs";

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

test("with no source a wisp settles out, and a cleared cell is dropped", () => {
  let cells = [{ i: 5, v: 0.5 }];
  for (let n = 0; n < 40; n++) cells = smokeStep({ cells, sources: [], cols: 5, rows: 5 }).cells;
  assert.deepEqual(cells, []);
});

// The whole reason the openings exist. A room with every way out shut keeps what it holds: smoke in still air has
// nowhere to disperse to, it only settles, and settling is slow. Opening one way out is what clears it, and the
// difference has to be plain within a fight's worth of rounds or shutting a window changes nothing a player sees.
// This is the behaviour that was wrong in play: a 10%-a-round fade emptied a sealed room on its own, so the doors
// and windows were decoration. Guard the gap, not the exact figures.
test("a shut room holds its smoke through a fight; one way out is what clears it", () => {
  const full = () => Array.from({ length: 25 }, (_, i) => ({ i, v: DENSITY_CAP }));
  const after = (openings, steps) => {
    let cells = full();
    for (let n = 0; n < steps; n++) cells = smokeStep({ cells, sources: [], cols: 5, rows: 5, openings, room: 25 }).cells;
    return Math.max(0, ...cells.map((c) => c.v));
  };
  // Twenty rounds is two minutes of game time — a long fight. Shut, the room is still blocking sight at the end.
  assert.ok(after([], 20) >= THICK, `shut after 20 rounds: ${after([], 20)}`);
  // The same twenty rounds with one door open leave it far thinner. Both figures may move with tuning; the gap is
  // the claim, so this asserts the ratio rather than either number.
  assert.ok(after([12], 20) < after([], 20) / 2, `open ${after([12], 20)} vs shut ${after([], 20)}`);
  // And the shut room is not sealed for ever — it settles out eventually, it just takes its time.
  assert.equal(after([], 400), 0);
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

test("a steady source reaches thick beside it in the long run, and a bigger rate is denser sooner", () => {
  const settle = (rate, steps) => run({ cells: [], sources: [{ i: 12, rate }], cols: 5, rows: 5 }, steps);
  assert.ok(settle(1, 60).find((c) => c.i === 13).v > THIN);
  // Compared BEFORE the cap, not after it. In a sealed room a settle rate of 2% no longer carries smoke off fast
  // enough for the source cell to balance below DENSITY_CAP, so by round 60 rate 1 and rate 2 both sit exactly at
  // the cap and the comparison says nothing. What a bigger rate buys is getting there sooner, which is what this
  // pins: at round 3 neither has capped and the denser source is plainly denser.
  const lo = settle(1, 3), hi = settle(2, 3);
  assert.ok(hi.find((c) => c.i === 12).v > lo.find((c) => c.i === 12).v,
    `${hi.find((c) => c.i === 12).v} > ${lo.find((c) => c.i === 12).v}`);
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
  // A cap-full room with one door open: the venting, not the settling, is what empties it. The bound is 60 rounds
  // (six minutes of game time) rather than the 40 it was, because settling now takes 2% a round instead of 10% and
  // the opening is doing nearly all the work. What matters is that an opened room clears in minutes; a sealed one
  // takes about 260 rounds, which is the next test's business.
  let cells = room(DENSITY_CAP), n = 0;
  while (cells.length && n < 100) { n++; cells = smokeStep({ cells, sources: [], cols: 5, rows: 5, openings: [12] }).cells; }
  assert.equal(cells.length, 0);
  assert.ok(n <= 60, `emptied in ${n}`);
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
    // 400 rounds, not the 200 it was: this room is SEALED, and a sealed room now loses only the 2% a round that
    // settles out of still air, so it takes about 260 rounds to empty from the cap instead of about 50. The point
    // of the test is unchanged — the store must not stall a decaying room at some rounded value for ever — and the
    // bound is still finite on purpose, so "never clears" would still fail here rather than hang.
    for (; rounds < 400 && Object.keys(smokeCellsOf(scene)).length; rounds++) {
      const step = smokeStep({ cells: toCells(smokeCellsOf(scene)), sources: [], cols: 5, rows: 5 });
      scene = applyTo(scene, smokeUpdatesFor(step, { scene }));
    }
    assert.ok(rounds < 400, `room at ${start} never cleared`);
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

test("underground, a door in the map's bottom edge vents like the other three", () => {
  // An underground scene: every cell is indoors, so the only thing that can make an opening is a side that is off the
  // map. A 10x10 grid of 100px cells, and a door lying in each of the four edges.
  const deep = { grid: 100, cell: 100, origin: { x: 0, y: 0 }, cols: 10, rows: 10, indoors: () => true };
  const door = (c) => [{ c, door: 1, ds: 1 }];
  assert.ok(smokeOpeningsOf({ walls: door([100, 0, 200, 0]), ...deep }).includes(1), "the top edge");
  assert.ok(smokeOpeningsOf({ walls: door([0, 100, 0, 200]), ...deep }).includes(10), "the west edge");
  assert.ok(smokeOpeningsOf({ walls: door([1000, 100, 1000, 200]), ...deep }).includes(19), "the east edge");
  assert.ok(smokeOpeningsOf({ walls: door([100, 1000, 200, 1000]), ...deep }).includes(91), "the bottom edge");
  // Without rows the bottom edge cannot be told from a row inside the map, so it does not vent. Documented, and the
  // safe way round: the smoke stays in rather than draining away through a wall that leads nowhere.
  const { rows, ...unbounded } = deep;
  assert.deepEqual(smokeOpeningsOf({ walls: door([100, 1000, 200, 1000]), ...unbounded }), []);
  assert.ok(smokeOpeningsOf({ walls: door([100, 0, 200, 0]), ...unbounded }).includes(1), "the top edge still does");
  // A silly rows is as good as none. (A numeric string is not silly: cols is read the same way.)
  assert.ok(smokeOpeningsOf({ walls: door([100, 1000, 200, 1000]), ...deep, rows: "10" }).includes(91));
  for (const bad of [0, -1, 2.5, null, undefined]) {
    assert.deepEqual(smokeOpeningsOf({ walls: door([100, 1000, 200, 1000]), ...deep, rows: bad }), [], JSON.stringify(bad));
  }
});

// ---- Smoke's own wall list: a closed window holds smoke in, an open one does not. ----
// The author's report: "when animater window is closed it should know that". It did not know EITHER state, because
// Animater never writes a window's openness onto the wall document, so prop-walls' blockingWalls — which judges a
// wall by its `move` and `sight` — gives smoke the identical list whether the window is shut, swung open, an empty
// frame or smashed. A shut window came out right by luck; the open ones came out wrong.
// These are driven through the REAL writers (wall-break.mjs for a smashed window, window-state.mjs for the kinds), so
// they cannot pass by agreeing with a literal copied out of the source.

// A window wall as a GM leaves it: an ordinary wall given an Animater window kind. Nothing about `move` or `sight`
// says anything about the window at all, and that is the point.
const WINDOW_WALL = { id: "win", c: [300, 200, 300, 300], door: 0, ds: 0, move: 20, sight: 20, light: 20, sound: 20 };
const windowWall = (animater) => ({ ...WINDOW_WALL, flags: { animater } });
const ids = (walls) => walls.map((w) => w.id);

// A smashed glass window built by the code that really smashes one, never by hand.
const brokenWindowDoc = () => {
  const up = wallBreakUpdate(windowWall({ window: "glassWindow" }), { kind: "window", material: "glass" });
  const flags = { window: "glassWindow" };
  for (const [k, v] of Object.entries(up)) {
    if (k === "flags.animater.windowOpen") flags.windowOpen = v;
    else if (k === "flags.animater.breakWall.broken") flags.breakWall = { broken: v };
    else if (k === "flags.animater.window") flags.window = v;
  }
  const doc = { ...WINDOW_WALL, flags: { animater: flags } };
  for (const k of ["move", "sight", "light", "sound"]) if (up[k] !== undefined) doc[k] = up[k];
  return doc;
};

test("a CLOSED window stands as a wall for smoke, exactly as the wall does", () => {
  // Every kind that shuts, shut: each holds the smoke in. This is the case the report was about.
  for (const kind of Object.keys(CLOSING_WINDOWS)) {
    assert.equal(wallStandsOpen(windowWall({ window: kind })), false, `${kind} shut is not an opening`);
    assert.deepEqual(ids(smokeWalls([windowWall({ window: kind })])), ["win"], `${kind} shut still walls smoke`);
    // Said outright: shut, and with the GM's openness flag explicitly false.
    assert.deepEqual(ids(smokeWalls([windowWall({ window: kind, windowOpen: false })])), ["win"]);
  }
  // A plain wall and a shut door are unchanged too, so nothing was loosened to let the windows through.
  assert.deepEqual(ids(smokeWalls([{ ...WINDOW_WALL, id: "plain", flags: {} }])), ["plain"]);
  assert.deepEqual(ids(smokeWalls([{ ...WINDOW_WALL, id: "shut", door: 1, ds: 0, flags: {} }])), ["shut"]);
  assert.deepEqual(ids(smokeWalls([{ ...WINDOW_WALL, id: "locked", door: 1, ds: 2, flags: {} }])), ["locked"]);
});

test("an OPEN window, an empty frame and a SMASHED one let smoke through", () => {
  // Swung open: every kind that opens.
  for (const kind of Object.keys(CLOSING_WINDOWS)) {
    assert.deepEqual(smokeWalls([windowWall({ window: kind, windowOpen: true })]), [], `${kind} open lets smoke by`);
  }
  // An empty frame, which a break leaves of a window that does not open.
  assert.deepEqual(smokeWalls([windowWall({ window: "open" })]), []);
  // Smashed, as wall-break.mjs really writes it. It keeps `move` deliberately — a body cannot climb through a broken
  // window — which is precisely why blockingWalls could not tell it from a whole one.
  const smashed = brokenWindowDoc();
  assert.ok(smashed.move > 0, "a smashed window still stops a body");
  assert.equal(wallStandsOpen(smashed), true);
  assert.deepEqual(smokeWalls([smashed]), []);
  // An open door was already let through, and still is.
  assert.deepEqual(smokeWalls([{ ...WINDOW_WALL, id: "door", door: 1, ds: 1, flags: {} }]), []);
});

test("the bug itself: blockingWalls cannot tell a window's state, so smoke needed its own list", () => {
  // The same wall in four states. blockingWalls keeps it in ALL of them: that is the defect, and it is why a shut
  // window was right only by accident. If this ever stops holding, the wall document has started carrying the
  // window's state and smokeWalls can be reconsidered.
  const states = [windowWall({ window: "glassWindow" }), windowWall({ window: "glassWindow", windowOpen: true }),
    windowWall({ window: "open" }), brokenWindowDoc()];
  for (const w of states) assert.deepEqual(ids(blockingWalls([w])), ["win"], "blockingWalls keeps every window state");
  // Smoke's list tells them apart: shut held, the other three let through.
  assert.deepEqual(states.map((w) => smokeWalls([w]).length), [1, 0, 0, 0]);
});

test("blockingWalls is left exactly as it was, so fire, wreckage, light, sight and sound do not move", () => {
  // smokeWalls is a narrowing of blockingWalls, never a change to it: for every wall that does NOT stand open the two
  // agree, and smokeWalls never returns a wall blockingWalls rejected.
  const walls = [
    { id: "solid", c: [0, 0, 1, 1], move: 20, sight: 20 },
    { id: "moveOnly", c: [0, 0, 1, 1], move: 20, sight: 0 },
    { id: "sightOnly", c: [0, 0, 1, 1], move: 0, sight: 20 },
    { id: "nothing", c: [0, 0, 1, 1], move: 0, sight: 0 },
    { id: "openDoor", c: [0, 0, 1, 1], move: 20, sight: 20, door: 1, ds: 1 },
    { id: "shutDoor", c: [0, 0, 1, 1], move: 20, sight: 20, door: 1, ds: 0 },
    windowWall({ window: "glassWindow" }),
    windowWall({ window: "glassWindow", windowOpen: true }),
  ];
  assert.deepEqual(ids(blockingWalls(walls)), ["solid", "moveOnly", "sightOnly", "shutDoor", "win", "win"]);
  // Smoke's list is that, less only the window standing open.
  assert.deepEqual(ids(smokeWalls(walls)), ["solid", "moveOnly", "sightOnly", "shutDoor", "win"]);
  const kept = new Set(ids(blockingWalls(walls)));
  for (const id of ids(smokeWalls(walls))) assert.ok(kept.has(id), `${id} was already a blocking wall`);
  // The prop's own walls are still excluded, by array or Set, as blockingWalls takes them.
  assert.deepEqual(ids(smokeWalls(walls, ["solid"])), ["moveOnly", "sightOnly", "shutDoor", "win"]);
  assert.deepEqual(ids(smokeWalls(walls, new Set(["solid", "moveOnly"]))), ["sightOnly", "shutDoor", "win"]);
  assert.deepEqual(smokeWalls(undefined), []);
});

test("shutters with only their slats open still hold the smoke: slats pass light, not air", () => {
  const slats = windowWall({ window: "shutterWindow", windowSlats: true });
  assert.equal(wallStandsOpen(slats), false);
  assert.deepEqual(ids(smokeWalls([slats])), ["win"]);
  // window-state agrees: shut with slats open, the wall still stops sound, and so it stops air.
  assert.ok(windowSenses("shutterWindow", false, true).sound > 0);
});

test("end to end: smoke crosses an open window and is held by a shut one", () => {
  // A 5x5 grid of 100px cells. Cells 12 and 13 sit either side of x = 300; the window wall runs down it.
  const COLS = 5, ROWS = 5, CELL = 100;
  const centre = (i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
  // Wired exactly as main.mjs does it: the wall list decides, and wallBetween asks whether one lies between the pair.
  const blockedFor = (walls) => (wallBetween(centre(12), centre(13), smokeWalls(walls)) ? [{ from: 12, to: 13 }] : []);
  const spread = (walls) => {
    const r = smokeStep({ cells: [{ i: 12, v: 3 }], sources: [], cols: COLS, rows: ROWS, blocked: blockedFor(walls) });
    return r.cells.find((c) => c.i === 13)?.v ?? 0;
  };
  // Shut: nothing reaches the far side.
  assert.equal(spread([windowWall({ window: "glassWindow" })]), 0);
  // Open, an empty frame, and smashed: smoke gets through.
  assert.ok(spread([windowWall({ window: "glassWindow", windowOpen: true })]) > 0);
  assert.ok(spread([windowWall({ window: "open" })]) > 0);
  assert.ok(spread([brokenWindowDoc()]) > 0);
  // And opening the window is the ONLY difference: with no wall at all the open window matches it.
  assert.equal(spread([windowWall({ window: "glassWindow", windowOpen: true })]), spread([]));
});

// ---- The frames that never close: a lattice and a grate are holes, not glass. ----
// The second half of the same bug. The wall configuration calls an empty frame, a wooden lattice and iron bars
// "always open" in its own words, but wallStandsOpen asked only for "open", so a lattice and a grate held smoke as
// though they were glazed. Two separate questions, both pinned here: smoke must get THROUGH them (smokeWalls), and
// they must count as an OPENING where they lead outdoors (smokeOpeningsOf).

// Every fixed kind the wall configuration offers, split by whether anything fills it. The filled ones are the guard
// against the tempting wrong rule, "any kind not in CLOSING_WINDOWS": these are not in it either and must stay shut.
const NEVER_CLOSES = ["open", "lattice", "bars"];
const FILLED_FIXED = ["", "glass", "shuttered", "curtained", "slit"];

test("a frame nothing fills is an opening: an empty frame, a lattice and a grate alike", () => {
  for (const kind of NEVER_CLOSES) {
    assert.equal(frameStandsOpen(kind), true, kind);
    assert.equal(wallStandsOpen(windowWall({ window: kind })), true, `${kind} stands open with no state to read`);
    // It never closes, so the GM's openness flag is beside the point either way.
    assert.equal(wallStandsOpen(windowWall({ window: kind, windowOpen: false })), true, `${kind} cannot be shut`);
  }
});

test("a frame something fills is not an opening, so the CLOSING_WINDOWS complement is NOT the rule", () => {
  for (const kind of FILLED_FIXED) {
    // None of these shuts either — they are simply filled — so "does not shut" would wrongly open every one.
    assert.equal(closesWindow(kind), false, `${kind} is not a kind that shuts`);
    assert.equal(frameStandsOpen(kind), false, `${kind} has something in it`);
    assert.equal(wallStandsOpen(windowWall({ window: kind })), false, `${kind} holds the smoke in`);
    assert.deepEqual(ids(smokeWalls([windowWall({ window: kind })])), ["win"], `${kind} still walls smoke`);
  }
  // A kind nobody has heard of is filled, not open: an unknown kind never loses a room its smoke.
  assert.equal(frameStandsOpen("portcullis"), false);
  assert.equal(frameStandsOpen(undefined), false);
  assert.equal(frameStandsOpen(null), false);
  // And every kind that DOES shut is shut until it is opened.
  for (const kind of Object.keys(CLOSING_WINDOWS)) assert.equal(frameStandsOpen(kind), false, kind);
});

test("question one: smoke gets THROUGH a lattice and a grate", () => {
  for (const kind of NEVER_CLOSES) {
    assert.deepEqual(smokeWalls([windowWall({ window: kind })]), [], `${kind} does not wall smoke`);
  }
  // End to end, wired as main.mjs wires it: cells 12 and 13 either side of the wall down x = 300.
  const COLS = 5, ROWS = 5, CELL = 100;
  const centre = (i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 });
  const spread = (walls) => {
    const blocked = wallBetween(centre(12), centre(13), smokeWalls(walls)) ? [{ from: 12, to: 13 }] : [];
    const r = smokeStep({ cells: [{ i: 12, v: 3 }], sources: [], cols: COLS, rows: ROWS, blocked });
    return r.cells.find((c) => c.i === 13)?.v ?? 0;
  };
  for (const kind of NEVER_CLOSES) {
    assert.ok(spread([windowWall({ window: kind })]) > 0, `smoke crosses ${kind}`);
    // As freely as if the wall were not there at all.
    assert.equal(spread([windowWall({ window: kind })]), spread([]), `${kind} is a hole`);
  }
  // A glazed one, and an arrow slit, still hold it.
  assert.equal(spread([windowWall({ window: "glassWindow" })]), 0);
  assert.equal(spread([windowWall({ window: "slit" })]), 0);
});

test("question two: a lattice or a grate in an outside wall COUNTS as an opening", () => {
  // A 10-wide grid of 50px cells. The wall runs down x = 100 from y = 100 to y = 200: the line between columns 1 and
  // 2, over rows 2 and 3. The room is the four cells to its RIGHT (columns 2 and 3 of those rows); column 1 is out of
  // doors, so a frame in that wall leads out.
  const g = { grid: 100, cell: 50, origin: { x: 0, y: 0 }, cols: 10, rows: 10 };
  const inHouse = (i) => [22, 23, 32, 33].includes(i);
  const outer = [100, 100, 100, 200];
  const ventedBy = (kind, indoors) => smokeOpeningsOf({ walls: [{ c: outer, door: 0, flags: { animater: { window: kind } } }], ...g, indoors });
  for (const kind of NEVER_CLOSES) {
    const o = ventedBy(kind, inHouse);
    assert.ok(o.includes(22) && o.includes(32), `${kind} vents the room it stands in (${o})`);
  }
  // Filled kinds vent nothing at all.
  for (const kind of FILLED_FIXED) assert.deepEqual(ventedBy(kind, inHouse), [], `${kind} vents nothing`);
  // Inside the house a lattice joins two rooms and does NOT vent: the smoke goes next door, not out of the model.
  const inside = [{ c: [150, 100, 150, 200], door: 0, flags: { animater: { window: "lattice" } } }];
  assert.deepEqual(smokeOpeningsOf({ walls: inside, ...g, indoors: () => true }), []);
  // And a room really does empty faster through a grate than through glass.
  const clearIn = (kind) => {
    const openings = ventedBy(kind, inHouse);
    let cells = Array.from({ length: 25 }, (_, i) => ({ i, v: 1.5 }));
    for (let n = 1; n <= 80; n++) { cells = smokeStep({ cells, sources: [], cols: 5, rows: 5, openings }).cells; if (!cells.length) return n; }
    return Infinity;
  };
  assert.ok(clearIn("bars") < clearIn("glassWindow"), `${clearIn("bars")} rounds through a grate, ${clearIn("glassWindow")} through glass`);
});
