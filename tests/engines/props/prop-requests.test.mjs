import test from "node:test";
import assert from "node:assert/strict";
import { validBreakRequest, mergeWallFixes, undoUpdates, repairUpdates, breakNoteFor, withDeletes, levelTopOf, cleanCause, wallsToRestore, slamPlausible } from "../../../scripts/engines/props/prop-requests.mjs";
import { ownWalls } from "../../../scripts/engines/props/prop-walls.mjs";

const grid = 100;
const scene = (flags = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...flags } } });
const barrel = (extra = {}) => ({ id: "barrel", x: 200, y: 200, width: 100, height: 100, rotation: 0, hidden: false, texture: { src: "props/barrel.webp" }, flags: {}, ...extra });
const wall = (id, c, extra = {}) => ({ id, c, door: 0, move: 20, sight: 20, light: 20, sound: 20, flags: {}, ...extra });
const walls = [wall("in", [210, 220, 290, 220]), wall("in2", [220, 210, 220, 290]), wall("out", [500, 500, 600, 500])];
const target = { x: 300, y: 200, w: 100, h: 100 }; // a token at (3,2)
const sender = { id: "player", viewedScene: "s" };
// The GM's record of the area an area cause names: the player placed it, it is fresh and covers every tile tested.
const AREA = "Scene.s.Region.r";
const covering = (x = {}) => ({ uuid: AREA, sceneId: "s", authorId: "player", authorIsGM: false, ownsOrigin: false, rememberedAt: 1000, damageTypes: ["acid", "bludgeoning", "cold", "electricity", "fire", "force", "piercing", "slashing", "sonic", "vitality", "void", "mental", "poison", "spirit", "bleed"], testPoint: () => true, levels: [], ...x });
const noteFor = (tile = barrel(), cause = { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 250, y: 250 } }, extra = {}) =>
  breakNoteFor({ tile, walls, grid, cause, seed: 42, from: { x: 150, y: 250 }, ...extra });
const areaReq = (note = noteFor()) => ({ cause: { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 250, y: 250 } }, note });
const ctx = (extra = {}) => ({ tile: barrel(), walls, scene: scene(), grid, sender, area: covering(), now: 5000, ...extra });

test("a good area request passes and names only the tile's own walls", () => {
  const r = validBreakRequest(areaReq(), ctx());
  assert.equal(r.ok, true);
  assert.deepEqual(r.wallUpdates.map((u) => u._id), ownWalls(barrel(), walls, grid).map((w) => w.id));
  assert.deepEqual(r.wallUpdates.map((u) => u._id), ["in", "in2"]);
  assert.equal(r.note.seed, 42);
  assert.equal(r.wallUpdates[0].move, 0);
});

test("refused: feature off, already broken, hidden, wrong damage, foreign wall, far away", () => {
  const note = noteFor();
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ scene: { flags: {} } })), { ok: false, why: "off" });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ scene: scene({ breakableProps: "yes" }) })), { ok: false, why: "off" });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ tile: barrel({ flags: { animater: { prop: { broken: note } } } }) })), { ok: false, why: "broken" });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ tile: barrel({ hidden: true }) })), { ok: false, why: "hidden" });
  // wood does not break from cold
  assert.deepEqual(validBreakRequest({ ...areaReq(note), cause: { kind: "area", areaUuid: AREA, damageType: "cold", at: { x: 250, y: 250 } } }, ctx()), { ok: false, why: "material" });
  // a tile with no prop material never breaks
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ tile: barrel({ texture: { src: "floor/flagstones.webp" } }) })), { ok: false, why: "material" });
  assert.deepEqual(validBreakRequest(areaReq({ ...note, walls: ["in", "out"] }), ctx()), { ok: false, why: "wall" });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ tile: null })), { ok: false, why: "missing" });
  assert.deepEqual(validBreakRequest(areaReq({ ...note, pattern: "nonsense" }), ctx()), { ok: false, why: "note" });
  assert.deepEqual(validBreakRequest({ ...areaReq(note), cause: { kind: "wish" } }, ctx()), { ok: false, why: "cause" });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ sender: null })), { ok: false, why: "sender" });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ sender: { id: "player", viewedScene: "elsewhere" } })), { ok: false, why: "scene" });
});

test("a second request for the same tile is refused as already broken", () => {
  const first = validBreakRequest(areaReq(), ctx());
  assert.equal(first.ok, true);
  const broken = barrel({ hidden: true, flags: { animater: { prop: { broken: first.note } } } });
  assert.deepEqual(validBreakRequest(areaReq(noteFor()), ctx({ tile: broken })), { ok: false, why: "broken" });
});

