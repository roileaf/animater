// The smoke round, driven end to end over a fake scene: what it decides to write, and what it refuses to write.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { smokeRoundPlan, smokeLevelFor, smokeShapes, smokeNeighbours, smokeOnlySave, smokeRoomAt, smokeClearPlan, smokeRunsOn, smokeHeldBy, smokeLeftovers, createSmokeAlarm, SMOKE_NOTE, ROOM_CAP } from "../../../scripts/engines/props/smoke-round.mjs";
import { THICK, THIN, smokeOpeningsOf } from "../../../scripts/engines/props/smoke-field.mjs";
import { smokeRegionPlan, smokeRegionSave } from "../../../scripts/engines/props/smoke-regions.mjs";
import { quietSave } from "../../../scripts/engines/props/quiet-writes.mjs";
import { viewedRegions } from "../../../scripts/core/viewed-regions.mjs";
import { propSceneFieldsHTML, smokeLightFieldHTML } from "../../../scripts/ui/prop-config.mjs";

const A = "aaaaaaaaaaaaaaaa", B = "bbbbbbbbbbbbbbbb";
// A 10x10 scene of 100px squares. The room is columns 1-5, rows 1-5; everything else is out of doors.
const COLS = 10, ROWS = 10, CELL = 100;
const scene = ({ smoke = null, grid = null, on = true, levels = [], width = 1000, height = 1000, size = CELL } = {}) => ({
  id: "scene0000000000z",
  dimensions: { width, height, size },
  levels,
  flags: { animater: { smokeFills: on, ...(smoke ? { smoke } : {}), ...(grid ? { smokeGrid: grid } : {}) } },
});
const inRoom = (i) => { const c = i % COLS, r = (i - c) / COLS; return c >= 1 && c <= 5 && r >= 1 && r <= 5; };
// Walls all round the room, with a doorway where `door` says (a pair of touching cells smoke may pass between).
const walledWith = (door = null) => (i, n) => {
  if (inRoom(i) === inRoom(n)) return false;
  return !(door && ((door[0] === i && door[1] === n) || (door[0] === n && door[1] === i)));
};
const sealed = walledWith(null);
const roomOf = () => ({ id: "room", size: 25 });
const FIRE = [{ i: 33, rate: 1, levels: [] }]; // the middle of the room
const plan = (args) => smokeRoundPlan({ activeGM: true, on: true, indoors: inRoom, walled: sealed, roomOf, ...args });
// Run the round over and over, feeding each round's cells back as the scene's saved smoke.
const burn = (rounds, { sources = FIRE, walled = sealed, start = null, openings = [], openSide = () => false } = {}) => {
  let smoke = start, last = null;
  for (let n = 0; n < rounds; n++) {
    last = plan({ scene: scene({ smoke, grid: smoke ? { cols: COLS, cell: CELL } : null }), sources, walled, openings, openSide });
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
  // Worked out by hand, not read back off the plan. One round on an empty sealed room: the source puts SOURCE (2) x
  // rate (1) into its own cell, each of the four touching cells takes SPREAD (0.1) of the 2 that stands between it
  // and the full one, so 0.2 goes out of 33 four times over, and what is left settles by FADE (0.02): a sealed room
  // vents nothing. (2 - 4 x 0.2) x 0.98 = 1.176, and the flag stores four decimals.
  assert.equal(p.fields["flags.animater.smoke.33"], 1.176);
  assert.equal(p.fields["flags.animater.smoke.32"], 0.196); // 0.2 x 0.98
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
  // This room is sealed, so nothing vents and only settling (FADE, 2% a round) takes the smoke away: it clears in
  // hundreds of rounds, not tens. The bound is finite on purpose — what is under test is that the cells and the
  // geometry beside them are both cleared when the last of it goes, not how long that takes.
  while (Object.keys(smoke).length && rounds < 400) {
    rounds++;
    p = plan({ scene: scene({ smoke, grid: { cols: COLS, cell: CELL, level: A }, levels: [{ id: A }] }), sources: [] });
    smoke = Object.fromEntries(p.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  }
  assert.ok(rounds < 400, `cleared in ${rounds} rounds`);
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

// THE agreed figure for a sealed room, pinned to the number and not to "at least": a 5x5 room with one burning square
// gives FIVE thick cells at fifteen rounds. It is the shape of the fill (the fire's own cell and the four it touches)
// as much as a count, and if a change moves it somebody should have to come and look at this line deliberately.
test("a sealed room fills with thick smoke; a doorway drains it", () => {
  const shut = burn(15);
  assert.equal(shut.cells.filter((c) => c.v >= THICK).length, 5, "five thick cells at fifteen rounds");
  assert.deepEqual(shut.openings, [], "a sealed room has no opening");
  // 35 is the room's east edge and 36 is out of doors: with no wall between them that is the doorway. A gap in the
  // wall is not enough on its own — the roof's own outline is sealed, since it is drawn by hand around a building
  // whose walls are the enclosure — so this is the room marked as standing open at its sides.
  assert.deepEqual(burn(15, { walled: walledWith([35, 36]) }).openings, [], "a gap alone is not a way out");
  const open = burn(15, { walled: walledWith([35, 36]), openSide: () => true });
  assert.deepEqual(open.openings, [35], "an open-sided roof breathes out where the wall has a gap");
  const peak = (p) => Math.max(0, ...p.cells.map((c) => c.v));
  assert.ok(peak(open) < peak(shut), `open ${peak(open)} < shut ${peak(shut)}`);
});

test("the smoke never crosses out of its room, however long it burns", () => {
  const p = burn(30, { walled: walledWith([35, 36]) });
  assert.ok(p.cells.every((c) => inRoom(c.i)), "every cell is in the room");
  assert.ok(p.shapes.every((s) => s.x >= 100 && s.x + s.width <= 600 && s.y >= 100 && s.y + s.height <= 600));
});

// ---- A great hall with a burning closet off it: two rooms that must be stepped apart. ----
// Rows 1-5 of columns 1-5 are the hall (25 cells, sealed). Row 7, columns 1-3 is the closet (3 cells), open to the
// outside at its east end. Nothing else is indoors, and no wall is shared: the two never touch.
const HALL = new Set(), CLOSET = new Set([71, 72, 73]);
for (let r = 1; r <= 5; r++) for (let c = 1; c <= 5; c++) HALL.add(r * COLS + c);
const rooms = (gap) => ({
  indoors: (i) => HALL.has(i) || CLOSET.has(i),
  // `gap` opens the closet's east end on the passage outside; everything else is walled in.
  walled: (i, n) => {
    const a = HALL.has(i) ? "hall" : CLOSET.has(i) ? "closet" : "out", b = HALL.has(n) ? "hall" : CLOSET.has(n) ? "closet" : "out";
    if (a === b) return false;
    return !(gap && ((i === 73 && n === 74) || (i === 74 && n === 73)));
  },
  roomOf: (i) => (HALL.has(i) ? { id: "hall", size: 25 } : CLOSET.has(i) ? { id: "closet", size: 3 } : { id: "out", size: 1 }),
  // The closet is the one standing open at its east end, so its roof is marked open-sided; the hall is a proper
  // walled room. Without the mark the gap is no way out at all: a roof's own outline is sealed by default, because
  // it is drawn by hand around a building whose WALLS are the enclosure and it steps across squares where it runs
  // diagonally. The hall would answer the same either way, having no gap to breathe through.
  openSide: (i) => CLOSET.has(i),
});
const twoRooms = rooms(true);
const FIRES = [{ i: 33, rate: 1, levels: [] }, { i: 73, rate: 1, levels: [] }];

test("each room is stepped on its own: the closet's opening never vents the hall", () => {
  const both = smokeRoundPlan({ activeGM: true, on: true, scene: scene(), ...twoRooms, sources: FIRES });
  assert.deepEqual(both.rooms.map((r) => [r.id, r.size, r.openings]), [["hall", 25, []], ["closet", 3, [73]]]);
  // The hall alone, with no closet burning at all, must come out exactly the same: the closet cannot reach it.
  const alone = smokeRoundPlan({ activeGM: true, on: true, scene: scene(), ...twoRooms, sources: [FIRES[0]] });
  const hallOf = (p) => p.cells.filter((c) => HALL.has(c.i)).map((c) => [c.i, c.v]);
  assert.deepEqual(hallOf(both), hallOf(alone));
  assert.equal(both.fields["flags.animater.smoke.33"], 1.176, "the sealed hall vents nothing, closet or no closet");
  // And the closet is vented by its own 1-in-3 share, not by the hall's 25 cells.
  const shut = smokeRoundPlan({ activeGM: true, on: true, scene: scene(), ...rooms(false), sources: FIRES });
  const keeps = (p) => p.cells.find((c) => c.i === 73).v;
  assert.ok(keeps(both) < keeps(shut) * 0.75, `open closet keeps ${keeps(both)}, shut ${keeps(shut)}`);
});

test("neither room's smoke ever leaks into the other, nor out of doors", () => {
  const run = (how) => {
    let smoke = null, p = null;
    for (let n = 0; n < 25; n++) {
      p = smokeRoundPlan({ activeGM: true, on: true, ...how, scene: scene({ smoke, grid: smoke ? { cols: COLS, cell: CELL } : null }), sources: FIRES });
      smoke = Object.fromEntries(p.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
    }
    return p;
  };
  const p = run(twoRooms);
  assert.ok(p.cells.every((c) => HALL.has(c.i) || CLOSET.has(c.i)), "nothing anywhere else");
  assert.ok(p.cells.some((c) => HALL.has(c.i) && c.v >= THICK), "the sealed hall still fills");
  // The open closet holds plainly less than the same closet shut, round after round.
  const mass = (p_, where) => p_.cells.filter((c) => where.has(c.i)).reduce((s, c) => s + c.v, 0);
  assert.ok(mass(p, CLOSET) < mass(run(rooms(false)), CLOSET) * 0.6, `open ${mass(p, CLOSET)}`);
  assert.equal(mass(p, HALL).toFixed(6), mass(run(rooms(false)), HALL).toFixed(6), "the hall is untouched either way");
});

// ---- A cave larger than the walk will go: one room all the same, with no seam in it. ----
// 60 x 40 of open floor, every cell indoors, no walls at all: 2400 cells against a cap of 1200.
const CAVE = { cols: 60, rows: 40 };
const caveRoom = (cache) => (i) => smokeRoomAt({ from: i, ...CAVE, cache });

test("a space bigger than the walk is one room, not pieces with seams between them", () => {
  const cache = new Map(), roomAt = caveRoom(cache);
  assert.ok(CAVE.cols * CAVE.rows > ROOM_CAP, "the cave really is over the cap");
  // The walk gives up at the cap exactly, never one cell past it.
  const first = roomAt(0);
  assert.equal(first.size, ROOM_CAP);
  assert.equal(cache.size, ROOM_CAP, "the cap is the cap");
  // A cell the first walk never reached answers to the same name, so the pieces are one room.
  const far = [...Array(CAVE.cols * CAVE.rows).keys()].find((i) => !cache.has(i));
  assert.ok(far !== undefined, "there is floor the first walk never reached");
  assert.equal(roomAt(far).id, first.id, "no second room, and so no seam");
  // Every cell of the cave names the one room.
  const names = new Set([...Array(CAVE.cols * CAVE.rows).keys()].map((i) => roomAt(i).id));
  assert.deepEqual([...names], [first.id]);
});

test("smoke crosses where a truncated walk used to leave a seam", () => {
  const cache = new Map(), roomAt = caveRoom(cache);
  // Find a pair of touching cells the walk puts in different pieces: that is where the false wall would have stood.
  roomAt(0);
  const seam = [...Array(CAVE.cols * CAVE.rows).keys()]
    .flatMap((i) => smokeNeighbours(i, CAVE.cols, CAVE.rows).filter((n) => n > i && cache.has(i) !== cache.has(n)).map((n) => [i, n]))[0];
  assert.ok(seam, "the walk really does stop part way across this cave");
  const caveScene = { id: "cave000000000000", dimensions: { width: CAVE.cols * CELL, height: CAVE.rows * CELL, size: CELL }, levels: [], flags: { animater: { smokeFills: true } } };
  // A fire on the near side of that seam, run until its smoke reaches across.
  let smoke = null, p = null;
  for (let n = 0; n < 20; n++) {
    p = smokeRoundPlan({ activeGM: true, on: true, sources: [{ i: seam[0], rate: 4, levels: [] }],
      scene: { ...caveScene, flags: { animater: { smokeFills: true, ...(smoke ? { smoke, smokeGrid: { cols: CAVE.cols, cell: CELL } } : {}) } } },
      roomOf: caveRoom(cache) });
    smoke = Object.fromEntries(p.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  }
  assert.equal(p.rooms.length, 1, "the whole cave is one group");
  assert.ok(p.cells.some((c) => c.i === seam[1]), `the smoke crosses from ${seam[0]} to ${seam[1]}`);
});

test("one room is one group, and the same scene groups the same way every tick", () => {
  // Underground, where every cell counts as indoors and no roomOf is given, the lot is one room.
  const deep = smokeRoundPlan({ activeGM: true, on: true, scene: scene(), sources: [{ i: 33, rate: 1, levels: [] }] });
  assert.deepEqual(deep.rooms.map((r) => [r.id, r.size]), [["", COLS * ROWS]]);
  // Every indoor cell lands in exactly one group, and the groups come out in the same order each time.
  const once = () => smokeRoundPlan({ activeGM: true, on: true, scene: scene(), ...twoRooms,
    sources: [{ i: 71, rate: 1, levels: [] }, { i: 33, rate: 1, levels: [] }] }).rooms.map((r) => r.id);
  assert.deepEqual(once(), ["hall", "closet"]);
  assert.deepEqual(once(), once());
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

test("the round's own write back is not a scene edit; a real one is", () => {
  const note = { animater: { smokeFills: true } };
  // What the round writes, flat and (as the update hook may hand it over) nested, with the deletion marker too.
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1.08, "flags.animater.smokeGrid.cols": 10 }, note), true);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.-=33": null, "flags.animater.-=smokeGrid": null }, note), true);
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": {} , _id: "x", _stats: {} }, note), true);
  assert.equal(smokeOnlySave({ flags: { animater: { smoke: { 33: 1 }, smokeGrid: { cols: 10 } } } }, note), true);
  // A real edit by the GM, even carried in the same update, is an edit: the room sizes must go.
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1, width: 2000 }, note), false);
  assert.equal(smokeOnlySave({ "flags.animater.smokeFills": false }, note), false, "the GM's own switch is an edit");
  assert.equal(smokeOnlySave({ flags: { animater: { smoke: {} }, core: {} } }, note), false);
  // Nested is the shape the updateScene hook really hands over, so a real edit riding along in it must be caught
  // too: EVERY own key has to be one of ours, not merely one of them.
  assert.equal(smokeOnlySave({ flags: { animater: { smoke: {}, smokeFills: false } } }, note), false);
  assert.equal(smokeOnlySave({ flags: { animater: { smokeGrid: { cols: 10 }, foulWater: true } } }, note), false);
  // And with no note it is somebody else's write, whatever it touches.
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, {}), false);
  assert.equal(smokeOnlySave({}, note), false);
});

