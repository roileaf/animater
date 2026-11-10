import test from "node:test";
import assert from "node:assert/strict";
import { DECOR_BREAKS, decorFingerprint, decorKeyed, decorView, readDecorBroken, liveBroken, createDecorIndex, decorTargets } from "../../../scripts/engines/props/decor-break.mjs";
import { decorSettings } from "../../../scripts/engines/motion/decor-regions.mjs";
import { canBreak, propMaterial, propShape } from "../../../scripts/engines/props/prop-material.mjs";
import { propTraits, breakStyle } from "../../../scripts/engines/props/prop-traits.mjs";

const grid = 100, square = [0, 0, 1000, 0, 1000, 1000, 0, 1000];
const raw = (x = {}) => ({ on: true, where: "surface", density: 1, scale: 1, seed: 7, kinds: { crate: {}, barrel: {}, bush: {}, rock: {} }, brushed: [], erased: [], ...x });
const region = (x = {}, extra = {}) => ({ id: "R1", levels: ["L1"], settings: decorSettings(raw(x)), areas: [square], ...extra });
const hand = { kind: "crate", x: 300, y: 300, size: 0.8, turn: 0, seed: 5, flip: false };
const note = { seed: 1, cutAngle: 0, pattern: "diced", pieces: 3, spread: 0.4, spin: 70, tint: "none", mark: "dust", from: { x: 0, y: 0 }, walls: [], style: "shatter", lights: [] };

test("which kinds break, and as what", () => {
  assert.deepEqual(Object.keys(DECOR_BREAKS).sort(), ["agave", "altar", "barrel", "bathtub", "bed", "bedroll", "beehive", "bench", "bookshelf", "brazier", "bush", "cage", "candles", "cart", "cattails", "cobweb", "coffin", "column", "counter", "crate", "crystals", "desk", "fence", "fern", "firewood", "haystack", "kennel", "lampPost", "marketStall", "mooringPost", "nest", "planter", "pottedPlant", "produce", "reeds", "rowboat", "rug", "sacks", "sarcophagus", "signpost", "stakeFence", "stalagmite", "statue", "strawBed", "strongbox", "tableStools", "tent", "throne", "tombstone", "trough", "urns", "washtub"]);
  assert.deepEqual(DECOR_BREAKS.crate, { material: "wood", style: "shatter" });
  assert.deepEqual(DECOR_BREAKS.crystals, { material: "glass", style: "shatter" });
  assert.deepEqual(DECOR_BREAKS.cobweb, { material: "plant", style: "burn" });
  assert.deepEqual(DECOR_BREAKS.column, { material: "stone", style: "topple" });
  for (const k of ["rock", "boulder", "oak", "stump", "log", "puddle", "timberProps", "campfire", "rubble", "brokenPillar", "boneRubble"]) assert.equal(DECOR_BREAKS[k], undefined, k);
});

test("a decoration as a prop: the rules read it like a tile", () => {
  const d = { kind: "crate", x: 500, y: 400, size: 0.8, turn: 0, seed: 1, flip: false }, at = { id: "R1", levels: ["L1"] };
  const v = decorView({ d, key: "k" }, at, grid);
  assert.deepEqual([v.id, v.x, v.y, v.width, v.height, v.hidden], ["decor:R1:k", 460, 360, 80, 80, false]);
  assert.deepEqual(v.levels, ["L1"]); assert.equal(v.decor.kind, "crate"); assert.equal(v.decor.d, d);
  assert.equal(propMaterial(v, grid), "wood"); assert.equal(propShape(v.texture.src), "boxy");
  assert.equal(propShape(decorView({ d: { ...d, kind: "barrel" }, key: "b" }, at, grid).texture.src), "round");
  const web = decorView({ d: { ...d, kind: "cobweb" }, key: "w" }, at, grid);
  assert.equal(propTraits(web, grid).cuttable, true);
  assert.equal(canBreak("plant", { slam: { size: 3 } }), false);
  const stal = decorView({ d: { ...d, kind: "stalagmite" }, key: "s" }, at, grid);
  assert.equal(breakStyle(propTraits(stal, grid), { damageType: "force" }), "topple");
  assert.equal(canBreak(propMaterial(stal, grid), { slam: { size: 1 } }), false);
  assert.equal(canBreak(propMaterial(stal, grid), { slam: { size: 2 } }), true);
  assert.equal(decorView({ d: { ...d, kind: "rock" }, key: "r" }, at, grid), null);
});

