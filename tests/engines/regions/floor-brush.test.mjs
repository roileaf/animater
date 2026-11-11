import test from 'node:test';
import assert from 'node:assert/strict';
import { colourAt, dabCells, planFloorStroke, floorRegionName } from '../../../scripts/engines/regions/floor-brush.mjs';
import { areaPixels } from '../../../scripts/engines/regions/floor-detect.mjs';

// Roi: "can we add quick smart free hand tool to create regions? something like our decorator brush but for floors?"
// A 40×40 map: blue water on the left half (x < 20), green grass on the right.
const W = 40, H = 40;
const map = () => { const rgba = new Uint8ClampedArray(W * H * 4); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; rgba.set(x < 20 ? [40, 120, 170, 255] : [110, 160, 60, 255], i); } return rgba; };
const count = (cells) => cells.length;
const xs = (cells) => cells.map((i) => i % W);

test('the colour where a stroke begins is read from a small patch round it', () => {
  const c = colourAt(map(), W, H, 5, 5);
  assert.deepEqual(c.map(Math.round), [40, 120, 170]);
});

test('a smart dab fills only what matches the stroke\'s colour, inside the ring: water stops at the bank', () => {
  const rgba = map(), seed = colourAt(rgba, W, H, 17, 20);
  const smart = dabCells({ rgba, width: W, height: H, x: 18, y: 20, radius: 6, seed, tolerance: 30, smart: true });
  assert.ok(count(smart) > 40);
  assert.ok(xs(smart).every((x) => x < 20), 'never onto the grass');
  const plain = dabCells({ rgba, width: W, height: H, x: 18, y: 20, radius: 6, seed, tolerance: 30, smart: false });
  assert.ok(xs(plain).some((x) => x >= 20), 'without Smart edges the whole ring');
  assert.ok(count(plain) > count(smart));
  // Every cell is inside the ring.
  for (const i of plain) assert.ok((i % W - 18) ** 2 + (Math.floor(i / W) - 20) ** 2 <= 36);
});

test('a dab keeps off pixels it may not take (another floor\'s region)', () => {
  const rgba = map(), seed = colourAt(rgba, W, H, 10, 10);
  const cells = dabCells({ rgba, width: W, height: H, x: 10, y: 10, radius: 5, seed, tolerance: 30, smart: true, allowed: (i) => i % W !== 10 });
  assert.ok(cells.length && cells.every((i) => i % W !== 10));
});

test('a dab that lands on a fleck of another colour still finds its floor nearby', () => {
  const rgba = map(); rgba.set([250, 250, 250, 255], (10 * W + 10) * 4);
  const cells = dabCells({ rgba, width: W, height: H, x: 10, y: 10, radius: 4, seed: [40, 120, 170], tolerance: 30, smart: true });
  assert.ok(cells.length > 20);
});

const square = (x0, y0, x1, y1) => [{ points: [x0, y0, x1, y0, x1, y1, x0, y1], hole: false }];
const saved = (regionId, floor, loops) => ({ regionId, floor, pixels: areaPixels(loops, W, H) });
const strokeOf = (x0, y0, x1, y1) => { const s = new Uint8Array(W * H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) s[y * W + x] = 1; return s; };

test('a stroke on open ground makes one new region traced round it', () => {
  const plan = planFloorStroke({ saved: [], floor: 'grass', stroke: strokeOf(22, 5, 30, 12), erase: false, width: W, height: H });
  assert.equal(plan.creates.length, 1); assert.equal(plan.updates.length, 0); assert.equal(plan.removes.length, 0);
  assert.ok(plan.creates[0].loops.length >= 1 && plan.creates[0].loops[0].points.length >= 8);
});

test('a stroke touching a region of the same floor grows it; two it joins become one', () => {
  const a = saved('A', 'grass', square(22, 5, 26, 10)), b = saved('B', 'grass', square(30, 5, 34, 10)), w = saved('W', 'water', square(2, 2, 10, 10));
  const plan = planFloorStroke({ saved: [a, b, w], floor: 'grass', stroke: strokeOf(25, 6, 31, 9), erase: false, width: W, height: H });
  assert.equal(plan.creates.length, 0);
  assert.deepEqual(plan.updates.map((u) => u.regionId), ['A']);
  assert.deepEqual(plan.removes, ['B']);
  const grown = areaPixels(plan.updates[0].loops, W, H).length;
  assert.ok(grown > a.pixels.length + b.pixels.length, 'covers both and the stroke between');
});

test('a stroke of another floor beside a region leaves it alone and makes its own', () => {
  const a = saved('A', 'grass', square(22, 5, 26, 10));
  const plan = planFloorStroke({ saved: [a], floor: 'stone', stroke: strokeOf(26, 5, 30, 10), erase: false, width: W, height: H });
  assert.equal(plan.creates.length, 1); assert.equal(plan.updates.length, 0);
});

