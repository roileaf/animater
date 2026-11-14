// The smoke round, driven end to end over a fake scene: what it decides to write, and what it refuses to write.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { smokeRoundPlan, smokeLevelFor, smokeShapes, smokeNeighbours } from "../../../scripts/engines/props/smoke-round.mjs";
import { THICK, THIN } from "../../../scripts/engines/props/smoke-field.mjs";
import { propSceneFieldsHTML } from "../../../scripts/ui/prop-config.mjs";

const A = "aaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbb";
// A 10x10 scene of 100px squares. The room is columns 1-5, rows 1-5; everything else is out of doors.
const COLS = 10, ROWS = 10, CELL = 100;
const scene = ({ smoke = null, grid = null, on = true, levels = [], width = 1000, height = 1000, size = CELL } = {}) => ({
  id: "scene0000000000z",
  dimensions: { width, height, size },
  levels,
  flags: { animater: { roomSmoke: on, ...(smoke ? { smoke } : {}), ...(grid ? { smokeGrid: grid } : {}) } },
});
const inRoom = (i) => { const c = i % COLS, r = (i - c) / COLS; return c >= 1 && c <= 5 && r >= 1 && r <= 5; };
// Walls all round the room, with a doorway where `door` says (a pair of touching cells smoke may pass between).
const walledWith = (door = null) => (i, n) => {
  if (inRoom(i) === inRoom(n)) return false;
  return !(door && ((door[0] === i && door[1] === n) || (door[0] === n && door[1] === i)));
};
const sealed = walledWith(null);
const roomOf = () => 25;
const FIRE = [{ i: 33, rate: 1, levels: [] }]; // the middle of the room
const plan = (args) => smokeRoundPlan({ activeGM: true, on: true, indoors: inRoom, walled: sealed, roomOf, ...args });
// Run the round over and over, feeding each round's cells back as the scene's saved smoke.
const burn = (rounds, { sources = FIRE, walled = sealed, start = null } = {}) => {
  let smoke = start, last = null;
  for (let n = 0; n < rounds; n++) {
    last = plan({ scene: scene({ smoke, grid: smoke ? { cols: COLS, cell: CELL } : null }), sources, walled });
    smoke = Object.fromEntries(last.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  }
  return last;
};

test("a round writes its cells, and the geometry they were indexed with, beside them", () => {
  const p = plan({ scene: scene(), sources: [{ i: 33, rate: 1, levels: [A] }] });
  assert.ok(p, "the active GM plans a round");
  // The fire's own cell and the four it bleeds into, nothing out of doors.
  assert.deepEqual(p.cells.map((c) => c.i).sort((a, b) => a - b), [23, 32, 33, 34, 43]);
  assert.ok(p.cells.every((c) => inRoom(c.i)));
  assert.equal(p.fields["flags.animater.smoke.33"], Math.round(p.cells.find((c) => c.i === 33).v * 10000) / 10000);
  assert.equal(p.fields["flags.animater.smokeGrid.cols"], COLS);
  assert.equal(p.fields["flags.animater.smokeGrid.cell"], CELL);
  assert.equal(p.fields["flags.animater.smokeGrid.level"], A);
  assert.equal(p.level, A);
  // Nothing writes the whole flag: every key is its own path, so Foundry merges them.
  for (const key of Object.keys(p.fields)) assert.notEqual(key, "flags.animater.smokeGrid");
  assert.ok(!("flags.animater.smoke" in p.fields));
});

test("the geometry is only written when it changes, so an unchanged round is quiet", () => {
  const grid = { cols: COLS, cell: CELL, level: A };
  const p = plan({ scene: scene({ smoke: { 33: 1 }, grid, levels: [{ id: A }] }), sources: [{ i: 33, rate: 1, levels: [A] }] });
  assert.ok(!("flags.animater.smokeGrid.cols" in p.fields));
  assert.ok(!("flags.animater.smokeGrid.level" in p.fields));
});

test("a cell that cleared is deleted by key, not left behind at zero", () => {
  // 97 is out of doors and 44 is a room cell the round no longer holds: both must go.
  const p = plan({ scene: scene({ smoke: { 33: 1, 44: 0.0001, 97: 2 }, grid: { cols: COLS, cell: CELL } }), sources: FIRE });
  assert.equal(p.fields["flags.animater.smoke.-=97"], null);
  assert.equal(p.fields["flags.animater.smoke.-=44"], null);
  assert.ok(!("flags.animater.smoke.-=33" in p.fields));
});

test("with the switch off everything the smoke left is taken away", () => {
  const p = smokeRoundPlan({ activeGM: true, on: false, scene: scene({ smoke: { 33: 2, 34: 1 }, grid: { cols: COLS, cell: CELL, level: A }, on: false }) });
  assert.deepEqual(p.fields, { "flags.animater.smoke.-=33": null, "flags.animater.smoke.-=34": null, "flags.animater.-=smokeGrid": null });
  assert.deepEqual(p.cells, []);
  assert.deepEqual(p.shapes, []);
});

test("the fire going out clears the cells and the geometry with them", () => {
  let p = burn(12);
  assert.ok(p.cells.length, "the room is smoking");
  let smoke = Object.fromEntries(p.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  let rounds = 0;
  while (Object.keys(smoke).length && rounds < 60) {
    rounds++;
    p = plan({ scene: scene({ smoke, grid: { cols: COLS, cell: CELL, level: A }, levels: [{ id: A }] }), sources: [] });
    smoke = Object.fromEntries(p.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  }
  assert.ok(rounds < 60, `cleared in ${rounds} rounds`);
  assert.equal(p.fields["flags.animater.-=smokeGrid"], null);
  assert.deepEqual(p.shapes, []);
});

test("a client that is not the active GM writes nothing at all", () => {
  for (const on of [true, false]) {
    assert.equal(smokeRoundPlan({ activeGM: false, on, scene: scene({ smoke: { 33: 2 } }), sources: FIRE, indoors: inRoom, walled: sealed, roomOf }), null);
  }
  assert.equal(smokeRoundPlan({ on: true, scene: scene(), sources: FIRE }), null, "no say at all is no write");
});

test("an outdoor fire fills nothing", () => {
  const p = plan({ scene: scene(), sources: [{ i: 88, rate: 4, levels: [] }] });
  assert.deepEqual(p.cells, []);
  assert.deepEqual(p.fields, {});
});

test("a sealed room fills with thick smoke; a doorway drains it", () => {
  const shut = burn(15);
  assert.ok(shut.cells.filter((c) => c.v >= THICK).length >= 5, `${shut.cells.filter((c) => c.v >= THICK).length} thick`);
  assert.deepEqual(shut.openings, [], "a sealed room has no opening");
  // 35 is the room's east edge and 36 is out of doors: with no wall between them that is the doorway.
  const open = burn(15, { walled: walledWith([35, 36]) });
  assert.deepEqual(open.openings, [35], "the room breathes out where the wall has a gap");
  const peak = (p) => Math.max(0, ...p.cells.map((c) => c.v));
  assert.ok(peak(open) < peak(shut), `open ${peak(open)} < shut ${peak(shut)}`);
});

test("the smoke never crosses out of its room, however long it burns", () => {
  const p = burn(30, { walled: walledWith([35, 36]) });
  assert.ok(p.cells.every((c) => inRoom(c.i)), "every cell is in the room");
  assert.ok(p.shapes.every((s) => s.x >= 100 && s.x + s.width <= 600 && s.y >= 100 && s.y + s.height <= 600));
});

test("the region's shapes cover the smoke at or above thin, a run of cells to a rectangle", () => {
  const cells = [{ i: 11, v: 1 }, { i: 12, v: 1 }, { i: 13, v: 1 }, { i: 22, v: THIN / 2 }, { i: 31, v: 2 }];
  assert.deepEqual(smokeShapes(cells, { cols: COLS, cell: CELL, origin: { x: 0, y: 0 } }), [
    { type: "rectangle", x: 100, y: 100, width: 300, height: 100 },
    { type: "rectangle", x: 100, y: 300, width: 100, height: 100 },
  ]);
});

test("a resized scene starts the room clear instead of sliding old smoke under new squares", () => {
  const was = { cols: 8, cell: CELL };
  // 11 and 12 were written against a narrower grid and mean nothing now; the round starts the room clear.
  const p = plan({ scene: scene({ smoke: { 11: 2, 12: 2 }, grid: was }), sources: FIRE });
  assert.equal(p.fields["flags.animater.smoke.-=11"], null);
  assert.equal(p.fields["flags.animater.smoke.-=12"], null);
  assert.equal(p.fields["flags.animater.smokeGrid.cols"], COLS);
  assert.ok(p.cells.every((c) => c.v < 2), "nothing of the old field is kept");
  assert.ok(!p.cells.some((c) => c.i === 11 || c.i === 12));
});

test("the level is the one the sources stand on, not the scene's default", () => {
  const multi = { id: "s", levels: [{ id: A }, { id: B }], initialLevel: { id: A }, flags: {} };
  assert.equal(smokeLevelFor(multi, [{ levels: [B] }]), B, "a cellar light records its smoke in the cellar");
  assert.equal(smokeLevelFor(multi, []), A, "with no source at all the scene's own first level stands");
  // Most sources win; a tie goes to the scene's own level order, so the same scene always picks the same floor.
  assert.equal(smokeLevelFor(multi, [{ levels: [B] }, { levels: [B] }, { levels: [A] }]), B);
  assert.equal(smokeLevelFor(multi, [{ levels: [B] }, { levels: [A] }]), A);
  // Once written it stays, so a field already indexed on one floor never jumps.
  const written = { ...multi, flags: { animater: { smokeGrid: { level: B } } } };
  assert.equal(smokeLevelFor(written, [{ levels: [A] }]), B);
  // A level the scene no longer has, and anything that is not a document id, name nothing.
  assert.equal(smokeLevelFor({ ...multi, flags: { animater: { smokeGrid: { level: "gone" } } } }, [{ levels: ["nope"] }]), A);
  assert.equal(smokeLevelFor({ levels: [] }, []), null);
});

test("a round through the plan carries that level onto the region", () => {
  const p = plan({ scene: scene({ levels: [{ id: A }, { id: B }] }), sources: [{ i: 33, rate: 1, levels: [B] }] });
  assert.equal(p.level, B);
  assert.equal(p.fields["flags.animater.smokeGrid.level"], B);
});

test("the four cells touching one are its own, and never off the grid", () => {
  assert.deepEqual(smokeNeighbours(0, COLS, ROWS).sort((a, b) => a - b), [1, 10]);
  assert.deepEqual(smokeNeighbours(99, COLS, ROWS).sort((a, b) => a - b), [89, 98]);
  assert.equal(smokeNeighbours(33, COLS, ROWS).length, 4);
});

// ---- The two guards that really are about main.mjs's own text. ----
const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");

test("the smoke runs on the fire's own round: there is still only the one interval", () => {
  assert.equal([...main.matchAll(/setInterval\(fireTick/g)].length, 1);
  assert.equal([...main.matchAll(/setInterval\(/g)].filter((m) => main.slice(m.index - 200, m.index).includes("smoke")).length, 0);
  assert.match(main, /await smokeRound\(scene, burning\)/);
});

test("the smoke never reads the scene's regions raw", () => {
  const from = main.indexOf("// ---- The smoke a fire fills"), to = main.indexOf("// The ticker: every scene with both switches on");
  const smoke = main.slice(from, to);
  assert.ok(from >= 0 && to > from);
  assert.equal([...smoke.matchAll(/\.regions/g)].length, [...smoke.matchAll(/viewedRegions\(scene\.regions\)/g)].length);
});

test("both switches are off by default and the scene's says what the smoke does", () => {
  const off = propSceneFieldsHTML({});
  assert.match(off, /name="flags\.animater\.roomSmoke"/);
  assert.doesNotMatch(off, /roomSmoke"[^>]*checked/);
  assert.match(off, /[Tt]hick smoke blocks sight/);
  assert.match(off, /thin smoke conceals/);
  assert.match(propSceneFieldsHTML({ roomSmoke: true }), /roomSmoke"[^>]*checked/);
  // A fire light's own, likewise unticked.
  assert.match(main, /Fills the room with smoke/);
  assert.match(main, /name="flags\.\$\{ID\}\.roomSmoke"\$\{flags\.roomSmoke === true \? " checked" : ""\}/);
});
