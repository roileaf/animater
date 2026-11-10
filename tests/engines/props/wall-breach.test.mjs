import test from "node:test";
import assert from "node:assert/strict";
import { wallTraits, canBreakWall, readWallNote, wallMaterialOf, wallRestoreUpdate } from "../../../scripts/engines/props/wall-break.mjs";
import { projectOnWall, crossingPoint, breachSplit, wallBreachUpdate, breachPartData, wallRepairPlan, breachWallAt, breachPartOf } from "../../../scripts/engines/props/wall-breach.mjs";
import { validWallBreakRequest, handEdited } from "../../../scripts/engines/props/wall-break-requests.mjs";
import { doorsInArea, wallsCrossed } from "../../../scripts/engines/props/wall-triggers.mjs";
import { blastTargets } from "../../../scripts/engines/props/prop-blast.mjs";
import { defaultWallStats } from "../../../scripts/engines/props/door-attack.mjs";
import { wallSound, DOOR_SOUNDS, TOPPLE_SOUNDS, TIP_SOUNDS } from "../../../scripts/engines/props/prop-sounds.mjs";
import { breachWreckLayout } from "../../../scripts/engines/props/wall-wreck-layout.mjs";

const scene = (f = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...f } } });
// A plain wall 5 squares long, marked breakable, of the given material.
const plain = (material = "wood", extra = {}) => ({ id: "w1", c: [0, 200, 500, 200], door: 0, ds: 0, move: 20, sight: 20, light: 20, sound: 20, dir: 0, levels: [],
  flags: { animater: { breakWall: { wall: "yes", wallMaterial: material } } }, ...extra });
const gm = { id: "g", isGM: true, viewedScene: "s" };
const player = { id: "p", isGM: false, viewedScene: "s" };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ---- traits ----
test("a plain wall breaks only when the GM marks it breakable; its material is its own field, wood when unknown", () => {
  assert.deepEqual(wallTraits(plain("stone"), scene()), { kind: "wall", material: "stone", forceOpen: false, forceDC: null });
  assert.equal(wallTraits(plain("brick"), scene()).material, "brick");
  assert.equal(wallTraits(plain("lava"), scene()).material, "wood");
  assert.equal(wallTraits({ ...plain(), flags: {} }, scene()).kind, null, "unmarked walls never break");
  assert.equal(wallTraits(plain("wood", { flags: { animater: { breakWall: { wall: "no", wallMaterial: "wood" } } } }), scene()).kind, null);
  assert.equal(wallTraits(plain("wood", { flags: { animater: { breakWall: { wall: true } } } }), scene()).kind, "wall");
  assert.equal(wallTraits(plain(), { id: "s", flags: {} }).kind, null, "needs Breakable props");
  assert.equal(wallTraits(plain(), scene({ breakWalls: false })).kind, null, "needs Doors and windows break");
  // a door is a door, a window a window, whatever the wall box says
  assert.equal(wallTraits(plain("stone", { door: 1 }), scene()).kind, "door");
  assert.equal(wallTraits(plain("stone", { flags: { animater: { breakWall: { wall: "yes", window: "yes" } } } }), scene()).kind, "window");
  assert.equal(wallMaterialOf(["wood", "metal"], "wall"), "wood");
  assert.equal(wallMaterialOf("metal", "wall"), "metal");
});

test("Table 11-4 structures: Hardness, HP and Broken Threshold by wall material", () => {
  assert.deepEqual(defaultWallStats("wood"), { hardness: 10, maxHp: 40, bt: 20 });
  assert.deepEqual(defaultWallStats("brick"), { hardness: 12, maxHp: 48, bt: 24 });
  assert.deepEqual(defaultWallStats("stone"), { hardness: 14, maxHp: 56, bt: 28 });
  assert.deepEqual(defaultWallStats("metal"), { hardness: 18, maxHp: 72, bt: 36 });
  assert.deepEqual(defaultWallStats("lava"), defaultWallStats("wood"));
});

