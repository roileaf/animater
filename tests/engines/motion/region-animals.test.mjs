import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { wantedCounts } from '../../../scripts/engines/motion/town-life.mjs';
import { REGION_ANIMAL_GROUPS, regionAnimalCounts, regionHasAnimals, regionAnimalSize, townLevelOf, outAtAllHours, regionDay, ANIMAL_PACE, animalPaceOf, regionPace, pacedSteps } from '../../../scripts/engines/motion/region-animals.mjs';

// Roi: animals put in a region, not only a whole scene; and the town's animals too, without turning on town life.
test('a region asks for its own animals by kind, on top of the scene\'s; none asked, none', () => {
  assert.equal(regionHasAnimals({}), false); assert.equal(regionHasAnimals({ regionAnimals: { deer: '' } }), false);
  assert.equal(regionHasAnimals({ regionAnimals: { deer: 'usual' } }), true);
  const n = regionAnimalCounts({ regionAnimals: { deer: 'usual', ducks: 'many', rabbits: 'few', waterBirds: 'many', hens: 'more', rats: 'few', owls: 'usual', bogus: 'many', wolves: 'lots' } });
  assert.ok(n.deer >= 2); assert.ok(n.waterBirds > n.deer, 'many is more'); assert.ok(n.rabbits >= 1, 'few is at least one');
  assert.equal(n.bogus, undefined); assert.equal(n.wolves, 0, 'not an amount: none');
  assert.equal(n.owls, 1, 'an owl is one bird'); assert.ok(n.hens > 0); assert.ok(n.rats > 0);
});

test('every kind the scene has outdoors, the town\'s four, rats and bats', () => {
  const kinds = REGION_ANIMAL_GROUPS.flatMap(([, list]) => list.map(([k]) => k));
  for (const k of ['rabbits', 'wildBirds', 'deer', 'foxes', 'wolves', 'squirrels', 'snakes', 'insects', 'owls', 'fish', 'waterBirds', 'frogs', 'pigeons', 'hens', 'cats', 'dogs', 'rats', 'bats']) assert.ok(kinds.includes(k), k);
  assert.deepEqual(REGION_ANIMAL_GROUPS.map(([g]) => g), ['Open ground', 'Water', 'Town', 'Farm', 'Dark places']);
  for (const k of ['cows', 'goats', 'sheep', 'pigs', 'horses']) assert.ok(kinds.includes(k), k);
  assert.ok(regionAnimalCounts({ regionAnimals: { sheep: 'usual' } }).sheep > regionAnimalCounts({ regionAnimals: { horses: 'usual' } }).horses, 'a flock is bigger than a few horses');
});

test('town animals: busy once any asks for more; size small, usual or big', () => {
  assert.equal(townLevelOf({ regionAnimals: { hens: 'few' } }), 'quiet'); assert.equal(townLevelOf({ regionAnimals: { pigeons: 'many' } }), 'busy');
  assert.equal(regionAnimalSize({}), 1); assert.ok(regionAnimalSize({ regionAnimalSize: 'small' }) < 1); assert.ok(regionAnimalSize({ regionAnimalSize: 'big' }) > 1);
  assert.equal(regionAnimalSize({ regionAnimalSize: 1.6 }), 1.6); assert.equal(regionAnimalSize({ regionAnimalSize: 9 }), 2); assert.equal(regionAnimalSize({ regionAnimalSize: 0.1 }), 0.5);
});

test('main builds each region\'s animals kept inside it, ticks them, and clears them', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const rebuildRegionAnimals = /);
  assert.match(main, /for \(const life of regionLife\.values\(\)\)/);
});