test("a plain miss breaks only when the GM's roll is under the scene chance", () => {
  const cause = (outcome) => ({ kind: "miss", damageType: "bludgeoning", outcome, targetUuid: "Scene.s.Token.t" });
  const req = (outcome) => ({ cause: cause(outcome), note: noteFor(barrel(), cause(outcome)) });
  assert.equal(validBreakRequest(req("miss"), ctx({ target, roll: 0.1 })).ok, true);
  assert.deepEqual(validBreakRequest(req("miss"), ctx({ target, roll: 0.9 })), { ok: false, why: "lucky" });
  assert.equal(validBreakRequest(req("criticalFailure"), ctx({ target, roll: 0.99 })).ok, true);
  // the scene's own chance
  assert.equal(validBreakRequest(req("miss"), ctx({ target, roll: 0.9, scene: scene({ propMissChance: 95 }) })).ok, true);
  assert.deepEqual(validBreakRequest(req("miss"), ctx({ target, roll: 0.1, scene: scene({ propMissChance: 0 }) })), { ok: false, why: "lucky" });
  // the tile must be next to the target
  assert.deepEqual(validBreakRequest(req("criticalFailure"), ctx({ target: { x: 600, y: 200, w: 100, h: 100 }, roll: 0 })), { ok: false, why: "far" });
  assert.deepEqual(validBreakRequest(req("criticalFailure"), ctx({ roll: 0 })), { ok: false, why: "far" });
});

test("a slam is plausible along its planned path, from either end, and uses the mover's own size", () => {
  const along = (from, to) => ({ cause: { kind: "path", slam: { size: 3 }, moverUuid: "Scene.s.Token.m", path: { from, to } }, note: noteFor(barrel(), { kind: "path", slam: { size: 1 } }) });
  // a 6-square path with the barrel in its middle, 2.5 squares from either end
  const req = along({ x: -50, y: 250 }, { x: 550, y: 250 });
  assert.equal(validBreakRequest(req, ctx({ mover: { x: -50, y: 250, size: 1 } })).ok, true);
  assert.equal(validBreakRequest(req, ctx({ mover: { x: 550, y: 250, size: 1 } })).ok, true);
  // the mover nowhere near either end, or unknown
  assert.deepEqual(validBreakRequest(req, ctx({ mover: { x: 250, y: 800, size: 1 } })), { ok: false, why: "far" });
  assert.deepEqual(validBreakRequest(req, ctx({})), { ok: false, why: "far" });
  // the barrel off the path
  assert.deepEqual(validBreakRequest(along({ x: -50, y: 450 }, { x: 550, y: 450 }), ctx({ mover: { x: -50, y: 450, size: 1 } })), { ok: false, why: "far" });
  // a path longer than 12 squares
  assert.deepEqual(validBreakRequest(along({ x: -50, y: 250 }, { x: 1350, y: 250 }), ctx({ mover: { x: -50, y: 250, size: 1 } })), { ok: false, why: "far" });
  // no path
  assert.deepEqual(validBreakRequest({ ...req, cause: { kind: "path", slam: { size: 1 } } }, ctx({ mover: { x: 350, y: 250, size: 1 } })), { ok: false, why: "far" });
  // a Medium creature cannot slam through metal, whatever size the request claims
  const iron = barrel({ texture: { src: "props/iron-cage.webp" } });
  assert.deepEqual(validBreakRequest(req, ctx({ tile: iron, mover: { x: -50, y: 250, size: 1 } })), { ok: false, why: "material" });
  assert.equal(validBreakRequest(req, ctx({ tile: iron, mover: { x: -50, y: 250, size: 2 } })).ok, true);
});

test("slamPlausible is the one rule both sides use", () => {
  const path = { from: { x: -50, y: 250 }, to: { x: 550, y: 250 } };
  assert.equal(slamPlausible(barrel(), path, { x: -50, y: 250, size: 1 }, grid), true);
  // a Large mover reaches a prop a square off the line
  const off = { from: { x: -50, y: 400 }, to: { x: 550, y: 400 } };
  assert.equal(slamPlausible(barrel(), off, { x: -50, y: 400, size: 1 }, grid), false);
  assert.equal(slamPlausible(barrel(), off, { x: -50, y: 400, size: 2 }, grid), true);
});

