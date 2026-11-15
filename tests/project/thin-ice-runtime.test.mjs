import test from "node:test";
import assert from "node:assert/strict";
import { iceBreakOf, holeOutline, iceSettingsOf, breakerSquares, shardAt , plateAt } from "../../scripts/engines/regions/ice-break-look.mjs";
import { createIceBreakLook } from "../../scripts/engines/regions/ice-break-draw.mjs";

const GRID = 100;
const region = (id, ice, extra = {}) => ({ id, flags: { animater: { iceThin: true, thinIce: ice, ...extra } } });
const frozen = region("reg1", { cracks: { "1,1": 1 }, holes: { "3,4": 1, "-2,5": 1 } });

test("a region with two holes contributes two water specs with their own stable ids", () => {
  const { holes } = iceBreakOf(frozen, { grid: GRID });
  assert.equal(holes.length, 2);
  assert.deepEqual(holes.map((h) => h.id), ["reg1:ice:-2,5", "reg1:ice:3,4"]);
  assert.ok(holes.every((h) => h.id !== "reg1"), "never the region's own id");
  assert.ok(holes.every((h) => h.watery === true && h.keeps === true && h.kind === "still"));
});

test("a hole's area is a flat x, y list the water engine reads, with the ring's own points", () => {
  const { holes } = iceBreakOf(frozen, { grid: GRID });
  for (const spec of holes) {
    assert.equal(spec.areas.length, 1);
    const flat = spec.areas[0];
    assert.ok(flat.every((n) => typeof n === "number" && Number.isFinite(n)), "numbers, not {x, y} objects");
    assert.equal(flat.length % 2, 0, "x, y pairs");
    assert.ok(flat.length >= 16 && flat.length <= 40, `a few points round an angular opening, not a circle of them: ${flat.length / 2}`);
  }
  const ring = holeOutline("3,4", { grid: GRID, seed: 0, size: 2 });
  const spec = holes.find((h) => h.id === "reg1:ice:3,4");
  assert.equal(spec.areas[0].length, ring.length * 2);
});

test("the same stored state twice gives byte-identical specs, so the water engine's cache holds", () => {
  const again = region("reg1", { holes: { "-2,5": 1, "3,4": 1 }, cracks: { "1,1": 1 } });
  assert.equal(JSON.stringify(iceBreakOf(frozen, { grid: GRID })), JSON.stringify(iceBreakOf(again, { grid: GRID })));
  assert.equal(JSON.stringify(iceBreakOf(frozen, { grid: GRID })), JSON.stringify(iceBreakOf(frozen, { grid: GRID })));
});

test("a different region draws its break differently, and the same region draws it the same", () => {
  const a = iceBreakOf(region("regA", { holes: { "3,4": 1 } }), { grid: GRID }).holes[0].areas;
  const b = iceBreakOf(region("regB", { holes: { "3,4": 1 } }), { grid: GRID }).holes[0].areas;
  assert.notDeepEqual(a, b);
});

test("a region with thin ice off contributes nothing, even with a break stored", () => {
  for (const off of [false, undefined, "true", 1]) {
    const r = { id: "reg1", flags: { animater: { iceThin: off, thinIce: { cracks: { "1,1": 1 }, holes: { "3,4": 1 } } } } };
    assert.deepEqual(iceBreakOf(r, { grid: GRID }), { holes: [], cracks: [], shards: [], plates: [] });
  }
});

test("junk regions give nothing and never throw", () => {
  for (const junk of [null, undefined, {}, { id: "x" }, { id: "x", flags: null }, region("x", "junk"), region("x", { holes: { "a,b": 1, "1,1": 0 } })]) {
    assert.deepEqual(iceBreakOf(junk, { grid: GRID }), { holes: [], cracks: [], shards: [], plates: [] });
  }
  assert.deepEqual(iceBreakOf(frozen, { grid: 0 }), { holes: [], cracks: [], shards: [], plates: [] });
  assert.deepEqual(iceBreakOf(frozen), { holes: [], cracks: [], shards: [], plates: [] });
});

