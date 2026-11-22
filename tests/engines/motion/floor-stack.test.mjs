import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { floorStack } from '../../../scripts/engines/motion/floor-stack.mjs';

// A map built from nothing but painted floors (no map picture) showed both of these. Its dirt road came and went under
// its meadow, because painted floors lay in the order their tiles happened to finish loading. And its pond was never
// seen at all: moving water is drawn under the painted floors (so a dock can be painted over it), and the meadow the
// pond lies in was painted straight across it.
const box = (x, y, w, h) => [x, y, x + w, y, x + w, y + h, x, y + h];

test('painted floors lie biggest at the bottom, whatever order they come in', () => {
  const meadow = { id: 'meadow', areas: [box(0, 0, 3000, 2000)] }, road = { id: 'road', areas: [box(0, 900, 3000, 200)] }, hut = { id: 'hut', areas: [box(500, 300, 400, 400)] };
  const want = ['meadow', 'road', 'hut'];
  assert.deepEqual(floorStack([hut, road, meadow]).map((f) => f.id), want);
  assert.deepEqual(floorStack([road, meadow, hut]).map((f) => f.id), want);
});

test('floors of one size keep one order, by their ids', () => {
  const a = { id: 'a', areas: [box(0, 0, 100, 100)] }, b = { id: 'b', areas: [box(50, 0, 100, 100)] };
  assert.deepEqual(floorStack([b, a]).map((f) => f.id), ['a', 'b']);
  assert.deepEqual(floorStack([a, b]).map((f) => f.id), ['a', 'b']);
});

test('a hole in a floor is not part of its size', () => {
  const ring = [box(0, 0, 1000, 1000)]; ring[0].holes = [box(50, 50, 900, 900)];
  const yard = { id: 'yard', areas: [box(100, 100, 600, 600)] };
  assert.deepEqual(floorStack([{ id: 'walk', areas: ring }, yard]).map((f) => f.id), ['yard', 'walk']);
});

test('water that lies in a bigger floor shows through it', () => {
  const pond = { id: 'pond', areas: [box(2000, 1200, 800, 500)] };
  const [meadow, isle] = floorStack([{ id: 'isle', areas: [box(2300, 1400, 100, 100)] }, { id: 'meadow', areas: [box(0, 0, 3000, 2000)] }], [pond]);
  assert.deepEqual(meadow.under, pond.areas, 'the meadow is opened over the pond');
  assert.deepEqual(isle.under, [], 'an islet smaller than the pond stays on it');
});

test('what is built over water is never opened, and far water is left alone', () => {
  const lake = { id: 'lake', areas: [box(0, 0, 500, 500)] };
  const [deck] = floorStack([{ id: 'deck', areas: [box(0, 0, 2000, 2000)], over: true }], [lake]);
  assert.deepEqual(deck.under, []);
  const [field] = floorStack([{ id: 'field', areas: [box(1000, 1000, 2000, 2000)] }], [lake]);
  assert.deepEqual(field.under, [], 'water that does not reach it changes nothing of it');
});

test('the rest of each floor is handed on as it was', () => {
  const [one] = floorStack([{ id: 'x', areas: [box(0, 0, 10, 10)], floor: 'grass', style: 'meadow', edge: 0.5 }]);
  assert.equal(one.floor, 'grass'); assert.equal(one.style, 'meadow'); assert.equal(one.edge, 0.5);
  assert.deepEqual(floorStack(), []);
});

test('the painter is given the stack, keeps to its order and opens each floor', () => {
  const main = readFileSync(new URL('../../../scripts/main.mjs', import.meta.url), 'utf8');
  assert.match(main, /floorTextures\.sync\(floorStack\(painted, moving\)\);/);
  const looks = readFileSync(new URL('../../../scripts/engines/motion/floor-looks.mjs', import.meta.url), 'utf8');
  const textures = looks.slice(looks.indexOf('export function createFloorTextures'));
  assert.match(textures, /maskOf\(PIXI, render, areas, box, size, edge, spec\?\.under\)/, 'the floor is opened where water lies under it');
  assert.match(textures, /shapeKey\(spec\.areas\) \+ shapeKey\(spec\.under\)/, 'and painted again when that water changes');
  assert.match(textures, /inOrder\(list\);/, 'the floors lie in the order of the list');
});