// ---- damage / slam rules ----
test("what breaks each wall material: areas by damage type, slams by size, any keg blast", () => {
  const t = (m) => wallTraits(plain(m), scene());
  const types = ["fire", "force", "bludgeoning", "slashing", "piercing", "cold", "electricity", "acid", "sonic"];
  const breaks = (m) => types.filter((d) => canBreakWall(t(m), { damageType: d }));
  assert.deepEqual(breaks("wood"), ["fire", "force"]);
  assert.deepEqual(breaks("brick"), ["force"]);
  assert.deepEqual(breaks("stone"), []);
  assert.deepEqual(breaks("metal"), []);
  const slam = (m, size) => canBreakWall(t(m), { slam: { size } });
  assert.equal(slam("wood", 2), false, "Large does not breach wood");
  assert.equal(slam("wood", 3), true, "Huge does");
  assert.equal(slam("brick", 3), false); assert.equal(slam("brick", 4), true);
  assert.equal(slam("stone", 3), false); assert.equal(slam("stone", 4), true);
  assert.equal(slam("metal", 4), false); assert.equal(slam("metal", 10), false);
  for (const m of ["wood", "brick", "stone", "metal"]) assert.equal(canBreakWall(t(m), { blast: true }), true, m);
});

// ---- geometry ----
test("a point projects onto the wall segment, clamped to its ends; a path's crossing point", () => {
  const p = projectOnWall([0, 200, 500, 200], { x: 120, y: 50 });
  assert.ok(near(p.x, 120) && near(p.y, 200) && near(p.along, 120) && near(p.len, 500));
  const q = projectOnWall([0, 200, 500, 200], { x: 900, y: 300 });
  assert.ok(near(q.x, 500) && near(q.along, 500));
  const x = crossingPoint({ x: 250, y: 100 }, { x: 250, y: 300 }, [0, 200, 500, 200]);
  assert.ok(near(x.x, 250) && near(x.y, 200));
  assert.equal(crossingPoint({ x: 250, y: 100 }, { x: 250, y: 150 }, [0, 200, 500, 200]), null);
});

test("a breach is a 1-square gap (blast 2) centred on the hit, clamped inside the segment", () => {
  const c = [0, 200, 500, 200];
  const one = breachSplit(c, { x: 250, y: 200 }, { grid: 100, squares: 1 });
  assert.deepEqual(one.gap, [200, 200, 300, 200]);
  assert.deepEqual(one.parts, [[0, 200, 200, 200], [300, 200, 500, 200]]);
  const two = breachSplit(c, { x: 250, y: 200 }, { grid: 100, squares: 2 });
  assert.deepEqual(two.gap, [150, 200, 350, 200]);
  // near an end: clamped inside, the end piece gone (no zero-length wall)
  const end = breachSplit(c, { x: 10, y: 200 }, { grid: 100, squares: 1 });
  assert.deepEqual(end.gap, [0, 200, 100, 200]);
  assert.deepEqual(end.parts, [[100, 200, 500, 200]]);
  // a sliver under a quarter square left at an end opens with the gap
  const sliver = breachSplit(c, { x: 465, y: 200 }, { grid: 100, squares: 1 });
  assert.deepEqual(sliver.gap, [400, 200, 500, 200]);
  assert.deepEqual(sliver.parts, [[0, 200, 400, 200]]);
  // a diagonal wall: coordinates are whole numbers on the line
  const diag = breachSplit([0, 0, 300, 400], { x: 150, y: 200 }, { grid: 100, squares: 1 });
  assert.deepEqual(diag.gap, [120, 160, 180, 240]);
  assert.deepEqual(diag.parts, [[0, 0, 120, 160], [180, 240, 300, 400]]);
});

test("a segment shorter than 1.5 squares opens whole; a gap as long as the segment does too", () => {
  const short = breachSplit([0, 0, 140, 0], { x: 70, y: 0 }, { grid: 100, squares: 1 });
  assert.deepEqual(short, { gap: [0, 0, 140, 0], parts: [] });
  const blast = breachSplit([0, 0, 180, 0], { x: 90, y: 0 }, { grid: 100, squares: 2 });
  assert.deepEqual(blast.parts, []);
});

