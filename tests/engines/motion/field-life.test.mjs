import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deerStep, foxStep, butterflyStep, dragonflyStep, owlPlace, turnToward, clearWay } from '../../../scripts/engines/motion/field-life.mjs';

const deer = (over = {}) => ({ x: 0, y: 0, a: 0, mode: 'graze', wait: 5, t: 0, way: 0, want: 0, v: 0, gait: 0, lift: 0, h: 0, ...over });
const fox = (over = {}) => ({ x: 0, y: 0, a: 0, want: 0, mode: 'trot', t: 0, wait: 5, v: 0, gait: 0, way: 0, h: 0, ...over });

test('a turn goes the short way and only so far', () => {
  assert.ok(Math.abs(turnToward(0, 1, 0.1) - 0.1) < 1e-9);
  assert.ok(turnToward(3, -3, 0.1) > 3, 'round through pi, not back through zero');
  assert.ok(Math.abs(turnToward(0, 0.05, 0.1) - 0.05) < 1e-9);
});

test('a deer bounds away from anyone near or a noise, and stays clear of walls and water', () => {
  const near = [{ x: 0, y: 200 }];
  const up = deerStep(deer(), { grid: 100, near, random: () => 0.5 });
  assert.equal(up.mode, 'flee');
  assert.equal(deerStep(deer(), { grid: 100, near: [{ x: 0, y: 900 }] }).mode, 'graze');
  assert.equal(deerStep(deer(), { grid: 100, noise: { x: 0, y: 2000 }, random: () => 0.5 }).mode, 'flee');
  // Water beyond y = -300 and a wall beyond x = 300: however long it runs, it stays this side of both.
  const ok = (x, y) => y > -300, blocked = (a, b) => (a.x - 300) * (b.x - 300) < 0;
  let o = up; for (let i = 0; i < 6000; i++) { o = deerStep(o, { dt: 1 / 60, grid: 100, near, ok, blocked }); assert.ok(o.y > -300 && o.x < 300, `at ${o.x}, ${o.y}`); }
});

test('the clearest way is the one nearest what it wanted, either side', () => {
  const dry = (x, y) => y > -100;
  assert.equal(clearWay(0, 0, 0, 100, dry), 0, 'clear already');
  const up = -Math.PI / 2, w = clearWay(0, 0, up, 200, dry);
  assert.ok(Math.sin(w) * 200 > -100 && w !== up, 'round the water');
  assert.equal(clearWay(0, 0, up, 200, () => false), null, 'boxed in');
});

test('a deer driven at a bank runs along it instead of sticking, its nose kept off the water', () => {
  // Water beyond y = -300, someone right behind it, pushing it straight at the bank.
  const ok = (x, y) => y > -300; let o = deer({ y: -180, a: 0, mode: 'flee', way: -Math.PI / 2, t: 0, gait: 0.75 }), start = o.x, furthest = 0, facing = new Set();
  for (let i = 0; i < 220; i++) { o = deerStep(o, { dt: 1 / 60, grid: 100, ok, near: [{ x: o.x, y: o.y + 200 }] }); assert.ok(o.y > -300, `in the water at ${o.y}`); furthest = Math.max(furthest, Math.abs(o.x - start)); assert.ok(o.y - Math.cos(o.a) * 40 > -300, 'its nose over the water'); facing.add(Math.round(o.a * 2)); }
  assert.ok(furthest > 200, `got away along the bank: ${furthest}`);
  assert.ok(facing.size < 12, 'and did not spin');
});

test('a fox driven at a bank gets away along it too', () => {
  const ok = (x, y) => y > -300; let f = fox({ y: -220, mode: 'flee', way: -Math.PI / 2, a: 0 }), furthest = 0;
  for (let i = 0; i < 150; i++) { f = foxStep(f, { dt: 1 / 60, grid: 100, ok }); assert.ok(f.y > -300); furthest = Math.max(furthest, Math.abs(f.x)); }
  assert.ok(furthest > 150, `along the bank: ${furthest}`);
});

