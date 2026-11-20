import test from 'node:test';
import assert from 'node:assert/strict';
import { rectRoom, roundRoom, RING_SIDES_LEAST, RING_SIDES_MOST } from '../../../scripts/engines/motion/room-shapes.mjs';

const G = 100;

test('a rectangle room is four corners and comes back to the first', () => {
  const points = rectRoom({ x: 200, y: 200 }, { x: 500, y: 400 }, G);
  assert.equal(points.length, 5, 'four corners, closed');
  assert.deepEqual(points[0], points.at(-1), 'the last leg comes back to where it started');
  assert.deepEqual(points.slice(0, 4), [{ x: 200, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 200, y: 400 }]);
});

test('the corner it was started at stays put, whichever way the drag goes', () => {
  // Roi asked for this beside Round room; dragged up and to the left, a room that grew from the pointer instead
  // would slide out from under the corner the GM picked.
  const back = rectRoom({ x: 500, y: 400 }, { x: 200, y: 200 }, G);
  assert.deepEqual(back.slice(0, 4), [{ x: 200, y: 200 }, { x: 500, y: 200 }, { x: 500, y: 400 }, { x: 200, y: 400 }]);
  assert.ok(back.some((p) => p.x === 500 && p.y === 400), 'the corner it was dragged from is one of the room\'s');
});

test('a rectangle is never thinner than one square', () => {
  const nothing = rectRoom({ x: 300, y: 300 }, { x: 300, y: 300 }, G);
  assert.deepEqual(nothing.slice(0, 4), [{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 400 }, { x: 300, y: 400 }]);
  const line = rectRoom({ x: 300, y: 300 }, { x: 800, y: 300 }, G);
  const ys = new Set(line.map((p) => p.y));
  assert.deepEqual([...ys].sort((a, b) => a - b), [300, 400], 'a drag straight along still closes a room');
});

test('a round room is a closed ring, wider the further it is dragged', () => {
  const small = roundRoom({ x: 500, y: 500 }, { x: 500, y: 600 }, G);
  const big = roundRoom({ x: 500, y: 500 }, { x: 500, y: 1000 }, G);
  for (const ring of [small, big]) {
    assert.deepEqual(ring[0], ring.at(-1), 'closed');
    assert.ok(ring.length - 1 >= RING_SIDES_LEAST && ring.length - 1 <= RING_SIDES_MOST);
  }
  const span = (ring) => Math.max(...ring.map((p) => p.x)) - Math.min(...ring.map((p) => p.x));
  assert.ok(span(big) > span(small), 'dragged further, a wider room');
});

test('a round room is round: every corner the same distance from the middle', () => {
  const ring = roundRoom({ x: 400, y: 400 }, { x: 400, y: 750 }, G);
  const out = ring.slice(0, -1).map((p) => Math.hypot(p.x - 400, p.y - 400));
  assert.ok(Math.max(...out) - Math.min(...out) <= 1.5, 'to within the rounding of a pixel');
});

test('a ring is never smaller than half a square across, however small the drag', () => {
  const ring = roundRoom({ x: 500, y: 500 }, { x: 501, y: 500 }, G);
  const out = ring.slice(0, -1).map((p) => Math.hypot(p.x - 500, p.y - 500));
  assert.ok(Math.min(...out) >= G * 0.5 - 1);
});
