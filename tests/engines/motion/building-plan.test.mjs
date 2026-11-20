import test from 'node:test';
import assert from 'node:assert/strict';
import { outsideSquares, buildingAt, partition, indoorRects } from '../../../scripts/engines/motion/building-plan.mjs';

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

// Roi, on furniture throwing sun shadows inside a tavern: "indoor shadows should only come from windows\\a hole in
// the roof or open door or a light source, it seems to me the walls doesnt block the sun light?" On a scene whose
// buildings are roofed, this is the whole of the indoors, in boxes cheap enough to ask of every decoration.
test('the indoors comes back as rectangles that hold every square the air cannot reach', () => {
  const air = outsideSquares(HOUSE, { grid: GRID, bounds: BOUNDS });
  const rects = indoorRects(air, { grid: GRID, bounds: BOUNDS });
  assert.ok(rects.length > 0 && rects.length <= 8, `a house is a few boxes, not one per square (${rects.length})`);
  const holds = (x, y) => rects.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  assert.equal(holds(250, 250), true, 'the left room');
  assert.equal(holds(450, 250), true, 'and the right one, through the partition');
  assert.equal(holds(50, 50), false, 'not the corner of the map');
  assert.equal(holds(850, 650), false, 'nor the garden behind the house');
  // Every indoor square is inside exactly one box: the boxes tile the indoors and never overlap.
  let covered = 0;
  for (let cy = 0; cy < 8; cy++) for (let cx = 0; cx < 10; cx++) {
    const inside = !air.has(`${cx},${cy}`);
    const boxes = rects.filter((r) => cx * GRID >= r.x && cx * GRID < r.x + r.w && cy * GRID >= r.y && cy * GRID < r.y + r.h).length;
    assert.equal(boxes, inside ? 1 : 0, `square ${cx},${cy}`);
    if (inside) covered++;
  }
  assert.ok(covered > 0, 'and there was an indoors to cover');
});

test('a map the air reaches all of has no indoors at all', () => {
  const air = outsideSquares([], { grid: GRID, bounds: BOUNDS });
  assert.deepEqual(indoorRects(air, { grid: GRID, bounds: BOUNDS }), []);
  assert.deepEqual(indoorRects(null, { grid: GRID, bounds: BOUNDS }), [], 'and no flood is no answer, not every square');
});

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
