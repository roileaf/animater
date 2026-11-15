// The round driven END TO END over a fake scene: the REAL gathering (smoke-gather.mjs, which main.mjs now only hands
// its Foundry lookups to), the REAL geometry helpers main.mjs passes it, and the REAL round decision. Nothing here
// re-implements anything; the fakes are the scene, its walls and its rooms, which is all main.mjs would have fetched.
//
// This file exists because of one bug. The gathering lived inside main.mjs, so in practice it was pinned by
// source-text regexes — a cheap test cannot import main.mjs, only the slow integration harness can, so a regex was the
// affordable option — and a regex cannot see that two keys of one object collide. One did: a seeded
// `rooms: new Map()` was spread over by a built `rooms: [polygon]`, that array reached smokeRoomAt as its `cache`,
// `cache?.get(from)` threw on the first indoor cell of every burning round, main.mjs traced the throw away, and the
// whole feature was silently dead while 1604 tests passed. A key collision, a wrong shape or a swallowed throw must
// fail THIS file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { smokeGathering, smokeWorkKey } from "../../../scripts/engines/props/smoke-gather.mjs";
import { smokeRoundPlan, smokeRoomAt, smokeLevelFor, smokeHeldBy, smokeRunsOn } from "../../../scripts/engines/props/smoke-round.mjs";
import { smokeSourcesOf, smokeOpeningsOf, smokeCellsOf, THICK } from "../../../scripts/engines/props/smoke-field.mjs";
import { smokeGridOf } from "../../../scripts/engines/props/smoke-edges.mjs";
import { smokeRegionPlan } from "../../../scripts/engines/props/smoke-regions.mjs";
// The two geometry tests main.mjs injects, the real ones.
import { pointInPolygon } from "../../../scripts/engines/fragments/fragments.mjs";
import { wallBetween } from "../../../scripts/engines/props/fire-rounds.mjs";
import { blockingWalls } from "../../../scripts/engines/props/prop-walls.mjs";

// A 10x10 scene of 100px squares. The room is a rectangle over columns 1-5, rows 1-5; everything else is out of doors.
const CELL = 100, COLS = 10;
const ROOM = [{ x: 100, y: 100 }, { x: 600, y: 100 }, { x: 600, y: 600 }, { x: 100, y: 600 }];
const BOX = [
  { c: [100, 100, 600, 100], move: 1, sight: 1, door: 0 },
  { c: [600, 100, 600, 600], move: 1, sight: 1, door: 0 },
  { c: [600, 600, 100, 600], move: 1, sight: 1, door: 0 },
  { c: [100, 600, 100, 100], move: 1, sight: 1, door: 0 },
];
const FIRE = [{ rect: { x: 300, y: 300, w: 100, h: 100 } }]; // a burning prop in the middle of the room

const fakeScene = ({ smoke = null, grid = null, walls = BOX, rooms = [ROOM], sides = [], deep = false } = {}) => ({
  id: "scene0000000000z",
  dimensions: { width: 1000, height: 1000, size: CELL },
  levels: [],
  walls: { contents: walls },
  rooms, sides, deep, // what main.mjs would have found through the regions; handed to the thunks below
  // The scene's three switches, by their real names: "Fires fill rooms with smoke", and the two the fire round
  // itself needs, since the smoke rides its tick (smoke-round.mjs smokeRunsOn).
  flags: { animater: { smokeFills: true, breakableProps: true, fireSpreads: true,
    ...(smoke ? { smoke } : {}), ...(grid ? { smokeGrid: grid } : {}) } },
});

// EXACTLY what main.mjs does, with its Foundry lookups replaced by the fake scene's own fields and nothing else:
// smokeShapeOf's four injections, then the round. If main.mjs and this drift apart the wiring guard in
// smoke-round.test.mjs says so; what this drives is the gathering and the round themselves.
const shapeOf = (scene, geo, level, cache) => smokeGathering({
  cache, sceneId: scene.id, geo, level, deep: scene.deep,
  polygons: () => (scene.deep ? [] : scene.rooms),
  shafts: () => scene.shafts ?? [],
  sides: () => scene.sides ?? [],
  walls: () => blockingWalls(scene.walls.contents),
  inside: pointInPolygon, crosses: wallBetween,
});

