import { test } from "node:test";
import assert from "node:assert/strict";
import { selectWaterAt } from "../../../scripts/engines/regions/water-detect.mjs";

const SIZE = 200;
const rgb = (hue, sat, value) => {
  const c = value * sat, m = value - c, x = c * (1 - Math.abs(((hue / 60) % 2) - 1)), h = hue / 60;
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return [r + m, g + m, b + m];
};
function paint(colourAt) {
  const data = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    data.set([...colourAt(x, y), 255], (y * SIZE + x) * 4);
  }
  return data;
}
const LAND = rgb(90, 0.5, 120);
const inLake = (x, y) => x >= 40 && x < 160 && y >= 40 && y < 160;

test("a click on a lamp's reflection reads the water around it", () => {
  const image = paint((x, y) => {
    if (x >= 99 && x <= 100 && y >= 99 && y <= 100) return rgb(45, 0.4, 190);
    return inLake(x, y) ? rgb(205, 0.45, 70) : LAND;
  });
  const result = selectWaterAt(image, SIZE, SIZE, { x: 100, y: 100 });
  assert.equal(result.status, "found");
  assert.ok(Math.abs(result.seed.hue - 205) < 3, `seed hue ${result.seed.hue}`);
  assert.ok(result.proposal.share > 0.3, `share ${result.proposal.share}`);
});

test("a click where a bright patch meets paler water fills the paler water too", () => {
  const image = paint((x, y) => {
    if (!inLake(x, y)) return LAND;
    return rgb(205, x >= 100 && x <= 106 && y >= 97 && y <= 103 ? 0.9 : 0.47, 120);
  });
  const result = selectWaterAt(image, SIZE, SIZE, { x: 100, y: 100 });
  assert.equal(result.status, "found");
  assert.ok(result.proposal.share > 0.3, `share ${result.proposal.share}`);
});

test("a click on a 3 pixel stream selects the stream and not its banks", () => {
  const image = paint((x) => (x >= 99 && x <= 101 ? rgb(205, 0.45, 90) : rgb(36, 0.4, 110)));
  const result = selectWaterAt(image, SIZE, SIZE, { x: 100, y: 100 });
  assert.equal(result.status, "found");
  assert.ok(Math.abs(result.seed.hue - 205) < 3, `seed hue ${result.seed.hue}`);
  assert.ok(result.proposal.share < 0.03, `share ${result.proposal.share}`);
});
