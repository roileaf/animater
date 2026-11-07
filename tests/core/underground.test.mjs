import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { undergroundChoices, undergroundOf } from '../../scripts/core/underground.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('a level goes by its scene until it says otherwise', () => {
  assert.equal(undergroundOf({}, {}), false);
  assert.equal(undergroundOf(), false);
  assert.equal(undergroundOf({ underground: true }, {}), true);
  assert.equal(undergroundOf({ acoustics: 'cave' }), true);
  assert.equal(undergroundOf({ acoustics: 'hall' }, { underground: '' }), true);
  assert.equal(undergroundOf({ acoustics: 'room' }), false);
});

test('a basement under a farmyard, and rafters over a dungeon', () => {
  assert.equal(undergroundOf({}, { underground: 'on' }), true);
  assert.equal(undergroundOf({ underground: true }, { underground: 'off' }), false);
  assert.equal(undergroundOf({ acoustics: 'cave' }, { underground: 'off' }), false);
});

test('its settings say what the scene would give it', () => {
  assert.match(undergroundChoices(true)[0][1], /As the scene \(underground\)/);
  assert.match(undergroundChoices(false)[0][1], /As the scene \(above ground\)/);
  assert.deepEqual(undergroundChoices(false).map(([v]) => v), ['', 'on', 'off']);
});

test('everything in the module asks the one question', () => {
  assert.match(main, /const undergroundScene = \(\) => undergroundOf\(canvas\?\.scene\?\.flags\?\.\[ID\], canvas\?\.level\?\.flags\?\.\[ID\]\);/);
  assert.equal((main.match(/own\.acoustics === "cave"/g) ?? []).length, 0, 'none reads the scene alone');
  assert.ok(!/\["cave", "hall"\]\.includes\(own\.acoustics\)/.test(main));
  assert.match(main, /Hooks\.on\("renderLevelConfig"/);
  assert.match(main, /Hooks\.on\("updateLevel"/);
});
