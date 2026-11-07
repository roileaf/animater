import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearedOwn, hasOwn, overLevel, scopeBar } from '../../scripts/ui/level-scope.mjs';
import { ANIMAL_KEYS, animalsPanelHtml } from '../../scripts/ui/animals-panel.mjs';
import { weatherPanelHtml } from '../../scripts/ui/weather-panel.mjs';

const main = readFileSync(new URL('../../scripts/main.mjs', import.meta.url), 'utf8');

test('a level goes by its scene for whatever it leaves alone', () => {
  const merged = overLevel({ rabbits: 'many', deer: 'few', underground: true }, { rabbits: 'none', deer: null, underground: 'off' }, ['rabbits', 'deer']);
  assert.equal(merged.rabbits, 'none');
  assert.equal(merged.deer, 'few', 'cleared: the scene\'s');
  assert.equal(merged.underground, true, 'only what it can have of its own');
  assert.equal(overLevel({ rabbits: '' }, { rabbits: 'many' }, ANIMAL_KEYS).rabbits, 'many');
  assert.equal(overLevel({ rabbits: 'many' }, { rabbits: '' }, ANIMAL_KEYS).rabbits, '', 'Usual is a choice too');
});

test('a level can go back to its scene', () => {
  assert.equal(hasOwn({}, ['a']), false);
  assert.equal(hasOwn({ a: null }, ['a']), false);
  assert.equal(hasOwn({ a: '' }, ['a']), true);
  assert.deepEqual(clearedOwn({ a: 1, b: null, c: 2 }, ['a', 'b']), { a: null });
});

test('the choice shows only with several levels', () => {
  assert.equal(scopeBar(null), '');
  assert.equal(scopeBar({ multi: false }), '');
  const bar = scopeBar({ multi: true, mode: 'level', name: 'Basement<', own: true });
  assert.ok(bar.includes('This level: Basement&lt;'));
  assert.ok(/class="is-active" data-action="setScope" data-value="level"/.test(bar));
  assert.ok(bar.includes('data-action="clearLevel"'));
  assert.ok(!scopeBar({ multi: true, mode: 'scene', own: true }).includes('clearLevel'), 'only on a level');
  assert.ok(!scopeBar({ multi: true, mode: 'level', own: false }).includes('clearLevel'), 'with something to clear');
  const scope = { multi: true, mode: 'level', name: 'Rafters' };
  assert.ok(animalsPanelHtml({ flags: {}, scope }).includes('This level: Rafters'));
  assert.ok(weatherPanelHtml({ state: {}, weathers: [], scope }).includes('This level: Rafters'));
  assert.ok(!animalsPanelHtml({ flags: {} }).includes('setScope'));
});

test('what the map draws goes by the level', () => {
  assert.match(main, /const sceneCreatures = \(\) => \{ const f = animalFlagsNow\(\)/);
  assert.match(main, /const outdoorLifeHere = \(\) => outdoorLifePreview \|\| animalFlagsNow\(\)\.outdoorLife === "on"/);
  assert.match(main, /const weatherWordOf = \(scene\) => levelOf\(scene\)\.weather \|\| scene\?\.weather/);
  assert.match(main, /const tuneOfScene = \(scene\) => mergeTunes\(levelOf\(scene\)\.weatherTune, sceneTuneOf\(scene\)\)/);
  assert.equal((main.match(/canvas\.scene\?\.flags\?\.\[ID\]\?\.birdHeight/g) ?? []).length, 0, 'nor the birds by the scene alone');
});

test('a clear sky has no drawn clouds, whatever is set', () => {
  assert.match(main, /cover: tune\.cover \?\? skyCoverNow, transparency:/);
});