test("undo restores only that tile's walls and clears only its note", () => {
  const restore = { move: 20, sight: 10, light: 20, sound: 20 };
  const opened = (id, c) => wall(id, c, { move: 0, sight: 0, light: 0, sound: 0, flags: { animater: { prop: { restore } } } });
  const all = [opened("a1", [210, 210, 290, 210]), opened("a2", [210, 290, 290, 290]), opened("b1", [610, 210, 690, 210]), wall("plain", [0, 0, 50, 0])];
  const tileA = barrel({ id: "A", hidden: true, flags: { animater: { prop: { broken: { ...noteFor(), walls: ["a1", "a2", "gone"] } } } } });
  const tileB = barrel({ id: "B", x: 600, hidden: true, flags: { animater: { prop: { broken: { ...noteFor(), walls: ["b1"] } } } } });
  const u = undoUpdates(tileA, all);
  assert.deepEqual(u.tile, { _id: "A", "flags.animater.prop.-=broken": null });
  assert.deepEqual(u.walls.map((w) => w._id), ["a1", "a2"]);
  assert.deepEqual(u.walls[0], { _id: "a1", ...restore, "flags.animater.prop.-=restore": null });
  assert.deepEqual(undoUpdates(tileB, all).walls.map((w) => w._id), ["b1"]);
  // a tile with no note touches no walls
  assert.deepEqual(undoUpdates(barrel(), all).walls, []);
});

test("repair unhides every broken tile in one batch and restores each named wall once", () => {
  const restore = { move: 20, sight: 20, light: 20, sound: 20 };
  const shared = wall("s", [290, 210, 310, 210], { flags: { animater: { prop: { restore } } } });
  const tiles = [
    barrel({ id: "A", hidden: true, flags: { animater: { prop: { broken: { ...noteFor(), walls: ["s"] } } } } }),
    barrel({ id: "B", hidden: true, flags: { animater: { prop: { broken: { ...noteFor(), walls: ["s"] } } } } }),
    barrel({ id: "C", hidden: true }), // hidden by the GM, never broken
    barrel({ id: "D" }),
  ];
  const r = repairUpdates(tiles, [shared]);
  assert.deepEqual(r.tiles, [{ _id: "A", hidden: false, "flags.animater.prop.-=broken": null }, { _id: "B", hidden: false, "flags.animater.prop.-=broken": null }]);
  assert.deepEqual(r.walls.map((w) => w._id), ["s"]);
});

test("the requester's note: its own walls, size in squares, cut from the cause", () => {
  const n = noteFor(barrel({ width: 200 }));
  assert.deepEqual(n.walls, ["in", "in2"]);
  assert.equal(n.seed, 42);
  assert.equal(n.mark, "scorch");
  assert.equal(n.spread, 0.32 * 2); // larger side is two squares
  assert.equal(n.cutAngle, 0); // from the left of the tile's centre
});

test("deletion keys become the database's own deletion marker when it has one", () => {
  const del = { del: true };
  assert.deepEqual(withDeletes({ _id: "a", "flags.animater.prop.-=broken": null, hidden: false }, del), { _id: "a", "flags.animater.prop.broken": del, hidden: false });
  const u = { _id: "a", "flags.animater.prop.-=restore": null };
  assert.equal(withDeletes(u, undefined), u);
});

test("a tile's level top: its first named level in scene order, else the initial level", () => {
  const levels = [{ id: "ground", elevation: { top: 10 } }, { id: "upper", elevation: { top: 20 } }];
  assert.equal(levelTopOf(["upper"], levels, "ground"), 20);
  assert.equal(levelTopOf([], levels, "ground"), 10);
  assert.equal(levelTopOf(["missing"], levels, "upper"), 20);
  assert.equal(levelTopOf([], [{ id: "only", elevation: { top: null } }], null), Infinity);
  assert.equal(levelTopOf([], [], null), undefined);
});

test("a cause from the socket keeps only its known, well-formed fields", () => {
  assert.deepEqual(cleanCause({ kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 1, y: 2, z: 3 }, extra: "x", slam: { size: "big" } }), { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 1, y: 2 } });
  assert.deepEqual(cleanCause({ kind: "path", slam: { size: 2 }, moverUuid: "Scene.s.Token.m", at: { x: NaN, y: 0 } }), { kind: "path", slam: { size: 2 }, moverUuid: "Scene.s.Token.m" });
  assert.deepEqual(cleanCause({ kind: "path", path: { from: { x: 1, y: 2, z: 9 }, to: { x: 3, y: 4 } } }), { kind: "path", path: { from: { x: 1, y: 2 }, to: { x: 3, y: 4 } } });
  assert.deepEqual(cleanCause({ kind: "path", path: { from: { x: 1, y: Infinity }, to: { x: 3, y: 4 } } }), { kind: "path" });
  assert.deepEqual(cleanCause({ kind: "path", path: "far" }), { kind: "path" });
  assert.deepEqual(cleanCause(null), { kind: "" });
  assert.equal(cleanCause({ kind: "miss", targetUuid: "u".repeat(500) }).targetUuid.length, 200);
});

