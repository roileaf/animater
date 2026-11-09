import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestFloor, FLOOR_PROTOTYPES } from "../../../scripts/engines/regions/floor-suggest.mjs";
import { DETECT_FLOORS } from "../../../scripts/engines/regions/floor-region-data.mjs";

function patch(colour, { width = 20, height = 20, grain = 0 } = {}) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const pixels = [];
  for (let p = 0; p < width * height; p++) {
    const n = grain ? ((p * 2654435761) >>> 0) % (grain * 2 + 1) - grain : 0;
    rgba[p * 4] = colour[0] + n; rgba[p * 4 + 1] = colour[1] + n; rgba[p * 4 + 2] = colour[2] + n; rgba[p * 4 + 3] = 255;
    pixels.push(p);
  }
  return { rgba, width, height, pixels };
}

const suggest = (colour, options) => { const { rgba, width, height, pixels } = patch(colour, options); return suggestFloor(rgba, width, height, pixels); };

test("typical painted colours suggest the floor a GM would pick", () => {
  const cases = [
    ["stone", [128, 128, 130]], ["snow", [240, 242, 245]], ["grass", [70, 120, 50]], ["water", [40, 90, 150]],
    ["sand", [200, 175, 110]], ["wood", [120, 80, 40]], ["lava", [225, 85, 20]],
  ];
  for (const [floor, colour] of cases) assert.equal(suggest(colour, { grain: 6 }).floor, floor, `${floor} ${colour}`);
});

test("a suggestion always names a floor the window can build, never none", () => {
  for (const colour of [[0, 0, 0], [255, 255, 255], [200, 30, 200], [10, 200, 90], [90, 90, 90]]) {
    const { floor } = suggest(colour);
    assert.ok(DETECT_FLOORS.includes(floor) && floor !== "none", `${colour} gave ${floor}`);
  }
});

test("every prototype belongs to a floor the window can build", () => {
  for (const { floor } of FLOOR_PROTOTYPES) assert.ok(DETECT_FLOORS.includes(floor) && floor !== "none", floor);
});

test("a clear colour is a confident suggestion and a borderline one says so", () => {
  assert.equal(suggest([240, 242, 245]).confidence, "high");
  for (const colour of [[118, 122, 128], [110, 85, 60], [50, 120, 110]]) assert.equal(suggest(colour).confidence, "low", `${colour}`);
});

test("only the selected pixels are read, not the rest of the map", () => {
  const { rgba, width, height } = patch([70, 120, 50]);
  const stoneOnly = [];
  for (let p = 0; p < 40; p++) { rgba[p * 4] = 128; rgba[p * 4 + 1] = 128; rgba[p * 4 + 2] = 130; stoneOnly.push(p); }
  assert.equal(suggestFloor(rgba, width, height, stoneOnly).floor, "stone");
});

test("an empty selection suggests nothing", () => {
  const { rgba, width, height } = patch([128, 128, 130]);
  assert.equal(suggestFloor(rgba, width, height, []), null);
});

test("a large selection is sampled, so a big map click stays fast", () => {
  const { rgba, width, height, pixels } = patch([70, 120, 50], { width: 1500, height: 1000 });
  const started = Date.now();
  assert.equal(suggestFloor(rgba, width, height, pixels).floor, "grass");
  assert.ok(Date.now() - started < 200, "read a sample, not every pixel");
});

test("a thin border that lines up with the sampling stride does not decide the floor", () => {
  const width = 800, height = 1500, rgba = new Uint8ClampedArray(width * height * 4), pixels = [];
  for (let p = 0; p < width * height; p++) {
    const border = p % width < 3, c = border ? [35, 50, 70] : [128, 128, 130];
    rgba[p * 4] = c[0]; rgba[p * 4 + 1] = c[1]; rgba[p * 4 + 2] = c[2]; rgba[p * 4 + 3] = 255;
    pixels.push(p);
  }
  assert.equal(suggestFloor(rgba, width, height, pixels).floor, "stone");
});

test("the same selection gives the same suggestion whatever order its pixels are listed in", () => {
  const { rgba, width, height, pixels } = patch([70, 120, 50], { width: 300, height: 300, grain: 8 });
  const rotated = [...pixels.slice(7), ...pixels.slice(0, 7)];
  assert.equal(suggestFloor(rgba, width, height, rotated).floor, suggestFloor(rgba, width, height, pixels).floor);
});
