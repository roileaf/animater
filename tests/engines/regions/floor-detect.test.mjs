import { test } from "node:test";
import assert from "node:assert/strict";
import { WATER_TUNING, detectWater, selectColourAt, mergeAreaProposals, contourLoops, isSimple, toRegionData, editableFloorRegionIds, fitSize, areaPixels } from "../../../scripts/engines/regions/floor-detect.mjs";

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

function blank(width, height, hue, sat, value, alpha = 255) {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const [r, g, b] = hsvToRgb(hue, sat, value);
  for (let i = 0; i < rgba.length; i += 4) { rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = alpha; }
  return rgba;
}

function fill(rgba, width, x0, y0, w, h, hue, sat, value, alpha = 255) {
  const [r, g, b] = hsvToRgb(hue, sat, value);
  const height = rgba.length / (width * 4);
  for (let y = y0; y < y0 + h && y < height; y++) {
    for (let x = x0; x < x0 + w && x < width; x++) {
      const i = (y * width + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = alpha;
    }
  }
}

// Slate spread across many bins, so a larger roof does not outvote a tight river.
function fillSlate(rgba, width, x0, y0, w, h) {
  const height = rgba.length / (width * 4);
  for (let y = y0; y < y0 + h && y < height; y++) {
    for (let x = x0; x < x0 + w && x < width; x++) {
      const hue = 218 + ((x * 13 + y * 7) % 15);
      const sat = 0.48 + ((x * 3 + y * 5) % 15) / 100;
      const [r, g, b] = hsvToRgb(hue, sat, 150);
      const i = (y * width + x) * 4;
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = 255;
    }
  }
}

function shiftGrade(rgba, hueBy, valueScale) {
  const out = new Uint8ClampedArray(rgba.length);
  for (let i = 0; i < rgba.length; i += 4) {
    const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    const sat = max ? d / max : 0;
    const hue = !d ? 0 : max === b ? 60 * (4 + (r - g) / d) : max === g ? 60 * (2 + (b - r) / d) : (60 * ((g - b) / d) + 360) % 360;
    const [nr, ng, nb] = hsvToRgb((hue + hueBy) % 360, sat, max * valueScale);
    out[i] = nr; out[i + 1] = ng; out[i + 2] = nb; out[i + 3] = rgba[i + 3];
  }
  return out;
}

function maskCount(mask) {
  let n = 0;
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++;
  return n;
}

function boxCount(mask, width, x0, y0, w, h) {
  let n = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (mask[y * width + x]) n++;
  return n;
}

function signedArea(points) {
  let sum = 0;
  const n = points.length >> 1;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    sum += points[i * 2] * points[j * 2 + 1] - points[j * 2] * points[i * 2 + 1];
  }
  return sum / 2;
}

function loopArea(loops) {
  return loops.reduce((sum, loop) => sum + signedArea(loop.points), 0);
}

const scene = () => {
  const width = 220, height = 160;
  const rgba = blank(width, height, 80, 0.35, 90);
  fillSlate(rgba, width, 8, 8, 100, 100);
  fill(rgba, width, 130, 30, 50, 40, 200, 0.9, 180);
  return { rgba, width, height };
};

test("a slate roof larger than the river is left out, and the river is kept", () => {
  const { rgba, width, height } = scene();
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.ok(found.waterColor.saturation >= WATER_TUNING.peakSatMin);
  assert.ok(Math.abs(found.waterColor.hue - 200) < 8, `peak hue ${found.waterColor.hue}`);
  assert.equal(boxCount(found.mask, width, 8, 8, 100, 100), 0, "roof pixels");
  assert.ok(boxCount(found.mask, width, 140, 40, 30, 20) > 400, "river core");
  assert.equal(found.proposals.length, 1);
  assert.equal(found.proposals[0].preselected, true);
  assert.ok(found.proposals[0].share > found.proposals.at(-1).share || found.proposals.length === 1);
});

test("the same scene, shifted ten degrees and darker, still keeps the river and rejects the roofs", () => {
  const { rgba, width } = scene();
  const graded = shiftGrade(rgba, 10, 0.7);
  const found = detectWater(graded, width, 160);
  assert.equal(found.status, "found");
  assert.ok(Math.abs(found.waterColor.hue - 210) < 8, `regraded peak ${found.waterColor.hue}`);
  assert.equal(boxCount(found.mask, width, 8, 8, 100, 100), 0, "regraded roof");
  assert.ok(boxCount(found.mask, width, 140, 40, 30, 20) > 400, "regraded river");
});

test("a map with no blue returns no-candidates, and a blue-grey dungeon returns no-saturated-colour", () => {
  const dry = blank(80, 60, 30, 0.55, 120);
  assert.deepEqual(detectWater(dry, 80, 60), { status: "none", reason: "no-candidates" });
  const dungeon = blank(80, 60, 215, 0.4, 140);
  const none = detectWater(dungeon, 80, 60);
  assert.equal(none.status, "none");
  assert.equal(none.reason, "no-saturated-colour");
});

test("transparent blue is not water", () => {
  const rgba = blank(40, 40, 90, 0.3, 80);
  fill(rgba, 40, 5, 5, 30, 30, 200, 0.9, 180, 0);
  assert.equal(detectWater(rgba, 40, 40).status, "none");
});

test("a speck of saturated blue is dropped", () => {
  const rgba = blank(210, 210, 40, 0.4, 100);
  fill(rgba, 210, 20, 20, 5, 5, 200, 0.92, 180);
  assert.deepEqual(detectWater(rgba, 210, 210), { status: "none", reason: "nothing-left" });
});

test("water that touches the image edge reaches x = 0 in the polygon", () => {
  const width = 80, height = 60;
  const rgba = blank(width, height, 40, 0.4, 110);
  fill(rgba, width, 0, 10, 30, 40, 200, 0.9, 180);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.equal(found.mask[25 * width], 1, "edge pixel stays water");
  assert.equal(found.mask[9 * width + 1], 0, "land above the water stays land");
  const xs = found.proposals[0].loops.flatMap((loop) => loop.points.filter((_, i) => i % 2 === 0));
  assert.equal(Math.min(...xs), 0);
});