const roundOf = (scene, burning, cache) => {
  const on = smokeRunsOn(scene);
  const geo = on ? smokeGridOf(scene.dimensions) : null;
  const lights = [];
  if (!geo || (!burning.length && !lights.length && !smokeHeldBy(scene))) return smokeRoundPlan({ activeGM: true, on, scene });
  const { cols, rows, cell, origin } = geo;
  const sources = smokeSourcesOf({ fires: burning, lights, grid: CELL, cell, origin, cols });
  const level = smokeLevelFor(scene, sources);
  const work = shapeOf(scene, geo, level, cache);
  const { indoors, walled, sky, openSide, nearWall } = work;
  const openings = smokeOpeningsOf({ walls: scene.walls.contents, cell, origin, cols, rows, indoors });
  return smokeRoundPlan({ activeGM: true, on, scene, sources, indoors, walled, openings, sky, openSide, nearWall,
    roomOf: (i) => smokeRoomAt({ from: i, cols, rows, indoors, walled, cache: work.rooms }) });
};

// Apply a round's fields the way Foundry merges flags, and hand back the scene as the next round would read it.
const applied = (scene, fields) => {
  const smoke = { ...(scene.flags.animater.smoke ?? {}) };
  let grid = scene.flags.animater.smokeGrid ? { ...scene.flags.animater.smokeGrid } : null;
  for (const [key, value] of Object.entries(fields)) {
    const path = key.replace("flags.animater.", "");
    if (path === `-=smokeGrid`) { grid = null; continue; }
    if (path.startsWith("smokeGrid.")) { grid = { ...(grid ?? {}), [path.slice("smokeGrid.".length)]: value }; continue; }
    const own = path.slice("smoke.".length);
    if (own.startsWith("-=")) delete smoke[own.slice(2)]; else smoke[own] = value;
  }
  return { ...scene, flags: { animater: { ...scene.flags.animater, smoke, ...(grid ? { smokeGrid: grid } : {}) } } };
};

// Several rounds of one burning prop, each reading back what the last one wrote, exactly as the GM's tick does.
const burnFor = (rounds, { scene = fakeScene(), burning = FIRE, cache = new Map() } = {}) => {
  let at = scene, last = null;
  for (let n = 0; n < rounds; n++) {
    last = roundOf(at, burning, cache);
    assert.ok(last, `round ${n + 1} decided nothing at all`);
    at = applied(at, last.fields);
  }
  return { scene: at, plan: last, cache };
};

test("the real gathering and the real round actually write smoke, round after round", () => {
  const { scene, plan } = burnFor(5);
  // The thing no regex could tell us: smoke is on the scene after the rounds have run.
  const stored = smokeCellsOf(scene);
  assert.ok(Object.keys(stored).length >= 5, `${Object.keys(stored).length} cells stored`);
  assert.ok(Object.values(stored).every((v) => v > 0));
  // The fire's own cell is the fullest, and all of it is inside the room.
  assert.ok(stored["33"] > 0, "the burning square itself");
  for (const key of Object.keys(stored)) {
    const i = Number(key), col = i % COLS, row = (i - col) / COLS;
    assert.ok(col >= 1 && col <= 5 && row >= 1 && row <= 5, `cell ${i} is in the room`);
  }
  // The geometry went beside the cells, so every client's fence can read them back.
  assert.equal(scene.flags.animater.smokeGrid.cols, COLS);
  assert.equal(scene.flags.animater.smokeGrid.cell, CELL);
  // And the round asked for a concealment region over that smoke.
  assert.ok(plan.shapes.length, "shapes for the region");
  assert.equal(smokeRegionPlan([], plan.shapes, { level: plan.level }).create.length, 1);
});

test("fifteen rounds in a sealed room give the agreed five thick cells", () => {
  const { plan } = burnFor(15);
  assert.equal(plan.cells.filter((c) => c.v >= THICK).length, 5, "five thick cells at fifteen rounds");
  assert.deepEqual(plan.openings, [], "a sealed room has no opening");
  assert.equal(plan.rooms.length, 1, "and it is one room");
  assert.equal(plan.rooms[0].size, 25, "of twenty-five cells, which is the room walk having really run");
});