test("keys: kind, place to the pixel, and the scatter's fingerprint; a hand-placed one keeps its key", () => {
  const a = decorKeyed(region(), grid).map((k) => k.key), b = decorKeyed(region(), grid).map((k) => k.key);
  assert.ok(a.length > 5); assert.deepEqual(a, b);
  assert.ok(a.every((k) => /^[a-zA-Z]+:-?\d+:-?\d+:[0-9a-z]+$/.test(k)));
  const reshuffled = new Set(decorKeyed(region({ seed: 8 }), grid).map((k) => k.key));
  assert.ok(a.every((k) => !reshuffled.has(k)), "a reshuffle moves every scattered key");
  assert.notEqual(decorFingerprint(region({ density: 1.2 }), grid), decorFingerprint(region(), grid));
  assert.notEqual(decorFingerprint(region({ erased: [[500, 500, 50]] }), grid), decorFingerprint(region(), grid));
  assert.equal(decorFingerprint(region({ canBreak: true, brushed: [hand] }), grid), decorFingerprint(region(), grid));
  for (const seed of [7, 8]) assert.ok(decorKeyed(region({ seed, brushed: [hand] }), grid).some((k) => k.hand && k.key === "crate:300:300:h"));
});

test("the fingerprint and the memo see an area's holes (a property JSON drops from the array)", () => {
  const holed = () => Object.assign([...square], { holes: [[400, 400, 600, 400, 600, 600, 400, 600]] });
  const plain = region(), withHole = region({}, { areas: [holed()] });
  assert.notEqual(decorFingerprint(withHole, grid), decorFingerprint(plain, grid));
  const index = createDecorIndex();
  const a = index(plain, grid), b = index(withHole, grid);
  assert.notEqual(a, b, "same id, new holes: the memo rebuilds");
  assert.ok(b.keys.size > 0);
});

test("stored breaks: only well-formed entries; live ones only where their decoration still stands", () => {
  const good = { key: "crate:1:2:h", kind: "crate", x: 1, y: 2, note };
  assert.deepEqual(readDecorBroken([good, { ...good, kind: "rock" }, { ...good, note: { evil: 1 } }, { ...good, x: "a" }, null]).map((e) => e.key), ["crate:1:2:h"]);
  assert.deepEqual(readDecorBroken("nope"), []);
  assert.deepEqual(readDecorBroken([{ ...good, key: "" }, { ...good, key: "k".repeat(161) }, { ...good, key: "k".repeat(160) }]).map((e) => e.key.length), [160]);
  assert.equal(readDecorBroken(Array.from({ length: 700 }, (_, i) => ({ ...good, key: "k" + i }))).length, 600);
  assert.deepEqual(liveBroken([good, { ...good, key: "gone" }], new Set(["crate:1:2:h"])).map((e) => e.key), ["crate:1:2:h"]);
});