test("the GM decides the walls: a note naming none still opens the tile's own and is rewritten to name them", () => {
  const r = validBreakRequest(areaReq({ ...noteFor(), walls: [] }), ctx());
  assert.equal(r.ok, true);
  assert.deepEqual(r.note.walls, ["in", "in2"]);
  assert.deepEqual(r.wallUpdates.map((u) => u._id), ["in", "in2"]);
});

const restore = { move: 20, sight: 20, light: 20, sound: 20 };
const opened = (id, c) => wall(id, c, { move: 0, sight: 0, light: 0, sound: 0, flags: { animater: { prop: { restore } } } });
const brokenTile = (id, x, ids) => barrel({ id, x, hidden: true, flags: { animater: { prop: { broken: { ...noteFor(), walls: ids } } } } });

test("a wall another broken tile still names stays open; only the tile's own named walls come back", () => {
  const shared = opened("s", [290, 210, 310, 210]), a1 = opened("a1", [210, 210, 290, 210]), far = opened("far", [610, 210, 690, 210]);
  const A = brokenTile("A", 200, ["s", "a1", "far"]), B = brokenTile("B", 300, ["s"]);
  // far is named by A's note but is not A's own wall (a copied note): never restored through A
  assert.deepEqual(wallsToRestore(A, [A, B], [shared, a1, far]).map((w) => w.id), ["a1"]);
  assert.deepEqual(undoUpdates(A, [shared, a1, far], { tiles: [A, B] }).walls.map((w) => w._id), ["a1"]);
  // B alone now: the shared wall comes back with it
  assert.deepEqual(wallsToRestore(B, [B], [shared]).map((w) => w.id), ["s"]);
  // a tile that is no longer broken does not hold a wall
  assert.deepEqual(wallsToRestore(A, [A, barrel({ id: "B", x: 300 })], [shared, a1]).map((w) => w.id), ["s", "a1"]);
});

test("a deleted broken tile gives back its walls unless another broken tile names them", () => {
  const shared = opened("s", [290, 210, 310, 210]), a1 = opened("a1", [210, 210, 290, 210]);
  const A = brokenTile("A", 200, ["s", "a1"]), B = brokenTile("B", 300, ["s"]);
  // after deletion A is gone from the scene's tiles
  assert.deepEqual(undoUpdates(A, [shared, a1], { tiles: [B] }).walls.map((w) => w._id), ["a1"]);
  assert.deepEqual(undoUpdates(A, [shared, a1], { tiles: [] }).walls.map((w) => w._id), ["s", "a1"]);
});

test("repair also restores any opened wall no broken tile names any more", () => {
  const orphan = opened("orphan", [900, 900, 950, 900]), a1 = opened("a1", [210, 210, 290, 210]);
  const r = repairUpdates([brokenTile("A", 200, ["a1"])], [orphan, a1, wall("plain", [0, 0, 10, 0])]);
  assert.deepEqual(r.walls.map((w) => w._id).sort(), ["a1", "orphan"]);
  assert.deepEqual(repairUpdates([], [orphan]).walls.map((w) => w._id), ["orphan"]);
});

test("slamPlausible refuses a prop the mover stands on or is pushed away from; accepts one pushed into", () => {
  const table = barrel({ id: "table", x: 0, y: 100, width: 200, height: 200, texture: { src: "Wooden_Table.webp" } });
  const b = barrel({ x: 80, y: 100 }), at = { x: 50, y: 150 }, mover = { ...at, size: 1 };
  assert.equal(slamPlausible(table, { from: at, to: { x: 350, y: 150 } }, mover, grid), false);
  assert.equal(slamPlausible(b, { from: at, to: { x: -250, y: 150 } }, mover, grid), false);
  assert.equal(slamPlausible(b, { from: at, to: { x: 350, y: 150 } }, mover, grid), true);
  const pathReq = (to) => ({ cause: { kind: "path", slam: { size: 1 }, path: { from: at, to } }, note: noteFor(b, { kind: "path", slam: { size: 1 } }) });
  assert.deepEqual(validBreakRequest(pathReq({ x: -250, y: 150 }), ctx({ tile: b, mover })), { ok: false, why: "far" });
  assert.equal(validBreakRequest(pathReq({ x: 350, y: 150 }), ctx({ tile: b, mover })).ok, true);
});