test("how much the ice holds sets how wide the hole is, for every size in the list", () => {
  // A hole stored with no width of its own (`true`): what the limit says is as much as the screen knows.
  const span = (holds, stored = true) => {
    const spec = iceBreakOf(region("r", { holes: { "0,0": stored } }, { iceHolds: holds }), { grid: GRID }).holes[0].areas[0];
    const xs = spec.filter((_, i) => i % 2 === 0);
    return Math.max(...xs) - Math.min(...xs);
  };
  // The width the ice stored for the creature that fell through is what is drawn, whatever the limit is.
  // Ice that holds up to Large is broken by a Huge creature, so the width stored for a Huge one is the width that limit draws.
  assert.equal(span("med", 3), span("lg"), "a Huge creature, through Medium ice, leaves the hole Large ice would");
  assert.equal(span("med", 1), span("tiny"), "and a Small one the hole of a Small");
  const widths = ["tiny", "sm", "med", "lg", "huge", "grg"].map((holds) => span(holds));

  assert.ok(span("sm") < span("med") && span("med") < span("lg") && span("lg") < span("huge") && span("huge") <= span("grg"), widths.join(" "));
  assert.equal(span("tiny"), span("sm"), "a Tiny breaker is as wide as a Small one");
  assert.equal(span("med"), span(undefined), "Medium is the default");
  assert.equal(span("med"), span("banana"), "an unknown limit reads as the default");
});

test("a Huge or Tiny limit is read as itself, not as Medium", () => {
  for (const size of ["tiny", "sm", "med", "lg", "huge", "grg"]) assert.equal(iceSettingsOf({ flags: { animater: { iceThin: true, iceHolds: size } } }).holds, size);
  assert.equal(iceSettingsOf({ flags: { animater: { iceHolds: "banana" } } }).holds, "med");
  // The first size over the limit breaks it: Tiny ice gives way under Small, Huge ice under Gargantuan.
  assert.equal(breakerSquares("tiny"), 1);
  assert.equal(breakerSquares("med"), 2);
  assert.equal(breakerSquares("huge"), 4);
});

test("cracks come per cracked square, inside it, and a square that is a hole shows no crack", () => {
  const r = region("reg1", { cracks: { "1,1": 1, "3,4": 1 }, holes: { "3,4": 1 } });
  const { cracks } = iceBreakOf(r, { grid: GRID });
  assert.deepEqual(cracks.map((c) => c.id), ["reg1:ice:1,1"]);
  for (const line of cracks[0].lines) for (const p of line) assert.ok(p.x >= 100 && p.x <= 200 && p.y >= 100 && p.y <= 200);
});

test("plates come per hole", () => {
  const { plates, shards } = iceBreakOf(frozen, { grid: GRID });
  assert.deepEqual(plates.map((p) => p.id), ["reg1:ice:-2,5", "reg1:ice:3,4"]);
  assert.ok(plates.every((p) => p.list.length >= 3), "a sheet comes apart into slabs you can count");
  assert.deepEqual(shards, [], "and leaves no loose chips: those are what a fire melt leaves");
});

// A stand-in for PIXI: records what is drawn, so the painter is tested without a canvas.
const fakePIXI = () => {
  const made = [];
  class Container { constructor() { this.children = []; this.destroyed = false; } addChild(c) { c.parent = this; this.children.push(c); return c; } removeChild(c) { this.children = this.children.filter((x) => x !== c); } destroy() { this.destroyed = true; } }
  class Graphics extends Container {
    constructor() { super(); this.calls = []; made.push(this); }
    clear() { this.calls = []; return this; }
    lineStyle(...a) { this.calls.push(["lineStyle", ...a]); return this; }
    beginFill(...a) { this.calls.push(["beginFill", ...a]); return this; }
    endFill() { return this; }
    moveTo(...a) { this.calls.push(["moveTo", ...a]); return this; }
    lineTo(...a) { this.calls.push(["lineTo", ...a]); return this; }
    drawPolygon(...a) { this.calls.push(["drawPolygon", ...a]); return this; }
    closePath() { return this; }
  }
  return { PIXI: { Container, Graphics }, made };
};

