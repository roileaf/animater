import test from 'node:test';
import assert from 'node:assert/strict';
import { ratStep, ratsAt } from '../../../scripts/engines/motion/vermin.mjs';

test('a rat flees whoever comes near, and keeps out of the light and the walls', () => {
  const rat = { x: 0, y: 0, angle: 0, speed: 0, wait: 1 };
  const fled = ratStep(rat, { grid: 100, near: [{ x: 50, y: 0 }], random: () => 0.5 });
  assert.ok(fled.x < 0, 'away from the creature');
  const walking = { x: 0, y: 0, angle: 0, speed: 200, wait: 1 };
  assert.equal(ratStep(walking, { grid: 100, lit: (x) => (x > 1 ? 1 : 0), random: () => 0.5 }).x, 0, 'no step into the light');
  assert.equal(ratStep(walking, { grid: 100, blocked: () => true, random: () => 0.5 }).x, 0, 'no step through a wall');
  assert.ok(ratStep(walking, { grid: 100, random: () => 0.5 }).x > 0, 'free: it moves');
});

test('rats start only in the dark', () => {
  const spots = [{ x: 0, y: 0 }, { x: 500, y: 0 }];
  const placed = ratsAt(spots, { count: 6, lit: (x) => (x > 100 ? 1 : 0) });
  assert.equal(placed.length, 6);
  assert.ok(placed.every((r) => r.x === 0));
  assert.equal(ratsAt(spots, { lit: () => 1 }).length, 0, 'all lit: none');
});
