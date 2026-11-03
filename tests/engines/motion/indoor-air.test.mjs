import test from 'node:test';
import assert from 'node:assert/strict';
import { draftField, sceneOpenings, draftStrength, gustDelays, GUST_SPEED } from '../../../scripts/engines/motion/indoor-air.mjs';

// Two rooms side by side (0–300 and 300–600), a door between them at x 300; the left room opens to the outside at x 0.
const bounds = { x: 0, y: 0, width: 600, height: 300 };
const room = (door) => [
  { c: [0, 0, 600, 0], move: 20 }, { c: [0, 300, 600, 300], move: 20 }, { c: [600, 0, 600, 300], move: 20 },
  { c: [300, 0, 300, 100], move: 20 }, { c: [300, 200, 300, 300], move: 20 }, { c: [300, 100, 300, 200], move: 20, door: 1, ds: door },
];
const outside = [{ x: 50, y: 150 }];

test('the air reaches through an open door toward the outside, and not through a shut one', () => {
  const shut = draftField({ res: 1, walls: room(0), bounds, grid: 100, openings: outside }), open = draftField({ res: 1, walls: room(1), bounds, grid: 100, openings: outside });
  const far = (f) => f.dist[1 * f.cols + 5];
  assert.equal(far(shut), -1, 'the far room sealed: still air');
  assert.ok(far(open) > 0, 'the door open: it is reached');
  assert.ok(open.dir[(1 * open.cols + 5) * 2] < 0, 'and its air flows toward the way out (west)');
});

test('a door standing open on the scene edge, or a region that leads out, is an opening', () => {
  const walls = [{ c: [0, 100, 0, 200], move: 20, door: 1, ds: 1 }, { c: [300, 100, 300, 200], move: 20, door: 1, ds: 1 }, { c: [0, 250, 0, 290], move: 20, door: 1, ds: 0 }];
  const out = sceneOpenings({ walls, bounds, grid: 100, regions: [{ polygons: [[1, 1, 2, 2, 3, 1]], leads: true }, { polygons: [[9, 9, 8, 8, 7, 9]] }] });
  assert.equal(out.filter((o) => !Array.isArray(o)).length, 1, 'only the open door on the edge');
  assert.equal(out.filter(Array.isArray).length, 1, 'only the region that leads out');
});

test('the air flows toward the nearest way out, and every square it reaches leads there', () => {
  // Two ways out, either end of a long hall (0–1000 across, one square high).
  const hall = { x: 0, y: 0, width: 1000, height: 100 };
  const f = draftField({ res: 1, walls: [], bounds: hall, grid: 100, openings: [{ x: 50, y: 50 }, { x: 950, y: 50 }] });
  assert.ok(f.dir[1 * 2] < 0, 'near the west end it flows west');
  assert.ok(f.dir[8 * 2] > 0, 'near the east end it flows east');
  assert.equal(Math.max(...f.dist), 4, 'never more than halfway from one');
  // Downhill: from each square, a neighbour nearer the way out.
  for (let i = 0; i < f.cols; i++) if (f.dist[i] > 0) assert.ok([i - 1, i + 1].some((n) => n >= 0 && n < f.cols && f.dist[n] === f.dist[i] - 1));
});

test('walls that do not stop movement (a window, a curtain) let the air through; a diagonal wall stops it', () => {
  const box = { x: 0, y: 0, width: 300, height: 300 }, out = [{ x: 50, y: 150 }];
  const reached = (walls) => draftField({ res: 1, walls, bounds: box, grid: 100, openings: out }).dist[1 * 3 + 2];
  assert.ok(reached([{ c: [200, 0, 200, 300], move: 0 }]) > 0, 'move 0: open to the air');
  assert.equal(reached([{ c: [200, 0, 200, 300], move: 20 }]), -1, 'a solid wall: sealed');
  assert.ok(reached([{ c: [150, 120, 250, 180], move: 20 }]) > 1, 'a short diagonal wall: the air goes round it (further)');
  assert.equal(draftField({ res: 1, walls: [{ c: [300, 0, 0, 300], move: 20 }], bounds: box, grid: 100, openings: out }).dist[2 * 3 + 2], -1, 'but cuts off the corner behind it');
});

test('a region that is a way out fills all its squares; a locked door seals as a shut one does', () => {
  const box = { x: 0, y: 0, width: 400, height: 200 };
  const f = draftField({ res: 1, walls: [], bounds: box, grid: 100, openings: [[0, 0, 200, 0, 200, 200, 0, 200]] });
  assert.equal([0, 1, 4, 5].every((k) => f.dist[k] === 0), true, 'every square inside the region is the outside');
  const walls = (ds) => [{ c: [200, 0, 200, 200], move: 20, door: 1, ds }];
  const far = (ds) => draftField({ res: 1, walls: walls(ds), bounds: box, grid: 100, openings: [{ x: 50, y: 50 }] }).dist[3];
  assert.equal(far(2), -1); assert.equal(far(0), -1); assert.ok(far(1) > 0);
});

test('the air runs fast through a doorway and barely stirs in a room’s far corner', () => {
  // A room 0–600 by 0–600, its only way out a gap at the middle of its east wall (x 600, y 250–350) to the outside.
  const bounds = { x: 0, y: 0, width: 800, height: 600 };
  const walls = [{ c: [600, 0, 600, 250], move: 20 }, { c: [600, 350, 600, 600], move: 20 }];
  const f = draftField({ walls, bounds, grid: 100, res: 2, openings: [[700, 0, 800, 0, 800, 600, 700, 600]] });
  const at = (x, y) => f.speed[Math.floor(y / f.cell) * f.cols + Math.floor(x / f.cell)];
  assert.ok(at(625, 300) > 0.6, 'through the gap: fast');
  assert.ok(at(25, 25) < 0.25 && at(25, 25) > 0, 'the far corner: barely');
  assert.ok(at(550, 300) > at(300, 300), 'quicker as it nears the gap');
  // And it bends round to the gap: from the room's north-west it heads east and down.
  const k = Math.floor(100 / f.cell) * f.cols + Math.floor(100 / f.cell);
  assert.ok(f.dir[k * 2] > 0.3 && f.dir[k * 2 + 1] > 0);
});

test('a gust sweeps out from the door that opened: the far end of the hall feels it later', () => {
  const hall = { x: 0, y: 0, width: 1500, height: 100 };
  const f = draftField({ walls: [], bounds: hall, grid: 100, res: 1, openings: [{ x: 1450, y: 50 }] });
  const d = gustDelays(f, { x: 50, y: 50 }, { grid: 100 });
  // It starts on both sides of the door at once, then a square every 1/GUST_SPEED seconds.
  assert.ok(d[0] === 0 && d[1] === 0 && d[10] > d[5] && Math.abs(d[14] - 13 / GUST_SPEED) < 1e-6);
  assert.ok(draftStrength(-1) === 0.3, 'before it arrives: the steady draft');
});

test('a door opening sends a gust that swells in, then settles into a steady draft', () => {
  assert.equal(draftStrength(0), 0.3, 'no sudden front as it arrives');
  assert.ok(draftStrength(0.6) > 0.3 && draftStrength(0.6) < draftStrength(1.2));
  assert.ok(draftStrength(1.2) > 0.55 && draftStrength(1.2) <= 0.6);
  assert.ok(draftStrength(12) < 0.32 && draftStrength(12) >= 0.3);
});