test("a miss or slam on another level than the tile is too far; a tile on no level is reached from any", () => {
  const up = barrel({ levels: ["upstairs"] });
  const missReq = { cause: { kind: "miss", damageType: "bludgeoning", outcome: "criticalFailure" }, note: noteFor(up) };
  assert.deepEqual(validBreakRequest(missReq, ctx({ tile: up, target: { ...target, level: "ground" } })), { ok: false, why: "far" });
  assert.equal(validBreakRequest(missReq, ctx({ tile: up, target: { ...target, level: "upstairs" } })).ok, true);
  assert.equal(validBreakRequest(missReq, ctx({ tile: barrel(), target: { ...target, level: "ground" } })).ok, true);
  const path = { from: { x: -50, y: 250 }, to: { x: 550, y: 250 } };
  const pathReq = { cause: { kind: "path", slam: { size: 1 }, path }, note: noteFor(up, { kind: "path", slam: { size: 1 } }) };
  assert.deepEqual(validBreakRequest(pathReq, ctx({ tile: up, mover: { x: -50, y: 250, size: 1, level: "ground" } })), { ok: false, why: "far" });
  assert.equal(validBreakRequest(pathReq, ctx({ tile: up, mover: { x: -50, y: 250, size: 1, level: "upstairs" } })).ok, true);
});

test("unhiding two broken tiles that share a wall at once gives the shared wall back", () => {
  const shared = opened("s", [290, 210, 310, 210]), a1 = opened("a1", [210, 210, 290, 210]);
  // both already unhidden by the same batch, notes not yet cleared
  const A = { ...brokenTile("A", 200, ["s", "a1"]), hidden: false }, B = { ...brokenTile("B", 300, ["s"]), hidden: false };
  assert.deepEqual(wallsToRestore(A, [A, B], [shared, a1]).map((w) => w.id), ["s", "a1"]);
  assert.deepEqual(wallsToRestore(B, [A, B], [shared, a1]).map((w) => w.id), ["s"]);
});

// Light props (Task 9)
const lantern = (extra = {}) => barrel({ id: "lantern", texture: { src: "props/Lantern.webp" }, ...extra });
const lamps = (extra = {}) => ({ x: 0, y: 0, hidden: false, levels: [], ...extra });
test("the GM hides the lights it finds and names them in the note", () => {
  const tile = lantern(), note = { ...noteFor(tile), lights: ["out"] };
  const lights = [lamps({ id: "in", x: 250, y: 250 }), lamps({ id: "out", x: 600, y: 600 })];
  const r = validBreakRequest(areaReq(note), ctx({ tile, lights }));
  assert.equal(r.ok, true);
  assert.deepEqual(r.note.lights, ["in"]);
  assert.deepEqual(r.lightUpdates, [{ _id: "in", hidden: true }]);
  // a barrel is no light prop: nothing goes out whatever the requester says
  const b = validBreakRequest(areaReq({ ...noteFor(), lights: ["in"] }), ctx({ lights }));
  assert.deepEqual([b.note.lights, b.lightUpdates], [[], []]);
  // the GM can say no to a lantern
  const no = lantern({ flags: { animater: { prop: { light: "no" } } } });
  assert.deepEqual(validBreakRequest(areaReq(noteFor(no)), ctx({ tile: no, lights })).lightUpdates, []);
});
test("undo and Repair unhide only the lights the break hid", () => {
  const tile = lantern(), lights = [lamps({ id: "in", x: 250, y: 250 }), lamps({ id: "gmHid", x: 260, y: 260 })];
  const r = validBreakRequest(areaReq(noteFor(tile)), ctx({ tile, lights }));
  assert.deepEqual(r.note.lights, ["in", "gmHid"]);
  // the GM had hidden gmHid beforehand: it is not visible, so the break neither hides nor names it
  const before = [lamps({ id: "in", x: 250, y: 250 }), lamps({ id: "gmHid", x: 260, y: 260, hidden: true })];
  const r2 = validBreakRequest(areaReq(noteFor(tile)), ctx({ tile, lights: before }));
  assert.deepEqual(r2.note.lights, ["in"]);
  const broken = { ...tile, hidden: true, flags: { animater: { prop: { broken: r2.note } } } };
  const after = [lamps({ id: "in", x: 250, y: 250, hidden: true }), lamps({ id: "gmHid", x: 260, y: 260, hidden: true })];
  assert.deepEqual(undoUpdates(broken, walls, { tiles: [], grid, lights: after }).lights, [{ _id: "in", hidden: false }]);
  assert.deepEqual(repairUpdates([broken], walls, { lights: after }).lights, [{ _id: "in", hidden: false }]);
  // a light the GM deleted or already lit again is skipped
  assert.deepEqual(repairUpdates([broken], walls, { lights: [lamps({ id: "in", x: 250, y: 250 })] }).lights, []);
  assert.deepEqual(repairUpdates([broken], walls).lights, []);
});
test("old notes without lights read as none", () => {
  const { lights, ...old } = noteFor(lantern());
  const broken = { ...lantern(), flags: { animater: { prop: { broken: old } } } };
  assert.deepEqual(undoUpdates(broken, walls, { lights: [lamps({ id: "in", hidden: true })] }).lights, []);
});

