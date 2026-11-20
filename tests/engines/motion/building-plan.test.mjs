import test from 'node:test';
import assert from 'node:assert/strict';
import { outsideSquares, buildingAt, partition } from '../../../scripts/engines/motion/building-plan.mjs';

// Roi: "we need to know how to deal with inside walls". A room is what the walls close in; a building is what the
// open air cannot get into, partitions and all.

const BOUNDS = { x: 0, y: 0, w: 1000, h: 800 };
const GRID = 100;
// A house from (100,100) to (600,500), with a wall down the middle at x = 350.
const wall = (x1, y1, x2, y2) => ({ c: [x1, y1, x2, y2] });
const HOUSE = [
  wall(100, 100, 600, 100), wall(600, 100, 600, 500), wall(600, 500, 100, 500), wall(100, 500, 100, 100),
  wall(350, 100, 350, 500),
];

test('the open air gets everywhere but indoors', () => {
  const air = outsideSquares(HOUSE, { grid: GRID, bounds: BOUNDS });
  assert.equal(air.has('0,0'), true, 'the corner of the map is outside');
  assert.equal(air.has('2,2'), false, 'the left room is not');
  assert.equal(air.has('4,2'), false, 'nor the right one, through the partition');
  assert.equal(air.has('8,6'), true, 'the garden behind the house is');
});

test('a building is both its rooms, walked straight through the wall between them', () => {
  const left = buildingAt({ x: 200, y: 200 }, HOUSE, { grid: GRID, bounds: BOUNDS });
  assert.deepEqual([left.x, left.y, left.w, left.h], [100, 100, 500, 400], 'the whole house, not the room clicked');
  const right = buildingAt({ x: 500, y: 300 }, HOUSE, { grid: GRID, bounds: BOUNDS });
  assert.deepEqual([right.x, right.y, right.w, right.h], [left.x, left.y, left.w, left.h], 'from either room');
  assert.equal(buildingAt({ x: 900, y: 700 }, HOUSE, { grid: GRID, bounds: BOUNDS }), null, 'the garden is nobody’s building');
});

test('a wall with rooms on both sides is a partition; an outside wall is not', () => {
  const outside = outsideSquares(HOUSE, { grid: GRID, bounds: BOUNDS });
  const where = { grid: GRID, bounds: BOUNDS, outside };
  assert.equal(partition([[350, 100], [350, 500]], where), true, 'the wall down the middle');
  assert.equal(partition([[100, 100], [600, 100]], where), false, 'the front of the house');
  assert.equal(partition([[100, 500], [600, 500]], where), false, 'and its back');
  assert.equal(partition([[100, 100], [100, 500]], where), false, 'and its side');
});

test('a second building of its own is kept apart from the first', () => {
  const two = [...HOUSE, wall(700, 100, 900, 100), wall(900, 100, 900, 300), wall(900, 300, 700, 300), wall(700, 300, 700, 100)];
  const shed = buildingAt({ x: 800, y: 200 }, two, { grid: GRID, bounds: BOUNDS });
  assert.deepEqual([shed.x, shed.y, shed.w, shed.h], [700, 100, 200, 200], 'the shed alone');
});

test('nothing sensible to answer gives nothing', () => {
  assert.equal(buildingAt(null, HOUSE, { grid: GRID, bounds: BOUNDS }), null);
  assert.equal(buildingAt({ x: 200, y: 200 }, HOUSE, { grid: GRID, bounds: null }), null);
  assert.deepEqual([...outsideSquares(HOUSE, { grid: GRID, bounds: null })], []);
  assert.equal(partition([[350, 100], [350, 500]], { grid: GRID, bounds: BOUNDS, outside: null }), false);
});
