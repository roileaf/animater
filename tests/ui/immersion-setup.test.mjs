import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMMERSION_FEATURES, featureKeys, featureOn, featureShown, choiceWrites, newFeatures, immersionHTML } from '../../scripts/ui/immersion-setup.mjs';
import { SETTINGS_TABS } from '../../scripts/ui/settings-window.mjs';

const fish = { id: 'fish', name: 'Fish', short: 's', about: 'a', keys: ['pond', 'river', 'worldOnly'] };
const ctx = (values, isGM = true) => ({ get: (key) => values[key], has: (key) => key in values, isGM });
const both = { pond: true, pondLocal: true, river: true, riverLocal: true, worldOnly: true };

test('every setting a feature names is one the settings window knows', () => {
  const known = new Set(SETTINGS_TABS.flatMap((tab) => tab.rows.flatMap((row) => [row.world, row.local, ...(row.extras ?? [])])).filter(Boolean));
  for (const feature of IMMERSION_FEATURES) for (const key of feature.keys) assert.ok(known.has(key), `${feature.id}: ${key}`);
});

test('no setting belongs to two features, and each feature is explained', () => {
  const keys = IMMERSION_FEATURES.flatMap((feature) => feature.keys);
  assert.equal(new Set(keys).size, keys.length);
  for (const feature of IMMERSION_FEATURES) assert.ok(feature.name && feature.short && feature.about);
});

test('a feature finds its settings, and those it does not have are left out', () => {
  const { world, local } = featureKeys(fish, (key) => ['pond', 'pondLocal', 'worldOnly'].includes(key));
  assert.deepEqual(world, ['pond', 'worldOnly']);
  assert.deepEqual(local, ['pondLocal']);
});

test('a feature is on for the GM if any of it is on, off only when all of it is', () => {
  assert.equal(featureOn(fish, ctx(both)), true);
  assert.equal(featureOn(fish, ctx({ ...both, pond: false })), true, 'a mix counts as on');
  assert.equal(featureOn(fish, ctx({ pond: false, river: false, worldOnly: false })), false);
});

test('a player sees only what the GM left on and they can turn off', () => {
  assert.equal(featureShown(fish, ctx(both, false)), true);
  assert.equal(featureShown(fish, ctx({ pond: false, pondLocal: true, river: false, riverLocal: true, worldOnly: true }, false)), false, 'only world-only is left');
  assert.equal(featureOn(fish, ctx({ ...both, pondLocal: false, riverLocal: false }, false)), false);
});

test('leaving a feature alone writes nothing, so a careful mix survives', () => {
  const before = new Map([['fish', true]]);
  assert.equal(choiceWrites([fish], before, new Map([['fish', true]]), ctx(both)).size, 0);
});

test('the GM turning off writes the table, turning on also frees their own screen', () => {
  const off = choiceWrites([fish], new Map([['fish', true]]), new Map([['fish', false]]), ctx(both));
  assert.deepEqual([...off], [['pond', false], ['river', false], ['worldOnly', false]]);
  const on = choiceWrites([fish], new Map([['fish', false]]), new Map([['fish', true]]), ctx(both));
  assert.equal(on.get('pond'), true);
  assert.equal(on.get('pondLocal'), true);
});

test('a player only ever writes their own screen', () => {
  const off = choiceWrites([fish], new Map([['fish', true]]), new Map([['fish', false]]), ctx(both, false));
  assert.deepEqual([...off], [['pondLocal', false], ['riverLocal', false]]);
});

test('only features not yet asked about are new', () => {
  assert.deepEqual(newFeatures(IMMERSION_FEATURES, IMMERSION_FEATURES.map((f) => f.id)), []);
  assert.equal(newFeatures(IMMERSION_FEATURES, undefined).length, IMMERSION_FEATURES.length);
  assert.deepEqual(newFeatures([fish], ['other']).map((f) => f.id), ['fish']);
});

test('the window offers use all, use none and save, and only the chosen row is opened', () => {
  const html = immersionHTML({ features: [fish], choices: new Map([['fish', true]]), selected: 'fish', isGM: true, note: 'Look <here>' });
  for (const part of ['data-all="on"', 'data-all="off"', 'data-save', 'checked', 'Look &lt;here&gt;', '1 of 1 on']) assert.ok(html.includes(part), part);
  assert.ok(!immersionHTML({ features: [fish], choices: new Map(), selected: null, isGM: false }).includes('an-imm-more'));
});