// Burning lamp oil (Task 10)
test("a lit lantern knocked over catches; the GM's request says fire", () => {
  const tile = lantern(), hit = { kind: "area", areaUuid: AREA, damageType: "bludgeoning", at: { x: 250, y: 250 } };
  const req = (t = tile) => ({ cause: hit, note: noteFor(t, hit) });
  const lit = validBreakRequest(req(), ctx({ tile, lights: [lamps({ id: "in", x: 250, y: 250 })] }));
  assert.equal(lit.ok, true);
  assert.equal(lit.fire, true);
  assert.equal(lit.note.fire, true);
  // unlit and not fire: the oil only spills
  const dark = validBreakRequest(req(), ctx({ tile, lights: [lamps({ id: "in", x: 250, y: 250, hidden: true })] }));
  assert.equal(dark.ok, true);
  assert.equal(dark.fire, false);
  assert.equal("fire" in dark.note, false);
  // fire damage lights it even unlit
  const burnt = validBreakRequest(areaReq(noteFor(tile)), ctx({ tile, lights: [] }));
  assert.deepEqual([burnt.fire, burnt.note.fire], [true, true]);
  // a requester's fire claim counts for nothing: a barrel holds no lamp oil
  const b = validBreakRequest({ cause: hit, note: { ...noteFor(barrel(), hit), fire: true } }, ctx({ lights: [lamps({ id: "in", x: 250, y: 250 })] }));
  assert.deepEqual([b.fire, "fire" in b.note], [false, false]);
  // the GM set its contents to something else
  const water = lantern({ flags: { animater: { prop: { contents: "water" } } } });
  assert.equal(validBreakRequest(req(water), ctx({ tile: water, lights: [lamps({ id: "in", x: 250, y: 250 })] })).fire, false);
});
test("undo deletes the tile's own fire lights, Repair every one", () => {
  const fire = (id, tileId) => ({ id, x: 250, y: 250, hidden: false, levels: [], flags: { animater: { propFire: { tileId, until: 1 } } } });
  const broken = { ...lantern(), hidden: true, flags: { animater: { prop: { broken: { ...noteFor(lantern()), fire: true } } } } };
  const lights = [fire("f1", "lantern"), fire("f2", "other"), lamps({ id: "lamp", flags: {} })];
  assert.deepEqual(undoUpdates(broken, walls, { lights }).deleteLights, ["f1"]);
  assert.deepEqual(repairUpdates([broken], walls, { lights }).deleteLights, ["f1", "f2"]);
  assert.deepEqual(undoUpdates(broken, walls).deleteLights, []);
});

// Braziers tip over (Task 11): any slam tips one; fire and other damage still follow its metal.
const brazier = (prop = {}, extra = {}) => barrel({ id: "brazier", texture: { src: "props/Brazier_Iron.webp" }, flags: { animater: { prop } }, ...extra });
const shove = (size = 1) => ({ kind: "path", slam: { size }, moverUuid: "Scene.s.Token.m", path: { from: { x: -50, y: 250 }, to: { x: 550, y: 250 } } });
const smallMover = { x: -50, y: 250, size: 1 };
test("a Medium slam tips a brazier; its light goes out; area fire still can't touch it", () => {
  const tile = brazier(), lights = [lamps({ id: "fire", x: 250, y: 250 })];
  const r = validBreakRequest({ cause: shove(1), note: noteFor(tile, shove(1)) }, ctx({ tile, mover: smallMover, lights }));
  assert.equal(r.ok, true);
  assert.equal(r.note.style, "tip");
  assert.deepEqual(r.note.lights, ["fire"]);
  assert.deepEqual(r.lightUpdates, [{ _id: "fire", hidden: true }]);
  assert.equal(r.fire, false, "a brazier holds no lamp oil");
  const fire = { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 250, y: 250 } };
  assert.deepEqual(validBreakRequest({ cause: fire, note: noteFor(tile, fire) }, ctx({ tile, lights })), { ok: false, why: "material" });
  // the requester's note said shatter: the GM decides it tips
  assert.equal(validBreakRequest({ cause: shove(1), note: { ...noteFor(tile, shove(1)), style: "shatter" } }, ctx({ tile, mover: smallMover })).note.style, "tip");
});
test("a brazier set not to tip needs a Large slam again, and shatters; a forged tip is refused the style", () => {
  const stays = brazier({ tips: "no" });
  assert.deepEqual(validBreakRequest({ cause: shove(1), note: noteFor(stays, shove(1)) }, ctx({ tile: stays, mover: smallMover })), { ok: false, why: "material" });
  const big = validBreakRequest({ cause: shove(2), note: noteFor(stays, shove(2)) }, ctx({ tile: stays, mover: { ...smallMover, size: 2 } }));
  assert.equal(big.ok, true);
  assert.equal(big.note.style, "shatter");
  // a barrel can't be claimed to tip
  const r = validBreakRequest({ cause: shove(1), note: { ...noteFor(barrel(), shove(1)), style: "tip" } }, ctx({ mover: smallMover }));
  assert.equal(r.ok, true);
  assert.equal(r.note.style, "shatter");
  // a tipping prop the GM set to Won't break still won't move
  const fixed = brazier({ material: "none" });
  assert.deepEqual(validBreakRequest({ cause: shove(1), note: noteFor(fixed, shove(1)) }, ctx({ tile: fixed, mover: smallMover })), { ok: false, why: "material" });
  // a tipping slam still has to be plausible
  assert.deepEqual(validBreakRequest({ cause: shove(1), note: noteFor(brazier(), shove(1)) }, ctx({ tile: brazier(), mover: { x: 2000, y: 2000, size: 1 } })), { ok: false, why: "far" });
});
test("the requester's note for a brazier slam says tip", () => {
  assert.equal(noteFor(brazier(), shove(1)).style, "tip");
  assert.equal(noteFor(brazier(), { kind: "area", areaUuid: AREA, damageType: "bludgeoning", at: { x: 250, y: 250 } }).style, "shatter");
});

