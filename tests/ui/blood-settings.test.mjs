import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SETTINGS_TABS, WINDOW_SETTING_KEYS } from '../../scripts/ui/settings-window.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');
const KEYS = ['floorBloodForever', 'floorBloodAmount', 'bloodDripAmount', 'woundBloodAmount', 'bloodWashes', 'bloodInWater', 'bloodFootprints'];

test('the blood settings sit with the other blood settings, in the window', () => {
  const row = SETTINGS_TABS.flatMap((t) => t.rows).find((r) => r.extras?.includes('bloodTrail'));
  for (const key of KEYS) { assert.ok(row.extras.includes(key), key); assert.ok(WINDOW_SETTING_KEYS.includes(key), key); assert.ok(main.includes(`registerSetting("${key}"`), key); }
});

test('the amounts run from none to twice the usual, the usual by default', () => {
  for (const key of ['floorBloodAmount', 'bloodDripAmount', 'woundBloodAmount']) assert.match(main, new RegExp(`registerSetting\\("${key}".*default: 1, range: \\{ min: 0, max: 2`));
  assert.match(main, /registerSetting\("floorBloodForever".*default: false/, 'nothing is kept unless asked');
});

test("the Splat and Bake buttons are the GM's, and can be hidden", () => {
  const rows = SETTINGS_TABS.flatMap((t) => t.rows);
  for (const key of ['toolSplatBlood', 'toolBakeBlood']) { assert.equal(rows.find((r) => r.local === key)?.gmOnly, true); assert.ok(main.includes(`toolShown("${key}")`)); assert.ok(main.includes(`['${key}',`)); }
  assert.match(main, /const splatBloodHere = async \(\) => \{\s*if \(!game\.user\?\.isGM/);
  assert.match(main, /const bakeBloodHere = async \(\) => \{\s*if \(!game\.user\?\.isGM/);
});
