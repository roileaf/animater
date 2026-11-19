import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_TABS, settingsModel, settingsWindowHTML } from '../../scripts/ui/settings-window.mjs';

// Eighty-four rows in one list is a scroll, not a choice. The floor tab now reads as runs under their own headings,
// and a heading belongs to the rows that are actually drawn: one left out for this user takes no heading with it.
const control = (key, scope = 'world') => ({ key, scope, name: key, hint: `${key} hint`, kind: 'boolean', value: true, reload: false });
const row = (id, section, over = {}) => ({ id, section, name: id, hint: `${id} hint`, world: control(id), local: null, extras: [], preview: null, worldOff: false, qualityNote: null, ...over });
const html = (rows) => settingsWindowHTML({ isGM: true, tabs: [{ id: 'one', label: 'One', icon: '', rows }] });

test('every row in the floor tab is under a heading', () => {
  const floor = SETTINGS_TABS.find((t) => t.id === 'floor');
  const missing = floor.rows.filter((r) => !r.section).map((r) => r.world ?? r.local ?? r.menu);
  assert.deepEqual(missing, [], 'a row with no section sits under whichever heading came before it');
  const runs = new Map();
  for (const r of floor.rows) runs.set(r.section, (runs.get(r.section) ?? 0) + 1);
  assert.ok(runs.size >= 6, 'and the headings divide it into short lists');
  // A run longer than about twenty rows is the scroll this was meant to end, in smaller print.
  for (const [section, count] of runs) assert.ok(count <= 20, `${section} is ${count} rows: long enough to want splitting`);
});

test('a heading is drawn once for its run, before the rows it heads', () => {
  const page = html([row('a', 'First'), row('b', 'First'), row('c', 'Second')]);
  assert.equal(page.match(/an-set-section/g).length, 2, 'one heading per run, not one per row');
  assert.ok(page.indexOf('>First<') < page.indexOf('data-row="a"'));
  assert.ok(page.indexOf('data-row="b"') < page.indexOf('>Second<'));
  assert.match(page, /data-section="First" data-section-tab="one"/);
});

test('a tab with no sections is drawn as it always was', () => {
  assert.ok(!html([row('a', null), row('b', null)]).includes('an-set-section'));
});

test('the heading is drawn from the rows that are here, not the ones that were left out', () => {
  // The model has already dropped the row this user never sees; the heading goes on with the row that is still there.
  const page = html([row('a', 'Mine'), row('c', 'Theirs')]);
  assert.match(page, /data-section="Theirs"[\s\S]*data-row="c"/);
  assert.equal(page.match(/an-set-section/g).length, 2);
});

test('the model carries each row its section', () => {
  const keys = ['coast', 'waterfalls'];
  const registry = new Map(keys.map((k) => [`animater.${k}`, { key: k, namespace: 'animater', scope: 'world', type: Boolean, name: k, hint: '' }]));
  const model = settingsModel({ registry, get: () => true, isGM: true, menus: new Map() });
  const rows = model.tabs.flatMap((t) => t.rows).filter((r) => keys.includes(r.id));
  assert.equal(rows.length, keys.length);
  for (const r of rows) assert.equal(r.section, 'Water & shore');
});
