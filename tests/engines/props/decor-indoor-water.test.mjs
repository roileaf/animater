// The indoor and water decorations (spec Amendment 2, 2026-11-10): which break, as what, and how a throne or a bathtub
// follows what its picture is painted of.
import test from "node:test";
import assert from "node:assert/strict";
import { DECOR_BREAKS, DECOR_NAMES, decorView, decorKeyed, carryDecorBroken } from "../../../scripts/engines/props/decor-break.mjs";
import { decorSettings, decorPlacements } from "../../../scripts/engines/motion/decor-regions.mjs";
import { DECOR_KINDS, paintDecor, paintedMaterial, paintSeedOf } from "../../../scripts/engines/motion/decor-paint.mjs";
import { VARIANTS, pictureOf } from "../../../scripts/engines/motion/decorations.mjs";
import { canBreak, propMaterial, propShape } from "../../../scripts/engines/props/prop-material.mjs";
import { propTraits, breakStyle } from "../../../scripts/engines/props/prop-traits.mjs";

const grid = 100, at = { id: "R1", levels: ["L1"] };
const view = (kind, x = {}) => decorView({ d: { kind, x: 500, y: 500, size: DECOR_KINDS[kind]?.size ?? 1, turn: 0, seed: 1, flip: false, ...x }, key: kind }, at, grid);
const traits = (v) => propTraits(v, grid);
const breaks = (v, cause) => canBreak(propMaterial(v, grid), cause, { cuttable: traits(v).cuttable, rule: traits(v).rule });
const hit = (damageType) => ({ damageType });
const what = (v) => [propMaterial(v, grid), traits(v).style, propShape(v.texture.src), traits(v).contents];

test("the approved map (Amendment 2): material, style, shape and contents of each indoor and water kind", () => {
  const want = {
    bookshelf: ["wood", "collapse", "boxy", "books"], bed: ["wood", "collapse", "boxy", "none"], desk: ["wood", "collapse", "boxy", "none"],
    counter: ["wood", "collapse", "boxy", "none"], rowboat: ["wood", "shatter", "boxy", "none"],
    strongbox: ["wood", "shatter", "boxy", "none"],
    statue: ["stone", "topple", "round", "none"], altar: ["stone", "shatter", "boxy", "none"],
    pottedPlant: ["clay", "shatter", "round", "none"], rug: ["plant", "burn", "round", "none"], cattails: ["plant", "burn", "round", "none"],
  };
  for (const [kind, map] of Object.entries(want)) {
    assert.ok(DECOR_KINDS[kind], kind + " is a placeable kind");
    const v = view(kind);
    assert.deepEqual(what(v), map, kind);
    assert.ok(v.texture.src.startsWith(`decor/${kind}`), kind);
  }
  // A bed and a desk collapse onto their legs; a bookshelf and a counter fall flat. A rowboat bursts into thrown planks.
  assert.deepEqual(["bed", "desk", "bookshelf", "counter"].map((k) => traits(view(k)).legs), [true, true, false, false]);
  assert.equal(DECOR_NAMES.statue, "A statue"); assert.equal(DECOR_NAMES.mooringPost, "A mooring post");
});

test("indoor and water kinds break by their material's rules, and their own", () => {
  // Wood: a club, a blade, fire or any slam.
  for (const k of ["bookshelf", "bed", "desk", "counter", "rowboat", "strongbox"])
    assert.deepEqual([breaks(view(k), hit("bludgeoning")), breaks(view(k), hit("fire")), breaks(view(k), { slam: { size: 1 } })], [true, true, true], k);
  // A statue: force or a Large slam topples it; a club does not.
  const statue = view("statue");
  assert.deepEqual([breaks(statue, hit("force")), breaks(statue, { slam: { size: 2 } }), breaks(statue, hit("bludgeoning")), breaks(statue, { slam: { size: 1 } })], [true, true, false, false]);
  assert.equal(breakStyle(traits(statue), hit("force")), "topple");
  // An altar: force only, no slam however big.
  const altar = view("altar");
  assert.deepEqual([breaks(altar, hit("force")), breaks(altar, { slam: { size: 4 } }), breaks(altar, hit("bludgeoning"))], [true, false, false]);
  assert.equal(traits(altar).rule, "noSlam");
  // A potted plant's clay pot cracks from a club.
  assert.equal(breaks(view("pottedPlant"), hit("bludgeoning")), true);
  // A rug and cattails burn away; a club does nothing.
  for (const k of ["rug", "cattails"]) assert.deepEqual([breaks(view(k), hit("fire")), breaks(view(k), hit("bludgeoning")), breaks(view(k), { slam: { size: 2 } })], [true, false, false], k);
});

