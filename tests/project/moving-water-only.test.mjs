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
  // (Through movingWaterOn(), which the next test reads.)
  assert.match(defOf('movingWaterList'), /const on = movingWaterOn\(\);/);
  assert.match(main, /const movingWaterOn = \(\) => \{ try \{ return !!floorLevel\.water && hotSetting\("movingWater"\) !== false && hotSetting\("movingWaterLocal"\) !== false;/);
});

test('one movingWaterOn() says whether moving water is drawn, and the shore, beaches and seas ask it', () => {
  const on = main.slice(main.indexOf('const movingWaterOn = '), main.indexOf('\n', main.indexOf('const movingWaterOn = ')));
  assert.match(on, /floorLevel\.water/);
  assert.match(on, /hotSetting\("movingWater"\) !== false && hotSetting\("movingWaterLocal"\) !== false/);
  assert.match(defOf('movingWaterList'), /movingWaterOn\(\)/);
  const seaHere = main.slice(main.indexOf('seaHere = '), main.indexOf(';', main.indexOf('seaHere = ')));
  assert.match(seaHere, /movingWaterOn\(\)/);
  assert.doesNotMatch(seaHere, /floorLevel\.water/);
  const beachSeas = main.slice(main.indexOf('const beachSeas = '), main.indexOf('beachField', main.indexOf('const beachSeas = ')));
  assert.match(beachSeas, /movingWaterOn\(\)/);
  assert.doesNotMatch(beachSeas, /floorLevel\.water/);
  const at = main.indexOf(') beaches.push('), beaches = main.slice(main.lastIndexOf('\n', at), at);
  assert.match(beaches, /movingWaterOn\(\)/);
  assert.doesNotMatch(beaches, /floorLevel\.water/);
});

test('the region panel and its window never offer Moving water', () => {
  for (const path of ['ui/region-panel.mjs', 'ui/region-panel-sections.mjs', 'ui/region-panel-model.mjs', 'ui/region-steps-ui.mjs']) {
    assert.doesNotMatch(read(path), /moving water|movingWater/i, path);
  }
});