test("targets: switched-on regions only, breakable and unbroken, on the index's memo", () => {
  const index = createDecorIndex(), on = region({ canBreak: true });
  assert.equal(index(on, grid), index(on, grid), "memoised");
  assert.equal(index(region({ canBreak: false }), grid), index(on, grid), "the switch does not rebuild the keys");
  assert.deepEqual(decorTargets([region()], grid, index), []);
  const views = decorTargets([on], grid, index);
  assert.ok(views.length > 0 && views.every((v) => ["crate", "barrel", "bush"].includes(v.decor.kind)));
  const first = views[0], broken = [{ key: first.decor.key, kind: first.decor.kind, x: 0, y: 0, note }];
  assert.ok(!decorTargets([{ ...on, broken }], grid, index).some((v) => v.id === first.id));
  const stale = [{ key: "crate:1:1:zzz", kind: "crate", x: 1, y: 1, note }];
  assert.equal(decorTargets([{ ...on, broken: stale }], grid, index).length, views.length, "a stale break is ignored");
});

// ---- the GM's check, the stored list, repair ----
import { validDecorBreakRequest, decorBrokenAfter, decorRepairUpdates, decorRegionRepair, decorRubbleId, DECOR_BREAK_MESSAGE } from "../../../scripts/engines/props/decor-break.mjs";
import { breakNoteFor } from "../../../scripts/engines/props/prop-requests.mjs";

const scene = (flags = {}) => ({ id: "s", flags: { animater: { breakableProps: true, ...flags } } });
const gm = { id: "gm", isGM: true, viewedScene: "s" }, player = { id: "p", viewedScene: "s" };
const index = createDecorIndex();
const on = (x = {}, extra = {}) => region({ canBreak: true, ...x }, extra);
const pick = (r, kind) => index(r, grid).views.find((v) => v.decor.kind === kind);
const bash = (v, damageType = "bludgeoning") => ({ kind: "area", damageType, at: { x: v.x + v.width / 2, y: v.y + v.height / 2 } });
const ask = (v, cause = bash(v), extra = {}) => ({ key: v.decor.key, cause, note: breakNoteFor({ tile: v, walls: [], grid, cause, seed: 42, from: cause.at, scene: scene() }), ...extra });
const ctx = (r, x = {}) => ({ region: r, scene: scene(), grid, sender: gm, now: 5000, index, ...x });

test("the message name", () => { assert.equal(DECOR_BREAK_MESSAGE, "decor-break"); });

test("a GM's area breaks a crate: the entry names it, no walls, no lights", () => {
  const r = on(), crate = pick(r, "crate"), out = validDecorBreakRequest(ask(crate), ctx(r));
  assert.equal(out.ok, true);
  assert.deepEqual([out.entry.key, out.entry.kind, out.entry.x, out.entry.y], [crate.decor.key, "crate", Math.round(crate.decor.d.x), Math.round(crate.decor.d.y)]);
  assert.deepEqual(out.entry.note.walls, []); assert.deepEqual(out.entry.note.lights, []); assert.equal(out.entry.note.seed, 42);
});

test("refused: either switch off, a key that is not a breakable decoration, already broken or queued", () => {
  const r = on(), crate = pick(r, "crate"), req = ask(crate);
  assert.deepEqual(validDecorBreakRequest(req, ctx(r, { scene: scene({ breakableProps: false }) })), { ok: false, why: "off" });
  assert.deepEqual(validDecorBreakRequest(req, ctx(region())), { ok: false, why: "off" });
  assert.deepEqual(validDecorBreakRequest({ ...req, key: index(r, grid).keyed.find((k) => k.d.kind === "rock").key }, ctx(r)), { ok: false, why: "missing" });
  assert.deepEqual(validDecorBreakRequest(req, ctx(on({ seed: 8 }))), { ok: false, why: "missing" }); // reshuffled since
  assert.deepEqual(validDecorBreakRequest(req, ctx({ ...r, id: "R2" })), { ok: false, why: "missing" }); // another region's key
  const stored = [{ key: crate.decor.key, kind: "crate", x: 0, y: 0, note: req.note }];
  assert.deepEqual(validDecorBreakRequest(req, ctx({ ...r, broken: stored })), { ok: false, why: "broken" });
  assert.deepEqual(validDecorBreakRequest(req, ctx(r, { queued: [crate.decor.key] })), { ok: false, why: "broken" });
});

