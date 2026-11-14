import test from "node:test";
import assert from "node:assert/strict";
import { iceBreakOf, holeOutline } from "../../scripts/engines/regions/ice-break-look.mjs";
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

test("how much the ice holds sets how wide the hole is", () => {
  const span = (holds) => {
    const spec = iceBreakOf(region("r", { holes: { "0,0": 1 } }, { iceHolds: holds }), { grid: GRID }).holes[0].areas[0];
    const xs = spec.filter((_, i) => i % 2 === 0);
    return Math.max(...xs) - Math.min(...xs);
  };
  assert.ok(span("sm") < span("med") && span("med") < span("lg"));
  assert.equal(span("med"), span(undefined), "Medium is the default");
  assert.equal(span("med"), span("banana"), "an unknown limit reads as the default");
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

test("the painter draws every crack line and shard, draws nothing again for the same state, and clears when it is gone", () => {
  const { PIXI, made } = fakePIXI();
  const layer = new PIXI.Container();
  const look = createIceBreakLook({ PIXI, layer: () => layer, grid: () => GRID });
  const state = iceBreakOf(frozen, { grid: GRID });
  look.sync(state);
  const art = made[0];
  const lines = art.calls.filter((c) => c[0] === "lineTo").length;
  assert.ok(lines > 0, "cracks are stroked");
  assert.ok(art.calls.some((c) => c[0] === "drawPolygon"), "shards are filled polygons");
  const before = JSON.stringify(art.calls);
  look.sync(iceBreakOf(frozen, { grid: GRID }));
  assert.equal(JSON.stringify(art.calls), before, "same state, same drawing");
  look.sync({ holes: [], cracks: [], shards: [] });
  assert.deepEqual(art.calls, [], "nothing stored, nothing drawn");
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