// Powder kegs (Task 12): any break of a keg says whether it explodes, and its note keeps the powder and the burst.
const powderKeg = (prop = {}) => barrel({ id: "keg", texture: { src: "props/Keg_Powder.webp" }, flags: { animater: { prop } } });
test("a powder keg broken by fire explodes; by an axe or a shove it spills; the note keeps its burst", () => {
  const fire = { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 250, y: 250 } };
  const r = validBreakRequest({ cause: fire, note: noteFor(powderKeg(), fire) }, ctx({ tile: powderKeg() }));
  assert.equal(r.ok, true);
  assert.equal(r.explode, true);
  assert.equal(r.note.powder, "exploded");
  assert.equal(r.note.burst, 2);
  assert.equal(validBreakRequest({ cause: fire, note: noteFor(powderKeg({ burst: 4 }), fire) }, ctx({ tile: powderKeg({ burst: 4 }) })).note.burst, 4);
  const zap = { kind: "area", areaUuid: AREA, damageType: "electricity", at: { x: 250, y: 250 } };
  assert.equal(validBreakRequest({ cause: zap, note: noteFor(powderKeg(), zap) }, ctx({ tile: powderKeg() })).explode, true);
  const axe = { kind: "area", areaUuid: AREA, damageType: "slashing", at: { x: 250, y: 250 } };
  const spilt = validBreakRequest({ cause: axe, note: noteFor(powderKeg(), axe) }, ctx({ tile: powderKeg() }));
  assert.equal(spilt.ok, true);
  assert.equal(spilt.explode, false);
  assert.equal(spilt.note.powder, "spilled");
  assert.equal(spilt.note.burst, 2);
  const slam = shove(2);
  const shoved = validBreakRequest({ cause: slam, note: noteFor(powderKeg(), slam) }, ctx({ tile: powderKeg(), mover: { ...smallMover, size: 2 } }));
  assert.equal(shoved.ok, true);
  assert.equal(shoved.explode, false);
  assert.equal(shoved.note.powder, "spilled");
  // a keg the GM set to hold wine is no keg of powder
  const wine = powderKeg({ contents: "wine" }), w = validBreakRequest({ cause: fire, note: noteFor(wine, fire) }, ctx({ tile: wine }));
  assert.equal(w.explode, false);
  assert.equal(w.note.powder, undefined);
});
test("powder and burst are the GM's: a requester's claim on a crate is dropped, a keg's is rewritten", () => {
  const fire = { kind: "area", areaUuid: AREA, damageType: "fire", at: { x: 250, y: 250 } };
  const r = validBreakRequest({ cause: fire, note: { ...noteFor(), powder: "exploded", burst: 4 } }, ctx());
  assert.equal(r.ok, true);
  assert.equal(r.explode, false);
  assert.equal(r.note.powder, undefined);
  assert.equal(r.note.burst, undefined);
  const axe = { kind: "area", areaUuid: AREA, damageType: "slashing", at: { x: 250, y: 250 } };
  const k = validBreakRequest({ cause: axe, note: { ...noteFor(powderKeg(), axe), powder: "exploded", burst: 4 } }, ctx({ tile: powderKeg() }));
  assert.equal(k.note.powder, "spilled");
  assert.equal(k.note.burst, 2);
});
test("a blast or ignite cause from the socket keeps its source tile", () => {
  assert.deepEqual(cleanCause({ kind: "blast", sourceId: "keg", extra: 1 }), { kind: "blast", sourceId: "keg" });
  assert.equal(cleanCause({ kind: "blast", sourceId: "k".repeat(500) }).sourceId.length, 200);
  assert.deepEqual(cleanCause({ kind: "ignite", damageType: "fire", at: { x: 1, y: 2 } }), { kind: "ignite", damageType: "fire", at: { x: 1, y: 2 } });
});
test("a player's forged blast is refused before anything else is looked at", () => {
  const blast = { kind: "blast", sourceId: "keg" };
  assert.deepEqual(validBreakRequest({ cause: blast, note: noteFor() }, ctx()), { ok: false, why: "sender" });
  assert.deepEqual(validBreakRequest({ cause: blast, note: noteFor() }, ctx({ sender: { ...sender, isGM: false }, source: barrel({ id: "keg", hidden: true }) })), { ok: false, why: "sender" });
});