test("the room walk's own cache is a Map, and the walk really uses it", () => {
  const cache = new Map();
  burnFor(3, { cache });
  const own = cache.get("scene0000000000z");
  assert.ok(own, "the scene's working set was kept");
  // The collision that killed the feature put an ARRAY here. smokeRoomAt calls cache.get, so an array threw.
  assert.ok(own.rooms instanceof Map, "the room cache is a Map");
  assert.ok(own.rooms.size >= 25, `every cell of the room is named (${own.rooms.size})`);
  assert.ok(own.polys !== own.rooms, "the gathered polygons are not the room cache");
  assert.ok(Array.isArray(own.polys) && own.polys.length === 1, "and they are still the polygons");
  // The other three memos are Maps of their own, and filled.
  for (const name of ["indoorsAt", "walledAt", "skyAt"]) assert.ok(own[name] instanceof Map, name);
  assert.ok(own.indoorsAt.size > 0 && own.walledAt.size > 0);
});

test("the gathering is asked for the scene's shape ONCE, however many rounds run", () => {
  let polygons = 0, shafts = 0, walls = 0;
  const scene = fakeScene();
  const cache = new Map();
  const counted = (geo, level) => smokeGathering({
    cache, sceneId: scene.id, geo, level, deep: false,
    polygons: () => { polygons++; return scene.rooms; },
    shafts: () => { shafts++; return []; },
    sides: () => [],
    walls: () => { walls++; return blockingWalls(scene.walls.contents); },
    inside: pointInPolygon, crosses: wallBetween,
  });
  const geo = smokeGridOf(scene.dimensions);
  for (let n = 0; n < 6; n++) counted(geo, null);
  assert.deepEqual([polygons, shafts, walls], [1, 1, 1], "gathered once and kept");
  // A resize, a grid change, the smoke moving floor or going underground: a different key, so gathered again.
  counted({ ...geo, cell: 50 }, null);
  assert.equal(polygons, 2);
  counted(geo, "aaaaaaaaaaaaaaaa");
  assert.equal(polygons, 3);
  assert.notEqual(smokeWorkKey({ cols: 10, cell: 100, origin: { x: 0, y: 0 }, deep: false }),
    smokeWorkKey({ cols: 10, cell: 100, origin: { x: 0, y: 0 }, deep: true }));
});

test("a roof that stands open at its sides vents; a missing wall alone does not, and one underground fills with no rooms drawn at all", () => {
  // The same room with its east wall gone. Those cells touch the outdoors with no wall between them — and that is
  // NOT enough on its own any more. A roof region is drawn by hand around a building whose walls are the real
  // enclosure, and wherever its outline runs diagonally it steps across squares, putting an indoor cell beside an
  // outdoor one at every step; read as holes, five such steps vented a ship's hold at 15% a round with every door
  // and window shut. So the roof's edge is sealed unless the GM says this roof stands open at its sides.
  const gap = fakeScene({ walls: BOX.slice(0, 1).concat(BOX.slice(2)) });
  const shut = burnFor(15, { scene: gap });
  assert.deepEqual(shut.plan.openings, [], "a gap in the walls is not by itself a way out");
  // Marked open-sided — a porch, a cart lodge — the same gap breathes, and the room holds less for it.
  const airy = burnFor(15, { scene: fakeScene({ walls: BOX.slice(0, 1).concat(BOX.slice(2)), sides: [ROOM] }) });
  assert.ok(airy.plan.openings.length, "an open-sided roof breathes out where its wall is missing");
  const peak = (p) => Math.max(0, ...p.cells.map((c) => c.v));
  assert.ok(peak(airy.plan) < peak(burnFor(15).plan), "and holds less than the sealed one");
  // Even open-sided, a square a wall runs through is not a hole: put the east wall back and the whole box is shut
  // again however the roof is marked.
  const walled = burnFor(15, { scene: fakeScene({ sides: [ROOM] }) });
  assert.deepEqual(walled.plan.openings, [], "an open-sided mark does not open a wall that is there");
  // Underground: no indoor regions at all, every cell indoors, and the smoke still forms. (This is the case the
  // collision killed first, since underground EVERY cell is indoors and so every round asked the room walk.)
  const cave = burnFor(5, { scene: fakeScene({ rooms: [], deep: true }) });
  assert.ok(Object.keys(smokeCellsOf(cave.scene)).length >= 5, "a cave fills");
});

