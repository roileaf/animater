// The round driven END TO END over a fake scene: the REAL gathering (smoke-gather.mjs, which main.mjs now only hands
// its Foundry lookups to), the REAL geometry helpers main.mjs passes it, and the REAL round decision. Nothing here
// re-implements anything; the fakes are the scene, its walls and its rooms, which is all main.mjs would have fetched.
//
// This file exists because of one bug. The gathering lived inside main.mjs, which no test can import under node, so it
// was pinned by source-text regexes — and a regex cannot see that two keys of one object collide. One did: a seeded
// `rooms: new Map()` was spread over by a built `rooms: [polygon]`, that array reached smokeRoomAt as its `cache`,
// `cache?.get(from)` threw on the first indoor cell of every burning round, main.mjs traced the throw away, and the
// whole feature was silently dead while 1604 tests passed. A key collision, a wrong shape or a swallowed throw must
// fail THIS file.
import test from "node:test";
import assert from "node:assert/strict";
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

const fakeScene = ({ smoke = null, grid = null, walls = BOX, rooms = [ROOM], deep = false } = {}) => ({
  id: "scene0000000000z",
  dimensions: { width: 1000, height: 1000, size: CELL },
  levels: [],
  walls: { contents: walls },
  rooms, deep, // what main.mjs would have found through the regions; handed to the thunks below
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
  const { indoors, walled, sky } = work;
  const openings = smokeOpeningsOf({ walls: scene.walls.contents, cell, origin, cols, rows, indoors });
  return smokeRoundPlan({ activeGM: true, on, scene, sources, indoors, walled, openings, sky,
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

test("a room with a doorway in its wall vents, and one underground fills with no rooms drawn at all", () => {
  // The same room with its east wall gone: those cells touch the outdoors with no wall between, so the room breathes.
  const gap = fakeScene({ walls: BOX.slice(0, 1).concat(BOX.slice(2)) });
  const open = burnFor(15, { scene: gap });
  assert.ok(open.plan.openings.length, "the room breathes out where the wall is missing");
  const peak = (p) => Math.max(0, ...p.cells.map((c) => c.v));
  assert.ok(peak(open.plan) < peak(burnFor(15).plan), "and holds less than the sealed one");
  // Underground: no indoor regions at all, every cell indoors, and the smoke still forms. (This is the case the
  // collision killed first, since underground EVERY cell is indoors and so every round asked the room walk.)
  const cave = burnFor(5, { scene: fakeScene({ rooms: [], deep: true }) });
  assert.ok(Object.keys(smokeCellsOf(cave.scene)).length >= 5, "a cave fills");
});

test("a gathering or a geometry test that throws leaves the round standing, not thrown", () => {
  const scene = fakeScene();
  const geo = smokeGridOf(scene.dimensions);
  const angry = smokeGathering({
    cache: new Map(), sceneId: scene.id, geo, level: null, deep: false,
    polygons: () => { throw new Error("no regions"); },
    shafts: () => { throw new Error("no sky"); },
    walls: () => { throw new Error("no walls"); },
    inside: () => { throw new Error("no polygon"); },
    crosses: () => { throw new Error("no segment"); },
  });
  assert.equal(angry.indoors(33), false);
  assert.equal(angry.walled(33, 34), false);
  assert.equal(angry.sky(33), false);
  // A gathering that hands back something that is not a list is read as an empty one, never stored as it came.
  const odd = smokeGathering({ cache: new Map(), sceneId: "s", geo, polygons: () => ({ nope: true }), inside: pointInPolygon });
  assert.equal(odd.indoors(33), false);
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
