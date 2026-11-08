import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REGION_ANIMAL_GROUPS, regionAnimalCounts, regionHasAnimals, regionAnimalSize, townLevelOf } from '../../../scripts/engines/motion/region-animals.mjs';

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