// A BROKEN HELPER IS REPORTED, a bad single region is skipped. The swallow that used to be here read a thrown
// geometry test as "not indoors", which is a wrong answer presented as a fact — the same silence by another door, and
// nothing a GM could ever see. It now reaches the round's caller, which says one sentence per scene and tries again.
test("a gathering or a geometry test that throws is reported, not read as a no", () => {
  const scene = fakeScene();
  const geo = smokeGridOf(scene.dimensions);
  const parts = { polygons: () => scene.rooms, shafts: () => [], sides: () => [], walls: () => [], inside: pointInPolygon, crosses: wallBetween };
  const build = (own) => smokeGathering({ cache: new Map(), sceneId: scene.id, geo, level: null, deep: false, ...parts, ...own });
  // A gathering that throws: out of the construction, since that is where it is asked.
  for (const which of ["polygons", "shafts", "sides", "walls"]) {
    assert.throws(() => build({ [which]: () => { throw new Error("broken " + which); } }), /broken /, which);
  }
  // A geometry test that throws: out of the predicate that used it.
  assert.throws(() => build({ inside: () => { throw new Error("no polygon"); } }).indoors(33), /no polygon/);
  assert.throws(() => build({ crosses: () => { throw new Error("no segment"); } }).walled(33, 34), /no segment/);
  const holed = build({ shafts: () => [ROOM], inside: () => { throw new Error("no polygon"); } });
  assert.throws(() => holed.sky(33), /no polygon/);
  // A gathering that hands back something that is NOT a list is a different thing: read as "this scene has none of
  // those", which is all a wrong shape can safely mean, and never stored as it came.
  assert.equal(build({ polygons: () => ({ nope: true }) }).indoors(33), false);
  assert.equal(build({ polygons: () => null }).indoors(33), false);
});

// ---- The injections are REQUIRED, because a default that quietly answers "nothing" is how this died twice. ----

test("the gathering refuses to be built without its helpers, naming what is missing", () => {
  const scene = fakeScene();
  const geo = smokeGridOf(scene.dimensions);
  const parts = { polygons: () => scene.rooms, shafts: () => [], sides: () => [], walls: () => [], inside: pointInPolygon, crosses: wallBetween };
  const whole = { cache: new Map(), sceneId: scene.id, geo, level: null, deep: false, ...parts };
  assert.ok(smokeGathering(whole), "all of them: built");
  // THE line. Deleting `inside: pointInPolygon, crosses: wallBetween` from main.mjs left 850 tests green while
  // nothing was ever indoors and nothing was ever walled. It cannot be deleted quietly again.
  assert.throws(() => smokeGathering({ ...whole, inside: undefined, crosses: undefined }), /nothing was passed for inside, crosses/);
  for (const name of ["polygons", "shafts", "sides", "walls", "inside", "crosses"]) {
    assert.throws(() => smokeGathering({ ...whole, [name]: undefined }), new RegExp("nothing was passed for " + name), name);
    assert.throws(() => smokeGathering({ ...whole, [name]: "not a function" }), new RegExp("nothing was passed for " + name), name + ", wrong kind");
  }
  // The grid itself, likewise: without it every cell's middle was unreadable and every answer came back "no".
  for (const bad of [undefined, null, {}, { cols: 10, rows: 10, cell: 100 }, { cols: 0, rows: 10, cell: 100, origin: { x: 0, y: 0 } }]) {
    assert.throws(() => smokeGathering({ ...whole, geo: bad }), /nothing was passed for geo/, JSON.stringify(bad));
  }
  // The cache is the one thing that may honestly be left out: cold every round, correct and only slower.
  const cold = smokeGathering({ ...whole, cache: null });
  assert.equal(cold.indoors(33), true);
  assert.deepEqual(smokeGathering({ ...whole, cache: undefined }).indoors(33), true);
  // And nothing is passed at all: it says so rather than handing back a working-looking object.
  assert.throws(() => smokeGathering(), /smokeGathering: nothing was passed for/);
});

