import test from 'node:test';
import assert from 'node:assert/strict';
import { stepTabs } from '../../scripts/ui/region-steps-ui.mjs';

const water = { name: 'Region (5)' }, dock = { name: 'Region (6)' };

test('the regions at a spot become tabs, the first to open leading', () => {
  const tabs = stepTabs([{ doc: dock, floor: 'wood' }, { doc: water, floor: 'water' }], water);
  assert.deepEqual(tabs.map((t) => t.name), ['Region (5)', 'Region (6)']);
  assert.equal(tabs[0].doc, water);
  assert.equal(tabs[0].floor, 'water');
});

test('two that would read alike say their floor, and an unnamed one goes by its floor', () => {
  const tabs = stepTabs([{ doc: { name: 'Region' }, floor: 'water' }, { doc: { name: 'Region' }, floor: 'wood' }, { doc: { name: '' }, floor: 'sand' }]);
  assert.deepEqual(tabs.map((t) => t.name), ['Region (Water)', 'Region (Wood)', 'Sand region']);
});

test('nothing listed: no tabs', () => { assert.deepEqual(stepTabs(), []); });

test('regions with no floor, unnamed or sharing a name, still make tabs', () => {
  const tabs = stepTabs([{ doc: { name: '' } }, { doc: { name: 'Hall' }, floor: undefined }, { doc: { name: 'Hall' }, floor: null }]);
  assert.equal(tabs.length, 3);
  assert.equal(tabs[0].name, 'Region');
  assert.ok(tabs.every((t) => !/undefined|null/.test(t.name)), tabs.map((t) => t.name).join(' | '));
  assert.notEqual(tabs[1].name, tabs[2].name, 'two alike still tell apart');
});

test('pattern size moves in fives, so it can be exactly 100%', async () => {
  const { readFileSync } = await import('node:fs');
  const { STEP_SCALE } = await import('../../scripts/engines/motion/region-steps.mjs');
  const ui = readFileSync(new URL('../../scripts/ui/region-steps-ui.mjs', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../../scripts/ui/region-panel-sections.mjs', import.meta.url), 'utf8');
  assert.match(ui, /slider_\('Pattern size'[^\n]*, change, 0\.05\);/);
  assert.match(panel, /range\('Pattern size'[^\n]*, 0\.05,/);
  assert.equal(Math.round((1 - STEP_SCALE.min) / 0.05) * 0.05 + STEP_SCALE.min, 1);
});

test('a soft edge can be turned off, and comes back as it was', async () => {
  const { stepEdge, STEP_EDGE } = await import('../../scripts/engines/motion/region-steps.mjs');
  assert.equal(stepEdge({ stepEdge: 1.6, stepEdgeOff: true }), 0);
  assert.equal(stepEdge({ stepEdge: 1.6, stepEdgeOff: false }), 1.6);
  assert.equal(stepEdge({}), STEP_EDGE.usual);
  assert.equal(stepEdge({ stepEdge: 0 }), STEP_EDGE.min, 'only the tick makes it hard');
});

test('below a dock, only a swimmer is in the water', async () => {
  const { onWhatStandsOver: on } = await import('../../scripts/engines/motion/movement-feel.mjs');
  assert.equal(on({ elevation: 0, bottom: 6, action: 'walk' }), true, 'walking: on the dock');
  assert.equal(on({ elevation: 0, bottom: 6, action: 'travel' }), true);
  assert.equal(on({ elevation: 0, bottom: 6 }), true);
  assert.equal(on({ elevation: 0, bottom: 6, action: 'swim' }), false, 'swimming under it');
  assert.equal(on({ elevation: 6, bottom: 6, action: 'walk' }), false, 'already at its height: nothing to bend');
});