// ---- split update + restore ----
test("the breach write: the original becomes part A carrying the note and restore; part B is a copy of it", () => {
  const w = plain("stone");
  const split = breachSplit(w.c, { x: 250, y: 200 }, { grid: 100, squares: 1 });
  const note = { seed: 5, cutAngle: 1.2, from: { x: 250, y: 100 }, kind: "wall", material: "stone", mark: "dust", gap: split.gap };
  const up = wallBreachUpdate(w, note, split, "b2");
  assert.deepEqual(up, { _id: "w1", c: [0, 200, 200, 200],
    "flags.animater.breakWall.broken": { ...note, partId: "b2", restore: { c: [0, 200, 500, 200], move: 20, sight: 20, light: 20, sound: 20 } } });
  assert.deepEqual(readWallNote(up["flags.animater.breakWall.broken"]), up["flags.animater.breakWall.broken"]);
  const source = { _id: "w1", c: [0, 200, 500, 200], move: 20, sight: 20, light: 20, sound: 20, dir: 1, threshold: { light: 10 }, levels: ["L1"], _stats: { x: 1 },
    flags: { animater: { breakWall: { wall: "yes", wallMaterial: "stone" } }, other: { keep: true } } };
  const b = breachPartData(source, split.parts[1], "w1");
  assert.equal(b._id, undefined); assert.equal(b._stats, undefined);
  assert.deepEqual(b.c, [300, 200, 500, 200]);
  assert.equal(b.dir, 1); assert.deepEqual(b.threshold, { light: 10 }); assert.deepEqual(b.levels, ["L1"]);
  assert.deepEqual(b.flags, { animater: { breakWall: { wall: "yes", wallMaterial: "stone", breachOf: "w1" } }, other: { keep: true } });
  assert.equal(breachPartOf(b), "w1");
  assert.equal(source.flags.animater.breakWall.breachOf, undefined, "the source is not touched");
  // a broken source's note never reaches part B
  const broken = breachPartData({ ...source, flags: { animater: { breakWall: { wall: "yes", broken: note } } } }, [1, 1, 2, 2], "w1");
  assert.equal(broken.flags.animater.breakWall.broken, undefined);
});

test("a breach with one part left needs no part B; a whole segment opens its passage instead", () => {
  const w = plain();
  const end = breachSplit(w.c, { x: 10, y: 200 }, { grid: 100, squares: 1 });
  const note = { seed: 5, cutAngle: 0, from: { x: 0, y: 100 }, kind: "wall", material: "wood", mark: "dust", gap: end.gap };
  const up = wallBreachUpdate(w, note, end, null);
  assert.deepEqual(up.c, [100, 200, 500, 200]); assert.equal(up["flags.animater.breakWall.broken"].partId, null);
  const whole = breachSplit([0, 200, 100, 200], { x: 50, y: 200 }, { grid: 100, squares: 1 });
  const up2 = wallBreachUpdate({ ...w, c: [0, 200, 100, 200] }, { ...note, gap: whole.gap }, whole, null);
  assert.equal(up2.c, undefined);
  assert.equal(up2.move, 0); assert.equal(up2.sight, 0); assert.equal(up2.light, 0); assert.equal(up2.sound, 0);
});

test("Repair restores the original exactly (c and fields) and deletes part B", () => {
  const w = plain("wood");
  const split = breachSplit(w.c, { x: 250, y: 200 }, { grid: 100, squares: 2 });
  const note = { seed: 5, cutAngle: 1.2, from: { x: 250, y: 100 }, kind: "wall", material: "wood", mark: "scorch", gap: split.gap };
  const { _id, ...up } = wallBreachUpdate(w, note, split, "b2");
  const a = { ...w, c: up.c, flags: { animater: { breakWall: { ...w.flags.animater.breakWall, broken: up["flags.animater.breakWall.broken"] } } } };
  const b = { ...w, id: "b2", c: split.parts[1], flags: { animater: { breakWall: { wall: "yes", wallMaterial: "wood", breachOf: "w1" } } } };
  const other = { ...plain("stone"), id: "x9" };
  const plan = wallRepairPlan([a, b, other]);
  assert.deepEqual(plan.deletes, ["b2"]);
  assert.deepEqual(plan.updates, [{ _id: "w1", c: [0, 200, 500, 200], move: 20, sight: 20, light: 20, sound: 20, "flags.animater.breakWall.-=broken": null }]);
  assert.deepEqual(wallRestoreUpdate(a), plan.updates[0]);
});

