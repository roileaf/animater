import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duckStep, heronStep, frogStep } from '../../../scripts/engines/motion/pond-life.mjs';
import { rippleDue } from '../../../scripts/engines/motion/step-ripples.mjs';

const duck = (over = {}) => ({ x: 0, y: 0, a: 0, wait: 5, turn: 0, mode: 'swim', up: 0, h: 0, ...over });
const heron = (over = {}) => ({ x: 0, y: 0, hx: 0, hy: 0, a: 0, mode: 'stand', wait: 5, strike: 0, h: 0, t: 0, vx: 0, vy: 0, ...over });
const frog = (over = {}) => ({ x: 0, y: 0, hx: 0, hy: 0, a: 0, mode: 'sit', wait: 5, puff: 0, h: 0, t: 0, ...over });
const pond = (x, y) => Math.hypot(x, y) < 300;

test('a duck paddles round the pond and never climbs out of it', () => {
  let q = duck({ wait: 0 });
  for (let i = 0; i < 6000; i++) { q = duckStep(q, { dt: 1 / 60, grid: 100, ok: pond }); assert.ok(pond(q.x, q.y), `at ${q.x}, ${q.y}`); }
});

test('a duck clatters up away from anyone near, and comes down only on water', () => {
  const near = [{ x: 0, y: 100 }];
  const up = duckStep(duck(), { grid: 100, near, random: () => 0.5 });
  assert.equal(up.mode, 'fly');
  assert.ok(up.vy < 0, 'away from it');
  assert.equal(duckStep(duck(), { grid: 100, near: [{ x: 0, y: 900 }] }).mode, 'swim');
  assert.equal(duckStep(duck(), { grid: 100, scare: true, random: () => 0.5 }).mode, 'fly');
  let q = up; for (let i = 0; i < 10000 && q.mode === 'fly' && !q.gone; i++) q = duckStep(q, { dt: 1 / 60, grid: 100, ok: pond, random: () => 0.5 });
  assert.ok(q.gone || (q.mode === 'swim' && pond(q.x, q.y) && q.h === 0), `came down at ${q.x}, ${q.y}`);
  // No water anywhere: it does not land, it leaves.
  let lost = up; for (let i = 0; i < 10000 && !lost.gone; i++) lost = duckStep(lost, { dt: 1 / 60, grid: 100, ok: () => false, random: () => 0.5 });
  assert.equal(lost.gone, true);
});

test('a heron stands still till someone comes, flies, and returns to its spot only when it is clear', () => {
  let b = heron();
  for (let i = 0; i < 2000; i++) b = heronStep(b, { dt: 1 / 60, grid: 100 });
  assert.equal(b.mode, 'stand'); assert.deepEqual([b.x, b.y], [0, 0]);
  const near = [{ x: 0, y: 200 }];
  b = heronStep(b, { grid: 100, near });
  assert.equal(b.mode, 'fly'); assert.ok(b.vy < 0, 'away from it');
  // Someone still at its spot: it keeps away, whatever the time.
  for (let i = 0; i < 3000; i++) { b = heronStep(b, { dt: 1 / 60, grid: 100, near }); assert.equal(b.mode, 'fly'); }
  for (let i = 0; i < 5000 && b.mode === 'fly'; i++) b = heronStep(b, { dt: 1 / 60, grid: 100 });
  assert.equal(b.mode, 'stand'); assert.deepEqual([b.x, b.y, b.h], [0, 0, 0]);
});

test('a frog puffs on its pad, leaps into water from anyone near, and climbs back when it is clear', () => {
  const puffed = frogStep(frog({ wait: 0 }), { grid: 100, random: () => 0.5 });
  assert.ok(puffed.puff > 0);
  const near = [{ x: 0, y: 150 }];
  const off = frogStep(frog(), { grid: 100, near, ok: pond, random: () => 0.5 });
  assert.equal(off.mode, 'leap');
  assert.ok(off.ty < 0 && pond(off.tx, off.ty), 'ahead of them, into the water');
  let f = off; for (let i = 0; i < 40; i++) f = frogStep(f, { dt: 1 / 60, grid: 100, near, ok: pond, random: () => 0.5 });
  assert.equal(f.mode, 'swim'); assert.equal(f.h, 0);
  for (let i = 0; i < 2000; i++) f = frogStep(f, { dt: 1 / 60, grid: 100, near, ok: pond, random: () => 0.5 });
  assert.equal(f.mode, 'swim', 'stays under while they are by its pad');
  for (let i = 0; i < 4000 && f.mode !== 'sit'; i++) f = frogStep(f, { dt: 1 / 60, grid: 100, ok: pond, random: () => 0.5 });
  assert.equal(f.mode, 'sit'); assert.deepEqual([f.x, f.y], [0, 0]);
});

test('ducks and herons in flight stay out of walled and closed places', () => {
  const barred = (x, y) => y < -300;
  let q = duckStep(duck(), { grid: 100, near: [{ x: 0, y: 100 }], random: () => 0.5 });
  for (let i = 0; i < 2000 && q.mode === 'fly' && !q.gone; i++) { q = duckStep(q, { dt: 1 / 60, grid: 100, barred, ok: pond }); assert.ok(q.y >= -300, `at ${q.y}`); }
  let b = heronStep(heron(), { grid: 100, near: [{ x: 0, y: 200 }] });
  for (let i = 0; i < 2000 && b.mode === 'fly'; i++) { b = heronStep(b, { dt: 1 / 60, grid: 100, barred }); assert.ok(b.y >= -300, `at ${b.y}`); }
});

test('a ripple comes only when something has moved far enough since the last', () => {
  assert.equal(rippleDue(null, { x: 0, y: 0 }, 50), true, 'the first');
  assert.equal(rippleDue({ x: 0, y: 0 }, { x: 30, y: 0 }, 50), false);
  assert.equal(rippleDue({ x: 0, y: 0 }, { x: 30, y: 40 }, 50), true);
});

test('a frog with no water to leap into stays where it is', () => {
  const f = frogStep(frog(), { grid: 100, near: [{ x: 0, y: 150 }], ok: () => false, random: () => 0.5 });
  assert.equal(f.mode, 'sit');
});
