import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IMMERSION_FEATURES, featureKeys, featureOn, featureShown, choiceWrites, newFeatures, stillToChoose, immersionHTML, sceneValue, sceneWrites } from '../../scripts/ui/immersion-setup.mjs';
import { SETTINGS_TABS } from '../../scripts/ui/settings-window.mjs';

const fish = { id: 'fish', name: 'Fish', short: 's', about: 'a', keys: ['pond', 'river', 'worldOnly'] };
const ctx = (values, isGM = true) => ({ get: (key) => values[key], has: (key) => key in values, isGM });
const both = { pond: true, pondLocal: true, river: true, riverLocal: true, worldOnly: true };

test('what this update added asks everyone again, under new groups', () => {
  const seenBefore = ['wildlife', 'vermin', 'light', 'weather', 'fire', 'feet', 'creatures', 'caves', 'sound', 'blood'];
  const fresh = newFeatures(IMMERSION_FEATURES, seenBefore).map((f) => f.id);
  for (const id of ['outdoors', 'windflames', 'tavern', 'aftermath', 'shores', 'dayshift', 'town', 'tracks']) assert.ok(fresh.includes(id), id);
  for (const id of seenBefore.filter((s) => s !== 'wildlife')) assert.ok(!fresh.includes(id), id);
});

test('a scene switch reads what the scene says, and Off for anything else', () => {
  const town = IMMERSION_FEATURES.find((f) => f.id === 'town'), tracks = IMMERSION_FEATURES.find((f) => f.id === 'tracks');
  assert.equal(sceneValue(town, {}), '');
  assert.equal(sceneValue(town, { townLife: 'busy' }), 'busy');
  assert.equal(sceneValue(town, { townLife: 'nonsense' }), '');
  assert.equal(sceneValue(tracks, {}), 'off');
});

test('only scene switches that changed are written', () => {
  const features = IMMERSION_FEATURES.filter((f) => f.scene);
  const before = new Map([['town', ''], ['outdoors', 'on'], ['tracks', 'off']]);
  assert.deepEqual(sceneWrites(features, before, new Map(before), 'animater'), {});
  assert.deepEqual(sceneWrites(features, before, new Map(before).set('town', 'quiet'), 'animater'), { 'flags.animater.townLife': 'quiet' });
});

test('only the GM gets a scene switch, in the open row, naming the scene', () => {
  const town = IMMERSION_FEATURES.find((f) => f.id === 'town'), args = { features: [town], choices: new Map([['town', true]]), selected: 'town', sceneValues: new Map([['town', 'busy']]), sceneName: 'Oleg\'s <Post>' };
  const gm = immersionHTML({ ...args, isGM: true });
  assert.ok(gm.includes('data-scene="town"') && gm.includes('Oleg\'s &lt;Post&gt;') && /value="busy" selected/.test(gm));
  assert.ok(!immersionHTML({ ...args, isGM: false }).includes('data-scene'));
  assert.ok(!immersionHTML({ ...args, isGM: true, selected: null }).includes('data-scene'));
  assert.ok(!immersionHTML({ ...args, isGM: true, sceneName: '' }).includes('data-scene'));
});

test('every setting a feature names is one the settings window knows', () => {
  const known = new Set(SETTINGS_TABS.flatMap((tab) => tab.rows.flatMap((row) => [row.world, row.local, ...(row.extras ?? [])])).filter(Boolean));
  // A feature the scene decides (no switch for the table) is known by its screen's switch.
  for (const feature of IMMERSION_FEATURES) for (const key of feature.keys) assert.ok(known.has(key) || known.has(`${key}Local`), `${feature.id}: ${key}`);
});

// Outdoor life's animals, fireflies, the dawn chorus and carrion have no switch for the table (the scene decides): the GM
// turning one off writes their own screen's, and a player still chooses theirs.
test('a feature with only a screen switch is shown, read and written through it', () => {
  const feature = { id: 'dayshift', keys: ['dawnChorus'] }, values = { dawnChorusLocal: true }, has = (k) => k in values, get = (k) => values[k];
  assert.equal(featureShown(feature, { get, has, isGM: true }), true);
  assert.equal(featureShown(feature, { get, has, isGM: false }), true);
  assert.equal(featureOn(feature, { get, has, isGM: false }), true);
  assert.deepEqual([...choiceWrites([feature], new Map([['dayshift', true]]), new Map([['dayshift', false]]), { has, isGM: true })], [['dawnChorusLocal', false]]);
  assert.deepEqual([...choiceWrites([feature], new Map([['dayshift', false]]), new Map([['dayshift', true]]), { has, isGM: false })], [['dawnChorusLocal', true]]);
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

test('a player is not asked about what a GM has locked for them', () => {
  const fish = { id: 'fish', keys: ['fish'] }, birds = { id: 'birds', keys: ['birds', 'song'] }, has = () => true;
  const ids = (locks) => stillToChoose([fish, birds], { has, locks }).map((f) => f.id);
  assert.deepEqual(ids(undefined), ['fish', 'birds'], 'no locks, no change');
  assert.deepEqual(ids({ 'animater.fishLocal': {} }), ['birds'], 'its one setting locked');
  assert.deepEqual(ids({ 'animater.birdsLocal': {} }), ['fish', 'birds'], 'one of two locked leaves a choice');
  assert.deepEqual(ids({ 'animater.birdsLocal': {}, 'animater.songLocal': {}, 'animater.fishLocal': {} }), [], 'nothing left: no popup');
  assert.deepEqual(ids({ 'animater.fishLocal': { soft: true } }), ['fish', 'birds'], 'a soft lock only recommends');
});