test("a ship stays a hole and a small reflection is filled", () => {
  const width = 120, height = 120;
  const rgba = blank(width, height, 35, 0.45, 100);
  fill(rgba, width, 10, 10, 100, 100, 200, 0.9, 170);
  fill(rgba, width, 40, 40, 40, 40, 25, 0.6, 90);
  fill(rgba, width, 20, 80, 5, 5, 25, 0.1, 190);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.equal(found.proposals.length, 1);
  const holes = found.proposals[0].loops.filter((loop) => loop.hole);
  assert.equal(holes.length, 1, "only the ship stays a hole");
  const holeAreas = holes.map((loop) => Math.abs(signedArea(loop.points))).sort((a, b) => b - a);
  assert.ok(holeAreas[0] > 1400 && holeAreas[0] < 1800, `largest hole area ${holeAreas[0]}`);
  assert.equal(found.mask[82 * width + 22], 1, "pale reflection is filled");
  assert.equal(found.mask[55 * width + 55], 0, "ship stays open");
});

test("traced loops are simple and their area matches the mask, before and after simplification", () => {
  const width = 90, height = 70;
  const rgba = blank(width, height, 40, 0.3, 100);
  fill(rgba, width, 8, 8, 40, 24, 200, 0.9, 180);
  for (let i = 0; i < 8; i++) fill(rgba, width, 8 + i * 5, 32, 3, 8, 200, 0.9, 180);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  const raw = contourLoops(found.mask, width, height);
  assert.ok(raw.length >= 1);
  for (const loop of raw) assert.equal(isSimple(loop.points), true, "raw loop crosses itself");
  assert.ok(Math.abs(loopArea(raw) - maskCount(found.mask)) <= 1, `raw area ${loopArea(raw)} mask ${maskCount(found.mask)}`);
  for (const proposal of found.proposals) {
    for (const loop of proposal.loops) assert.equal(isSimple(loop.points), true, "simplified loop crosses itself");
    assert.ok(proposal.vertices <= WATER_TUNING.vertexBudget);
  }
  const simplified = loopArea(found.proposals.flatMap((proposal) => proposal.loops));
  const pixels = maskCount(found.mask);
  assert.ok(Math.abs(simplified - pixels) / pixels < 0.08, `simplified area ${simplified} mask ${pixels}`);
});

test("toRegionData maps pixel corners into scene space and writes water flags", () => {
  const rgba = blank(20, 10, 200, 0.9, 180);
  const found = detectWater(rgba, 20, 10);
  assert.equal(found.status, "found");
  const data = toRegionData(found.proposals[0], {
    sceneRect: { x: 1000, y: 2000, width: 5000, height: 2500 },
    imageWidth: 20,
    imageHeight: 10,
    levelId: "level-a",
    name: "Harbour",
    waterKind: "river",
    flowTo: "se",
    current: "swift",
  });
  assert.equal(data.name, "Harbour");
  assert.equal(data.shapes[0].type, "polygon");
  assert.equal(data.shapes[0].hole, false);
  assert.ok(data.shapes[0].points.length >= 6 && data.shapes[0].points.length % 2 === 0);
  const xs = data.shapes[0].points.filter((_, i) => i % 2 === 0);
  const ys = data.shapes[0].points.filter((_, i) => i % 2 === 1);
  assert.equal(Math.min(...xs), 1000);
  assert.equal(Math.max(...xs), 6000);
  assert.equal(Math.min(...ys), 2000);
  assert.equal(Math.max(...ys), 4500);
  assert.deepEqual(data.levels, ["level-a"]);
  assert.deepEqual(data.flags, { animater: { floor: "water", generated: "floor-detect", waterKind: "river", flowTo: "se", current: "swift" } });
  const still = toRegionData(found.proposals[0], {
    sceneRect: { x: 0, y: 0, width: 20, height: 10 }, imageWidth: 20, imageHeight: 10, name: "Pool", waterKind: "still",
  });
  assert.deepEqual(still.levels, []);
  assert.deepEqual(still.flags, { animater: { floor: "water", generated: "floor-detect", waterKind: "still", flowTo: "", current: "" } });
  const badStill = toRegionData(found.proposals[0], {
    sceneRect: { x: 0, y: 0, width: 20, height: 10 }, imageWidth: 20, imageHeight: 10, waterKind: "still", flowTo: "", current: "swift",
  });
  assert.equal(badStill.flags.animater.current, "");
});

test("editableFloorRegionIds selects only generated regions on exactly this level", () => {
  const ids = editableFloorRegionIds([
    { id: "hand", flags: { animater: { floor: "water" } } },
    { id: "old", levels: ["level-a"], flags: { animater: { floor: "water", generated: "water-detect" } } },
    { id: "other", flags: { animater: { generated: "something-else" } } },
    { id: "plain" },
    null,
  ], "level-a");
  assert.deepEqual(ids, ["old"]);
  assert.deepEqual(editableFloorRegionIds(null, "level-a"), []);
  assert.deepEqual(editableFloorRegionIds({ contents: [{ id: "kept" }, { id: "again", levels: ["b"], flags: { animater: { generated: "water-detect" } } }] }, "b"), ["again"]);
});

test("two runs on the same pixels return the same proposals and the same mask", () => {
  const { rgba, width, height } = scene();
  const a = detectWater(rgba, width, height);
  const b = detectWater(rgba, width, height);
  assert.deepEqual(a.proposals, b.proposals);
  assert.deepEqual(a.waterColor, b.waterColor);
  assert.deepEqual(a.mask, b.mask);
});

test("editableFloorRegionIds keeps shared, all-level, and other-level generated regions", () => {
  const made = (id, levels) => ({ id, levels: new Set(levels), flags: { animater: { generated: "water-detect" } } });
  const regions = [made("here", ["cellar"]), made("upstairs", ["attic"]), made("everywhere", []), made("both", ["cellar", "attic"])];
  assert.deepEqual(editableFloorRegionIds(regions, "cellar"), ["here"]);
});

test("fitSize keeps the aspect ratio and stops at the long edge", () => {
  assert.deepEqual(fitSize(2000, 1000), { width: 1024, height: 512 });
  assert.deepEqual(fitSize(800, 600), { width: 800, height: 600 });
});

test("proposals are sorted by share, and a small piece is offered unticked", () => {
  const width = 200, height = 200;
  const rgba = blank(width, height, 50, 0.3, 100);
  fill(rgba, width, 10, 10, 80, 80, 200, 0.9, 180);
  fill(rgba, width, 150, 150, 8, 8, 200, 0.9, 180);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.ok(found.proposals.length >= 2);
  assert.ok(found.proposals[0].share >= found.proposals[1].share);
  assert.equal(found.proposals[0].preselected, true);
  const small = found.proposals.find((proposal) => proposal.share < WATER_TUNING.preselectShare);
  assert.ok(small, "an 8px block is under 0.2% of 200x200 and above the speck cutoff");
  assert.equal(small.preselected, false);
});