test("the real call site in main.mjs supplies every one of them", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const call = main.slice(main.indexOf("const smokeShapeOf = "), main.indexOf("// One round of smoke on one scene"));
  assert.ok(call.length, "the call site is where it was");
  for (const name of ["polygons:", "shafts:", "sides:", "walls:", "inside:", "crosses:", "cache:", "geo,"]) assert.ok(call.includes(name), name);
  // And the round is handed the two predicates that decide whether the roof's own edge is a hole. Without them
  // smokeRoundPlan falls back to its own defaults — never open-sided, no wall anywhere — which seals every roof
  // edge on every map silently, so a porch would simply stop venting and nothing would say why.
  const round = main.slice(main.indexOf("async function smokeRound("), main.indexOf("// The whole decision is smoke-regions.mjs's"));
  assert.match(round, /const \{ indoors, walled, sky, openSide, nearWall \} = work;/, "taken off the gathering");
  assert.match(round, /openings, sky, openSide, nearWall,/, "and handed to the round");
  assert.match(call, /inside: pointInPolygon, crosses: wallBetween,/, "the two that went missing");
  // And the level's regions are worked out once for both lists, not once each.
  assert.equal([...call.matchAll(/regionsOnLevel\(/g)].length, 1, "regionsOnLevel is evaluated once");
  assert.match(call, /const onLevel = \(\) => \(here \?\?= regionsOnLevel\(scene\.regions, level\)\);/);
});

test("with nothing stored, nothing burning and no light, the round looks at no shape at all", () => {
  let asked = 0;
  const scene = fakeScene();
  const cache = new Map();
  // The round's own idle gate, as main.mjs has it: nothing gathered, and the plan still answers.
  const plan = roundOf(scene, [], cache);
  assert.ok(plan, "an idle round still decides");
  assert.deepEqual(plan.fields, {}, "and writes nothing");
  assert.equal(cache.size, 0, "having gathered nothing");
  assert.equal(asked, 0);
});

// ---- The options object handed to Foundry must be FRESH, and the fakes now behave like Foundry about it. ----
// A live crash from the user's game: "TypeError: Cannot add property parent, object is not extensible", thrown by
// ScenePF2e.createEmbeddedDocuments every round of every fire. SMOKE_NOTE is frozen — rightly, as the canonical
// marker — and it was handed straight to Foundry as the options. Foundry treats options as its own scratch space and
// writes to it (createEmbeddedDocuments sets options.parent), so EVERY region write failed: the cells and the fence
// landed, the concealment region never did, and thin smoke concealed nothing in the real application.
//
// Every test double in this feature took the options and ignored them, which is why nothing caught it. These do not:
// each document call writes to the options it is given, exactly as Foundry does, so a frozen or shared options object
// throws here too.
import { smokeNote, SMOKE_NOTE, SMOKE_MARK, smokeOnlySave } from "../../../scripts/engines/props/smoke-round.mjs";
import { smokeRegionSave } from "../../../scripts/engines/props/smoke-regions.mjs";

const SHAPES = [{ type: "rectangle", x: 100, y: 100, width: 100, height: 100 }];

