import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Every water region is moving water: no scene asks for it and no region turns it off.
const read = (path) => readFileSync(new URL(`../../scripts/${path}`, import.meta.url), 'utf8');
const main = read('main.mjs');
const defOf = (name) => {
  const at = main.indexOf(`const ${name} = `);
  assert.ok(at > 0, `${name} is defined`);
  return main.slice(at, main.indexOf('\n};', at));
};

test('main has no per-scene moving water choice', () => {
  assert.doesNotMatch(main, /movingWaterHere/);
  assert.doesNotMatch(main, /getFlag\?\.\(ID, "movingWater"\)/);
  assert.doesNotMatch(main, /flags\.\$\{ID\}\.movingWater/);
  assert.doesNotMatch(main, /flags\?\.\[ID\]\?\.movingWater/);
});

test('a water region that once said movingWater off still moves', () => {
  const list = defOf('movingWaterList');
  assert.doesNotMatch(list, /movingWater === "off"/);
  assert.match(list, /!== "water"\) continue;/);
  assert.doesNotMatch(main, /movingWater !== "off"/);
});

test('a GM can still turn moving water off on every scene, and it still follows the quality level', () => {
  const list = defOf('movingWaterList');
  assert.match(list, /floorLevel\.water/);
  assert.match(list, /hotSetting\("movingWater"\) !== false && hotSetting\("movingWaterLocal"\) !== false/);
});

test('the region panel and its window never offer Moving water', () => {
  for (const path of ['ui/region-panel.mjs', 'ui/region-panel-sections.mjs', 'ui/region-panel-model.mjs', 'ui/region-steps-ui.mjs']) {
    assert.doesNotMatch(read(path), /moving water|movingWater/i, path);
  }
});