test("refused: forged walls, a player's blast, a damage the material shrugs off; a forged style is corrected", () => {
  const r = on(), crate = pick(r, "crate"), bush = pick(r, "bush");
  assert.deepEqual(validDecorBreakRequest({ ...ask(crate), note: { ...ask(crate).note, walls: ["w1"] } }, ctx(r)), { ok: false, why: "wall" });
  assert.deepEqual(validDecorBreakRequest(ask(crate, { kind: "blast", sourceId: "keg" }), ctx(r, { sender: player })), { ok: false, why: "sender" });
  assert.deepEqual(validDecorBreakRequest(ask(crate, bash(crate, "cold")), ctx(r)), { ok: false, why: "material" });
  assert.deepEqual(validDecorBreakRequest(ask(bush, bash(bush, "slashing")), ctx(r)), { ok: false, why: "material" });
  assert.equal(validDecorBreakRequest({ ...ask(crate), note: { ...ask(crate).note, style: "topple" } }, ctx(r)).entry.note.style, "shatter");
  assert.equal(validDecorBreakRequest(ask(bush, bash(bush, "fire")), ctx(r)).entry.note.style, "burn");
});

test("a cobweb is cut; a stalagmite topples from force with rubble when the scene says so; an area on another level misses", () => {
  // (both also put down by hand, so the seeded scatter cannot leave either out)
  const byHand = [{ kind: "cobweb", x: 200, y: 200, size: 1, turn: 0, seed: 1, flip: false }, { kind: "stalagmite", x: 600, y: 600, size: 0.7, turn: 0, seed: 2, flip: false }];
  const cave = on({ where: "cave", kinds: { cobweb: {}, stalagmite: {} }, brushed: byHand }), web = pick(cave, "cobweb"), stal = pick(cave, "stalagmite");
  assert.equal(validDecorBreakRequest(ask(web, bash(web, "slashing")), ctx(cave)).entry.note.style, "split");
  const fell = validDecorBreakRequest(ask(stal, bash(stal, "force")), ctx(cave, { scene: scene({ rubbleDifficult: true }) }));
  assert.equal(fell.entry.note.style, "topple"); assert.ok(fell.rubble && fell.fall);
  assert.equal(validDecorBreakRequest(ask(stal, bash(stal, "force")), ctx(cave)).rubble, null);
  const AREA = "Scene.s.Region.a", cause = { ...bash(stal, "force"), areaUuid: AREA };
  const area = { uuid: AREA, sceneId: "s", authorId: "p", rememberedAt: 1000, damageTypes: ["acid", "bludgeoning", "cold", "electricity", "fire", "force", "piercing", "slashing", "sonic", "vitality", "void", "mental", "poison", "spirit", "bleed"], testPoint: () => true, levels: ["L2"] };
  assert.deepEqual(validDecorBreakRequest(ask(stal, cause), ctx(cave, { sender: player, area })), { ok: false, why: "area" });
  assert.equal(validDecorBreakRequest(ask(stal, cause), ctx(cave, { sender: player, area: { ...area, levels: ["L1"] } })).ok, true);
});

test("the stored list: stale entries pruned, nothing twice", () => {
  const a = { key: "a", kind: "crate", x: 0, y: 0, note }, b = { ...a, key: "b" }, gone = { ...a, key: "gone" };
  assert.deepEqual(decorBrokenAfter([a, gone], [b, a], new Set(["a", "b"])).map((e) => e.key), ["a", "b"]);
});

test("repair: every region's breaks; one region's breaks and its own rubble", () => {
  const regions = [{ id: "R1", flags: { animater: { decorBroken: [{ key: "a" }] } } }, { id: "R2", flags: { animater: { decorBroken: [] } } },
    { id: "rub1", flags: { animater: { propRubble: decorRubbleId("R1") } } }, { id: "rub2", flags: { animater: { propRubble: "tileX" } } }];
  assert.deepEqual(decorRepairUpdates(regions), [{ _id: "R1", "flags.animater.-=decorBroken": null }]);
  assert.deepEqual(decorRegionRepair(regions[0], regions), { update: { _id: "R1", "flags.animater.-=decorBroken": null }, deleteRegions: ["rub1"] });
  assert.deepEqual(decorRegionRepair(regions[1], regions), { update: null, deleteRegions: [] });
});

