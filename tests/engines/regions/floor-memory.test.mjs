import { test } from "node:test";
import assert from "node:assert/strict";
import { areaSignature, signatureDistance, rememberAreas, recallFloor, lookOf, memoryOf, toLab } from "../../../scripts/engines/regions/floor-memory.mjs";

// A width × height map of one colour, with an optional checker of a second colour (grain).
function map(width, height, [r, g, b], checker = null) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const c = checker && ((p % width) + Math.floor(p / width)) % 2 ? checker : [r, g, b];
    rgba.set([...c, 255], p * 4);
  }
  return rgba;
}
const all = (n) => Array.from({ length: n }, (_, i) => i);

test("lab matches known colours", () => {
  assert.deepEqual(toLab(255, 255, 255).map((v) => Math.round(v) + 0), [100, 0, 0]);
  assert.deepEqual(toLab(0, 0, 0).map((v) => Math.round(v) + 0), [0, 0, 0]);
  const red = toLab(255, 0, 0).map(Math.round);
  assert.deepEqual(red, [53, 80, 67]);
});

test("a flat area has no spread or grain; a checker has grain", () => {
  const flat = areaSignature(map(10, 10, [40, 90, 160]), 10, 10, all(100));
  assert.equal(flat.length, 7);
  assert.deepEqual(flat.slice(3), [0, 0, 0, 0]);
  const busy = areaSignature(map(10, 10, [120, 80, 40], [60, 40, 20]), 10, 10, all(100));
  assert.ok(busy[6] > 5, `grain ${busy[6]}`);
  assert.ok(busy[3] > 5, `spread ${busy[3]}`);
  assert.equal(areaSignature(map(2, 2, [0, 0, 0]), 2, 2, []), null);
});

test("signature reads only the area's pixels", () => {
  const rgba = map(4, 1, [0, 0, 255]);
  rgba.set([255, 255, 0, 255], 0);
  assert.notDeepEqual(areaSignature(rgba, 4, 1, [0]), areaSignature(rgba, 4, 1, [1, 2, 3]));
});

test("distance is zero for the same signature and grows with colour", () => {
  const a = [40, 0, 10, 5, 1, 2, 3];
  assert.equal(signatureDistance(a, a), 0);
  assert.ok(signatureDistance(a, [60, 0, 10, 5, 1, 2, 3]) > signatureDistance(a, [45, 0, 10, 5, 1, 2, 3]));
  assert.equal(signatureDistance(a, null), Infinity);
});

test("remembering replaces a region's old example and keeps the newest", () => {
  let mem = rememberAreas([], [{ key: "s1:r1", sig: [1, 0, 0, 0, 0, 0, 0], floor: "wood", look: { texture: "on", overWater: true } }], { now: 1 });
  mem = rememberAreas(mem, [{ key: "s1:r1", sig: [2, 0, 0, 0, 0, 0, 0], floor: "stone", look: {} }, { key: "s1:r2", sig: [3, 0, 0, 0, 0, 0, 0], floor: "grass" }], { now: 2 });
  assert.deepEqual(mem.map((e) => [e.key, e.floor]), [["s1:r1", "stone"], ["s1:r2", "grass"]]);
  const capped = rememberAreas(mem, [{ key: "x", sig: [9, 0, 0, 0, 0, 0, 0], floor: "dirt" }], { limit: 2 });
  assert.deepEqual(capped.map((e) => e.key), ["s1:r2", "x"]);
  assert.deepEqual(memoryOf([null, { floor: "wood", sig: [1] }, ...capped]).length, 2);
});

test("the look keeps only what carries to another map", () => {
  assert.deepEqual(lookOf({ floor: "water", waterKind: "river", flowTo: "e", current: "fast", texture: "off", pattern: "", edge: "0.5", overWater: false }), { waterKind: "river", texture: "off", edge: "0.5" });
  assert.deepEqual(lookOf({ floor: "wood", waterKind: "still", overWater: true, pattern: "planks" }), { overWater: true, pattern: "planks" });
});

test("recall picks the floor of the most alike example, with its look", () => {
  const mem = rememberAreas([], [
    { key: "a", sig: [20, 5, 20, 9, 2, 7, 5], floor: "wood", look: { overWater: true, pattern: "planks" } },
    { key: "b", sig: [18, -10, 9, 4, 2, 2, 2], floor: "water", look: { waterKind: "still" } },
  ]);
  const got = recallFloor(mem, [21, 5, 19, 9, 2, 7, 5]);
  assert.equal(got.floor, "wood");
  assert.deepEqual(got.look, { overWater: true, pattern: "planks" });
  assert.equal(recallFloor(mem, [80, 0, 0, 2, 0, 0, 1]), null, "nothing alike");
  assert.equal(recallFloor([], [21, 5, 19, 9, 2, 7, 5]), null);
});

