import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reachAround, reachToward, wallSide, hazeFit, clipToSide } from '../../../scripts/engines/motion/wall-reach.mjs';

// A long wall along x = 100.
const wall = { c: [100, -1000, 100, 1000], move: 20, door: 0, ds: 0 };

test('a fire in the open reaches as far as it may, every way', () => {
  assert.deepEqual(reachAround({ x: 0, y: 0 }, [], { grid: 100, max: 300 }), Array(8).fill(300));
});

test('a wall stops the reach toward it and not away from it', () => {
  const reach = reachAround({ x: 0, y: 0 }, [wall], { grid: 100, max: 300 });
  assert.ok(reachToward(reach, 1, 0) >= 100 && reachToward(reach, 1, 0) < 110, 'to the wall');
  assert.equal(reachToward(reach, -1, 0), 300, 'away from it');
});

test('a torch on a wall reaches only into its room', () => {
  const reach = reachAround({ x: 100, y: 0 }, [wall], { grid: 100, max: 300, home: { x: 40, y: 0 } });
  assert.equal(reachToward(reach, 1, 0), 0, 'nothing through the wall');
  assert.equal(reachToward(reach, -1, 0), 300, 'all of it into the room');
});

test('a fire on a wall belongs to the side it stands on, its light, or the more open side', () => {
  const near = wallSide({ x: 95, y: 0 }, [wall], { grid: 100 });
  assert.ok(near.nx < 0, 'off the line, on its own side');
  assert.ok(wallSide({ x: 100, y: 0 }, [wall], { grid: 100, home: { x: 160, y: 0 } }).nx > 0, 'by its light');
  const other = { c: [40, -1000, 40, 1000], move: 20 };
  assert.ok(wallSide({ x: 100, y: 0 }, [wall, other], { grid: 100 }).nx > 0, 'toward the more open side');
  assert.equal(wallSide({ x: 0, y: 0 }, [wall], { grid: 100 }), null, 'not near it');
});

test('an open door lets it through, a shut one does not', () => {
  const door = (ds) => ({ c: [100, -1000, 100, 1000], move: 20, door: 1, ds });
  assert.equal(reachToward(reachAround({ x: 0, y: 0 }, [door(1)], { grid: 100, max: 300 }), 1, 0), 300);
  assert.ok(reachToward(reachAround({ x: 0, y: 0 }, [door(0)], { grid: 100, max: 300 }), 1, 0) < 110);
});

test('a haze fits between the walls: moved off the nearest and smaller; left alone when it fits', () => {
  const reach = reachAround({ x: 50, y: 0 }, [wall], { grid: 100, max: 300 });
  const fit = hazeFit({ x: 50, y: 0 }, 150, reach, { grid: 100 });
  assert.ok(fit.x < 50 && fit.radius < 150);
  assert.equal(hazeFit({ x: 50, y: 0 }, 30, reach, { grid: 100 }), null);
});

test('a light cut to its own side of the wall', () => {
  const square = [-100, -100, 100, -100, 100, 100, -100, 100];
  const cut = clipToSide(square, { x: 0, y: 0 }, -1, 0);
  assert.ok(cut.filter((_, i) => i % 2 === 0).every((x) => x <= 0));
  assert.ok(cut.length >= 8);
});
