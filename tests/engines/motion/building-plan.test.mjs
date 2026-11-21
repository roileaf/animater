import test from 'node:test';
import assert from 'node:assert/strict';
import { outsideSquares, buildingAt, partition, indoorRects, roomCells, roomOutline } from '../../../scripts/engines/motion/building-plan.mjs';

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

// Roi: "is there a way to choose an area delimited by walls and make that an animater region?" The walk that finds
// a building is the same one; what a region needs is its outline rather than its box.
const cellsOf = (...keys) => new Set(keys);

test('a block of squares comes back as one loop of its corners', () => {
  // Two by two at (100,100): four corners, the in-line points dropped.
  const loops = roomOutline(cellsOf('1,1', '2,1', '1,2', '2,2'), { grid: 100 });
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length, 8, 'four corners, not twelve');
  const xs = loops[0].filter((_, i) => i % 2 === 0), ys = loops[0].filter((_, i) => i % 2 === 1);
  assert.deepEqual([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)], [100, 300, 100, 300]);
});

test('an L-shaped room keeps the corner it turns', () => {
  const loops = roomOutline(cellsOf('0,0', '1,0', '0,1'), { grid: 100 });
  assert.equal(loops.length, 1);
  assert.equal(loops[0].length / 2, 6, 'six corners for an L');
});

test('a room round a courtyard comes back as two loops', () => {
  const ring = [];
  for (let x = 0; x < 3; x++) for (let y = 0; y < 3; y++) if (x !== 1 || y !== 1) ring.push(`${x},${y}`);
  const loops = roomOutline(new Set(ring), { grid: 100 });
  assert.equal(loops.length, 2, 'the outside and the hole');
  const span = (l) => Math.max(...l.filter((_, i) => i % 2 === 0)) - Math.min(...l.filter((_, i) => i % 2 === 0));
  assert.deepEqual(loops.map(span).sort((a, b) => a - b), [100, 300]);
});

test('two rooms that do not touch are two loops, and nothing is one', () => {
  assert.equal(roomOutline(cellsOf('0,0', '5,5'), { grid: 100 }).length, 2);
  assert.deepEqual(roomOutline(new Set(), { grid: 100 }), []);
});

test('the squares of the building under a point are the ones the walk reaches', () => {
  const air = outsideSquares(HOUSE, { grid: GRID, bounds: BOUNDS });
  const cells = roomCells({ x: 250, y: 250 }, HOUSE, { grid: GRID, bounds: BOUNDS, outside: air });
  assert.ok(cells.has('2,2'), 'the room clicked in');
  assert.ok(cells.has('4,2'), 'and on through the partition, as a building is one building');
  assert.equal(cells.has('8,6'), false, 'not the garden');
  assert.equal(roomCells({ x: 50, y: 50 }, HOUSE, { grid: GRID, bounds: BOUNDS, outside: air }).size, 0, 'outdoors is no room');
  // And the outline of those squares closes round them.
  const [loop] = roomOutline(cells, { grid: GRID });
  assert.ok(loop && loop.length >= 8, 'a closed outline of the building');
});

test('one room stops at the partition; the building does not', () => {
  const air = outsideSquares(HOUSE, { grid: GRID, bounds: BOUNDS });
  const opts = { grid: GRID, bounds: BOUNDS, outside: air };
  const room = roomCells({ x: 250, y: 250 }, HOUSE, { ...opts, through: false });
  assert.ok(room.has('2,2'), 'the room clicked in');
  assert.equal(room.has('4,2'), false, 'and not past the wall down the middle');
  const whole = roomCells({ x: 250, y: 250 }, HOUSE, { ...opts, through: true });
  assert.ok(whole.size > room.size, 'the building is the bigger of the two');
  assert.ok(whole.has('4,2'));
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