test('a deer stops running once nothing is near, and a stride goes with the ground covered', () => {
  let o = deerStep(deer(), { grid: 100, near: [{ x: 0, y: 200 }], random: () => 0.5 });
  for (let i = 0; i < 300; i++) o = deerStep(o, { dt: 1 / 60, grid: 100 });
  assert.equal(o.mode, 'look'); assert.equal(o.h, 0);
  let w = deer({ mode: 'walk', lift: 1, wait: 99, v: 42 }); const from = w.gait, x0 = w.y;
  w = deerStep(w, { dt: 0.1, grid: 100 });
  assert.ok(w.gait > from && w.y < x0, 'walks forward');
  const still = deerStep(deer({ mode: 'graze', wait: 99 }), { dt: 0.1, grid: 100 });
  assert.equal(still.gait, 0, 'no strides standing still');
});

test('a fox creeps on a rabbit, coils and pounces at it', () => {
  const prey = [{ x: 0, y: -400, mode: 'sit' }];
  let f = fox({ wait: 0 }); const modes = new Set();
  for (let i = 0; i < 4000 && f.mode !== 'landed'; i++) { f = foxStep(f, { dt: 1 / 60, grid: 100, prey, time: i / 60, random: () => 0.5 }); modes.add(f.mode); }
  for (const m of ['stalk', 'coil', 'pounce', 'landed']) assert.ok(modes.has(m), m);
  assert.ok(Math.hypot(f.x - prey[0].x, f.y - prey[0].y) < 10, 'came down where it was');
});

test('a fox leaves a rabbit already running, runs from anyone near, and keeps to its ground', () => {
  const running = foxStep(fox({ wait: 0 }), { grid: 100, prey: [{ x: 0, y: -100, mode: 'bolt' }], random: () => 0.5 });
  assert.equal(running.mode, 'trot');
  const stalking = foxStep(fox({ mode: 'stalk' }), { grid: 100, prey: [{ x: 0, y: -100, mode: 'bolt' }] });
  assert.equal(stalking.mode, 'trot');
  const near = [{ x: 0, y: 150 }], ok = (x, y) => y > -300;
  let f = foxStep(fox(), { grid: 100, near, ok, random: () => 0.5 });
  assert.equal(f.mode, 'flee');
  for (let i = 0; i < 4000; i++) { f = foxStep(f, { dt: 1 / 60, grid: 100, near, ok }); assert.ok(f.y > -300, `at ${f.y}`); }
});

test('a carrying fox goes off and is gone till it is brought back', () => {
  let f = fox({ mode: 'carry', way: 0 });
  for (let i = 0; i < 500 && f.mode === 'carry'; i++) f = foxStep(f, { dt: 1 / 60, grid: 100, near: [{ x: 0, y: 50 }], random: () => 0.5 });
  assert.equal(f.mode, 'away'); assert.ok(f.back > 0);
  assert.equal(foxStep(f, { dt: 1, grid: 100, near: [{ x: f.x, y: f.y }] }).mode, 'away');
});

test('butterflies and dragonflies keep to where they may be', () => {
  const ok = (x, y) => Math.hypot(x, y) < 300;
  let b = { x: 0, y: 0, a: 0, wait: 0, turn: 0, p: 0 };
  for (let i = 0; i < 6000; i++) { b = butterflyStep(b, { dt: 1 / 60, grid: 100, ok, time: i / 60 }); assert.ok(ok(b.x, b.y), `at ${b.x}, ${b.y}`); }
  let d = { x: 0, y: 0, a: 0, hover: 0 }, darts = 0;
  for (let i = 0; i < 6000; i++) { const was = d.dart; d = dragonflyStep(d, { dt: 1 / 60, grid: 100, ok }); assert.ok(ok(d.x, d.y), `at ${d.x}, ${d.y}`); if (d.dart && !was) darts++; }
  assert.ok(darts > 3, 'it moves about');
});

test('an owl crosses on a bow, off the map at both ends', () => {
  const at = (t) => owlPlace({ cx: 0, cy: 0, way: 0, far: 1000, t });
  assert.ok(at(0).x < -400 && at(1).x > 400);
  assert.ok(Math.abs(at(0.5).y) > 50, 'bowed in the middle');
});
