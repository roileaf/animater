import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cloudHeight } from '../../../scripts/engines/motion/drawn-clouds.mjs';
import { TUNE_SLIDERS, cleanTune } from '../../../scripts/engines/motion/weather-tune.mjs';
import { weatherPanelHtml, sliderText } from '../../../scripts/ui/weather-panel.mjs';

// Discord (Sherp): on a town map at 5 ft squares the clouds are rooftop puffs. A scene can lift them.
test('higher clouds are bigger, their shadows a little further off; low is as before', () => {
  assert.deepEqual(cloudHeight(1), { size: 1, cast: 1 });
  assert.deepEqual(cloudHeight(undefined), { size: 1, cast: 1 }, 'left alone: as today');
  const high = cloudHeight(4);
  assert.equal(high.size, 4); assert.equal(high.cast, 2, 'the shadow moves out more slowly than the cloud grows, so it stays by it');
  assert.equal(cloudHeight(99).size, TUNE_SLIDERS.cloudHeight.max); assert.equal(cloudHeight(0.2).size, 1);
});

test('the Weather panel has Cloud height beside Cloud cover, per scene, Low unless set', () => {
  assert.equal(cleanTune().cloudHeight, null);
  assert.equal(cleanTune({ cloudHeight: 2.5 }).cloudHeight, 2.5);
  assert.equal(cleanTune({ cloudHeight: 50 }).cloudHeight, TUNE_SLIDERS.cloudHeight.max);
  assert.equal(sliderText('cloudHeight', null), 'Low'); assert.equal(sliderText('cloudHeight', 2.5), 'Medium'); assert.equal(sliderText('cloudHeight', 5), 'High');
  const html = weatherPanelHtml({ state: { tune: cleanTune() } });
  assert.match(html, /data-tune="cover"[\s\S]*?data-tune="cloudHeight"/);
});

test('main hands the height to the drawn clouds; they drift at the same pace whatever their height', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /drawnClouds\.look\(\{[^\n]*height: tune\.cloudHeight \?\? 1/);
  const layer = readFileSync(new URL('../../../scripts/engines/motion/drawn-clouds.mjs', import.meta.url), 'utf8');
  assert.match(layer, /const speed = cloudSpeed\(state\.wind\) \* 13 \* \(1 \+ 0\.9 \* \(Number\(state\.wind\) \|\| 0\)\) \* g,/, 'pace by the square, not by the height');
});
