import test from "node:test";
import assert from "node:assert/strict";
import { wallTraits, canBreakWall, wallMid, crossesWall, wallNote, readWallNote, wallBreakUpdate, wallRestoreUpdate, wallRepairUpdates } from "../../../scripts/engines/props/wall-break.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const wall = (extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const own = (o) => ({ flags: { animater: { breakWall: o } } });

test("any door on a breakable scene is a wood door unless the GM says otherwise", () => {
  assert.deepEqual(wallTraits(wall(), scene()), { kind: "door", material: "wood", forceOpen: true });
  assert.equal(wallTraits(wall({ door: 2 }), scene()).kind, "door");
  assert.equal(wallTraits(wall({ door: 0 }), scene()).kind, null);
  assert.equal(wallTraits(wall(), { id: "s", flags: {} }).kind, null);
  assert.equal(wallTraits(wall(), scene({ breakWalls: false })).kind, null);
  assert.equal(wallTraits(wall(own({ door: "never" })), scene()).kind, null);
  assert.deepEqual(wallTraits(wall(own({ material: "metal", forceOpen: false })), scene()), { kind: "door", material: "metal", forceOpen: false });
  assert.equal(wallTraits(wall(own({ material: "lava" })), scene()).material, "wood");
});

test("doors are sturdier than props", () => {
  const wood = { kind: "door", material: "wood" }, metal = { kind: "door", material: "metal" };
  for (const d of ["bludgeoning", "slashing", "force", "fire"]) assert.equal(canBreakWall(wood, { damageType: d }), true, d);
  assert.equal(canBreakWall(wood, { damageType: "piercing" }), false);
  assert.equal(canBreakWall(wood, { slam: { size: 1 } }), false);
  assert.equal(canBreakWall(wood, { slam: { size: 2 } }), true);
  assert.equal(canBreakWall(metal, { damageType: "fire" }), false);
  assert.equal(canBreakWall(metal, { damageType: "force" }), true);
  assert.equal(canBreakWall(metal, { slam: { size: 2 } }), false);
  assert.equal(canBreakWall(metal, { slam: { size: 3 } }), true);
  assert.equal(canBreakWall({ kind: null, material: "wood" }, { damageType: "force" }), false);
});

test("breaking opens the passage and stores the originals; restore puts them back, locked stays locked", () => {
  const note = wallNote({ seed: 5, cutAngle: 1.2, from: { x: 350, y: 120 }, kind: "door", material: "wood", damageType: "fire" });
  assert.equal(note.mark, "scorch");
  assert.equal(wallNote({ seed: 5, cutAngle: 1.2, from: { x: 1, y: 2 }, kind: "door", material: "wood", damageType: "bludgeoning" }).mark, "dust");
  const u = wallBreakUpdate(wall({ ds: 2 }), note);
  assert.deepEqual(u, { _id: "d1", door: 0, ds: 0, move: 0, sight: 0, light: 0, sound: 0, "flags.animater.breakWall.broken": { ...note, restore: { door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20 } } });
  const broken = wall({ door: 0, ds: 0, move: 0, sight: 0, light: 0, sound: 0, ...own({ broken: u["flags.animater.breakWall.broken"] }) });
  assert.deepEqual(wallRestoreUpdate(broken), { _id: "d1", door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20, "flags.animater.breakWall.-=broken": null });
  assert.equal(wallRestoreUpdate(wall()), null);
  assert.deepEqual(wallRepairUpdates([broken, wall({ id: "d2" })]).map((x) => x._id), ["d1"]);
  assert.equal(readWallNote({ ...note, kind: "gate" }), null);
});

test("readWallNote validates every field", () => {
  const note = wallNote({ seed: 5, cutAngle: 1.2, from: { x: 350, y: 120 }, kind: "door", material: "stone", damageType: "force" });
  assert.deepEqual(readWallNote(note), note);
  assert.equal(readWallNote(null), null);
  assert.equal(readWallNote({ ...note, seed: "x" }), null);
  assert.equal(readWallNote({ ...note, cutAngle: NaN }), null);
  assert.equal(readWallNote({ ...note, from: { x: 1 } }), null);
  assert.equal(readWallNote({ ...note, material: "lava" }), null);
  assert.equal(readWallNote({ ...note, mark: "blood" }), null);
  assert.equal(readWallNote({ ...note, restore: { door: 1.5 } }), null);
  assert.deepEqual(readWallNote({ ...note, restore: { door: 1, ds: 2 } }).restore, { door: 1, ds: 2 });
});

