import { test } from "node:test";
import assert from "node:assert/strict";
import { selectFloorAt } from "../../../scripts/engines/regions/floor-select.mjs";

const W = 256, H = 256, EDGE = 200, GREY = [140, 140, 140], BROWN = [90, 55, 20], RED = [220, 30, 20];

function set(rgba, x, y, [r, g, b], a = 255) {
  const i = (y * W + x) * 4;
  rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
}

function field() {
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) set(rgba, x, y, x < EDGE ? GREY : BROWN);
  return rgba;
}

function patch(rgba, x0, y0, size, colour, alpha = 255) {
  for (let y = y0; y < y0 + size; y++) for (let x = x0; x < x0 + size; x++) set(rgba, x, y, colour, alpha);
}

const inBox = (pixels, x0, y0, size) => pixels.filter((p) => { const x = p % W, y = Math.floor(p / W); return x >= x0 && x < x0 + size && y >= y0 && y < y0 + size; }).length;

test("a grey click beside a coloured floor follows the grey, not the colour next to it", () => {
  const found = selectFloorAt(field(), W, H, { x: EDGE - 2, y: 70 });
  assert.equal(found.status, "found");
  assert.equal(found.seed.matcher, "lab");
  assert.equal(found.proposal.pixels.filter((p) => p % W >= EDGE).length, 0);
  assert.ok(found.proposal.pixels.length > EDGE * H * 0.9);
});

test("claiming the neighbouring floor first does not stop the grey floor being clicked", () => {
  const brown = [];
  for (let y = 0; y < H; y++) for (let x = EDGE; x < W; x++) brown.push(y * W + x);
  const found = selectFloorAt(field(), W, H, { x: 70, y: 70 }, { claimed: [{ id: "water-1", pixels: brown }] });
  assert.equal(found.status, "found");
  assert.ok(found.proposal.pixels.length > EDGE * H * 0.9);
});

test("a contrasting object inside a grey floor stays a hole", () => {
  const rgba = field();
  patch(rgba, 100, 100, 8, RED);
  const found = selectFloorAt(rgba, W, H, { x: 10, y: 10 });
  assert.equal(found.status, "found");
  assert.equal(inBox(found.proposal.pixels, 100, 100, 8), 0);
});

test("a transparent gap inside a grey floor stays a hole", () => {
  const rgba = field();
  patch(rgba, 100, 100, 8, GREY, 0);
  const found = selectFloorAt(rgba, W, H, { x: 10, y: 10 });
  assert.equal(found.status, "found");
  assert.equal(inBox(found.proposal.pixels, 100, 100, 8), 0);
});

test("speckle of the same floor inside it is still filled", () => {
  const rgba = field();
  patch(rgba, 100, 100, 3, [158, 158, 158]);
  const found = selectFloorAt(rgba, W, H, { x: 10, y: 10 });
  assert.equal(inBox(found.proposal.pixels, 100, 100, 3), 9);
});