const LAND = [100, 88, 65, 255], WATER = [18, 138, 180, 255];
const canvasOf = (width, height, colour = LAND) => {
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) rgba.set(colour, i);
  return rgba;
};
const paint = (rgba, width, x0, y0, w, h, colour = WATER) => {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set(colour, (y * width + x) * 4);
};

function spiralCanal(size) {
  const rgba = canvasOf(size, size);
  let left = 8, right = size - 8, top = 8, bottom = size - 8;
  for (let turn = 0; turn < 55 && right - left > 390; turn++) {
    paint(rgba, size, left, top, right - left, 3);
    paint(rgba, size, right - 3, top, 3, bottom - top);
    paint(rgba, size, left + 6, bottom - 3, right - left - 6, 3);
    paint(rgba, size, left + 6, top + 6, 3, bottom - top - 6);
    left += 6; right -= 6; top += 6; bottom -= 6;
  }
  return rgba;
}

function sawtoothRivers(size) {
  const rgba = canvasOf(size, size);
  for (let river = 0; river < 60; river++) {
    const y0 = 4 + river * 17;
    for (let x = 0; x < size; x++) paint(rgba, size, x, y0 + (x >> 2) % 2 * 4, 1, 7);
  }
  paint(rgba, size, 0, 0, 4, size);
  return rgba;
}

function noise(size, chance) {
  const rgba = canvasOf(size, size);
  let seed = 12345;
  for (let p = 0; p < size * size; p++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    if (seed / 4294967296 < chance) rgba.set(WATER, p * 4);
  }
  return rgba;
}

