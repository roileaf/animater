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

test('the right-click opens it on the Regions layer as well as the Tokens layer', () => {
  const at = main.indexOf('const stepMenuClick = ');
  const body = main.slice(at, main.indexOf('\n};', at));
  assert.match(body, /canvas\.activeLayer !== canvas\.tokens && canvas\.activeLayer !== canvas\.regions/);
});

test('panelFloorOf always gives the panel a floor to show', () => {
  const at = main.indexOf('const panelFloorOf = ');
  const def = main.slice(at, main.indexOf('\n', at));
  assert.match(def, /shownFloorOf\(/);
  assert.match(main, /import \{[^}]*shownFloorOf[^}]*\} from "\.\/ui\/region-panel-model\.mjs"/);
});

test('the panel goes when its region is deleted, and follows a window resize', () => {
  assert.match(main, /Hooks\.on\("deleteRegion", \(doc\) => \{ if \(regionPanel\.doc === doc\) regionPanel\.close\(\); \}\);/);
});

test('settings hints point to the right-click panel, not the old region window fields', () => {
  for (const old of ['Floor and water', 'Cavern', 'Flows toward', 'Never freezes', 'Animater → Keep out', 'Animater → Cave-in']) assert.ok(!main.includes(`Region configuration → ${old}`), old);
  assert.ok(!main.includes('Off stops the menu'));
  assert.match(main, /the region's right-click panel → Water → Flows toward/);
  assert.match(main, /the Cave-in button in the Animater controls, scroll to size it\)/);
});

test('the changelog has an Unreleased entry for the panel, the size slider and moving water', () => {
  const log = readFileSync(new URL('../../CHANGELOG.md', import.meta.url), 'utf8');
  const top = log.slice(log.indexOf('## Unreleased'), log.indexOf('\n## ', log.indexOf('## Unreleased') + 5));
  assert.ok(log.indexOf('## Unreleased') < log.indexOf('## 3.'), 'at the top');
  assert.match(top, /right-click panel/); assert.match(top, /size is a slider/); assert.match(top, /All water is moving water/);
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