// ---- The two guards that really are about main.mjs's own text. ----
const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");

test("the smoke runs on the fire's own round: there is still only the one interval", () => {
  assert.equal([...main.matchAll(/setInterval\(fireTick/g)].length, 1);
  assert.equal([...main.matchAll(/setInterval\(/g)].filter((m) => main.slice(m.index - 200, m.index).includes("smoke")).length, 0);
  assert.match(main, /await smokeRound\(scene, burning\)/);
});

test("the room sizes survive the round's own write and go on a real scene edit", () => {
  // quietSave is what the cache's hook asks, and the round's own scene write must be forgiven there. It is one
  // imported composition now, so that is asserted on the real function rather than read off main.mjs's text.
  assert.equal(quietSave({ documentName: "Scene" }, { "flags.animater.smoke.33": 1.08 }, SMOKE_NOTE), true);
  assert.equal(quietSave({ documentName: "Scene" }, { "flags.animater.smoke.33": 1.08, width: 2000 }, SMOKE_NOTE), false);
  const hook = main.split(/\r?\n/).find((l) => l.includes("smokeRooms = new Map(); });"));
  assert.match(hook, /if \(!quietSave\(first, changes, options\)\)/, "a real edit still clears it");
  const list = main.split(/\r?\n/)[main.split(/\r?\n/).indexOf(hook) - 1];
  for (const name of ["updateScene", "deleteScene", "updateWall", "updateRegion", "canvasReady"]) assert.ok(list.includes(`"${name}"`), name);
});

// Was: "the smoke never reads the scene's regions raw", which required viewedRegions here. That requirement was WRONG
// for this code and has been withdrawn. viewedRegions filters on a region's `viewed`, which needs the scene's own
// `_view`; only the canvas scene has one, so on every other scene it returns nothing — and the round runs on every
// scene with a fire on it. The real rule, which this now guards, is that the smoke picks regions by what they ARE:
// their own flag, and the level they name. (The project's actual guard on loose region reads,
// tests/core/viewed-regions.test.mjs, bans a loop over canvas?.scene?.regions and is untouched by any of this.)
test("the smoke picks regions by their flag and their level, never by whether a client is looking", () => {
  const from = main.indexOf("// ---- The smoke a fire fills"), to = main.indexOf("// The ticker: every scene with both switches on");
  const smoke = main.slice(from, to);
  assert.ok(from >= 0 && to > from);
  assert.doesNotMatch(smoke, /viewedRegions\(/, "a drawing helper has no business on a scene nobody is looking at");
  // Every region the round reads goes through the level filter first, and is chosen by flag from there.
  // The gathering itself moved to smoke-gather.mjs, where smoke-gather.test.mjs drives the real thing over a fake
  // scene; what is left here is the Foundry looking-up it is handed, and every region read still goes through the
  // level filter and is chosen by a flag.
  // Both lists go through the level filter, which is now worked out once for the two of them (onLevel).
  assert.match(smoke, /const onLevel = \(\) => \(here \?\?= regionsOnLevel\(scene\.regions, level\)\);/);
  assert.match(smoke, /indoorPolygonsOf\(onLevel\(\), regionAreas\)/);
  assert.match(smoke, /skyRegionsOf\(onLevel\(\)\)/);
  assert.match(smoke, /const work = smokeShapeOf\(scene, geo, level, deep\);/);
  assert.match(smoke, /smokeRegionPlan\(scene\.regions, shapes, \{ level, visioner: smokeConceals\(\) \}\)/);
  // The order of the region writes is the plan's, applied by one loop, so there is nothing here to put the wrong way
  // round; and nothing catches a refused removal, because it has to stop the creation behind it.
  assert.match(smoke, /for \(const step of plan\.steps\) \{/);
  assert.doesNotMatch(smoke.slice(smoke.indexOf("async function smokeRegionNow")), /EmbeddedDocuments\("Region"[^\n]*\.catch/);
  // And viewedRegions is still used where something really is drawn on the canvas scene.
  assert.match(main, /const regionsHere = \(\) => viewedRegions\(canvas\?\.scene\?\.regions\);/);
});

test("both switches are off by default and the scene's says what the smoke does", () => {
  const off = propSceneFieldsHTML({});
  assert.match(off, /name="flags\.animater\.smokeFills"/);
  assert.doesNotMatch(off, /smokeFills"[^>]*checked/);
  assert.match(off, /[Tt]hick smoke blocks sight/);
  assert.match(off, /thin smoke conceals/);
  assert.match(propSceneFieldsHTML({ smokeFills: true }), /smokeFills"[^>]*checked/);
  // A fire light's own, likewise unticked, and a THIRD name again (smokeSource): never the scene's, never the
  // settings pair's. It is a function in ui/ beside the scene's field, so this is run, not read out of main.mjs.
  const light = smokeLightFieldHTML();
  assert.match(light, /Fills the room with smoke/);
  assert.match(light, /name="flags\.animater\.smokeSource"/);
  assert.doesNotMatch(light, /smokeSource"[^>]*checked/);
  assert.match(smokeLightFieldHTML({ on: true }), /smokeSource"[^>]*checked/);
});

// ---- Clearing: every path by which the smoke must stop existing. ----

test("a scene whose grid has stopped making sense is cleared, not abandoned", () => {
  const smoke = { 33: 2, 34: 1 }, grid = { cols: COLS, cell: CELL, level: A };
  for (const dimensions of [null, {}, { width: 1000, height: 1000, size: 0 }, { width: 0, height: 1000, size: CELL }, { width: 1000, height: NaN, size: CELL }]) {
    const broken = { ...scene({ smoke, grid }), dimensions };
    const p = plan({ scene: broken, sources: FIRE });
    assert.ok(p, "a plan, not an abandoned round: " + JSON.stringify(dimensions));
    // The cells go by name, the geometry beside them goes by name, and with no shapes the region goes too.
    assert.deepEqual(p.fields, { "flags.animater.smoke.-=33": null, "flags.animater.smoke.-=34": null, "flags.animater.-=smokeGrid": null });
    assert.deepEqual(p.cells, []);
    assert.deepEqual(p.shapes, []);
    assert.equal(p.level, null);
    // Nothing writes the whole flag: Foundry would merge it and strand what was there.
    for (const key of Object.keys(p.fields)) assert.ok(!/\.smoke$|\.smokeGrid$/.test(key), key);
  }
});

test("an unreadable grid still writes nothing for a scene that holds no smoke", () => {
  const p = plan({ scene: { ...scene(), dimensions: null }, sources: FIRE });
  assert.deepEqual(p.fields, {});
  assert.deepEqual(p.shapes, []);
});

test("smokeClearPlan takes off whatever a scene holds, and nothing it does not", () => {
  const both = smokeClearPlan(scene({ smoke: { 7: 1.5, 8: 0.4 }, grid: { cols: COLS, cell: CELL, level: A } }));
  assert.deepEqual(both.fields, { "flags.animater.smoke.-=7": null, "flags.animater.smoke.-=8": null, "flags.animater.-=smokeGrid": null });
  assert.deepEqual(both.shapes, []);
  assert.equal(both.level, null);
  // A stored zero or a junk entry is still a key on the scene and still has to go.
  assert.deepEqual(smokeClearPlan(scene({ smoke: { 7: 0, 8: "x" } })).fields, { "flags.animater.smoke.-=7": null, "flags.animater.smoke.-=8": null });
  // Geometry with no cells, and a scene with neither.
  assert.deepEqual(smokeClearPlan(scene({ grid: { cols: COLS, cell: CELL } })).fields, { "flags.animater.-=smokeGrid": null });
  assert.deepEqual(smokeClearPlan(scene()).fields, {});
  assert.deepEqual(smokeClearPlan(null).fields, {});
});

test("a wall of the room's own that stands open vents it, wherever in the room it stands", () => {
  // 33 is the middle of the sealed room: no cell of it touches the sky, so only the walls' own list can open it.
  const shut = burn(10);
  const held = Object.fromEntries(shut.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  const quiet = plan({ scene: scene({ smoke: held, grid: { cols: COLS, cell: CELL } }), sources: [] });
  const vented = plan({ scene: scene({ smoke: held, grid: { cols: COLS, cell: CELL } }), sources: [], openings: [33] });
  assert.deepEqual(quiet.openings, [], "sealed, with nothing open");
  assert.deepEqual(vented.openings, [33], "the smashed window inside the room");
  const mass = (cells) => cells.reduce((sum, c) => sum + c.v, 0);
  assert.ok(mass(vented.cells) < mass(quiet.cells) * 0.95, mass(vented.cells) + " < " + mass(quiet.cells));
});

test("an open wall of another room, or off the grid, never vents this one", () => {
  const held = Object.fromEntries(burn(10).cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  const sc = () => scene({ smoke: held, grid: { cols: COLS, cell: CELL } });
  // 88 is out of doors, 7 is in no room of ours, -1 and 100000 are not cells at all.
  for (const openings of [[88], [7], [-1], [100000], ["33"], [null]]) {
    assert.deepEqual(plan({ scene: sc(), sources: [], openings }).openings, [], JSON.stringify(openings));
  }
});

test("a room with no source left empties on its own, cells, geometry and shapes", () => {
  let smoke = Object.fromEntries(burn(20).cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  assert.ok(Object.keys(smoke).length, "the room is full");
  let p = null, rounds = 0;
  // Sealed again, so this is settling alone at 2% a round: hundreds of rounds, not the 120 it was. The claim is
  // that the room does empty and takes its geometry, shapes and level with it when it does.
  while (Object.keys(smoke).length && rounds < 500) {
    rounds++;
    p = plan({ scene: scene({ smoke, grid: { cols: COLS, cell: CELL, level: A }, levels: [{ id: A }] }), sources: [] });
    smoke = Object.fromEntries(p.cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  }
  assert.ok(rounds < 500, "emptied in " + rounds + " rounds");
  assert.equal(p.fields["flags.animater.-=smokeGrid"], null, "the geometry goes with the last cell");
  assert.deepEqual(p.shapes, [], "and the concealment region with it");
  assert.equal(p.level, null);
});

// ---- The smoke may run only while all three of its switches are on, and is cleared the moment one goes off. ----
// Behavioural, over the pure modules: the round rides the FIRE round's tick, and the fire round visits only scenes
// with Breakable props AND Fire spreads on (fire-rounds.mjs fireScenesOf). Untick either with a room full and nothing
// would ever visit that scene again, so the cells, the geometry, the concealment region and — worst — the clients'
// sight-blocking fence would stand for ever, blinding the players in a room with no smoke drawn in it.

const switched = (own = {}) => ({ ...scene({ smoke: { 33: 2, 34: 1 }, grid: { cols: COLS, cell: CELL, level: A } }),
  flags: { animater: { smokeFills: true, breakableProps: true, fireSpreads: true, smoke: { 33: 2, 34: 1 }, smokeGrid: { cols: COLS, cell: CELL, level: A }, ...own } } });
const CLEARED = { "flags.animater.smoke.-=33": null, "flags.animater.smoke.-=34": null, "flags.animater.-=smokeGrid": null };

test("every one of the three switches has to be on for the smoke to run", () => {
  assert.equal(smokeRunsOn(switched()), true);
  for (const off of ["smokeFills", "breakableProps", "fireSpreads"]) {
    assert.equal(smokeRunsOn(switched({ [off]: false })), false, off + " off");
    assert.equal(smokeRunsOn(switched({ [off]: undefined })), false, off + " unset");
  }
  assert.equal(smokeRunsOn(null), false);
  assert.equal(smokeRunsOn({}), false);
});

test("a scene with stored cells and Fire spreads off clears on its next round, region and geometry with it", () => {
  const sc = switched({ fireSpreads: false });
  // The round's own gate is smokeRunsOn, so this is the decision main.mjs reaches with that scene.
  const p = smokeRoundPlan({ activeGM: true, on: smokeRunsOn(sc), scene: sc, sources: FIRE, indoors: inRoom, walled: sealed, roomOf });
  assert.deepEqual(p.fields, CLEARED, "the cells AND the geometry, each by name");
  assert.deepEqual(p.shapes, [], "no shapes, so the caller takes the concealment region away");
  assert.equal(p.level, null);
  assert.deepEqual(p.cells, [], "and nothing is put back");
  // Nothing writes a whole object flag: Foundry merges those and would strand what was there.
  for (const key of Object.keys(p.fields)) assert.ok(!/\.smoke$|\.smokeGrid$/.test(key), key);
});

test("the same for Breakable props off, and for the smoke's own switch", () => {
  for (const off of ["breakableProps", "smokeFills"]) {
    const sc = switched({ [off]: false });
    const p = smokeRoundPlan({ activeGM: true, on: smokeRunsOn(sc), scene: sc, sources: FIRE, indoors: inRoom, walled: sealed, roomOf });
    assert.deepEqual(p.fields, CLEARED, off);
    assert.deepEqual(p.shapes, [], off);
  }
});

test("the round still reaches a scene the fire round has stopped visiting", () => {
  // This is the half the clearing depends on: the fire round's list would not include these scenes at all.
  const dead = switched({ fireSpreads: false }), live = switched(), empty = { ...switched({ fireSpreads: false }), flags: { animater: { fireSpreads: false } } };
  const ids = (list) => list.map((x) => x.id);
  assert.deepEqual(ids(smokeLeftovers([dead], { activeGM: true })), [dead.id], "switches off with smoke stored: listed");
  assert.deepEqual(smokeLeftovers([live], { activeGM: true }), [], "still running: the fire round has it");
  assert.deepEqual(smokeLeftovers([empty], { activeGM: true }), [], "nothing stored: nothing to clear");
  assert.deepEqual(smokeLeftovers([dead], { activeGM: false }), [], "only the active GM writes");
  assert.deepEqual(smokeLeftovers(null, { activeGM: true }), []);
  // Once its round has cleared it, it is not listed again: that is what stops this running for ever.
  const cleaned = { ...dead, flags: { animater: { smokeFills: true, breakableProps: true, fireSpreads: false } } };
  assert.deepEqual(smokeLeftovers([cleaned], { activeGM: true }), []);
});

test("a scene is held by its geometry alone, or by a stored zero, as surely as by a density", () => {
  const held = (own) => smokeHeldBy({ flags: { animater: own } });
  assert.equal(held({ smoke: { 3: 1.5 } }), true);
  assert.equal(held({ smokeGrid: { cols: 10, cell: 100 } }), true, "geometry with no cells is still state");
  assert.equal(held({ smoke: { 3: 0 } }), true, "a stored zero is a key that is really there");
  assert.equal(held({ smoke: { 3: "x" } }), true, "and so is a junk entry");
  assert.equal(held({ smoke: {} }), false);
  assert.equal(held({}), false);
  assert.equal(smokeHeldBy(null), false);
});

// ---- The one thing no CHEAP test reaches. ----
// Everything else about main.mjs's smoke is now tested through the pure modules above (the plan, the openings, the
// clear, the thinning). What is left is only WHICH pure call main.mjs makes at each of its four call sites. That is
// not beyond testing — tests/project/integration.test.mjs imports main.mjs for real — but it needs that file's heavy
// fake-Foundry harness, and that file is one of the two slow ones. So this is read off the source as a cost trade,
// and holds nothing the pure tests already cover.
test("main.mjs wires its four call sites to the pure decisions, and to nothing else", () => {
  // The round: all three switches as its gate, the openings told which side is a room, the sky and the openings in.
  assert.match(main, /on = smokeRunsOn\(scene\)/);
  assert.match(main, /smokeOpeningsOf\(\{ walls: scene\.walls\?\.contents \?\? \[\], cell, origin, cols, rows, indoors \}\)/);
  assert.match(main, /smokeRoundPlan\(\{ activeGM, on, scene, sources, indoors, walled, openings, sky,/);
  // The leftover pass, on the same tick, so a scene the fire round has dropped is still cleared.
  assert.match(main, /for \(const scene of smokeLeftovers\(game\.scenes\?\.contents \?\? \[\], \{ activeGM: true \}\)\)/);
  // Repair, and the quench, each through the pure plan and each waiting out a round in flight on the ONE wait.
  assert.match(main, /await clearSmokeNow\(scene\);/);
  assert.match(main, /quenchSmokeUpdate\(scene, area\.testPoint, storedSmokeGrid/);
  assert.equal([...main.matchAll(/await afterFireRound\(scene\);/g)].length, 2, "Repair and the quench, one mechanism");
  const quench = main.slice(main.indexOf("async function quenchWrite"), main.indexOf("async function receiveQuench"));
  assert.match(quench, /await afterFireRound\(scene\);/, "the quench waits on the one mechanism");
  assert.doesNotMatch(quench, /fireRunning\.has/, "and keeps no poll of its own");
  // Only the active GM writes, every `-=` goes through withDeletes, and no smoke write keeps a clock or a coin.
  const clear = main.slice(main.indexOf("async function clearSmokeNow"), main.indexOf("// The ticker: every scene with both switches on"));
  assert.match(clear, /game\.users\?\.activeGM\?\.isSelf !== true\) return;/);
  assert.match(clear, /withDeletes\(plan\.fields, propDel\(\)\)/);
  // It holds the scene while it writes, so no round can start under it, and lets it go however it ends.
  assert.match(clear, /fireRunning\.add\(scene\.id\);[\s\S]{0,40}try \{/);
  assert.match(clear, /\} finally \{ fireRunning\.delete\(scene\.id\); \}/);
  const smoke = main.slice(main.indexOf("// ---- The smoke a fire fills"), main.indexOf("// The ticker: every scene with both switches on"));
  assert.doesNotMatch(smoke, /Math\.random\(|Date\.now\(/);
  assert.doesNotMatch(smoke, /sceneOpenings\(/, "the drafts' list is a different list for a different job");
});


// ---- An inside door is not a vent. ----

// A two-room inn in the same 10x10 scene: the whole of columns 1-5, rows 1-5, with a partition on x = 300 (the line
// between columns 2 and 3). The taproom is columns 1-2, the back room columns 3-5, and the door between them, in row
// 3, stands open. Open doors do not block, so the two rooms are ALREADY one room to the walk and the smoke crosses
// the doorway by itself; the question is only whether the doorway also vents.
const DOOR = [32, 33]; // col 2 / col 3 of row 3, the pair the inside door stands between
const innWalled = (i, n) => {
  if (inRoom(i) !== inRoom(n)) return true; // the inn's outside walls, all shut
  const ci = i % COLS, cn = n % COLS;
  if (Math.min(ci, cn) === 2 && Math.max(ci, cn) === 3) return !(DOOR.includes(i) && DOOR.includes(n));
  return false;
};
const INN_WALLS = [{ c: [300, 300, 300, 400], door: 1, ds: 1 }]; // the inside door, open, in row 3
const INN_GEO = { grid: CELL, cell: CELL, origin: { x: 0, y: 0 }, cols: COLS };
const TAP_FIRE = [{ i: 22, rate: 1, levels: [] }]; // a fire in the taproom

test("an inn with its inside door open fills with smoke instead of staying clear", () => {
  // The openings as main.mjs really asks for them: handed the round's own indoors, so the inside door is no vent.
  const right = smokeOpeningsOf({ walls: INN_WALLS, ...INN_GEO, indoors: inRoom });
  assert.deepEqual(right, [], "an inside door leads nowhere out");
  // What the wall-only list used to give: the cells either side of that door, vented as though they led outside.
  const wrong = smokeOpeningsOf({ walls: INN_WALLS, ...INN_GEO, indoors: () => false });
  assert.deepEqual(wrong.filter(inRoom).sort((a, b) => a - b), DOOR, "the bug's own list");

  const filled = burn(15, { sources: TAP_FIRE, walled: innWalled, openings: right });
  const inert = burn(15, { sources: TAP_FIRE, walled: innWalled, openings: wrong });
  const thick = (p) => p.cells.filter((c) => c.v >= THICK).length;
  const mass = (p) => p.cells.reduce((sum, c) => sum + c.v, 0);
  // THE agreed figures for the inn, pinned to the number: six thick cells and 18.2532 of smoke in all at fifteen
  // rounds, against three thick and 7.4018 when that inside doorway was vented as though it led outside.
  // (They were 5/12.7698 and 1/5.2568 while a sealed cell lost 10% a round. Both sides of the comparison rose when
  // settling dropped to 2%, which is the point of that change; the GAP is what this test is for, and the four
  // assertions below it hold it open.)
  assert.equal(thick(filled), 6, "the inn fills");
  assert.equal(Math.round(mass(filled) * 10000) / 10000, 18.2532, "and holds exactly this much smoke");
  assert.equal(thick(inert), 3, "the bug's own answer, kept so the difference cannot quietly close");
  assert.equal(Math.round(mass(inert) * 10000) / 10000, 7.4018);
  assert.ok(thick(filled) > thick(inert), `${thick(filled)} thick against ${thick(inert)} when the doorway vented`);
  assert.ok(mass(filled) > mass(inert) * 1.3, `${mass(filled)} against ${mass(inert)}`);
  // And the smoke still gets next door through the open doorway, which is what a doorway is for: the back room is
  // smoking by round 15 and hazy enough to conceal by round 20, having come through that one pair of cells.
  assert.ok(filled.cells.filter((c) => c.i % COLS >= 3).length >= 3, "the back room is smoking");
  const later = burn(20, { sources: TAP_FIRE, walled: innWalled, openings: right });
  assert.ok(later.cells.some((c) => c.i % COLS >= 3 && c.v >= THIN), "the back room hazes over");
});

test("a hole in the roof is an opening of its own, with both sides indoors", () => {
  const held = Object.fromEntries(burn(10).cells.map((c) => [String(c.i), Math.round(c.v * 10000) / 10000]));
  const sc = () => scene({ smoke: held, grid: { cols: COLS, cell: CELL } });
  const shut = plan({ scene: sc(), sources: [] });
  const shaft = plan({ scene: sc(), sources: [], sky: (i) => i === 33 });
  assert.deepEqual(shut.openings, [], "a sealed room with no shaft");
  assert.deepEqual(shaft.openings, [33], "the cell under the shaft vents upward");
  const mass = (p) => p.cells.reduce((sum, c) => sum + c.v, 0);
  assert.ok(mass(shaft) < mass(shut) * 0.95, `${mass(shaft)} < ${mass(shut)}`);
  // A sky over nothing, and a predicate that throws, both leave the room sealed.
  assert.deepEqual(plan({ scene: sc(), sources: [], sky: () => false }).openings, []);
  assert.deepEqual(plan({ scene: sc(), sources: [], sky: () => { throw new Error("no shape"); } }).openings, []);
});

// ---- The leftover pass on a scene the canvas has not drawn. ----
// This is the case the pass exists for, and the one where `viewed` was guaranteed to fail rather than merely likely to.

test("a non-active scene with a switch off loses its region along with its cells and its flag", () => {
  const sc = switched({ fireSpreads: false });
  // Its regions as they really read when nobody is standing in that scene: `viewed` false on every one of them.
  const mine = { id: "mine", viewed: false, levels: [], shapes: [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100 }],
    behaviors: [], flags: { animater: { smokeRegion: true } } };
  assert.deepEqual(viewedRegions([mine]), [], "the drawing helper finds nothing here");
  // The round's decision: everything stored comes off, and no shapes at all.
  const p = smokeRoundPlan({ activeGM: true, on: smokeRunsOn(sc), scene: sc, sources: FIRE, indoors: inRoom, walled: sealed, roomOf });
  assert.deepEqual(p.fields, CLEARED, "the cells and the geometry, each by name");
  assert.deepEqual(p.shapes, []);
  // And those empty shapes take the region away, which they could not do while it was looked for through `viewed`.
  const region = smokeRegionPlan([mine], p.shapes, { level: p.level });
  assert.deepEqual([region.remove, region.create, region.update], [["mine"], [], []]);
  assert.deepEqual(region.steps, [{ kind: "remove", ids: ["mine"] }]);
  // So after that pass the scene holds nothing of ours, and smokeHeldBy agrees it need not be visited again.
  assert.equal(smokeHeldBy({ flags: { animater: { smokeFills: true, breakableProps: true, fireSpreads: false } } }), false);
});

// ---- The round's own writes wake nothing, including the region one. ----
// THE composition, imported (quiet-writes.mjs quietSave), not a copy of it. A copy here was the gap: it could have
// gone on passing while main.mjs lost a clause, which is the whole reason this is one exported function now.
// The room cache — and with it the working set: the indoor answers, the wall answers, the sky answers — is emptied
// whenever this says a write was a real edit.
const asQuietSave = quietSave;
// The round's OWN note, imported and never rebuilt here: a test that wrote its own copy would go on passing if the
// marker moved, which is the very fault SMOKE_MARK and smokeOnlySave are kept side by side to prevent.
const NOTE = SMOKE_NOTE;
const OURS = { documentName: "Region", id: "mine", flags: { animater: { smokeRegion: true } } };

test("the round's own region write is not a GM redrawing a region", () => {
  // What smokeRegionPlan really asks for, round after round, as the footprint grows and shrinks.
  assert.equal(asQuietSave(OURS, { _id: "mine", shapes: [{ type: "rectangle", x: 0, y: 0, width: 100, height: 100 }], levels: [] }, NOTE), true);
  assert.equal(asQuietSave(OURS, { _id: "mine", shapes: [] }, NOTE), true, "shapes alone");
  assert.equal(asQuietSave(OURS, { _id: "mine", levels: [A] }, NOTE), true, "levels alone");
  assert.equal(asQuietSave(OURS, { _id: "mine", shapes: [], levels: [], _stats: {} }, NOTE), true, "_id and _stats ride along");
  // Creating and deleting our own region: Foundry hands those over as (document, options, userId), so the options
  // arrive where an update's changes would, and the document's own flag says it is ours.
  assert.equal(asQuietSave(OURS, NOTE, "user000000000000"), true, "created, or deleted");
});

test("a GM really redrawing a region still wakes everything", () => {
  // Our own note, but a field the round never writes: a real edit riding along must not be forgiven.
  assert.equal(asQuietSave(OURS, { _id: "mine", shapes: [], name: "Smoke?" }, NOTE), false, "a renamed region");
  assert.equal(asQuietSave(OURS, { _id: "mine", behaviors: [] }, NOTE), false, "its behaviours changed");
  assert.equal(asQuietSave(OURS, { _id: "mine", visibility: 2, shapes: [] }, NOTE), false);
  assert.equal(asQuietSave(OURS, { _id: "mine" }, NOTE), false, "nothing of ours changed at all");
  // Somebody else's write, whatever it touches, and somebody else's region under our note.
  assert.equal(asQuietSave(OURS, { _id: "mine", shapes: [] }, {}), false, "no note");
  assert.equal(asQuietSave(OURS, { _id: "mine", shapes: [] }, { animater: { decorBreak: true } }), false, "another feature's note");
  const theirs = { documentName: "Region", id: "theirs", flags: {} };
  assert.equal(asQuietSave(theirs, NOTE, "user000000000000"), false, "a region of theirs created under our note");
  // And a Region write is never read as a Scene one, nor the other way about.
  assert.equal(asQuietSave({ documentName: "Scene" }, { _id: "mine", shapes: [] }, NOTE), false);
});

test("the room cache and the whole working set live through a round, and go on a real edit", () => {
  // Stand in for main.mjs's hook: anything that is not one of the round's own writes empties the lot.
  let work = new Map([["sceneA", { key: "x", rooms: new Map([[0, { id: "r", size: 25 }]]), walled: new Map([[0, true]]) }]]);
  const sawWrite = (first, changes, options) => { if (!asQuietSave(first, changes, options)) work = new Map(); };
  // Fifteen rounds of a fire: the cells on the scene and the region beside them, over and over.
  for (let round = 0; round < 15; round++) {
    sawWrite({ documentName: "Scene" }, { "flags.animater.smoke.33": 1.08, "flags.animater.smokeGrid.cols": COLS }, NOTE);
    sawWrite(OURS, { _id: "mine", shapes: [{ type: "rectangle", x: round * 100, y: 0, width: 100, height: 100 }], levels: [] }, NOTE);
  }
  assert.equal(work.size, 1, "the flood fill is not re-run every tick");
  assert.equal(work.get("sceneA").rooms.size, 1);
  assert.equal(work.get("sceneA").walled.size, 1, "nor are the wall answers thrown away");
  // A GM moving a wall, or redrawing a region by hand: now it all goes.
  sawWrite({ documentName: "Wall" }, {}, {});
  assert.equal(work.size, 0);
});

// ---- What the round says when it cannot run: once per scene, and nothing at all when it works. ----
// smokeThrew had no test. The code was right, but moving `told.add` after the warning would have restored per-round
// notification spam with the whole suite green — and a feature that throws every few seconds for twenty rounds would
// have given the GM twenty notifications.

test("a throwing round is said out loud once per scene, however many rounds throw", () => {
  const said = [], told = [], traced = [];
  const alarm = createSmokeAlarm({ trace: (m) => traced.push(m), warn: (m, e) => said.push([m, e]), notify: (m) => told.push(m) });
  const ship = { id: "scene0000000000z", name: "Ship Crash" };
  const boom = new TypeError("Cannot add property parent, object is not extensible");
  for (let round = 0; round < 20; round++) alarm(ship, "smoke round", boom);
  // ONE warning and ONE notification, for twenty throwing rounds.
  assert.equal(said.length, 1, `${said.length} warnings for twenty rounds`);
  assert.equal(told.length, 1, `${told.length} notifications for twenty rounds`);
  assert.match(said[0][0], /Ship Crash/, "the scene is named, so the GM knows where to look");
  assert.equal(said[0][1], boom, "and the error itself goes to the console");
  assert.match(told[0], /Ship Crash/);
  // But traced every time: a log is for reading afterwards.
  assert.equal(traced.length, 20);
  assert.match(traced[0], /smoke round: Cannot add property parent/);
});

test("a second scene gets its own warning, and a scene with no name is named by its id", () => {
  const said = [], told = [];
  const alarm = createSmokeAlarm({ warn: (m) => said.push(m), notify: (m) => told.push(m) });
  alarm({ id: "aaaaaaaaaaaaaaaa", name: "Ship Crash" }, "smoke round", new Error("one"));
  alarm({ id: "bbbbbbbbbbbbbbbb", name: "The Inn" }, "smoke round", new Error("two"));
  alarm({ id: "aaaaaaaaaaaaaaaa", name: "Ship Crash" }, "smoke round", new Error("again"));
  assert.equal(said.length, 2, "one each, and no more");
  assert.match(said[0], /Ship Crash/);
  assert.match(said[1], /The Inn/);
  assert.equal(told.length, 2);
  // No name: the id, so there is always something to go on. And two nameless scenes are still two scenes.
  const bare = [];
  const quiet = createSmokeAlarm({ warn: (m) => bare.push(m) });
  quiet({ id: "cccccccccccccccc" }, "smoke left behind", new Error("x"));
  quiet({ id: "dddddddddddddddd" }, "smoke left behind", new Error("x"));
  quiet({ id: "cccccccccccccccc" }, "smoke left behind", new Error("x"));
  assert.equal(bare.length, 2);
  assert.match(bare[0], /cccccccccccccccc/);
});

test("a round that works says nothing at all, and an alarm with no voices breaks nothing", () => {
  let spoke = 0;
  createSmokeAlarm({ warn: () => spoke++, notify: () => spoke++, trace: () => spoke++ });
  assert.equal(spoke, 0, "making one says nothing; only a throw does");
  // Every voice is optional, because a reporter nobody passed loses a MESSAGE, not the feature.
  assert.doesNotThrow(() => createSmokeAlarm()({ id: "s" }, "smoke round", new Error("x")));
  assert.doesNotThrow(() => createSmokeAlarm({})(null, "smoke round", new Error("x")), "even with no scene at all");
  // A notification that itself throws (no interface yet, early in the load) must not take the round down with it.
  const traced = [];
  const brittle = createSmokeAlarm({ trace: (m) => traced.push(m), notify: () => { throw new Error("no ui"); } });
  assert.doesNotThrow(() => brittle({ id: "s", name: "Hall" }, "smoke round", new Error("x")));
  assert.equal(traced.length, 1);
});

test("main.mjs builds the alarm from this client's three voices and keeps no counting of its own", () => {
  assert.match(main, /const smokeThrew = createSmokeAlarm\(\{/);
  assert.match(main, /trace: \(message\) => runtime\?\.trace\("props", message\),/);
  assert.match(main, /notify: \(message\) => ui\?\.notifications\?\.warn\(message\),/);
  assert.ok(!/const smokeBroke = /.test(main), "the remembering is the alarm's, not main.mjs's");
  // Both round loops report through it.
  assert.match(main, /catch \(e\) \{ smokeThrew\(scene, "smoke round", e\); \}/);
  assert.match(main, /catch \(e\) \{ smokeThrew\(scene, "smoke left behind", e\); \}/);
});
