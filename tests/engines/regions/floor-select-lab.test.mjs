import { test } from "node:test";
import assert from "node:assert/strict";
import { selectFloorAt } from "../../../scripts/engines/regions/floor-select.mjs";

function solid(width, height, r, g, b, alpha = 255) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = alpha; }
  return rgba;
}

function fillRect(rgba, width, x0, y0, w, h, r, g, b) {
  const height = rgba.length / (width * 4);
  for (let y = y0; y < y0 + h && y < height; y++) {
    for (let x = x0; x < x0 + w && x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
}

function hsvToRgb(h, s, v) {
  const c = v * s, hp = h / 60, x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1) { r = c; g = x; }
  else if (hp < 2) { r = x; g = c; }
  else if (hp < 3) { g = c; b = x; }
  else if (hp < 4) { g = x; b = c; }
  else if (hp < 5) { r = x; b = c; }
  else { r = c; b = x; }
  const m = v - c;
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function countIn(maskPixels, width, x0, y0, w, h) {
  const set = new Set(maskPixels);
  let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (set.has(y * width + x)) n++;
  return n;
}

test("Lab matcher fills a grey stone block and stops at brown wood", () => {
  const width = 80, height = 40;
  const rgba = solid(width, height, 40, 28, 18); // wood-like brown surround
  fillRect(rgba, width, 10, 5, 30, 30, 140, 140, 142); // grey stone
  const found = selectFloorAt(rgba, width, height, { x: 20, y: 20 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "lab");
  assert.ok(countIn(found.proposal.pixels, width, 10, 5, 30, 30) > 30 * 30 * 0.85);
  assert.equal(countIn(found.proposal.pixels, width, 50, 5, 20, 30), 0);
});

test("Lab matcher fills pale snow and leaves adjacent dirt", () => {
  const width = 60, height = 40;
  const rgba = solid(width, height, 90, 70, 45);
  fillRect(rgba, width, 5, 5, 25, 30, 235, 240, 245);
  const found = selectFloorAt(rgba, width, height, { x: 15, y: 15 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "lab");
  assert.ok(countIn(found.proposal.pixels, width, 5, 5, 25, 30) > 25 * 30 * 0.8);
  assert.ok(countIn(found.proposal.pixels, width, 35, 5, 20, 30) < 20);
});

test("Lab matcher with blur fills textured planks as one area", () => {
  const width = 64, height = 48;
  const rgba = solid(width, height, 30, 30, 35); // dark stone border
  // Low-saturation wood grain: pale enough that hue matching declines, Lab+blur fills boards together.
  for (let y = 8; y < 40; y++) {
    for (let x = 8; x < 56; x++) {
      const plank = Math.floor(x / 8);
      const grain = ((x * 17 + y * 13 + plank * 31) % 18) - 9;
      const base = 168 + plank * 3;
      const i = (y * width + x) * 4;
      rgba[i] = Math.min(255, Math.max(0, base + grain + 4));
      rgba[i + 1] = Math.min(255, Math.max(0, base + grain));
      rgba[i + 2] = Math.min(255, Math.max(0, base + grain - 4));
      rgba[i + 3] = 255;
    }
  }
  const found = selectFloorAt(rgba, width, height, { x: 24, y: 24 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "lab");
  assert.ok(found.proposal.pixels.length > 48 * 32 * 0.7, `expected plank field fill, got ${found.proposal.pixels.length}`);
  assert.equal(countIn(found.proposal.pixels, width, 0, 0, 5, 5), 0, "the dark border is taken in no further than the outline reach");
});

test("Lab matcher refuses a featureless grey field with nothing distinct to follow", () => {
  const width = 80, height = 80;
  const rgba = solid(width, height, 128, 128, 130);
  const found = selectFloorAt(rgba, width, height, { x: 40, y: 40 });
  assert.deepEqual(found, { status: "none", reason: "no-colour" });
});

test("saturated blue water still uses the hue matcher", () => {
  const width = 40, height = 40;
  const [r, g, b] = hsvToRgb(210, 0.7, 0.7);
  const rgba = solid(width, height, 20, 20, 20);
  fillRect(rgba, width, 5, 5, 30, 30, r, g, b);
  const found = selectFloorAt(rgba, width, height, { x: 20, y: 20 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "hue");
  assert.ok(found.proposal.pixels.length > 30 * 30 * 0.8);
});

test("bright lava uses the hue matcher", () => {
  const width = 40, height = 40;
  const [r, g, b] = hsvToRgb(20, 0.9, 0.9);
  const rgba = solid(width, height, 40, 40, 40);
  fillRect(rgba, width, 8, 8, 24, 24, r, g, b);
  const found = selectFloorAt(rgba, width, height, { x: 20, y: 20 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "hue");
});
