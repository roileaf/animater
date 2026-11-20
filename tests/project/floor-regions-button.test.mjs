import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { settingsModel, SETTINGS_TABS, WINDOW_SETTING_KEYS } from '../../scripts/ui/settings-window.mjs';

// The Floor regions button went missing for a GM who had ticked "Experimental: floor regions from the map" and saved
// (Discord, 2026-11-20): a third switch, `mapMaking`, was in its gate, and this module turns that one off by itself
// in any world that had not painted a map before it was installed. So the tick promised a button and delivered
// nothing, with nothing said. The gate below is read out of main.mjs and run, so the promise is pinned to the code
// rather than to a sentence about it: the experimental tick (the world's) and "show this button" (each screen's) are
// the whole of it, and whatever the map making switch says, a GM who asked for this button has it.
const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

// The `visible:` expression of the Floor regions tool, as a function of the settings it reads.
const gate = (() => {
  const at = main.indexOf('name: "animaterFloorRegions"');
  assert.ok(at > 0, 'the Floor regions tool is still registered in the Animater controls');
  const block = main.slice(at, main.indexOf('name: "animaterClouds"'));
  const line = /\n\s*visible: (.+?),\r?\n/.exec(block);
  assert.ok(line, 'and it still has a visibility condition');
  const body = `return (${line[1]});`;
  return (values) => {
    const settings = new Map(Object.entries(values).map(([key, value]) => [`animater.${key}`, value]));
    const get = (id, key) => {
      const full = `${id}.${key}`;
      if (!settings.has(full)) throw new Error(`${full} is not registered`);
      return settings.get(full);
    };
    const toolShown = (key) => { try { return get('animater', key) !== false; } catch { return true; } };
    const mapMakingOn = () => { try { return get('animater', 'mapMaking') !== false; } catch { return true; } };
    return new Function('toolShown', 'mapMakingOn', 'game', 'ID', body)(toolShown, mapMakingOn, { settings: { get } }, 'animater');
  };
})();

const on = { experimentalWaterRegions: true, toolDetectWater: true, mapMaking: true };

test('the experimental switch is what puts the Floor regions button there', () => {
  assert.equal(gate(on), true);
  assert.equal(gate({ ...on, experimentalWaterRegions: false }), false, 'off by default means no button');
});

test('a world with the map making tools off still gets the button it ticked', () => {
  // The regression itself: `mapMaking` is off in every world that had not painted a map when Animater arrived.
  assert.equal(gate({ ...on, mapMaking: false }), true);
  assert.equal(gate({ ...on, mapMaking: false, experimentalWaterRegions: false }), false);
});

test('each screen can still hide the button for itself', () => {
  assert.equal(gate({ ...on, toolDetectWater: false }), false);
  // A screen that has never touched that switch (nothing stored) is shown it.
  assert.equal(gate({ experimentalWaterRegions: true, mapMaking: true }), true);
});

test('both of the button’s switches sit together in the settings window, for the GM alone', () => {
  const row = SETTINGS_TABS.flatMap((tab) => tab.rows).find((r) => r.world === 'experimentalWaterRegions');
  assert.ok(row, 'the experimental switch has its row');
  assert.ok(row.extras?.includes('toolDetectWater'), 'with "show this button" under it, not a window away');
  assert.equal(row.gmOnly, true, 'the button is the GM’s, so a player is not offered either switch');
  for (const key of ['experimentalWaterRegions', 'toolDetectWater']) assert.ok(WINDOW_SETTING_KEYS.includes(key), key);
  const reg = (key, scope) => [`animater.${key}`, { key, namespace: 'animater', scope, type: Boolean, name: key, hint: `${key} hint` }];
  const registry = new Map([reg('experimentalWaterRegions', 'world'), reg('toolDetectWater', 'client')]);
  const rowsFor = (isGM) => settingsModel({ registry, get: () => false, isGM }).tabs.flatMap((t) => t.rows);
  const shown = rowsFor(true).find((r) => r.id === 'experimentalWaterRegions');
  assert.deepEqual(shown.extras.map((e) => e.key), ['toolDetectWater']);
  assert.equal(rowsFor(false).length, 0, 'a player sees neither');
});
