import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloudAreas, towardSun, cloudPixels, skyMakeup, skyCount, skyHome, skyAlong, skySquares, skyLight, CLOUD_LIGHT, createDrawnClouds, DEFAULT_TRANSPARENCY } from '../../../scripts/engines/motion/drawn-clouds.mjs';
import { TUNE_EFFECTS, TUNE_SLIDERS, cleanTune, tuneAdds } from '../../../scripts/engines/motion/weather-tune.mjs';
import { weatherPanelHtml, effectToggled } from '../../../scripts/ui/weather-panel.mjs';

test('a cloud is a thing with clear sky round it, the same every time', () => {
  const a = cloudPixels(11, { N: 128 }), b = cloudPixels(11, { N: 128 });
  assert.deepEqual(a.body.slice(0, 4000), b.body.slice(0, 4000));
  const alpha = (x, y) => a.body[(y * 128 + x) * 4 + 3];
  assert.equal(alpha(1, 1), 0, 'clear at its corners');
  let solid = 0; for (let i = 3; i < a.body.length; i += 4) if (a.body[i] > 120) solid++;
  assert.ok(solid > 800, 'something there');
  // Lit on one side, shaded on the other: not one flat colour.
  let low = 255, high = 0; for (let i = 0; i < a.body.length; i += 4) if (a.body[i + 3] > 120) { low = Math.min(low, a.body[i]); high = Math.max(high, a.body[i]); }
  assert.ok(high - low > 60, 'it has volume');
  assert.equal(a.n, 32); assert.ok(a.shadow.some((v) => v > 200));
  assert.notDeepEqual(cloudPixels(23, { N: 128 }).body.slice(0, 40000), a.body.slice(0, 40000));
});
test('more cover makes more sky, closing over into rolling sheets, lit from everywhere', () => {
  assert.equal(skyMakeup(0).clouds, 0);
  assert.ok(skyMakeup(0.35).clouds > skyMakeup(0.15).clouds && skyMakeup(0.6).clouds > skyMakeup(0.35).clouds);
  assert.equal(skyMakeup(0.35).sheets, 0, 'scattered clouds have none');
  assert.ok(skyMakeup(1).sheets >= 16, 'a closed sky is mostly sheets');
  assert.ok(skyMakeup(1).flat > skyMakeup(0.35).flat);
});
test('a huge map draws no more clouds than it can afford, each bigger instead', () => {
  const small = skyCount(skyMakeup(0.6), 3600), huge = skyCount(skyMakeup(0.6), 60000);
  assert.equal(small.grow, 1);
  assert.ok(huge.sheets + huge.clouds <= 140); assert.ok(huge.grow > 1);
});
test('clouds stay out of rooms; their shadows fall through the holes in the roof', () => {
  const box = { x: 0, y: 0, width: 100, height: 100 }, room = [0, 0, 10, 0, 10, 10], hole = [2, 2, 4, 2, 4, 4];
  const outdoors = cloudAreas(box, { body: [room], rooms: [room], open: [hole] });
  assert.deepEqual(outdoors.body.holes, [room], 'no cloud over a room seen into');
  assert.deepEqual(outdoors.body.open, [], 'nor over the hole in its roof');
  assert.deepEqual(outdoors.shadow.holes, [room]);
  assert.deepEqual(outdoors.shadow.open, [hole], 'its shadow falls through');
  const roofed = cloudAreas(box, { body: [], rooms: [room] });
  assert.deepEqual(roofed.body.holes, [], 'over a roof as drawn it passes on');
  assert.deepEqual(roofed.shadow.holes, [room], 'its shadow lands on the roof tile, not the floor below');
  const below = cloudAreas(box, { rooms: [room], open: [hole], below: true });
  assert.equal(below.shadow.rect, null, 'underground, nothing but the openings');
  assert.deepEqual(below.shadow.open, [hole]);
  const soft = cloudAreas(box, { body: [room], bodySoft: [1], rooms: [room], roomSoft: [0.5], open: [hole] });
  assert.deepEqual(soft.body.soft, [1]); assert.deepEqual(soft.shadow.soft, [0.5], 'each room\'s edge fades as far as it says');
  assert.deepEqual(cloudAreas(box, { rooms: [room], roomSoft: [2], below: true }).shadow.soft, [], 'underground no room to fade');
});