// Roi: changing a region's animals did not spawn them. Dogs came only in a busy town, a few pigeons were fewer than a flock,
// a cat needed a wall; a raised region had nothing inside it, and a room's floor (wood, under a roof) was no ground at all.
test('a region\'s town animals come in its own numbers, whatever a town would have', () => {
  assert.deepEqual(wantedCounts({ dogs: 1, cats: 1, pigeons: 3, hens: 2 }, 20), { pigeons: 3, chickens: 2, cat: 1, dog: 1 });
  assert.deepEqual(wantedCounts({ dogs: 1 }, 0), { pigeons: 0, chickens: 0, cat: 0, dog: 0 }, 'no room, none');
  assert.equal(wantedCounts({ pigeons: 9 }, 2).pigeons, 4, 'as many as fit');
});
test('main: a region\'s animals stand on any dry floor in it, at its own height, and its town counts are passed on', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /wildGround\(grid, area, \{ own: true \}\)/);
  assert.match(main, /bottom = Number\(doc\.elevation\?\.bottom\), elevation = Number\.isFinite\(bottom\) && bottom > base \? bottom : base/);
  assert.match(main, /busy: townLevelOf\(own\), want,/);
  assert.match(main, /const OWN_FLOORS_NOT = new Set\(\["water", "lava", "cavern"\]\)/);
});

test('hawks are counted: the scene one unless set; a region none unless asked (the scene hawk already flies over it), up to four', async () => {
  const { hawkCountOf, MOST_HAWKS } = await import('../../../scripts/engines/motion/region-animals.mjs');
  assert.equal(hawkCountOf(undefined), 1); assert.equal(hawkCountOf(''), 1); assert.equal(hawkCountOf('0'), 0); assert.equal(hawkCountOf('3'), 3); assert.equal(hawkCountOf(9), MOST_HAWKS);
  assert.equal(regionAnimalCounts({}).hawks, 0, 'a region with cows and nothing said of hawks has none of its own');
  assert.equal(regionAnimalCounts({ regionAnimals: { cows: 'usual' } }).hawks, 0);
  assert.equal(regionAnimalCounts({ regionAnimals: { hawks: '9' } }).hawks, MOST_HAWKS);
  assert.equal(regionAnimalCounts({ regionAnimals: { hawks: '2' } }).hawks, 2);
  assert.equal(regionHasAnimals({}), false);
  assert.equal(regionHasAnimals({ regionAnimals: { hawks: '2' } }), true);
  assert.equal(regionHasAnimals({ regionAnimals: { hawks: '0' } }), false);
});

// IdiotWizard (Discord): snakes and bugs put in a dungeon's region went half clear at darkness 0.65 and were gone by
// 0.75: the day's animals go in as it gets dark (main.mjs wildDay), which a dungeon has no use for.
test('a region can keep its day animals out in the dark: left alone they follow the day', () => {
  assert.equal(outAtAllHours({}), false); assert.equal(outAtAllHours(), false); assert.equal(outAtAllHours({ animalHours: '' }), false);
  assert.equal(outAtAllHours({ animalHours: 'all' }), true);
  // wildDay as the scene's darkness gives it: 1 by day, a half at 0.65, none from 0.75 (and none underground, or by the clock's night)
  for (const day of [1, 0.5, 0]) {
    assert.equal(regionDay({}, day), day, 'left alone: as the day has it');
    assert.equal(regionDay({ animalHours: 'all' }, day), 1, 'told to stay out: there whatever the dark');
  }
  assert.equal(regionDay(undefined, 0.3), 0.3);
});

// J-P (Discord): "could there be a way to adjust their speed? I find the rats going always walking very fast in my map".
test('the animals\' pace: a percent of the usual, usual until set, a region\'s on top of its map\'s', () => {
  assert.deepEqual(ANIMAL_PACE, { min: 25, max: 200, step: 5 });
  for (const unset of [undefined, null, '', 'fast']) assert.equal(animalPaceOf(unset), 1);
  assert.equal(animalPaceOf(50), 0.5); assert.equal(animalPaceOf('150'), 1.5);
  assert.equal(animalPaceOf(1), 0.25, 'never stopped'); assert.equal(animalPaceOf(9999), 2);
  assert.equal(regionPace({}, 1), 1); assert.equal(regionPace({ regionAnimalPace: 50 }, 1), 0.5);
  assert.equal(regionPace({ regionAnimalPace: 50 }, 0.5), 0.25, 'the map\'s and the region\'s together');
  assert.equal(regionPace(undefined, 1.5), 1.5);
});

