import test from "node:test";
import assert from "node:assert/strict";
import { wallTraits, canBreakWall, wallMid, crossesWall, wallNote, readWallNote, wallBreakUpdate, wallRestoreUpdate, wallRepairUpdates } from "../../../scripts/engines/props/wall-break.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
const wall = (extra = {}) => ({ id: "d1", c: [300, 200, 400, 200], door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20, levels: [], flags: {}, ...extra });
const own = (o) => ({ flags: { animater: { breakWall: o } } });

test("any door on a breakable scene is a wood door unless the GM says otherwise", () => {
  assert.deepEqual(wallTraits(wall(), scene()), { kind: "door", material: "wood", forceOpen: true, forceDC: null });
  assert.equal(wallTraits(wall({ door: 2 }), scene()).kind, "door");
  assert.equal(wallTraits(wall({ door: 0 }), scene()).kind, null);
  assert.equal(wallTraits(wall(), { id: "s", flags: {} }).kind, null);
  assert.equal(wallTraits(wall(), scene({ breakWalls: false })).kind, null);
  assert.equal(wallTraits(wall(own({ door: "never" })), scene()).kind, null);
  assert.deepEqual(wallTraits(wall(own({ material: "metal", forceOpen: false })), scene()), { kind: "door", material: "metal", forceOpen: false, forceDC: null });
  assert.equal(wallTraits(wall(own({ material: "lava" })), scene()).material, "wood");
});

