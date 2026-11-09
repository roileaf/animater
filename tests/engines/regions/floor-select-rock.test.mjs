import { test } from "node:test";
import assert from "node:assert/strict";
import { selectFloorAt } from "../../../scripts/engines/regions/floor-select.mjs";

const W = 120, H = 80;
const GRASS = [58, 112, 42], ROCK = [128, 126, 122], OUTLINE = [14, 14, 16];

function noise(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 15) - 8;
}

function paint(rgba, x, y, [r, g, b], jitter = 0) {
  const i = (y * W + x) * 4, n = jitter ? noise(x, y) : 0;
  rgba[i] = r + n; rgba[i + 1] = g + n; rgba[i + 2] = b + n; rgba[i + 3] = 255;
}

function stoneField(rocks, { crack = true } = {}) {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) paint(rgba, x, y, GRASS, 4);
  for (const { cx, cy, r, ring } of rocks) {
    for (let y = cy - r - ring; y <= cy + r + ring; y++) {
      for (let x = cx - r - ring; x <= cx + r + ring; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r) paint(rgba, x, y, ROCK, 4);
        else if (d <= r + ring) paint(rgba, x, y, OUTLINE);
      }
    }
    if (crack) for (let x = cx - r; x <= cx + r; x++) for (let y = cy; y < cy + 2; y++) if (Math.hypot(x - cx, y - cy) <= r) paint(rgba, x, y, OUTLINE);
  }
  return rgba;
}

function inside(pixels, cx, cy, radius) {
  let n = 0;
  for (const p of pixels) if (Math.hypot((p % W) - cx, Math.floor(p / W) - cy) <= radius) n++;
  return n;
}

const discArea = (radius) => Math.PI * radius * radius;

test("a stone with a black outline and a dark crack is selected whole, outline included", () => {
  const rock = { cx: 40, cy: 40, r: 14, ring: 3 };
  const found = selectFloorAt(stoneField([rock]), W, H, { x: 34, y: 34 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "lab");
  assert.ok(inside(found.proposal.pixels, 40, 40, 17) >= discArea(17) * 0.95, "covers the stone and its outline");
  assert.ok(found.proposal.pixels.length <= discArea(17) * 1.05, "does not spill into the grass");
  assert.equal(found.proposal.loops.filter((loop) => loop.hole).length, 0, "the crack leaves no hole");
});

test("two stones touching through their outlines select as one piece", () => {
  const rocks = [{ cx: 36, cy: 40, r: 12, ring: 3 }, { cx: 63, cy: 40, r: 12, ring: 3 }];
  const found = selectFloorAt(stoneField(rocks), W, H, { x: 30, y: 36 });
  assert.equal(found.status, "found");
  assert.ok(inside(found.proposal.pixels, 63, 40, 15) >= discArea(15) * 0.9, "reaches the second stone across the shared outline");
});

test("a dark floor touching the stone is only taken in a few pixels deep", () => {
  const rgba = stoneField([{ cx: 40, cy: 40, r: 14, ring: 0 }], { crack: false });
  for (let y = 0; y < H; y++) for (let x = 54; x < 110; x++) paint(rgba, x, y, OUTLINE);
  const found = selectFloorAt(rgba, W, H, { x: 34, y: 34 });
  assert.equal(found.status, "found");
  const deepest = Math.max(...found.proposal.pixels.map((p) => p % W));
  assert.ok(deepest <= 54 + 4, `reached x=${deepest}`);
});
