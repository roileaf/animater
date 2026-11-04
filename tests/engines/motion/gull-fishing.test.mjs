import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gullStep, heronStep } from '../../../scripts/engines/motion/pond-life.mjs';

const gull = (over = {}) => ({ cx: 0, cy: 0, r: 300, a: 0, v: 0.3, mode: 'wheel', huntIn: 0, h: 1, ...over });
const run = (g, opts, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) g = gullStep(g, { dt: 1 / 60, grid: 100, ...opts }); return g; };
const fish = { x: 100, y: 50, view: 'f1' };

test('with no fish in sight a gull keeps wheeling', () => {
  const g = run(gull(), { fish: [] }, 2);
  assert.equal(g.mode, 'wheel');
  assert.equal(g.h, 1);
});

test('a gull dives at a fish, comes down to it, and hits the water once', () => {
  let g = gullStep(gull(), { dt: 1 / 60, grid: 100, fish: [fish], random: () => 0 });
  assert.equal(g.mode, 'dive');
  assert.equal(g.prey, 'f1');
  let hits = 0, lowest = 1;
  for (let t = 0; t < 3 && g.mode !== 'rise'; t += 1 / 60) { g = gullStep(g, { dt: 1 / 60, grid: 100, fish: [fish], random: () => 0 }); if (g.hit) hits += 1; lowest = Math.min(lowest, g.h); }
  assert.equal(hits, 1);
  assert.ok(lowest < 0.01);
  assert.ok(Math.hypot(g.x - fish.x, g.y - fish.y) < 1, 'where the fish is');
  assert.equal(g.got, true);
});

test('a dive can miss, and a gull follows a fish that swims', () => {
  let g = gullStep(gull(), { dt: 1 / 60, grid: 100, fish: [fish], random: () => 0.9 });
  const moved = { ...fish, x: 200, y: 120 };
  for (let t = 0; t < 3 && g.mode !== 'rise'; t += 1 / 60) g = gullStep(g, { dt: 1 / 60, grid: 100, fish: [moved], random: () => 0.9 });
  assert.equal(g.got, false);
  assert.ok(Math.hypot(g.x - moved.x, g.y - moved.y) < 1);
});

test('a fish gone by the time it lands is not caught', () => {
  let g = gullStep(gull(), { dt: 1 / 60, grid: 100, fish: [fish], random: () => 0 });
  for (let t = 0; t < 3 && g.mode !== 'rise'; t += 1 / 60) g = gullStep(g, { dt: 1 / 60, grid: 100, fish: [], random: () => 0 });
  assert.equal(g.got, false);
});

test('after a dive a gull climbs back to its circle', () => {
  let g = gullStep(gull(), { dt: 1 / 60, grid: 100, fish: [fish], random: () => 0 });
  g = run(g, { fish: [fish], random: () => 0 }, 4);
  assert.equal(g.mode, 'wheel');
  assert.equal(g.h, 1);
  assert.ok(g.huntIn > 0, 'and waits before the next');
});

test('a heron turns to a fish within reach and stabs', () => {
  const heron = { x: 0, y: 0, hx: 0, hy: 0, a: 0, mode: 'stand', wait: 0, strike: 0, h: 0 };
  const b = heronStep(heron, { dt: 1 / 60, grid: 100, fish: [{ x: 50, y: 0 }], random: () => 0.9 });
  assert.equal(b.strike, 0.35);
  assert.ok(Math.abs(b.a - Math.PI / 2) < 1e-6, 'facing it');
  const none = heronStep(heron, { dt: 1 / 60, grid: 100, fish: [{ x: 500, y: 0 }], random: () => 0.9 });
  assert.equal(none.strike, 0);
});
