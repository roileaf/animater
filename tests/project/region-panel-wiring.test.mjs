import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// The right-click panel is what a GM gets on any region: wired in main.mjs in place of the old step menu.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('main builds the region panel, not the old step menu', () => {
  assert.match(main, /const regionPanel = createRegionPanel\(/);
  assert.doesNotMatch(main, /createStepMenu\(/);
  assert.doesNotMatch(main, /stepMenuBox/);
});

test('the panel closes when the map pans or tears down', () => {
  assert.match(main, /Hooks\.on\("canvasPan", \(\) => \{ regionPanel\.close\(\); \}\);/);
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{[^\n]*regionPanel\.close\(\); \}\);/);
});

test('regionsUnder lists every region at the point, with no floor filter', () => {
  const at = main.indexOf('const regionsUnder = ');
  assert.ok(at > 0);
  const def = main.slice(at, main.indexOf('\n', at));
  assert.doesNotMatch(def, /plainFloorOf/);
  assert.match(def, /pointInPolygon/);
  assert.doesNotMatch(main, /floorRegionsAt/);
});

test('only the GM opens it', () => {
  const at = main.indexOf('const stepMenuClick = ');
  const body = main.slice(at, main.indexOf('\n};', at));
  assert.match(body, /game\.user\?\.isGM/);
  assert.match(body, /regionPanel\.open\(/);
  assert.match(body, /regionsUnder\(/);
});