test("never break: the dock, the hearth, what is already broken and what lies in the water", () => {
  for (const k of ["dock", "hearth", "brokenFurniture", "lilyPads", "steppingStones", "streamRock", "waterDebris"]) {
    assert.ok(DECOR_KINDS[k], k + " is a placeable kind");
    assert.equal(view(k), null, k);
    assert.equal(Object.hasOwn(DECOR_BREAKS, k), false, k);
  }
});

// A canvas that paints nothing and remembers every fill colour handed to it.
const recorder = () => {
  const fills = new Set();
  const ctx = new Proxy({}, {
    get: (t, p) => (p in t ? t[p] : p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern" ? () => ({ addColorStop() {} }) : p === "getImageData" ? (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : p === "measureText" ? () => ({ width: 0 }) : () => {}),
    set: (t, p, v) => { if (p === "fillStyle" && typeof v === "string") fills.add(v); t[p] = v; return true; },
  });
  return { fills, make: (w, h) => ({ width: w, height: h, getContext: () => ctx }) };
};

test("a throne or a bathtub breaks as what its picture is painted of, the same on every screen", () => {
  const seen = { throne: new Set(), bathtub: new Set() };
  const colour = { throne: { stone: "#7e7a72", wood: "#4a2e1a" }, bathtub: { stone: "#8a867e", metal: "#a8643a", wood: "#6a5032" } };
  for (const kind of ["throne", "bathtub"]) for (let seed = 0; seed < VARIANTS * 3; seed++) {
    const d = { kind, x: 500, y: 500, size: DECOR_KINDS[kind].size, seed, turn: 0, flip: false };
    // The picture the painter uses for it (decorations.mjs) is painted from this seed.
    assert.equal(paintSeedOf(d), 7919 * (pictureOf(d).variant + 1) + kind.length);
    const material = paintedMaterial(kind, paintSeedOf(d)), { fills, make } = recorder();
    paintDecor(kind, paintSeedOf(d), 140, {}, make);
    assert.ok(fills.has(colour[kind][material]), `${kind} seed ${seed} painted as ${material}`);
    for (const [m, c] of Object.entries(colour[kind])) if (m !== material) assert.equal(fills.has(c), false, `${kind} seed ${seed} not ${m}`);
    seen[kind].add(material);
    const v = view(kind, { seed });
    assert.equal(propMaterial(v, grid), material, `${kind} seed ${seed}`);
    if (material === "stone") {
      // Stone needs force: no club, no slam.
      assert.deepEqual([breaks(v, hit("force")), breaks(v, hit("bludgeoning")), breaks(v, { slam: { size: 3 } })], [true, false, false], `${kind} ${seed}`);
      assert.equal(traits(v).style, "shatter");
    } else if (material === "wood") {
      assert.deepEqual([breaks(v, hit("bludgeoning")), breaks(v, { slam: { size: 1 } })], [true, true], `${kind} ${seed}`);
      assert.equal(traits(v).style, kind === "throne" ? "collapse" : "shatter");
    } else assert.equal(breaks(v, hit("bludgeoning")), true, `${kind} ${seed}: copper dents and bursts from a club`);
    if (kind === "bathtub") assert.equal(traits(v).contents, "water");
  }
  // Both stone and wood are painted among the looks of each (the six looks happen to hold no copper tub; one would follow metal).
  for (const kind of ["throne", "bathtub"]) for (const m of ["stone", "wood"]) assert.ok(seen[kind].has(m), kind + " " + m);
  assert.equal(decorView({ d: { kind: "bathtub", x: 0, y: 0, size: 1, seed: 0 }, key: "b" }, at, grid) && DECOR_BREAKS.bathtub.painted.metal.material, "metal");
  assert.equal(paintedMaterial("crate", 1), null);
});

const square = [[0, 0, 1000, 0, 1000, 1000, 0, 1000]];
test("a decoration painted by hand keeps its hand key when the region's Size or its kind's size scales it", () => {
  const crate = { kind: "crate", x: 300, y: 300, size: 0.8, turn: 0, seed: 5, flip: false };
  for (const raw of [{ scale: 1.5 }, { kinds: { crate: { size: 2 } } }, {}]) {
    const settings = decorSettings({ on: true, density: 0, seed: 1, kinds: { crate: {} }, brushed: [crate], ...raw });
    const keyed = decorKeyed({ id: "R1", settings, areas: square }, grid), k = keyed.find((e) => e.d.kind === "crate");
    assert.equal(k.key, "crate:300:300:h", JSON.stringify(raw));
    assert.equal(k.hand, true);
  }
  // A scattered crate is never taken for the hand one.
  const settings = decorSettings({ on: true, density: 1, seed: 1, kinds: { crate: {} }, scale: 1.5, brushed: [crate] });
  const keyed = decorKeyed({ id: "R1", settings, areas: square }, grid);
  assert.equal(keyed.filter((e) => e.hand).length, 1);
  assert.ok(keyed.filter((e) => !e.hand).every((e) => !e.key.endsWith(":h")));
  assert.equal(decorPlacements({ settings, areas: square, grid, id: "R1" }).length, keyed.length);
});

test("dragging a region carries the breaks of what was painted by hand with it; a toppled one with rubble stands again", () => {
  const n = { seed: 1, walls: [], lights: [], style: "shatter" };
  const entries = [
    { key: "crate:300:300:h", kind: "crate", x: 300, y: 300, note: n },
    { key: "barrel:400:400:abc", kind: "barrel", x: 400, y: 400, note: n },
    { key: "statue:600:600:h", kind: "statue", x: 600, y: 600, note: { ...n, style: "topple", region: "rubble1" } },
  ];
  const out = carryDecorBroken(entries, 50, -20);
  assert.deepEqual(out.map((e) => e.key), ["crate:350:280:h", "barrel:400:400:abc", "statue:600:600:h"]);
  assert.deepEqual([out[0].x, out[0].y], [350, 280]);
  assert.equal(out[0].note, n, "the note (seed and all) is the same");
  assert.equal(entries[0].key, "crate:300:300:h", "the stored list is not changed in place");
  assert.equal(carryDecorBroken([], 5, 5).length, 0);
  assert.equal(carryDecorBroken(null, 5, 5).length, 0);
});

test("the drag's own update carries the hand breaks: carryDecor says how far, main.mjs writes them in the same change", async () => {
  const { carryDecor } = await import("../../../scripts/engines/motion/decor-regions.mjs");
  const { readFileSync } = await import("node:fs");
  const shape = (x, y) => [{ type: "ellipse", x, y, radiusX: 150, radiusY: 150, hole: false }];
  const moved = carryDecor({ brushed: [{ kind: "crate", x: 300, y: 300, size: 1 }] }, shape(500, 500), shape(550, 480));
  assert.deepEqual([moved.dx, moved.dy, moved.brushed[0].x, moved.brushed[0].y], [50, -20, 350, 280]);
  const main = readFileSync(new URL("../../../scripts/main.mjs", import.meta.url), "utf8");
  const hook = main.split(/\r?\n/).find((l) => l.startsWith('Hooks.on("preUpdateRegion", (doc, change) => {'));
  assert.ok(hook, "the drag hook");
  assert.match(hook, /const broken = readDecorBroken\(doc\.flags\?\.\[ID\]\?\.decorBroken\); if \(broken\.length\) foundry\.utils\.setProperty\(change, `flags\.\$\{ID\}\.decorBroken`, carryDecorBroken\(broken, moved\.dx, moved\.dy\)\)/);
});

test("a mooring post breaks as what its picture is painted of: a log post topples from any shove, an iron bollard only from force or a Large slam", () => {
  const seen = new Set(), colour = { wood: "#5a4632", metal: "#4a4844" };
  for (let seed = 0; seed < VARIANTS * 3; seed++) {
    const d = { kind: "mooringPost", x: 500, y: 500, size: DECOR_KINDS.mooringPost.size, seed, turn: 0, flip: false };
    const material = paintedMaterial("mooringPost", paintSeedOf(d));
    // The same on every screen: from the decoration's own seed, whatever look (season, night, snow, rain) it is painted in.
    for (const look of [{}, { season: "winter", snow: 1 }, { night: true, wet: 1 }]) {
      const { fills, make } = recorder();
      paintDecor("mooringPost", paintSeedOf(d), 90, look, make);
      assert.ok(fills.has(colour[material]), `seed ${seed} ${JSON.stringify(look)} painted as ${material}`);
      assert.equal(fills.has(colour[material === "wood" ? "metal" : "wood"]), false, `seed ${seed}`);
    }
    seen.add(material);
    const v = view("mooringPost", { seed });
    assert.equal(propMaterial(v, grid), material, `seed ${seed}`);
    assert.equal(breakStyle(traits(v), { slam: { size: 2 } }), "topple");
    if (material === "wood") assert.deepEqual([breaks(v, hit("bludgeoning")), breaks(v, { slam: { size: 1 } })], [true, true], `seed ${seed}`);
    else {
      assert.deepEqual([breaks(v, hit("force")), breaks(v, { slam: { size: 2 } }), breaks(v, hit("bludgeoning")), breaks(v, { slam: { size: 1 } })], [true, true, false, false], `seed ${seed}`);
      assert.equal(traits(v).contents, "none", "an iron bollard spills nothing");
    }
  }
  assert.deepEqual([...seen].sort(), ["metal", "wood"]);
});