test('rubbing out takes pixels from any floor region it crosses, and removes one it empties', () => {
  const a = saved('A', 'grass', square(22, 5, 32, 10)), b = saved('B', 'water', square(2, 2, 6, 6));
  const plan = planFloorStroke({ saved: [a, b], floor: 'grass', stroke: (() => { const s = strokeOf(26, 0, 28, 20); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) s[y * W + x] = 1; return s; })(), erase: true, width: W, height: H });
  assert.deepEqual(plan.removes, ['B']);
  assert.deepEqual(plan.updates.map((u) => u.regionId), ['A']);
  const left = areaPixels(plan.updates[0].loops, W, H);
  assert.ok(left.length < a.pixels.length && left.length > 0);
  assert.ok(![...left].some((i) => i % W >= 26 && i % W < 28), 'the rubbed strip is gone');
});

test('a stroke too small to matter changes nothing', () => {
  const plan = planFloorStroke({ saved: [], floor: 'grass', stroke: strokeOf(5, 5, 6, 6), erase: false, width: W, height: H });
  assert.deepEqual(plan, { updates: [], creates: [], removes: [] });
});

// Roi: "can we use the SAM model for drawing smarterly?" With Edges set to Model, a dab fills only inside the model's outline.
test('with the model\'s outline, a dab fills the ring where it overlaps the outline, whatever the colours', () => {
  const rgba = map(), within = new Uint8Array(W * H); for (let y = 0; y < H; y++) for (let x = 15; x < 25; x++) within[y * W + x] = 1;
  const cells = dabCells({ rgba, width: W, height: H, x: 20, y: 20, radius: 8, within, allowed: (i) => i % W !== 24 });
  assert.ok(cells.length > 50);
  assert.ok(cells.every((i) => i % W >= 15 && i % W < 24), 'inside the outline, and still keeps off what it may not take');
  assert.ok(cells.some((i) => i % W < 20) && cells.some((i) => i % W >= 20), 'across the colour line: the model decides, not the colour');
});

test('the model\'s answer for a point: its middle size, the piece under the point, small holes filled', async () => {
  const { modelMaskFor } = await import('../../../scripts/engines/regions/floor-brush.mjs');
  const masks = [0, 1, 2].map((k) => { const m = new Uint8Array(W * H); for (let y = 10; y < 10 + 6 * (k + 1); y++) for (let x = 10; x < 10 + 6 * (k + 1); x++) m[y * W + x] = 1; return m; });
  masks[1][2 * W + 2] = 1; // a stray speck away from the point
  masks[1][14 * W + 14] = 0; // a pinhole inside
  const mask = modelMaskFor({ masks, scores: [0.9, 0.8, 0.7], width: W, height: H, at: { x: 12, y: 12 } });
  let n = 0; for (const v of mask) n += v;
  assert.equal(n, 144, 'the middle size (12×12), its pinhole filled, the speck dropped');
  assert.equal(mask[2 * W + 2], 0);
});

// Roi: "something is not working good with the model it paints stuff it shouldnt". The brush takes a point as Floor regions'
// Smart selection takes a click: the outline most nearby clicks agree on, then only the parts in the clicked floor's colours.
test('the model\'s answer keeps to the clicked floor\'s colours: a bush inside the outline is left out', async () => {
  const { modelMaskFor } = await import('../../../scripts/engines/regions/floor-brush.mjs');
  const rgba = new Uint8ClampedArray(W * H * 4); for (let i = 0; i < W * H; i++) rgba.set([100, 160, 60, 255], i * 4);
  for (let y = 18; y < 26; y++) for (let x = 18; x < 26; x++) rgba.set([200, 60, 160, 255], (y * W + x) * 4); // a pink bush on the grass
  const whole = new Uint8Array(W * H).fill(1);
  const mask = modelMaskFor({ sets: [[whole, whole, whole]], rgba, width: W, height: H, at: { x: 5, y: 5 } });
  assert.equal(mask[22 * W + 22], 0, 'the bush stays out');
  assert.equal(mask[5 * W + 5], 1, 'the grass is in');
});

test('with several clicks\' answers, the outline most of them agree on wins', async () => {
  const { modelMaskFor } = await import('../../../scripts/engines/regions/floor-brush.mjs');
  const box = (x0, y0, x1, y1) => { const m = new Uint8Array(W * H); for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) m[y * W + x] = 1; return m; };
  const room = box(5, 5, 30, 30), speck = box(10, 10, 13, 13), most = box(0, 0, W, H);
  const sets = [[speck, room, most], [room, room, most], [room, most, most], [room, room, most], [speck, room, most]];
  const mask = modelMaskFor({ sets, width: W, height: H, at: { x: 11, y: 11 } });
  let n = 0; for (const v of mask) n += v;
  assert.equal(n, 25 * 25, 'the room, not the speck under the point nor most of the map');
});

test('new regions are named after their floor and numbered on', () => {
  assert.equal(floorRegionName('grass', []), 'Grass 1');
  assert.equal(floorRegionName('grass', ['Grass 1', 'Grass 3', 'Water 1']), 'Grass 4');
  assert.equal(floorRegionName('water', ['Grass 1']), 'Water 1');
});
