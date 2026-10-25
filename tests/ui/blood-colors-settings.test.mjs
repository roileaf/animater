import test from 'node:test';
import assert from 'node:assert/strict';
import { bloodEditorRows, bloodColorsForm, bloodColorsValues, bloodColorsMenu, BLOOD_SETTING } from '../../scripts/ui/blood-colors-settings.mjs';
import { DEFAULT_BLOOD, BLOOD_TYPES } from '../../scripts/engines/motion/blood-colors.mjs';

test('rows: one per creature type plus the default, with the saved overrides over the defaults', () => {
  const rows = bloodEditorRows({ plant: { color: '#00ff00' }, construct: { bleeds: true }, bogus: { color: '#ffffff' } });
  assert.deepEqual(rows.map((r) => r.key), BLOOD_TYPES.map((t) => t.key));
  assert.equal(rows.at(-1).key, 'default');
  const plant = rows.find((r) => r.key === 'plant');
  assert.equal(plant.color, '#00ff00');
  assert.equal(plant.defaultColor, DEFAULT_BLOOD.plant.color);
  assert.equal(plant.changed, true);
  assert.equal(rows.find((r) => r.key === 'construct').bleeds, true);
  assert.equal(rows.find((r) => r.key === 'ooze').bleeds, false);
  assert.equal(rows.find((r) => r.key === 'humanoid').changed, false);
});

test('the form: a colour, a No blood box and a reset per row, Save and Reset all, and the Splatter note', () => {
  const html = bloodColorsForm(bloodEditorRows({}), { splatterActive: false });
  for (const t of BLOOD_TYPES) {
    assert.match(html, new RegExp(`name="color-${t.key}"[^>]*type="color"|type="color"[^>]*name="color-${t.key}"`));
    assert.match(html, new RegExp(`name="none-${t.key}"`));
    assert.match(html, new RegExp(`data-action="resetType"[^>]*data-type="${t.key}"`));
  }
  assert.match(html, /name="none-construct" checked/);
  assert.doesNotMatch(html, /name="none-humanoid" checked/);
  assert.match(html, /type="submit"/);
  assert.match(html, /data-action="resetAll"/);
  assert.match(html, /Splatter/);
  assert.match(bloodColorsForm(bloodEditorRows({}), { splatterActive: true }), /Splatter is active/);
});

test('values: the submitted form as the saved overrides, only what differs from the defaults', () => {
  const data = {};
  for (const [key, v] of Object.entries(DEFAULT_BLOOD)) { data[`color-${key}`] = v.color; data[`none-${key}`] = !v.bleeds; }
  assert.deepEqual(bloodColorsValues(data), {}, 'untouched is nothing saved');
  data['color-plant'] = '#00FF00';
  data['none-humanoid'] = 'on';
  data['none-construct'] = false;
  data['color-undead'] = 'not a colour';
  data['color-default'] = '#111111';
  assert.deepEqual(bloodColorsValues(data), { plant: { color: '#00ff00' }, humanoid: { bleeds: false }, construct: { bleeds: true }, default: { color: '#111111' } });
  // Nested form data too.
  assert.deepEqual(bloodColorsValues({ color: { fey: '#222222' }, none: {} }).fey, { color: '#222222' });
});

test('the menu saves the overrides and resets rows in the form', async () => {
  class AppV2 { constructor() { this.rendered = 0; } render() { this.rendered++; } }
  const store = new Map([['animater.bloodColors', { plant: { color: '#00ff00' } }]]);
  const settings = { get: (id, k) => store.get(`${id}.${k}`), set: async (id, k, v) => store.set(`${id}.${k}`, v) };
  const Menu = bloodColorsMenu(AppV2, { id: 'animater', settings: () => settings, splatterActive: () => false });
  assert.equal(BLOOD_SETTING, 'bloodColors');
  assert.equal(Menu.DEFAULT_OPTIONS.tag, 'form');
  const app = new Menu();
  assert.match(await app._renderHTML(), /value="#00ff00"/);
  await Menu.DEFAULT_OPTIONS.form.handler.call(app, null, null, { object: { 'color-fey': '#222222', 'none-fey': false } });
  assert.deepEqual(store.get('animater.bloodColors'), { fey: { color: '#222222' } });
  // Reset a row: its inputs back to the defaults.
  const color = { value: '#ffffff' }, none = { checked: true };
  app.element = { querySelector: (sel) => (sel === '[name="color-humanoid"]' ? color : sel === '[name="none-humanoid"]' ? none : null), querySelectorAll: () => [] };
  Menu.DEFAULT_OPTIONS.actions.resetType.call(app, null, { dataset: { type: 'humanoid' } });
  assert.equal(color.value, DEFAULT_BLOOD.humanoid.color);
  assert.equal(none.checked, false);
  // Reset all: every row in the form.
  const inputs = Object.fromEntries(BLOOD_TYPES.flatMap((t) => [[`[name="color-${t.key}"]`, { value: '#ffffff' }], [`[name="none-${t.key}"]`, { checked: true }]]));
  app.element = { querySelector: (sel) => inputs[sel] ?? null };
  Menu.DEFAULT_OPTIONS.actions.resetAll.call(app, null, {});
  assert.equal(inputs['[name="color-plant"]'].value, DEFAULT_BLOOD.plant.color);
  assert.equal(inputs['[name="none-construct"]'].checked, true);
  assert.equal(inputs['[name="none-humanoid"]'].checked, false);
});
