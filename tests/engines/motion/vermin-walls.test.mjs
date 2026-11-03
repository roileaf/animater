import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratStep, batReach } from '../../../scripts/engines/motion/vermin.mjs';

// A wall along x = 100.
const wall = (a, b) => (a.x < 100) !== (b.x < 100);

test('a rat turns before its snout reaches the wall', () => {
  const r = ratStep({ x: 85, y: 0, angle: 0, speed: 100, wait: 1 }, { dt: 0.02, grid: 100, blocked: wall, random: () => 0.5 });
  assert.equal(r.x, 85, 'did not step on');
  assert.notEqual(r.angle, 0, 'turned away');
});

test('a bat\'s loop shrinks to fit its room', () => {
  assert.equal(batReach({ x: -1000, y: 0 }, { r: 250, grid: 100, blocked: wall }), 250, 'open room: as wide as it likes');
  const near = batReach({ x: -150, y: 0 }, { r: 250, grid: 100, blocked: wall });
  // The spot stands 250 from the wall: the loop and its wander (0.4 of a square) stop short of it.
  assert.ok(near < 250 && near + 40 < 250, 'the loop and its wander stay short of the wall');
});