// A scene that writes to its options, as Foundry does. `wrote` records what each call was given, so a test can also
// see that the note really carried our marker.
const foundryScene = (own = {}) => {
  const wrote = [];
  const self = {
    ...fakeScene(own), regions: own.regions ?? [], wrote,
    // Foundry's own first act on these options: it hangs the parent document on them.
    async update(changes, options = {}) { options.parent = self; wrote.push({ call: "update", changes, options }); return self; },
    async createEmbeddedDocuments(kind, data, options = {}) { options.parent = self; wrote.push({ call: "create", kind, data, options }); self.regions.push(...data.map((d, n) => ({ id: `made${n}`, ...d }))); return data; },
    async updateEmbeddedDocuments(kind, data, options = {}) { options.parent = self; wrote.push({ call: "update-embedded", kind, data, options }); return data; },
    async deleteEmbeddedDocuments(kind, ids, options = {}) { options.parent = self; wrote.push({ call: "delete", kind, ids, options }); self.regions = self.regions.filter((r) => !ids.includes(r.id)); return ids; },
  };
  return self;
};
// main.mjs's own write loop, note for note: a FRESH one per call, which is what `note()` being a maker is for.
const applySteps = async (scene, plan, note) => {
  for (const step of plan.steps) {
    if (step.kind === "remove") await scene.deleteEmbeddedDocuments("Region", step.ids, note());
    else if (step.kind === "create") await scene.createEmbeddedDocuments("Region", step.data, note());
    else await scene.updateEmbeddedDocuments("Region", step.data, note());
  }
};

test("smokeNote gives a fresh, writable note every time, and it is still our own marker", () => {
  const a = smokeNote(), b = smokeNote();
  assert.notEqual(a, b, "never the same object twice");
  assert.deepEqual(a, b);
  assert.equal(a.animater[SMOKE_MARK], true);
  assert.equal(Object.isFrozen(a), false, "Foundry must be able to write to it");
  assert.equal(Object.isFrozen(a.animater), false);
  // Foundry writing to one does not touch the next, nor the canonical constant.
  a.parent = { id: "scene" };
  assert.equal(smokeNote().parent, undefined);
  assert.deepEqual(Object.keys(SMOKE_NOTE), ["animater"]);
  // And both readers still know it for ours: the marker is the same marker.
  assert.equal(smokeOnlySave({ "flags.animater.smoke.33": 1 }, smokeNote()), true);
  assert.equal(smokeRegionSave({ flags: { animater: { smokeRegion: true } } }, { _id: "r", shapes: [] }, smokeNote()), true);
  // The constant stays frozen: it is a value to compare and look inside, and nothing may change it.
  assert.equal(Object.isFrozen(SMOKE_NOTE), true);
  assert.throws(() => { SMOKE_NOTE.parent = 1; }, TypeError);
});

test("a round's region writes land when the note is fresh", async () => {
  const scene = foundryScene();
  const plan = smokeRegionPlan(scene.regions, SHAPES, { level: null, visioner: true });
  await applySteps(scene, plan, smokeNote);
  assert.equal(scene.regions.length, 1, "the concealment region was really made");
  assert.equal(scene.wrote.length, 1);
  assert.equal(scene.wrote[0].call, "create");
  // Each call got its own note, carrying our marker, and Foundry's own scribble landed on it and nowhere else.
  assert.equal(scene.wrote[0].options.animater[SMOKE_MARK], true);
  assert.equal(scene.wrote[0].options.parent, scene);
  // The scene write too.
  await scene.update({ "flags.animater.smoke.33": 1.08 }, smokeNote());
  assert.equal(scene.wrote[1].options.parent, scene);
});

test("handing Foundry the frozen constant throws, exactly as it did in the real game", async () => {
  const scene = foundryScene();
  const plan = smokeRegionPlan(scene.regions, SHAPES, { level: null, visioner: true });
  await assert.rejects(() => applySteps(scene, plan, () => SMOKE_NOTE), /not extensible/,
    "the live crash: Cannot add property parent, object is not extensible");
  assert.equal(scene.regions.length, 0, "and the region never appeared, which is what the user saw");
  // Every one of the four document calls is the same hazard, whether Foundry happens to write to it today or not.
  await assert.rejects(() => scene.update({ "flags.animater.smoke.33": 1 }, SMOKE_NOTE), /not extensible/);
  await assert.rejects(() => scene.createEmbeddedDocuments("Region", [{}], SMOKE_NOTE), /not extensible/);
  await assert.rejects(() => scene.updateEmbeddedDocuments("Region", [{}], SMOKE_NOTE), /not extensible/);
  await assert.rejects(() => scene.deleteEmbeddedDocuments("Region", ["r"], SMOKE_NOTE), /not extensible/);
  // One shared mutable note is no better: Foundry would write one call's leavings into the next.
  const shared = smokeNote();
  await applySteps(foundryScene(), smokeRegionPlan([], SHAPES, {}), () => shared);
  assert.ok(shared.parent, "a shared note comes back with Foundry's scribble still on it");
});

