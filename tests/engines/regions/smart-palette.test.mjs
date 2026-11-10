import { test } from "node:test";
import assert from "node:assert/strict";
import { keepToColours } from "../../../scripts/engines/regions/smart-select.mjs";

// A 100 × 100 grey stone floor whose lightness wanders (light and dark slabs, grain), with three green 8 × 8 chairs.
function stoneRoom({ chairs = [[20, 20], [60, 30], [40, 65]], chairColour = [70, 110, 60] } = {}) {
  const w = 100, h = 100, rgba = new Uint8ClampedArray(w * h * 4);
  let seed = 7; const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let p = 0; p < w * h; p++) {
    const x = p % w, y = (p / w) | 0, slab = ((x >> 4) + (y >> 4)) % 2 ? 20 : -15, v = Math.round(105 + slab + (rand() - 0.5) * 30);
    rgba.set([v, v, v + 4, 255], p * 4);
  }
  const chair = new Uint8Array(w * h);
  for (const [cx, cy] of chairs) for (let y = cy; y < cy + 8; y++) for (let x = cx; x < cx + 8; x++) { rgba.set([...chairColour, 255], (y * w + x) * 4); chair[y * w + x] = 1; }
  return { w, h, rgba, chair };
}
const full = (n) => new Uint8Array(n).fill(1);

test("chairs of another hue on a stone floor are dropped as holes; the stone's own light and dark stay", () => {
  const { w, h, rgba, chair } = stoneRoom();
  const { mask, dropped } = keepToColours(full(w * h), rgba, w, h, [{ x: 80, y: 80 }]);
  let chairsLeft = 0, stoneLost = 0;
  for (let p = 0; p < w * h; p++) { if (chair[p] && mask[p]) chairsLeft++; if (!chair[p] && !mask[p]) stoneLost++; }
  assert.ok(chairsLeft <= 3 * 8, `chair pixels left: ${chairsLeft}`); // a chair's 1-pixel rim may blend with the stone
  assert.ok(stoneLost <= 3 * 36, `stone pixels lost: ${stoneLost}`); // and the stone right around a chair blends with it
  assert.ok(dropped >= 3 * 40, `dropped ${dropped}`);
});

test("a chair close in hue to the floor is kept", () => {
  const { w, h, rgba } = stoneRoom({ chairColour: [92, 92, 98] });
  assert.equal(keepToColours(full(w * h), rgba, w, h, [{ x: 80, y: 80 }]).dropped, 0);
});

test("a floor of many colours, where the cut would leave too little, keeps the model's mask", () => {
  const w = 40, h = 40, rgba = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) { const x = p % w; rgba.set(x < 10 ? [120, 120, 120, 255] : [200, 60, 40, 255], p * 4); }
  const m = full(w * h);
  const out = keepToColours(m, rgba, w, h, [{ x: 2, y: 20 }]);
  assert.equal(out.mask, m);
  assert.equal(out.dropped, 0);
});

test("nothing to go on: no click, no map, or an empty mask returns the mask as it was", () => {
  const m = full(16), rgba = new Uint8ClampedArray(64);
  assert.equal(keepToColours(m, rgba, 4, 4, []).mask, m);
  assert.equal(keepToColours(m, null, 4, 4, [{ x: 1, y: 1 }]).mask, m);
  const empty = new Uint8Array(16);
  assert.equal(keepToColours(empty, rgba, 4, 4, [{ x: 1, y: 1 }]).mask, empty);
});

test("a floor split by a hedge keeps both sides; pixels outside the mask never come in", () => {
  const { w, h, rgba } = stoneRoom({ chairs: [] });
  const m = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) if (p % w < 50) m[p] = 1;
  for (let y = 0; y < h; y++) for (let x = 70; x < 80; x++) m[y * w + x] = 1; // a separate strip of the same stone
  for (let y = 0; y < h; y++) for (let x = 48; x < 52; x++) rgba.set([40, 120, 40, 255], (y * w + x) * 4); // a green hedge along the edge
  const { mask } = keepToColours(m, rgba, w, h, [{ x: 10, y: 10 }]);
  for (let p = 0; p < w * h; p++) if (mask[p]) assert.equal(m[p], 1);
  assert.equal(mask[50 * w + 75], 1, "the strip beyond the hedge stays");
  assert.equal(mask[50 * w + 49], 0, "the hedge is out");
});
