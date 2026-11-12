import test from 'node:test';
import assert from 'node:assert/strict';
import { swayReach, swayRipple, swayAt, bridgeWeight, ropeWeight, pieceFrame } from '../../../scripts/engines/regions/crossing-sway.mjs';

// Roi: "we can also make the bridge react to the wind", then "make it move based on the wind strength no?"
test('the sway grows with the wind: a few pixels in a breeze, about a quarter square in a gale; the ripple only as it strengthens', () => {
  assert.ok(swayReach(0.1, 100) < 5 && Math.abs(swayReach(1, 100) - 25) < 1e-9);
  assert.ok(swayReach(0.6, 100) > swayReach(0.3, 100));
  assert.equal(swayRipple(0.2), 0); assert.equal(swayRipple(1), 1);
  assert.equal(swayAt({ v: 0.5, time: 3, wind: 0, grid: 100 }), 0, 'still without wind');
  const most = (wind) => Math.max(...Array.from({ length: 400 }, (_, i) => Math.abs(swayAt({ v: 0.5, time: i * 0.05, wind, grid: 100 }))));
  assert.ok(most(1) > most(0.3) * 3 && most(1) <= 25 * 1.15 * 1.12 + 1e-9, `${most(0.3)} ${most(1)}`);
});

test('a bridge swings most at mid-span and not at its ends nor where it rests on raised ground; a rope most toward its foot', () => {
  assert.equal(bridgeWeight(0), 0); assert.ok(Math.abs(bridgeWeight(1)) < 1e-9); assert.equal(bridgeWeight(0.5), 1);
  assert.equal(bridgeWeight(0.5, () => 0, 100), 0, 'resting on the top');
  assert.equal(ropeWeight(0), 0); assert.ok(ropeWeight(1) > ropeWeight(0.5));
});

test('a piece is drawn straight down its picture and laid along it on the map', () => {
  const f = pieceFrame({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: -1 });
  assert.equal(f.len, 100); assert.deepEqual([f.along.x, f.along.y], [1, 0]);
  assert.ok(Math.abs(Math.cos(f.rotation) - f.across.x) < 1e-9 && Math.abs(Math.sin(f.rotation) - f.across.y) < 1e-9);
  assert.ok(Math.abs(-Math.sin(f.rotation) - f.along.x) < 1e-9 && Math.abs(Math.cos(f.rotation) - f.along.y) < 1e-9, 'its picture\'s down is along it');
});