test("every document call in main.mjs takes a fresh note, and none takes the constant", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  // The constant is never handed to a document call; the maker always is.
  for (const call of ["update(", "createEmbeddedDocuments(", "updateEmbeddedDocuments(", "deleteEmbeddedDocuments("]) {
    for (const line of main.split(/\r?\n/)) {
      if (!line.includes(call) || !line.includes("SMOKE_NOTE")) continue;
      assert.fail(`a frozen note handed to ${call}: ${line.trim()}`);
    }
  }
  assert.ok(!/SMOKE_NOTE/.test(main.split(/\r?\n/).filter((l) => l.includes("scene.")).join("\n")), "no document call takes it");
  // Every one of the smoke's own writes stamps itself with a fresh one: the round's, the clear, the quench, and the
  // ageing a jumped world clock asks for.
  const stamped = main.split(/\r?\n/).filter((l) => l.includes("smokeNote()") && !l.trim().startsWith("//"));
  assert.equal(stamped.length, 7, `the seven writes (${stamped.length})`);
  for (const line of stamped) assert.match(line, /scene\.(update|createEmbeddedDocuments|updateEmbeddedDocuments|deleteEmbeddedDocuments)\(/, line.trim());
  assert.match(main, /import \{[^}]*smokeNote[^}]*\} from "\.\/engines\/props\/smoke-round\.mjs";/);
});

// ---- The CELLS write must fail as visibly as the region write. ----
// The user's two symptoms were one bug. With the frozen options object the cells write failed too — and its failure
// went into a trace line while the region write beside it threw loudly. No cells means no stored flag, so no
// sight-blocking fence and no drawn cloud: "I see no smoke in a closed room", with nothing in the interface to say
// why. Both now report through the one alarm, which speaks once per scene per session.
import { createSmokeAlarm } from "../../../scripts/engines/props/smoke-round.mjs";
import { withDeletes } from "../../../scripts/engines/props/prop-requests.mjs";

// main.mjs's whole write path, line for line: the cells, then the region, each failure handed to the alarm.
const writeRound = async (scene, plan, note, alarm) => {
  if (Object.keys(plan.fields).length) {
    await scene.update(withDeletes(plan.fields, undefined), note()).catch((e) => alarm(scene, "smoke not written", e));
  }
  const region = smokeRegionPlan(scene.regions, plan.shapes, { level: plan.level, visioner: true });
  for (const step of region.steps) {
    const call = step.kind === "remove" ? "deleteEmbeddedDocuments" : step.kind === "create" ? "createEmbeddedDocuments" : "updateEmbeddedDocuments";
    await scene[call]("Region", step.ids ?? step.data, note()).catch((e) => alarm(scene, "smoke region not written", e));
  }
};

test("with a fresh note the cells and the region both land, and nothing is said", async () => {
  const said = [];
  const alarm = createSmokeAlarm({ warn: (m, e) => said.push([m, e]) });
  const scene = foundryScene();
  await writeRound(scene, roundOf(scene, FIRE, new Map()), smokeNote, alarm);
  assert.deepEqual(said, [], "a working round says nothing at all");
  assert.equal(scene.wrote.filter((w) => w.call === "update").length, 1, "the cells were written");
  assert.ok(Object.keys(scene.wrote[0].changes).some((k) => k.startsWith("flags.animater.smoke.")), "and they are cells");
  assert.equal(scene.regions.length, 1, "and the concealment region was made");
});