test("a broken door the GM has since edited, or with a bad note, is not restored", () => {
  assert.equal(wallRestoreUpdate(wall({ ...own({ broken: { seed: 1 } }) })), null);
});

test("wallMid and crossesWall", () => {
  assert.deepEqual(wallMid(wall()), { x: 350, y: 200 });
  assert.equal(crossesWall({ x: 350, y: 100 }, { x: 350, y: 300 }, wall()), true);
  assert.equal(crossesWall({ x: 450, y: 100 }, { x: 450, y: 300 }, wall()), false);
  assert.equal(crossesWall({ x: 350, y: 100 }, { x: 350, y: 150 }, wall()), false);
});

const win = (extra = {}) => wall({ id: "w1", door: 0, flags: { animater: { breakWall: { window: true } } }, ...extra });
const noneWin = () => win({ flags: { animater: { breakWall: { window: true, material: "none" } } } });
test("only a wall marked Window is a window; glass unless Won't break", () => {
  assert.deepEqual(wallTraits(win(), scene()), { kind: "window", material: "glass", forceOpen: false });
  assert.equal(wallTraits(wall({ door: 0 }), scene()).kind, null);
  assert.equal(wallTraits(wall({ door: 0, flags: { animater: { window: "glass" } } }), scene()).kind, null); // the light kind alone is not breakable
  assert.equal(wallTraits(win(), scene({ breakWalls: false })).kind, null);
  assert.equal(wallTraits(win(), { id: "s", flags: {} }).kind, null);
  assert.equal(wallTraits(noneWin(), scene()).material, "none");
  assert.equal(canBreakWall(wallTraits(noneWin(), scene()), { damageType: "force" }), false);
  assert.equal(canBreakWall(wallTraits(noneWin(), scene()), { slam: { size: 4 } }), false);
  // a door stays a door even when the window box was ticked
  assert.equal(wallTraits(wall({ flags: { animater: { breakWall: { window: true } } } }), scene()).kind, "door");
});
test("glass rules plus any slam", () => {
  const t = { kind: "window", material: "glass" };
  assert.equal(canBreakWall(t, { damageType: "cold" }), true);
  assert.equal(canBreakWall(t, { damageType: "poison" }), false);
  assert.equal(canBreakWall(t, { slam: { size: 1 } }), true);
});
test("a broken window lets sight, light and sound through but still blocks movement", () => {
  const n = wallNote({ seed: 1, cutAngle: 0, from: { x: 350, y: 100 }, kind: "window", material: "glass" });
  const u = wallBreakUpdate(win(), n);
  assert.deepEqual([u.sight, u.light, u.sound, "move" in u, "door" in u], [0, 0, 0, false, false]);
  assert.deepEqual(u["flags.animater.breakWall.broken"].restore, { sight: 20, light: 20, sound: 20 });
});
test("a window's note reads back (glass, none), and Repair restores only its senses", () => {
  const n = wallNote({ seed: 1, cutAngle: 0, from: { x: 350, y: 100 }, kind: "window", material: "glass" });
  assert.deepEqual(readWallNote(n), n);
  assert.equal(readWallNote({ ...n, material: "none" }).material, "none");
  assert.equal(readWallNote({ ...n, kind: "gate" }), null);
  const broken = win({ sight: 0, light: 0, sound: 0, flags: { animater: { breakWall: { window: true, broken: { ...n, restore: { sight: 20, light: 20, sound: 20 } } } } } });
  assert.deepEqual(wallRestoreUpdate(broken), { _id: "w1", sight: 20, light: 20, sound: 20, "flags.animater.breakWall.-=broken": null });
});