test("Repair with part B deleted by hand restores the original anyway; a breached part B's own part goes too", () => {
  const w = plain("wood");
  const split = breachSplit(w.c, { x: 250, y: 200 }, { grid: 100, squares: 1 });
  const broken = (id, c, partId, restoreC) => ({ ...w, id, c, flags: { animater: { breakWall: { wall: "yes", broken: { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "wall", material: "wood", mark: "dust", gap: [1, 2, 3, 4], partId, restore: { c: restoreC, move: 20, sight: 20, light: 20, sound: 20 } } } } } });
  const a = broken("w1", split.parts[0], "b2", w.c);
  const plan = wallRepairPlan([a]);
  assert.deepEqual(plan.deletes, []);
  assert.deepEqual(plan.updates[0].c, [0, 200, 500, 200]);
  // part B breached again (its own part C): B and C both go, A comes back whole
  const b = broken("b2", [300, 200, 380, 200], "c3", split.parts[1]);
  const c = { ...w, id: "c3", c: [400, 200, 500, 200] };
  const plan2 = wallRepairPlan([a, b, c]);
  assert.deepEqual(plan2.deletes.sort(), ["b2", "c3"]);
  assert.deepEqual(plan2.updates.map((u) => u._id), ["w1"]);
});

test("reading a breach note: the gap, restore.c and partId are checked", () => {
  const good = { seed: 1, cutAngle: 0, from: { x: 0, y: 0 }, kind: "wall", material: "brick", mark: "dust", gap: [0, 0, 100, 0], partId: "b2", restore: { c: [0, 0, 500, 0], move: 20 } };
  assert.deepEqual(readWallNote(good), good);
  assert.equal(readWallNote({ ...good, gap: [0, 0, 100] }), null);
  assert.equal(readWallNote({ ...good, gap: undefined }), null, "a wall note needs its gap");
  assert.equal(readWallNote({ ...good, restore: { c: [0, 0, "x", 0] } }), null);
  assert.equal(readWallNote({ ...good, partId: 7 }), null);
  assert.equal(readWallNote({ ...good, material: "glass" }).material, "glass", "material list is shared");
});

// ---- triggers ----
test("an area breaches a wall where its centre projects onto it, only when that point is inside the area", () => {
  const inside = (r) => (p) => Math.hypot(p.x - 250, p.y - 120) <= r;
  const at = { x: 250, y: 120 };
  assert.deepEqual(doorsInArea([plain("wood")], inside(100), scene(), "fire", [], at).map((w) => w.id), ["w1"]);
  assert.deepEqual(doorsInArea([plain("wood")], inside(50), scene(), "fire", [], at), [], "the projected point is outside");
  assert.deepEqual(doorsInArea([plain("stone")], inside(100), scene(), "fire", [], at), [], "fire does not breach stone");
  assert.deepEqual(doorsInArea([{ ...plain("wood"), flags: {} }], inside(100), scene(), "fire", [], at), []);
  // the wall's middle is not what counts: an area over one end of a long wall still breaches it
  const long = { ...plain("wood"), c: [0, 200, 2000, 200] };
  assert.deepEqual(doorsInArea([long], inside(100), scene(), "force", [], at).map((w) => w.id), ["w1"]);
  assert.deepEqual(doorsInArea([plain("wood", { levels: ["L2"] })], inside(100), scene(), "fire", ["L1"], at), [], "level");
});

test("a keg blast reaches a wall by the nearest point of it, not its middle", () => {
  const long = { ...plain("metal"), c: [0, 200, 2000, 200] };
  const hits = blastTargets({ centre: { x: 100, y: 150 }, burst: 2, grid: 100, walls: [long], scene: scene(), levels: [] });
  assert.deepEqual(hits.map((h) => h.id), ["w1"]);
  assert.deepEqual(blastTargets({ centre: { x: 100, y: 500 }, burst: 2, grid: 100, walls: [long], scene: scene(), levels: [] }), []);
});

test("a slammed Huge creature crosses a wooden wall; a Large one does not breach it", () => {
  const path = { from: { x: 250, y: 100 }, to: { x: 250, y: 300 } };
  assert.deepEqual(wallsCrossed(path, 3, [plain("wood")], scene()).map((w) => w.id), ["w1"]);
  assert.deepEqual(wallsCrossed(path, 2, [plain("wood")], scene()), []);
  assert.deepEqual(wallsCrossed(path, 3, [plain("stone")], scene()), []);
});