function checkerboard(size, cell) {
  const rgba = canvasOf(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (((x / cell | 0) + (y / cell | 0)) % 2) rgba.set(WATER, (y * size + x) * 4);
  return rgba;
}

function islands(size, across, block, pitch) {
  const rgba = canvasOf(size, size);
  paint(rgba, size, 12, 12, size - 24, size - 24);
  for (let iy = 0; iy < across; iy++) for (let ix = 0; ix < across; ix++) paint(rgba, size, 28 + ix * pitch, 28 + iy * pitch, block, block, LAND);
  return rgba;
}

const assertSound = (found, width, height) => {
  for (const proposal of found.proposals) {
    assert.equal(proposal.loops.filter((loop) => !loop.hole).length, 1, "one outer shore");
    assert.equal(proposal.loops[0].hole, false, "the outer shore comes first");
    assert.equal(proposal.vertices, proposal.loops.reduce((sum, loop) => sum + loop.points.length / 2, 0));
    for (const loop of proposal.loops) {
      assert.equal(signedArea(loop.points) < 0, loop.hole, "a hole winds the other way");
      for (let i = 0; i < loop.points.length; i += 2) {
        assert.ok(loop.points[i] >= 0 && loop.points[i] <= width && loop.points[i + 1] >= 0 && loop.points[i + 1] <= height, "stays on the map");
      }
    }
  }
};

for (const [name, build, width, height] of [
  ["spiral canal", () => spiralCanal(1024), 1024, 1024],
  ["sawtooth rivers", () => sawtoothRivers(1024), 1024, 1024],
  ["heavy noise", () => noise(1024, 0.9), 1024, 1024],
  ["half noise", () => noise(1024, 0.5), 1024, 1024],
  ["checkerboard of 4", () => checkerboard(1024, 4), 1024, 1024],
  ["checkerboard of 1", () => checkerboard(1024, 1), 1024, 1024],
  ["144 islands", () => islands(1024, 12, 50, 80), 1024, 1024],
  ["all water", () => canvasOf(1024, 1024, WATER), 1024, 1024],
  ["1x1024", () => canvasOf(1, 1024, WATER), 1, 1024],
]) {
  test(`${name} finishes within a second and every ring is sound`, () => {
    const rgba = build();
    const start = performance.now();
    const found = detectWater(rgba, width, height);
    const elapsed = performance.now() - start;
    assert.ok(elapsed < 1000, `${elapsed.toFixed(0)} ms`);
    if (found.status === "found") assertSound(found, width, height);
  });
}

test("a thin spiral canal keeps its shape over the budget instead of losing it", () => {
  const found = detectWater(spiralCanal(1024), 1024, 1024);
  assert.equal(found.status, "found");
  const river = found.proposals[0];
  assert.ok(river.vertices > WATER_TUNING.vertexBudget, `${river.vertices} vertices`);
  const pixels = maskCount(found.mask);
  assert.ok(Math.abs(loopArea(found.proposals.flatMap((proposal) => proposal.loops)) - pixels) / pixels < 0.02, "area stays within 2%");
});

test("a canal network too detailed for the budget is still found, with its outer shore", () => {
  const size = 1024;
  const rgba = canvasOf(size, size);
  for (let x = 8, channel = 0; x + 3 < size - 8; x += 6, channel++) {
    paint(rgba, size, x, 8, 3, size - 16);
    if (channel % 2 === 0) paint(rgba, size, x, size - 11, 9, 3);
    else paint(rgba, size, x, 8, 9, 3);
  }
  const found = detectWater(rgba, size, size);
  assert.equal(found.status, "found");
  assertSound(found, size, size);
  assert.ok(found.proposals[0].share > 0.4, `share ${found.proposals[0].share}`);
});

test("a big island keeps its hole while the shore around it is over the budget", () => {
  const size = 1024;
  const rgba = canvasOf(size, size);
  paint(rgba, size, 8, 636, 380, 380);
  paint(rgba, size, 43, 671, 310, 310, LAND);
  for (let x = 8, channel = 0; x + 3 < size - 8; x += 6, channel++) {
    paint(rgba, size, x, 8, 3, 631);
    if (channel % 2 === 0) paint(rgba, size, x, 636, 9, 3);
    else paint(rgba, size, x, 8, 9, 3);
  }
  const found = detectWater(rgba, size, size);
  const river = found.proposals[0];
  assert.equal(river.loops[0].hole, false);
  const holes = river.loops.filter((loop) => loop.hole);
  const hole = holes.reduce((largest, loop) => Math.abs(signedArea(loop.points)) > Math.abs(signedArea(largest.points)) ? loop : largest);
  assert.ok(Math.abs(Math.abs(signedArea(hole.points)) - 310 * 310) < 2000, "the island keeps its size");
  assert.equal(found.mask[800 * size + 200], 0, "the island centre remains dry");
  assert.equal(found.mask[900 * size + 20], 1, "water still surrounds the island");
});

test("every island above the fill threshold stays a hole, whatever the vertex count", () => {
  const found = detectWater(islands(1024, 11, 50, 88), 1024, 1024);
  const lake = found.proposals[0];
  assert.equal(lake.loops.filter((loop) => loop.hole).length, 121);
  assert.equal(found.proposals.length, 1);
  for (let iy = 0; iy < 11; iy++) for (let ix = 0; ix < 11; ix++) assert.equal(found.mask[(53 + iy * 88) * 1024 + 53 + ix * 88], 0);
});

test("simplifying moves a shore by no more than the largest tolerance", () => {
  const size = 512;
  const rgba = canvasOf(size, size);
  for (let y = 40; y < 470; y++) {
    const half = 90 + Math.round(40 * Math.sin(y / 23) + 15 * Math.sin(y / 5));
    paint(rgba, size, 256 - half, y, half * 2, 1);
  }
  const found = detectWater(rgba, size, size);
  const simplified = found.proposals[0].loops[0].points;
  const raw = contourLoops(found.mask, size, size).find((loop) => !loop.hole).points;
  assert.ok(simplified.length < raw.length, "simplifying removed vertices");
  const limit = WATER_TUNING.simplifyPx[0];
  for (let i = 0; i < raw.length; i += 2) {
    let best = Infinity;
    for (let j = 0; j < simplified.length; j += 2) {
      const k = (j + 2) % simplified.length;
      const ax = simplified[j], ay = simplified[j + 1], dx = simplified[k] - ax, dy = simplified[k + 1] - ay;
      const t = Math.max(0, Math.min(1, ((raw[i] - ax) * dx + (raw[i + 1] - ay) * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(raw[i] - ax - t * dx, raw[i + 1] - ay - t * dy));
    }
    assert.ok(best <= limit + 1e-9, `vertex ${i / 2} moved ${best}`);
  }
});

test("an island touching land at one corner does not pinch the shore", () => {
  const size = 200;
  const rgba = canvasOf(size, size);
  paint(rgba, size, 20, 20, 160, 160);
  paint(rgba, size, 92, 0, 30, 52, LAND);
  paint(rgba, size, 55, 52, 37, 40, LAND);
  const found = detectWater(rgba, size, size);
  assert.equal(found.status, "found");
  assertSound(found, size, size);
  for (const proposal of found.proposals) {
    for (const loop of proposal.loops) {
      const seen = new Set();
      for (let i = 0; i < loop.points.length; i += 2) {
        const key = `${loop.points[i]},${loop.points[i + 1]}`;
        assert.equal(seen.has(key), false, `vertex ${key} repeats`);
        seen.add(key);
      }
    }
  }
  const raw = contourLoops(found.mask, size, size);
  for (const loop of raw) assert.equal(isSimple(loop.points), true);
});

test("no 2x2 block of the final mask touches only at a corner", () => {
  const found = detectWater(noise(256, 0.86), 256, 256);
  assert.equal(found.status, "found");
  for (let y = 0; y + 1 < 256; y++) {
    for (let x = 0; x + 1 < 256; x++) {
      const p = y * 256 + x;
      const a = found.mask[p], b = found.mask[p + 1], c = found.mask[p + 256], d = found.mask[p + 257];
      assert.equal(a === d && b === c && a !== b, false, `saddle at ${x},${y}`);
    }
  }
});

test("isSimple rejects a crossing, a repeated vertex and a vertex resting on another edge", () => {
  assert.equal(isSimple([0, 0, 10, 0, 10, 10, 0, 10]), true, "a square");
  assert.equal(isSimple([0, 0, 10, 10, 10, 0, 0, 10]), false, "a bow tie");
  assert.equal(isSimple([0, 0, 4, 0, 4, 4, 8, 4, 8, 8, 4, 8, 4, 4, 0, 4]), false, "a figure 8 through 4,4");
  assert.equal(isSimple([0, 0, 10, 0, 10, 10, 5, 0, 0, 10]), false, "a vertex on an edge");
  assert.equal(isSimple([0, 0, 10, 0, 5, 0, 5, 5]), false, "an edge running back along itself");
  assert.equal(isSimple([0, 0, 5, 0]), false, "two vertices");
});

test("slate roofs below the saturation floor cannot outvote a smaller river", () => {
  const width = 300, height = 200;
  const rgba = blank(width, height, 80, 0.35, 90);
  for (let y = 10; y < 130; y++) {
    for (let x = 10; x < 110; x++) {
      const [r, g, b] = hsvToRgb(220 + ((x + y) % 4), 0.50 + ((x * 3 + y) % 5) * 0.01, 145);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  fill(rgba, width, 150, 80, 120, 40, 200, 0.9, 180);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.equal(boxCount(found.mask, width, 10, 10, 100, 120), 0, "roofs stay out");
  assert.ok(boxCount(found.mask, width, 160, 90, 100, 20) === 2000, "the river is in");
});

for (const saturation of [0.65, 0.7]) {
  test(`a flat river at saturation ${saturation} is water, and reports its own colour`, () => {
    const width = 300, height = 200;
    const rgba = blank(width, height, 80, 0.35, 90);
    fill(rgba, width, 40, 60, 220, 80, 200, saturation, 180);
    const found = detectWater(rgba, width, height);
    assert.equal(found.status, "found");
    assert.ok(Math.abs(found.waterColor.saturation - saturation) < 0.01, `saturation ${found.waterColor.saturation}`);
    assert.ok(Math.abs(found.waterColor.hue - 200) < 1, `hue ${found.waterColor.hue}`);
  });
}

test("a roof touching the river stays out on the night grade", () => {
  const width = 400, height = 240;
  const rgba = blank(width, height, 80, 0.35, 90);
  fill(rgba, width, 0, 120, width, 40, 210, 0.92, 165);
  fill(rgba, width, 100, 50, 80, 70, 224, 0.55, 128);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.equal(boxCount(found.mask, width, 100, 50, 80, 66), 0, "roof pixels");
  assert.ok(boxCount(found.mask, width, 0, 125, width, 30) === width * 30, "river pixels");
});

test("the top of a roof cluster centred below the floor is not a water colour", () => {
  const width = 300, height = 200;
  const rgba = blank(width, height, 80, 0.35, 90);
  for (let y = 20; y < 180; y++) {
    for (let x = 20; x < 280; x++) {
      const [r, g, b] = hsvToRgb(225, 0.56 + ((x * 7 + y * 13) % 12) * 0.01, 150);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  assert.deepEqual(detectWater(rgba, width, height), { status: "none", reason: "no-saturated-colour" });
});

test("roof tails give up their turn, and the river at the next hue is found", () => {
  const width = 400, height = 300;
  const rgba = blank(width, height, 80, 0.35, 90);
  for (let y = 10; y < 160; y++) {
    for (let x = 10; x < 250; x++) {
      const [r, g, b] = hsvToRgb(225, 0.56 + ((x * 7 + y * 13) % 12) * 0.01, 150);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  fill(rgba, width, 100, 200, 120, 40, 200, 0.9, 180);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.ok(Math.abs(found.waterColor.hue - 200) < 2, `hue ${found.waterColor.hue}`);
  assert.equal(found.mask[220 * width + 150], 1, "the river");
  assert.equal(found.mask[80 * width + 100], 0, "the roofs");
});

test("roofs spread over many hues, each window larger than the river, still let the small river through", () => {
  const width = 800, height = 600;
  const rgba = blank(width, height, 80, 0.35, 90);
  for (let y = 10; y < 410; y++) {
    for (let x = 10; x < 790; x++) {
      const [r, g, b] = hsvToRgb(217 + (x % 15), 0.56 + ((x * 7 + y * 13) % 12) * 0.01, 150);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  fill(rgba, width, 100, 500, 150, 12, 200, 0.92, 180);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.ok(Math.abs(found.waterColor.hue - 200) < 2, `hue ${found.waterColor.hue}`);
});

test("a river is not the tail of a larger, duller body at its hue with empty saturation between them", () => {
  const width = 320, height = 240;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paint = (x0, y0, w, h, colour) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set([...colour, 255], (y * width + x) * 4);
  };
  paint(0, 0, width, height, [90, 90, 90]);
  paint(8, 8, 180, 160, [90, 150, 180]);
  paint(220, 90, 80, 50, [39, 133, 180]);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.ok(Math.abs(found.waterColor.saturation - 141 / 180) < 0.01, `saturation ${found.waterColor.saturation}`);
  assert.equal(found.mask[110 * width + 260], 1);
});

test("a saturated lake with a soft shore is water, though most of it sits below the floor", () => {
  const width = 512, height = 384;
  const rgba = blank(width, height, 45, 0.45, 110);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const r = Math.hypot(x - 256, y - 192) / 100;
      if (r < 1) rgba.set([...hsvToRgb(200, 0.95 - 0.5 * r, 200), 255], (y * width + x) * 4);
    }
  }
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.ok(found.proposals[0].share > 0.12, `share ${found.proposals[0].share}`);
});

test("one body at 0.57 with a smaller cap at 0.67 is a tail, not water", () => {
  const width = 320, height = 240;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paint = (x0, y0, w, h, colour) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set([...colour, 255], (y * width + x) * 4);
  };
  paint(0, 0, width, height, [90, 90, 90]);
  paint(20, 20, 200, 140, [78, 146, 180]);
  paint(40, 40, 80, 50, [60, 140, 180]);
  assert.deepEqual(detectWater(rgba, width, height), { status: "none", reason: "no-saturated-colour" });
});

test("a bright speck has too few votes to paint a large duller area as water", () => {
  const width = 400, height = 400;
  const rgba = blank(width, height, 80, 0.35, 90);
  fill(rgba, width, 40, 40, 200, 200, 200, 0.6, 150);
  fill(rgba, width, 300, 300, 8, 8, 200, 0.9, 180);
  assert.deepEqual(detectWater(rgba, width, height), { status: "none", reason: "nothing-left" });
});

const MUTED = () => {
  const width = 200, height = 200;
  const rgba = blank(width, height, 30, 0.2, 70);
  fill(rgba, width, 20, 20, 80, 60, 205, 0.38, 90);
  return { rgba, width, height };
};

test("muted water the automatic pass rejects is selected by a click", () => {
  const { rgba, width, height } = MUTED();
  assert.equal(detectWater(rgba, width, height).status, "none");
  const picked = selectColourAt(rgba, width, height, { x: 60, y: 50 });
  assert.equal(picked.status, "found");
  assert.ok(Math.abs(picked.seed.hue - 205) < 2, `hue ${picked.seed.hue}`);
  assert.ok(Math.abs(picked.seed.saturation - 0.38) < 0.02, `saturation ${picked.seed.saturation}`);
  const { proposal } = picked;
  assert.equal(proposal.id, "area-1");
  assert.equal(proposal.preselected, true);
  assert.equal(proposal.clicked, true);
  assert.equal(proposal.pixels.length, 80 * 60);
  assert.equal(proposal.share, (80 * 60) / (width * height));
  assertSound({ proposals: [proposal] }, width, height);
  assert.deepEqual(proposal.loops[0].points, [20, 20, 100, 20, 100, 80, 20, 80]);
});

test("a click with no colour under it, or on a speck, returns a reason", () => {
  const width = 400, height = 400;
  const rgba = blank(width, height, 30, 0.02, 120);
  fill(rgba, width, 150, 150, 6, 6, 205, 0.5, 90);
  assert.deepEqual(selectColourAt(rgba, width, height, { x: 40, y: 40 }), { status: "none", reason: "no-colour" });
  assert.deepEqual(selectColourAt(rgba, width, height, { x: 152, y: 152 }), { status: "none", reason: "too-small" });
  const clear = blank(40, 40, 205, 0.5, 90, 0);
  assert.deepEqual(selectColourAt(clear, 40, 40, { x: 20, y: 20 }), { status: "none", reason: "no-colour" });
});

test("a click on an existing piece is already water, and a removed piece can be clicked again", () => {
  const { rgba, width, height } = scene();
  const auto = detectWater(rgba, width, height);
  assert.deepEqual(selectColourAt(rgba, width, height, { x: 150, y: 50 }, { claimed: auto.proposals }), { status: "none", reason: "already-water" });
  assert.equal(selectColourAt(rgba, width, height, { x: 150, y: 50 }, { claimed: [] }).status, "found");
});

test("a clicked piece shares no pixel with a claimed one, and its id is new", () => {
  const width = 200, height = 120;
  const rgba = blank(width, height, 30, 0.3, 80);
  fill(rgba, width, 20, 20, 160, 80, 205, 0.5, 110);
  const claimed = [{ id: "area-7", pixels: Int32Array.from({ length: 100 }, (_, i) => (30 + (i >> 1)) * width + 60 + (i % 2) * 40) }, { id: "area-2", pixels: new Int32Array() }];
  const before = new Set(claimed[0].pixels);
  const picked = selectColourAt(rgba, width, height, { x: 150, y: 60 }, { claimed });
  assert.equal(picked.status, "found");
  assert.equal(picked.proposal.id, "area-8");
  for (const p of picked.proposal.pixels) assert.equal(before.has(p), false, `pixel ${p} is taken`);
});

test("pieces that meet share no pixel, and their polygons overlap only within the simplification tolerance", () => {
  const width = 200, height = 200;
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const shore = 100 + Math.round(19 * Math.sin(y / 3));
    for (let x = 0; x < width; x++) rgba.set(x < shore ? [20, 140, 200, 255] : [160, 50, 50, 255], (y * width + x) * 4);
  }
  const auto = detectWater(rgba, width, height);
  const picked = selectColourAt(rgba, width, height, { x: 170, y: 100 }, { claimed: auto.proposals });
  assert.equal(picked.status, "found");
  const owner = new Uint8Array(width * height);
  for (const proposal of auto.proposals) for (const p of proposal.pixels) owner[p] = 1;
  for (const p of picked.proposal.pixels) { assert.equal(owner[p], 0, `pixel ${p}`); owner[p] = 2; }
  const inRing = (x, y, points) => {
    let inside = false;
    for (let i = 0, j = points.length - 2; i < points.length; j = i, i += 2) {
      if ((points[i + 1] > y) !== (points[j + 1] > y) && x < ((points[j] - points[i]) * (y - points[i + 1])) / (points[j + 1] - points[i + 1]) + points[i]) inside = !inside;
    }
    return inside;
  };
  const covers = (proposal, x, y) => proposal.loops.some((loop) => !loop.hole && inRing(x, y, loop.points)) && !proposal.loops.some((loop) => loop.hole && inRing(x, y, loop.points));
  const tolerance = Math.max(...WATER_TUNING.simplifyPx);
  let overlapped = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!covers(picked.proposal, x + 0.5, y + 0.5) || !auto.proposals.some((proposal) => covers(proposal, x + 0.5, y + 0.5))) continue;
      overlapped++;
      const other = owner[y * width + x] === 1 ? 2 : 1;
      let nearest = Infinity;
      for (let v = Math.max(0, y - 4); v <= Math.min(height - 1, y + 4); v++) {
        for (let u = Math.max(0, x - 4); u <= Math.min(width - 1, x + 4); u++) if (owner[v * width + u] === other) nearest = Math.min(nearest, Math.hypot(u - x, v - y));
      }
      assert.ok(nearest - 0.5 <= tolerance, `(${x}, ${y}) is ${nearest} from the other piece`);
    }
  }
  assert.ok(overlapped > 0, "this shore does make the polygons overlap, so the bound was tested");
});

test("corner settling near a claimed piece keeps the pieces apart and the ring sound", () => {
  const size = 128;
  const rgba = noise(size, 0.93).map((value, i) => (i % 4 === 3 ? 255 : value));
  const stripes = [];
  for (let y = 40; y < 90; y++) for (let x = 40; x < 90; x++) if ((x + y) % 2) stripes.push(y * size + x);
  const claimed = [{ id: "area-1", pixels: Int32Array.from(stripes) }];
  const picked = selectColourAt(rgba, size, size, { x: 10, y: 10 }, { claimed });
  assert.equal(picked.status, "found");
  const taken = new Set(stripes);
  for (const p of picked.proposal.pixels) assert.equal(taken.has(p), false);
  assertSound({ proposals: [picked.proposal] }, size, size);
  for (const loop of picked.proposal.loops) assert.equal(isSimple(loop.points), true);
});

test("a click on unclaimed muted water beside claimed water follows the muted water", () => {
  const width = 300, height = 200;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paint = (x0, y0, w, h, colour) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set([...colour, 255], (y * width + x) * 4);
  };
  paint(0, 0, width, height, [90, 90, 90]);
  paint(40, 100, 60, 80, [70, 110, 130]);
  paint(100, 60, 120, 120, [20, 140, 210]);
  const auto = detectWater(rgba, width, height);
  const picked = selectColourAt(rgba, width, height, { x: 99, y: 100 }, { claimed: auto.proposals });
  assert.equal(picked.status, "found");
  assert.equal(picked.proposal.pixels.length, 60 * 80);
  assert.ok(Math.abs(picked.seed.saturation - 60 / 130) < 0.01, `saturation ${picked.seed.saturation}`);
});

for (const streamWidth of [3, 4, 6]) {
  test(`a click on a ${streamWidth} pixel stream selects the stream, not the bank around it`, () => {
    const width = 400, height = 300;
    const rgba = new Uint8ClampedArray(width * height * 4);
    const top = 150 - (streamWidth >> 1);
    for (let y = 0; y < height; y++) {
      const colour = y >= top && y < top + streamWidth ? [70, 95, 115] : [125, 105, 75];
      for (let x = 0; x < width; x++) rgba.set([...colour, 255], (y * width + x) * 4);
    }
    const picked = selectColourAt(rgba, width, height, { x: 200, y: 150 });
    assert.equal(picked.status, "found");
    assert.equal(picked.proposal.pixels.length, width * streamWidth);
    assert.ok(Math.abs(picked.seed.hue - 207) < 2, `hue ${picked.seed.hue}`);
  });
}

test("a click on foam reads the water around it", () => {
  const width = 200, height = 200;
  const rgba = blank(width, height, 30, 0.2, 70);
  fill(rgba, width, 20, 20, 120, 120, 205, 0.5, 120);
  fill(rgba, width, 79, 79, 3, 3, 0, 0.02, 240);
  const picked = selectColourAt(rgba, width, height, { x: 80, y: 80 });
  assert.equal(picked.status, "found");
  assert.ok(Math.abs(picked.seed.hue - 205) < 2, `hue ${picked.seed.hue}`);
  assert.equal(picked.proposal.pixels.length, 120 * 120);
});

const CLAIMED_POCKET = () => {
  const width = 200, height = 200;
  const rgba = new Uint8ClampedArray(width * height * 4);
  const paint = (x0, y0, w, h, colour) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) rgba.set([...colour, 255], (y * width + x) * 4);
  };
  paint(0, 0, width, height, [80, 80, 80]);
  paint(86, 98, 8, 4, [55, 95, 110]);
  const pixels = [];
  for (let y = 99; y <= 100; y++) for (let x = 87; x <= 93; x++) pixels.push(y * width + x);
  return { rgba, width, height, paint, claimed: [{ id: "area-1", pixels: Int32Array.from(pixels) }] };
};

