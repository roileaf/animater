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
  assert.deepEqual(Object.keys(DECOR_BREAKS).sort(), ["agave", "barrel", "bush", "cobweb", "column", "crate", "crystals", "fern", "reeds", "stalagmite"]);
  assert.deepEqual(DECOR_BREAKS.crate, { material: "wood", style: "shatter" });
  assert.deepEqual(DECOR_BREAKS.crystals, { material: "glass", style: "shatter" });
  assert.deepEqual(DECOR_BREAKS.cobweb, { material: "plant", style: "burn" });
  assert.deepEqual(DECOR_BREAKS.column, { material: "stone", style: "topple" });
  for (const k of ["rock", "boulder", "oak", "stump", "log", "puddle", "timberProps", "campfire", "rubble"]) assert.equal(DECOR_BREAKS[k], undefined, k);
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