test("I1: an area break must name a real area the GM checks: missing, foreign, expired, outside or on another level is refused as area", () => {
  const note = noteFor();
  const no = { ok: false, why: "area" };
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ area: undefined })), no); // the GM has no such area
  assert.deepEqual(validBreakRequest({ ...areaReq(note), cause: { kind: "area", damageType: "fire", at: { x: 250, y: 250 } } }, ctx()), no); // names none
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ area: covering({ sceneId: "other" }) })), no); // on another scene
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ area: covering({ authorId: "someone" }) })), no); // another player's
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ now: 1000 + 600001 })), no); // expired
  // the shape as the GM computes it does not hold the tile's centre (250, 250)
  const elsewhere = covering({ testPoint: (p) => Math.hypot(p.x - 900, p.y - 900) <= 150 });
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ area: elsewhere })), no);
  // the area is on another level than the tile
  assert.deepEqual(validBreakRequest(areaReq(note), ctx({ tile: barrel({ levels: ["ground"] }), area: covering({ levels: ["upstairs"] }) })), no);
  // the tile's own centre is what is tested, not the requester's at
  const seen = [];
  validBreakRequest(areaReq(note), ctx({ area: covering({ testPoint: (p) => { seen.push(p); return true; } }) }));
  assert.deepEqual(seen, [{ x: 250, y: 250 }]);
  // a GM-placed area, or one whose origin actor the sender owns, is fine
  assert.equal(validBreakRequest(areaReq(note), ctx({ area: covering({ authorId: "gm", authorIsGM: true }) })).ok, true);
  assert.equal(validBreakRequest(areaReq(note), ctx({ area: covering({ authorId: "gm", ownsOrigin: true }) })).ok, true);
});

test("I1: the GM's own area break naming no area keeps its 30-square reach from its centre", () => {
  const gm = { id: "gm", viewedScene: "s", isGM: true }, note = noteFor();
  const at = (x) => ({ ...areaReq(note), cause: { kind: "area", damageType: "fire", at: { x, y: 250 } } });
  assert.equal(validBreakRequest(at(250 + 30 * grid), ctx({ sender: gm, area: undefined })).ok, true);
  assert.deepEqual(validBreakRequest(at(250 + 31 * grid), ctx({ sender: gm, area: undefined })), { ok: false, why: "far" });
});

test("M1: Repair's wall batch names each wall once, its door note's restore over a prop's", () => {
  const merged = mergeWallFixes([{ _id: "a", move: 20, "flags.animater.prop.-=restore": null }, { _id: "b", move: 10 }],
    [{ _id: "a", door: 1, ds: 2, move: 30, "flags.animater.breakWall.-=broken": null }]);
  assert.deepEqual(merged, [{ _id: "a", move: 30, "flags.animater.prop.-=restore": null, door: 1, ds: 2, "flags.animater.breakWall.-=broken": null }, { _id: "b", move: 10 }]);
  assert.deepEqual(mergeWallFixes([], []), []);
  assert.deepEqual(mergeWallFixes([{ move: 1 }], [{ _id: "c", move: 2 }]), [{ _id: "c", move: 2 }]); // an update without an id is dropped
});

test("an area cause keeps the damage roll it names (a spell whose damage type is chosen at cast)", () => {
  assert.equal(cleanCause({ kind: "area", areaUuid: "Scene.s.Region.r", messageId: "m1" }).messageId, "m1");
  assert.equal(cleanCause({ kind: "area", messageId: 5 }).messageId, undefined);
});