test("the GM tool picks the nearest breakable intact wall within half a square of the click, on the level", () => {
  const a = plain("wood"), b = { ...plain("stone"), id: "w2", c: [0, 260, 500, 260] }, door = { ...plain(), id: "d", door: 1, c: [0, 230, 500, 230] };
  assert.equal(breachWallAt({ x: 250, y: 215 }, [a, b, door], scene(), 100)?.id, "w1");
  assert.equal(breachWallAt({ x: 250, y: 250 }, [a, b], scene(), 100)?.id, "w2");
  assert.equal(breachWallAt({ x: 250, y: 400 }, [a, b], scene(), 100), null);
  assert.equal(breachWallAt({ x: 250, y: 205 }, [{ ...a, flags: {} }], scene(), 100), null, "unmarked");
  const broken = { ...a, flags: { animater: { breakWall: { wall: "yes", broken: {} } } } };
  assert.equal(breachWallAt({ x: 250, y: 205 }, [broken], scene(), 100), null, "already breached");
  assert.equal(breachWallAt({ x: 250, y: 205 }, [{ ...a, levels: ["L2"] }], scene(), 100, ["L1"]), null);
});

// ---- GM validation ----
const blastKeg = (x, y, burst = 2) => ({ id: "keg", x: x - 50, y: y - 50, width: 100, height: 100, levels: [], flags: { animater: { prop: { broken: { powder: "exploded", burst } } } } });
const raw = (from = { x: 250, y: 100 }) => ({ seed: 9, cutAngle: 0, from });

test("the GM breaches at the keg centre projected onto the wall, a 2-square gap", () => {
  const r = validWallBreakRequest({ cause: { kind: "blast", sourceId: "keg" }, note: raw() }, { wall: plain("metal"), scene: scene(), grid: 100, sender: gm, source: blastKeg(320, 120) });
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(r.note.gap, [220, 200, 420, 200]);
  assert.deepEqual(r.split.parts, [[0, 200, 220, 200], [420, 200, 500, 200]]);
  assert.equal(r.note.kind, "wall"); assert.equal(r.note.material, "metal"); assert.equal(r.note.mark, "scorch");
  assert.deepEqual(r.note.from, { x: 320, y: 120 }, "the blow comes from the keg, not the sender");
  // too far, and a player may not claim a blast
  assert.equal(validWallBreakRequest({ cause: { kind: "blast", sourceId: "keg" }, note: raw() }, { wall: plain(), scene: scene(), grid: 100, sender: gm, source: blastKeg(320, 600) }).why, "far");
  assert.equal(validWallBreakRequest({ cause: { kind: "blast", sourceId: "keg" }, note: raw() }, { wall: plain(), scene: scene(), grid: 100, sender: player, source: blastKeg(320, 120) }).why, "sender");
});

test("the GM breaches at an area's own centre projected onto the wall, refusing one that does not cover that point", () => {
  const area = (x = {}) => ({ uuid: "A", sceneId: "s", authorId: "p", rememberedAt: 1000, damageTypes: ["fire"], testPoint: (p) => Math.hypot(p.x - 250, p.y - 150) <= 100, levels: [], at: { x: 250, y: 150 }, ...x });
  const cause = { kind: "area", areaUuid: "A", damageType: "fire", at: { x: 900, y: 900 } }; // the sender's at is not used
  const r = validWallBreakRequest({ cause, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, area: area(), now: 2000 });
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(r.note.gap, [200, 200, 300, 200]);
  assert.deepEqual(r.note.from, { x: 250, y: 150 });
  assert.equal(validWallBreakRequest({ cause, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, area: area({ at: { x: 250, y: 0 }, testPoint: (p) => p.y < 150 }), now: 2000 }).why, "area");
  assert.equal(validWallBreakRequest({ cause, note: raw() }, { wall: plain("stone"), scene: scene(), grid: 100, sender: player, area: area(), now: 2000 }).why, "material");
  assert.equal(validWallBreakRequest({ cause: { ...cause, damageType: "cold" }, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, area: area({ damageTypes: ["cold"] }), now: 2000 }).why, "material");
});

test("the GM breaches a slammed wall at the path's crossing, by the mover's own size", () => {
  const cause = { kind: "path", slam: { size: 3 }, moverUuid: "T", path: { from: { x: 120, y: 100 }, to: { x: 120, y: 300 } } };
  const mover = (size) => ({ x: 120, y: 100, size, level: undefined, isOwner: true });
  const r = validWallBreakRequest({ cause, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, mover: mover(3) });
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(r.note.gap, [70, 200, 170, 200]);
  assert.equal(validWallBreakRequest({ cause, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, mover: mover(2) }).why, "material", "the GM reads a Large mover, not the claimed Huge");
  const miss = { ...cause, path: { from: { x: 120, y: 100 }, to: { x: 120, y: 180 } } };
  assert.equal(validWallBreakRequest({ cause: miss, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, mover: mover(3) }).why, "far");
  assert.equal(validWallBreakRequest({ cause, note: raw() }, { wall: plain("wood"), scene: scene(), grid: 100, sender: player, mover: { ...mover(3), isOwner: false }, senderTokens: [] }).why, "sender");
});