test('a pace is time given to the animals faster or slower, in steps no engine clips', () => {
  const sum = (a) => a.reduce((n, v) => n + v, 0), near = (a, b) => Math.abs(a - b) < 1e-9;
  // At the usual pace: exactly what each engine was given before, in one piece.
  assert.deepEqual(pacedSteps(0.016, 1), [0.016]);
  assert.deepEqual(pacedSteps(0.4, 1, { most: 0.1 }), [0.1]);
  assert.deepEqual(pacedSteps(0.4, 1, { most: Infinity }), [0.4]);
  // Slower: less time. Faster: more, cut so none is over what an engine takes at once (0.05 s).
  assert.ok(near(sum(pacedSteps(0.016, 0.5)), 0.008));
  const fast = pacedSteps(0.04, 2);
  assert.ok(near(sum(fast), 0.08)); assert.ok(fast.length === 2 && fast.every((s) => s <= 0.05 + 1e-9));
  // A stalled frame never becomes a long burst of steps.
  assert.ok(pacedSteps(30, 2, { most: Infinity }).length <= 10);
  assert.deepEqual(pacedSteps(0, 2), []); assert.deepEqual(pacedSteps(-1, 2), []);
});

test('every animal engine is ticked at the pace: the scene\'s by the map\'s, a region\'s by its own too', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /const scenePace = \(\) => animalPaceOf\(animalFlagsNow\(\)\.animalPace\)/);
  const tick = main.slice(main.indexOf('const regionTick = '), main.indexOf('const regionTick = ') + 7000);
  assert.match(tick, /regionPace\(own, scenePace\(\)\)/);
  for (const layer of ['town', 'rats', 'farm']) assert.match(tick, new RegExp(`pacedSteps\\([^\\n]*life\\.${layer}\\.tick\\(`), `the region's ${layer}`);
  assert.doesNotMatch(tick, /life\.rats\.tick\(seconds,/);
  // (Not underLife: its moths and beetles share a clock with steam, seeping water and falling rubble.)
  for (const engine of ['vermin', 'sceneFarm', 'townLife']) { assert.match(main, new RegExp(`pacedSteps\\([^\\n]*${engine}\\.tick\\(`), engine); assert.doesNotMatch(main, new RegExp(`${engine}\\.tick\\((seconds|Math\\.min\\(seconds)`), engine); }
  const wild = main.slice(main.indexOf('const wildTick = '), main.indexOf('const wildTick = ') + 3000);
  assert.match(wild, /Math\.min\(seconds, 0\.25\) \* scenePace\(\)/);
});

// J-P (Discord): "They all get stuck ... I removed all tokens and they still stay hiding in the corner". A region's rats
// were handed a `shut` that named keepIn, which lives in regionLifeOf and not in the tick: the first rat to take a step
// threw "keepIn is not defined", every frame, and the region's rats (and whatever is ticked after them) stood still.
test('the tick hands a region\'s rats only what the region made for them: nothing out of its reach', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  const tick = main.slice(main.indexOf('const regionTick = '), main.indexOf('\n};', main.indexOf('const regionTick = ')));
  assert.doesNotMatch(tick, /\bkeepIn\b/, 'keepIn is regionLifeOf\'s own');
  assert.match(tick, /shut: life\.ratShut,/);
  const made = main.slice(main.indexOf('const regionLifeOf = '), main.indexOf('const rebuildRegionAnimals = '));
  assert.match(made, /life\.ratShut = \(a, b\) => ratShut\(a, b\) \|\| keepIn\(a, b\);/);
  // Every name the tick's own arrows use is one it has: its parameters, its locals, or the module's.
  for (const name of ['inside', 'spots', 'waters', 'areas', 'elevation']) assert.doesNotMatch(tick, new RegExp(`(?<![.\\w])${name}\\(`), `${name} is regionLifeOf's own`);
});

test('the region\'s animals are given their own day, each region by its own flags', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  const tick = main.slice(main.indexOf('const regionTick = '), main.indexOf('const regionTick = ') + 6000);
  assert.match(tick, /regionDay\(/, 'the day they are shown by goes through regionDay');
  assert.doesNotMatch(tick, /life\.(wild|pond|field)\.tick\([^\n]*\bday: day \* out\b/, 'not the scene\'s day as it is');
  assert.doesNotMatch(tick, /life\.pond\.tick\([^\n]*, day, sun/, 'nor the pond\'s');
});
