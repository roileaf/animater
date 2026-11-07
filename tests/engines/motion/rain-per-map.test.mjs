import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skyNeedsBuilding } from '../../../scripts/engines/motion/sky-light.mjs';
import { cleanTune, TUNE_SLIDERS } from '../../../scripts/engines/motion/weather-tune.mjs';
import { weatherPanel, weatherPanelHtml } from '../../../scripts/ui/weather-panel.mjs';

const sky = readFileSync(new URL('../../../scripts/engines/motion/sky-light.mjs', import.meta.url), 'utf8');
const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
const rain = { falls: [{ kind: 1, amount: 0.7, size: 1, color: [1, 1, 1] }], fog: [1, 1, 1, 0], swirl: [0, 0], curtains: 0 }, snow = { ...rain, falls: [{ kind: 2, amount: 0.7, size: 1, color: [1, 1, 1] }] };

test('a map keeps its rain as it was until asked, down to none', () => {
  assert.equal(cleanTune({}).puddleSize, null);
  assert.equal(cleanTune({ puddleSize: 1 }).puddleSize, null, 'as usual');
  assert.equal(cleanTune({ puddleSize: 0 }).puddleSize, 0);
  assert.equal(cleanTune({ splashSize: 9 }).splashSize, TUNE_SLIDERS.splashSize.max);
  assert.match(main, /puddles: tune\.puddleSize \?\? 1, splashes: tune\.splashSize \?\? 1/);
});

test('the sliders show only while it rains', () => {
  const has = (html) => html.includes('data-tune="puddleSize"') && html.includes('data-tune="splashSize"');
  assert.equal(has(weatherPanelHtml({ state: {}, weathers: [], base: rain })), true, "the weather's own rain");
  assert.equal(has(weatherPanelHtml({ state: {}, weathers: [], base: snow })), false);
  assert.equal(has(weatherPanelHtml({ state: {}, weathers: [] })), false, 'nothing falling');
  assert.equal(has(weatherPanelHtml({ state: { tune: { fall: 'rain' } }, weathers: [], base: snow })), true, 'rain chosen');
  assert.equal(has(weatherPanelHtml({ state: { tune: { fall: 'none' } }, weathers: [], base: rain })), false, 'rain turned off');
  assert.equal(has(weatherPanelHtml({ state: { tune: { fall2: 'rain' } }, weathers: [], base: snow })), true, 'rain as the second thing falling');
});

test('none means none on the ground; open water keeps its rings', () => {
  assert.match(sky, /uWet <= 0\.05 \|\| uPuddles < 0\.01/);
  assert.match(sky, /float puddle = uSplashes > 0\.01 \? puddleAt\(px\)/);
  assert.match(sky, /float film = uWet > 0\.05 && uSplashes > 0\.01/);
  assert.match(sky, /float pool = max\(max\(water, puddle\), film\)/, 'water still counts');
  assert.match(sky, /mix\(max\(0\.06, 0\.42 \* uSplashes\), 0\.42, step\(0\.5, water\)\)/, 'water keeps its own size');
});

test('a slider change is only looked at, like any other: nothing is built again', () => {
  assert.equal(skyNeedsBuilding({ flags: { animater: { weatherTune: { puddleSize: 0.5 } } } }), false);
});

test('presets leave the sizes to the map', () => {
  let saved = null; const written = [];
  const Panel = weatherPanel(class {}, { id: 'x', read: () => ({ tune: { amount: 2, puddleSize: 0.5, splashSize: 0 }, way: 'top' }), write: async (c) => { written.push(c); }, preview() {}, looks: () => ({ Storm: { tune: { amount: 1.5, puddleSize: 1.5 } } }), saveLooks: async (all) => { saved = all; } });
  const panel = { element: { querySelector: () => ({ value: 'Town rain' }) }, render() {} };
  Panel.DEFAULT_OPTIONS.actions.saveLook.call(panel);
  assert.equal(saved['Town rain'].tune.puddleSize, null);
  assert.equal(saved['Town rain'].tune.amount, 2);
  Panel.DEFAULT_OPTIONS.actions.applyLook.call(panel, null, { dataset: { name: 'Storm' } });
  assert.equal(written[0].tune.amount, 1.5);
  assert.equal(written[0].tune.puddleSize, 0.5, "this map's stays");
  assert.equal(written[0].tune.splashSize, 0);
});
