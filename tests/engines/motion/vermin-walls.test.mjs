import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ratStep, batStep } from '../../../scripts/engines/motion/vermin.mjs';

// A wall along x = 100.
const wall = (a, b) => (a.x < 100) !== (b.x < 100);

test('a rat turns before its snout reaches the wall', () => {
  const r = ratStep({ x: 85, y: 0, angle: 0, speed: 100, wait: 1 }, { dt: 0.02, grid: 100, blocked: wall, random: () => 0.5 });
  assert.equal(r.x, 85, 'did not step on');
  assert.notEqual(r.angle, 0, 'turned away');
});

test('a bat never crosses a wall, however long it flies', () => {
  let bat = { x: 40, y: 0, angle: 0, turn: 0, speed: 100, wait: 0 }, seed = 1;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6000; i++) { const was = bat; bat = batStep(bat, { dt: 1 / 60, grid: 100, blocked: wall, check: i % 3 === 0, random }); assert.ok(!wall(was, bat), `crossed at step ${i}`); assert.ok(bat.x < 100); }
  assert.ok(Math.hypot(bat.x - 40, bat.y) > 1, 'it does fly');
});

test('a bat stays out of a place it keeps out of', () => {
  const kept = (p) => Math.hypot(p.x - 300, p.y) < 150, blocked = (a, b) => kept(b) && !kept(a);
  let bat = { x: 100, y: 0, angle: 0, turn: 0, speed: 100, wait: 0 }, seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 6000; i++) { bat = batStep(bat, { dt: 1 / 60, grid: 100, blocked, check: i % 3 === 0, random }); assert.ok(!kept(bat), `in at step ${i}`); }
});

test('hemmed in on every side, it hangs where it is', () => {
  const b = batStep({ x: 1, y: 2, angle: 0, turn: 0, speed: 100, wait: 1 }, { blocked: () => true });
  assert.deepEqual([b.x, b.y], [1, 2]);
});