test("recall holds back when another floor is nearly as alike", () => {
  const mem = rememberAreas([], [
    { key: "a", sig: [30, 0, 0, 5, 1, 1, 3], floor: "pebbles" },
    { key: "b", sig: [32, 0, 0, 5, 1, 1, 3], floor: "water" },
  ]);
  assert.equal(recallFloor(mem, [31, 0, 0, 5, 1, 1, 3]), null);
});

test("with a floor picked, only that floor's examples give the look", () => {
  const mem = rememberAreas([], [
    { key: "a", sig: [20, 5, 20, 9, 2, 7, 5], floor: "wood", look: { overWater: true } },
    { key: "b", sig: [40, 5, 20, 9, 2, 7, 5], floor: "stone", look: { texture: "off" } },
  ]);
  const got = recallFloor(mem, [21, 5, 20, 9, 2, 7, 5], { floor: "stone" });
  assert.equal(got, null, "the stone example is too far off");
  assert.equal(recallFloor(mem, [38, 5, 20, 9, 2, 7, 5], { floor: "stone" }).look.texture, "off");
});

import { gridSeeds, markAreas, NONE_FLOOR, knowsFloors } from "../../../scripts/engines/regions/floor-memory.mjs";

test("grid seeds spread over the map, cell centres", () => {
  assert.deepEqual(gridSeeds(8, 4, 2), [{ x: 2, y: 2 }, { x: 6, y: 2 }]);
  assert.equal(gridSeeds(100, 100, 4).length, 16);
});

test("knowsFloors ignores not-a-region examples", () => {
  assert.equal(knowsFloors([{ key: "a", sig: [0, 0, 0, 0, 0, 0, 0], floor: NONE_FLOOR }]), false);
  assert.equal(knowsFloors([{ key: "a", sig: [0, 0, 0, 0, 0, 0, 0], floor: "wood" }]), true);
});

// A 4 × 1 map in two halves: pixels 0-1 "dark", 2-3 "light". The segmenter returns the half under the seed.
const halves = (at) => ({ pixels: at.x < 2 ? [0, 1] : [2, 3], id: `piece-${at.x}` });
const sigOf = (pixels) => pixels[0] < 2 ? [10, 0, 0, 0, 0, 0, 0] : [90, 0, 0, 0, 0, 0, 0];

test("markAreas keeps the pieces the memory knows, and skips not-a-region and unknown ones", async () => {
  const seeds = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 3, y: 0 }];
  const memory = [{ key: "a", sig: [10, 0, 0, 0, 0, 0, 0], floor: "wood", look: { overWater: true } }];
  let cuts = 0;
  const kept = await markAreas({ width: 4, height: 1, seeds, segment: (at) => { cuts++; return halves(at); }, signatureOf: sigOf, memory, minShare: 0, maxShare: 1 });
  assert.deepEqual(kept.map((k) => [k.id, k.floor, k.auto, k.learned]), [["piece-0", "wood", true, true]]);
  assert.deepEqual(kept[0].look, { overWater: true });
  assert.equal(cuts, 2, "a seed inside a piece already looked at is skipped");
  const none = await markAreas({ width: 4, height: 1, seeds, segment: halves, signatureOf: sigOf, memory: [{ key: "n", sig: [10, 0, 0, 0, 0, 0, 0], floor: NONE_FLOOR }], minShare: 0, maxShare: 1 });
  assert.deepEqual(none, []);
});

test("markAreas never cuts inside claimed areas, drops pieces too small or too big, and can stop", async () => {
  const memory = [{ key: "a", sig: [10, 0, 0, 0, 0, 0, 0], floor: "wood" }, { key: "b", sig: [90, 0, 0, 0, 0, 0, 0], floor: "snow" }];
  const seeds = [{ x: 0, y: 0 }, { x: 3, y: 0 }];
  const claimed = await markAreas({ width: 4, height: 1, seeds, segment: halves, signatureOf: sigOf, memory, claimed: [{ pixels: [0, 1] }], minShare: 0, maxShare: 1 });
  assert.deepEqual(claimed.map((k) => k.floor), ["snow"]);
  assert.deepEqual(await markAreas({ width: 4, height: 1, seeds, segment: halves, signatureOf: sigOf, memory, maxShare: 0.4 }), []);
  const ticks = [];
  const stopped = await markAreas({ width: 4, height: 1, seeds, segment: halves, signatureOf: sigOf, memory, minShare: 0, maxShare: 1, stop: () => ticks.length >= 1, progress: (d, t) => ticks.push([d, t]) });
  assert.equal(stopped.length, 1);
  assert.deepEqual(ticks, [[1, 2]]);
});