import { decorWreckChanges } from "../../../scripts/engines/props/decor-break.mjs";
test("which wrecks to draw, keep, settle or take away", () => {
  const n = (seed) => ({ seed }), m = (o) => new Map(Object.entries(o));
  const wanted = [{ id: "a", note: n(1) }, { id: "b", note: n(2) }, { id: "c", note: n(3) }, { id: "d", note: n(4) }];
  const r = decorWreckChanges({ shown: m({ a: 1, gone: 9, mine: 7 }), wanted, pending: m({ b: 2, mine: 7 }), late: m({ c: 3 }), animate: true });
  assert.deepEqual(r.settle, ["b"]);
  assert.deepEqual(r.show.map((s) => [s.id, s.animate]), [["c", false], ["d", true]]);
  assert.deepEqual(r.hide, ["gone"]);
  assert.deepEqual(decorWreckChanges({ shown: m({ a: 1 }), wanted: [{ id: "a", note: n(5) }], pending: m({}), late: m({}), animate: false }).show.map((s) => s.id), ["a"]);
});

// ---- the shared pickers take decoration views as they are ----
import { propsInArea, propsOnPath, propNextToMiss } from "../../../scripts/engines/props/prop-pick.mjs";
import { blastTargets } from "../../../scripts/engines/props/prop-blast.mjs";
test("areas, misses, paths and blasts pick decoration views like tiles", () => {
  const r = on(), views = decorTargets([r], grid, index), crate = views.find((v) => v.decor.kind === "crate");
  const c = { x: crate.x + crate.width / 2, y: crate.y + crate.height / 2 };
  assert.ok(propsInArea(views, (p) => Math.hypot(p.x - c.x, p.y - c.y) < 1, grid, "bludgeoning").includes(crate));
  assert.ok(!propsInArea(views, () => true, grid, "cold").some((v) => v.decor.kind === "crate"));
  assert.ok(propsOnPath([{ x: c.x - 300, y: c.y }, { x: c.x + 300, y: c.y }], 1, views, grid).includes(crate));
  const target = { x: c.x + crate.width / 2 + 1, y: c.y - 50, w: 100, h: 100 };
  assert.equal(propNextToMiss({ attacker: { x: target.x + 400, y: c.y }, target }, [crate], grid, "bludgeoning"), crate);
  assert.equal(propNextToMiss({ attacker: { x: c.x - 400, y: c.y }, target }, [crate], grid, "bludgeoning"), null, "never on the attacker's side");
  assert.ok(blastTargets({ centre: c, burst: 1, grid, tiles: [crate], walls: [], scene: scene(), levels: ["L1"], sourceId: "keg" }).some((t) => t.id === crate.id));
});

test("the placements memo forgets a deleted region, and everything when the canvas goes", () => {
  const index = createDecorIndex(), r = (id) => ({ id, levels: [], settings: decorSettings({ on: true, where: "cave", density: 0, seed: 3, kinds: {}, brushed: [{ kind: "crate", x: 100, y: 100, size: 0.8, turn: 0, seed: 1, flip: false }] }), areas: [[0, 0, 500, 0, 500, 500, 0, 500]] });
  const a = index(r("A"), 100), b = index(r("B"), 100);
  assert.equal(index(r("A"), 100), a, "remembered");
  index.forget("A");
  assert.notEqual(index(r("A"), 100), a, "worked out again");
  assert.equal(index(r("B"), 100), b, "the others kept");
  index.clear();
  assert.notEqual(index(r("B"), 100), b);
});
