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
  assert.match(main, /Hooks\.on\("canvasTearDown", \(\) => \{(?:(?!\n\}\);)[\s\S])*?floorLooks\.clear\(\);(?:(?!\n\}\);)[\s\S])*?regionPanel\.close\(\);/);
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
  assert.doesNotMatch(body, /regionSteps/);
  assert.match(body, /regionPanel\.open\(/);
  assert.match(body, /regionsUnder\(/);
});

// The region window's Animater tab only points to the panel: every setting it held now lives there.
const tabHook = (() => { const at = main.indexOf('Hooks.on("renderRegionConfig"'); return main.slice(at, main.indexOf('\nHooks.once("ready"', at)); })();

test('the region window tab is a pointer to the right-click panel', () => {
  assert.ok(tabHook.length > 100);
  assert.match(tabHook, /Right-click the region on the map to set it up\./);
  assert.match(tabHook, /data-animater-open-panel/);
  assert.match(tabHook, /Open its panel/);
  assert.match(tabHook, /regionPanel\.open\(/);
  assert.match(tabHook, /game\.user\?\.isGM/);
  assert.match(tabHook, /\.close\(\)/);
  assert.doesNotMatch(tabHook, /field\("This is the sea"/);
  assert.doesNotMatch(tabHook, /regionAnimalsHtml\(/);
  assert.doesNotMatch(tabHook, /floorSelect\(/);
  assert.doesNotMatch(tabHook, /data-animater-cavein|bringCeilingDown|clearRubble|openSteps/);
});

test('nothing of the old tab is left behind', () => {
  assert.doesNotMatch(main, /regionAnimalsHtml/);
});