test("a cells write that fails is SAID, not only traced, and said once for the scene", async () => {
  const said = [], traced = [];
  const alarm = createSmokeAlarm({ warn: (m, e) => said.push([m, e]), trace: (m) => traced.push(m) });
  const scene = foundryScene();
  const plan = roundOf(scene, FIRE, new Map());
  // The frozen constant, as it was handed over in the real game: the cells write rejects first.
  await writeRound(scene, plan, () => SMOKE_NOTE, alarm);
  assert.equal(said.length, 1, `the GM is told (${said.length})`);
  assert.match(said[0][0], /room smoke could not run/);
  assert.match(String(said[0][1]), /not extensible/, "with the real error");
  // The cells never landed, which is what the user saw: no flag, so no fence and no cloud.
  assert.equal(scene.wrote.length, 0);
  assert.equal(scene.regions.length, 0);
  // Both failures were traced, and the second did not speak again: one sentence per scene, not two.
  assert.equal(traced.length, 2, "the cells and the region, both in the log");
  assert.match(traced[0], /smoke not written:/);
  assert.match(traced[1], /smoke region not written:/);
  // Twenty more rounds of the same failure add nothing to the interface.
  for (let n = 0; n < 20; n++) await writeRound(scene, plan, () => SMOKE_NOTE, alarm);
  assert.equal(said.length, 1, "still once");
  assert.ok(traced.length > 20, "and still every one in the log");
});

test("main.mjs hands every smoke write failure to the alarm, and traces none of them away", () => {
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const from = main.indexOf("// ---- The smoke a fire fills"), to = main.indexOf("// The ticker: every scene with both switches on");
  const round = main.slice(from, to);
  assert.ok(from >= 0 && to > from);
  // The cells write, the clear and its region: each failure goes to the GM's one alarm.
  assert.match(round, /\.catch\(\(e\) => smokeThrew\(scene, "smoke not written", e\)\);/);
  assert.match(round, /\.catch\(\(e\) => smokeThrew\(scene, "smoke not cleared", e\)\);/);
  assert.match(round, /\.catch\(\(e\) => smokeThrew\(scene, "smoke region not cleared", e\)\);/);
  // And the quench's two, which sit further down the file.
  assert.match(main, /\.catch\(\(e\) => smokeThrew\(scene, "smoke not thinned", e\)\);/);
  assert.match(main, /\.catch\(\(e\) => smokeThrew\(scene, "smoke region not thinned away", e\)\);/);
  // No smoke write may swallow its failure into a trace and nothing else.
  for (const line of main.split(/\r?\n/)) {
    if (!/\.catch\(\(e\) => runtime\?\.trace\("props", `smoke/.test(line)) continue;
    assert.fail(`a smoke write still swallows its failure: ${line.trim()}`);
  }
});

// The flames are drawn in canvas.interface (zIndex 250), a group that draws ABOVE the whole primary group, while
// the cloud is in canvas.primary at 752. No sort order can put the cloud over them, so a fire in thick smoke was
// the one thing still plainly drawn through it — a lit torch and a campfire burning crisply inside a cellar full
// of smoke that was already blocking sight of everything else. Hiding them is the only way, and both places that
// draw a flame must ask: the fire lights have a seen() of their own, a held torch has none and is told by its spec.
test("a flame in thick smoke is not drawn, and both flame paths ask", () => {
  // Sliced, not matched against the whole file: main.mjs is well over a megabyte and a failed match on it prints
  // the lot.
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const near = (mark, span = 600) => { const at = main.indexOf(mark); assert.ok(at > 0, `${mark} is where it was`); return main.slice(at, at + span); };
  assert.match(near("const fireSeenHere ="), /!inThickSmoke\(at\)/, "the fire lights' own test");
  assert.match(near("torch = { key, x, y,"), /!inThickSmoke\(\{ x, y \}\)/, "and a held torch, which has no seen() of its own");
  // Read against the STORED geometry, as the fence and the cloud are: the scene's current size would slide the
  // answer under the squares the cells were written with after a resize.
  const look = near("const inThickSmoke =", 900);
  assert.match(look, /smokeDensityAt\(smokeSeenCells, smokeSeenGrid, at\) >= SMOKE_THICK/, "at the thick tier");
  assert.match(look, /storedSmokeGrid\(scene, smokeSeenCells\)/, "against the stored geometry");
});