const paint = () => {
  const { PIXI, made } = fakePIXI();
  const layer = new PIXI.Container();
  return { look: createIceBreakLook({ PIXI, layer: () => layer, grid: () => GRID }), made };
};

test("the painter draws every crack line and plate, draws nothing again for the same state, and clears when it is gone", () => {
  const { look, made } = paint();
  look.sync(iceBreakOf(frozen, { grid: GRID }));
  const [waterArt, cracksArt, platesArt, shardsArt] = made;
  assert.ok(cracksArt.calls.filter((c) => c[0] === "lineTo").length > 0, "cracks are stroked");
  assert.ok(platesArt.calls.some((c) => c[0] === "drawPolygon"), "the plates are filled polygons");
  assert.ok(waterArt.calls.some((c) => c[0] === "drawPolygon"), "the open water of the hole is painted here too, not left to the moving water alone");
  const before = JSON.stringify([waterArt.calls, cracksArt.calls, platesArt.calls, shardsArt.calls]);
  look.sync(iceBreakOf(frozen, { grid: GRID }));
  assert.equal(JSON.stringify([waterArt.calls, cracksArt.calls, platesArt.calls, shardsArt.calls]), before, "same state, same drawing");
  look.sync({ holes: [], cracks: [], shards: [], plates: [] });
  assert.deepEqual([waterArt.calls, cracksArt.calls, platesArt.calls, shardsArt.calls], [[], [], [], []], "nothing stored, nothing drawn");
  assert.equal(look.busy, false);
});

test("a plate rides: it moves with the clock, barely leaves its place, and every client rides it alike", () => {
  const { plates } = iceBreakOf(frozen, { grid: GRID });
  const list = plates.flatMap((p) => p.list);
  assert.ok(list.length >= 3, "a broken sheet is in plates");
  for (const plate of list) {
    const seen = new Set();
    for (let t = 0; t < 30; t += 0.5) {
      const at = plateAt(plate, t);
      assert.ok(Math.hypot(at.dx, at.dy) <= GRID * 0.05, "a slab stays where it broke");
      seen.add(`${at.dx.toFixed(3)},${at.dy.toFixed(3)}`);
    }
    assert.ok(seen.size > 10, "it is not sitting still");
    assert.deepEqual(plateAt(plate, 12.5), plateAt({ ...plate }, 12.5), "same time, same place");
  }
  const [a, b] = list;
  assert.notDeepEqual(plateAt(a, 3), plateAt(b, 3), "each plate rides out of step with the next");
});

test("the painter moves its plates on tick, keeps its cracks still, and two screens at one time draw alike", () => {
  const one = paint(), two = paint(), state = iceBreakOf(frozen, { grid: GRID });
  assert.equal(one.look.busy, false);
  one.look.sync(state); two.look.sync(state);
  assert.equal(one.look.busy, true);
  const cracksBefore = JSON.stringify(one.made[1].calls);
  one.look.tick(1000); two.look.tick(1000);
  const at1 = JSON.stringify(one.made[2].calls);
  assert.equal(at1, JSON.stringify(two.made[2].calls), "the same clock gives the same drawing");
  one.look.tick(2500);
  assert.notEqual(JSON.stringify(one.made[2].calls), at1, "later, the plates have ridden on");
  assert.equal(JSON.stringify(one.made[1].calls), cracksBefore, "the cracks do not move");
});

test("a map with no thin ice makes no layer at all", () => {
  const { PIXI, made } = fakePIXI();
  let asked = 0;
  const look = createIceBreakLook({ PIXI, layer: () => { asked++; return new PIXI.Container(); }, grid: () => GRID });
  look.sync({ cracks: [], shards: [], plates: [] });
  look.sync();
  assert.equal(asked, 0);
  assert.equal(made.length, 0);
});