test("a door's Force open DC: its own number, else by material and system; none for a window", () => {
  assert.equal(wallTraits(wall(), scene(), "pf2e").forceDC, 15);
  assert.equal(wallTraits(wall(own({ material: "metal" })), scene(), "dnd5e").forceDC, 20);
  assert.equal(wallTraits(wall(own({ material: "stone" })), scene(), "daggerheart").forceDC, 19);
  assert.equal(wallTraits(wall(own({ material: "stone", forceDC: 12 })), scene(), "pf2e").forceDC, 12);
  assert.equal(wallTraits(wall(own({ forceDC: 12 })), scene(), "draw-steel").forceDC, null);
  assert.equal(wallTraits(wall(), scene()).forceDC, null); // no system given
  assert.equal(wallTraits(win({ flags: { animater: { breakWall: { window: true, forceDC: 12 } } } }), scene(), "pf2e").forceDC, null);
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
  // (Roi: smashed windows and walls should spill Animater's fading lamplight, not Foundry's flat light: the hole keeps
  // stopping Foundry's light, HOLE_LIGHT, and wall-shadows windowOpening reads it as an open hole.)
  assert.deepEqual(u, { _id: "d1", door: 0, ds: 0, move: 0, sight: 0, light: 20, sound: 0, "flags.animater.breakWall.broken": { ...note, restore: { door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20 } } });
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
  assert.deepEqual(wallTraits(win(), scene()), { kind: "window", material: "glass", forceOpen: false, forceDC: null });
  assert.equal(wallTraits(wall({ door: 0 }), scene()).kind, null);
  assert.equal(wallTraits(wall({ door: 0, flags: { animater: { window: "glass" } } }), scene()).kind, "window"); // a glass window is breakable by itself (Automatic)
  assert.equal(wallTraits(wall({ door: 0, flags: { animater: { window: "curtained" } } }), scene()).kind, null); // a window without glass is not
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
test("a broken window lets sight and sound through (and Animater's light, not Foundry's) but still blocks movement", () => {
  const n = wallNote({ seed: 1, cutAngle: 0, from: { x: 350, y: 100 }, kind: "window", material: "glass" });
  const u = wallBreakUpdate(win(), n);
  assert.deepEqual([u.sight, u.light, u.sound, "move" in u, "door" in u], [0, 20, 0, false, false]);
  // it also opens (an open window), remembering it had no Animater window of its own
  assert.deepEqual(u["flags.animater.breakWall.broken"].restore, { sight: 20, light: 20, sound: 20, windowKind: null });
  assert.equal(u["flags.animater.window"], "open");
});
test("a window's note reads back (glass, none), and Repair restores only its senses", () => {
  const n = wallNote({ seed: 1, cutAngle: 0, from: { x: 350, y: 100 }, kind: "window", material: "glass" });
  assert.deepEqual(readWallNote(n), n);
  assert.equal(readWallNote({ ...n, material: "none" }).material, "none");
  assert.equal(readWallNote({ ...n, kind: "gate" }), null);
  const broken = win({ sight: 0, light: 0, sound: 0, flags: { animater: { breakWall: { window: true, broken: { ...n, restore: { sight: 20, light: 20, sound: 20 } } } } } });
  assert.deepEqual(wallRestoreUpdate(broken), { _id: "w1", sight: 20, light: 20, sound: 20, "flags.animater.breakWall.-=broken": null });
});

// Task 21 (D1): a Material saved as an array (both groups' selects submitted) still reads as the shown group's choice.
import { wallMaterialOf, wallBreakFormMerge, wallFormDoor } from "../../../scripts/engines/props/wall-break.mjs";
test("a door saved with Material [metal, glass] is metal; a window with [wood, none] won't break", () => {
  assert.equal(wallTraits(wall(own({ material: ["metal", "glass"] })), scene()).material, "metal");
  assert.equal(wallTraits(wall(own({ material: ["stone", "none"] })), scene(), "pf2e").forceDC, 25);
  const win = (o) => wall({ door: 0, ...own({ window: true, ...o }) });
  assert.equal(wallTraits(win({ material: ["wood", "none"] }), scene()).material, "none");
  assert.equal(wallTraits(win({ material: ["metal", "glass"] }), scene()).material, "glass");
  // the window group's own field wins for a window
  assert.equal(wallTraits(win({ material: "wood", windowMaterial: "none" }), scene()).material, "none");
  assert.equal(wallTraits(win({ material: "none", windowMaterial: "glass" }), scene()).material, "glass");
  // unknown values: a door is wood, a window glass
  assert.equal(wallTraits(wall(own({ material: ["junk"] })), scene()).material, "wood");
  assert.equal(wallTraits(wall(own({ material: { x: 1 } })), scene()).material, "wood");
  assert.equal(wallTraits(win({ material: ["junk", 3] }), scene()).material, "glass");
});
test("wallMaterialOf: the door group's value for a door, the window group's for a window", () => {
  assert.equal(wallMaterialOf(["metal", "glass"], "door"), "metal");
  assert.equal(wallMaterialOf(["glass", "stone"], "door"), "stone");
  assert.equal(wallMaterialOf("stone", "door"), "stone");
  assert.equal(wallMaterialOf(undefined, "door"), "wood");
  assert.equal(wallMaterialOf(["wood", "none"], "window"), "none");
  assert.equal(wallMaterialOf(["none", "glass"], "window"), "glass"); // the later (window group's) value
  assert.equal(wallMaterialOf("none", "window"), "none");
  assert.equal(wallMaterialOf("metal", "window"), "glass");
});
test("wallBreakFormMerge: the form's two Material fields become one material by the Door Type saved", () => {
  // a door: the door group's Material is kept, the window group's dropped
  assert.deepEqual(wallBreakFormMerge({ material: "metal", windowMaterial: "glass", door: "", forceOpen: true }, 1), { material: "metal", door: "", forceOpen: true });
  // a wall with no door: the window group's
  assert.deepEqual(wallBreakFormMerge({ material: "wood", windowMaterial: "none", window: true }, 0), { material: "none", window: true });
  // secret doors are doors
  assert.deepEqual(wallBreakFormMerge({ material: "stone", windowMaterial: "glass" }, 2), { material: "stone" });
  // an array that reached the update anyway is resolved too
  assert.deepEqual(wallBreakFormMerge({ material: ["metal", "glass"] }, 1), { material: "metal" });
  assert.deepEqual(wallBreakFormMerge({ material: ["wood", "none"] }, 0), { material: "none" });
  // a door update without a Material (unchanged) keeps none
  assert.deepEqual(wallBreakFormMerge({ windowMaterial: "glass", forceOpen: false }, 1), { forceOpen: false });
  // nothing to merge: the same object back
  const plain = { material: "stone" };
  assert.equal(wallBreakFormMerge(plain, 1), plain);
  assert.equal(wallBreakFormMerge(undefined, 1), undefined);
});

test("I2: the Door Type a broken door's config stands for is the door it was (its note's restore), unless the form changes it", () => {
  const metal = { material: "metal", forceOpen: true };
  const brokenDoor = wall({ door: 0, ds: 0, move: 0, sight: 0, light: 0, sound: 0, flags: { animater: { breakWall: { ...metal,
    broken: { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "door", material: "metal", mark: "dust", restore: { door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20 } } } } } });
  assert.equal(wallFormDoor(brokenDoor), 1); // the form opens on the door it was
  assert.equal(wallFormDoor(brokenDoor, undefined), 1); // a save that leaves Door Type alone
  assert.equal(wallFormDoor(brokenDoor, 0), 1); // the form's select still on the broken wall's own 0
  assert.equal(wallFormDoor(brokenDoor, "0"), 1);
  assert.equal(wallFormDoor(brokenDoor, 2), 2); // the GM changes it (a hand edit)
  // a broken window, an intact door or window, a wall without a note: their own door type
  const brokenWindow = wall({ door: 0, flags: { animater: { breakWall: { window: true, broken: { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "window", material: "glass", mark: "dust", restore: { sight: 20, light: 20, sound: 20 } } } } } });
  assert.equal(wallFormDoor(brokenWindow), 0);
  assert.equal(wallFormDoor(wall()), 1);
  assert.equal(wallFormDoor(wall({ door: 0 }), "1"), 1);
  assert.equal(wallFormDoor(wall({ door: 2 })), 2);
});

test("I2: a broken metal door saved unchanged keeps metal, and Repair brings back a locked metal door", () => {
  const note = { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "door", material: "metal", mark: "dust", restore: { door: 1, ds: 2, move: 20, sight: 20, light: 20, sound: 20 } };
  const broken = wall({ door: 0, ds: 0, move: 0, sight: 0, light: 0, sound: 0, flags: { animater: { breakWall: { material: "metal", forceOpen: true, broken: note } } } });
  // Foundry sends both groups' fields (the D1 finding) and the diff leaves out door and material
  const sent = { material: "metal", windowMaterial: "glass", forceOpen: true };
  const saved = wallBreakFormMerge(sent, wallFormDoor(broken, undefined));
  assert.equal(saved.material, "metal");
  assert.equal("windowMaterial" in saved, false);
  // the shown door group alone (the render fix) submits the same
  assert.equal(wallBreakFormMerge({ material: "metal", forceOpen: true }, wallFormDoor(broken)).material, "metal");
  // Repair: the door comes back locked, and still reads as metal
  const after = { ...broken, flags: { animater: { breakWall: { ...broken.flags.animater.breakWall, ...saved } } } };
  const fix = wallRestoreUpdate(after);
  assert.deepEqual({ door: fix.door, ds: fix.ds, move: fix.move }, { door: 1, ds: 2, move: 20 });
  const repaired = { ...after, ...fix, flags: { animater: { breakWall: { material: saved.material, forceOpen: true } } } };
  assert.equal(wallTraits(repaired, scene()).material, "metal");
  assert.equal(wallTraits(repaired, scene()).kind, "door");
});

test("a wall with Animater's glass window kind is a breakable window unless the GM says No", () => {
  const glassWall = (kind, bw) => wall({ door: 0, flags: { animater: { window: kind, ...(bw ? { breakWall: bw } : {}) } } });
  for (const kind of ["glass", "leaded", "mosaic", "rose", "frosted"]) assert.equal(wallTraits(glassWall(kind), scene()).kind, "window", kind);
  for (const kind of ["open", "curtained", "bars", "slit", "woodWindow", undefined]) assert.equal(wallTraits(glassWall(kind), scene()).kind, null, String(kind));
  assert.equal(wallTraits(glassWall("glass", { window: "no" }), scene()).kind, null);
  assert.equal(wallTraits(glassWall("glass", { window: false }), scene()).kind, null);
  assert.equal(wallTraits(glassWall("bars", { window: "yes" }), scene()).kind, "window");
  assert.equal(wallTraits(glassWall(undefined, { window: true }), scene()).kind, "window"); // ticked before Automatic existed
  assert.equal(wallTraits(glassWall("glass"), { id: "s", flags: { animater: { breakableProps: false } } }).kind, null);
});

test("a window that breaks opens: a glass pane becomes an open window, a shutter stands open; Repair puts both back", () => {
  const note = { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "window", material: "glass", mark: "dust" };
  const pane = { id: "w1", door: 0, sight: 20, light: 20, sound: 20, flags: { animater: { window: "leaded" } } };
  const up = wallBreakUpdate(pane, note);
  assert.equal(up["flags.animater.window"], "open");
  assert.equal(up["flags.animater.breakWall.broken"].restore.windowKind, "leaded");
  const broken = { ...pane, flags: { animater: { window: "open", breakWall: { broken: up["flags.animater.breakWall.broken"] } } } };
  const back = wallRestoreUpdate(broken);
  assert.equal(back["flags.animater.window"], "leaded");
  assert.equal(back.sight, 20);
  // a shutter (a window that opens and closes) is left its kind and set open; Repair shuts it again
  const shutter = { id: "w2", door: 0, sight: 20, light: 20, sound: 20, flags: { animater: { window: "shutterWindow", windowOpen: false } } };
  const su = wallBreakUpdate(shutter, note);
  assert.equal(su["flags.animater.windowOpen"], true);
  assert.equal(su["flags.animater.window"], undefined);
  const sb = wallRestoreUpdate({ ...shutter, flags: { animater: { window: "shutterWindow", windowOpen: true, breakWall: { broken: su["flags.animater.breakWall.broken"] } } } });
  assert.equal(sb["flags.animater.windowOpen"], false);
  // a ticked wall with no Animater window kind: it opens to an open window, and Repair takes the kind away again
  const plain = { id: "w3", door: 0, sight: 20, light: 20, sound: 20, flags: { animater: { breakWall: { window: true } } } };
  const pu = wallBreakUpdate(plain, note);
  assert.equal(pu["flags.animater.window"], "open");
  const pb = wallRestoreUpdate({ ...plain, flags: { animater: { window: "open", breakWall: { window: true, broken: pu["flags.animater.breakWall.broken"] } } } });
  assert.equal(pb["flags.animater.-=window"], null);
  // a note with junk in its window restore is refused
  assert.equal(readWallNote({ ...note, restore: { sight: 20, windowKind: 5 } }), null);
});

test("a reinforced wooden door: a door material of its own, breaking to wood's blows but only a Huge slam", () => {
  assert.equal(wallMaterialOf("reinforced", "door"), "reinforced");
  assert.equal(wallMaterialOf("reinforced", "window"), "glass");
  const t = wallTraits(wall({ flags: { animater: { breakWall: { material: "reinforced" } } } }), scene(), "pf2e");
  assert.equal(t.material, "reinforced");
  assert.equal(t.forceDC, 20);
  assert.equal(canBreakWall(t, { damageType: "slashing" }), true);
  assert.equal(canBreakWall(t, { damageType: "fire" }), true);
  assert.equal(canBreakWall(t, { damageType: "cold" }), false);
  assert.equal(canBreakWall(t, { slam: { size: 2 } }), false);
  assert.equal(canBreakWall(t, { slam: { size: 3 } }), true);
  assert.equal(readWallNote({ seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "door", material: "reinforced", mark: "dust" })?.material, "reinforced");
});

test("Repair restores a hit door's HP: its hp flag goes, broken or not", () => {
  const hit = wall({ flags: { animater: { breakWall: { hp: 7, hits: ["a", "m"] } } } });
  assert.deepEqual(wallRestoreUpdate(hit), { _id: "d1", "flags.animater.breakWall.-=hp": null });
  assert.equal(wallRestoreUpdate(wall({ flags: { animater: { breakWall: { hits: ["a"] } } } })), null); // the hits stay: each roll applies once
  const broken = wall({ door: 0, flags: { animater: { breakWall: { hp: 0, broken: { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "door", material: "wood", mark: "dust", restore: { door: 1, ds: 0, move: 20, sight: 20, light: 20, sound: 20 } } } } } });
  const up = wallRestoreUpdate(broken);
  assert.equal(up.door, 1);
  assert.equal(up["flags.animater.breakWall.-=broken"], null);
  assert.equal(up["flags.animater.breakWall.-=hp"], null);
  assert.equal(wallRepairUpdates([hit, wall()]).length, 1);
});
