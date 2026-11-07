import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudPixels, skyMakeup, skyCount, skyHome, skyMatrix, createDrawnClouds, DEFAULT_TRANSPARENCY } from '../../../scripts/engines/motion/drawn-clouds.mjs';
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
test('adding clouds leaves the ones already there where they are', () => {
  assert.deepEqual(skyHome(3), skyHome(3));
  for (let i = 0; i < 50; i++) for (const v of skyHome(i)) assert.ok(v >= 0 && v < 1);
});
test('the sky holds one strength however many overlap: its alpha is the slider', () => {
  assert.equal(skyMatrix(0, 0.6)[18], 0.6);
  const clear = skyMatrix(0, 1); assert.equal(clear[0], 1); assert.equal(clear[4], 0);
  const flat = skyMatrix(0.5, 1); assert.ok(flat[4] > 0, 'a closed sky lifts its shade');
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