test("the GM tool's breach: the GM only, at the click, near the wall", () => {
  const cause = { kind: "breach", at: { x: 400, y: 210 } };
  const r = validWallBreakRequest({ cause, note: raw({ x: 400, y: 300 }) }, { wall: plain("metal"), scene: scene(), grid: 100, sender: gm });
  assert.equal(r.ok, true, r.why);
  assert.deepEqual(r.note.gap, [350, 200, 450, 200]);
  assert.deepEqual(r.note.from, { x: 400, y: 300 });
  assert.equal(validWallBreakRequest({ cause, note: raw() }, { wall: plain(), scene: scene(), grid: 100, sender: player }).why, "sender");
  assert.equal(validWallBreakRequest({ cause: { kind: "breach", at: { x: 400, y: 500 } }, note: raw() }, { wall: plain(), scene: scene(), grid: 100, sender: gm }).why, "far");
  assert.equal(validWallBreakRequest({ cause: { kind: "breach" }, note: raw() }, { wall: plain(), scene: scene(), grid: 100, sender: gm }).why, "far");
  assert.equal(validWallBreakRequest({ cause: { kind: "breach", at: { x: 400, y: 210 } }, note: raw() }, { wall: plain("wood", { door: 1 }), scene: scene(), grid: 100, sender: gm }).why, "kind", "doors have their own smash");
});

test("forged causes against a wall are refused", () => {
  const ctx = { wall: plain("wood"), scene: scene(), grid: 100, sender: player };
  for (const kind of ["smash", "force-open", "miss", "through", "attack", "ignite", "lava"]) {
    assert.equal(validWallBreakRequest({ cause: { kind, damageType: "fire", at: { x: 250, y: 210 } }, note: raw() }, ctx).why, "kind", kind);
  }
  assert.equal(validWallBreakRequest({ cause: { kind: "smash" }, note: raw() }, { ...ctx, sender: gm }).why, "kind");
  assert.equal(validWallBreakRequest({ cause: { kind: "breach", at: { x: 250, y: 210 } }, note: raw() }, { ...ctx, wall: { ...plain(), flags: {} }, sender: gm }).why, "kind", "unmarked walls never break");
  assert.equal(validWallBreakRequest({ cause: { kind: "breach", at: { x: 250, y: 210 } }, note: { cutAngle: 0 } }, { ...ctx, sender: gm }).why, "note");
  const broken = plain("wood", { flags: { animater: { breakWall: { wall: "yes", broken: { seed: 1 } } } } });
  assert.equal(validWallBreakRequest({ cause: { kind: "breach", at: { x: 250, y: 210 } }, note: raw() }, { ...ctx, wall: broken, sender: gm }).why, "broken");
});

test("a breach on another level is refused", () => {
  const cause = { kind: "path", slam: { size: 3 }, moverUuid: "T", path: { from: { x: 120, y: 100 }, to: { x: 120, y: 300 } } };
  const r = validWallBreakRequest({ cause, note: raw() }, { wall: plain("wood", { levels: ["L2"] }), scene: scene(), grid: 100, sender: player, mover: { x: 120, y: 100, size: 3, level: "L1", isOwner: true } });
  assert.equal(r.why, "far");
  const b = validWallBreakRequest({ cause: { kind: "blast", sourceId: "keg" }, note: raw() }, { wall: plain("wood", { levels: ["L2"] }), scene: scene(), grid: 100, sender: gm, source: { ...blastKeg(320, 120), levels: ["L1"] } });
  assert.equal(b.why, "far");
});

test("hand-editing either part of a breach, its position included, is the GM's own edit", () => {
  const note = { kind: "wall" };
  assert.equal(handEdited({ c: [0, 0, 1, 1] }, {}, note), true);
  assert.equal(handEdited({ c: [0, 0, 1, 1] }, { animater: { wallBreak: true } }, note), false);
  assert.equal(handEdited({ c: [0, 0, 1, 1] }, { animater: { wallRepair: true } }, note), false);
  assert.equal(handEdited({ c: [0, 0, 1, 1] }, {}), false, "a door still keeps its note when moved");
  assert.equal(handEdited({ sight: 0 }, {}, note), true);
});