test('a small map gets its own sky: clouds over it, not scattered far off its edges', () => {
  const box = { x: 1400, y: 1000, width: 5000, height: 4000 }, grid = 200, squares = skySquares(box, grid);
  const { clouds } = skyCount(skyMakeup(0.6), squares);
  assert.ok(clouds >= 15, 'enough to fill it at 60%');
  // The real measure: how many are over the map, of those a typical cloud's margin allows.
  const pad = 9 * grid; let over = 0;
  for (let i = 0; i < clouds; i++) { const [hx, hy] = skyHome(i * 2), x = skyAlong(box.x, box.width, pad, hx, 0), y = skyAlong(box.y, box.height, pad, hy, 0); if (x > box.x && x < box.x + box.width && y > box.y && y < box.y + box.height) over++; }
  assert.ok(over >= clouds * 0.2, `${over} of ${clouds} over the map`);
  // Bigger maps fill by area.
  assert.ok(skySquares({ width: 20000, height: 20000 }, 200) > squares * 4);
});
test('a cloud drifts on and comes round, never leaving its span, out of sight as it turns back', () => {
  let last = skyAlong(100, 1000, 300, 0.2, 0), wraps = 0;
  for (let run = 7; run < 6000; run += 7) { const x = skyAlong(100, 1000, 300, 0.2, run); assert.ok(x >= 100 - 300 && x < 100 + 1000 + 300); if (x < last) wraps++; else assert.ok(Math.abs(x - last - 7) < 1e-9, 'steady, no jump'); last = x; }
  assert.ok(wraps >= 3);
  assert.ok(skyAlong(0, 100, 10, 0.5, -500) >= -10, 'against the wind too');
});
test('adding clouds leaves the ones already there where they are', () => {
  assert.deepEqual(skyHome(3), skyHome(3));
  for (let i = 0; i < 50; i++) for (const v of skyHome(i)) assert.ok(v >= 0 && v < 1);
});
test('the sun colours the clouds: white high up, gold low down, its shade deepening, moonlit by night', () => {
  const noon = skyLight({ height: 60 }), gold = skyLight({ height: 10 }), set = skyLight({ height: 2 }), night = skyLight({ height: 60, sun: 0 });
  assert.ok(noon.lit[2] > 0.9, 'white at noon');
  assert.ok(gold.lit[2] < noon.lit[2] && set.lit[2] < gold.lit[2], 'warmer as it sinks');
  assert.ok(set.shade[1] < noon.shade[1], 'deeper shade');
  assert.ok(set.glow > noon.glow, 'more glow through its rims');
  assert.ok(night.lit[0] < night.lit[2], 'moonlight is blue'); assert.ok(night.lit[0] < noon.lit[0]);
  const between = skyLight({ height: 17 }); assert.ok(between.lit[2] > gold.lit[2] && between.lit[2] < noon.lit[2], 'it blends');
  const closed = skyLight({ height: 50, flat: 1 }); assert.ok(closed.shade[0] > noon.shade[0] && closed.contrast < noon.contrast, 'a closed sky lifts its shade');
  const wet = skyLight({ height: 50, rain: 1 }); assert.ok(wet.lit[0] < noon.lit[0], 'darker under rain');
  const dusk = skyLight({ height: 5, dark: 0.5 }), day = skyLight({ height: 5 }); assert.ok(dusk.lit[0] < day.lit[0] * 0.7, 'dims with the scene'); assert.ok(dusk.rim[0] < day.rim[0]);
  assert.ok(!CLOUD_LIGHT.includes('`'));
  assert.match(CLOUD_LIGHT, /uSolid/, 'however many overlap, the slider holds');
  assert.match(CLOUD_LIGHT, /dot\(facing, uSun\)/, 'lit from where the sun is');
  const source = readFileSync(new URL('../../../scripts/engines/motion/drawn-clouds.mjs', import.meta.url), 'utf8');
  assert.ok(!/\.rotation =/.test(source), 'a cloud never turns');
  const [x, y, z] = towardSun(0, 90); assert.ok(Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9 && Math.abs(z - 1) < 1e-9, 'overhead');
  const low = towardSun(Math.PI / 2, 10); assert.ok(low[1] > 0.9 && low[2] < 0.2, 'low in the south');
});
test('the Weather panel turns drawn clouds on, and its transparency shows only then', () => {
  assert.equal(TUNE_EFFECTS.drawnClouds.plain, true);
  assert.equal(cleanTune({ cloudClear: 0.7 }).cloudClear, 0.7);
  assert.equal(cleanTune({ cloudClear: 5 }).cloudClear, TUNE_SLIDERS.cloudClear.max, 'kept in range');
  assert.equal(cleanTune().drawnClouds, null, 'off unless asked');
  assert.equal(TUNE_SLIDERS.cloudClear.default, DEFAULT_TRANSPARENCY);
  assert.equal(effectToggled({ drawnClouds: null }, 'drawnClouds'), 1);
  assert.equal(effectToggled({ drawnClouds: 1 }, 'drawnClouds'), null);
  assert.equal(tuneAdds(cleanTune({ drawnClouds: 1 })), true);
  const off = weatherPanelHtml({ state: { tune: cleanTune() } }), on = weatherPanelHtml({ state: { tune: cleanTune({ drawnClouds: 1 }) } });
  assert.match(off, /data-key="drawnClouds"/); assert.doesNotMatch(off, /data-tune="cloudClear"/);
  assert.match(on, /data-tune="cloudClear"/); assert.doesNotMatch(on, /data-tune="drawnClouds"/, 'on or off: no strength of its own');
});
test('off, the layer draws and bakes nothing', () => {
  const layer = createDrawnClouds({ PIXI: {}, root: () => null, floor: () => null, bounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) });
  layer.look({ on: false }); layer.tick(0.1);
  assert.equal(layer.busy, false); assert.equal(layer.baked, 0); assert.equal(layer.count, 0);
});
