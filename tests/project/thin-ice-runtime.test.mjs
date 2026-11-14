import test from "node:test";
import assert from "node:assert/strict";
import { iceBreakOf, holeOutline, iceSettingsOf, breakerSquares, shardAt } from "../../scripts/engines/regions/ice-break-look.mjs";
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
    assert.equal(flat.length, 32, "16 points as x, y pairs");
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
    assert.deepEqual(iceBreakOf(r, { grid: GRID }), { holes: [], cracks: [], shards: [] });
  }
});

test("junk regions give nothing and never throw", () => {
  for (const junk of [null, undefined, {}, { id: "x" }, { id: "x", flags: null }, region("x", "junk"), region("x", { holes: { "a,b": 1, "1,1": 0 } })]) {
    assert.deepEqual(iceBreakOf(junk, { grid: GRID }), { holes: [], cracks: [], shards: [] });
  }
  assert.deepEqual(iceBreakOf(frozen, { grid: 0 }), { holes: [], cracks: [], shards: [] });
  assert.deepEqual(iceBreakOf(frozen), { holes: [], cracks: [], shards: [] });
});

test("how much the ice holds sets how wide the hole is, for every size in the list", () => {
  const span = (holds) => {
    const spec = iceBreakOf(region("r", { holes: { "0,0": 1 } }, { iceHolds: holds }), { grid: GRID }).holes[0].areas[0];
    const xs = spec.filter((_, i) => i % 2 === 0);
    return Math.max(...xs) - Math.min(...xs);
  };
  const widths = ["tiny", "sm", "med", "lg", "huge", "grg"].map(span);

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

test("shards come per hole", () => {
  const { shards } = iceBreakOf(frozen, { grid: GRID });
  assert.deepEqual(shards.map((s) => s.id), ["reg1:ice:-2,5", "reg1:ice:3,4"]);
  assert.ok(shards.every((s) => s.list.length >= 3));
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

test("the painter draws every crack line and shard, draws nothing again for the same state, and clears when it is gone", () => {
  const { look, made } = paint();
  look.sync(iceBreakOf(frozen, { grid: GRID }));
  const [cracksArt, shardsArt] = made;
  assert.ok(cracksArt.calls.filter((c) => c[0] === "lineTo").length > 0, "cracks are stroked");
  assert.ok(shardsArt.calls.some((c) => c[0] === "drawPolygon"), "shards are filled polygons");
  const before = JSON.stringify([cracksArt.calls, shardsArt.calls]);
  look.sync(iceBreakOf(frozen, { grid: GRID }));
  assert.equal(JSON.stringify([cracksArt.calls, shardsArt.calls]), before, "same state, same drawing");
  look.sync({ holes: [], cracks: [], shards: [] });
  assert.deepEqual([cracksArt.calls, shardsArt.calls], [[], []], "nothing stored, nothing drawn");
  assert.equal(look.busy, false);
});

test("a shard floats: it moves with the clock, stays by its place, and is the same on every client at the same time", () => {
  const { shards } = iceBreakOf(frozen, { grid: GRID });
  for (const shard of shards.flatMap((s) => s.list)) {
    const seen = new Set();
    for (let t = 0; t < 30; t += 0.5) {
      const at = shardAt(shard, t);
      assert.ok(Math.hypot(at.x - shard.x, at.y - shard.y) <= shard.r * 0.45 * Math.SQRT2 + 1e-9, "stays close to where it floats");
      seen.add(`${at.x.toFixed(3)},${at.y.toFixed(3)}`);
    }
    assert.ok(seen.size > 10, "it is not sitting still");
    assert.deepEqual(shardAt(shard, 12.5), shardAt({ ...shard }, 12.5), "same time, same place");
  }
  const [a, b] = shards.flatMap((s) => s.list);
  assert.notDeepEqual(shardAt(a, 3), { ...shardAt(b, 3), x: shardAt(b, 3).x - (b.x - a.x), y: shardAt(b, 3).y - (b.y - a.y) }, "each shard drifts out of step");
});

test("the painter moves its shards on tick, keeps its cracks still, and two screens at one time draw alike", () => {
  const one = paint(), two = paint(), state = iceBreakOf(frozen, { grid: GRID });
  assert.equal(one.look.busy, false);
  one.look.sync(state); two.look.sync(state);
  assert.equal(one.look.busy, true);
  const cracksBefore = JSON.stringify(one.made[0].calls);
  one.look.tick(1000); two.look.tick(1000);
  const at1 = JSON.stringify(one.made[1].calls);
  assert.equal(at1, JSON.stringify(two.made[1].calls), "the same clock gives the same drawing");
  one.look.tick(2500);
  assert.notEqual(JSON.stringify(one.made[1].calls), at1, "later, the shards have drifted");
  assert.equal(JSON.stringify(one.made[0].calls), cracksBefore, "the cracks do not move");
});

test("a map with no thin ice makes no layer at all", () => {
  const { PIXI, made } = fakePIXI();
  let asked = 0;
  const look = createIceBreakLook({ PIXI, layer: () => { asked++; return new PIXI.Container(); }, grid: () => GRID });
  look.sync({ cracks: [], shards: [] });
  look.sync();
  assert.equal(asked, 0);
  assert.equal(made.length, 0);
});