test("what a click leaves after the claimed pixels are gone must itself clear the size minimum", () => {
  const { rgba, width, height, claimed } = CLAIMED_POCKET();
  assert.ok(18 < width * height * WATER_TUNING.componentMinShare);
  assert.deepEqual(selectColourAt(rgba, width, height, { x: 86, y: 99 }, { claimed }), { status: "none", reason: "too-small" });
});

test("a pocket below the minimum never comes back as a speck, even with a large pool past its neck", () => {
  const { rgba, width, height, paint, claimed } = CLAIMED_POCKET();
  paint(94, 98, 6, 1, [55, 95, 110]);
  paint(100, 80, 50, 40, [55, 95, 110]);
  const picked = selectColourAt(rgba, width, height, { x: 86, y: 99 }, { claimed });
  if (picked.status === "found") assert.ok(picked.proposal.pixels.length >= width * height * WATER_TUNING.componentMinShare, `${picked.proposal.pixels.length} pixels`);
  else assert.equal(picked.reason, "too-small");
});

test("a red pool is selected across the hue wrap", () => {
  const width = 120, height = 120;
  const rgba = blank(width, height, 120, 0.4, 80);
  for (let y = 20; y < 100; y++) {
    for (let x = 20; x < 100; x++) {
      const [r, g, b] = hsvToRgb((x + y) % 2 ? 355 : 3, 0.7, 170);
      rgba.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  const picked = selectColourAt(rgba, width, height, { x: 60, y: 60 });
  assert.equal(picked.status, "found");
  assert.ok(picked.proposal.pixels.length >= 6400);
  assert.ok(picked.seed.hue < 10 || picked.seed.hue > 350, `hue ${picked.seed.hue}`);
});

for (const [holeHue, waterHue] of [[190, 220], [200, 300]]) test(`a small blue hole at hue ${holeHue} stays open in water at hue ${waterHue}`, () => {
  const width = 256, height = 256;
  const rgba = blank(width, height, waterHue, 0.9, 180);
  fill(rgba, width, 100, 100, 8, 8, holeHue, 0.4, 170);
  const picked = selectColourAt(rgba, width, height, { x: 10, y: 10 });
  assert.equal(picked.status, "found");
  assert.equal(picked.proposal.loops.filter((loop) => loop.hole).length, 1);
  assert.equal(new Set(picked.proposal.pixels).has(104 * width + 104), false);
});

test("the automatic pass keeps a small coloured island using the same hole rules as a click", () => {
  const width = 256, height = 256;
  const rgba = blank(width, height, 200, 0.9, 180);
  fill(rgba, width, 100, 100, 10, 10, 25, 0.7, 120);
  const found = detectWater(rgba, width, height);
  assert.equal(found.status, "found");
  assert.equal(found.proposals[0].loops.filter((loop) => loop.hole).length, 1);
});

test("saturated grass does not join teal water through the weak hue band alone", () => {
  const width = 200, height = 200;
  const rgba = blank(width, height, 150, 0.75, 160);
  fill(rgba, width, 0, 90, 200, 20, 115, 0.8, 140);
  const picked = selectColourAt(rgba, width, height, { x: 100, y: 40 });
  assert.equal(picked.status, "found");
  const pixels = new Set(picked.proposal.pixels);
  assert.equal(pixels.has(40 * width + 100), true, "clicked water remains selected");
  assert.equal(pixels.has(100 * width + 100), false, "touching grass stays outside the narrow selection");
  assert.equal(pixels.has(140 * width + 100), false, "selection cannot cross the grass strip");
  const wide = selectColourAt(rgba, width, height, { x: 100, y: 40 }, { broad: true });
  assert.equal(new Set(wide.proposal.pixels).has(100 * width + 100), true, "wide range requires GM review of similar land");
});

test("a click off the image reads the nearest edge pixel, and short pixels throw", () => {
  const { rgba, width, height } = MUTED();
  assert.ok(selectColourAt(rgba, width, height, { x: -40, y: -40 }).proposal.pixels.includes(0));
  assert.throws(() => selectColourAt(new Uint8Array(4), width, height, { x: 0, y: 0 }), /shorter/);
});

for (const [name, build, x, y] of [
  ["all water", () => canvasOf(1024, 1024, WATER), 512, 512],
  ["spiral canal", () => spiralCanal(1024), 9, 9],
  ["sawtooth rivers", () => sawtoothRivers(1024), 1, 512],
]) {
  test(`a click on ${name} finishes within a second`, () => {
    const rgba = build();
    const start = performance.now();
    const picked = selectColourAt(rgba, 1024, 1024, { x, y });
    const elapsed = performance.now() - start;
    assert.equal(picked.status, "found");
    assert.ok(elapsed < 1000, `${elapsed.toFixed(0)} ms`);
  });
}


test("adding a pale shoreline to a draft keeps its existing water and boat holes", () => {
  const width = 200, height = 200;
  const rgba = blank(width, height, 40, 0.5, 190);
  fill(rgba, width, 10, 10, 180, 180, 210, 0.85, 170);
  fill(rgba, width, 10, 10, 180, 20, 202, 0.25, 170);
  fill(rgba, width, 80, 60, 12, 12, 30, 0.75, 120);
  const auto = detectWater(rgba, width, height);
  assert.equal(auto.status, "found");
  const target = auto.proposals[0];
  assert.equal(new Set(target.pixels).has(20 * width + 30), false);
  const clicked = selectColourAt(rgba, width, height, { x: 30, y: 20 });
  assert.equal(clicked.status, "found");
  const merged = mergeAreaProposals([target, clicked.proposal], width, height);
  const pixels = new Set(merged.pixels);
  assert.equal(merged.id, target.id);
  assert.equal(pixels.has(20 * width + 30), true, "pale shallows added");
  assert.equal(pixels.has(150 * width + 150), true, "deep water retained");
  assert.equal(pixels.has(65 * width + 85), false, "boat stays a hole");
  assert.equal(pixels.has(5 * width + 5), false, "sand stays out");
  assert.equal(merged.loops.filter((loop) => !loop.hole).length, 1);
  for (const loop of merged.loops) assert.equal(isSimple(loop.points), true);
});

test("combining disconnected areas makes one region without water between them", () => {
  const width = 200, height = 200;
  const rgba = blank(width, height, 40, 0.5, 190);
  fill(rgba, width, 10, 10, 50, 50, 210, 0.85, 170);
  fill(rgba, width, 120, 120, 50, 50, 210, 0.85, 170);
  const auto = detectWater(rgba, width, height);
  assert.equal(auto.proposals.length, 2);
  const combined = mergeAreaProposals(auto.proposals, width, height);
  assert.equal(combined.loops.filter((loop) => !loop.hole).length, 2);
  assert.equal(combined.pixels.length, 5000);
  assert.equal(new Set(combined.pixels).has(90 * width + 90), false);
  const data = toRegionData(combined, { sceneRect: { x: 0, y: 0, width, height }, imageWidth: width, imageHeight: height, waterKind: "sea" });
  assert.equal(data.shapes.filter((shape) => !shape.hole).length, 2);
  assert.equal(data.flags.animater.waterKind, "sea");
});

test("combining areas settles diagonal contacts without entering another claimed area", () => {
  const width = 8, height = 8;
  const first = { id: "area-1", pixels: new Int32Array([9, 10, 17, 18]) };
  const next = { id: "area-2", pixels: new Int32Array([27, 28, 35, 36]) };
  const claimed = [{ pixels: new Int32Array([19]) }];
  const combined = mergeAreaProposals([first, next], width, height, { claimed });
  assert.equal(new Set(combined.pixels).has(19), false);
  for (const loop of combined.loops) assert.equal(isSimple(loop.points), true);
});


test("extending saved water retains its existing overlap without claiming more of another region", () => {
  const target = { id: "area-1", pixels: new Int32Array([0, 1, 10, 11]) };
  const added = { pixels: new Int32Array([2, 3, 12, 13]) };
  const claimed = [{ pixels: new Int32Array([1, 3, 11, 13]) }];
  const merged = mergeAreaProposals([target, added], 10, 10, { claimed, preserveTarget: true });
  const pixels = new Set(merged.pixels);
  assert.equal(pixels.has(1), true);
  assert.equal(pixels.has(11), true);
  assert.equal(pixels.has(3), false);
  assert.equal(pixels.has(13), false);
});

test("claiming a saved shore drops leftover sliver components instead of offering their combined share", () => {
  const width = 200, height = 200, count = width * height;
  const min = count * WATER_TUNING.componentMinShare;
  assert.ok(min > 1, "map is large enough that one pixel is below the component floor");
  const claimedPixels = [];
  for (let y = 10; y < 50; y++) for (let x = 10; x < 50; x++) claimedPixels.push(y * width + x);
  const slivers = [];
  for (let i = 0; i < Math.ceil(min) + 10; i++) slivers.push(60 * width + 2 * i);
  assert.ok(slivers.length > min);
  assert.ok(slivers.every((_, i) => i === 0 || slivers[i] - slivers[i - 1] > 1));
  const detected = { id: "area-1", pixels: Int32Array.from([...claimedPixels, ...slivers]) };
  const claimed = [{ id: "saved", pixels: Int32Array.from(claimedPixels) }];
  const merged = mergeAreaProposals([detected], width, height, { claimed, dropSmallComponents: true });
  assert.equal(merged.pixels.length, 0, "isolated shore slivers are not one fresh area");
  assert.ok(merged.share < WATER_TUNING.componentMinShare);

  const real = [];
  for (let y = 120; y < 150; y++) for (let x = 120; x < 150; x++) real.push(y * width + x);
  const withReal = mergeAreaProposals([{ id: "area-1", pixels: Int32Array.from([...claimedPixels, ...slivers, ...real]) }], width, height, { claimed, dropSmallComponents: true });
  assert.equal(withReal.pixels.length, real.length, "a real leftover keeps only its own component");
  assert.equal(new Set(withReal.pixels).has(slivers[0]), false);
});

test("combining into a saved region keeps a small pond under the component size floor", () => {
  const width = 400, height = 400, count = width * height;
  const min = count * WATER_TUNING.componentMinShare;
  assert.ok(min > 90 && min < 97);
  const block = [];
  for (let y = 10; y < 110; y++) for (let x = 10; x < 110; x++) block.push(y * width + x);
  const pond = [];
  for (let y = 200; y < 208; y++) for (let x = 200; x < 208; x++) pond.push(y * width + x);
  assert.equal(pond.length, 64);
  assert.ok(pond.length < min);
  const added = [];
  for (let y = 10; y < 110; y++) for (let x = 110; x < 150; x++) added.push(y * width + x);
  const target = { id: "area-1", pixels: Int32Array.from([...block, ...pond]) };
  const merged = mergeAreaProposals([target, { pixels: Int32Array.from(added) }], width, height, { preserveTarget: true });
  const pixels = new Set(merged.pixels);
  assert.equal(pond.filter((p) => pixels.has(p)).length, 64, "the pond survives combine");
  assert.equal(block.filter((p) => pixels.has(p)).length, block.length);
  assert.equal(added.filter((p) => pixels.has(p)).length, added.length);
});

test("selection coverage includes fractional boundary cells but leaves full hole cells clear", () => {
  const box = (x, y, w, h, hole = false) => ({ points: [x, y, x + w, y, x + w, y + h, x, y + h], hole });
  const pixels = areaPixels([box(0.25, 0.25, 9, 9), box(3, 3, 2, 2, true)], 12, 12);
  assert.equal(pixels.length, 96);
  assert.ok(pixels.includes(9 * 12 + 9));
  assert.equal(pixels.includes(3 * 12 + 3), false);
  const triangle = [{ points: [0.25, 0.25, 2.25, 0.25, 0.25, 2.25], hole: false }];
  assert.deepEqual([...areaPixels(triangle, 4, 4)], [0, 1, 2, 4, 5, 8]);
});
