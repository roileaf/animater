import { test } from "node:test";
import assert from "node:assert/strict";
import { selectFloorAt } from "../../../scripts/engines/regions/floor-select.mjs";

const GRASS = [58, 112, 42], BLACK = [14, 14, 16];

function noise(x, y) {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) & 15) - 8;
}

function scene({ width = 120, height = 80, rock, rocks, outline = BLACK, ring = 3, crack = false, ramp = 0, ground = GRASS }) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const put = (x, y, c, jitter) => {
    const i = (y * width + x) * 4, n = jitter ? noise(x, y) : 0;
    rgba[i] = c[0] + n; rgba[i + 1] = c[1] + n; rgba[i + 2] = c[2] + n; rgba[i + 3] = 255;
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) put(x, y, ground, true);
  for (const { cx, cy, r } of rocks ?? [{ cx: 40, cy: 40, r: 14 }]) {
    for (let y = cy - r - ring - 2; y <= cy + r + ring + 2; y++) {
      for (let x = cx - r - ring - 2; x <= cx + r + ring + 2; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r - ramp) put(x, y, rock, true);
        else if (d <= r) put(x, y, mix(rock, outline, (d - (r - ramp)) / ramp), false);
        else if (d <= r + ring) put(x, y, outline, false);
      }
    }
    if (crack) for (let x = cx - r; x <= cx + r; x++) for (let y = cy; y < cy + 2; y++) if (Math.hypot(x - cx, y - cy) <= r) put(x, y, outline, false);
  }
  return { rgba, width, height };
}

const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

function share(found, { cx, cy, r }, width) {
  const set = new Set(found.proposal.pixels);
  let inside = 0, total = 0;
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) { total++; if (set.has(y * width + x)) inside++; }
  return inside / total;
}

const ROCK = { cx: 40, cy: 40, r: 14 };

test("a light grey stone with a crack is selected whole", () => {
  const { rgba, width, height } = scene({ rock: [175, 173, 168], crack: true });
  const found = selectFloorAt(rgba, width, height, { x: 34, y: 34 });
  assert.equal(found.status, "found");
  assert.ok(share(found, ROCK, width) >= 0.95);
});

test("a stone with an anti-aliased outline and crack is selected whole", () => {
  const { rgba, width, height } = scene({ rock: [128, 126, 122], crack: true, ramp: 2 });
  const found = selectFloorAt(rgba, width, height, { x: 34, y: 33 });
  assert.equal(found.status, "found");
  assert.ok(share(found, ROCK, width) >= 0.95);
});

test("a faintly warm stone with a crack is selected whole", () => {
  const { rgba, width, height } = scene({ rock: [132, 126, 118], crack: true });
  const found = selectFloorAt(rgba, width, height, { x: 34, y: 34 });
  assert.equal(found.status, "found");
  assert.ok(share(found, ROCK, width) >= 0.95);
});

test("clicking the very middle of a cracked stone still selects the stone, not the crack", () => {
  const { rgba, width, height } = scene({ rock: [128, 126, 122], crack: true });
  const found = selectFloorAt(rgba, width, height, { x: 40, y: 40 });
  assert.equal(found.status, "found");
  assert.ok(share(found, ROCK, width) >= 0.95);
});

test("a dark slate stone with a black outline and crack is selected whole", () => {
  const { rgba, width, height } = scene({ rock: [85, 85, 88], crack: true });
  const found = selectFloorAt(rgba, width, height, { x: 34, y: 34 });
  assert.equal(found.status, "found");
  assert.ok(share(found, ROCK, width) >= 0.95);
});

test("a small stone clicked off its middle is selected whole", () => {
  const small = { cx: 40, cy: 40, r: 4 };
  const { rgba, width, height } = scene({ rock: [128, 126, 122], rocks: [small], ring: 2 });
  const found = selectFloorAt(rgba, width, height, { x: 42, y: 42 });
  assert.equal(found.status, "found");
  assert.ok(share(found, small, width) >= 0.9);
});

test("a one-square boulder on a map read at 1024 wide is not refused as too small", () => {
  const boulder = { cx: 512, cy: 380, r: 10 };
  const { rgba, width, height } = scene({ width: 1024, height: 768, rock: [128, 126, 122], rocks: [boulder], ring: 2 });
  const found = selectFloorAt(rgba, width, height, { x: 512, y: 380 });
  assert.equal(found.status, "found");
  assert.ok(share(found, boulder, width) >= 0.9);
});
