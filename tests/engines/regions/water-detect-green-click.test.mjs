import { test } from "node:test";
import assert from "node:assert/strict";
import { selectWaterAt } from "../../../scripts/engines/regions/water-detect.mjs";

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
  return [Math.round(r + m), Math.round(g + m), Math.round(b + m)];
}

function paintSolid(width, height, landHue = 35, landSat = 0.35, landVal = 90) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const [lr, lg, lb] = hsvToRgb(landHue, landSat, landVal);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = lr; rgba[i + 1] = lg; rgba[i + 2] = lb; rgba[i + 3] = 255;
  }
  return rgba;
}

function fillRect(rgba, width, x0, y0, w, h, hue, sat, value) {
  const [r, g, b] = hsvToRgb(hue, sat, value);
  const height = rgba.length / (width * 4);
  for (let y = y0; y < y0 + h && y < height; y++) {
    for (let x = x0; x < x0 + w && x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
}

function inRing(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
    if ((points[i + 1] > y) !== (points[j + 1] > y)
      && x < ((points[j] - points[i]) * (y - points[i + 1])) / (points[j + 1] - points[i + 1]) + points[i]) inside = !inside;
  }
  return inside;
}

function polygonCovers(proposal, x, y) {
  const outer = proposal.loops.some((loop) => !loop.hole && inRing(x + 0.5, y + 0.5, loop.points));
  const hole = proposal.loops.some((loop) => loop.hole && inRing(x + 0.5, y + 0.5, loop.points));
  return outer && !hole;
}

function buildGradedGreenPool(width, height) {
  const rgba = paintSolid(width, height, 35, 0.35, 90);
  for (let y = 20; y < 120; y++) {
    const hue = 126 - ((y - 20) * 27) / 99;
    const sat = y < 70 ? 0.58 : 0.69;
    const value = y < 70 ? 36 : 29;
    fillRect(rgba, width, 10, y, 180, 1, hue, sat, value);
  }
  fillRect(rgba, width, 118, 32, 14, 14, 42, 0.71, 72);
  fillRect(rgba, width, 118, 62, 14, 14, 38, 0.82, 114);
  fillRect(rgba, width, 96, 92, 14, 14, 39, 0.79, 80);
  fillRect(rgba, width, 60, 45, 5, 5, 42, 0.8, 90);
  return rgba;
}

test("a green click joins similar connected water and keeps coloured pads as holes", () => {
  const width = 200, height = 130;
  const rgba = buildGradedGreenPool(width, height);
  const picked = selectWaterAt(rgba, width, height, { x: 100, y: 35 }, { broad: true });
  assert.equal(picked.status, "found");
  const set = new Set(picked.proposal.pixels);
  assert.ok(set.has(35 * width + 100), "upper band");
  assert.ok(set.has(70 * width + 100), "middle band");
  assert.ok(set.has(105 * width + 50), "lower band");
  assert.equal(set.has(39 * width + 125), false, "pad centre stays out of the mask");
  assert.equal(set.has(69 * width + 125), false, "pad centre stays out of the mask");
  assert.equal(set.has(99 * width + 99), false, "pad centre stays out of the mask");
  assert.equal(polygonCovers(picked.proposal, 125, 39), false, "pad stays a polygon hole");
  assert.equal(polygonCovers(picked.proposal, 125, 69), false, "pad stays a polygon hole");
  assert.equal(polygonCovers(picked.proposal, 99, 99), false, "pad stays a polygon hole");
  assert.equal(polygonCovers(picked.proposal, 62, 47), false, "a small coloured pad stays a hole too");
});

test("a red pool still fills a dull reflection across the hue wrap", () => {
  const width = 200, height = 200;
  const rgba = paintSolid(width, height);
  fillRect(rgba, width, 20, 20, 160, 160, 350, 0.8, 90);
  fillRect(rgba, width, 90, 90, 8, 8, 350, 0.3, 90);
  const picked = selectWaterAt(rgba, width, height, { x: 50, y: 50 });
  assert.equal(picked.status, "found");
  assert.equal(polygonCovers(picked.proposal, 94, 94), true);
});

test("nearby clicks at the cool end of green water still reach its warmer end", () => {
  const width = 200, height = 130;
  const rgba = paintSolid(width, height);
  for (let y = 20; y < 120; y++) fillRect(rgba, width, 10, y, 180, 1, 128 - (y - 20) * 40 / 99, 0.6, 40);
  const picked = selectWaterAt(rgba, width, height, { x: 100, y: 24 }, { broad: true });
  assert.equal(picked.status, "found");
  assert.ok(new Set(picked.proposal.pixels).has(115 * width + 100), "connected warm green water");
});

test("hundreds of small floating pads remain separate polygon holes", () => {
  const width = 512, height = 512;
  const rgba = paintSolid(width, height, 132, 0.7, 70);
  for (let y = 20; y <= 500; y += 20) {
    for (let x = 20; x <= 500; x += 20) fillRect(rgba, width, x, y, 8, 8, 47, 0.8, 110);
  }
  const picked = selectWaterAt(rgba, width, height, { x: 12, y: 12 });
  assert.equal(picked.status, "found");
  assert.equal(picked.proposal.loops.filter((loop) => loop.hole).length, 625);
  assert.equal(polygonCovers(picked.proposal, 24, 24), false);
  assert.equal(polygonCovers(picked.proposal, 504, 504), false);
});