// ---- look and sound ----
test("a breach sounds of its material: falling stone for stone and brick, a door burst for wood, metal clatter for metal", () => {
  const r = () => 0;
  assert.ok(TOPPLE_SOUNDS.includes(wallSound("wall", r, "stone").file));
  assert.ok(TOPPLE_SOUNDS.includes(wallSound("wall", r, "brick").file));
  assert.ok(DOOR_SOUNDS.includes(wallSound("wall", r, "wood").file));
  assert.ok(TIP_SOUNDS.includes(wallSound("wall", r, "metal").file));
});

test("a breach's wreck lies along its gap from the note alone, seeded, debris by material on the far side", () => {
  const note = (material, seed = 3) => ({ seed, cutAngle: Math.PI / 2, from: { x: 250, y: 100 }, kind: "wall", material, mark: "dust", gap: [200, 200, 300, 200] });
  for (const m of ["wood", "brick", "stone", "metal"]) {
    const L = breachWreckLayout(note(m), 100);
    assert.deepEqual(L, breachWreckLayout(note(m), 100), `${m}: the same on every client`);
    assert.notDeepEqual(L, breachWreckLayout(note(m, 4), 100), `${m}: by seed`);
    assert.ok(L.gap.poly.length >= 16, `${m}: a ragged gap`);
    for (let i = 0; i < L.gap.poly.length; i += 2) assert.ok(L.gap.poly[i] >= 180 && L.gap.poly[i] <= 320, `${m}: the gap stays over the breach`);
    assert.ok(L.planks.length >= 2, `${m}: pieces thrown`);
    const far = L.planks.filter((p) => p.y > 200).length;
    assert.ok(far >= L.planks.length / 2, `${m}: most pieces lie on the far side (from the hit)`);
  }
  assert.equal(breachWreckLayout(note("wood"), 100).look, "wood");
  assert.equal(breachWreckLayout(note("stone"), 100).look, "stone");
  assert.equal(breachWreckLayout(note("metal"), 100).look, "iron");
  assert.ok(breachWreckLayout(note("brick"), 100).planks.every((p) => p.look === "stone"));
  assert.notDeepEqual(breachWreckLayout(note("brick"), 100).planks.map((p) => p.tone), breachWreckLayout(note("stone"), 100).planks.map((p) => p.tone), "brick is red, stone grey");
});

// ---- Wall Configuration ----
test("Wall Configuration: plain walls get the wall group (No by default, Wood), doors and windows keep theirs", async () => {
  const { wallBreakFieldsHTML, propSceneFieldsHTML } = await import("../../../scripts/ui/prop-config.mjs");
  const plainHtml = wallBreakFieldsHTML({ door: 0, system: "pf2e" });
  assert.match(plainHtml, /<div data-group="wall">/);
  assert.match(plainHtml, /name="flags\.animater\.breakWall\.wall"><option value="no" selected>No<\/option>/);
  assert.match(plainHtml, /name="flags\.animater\.breakWall\.wallMaterial"><option value="wood" selected>/);
  assert.match(plainHtml, /Hardness 10, HP 40, Broken Threshold 20\./);
  assert.match(plainHtml, /data-stats-metal="Hardness 18, HP 72, Broken Threshold 36\."/);
  assert.doesNotMatch(wallBreakFieldsHTML({ door: 0, system: "dnd5e" }), /Hardness/, "Table 11-4 is PF2e's");
  assert.match(wallBreakFieldsHTML({ door: 0, own: { wall: "yes", wallMaterial: "stone" } }), /<option value="yes" selected>Yes[\s\S]*<option value="stone" selected>/);
  // a door, or a wall that is a window, hides it and its selects do not submit
  for (const html of [wallBreakFieldsHTML({ door: 1 }), wallBreakFieldsHTML({ door: 0, windowWall: true })]) {
    assert.match(html, /<div data-group="wall" hidden>/);
    assert.match(html, /breakWall\.wall" disabled/); assert.match(html, /breakWall\.wallMaterial" disabled/);
  }
  assert.match(propSceneFieldsHTML({}), /walls the GM marks breakable can be breached/);
});
