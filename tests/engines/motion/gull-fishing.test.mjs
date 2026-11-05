import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gullStep, heronStep } from '../../../scripts/engines/motion/pond-life.mjs';

const gull = (over = {}) => ({ cx: 0, cy: 0, r: 300, x: 0, y: 0, way: 0, mode: 'glide', huntIn: 0, h: 1, ...over });
const run = (g, opts, seconds) => { for (let t = 0; t < seconds; t += 1 / 60) g = gullStep(g, { dt: 1 / 60, grid: 100, ...opts }); return g; };
const fish = { x: 100, y: 50, view: 'f1' };

test('with no fish in sight a gull keeps gliding', () => {
  const g = run(gull(), { fish: [] }, 2);
  assert.equal(g.mode, 'glide');
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

test('after a dive a gull climbs away and glides on', () => {
  let g = gullStep(gull(), { dt: 1 / 60, grid: 100, fish: [fish], random: () => 0 });
  g = run(g, { fish: [fish], random: () => 0 }, 4);
  assert.equal(g.mode, 'glide');
  assert.equal(g.h, 1);
  assert.ok(g.huntIn > 0, 'and waits before the next');
});

// The same every run, and not always the same number.
const seeded = () => { let n = 12345; return () => (n = (n * 1664525 + 1013904223) % 4294967296) / 4294967296; };

test('a gull wanders its stretch of water, turning gently, not round a circle', () => {
  const random = seeded(); let g = gull({ cx: 1000, cy: 500, rx: 1200, ry: 400, x: 1000, y: 500, huntIn: 1e6 });
  const far = [], seen = new Set();
  for (let t = 0; t < 600; t += 1 / 60) {
    const was = g.way; g = gullStep(g, { dt: 1 / 60, grid: 200, fish: [], random });
    assert.ok(Math.abs(g.way - was) < 0.02, 'no sharp turns');
    assert.ok(Math.abs(g.x - 1000) < 1200 + 500 && Math.abs(g.y - 500) < 400 + 500, `stays about its water: ${g.x}, ${g.y}`);
    far.push(Math.hypot(g.x - 1000, g.y - 500)); seen.add(`${Math.round(g.x / 300)},${Math.round(g.y / 300)}`);
  }
  assert.ok(Math.max(...far) - Math.min(...far) > 500, 'not at one distance from anywhere, as on a circle');
  assert.ok(seen.size > 12, 'and goes all over it');
});

test('in a wind a gull sometimes hangs on it, facing into it and hardly moving', () => {
  let g = gull({ cx: 0, cy: 0, rx: 5000, ry: 5000, way: 2, turnIn: 0, huntIn: 1e6 });
  const air = { angle: 0, strength: 1 };
  g = gullStep(g, { dt: 1 / 60, grid: 100, fish: [], air, random: () => 0 });
  assert.ok(g.hang > 0, 'it took to hanging');
  for (let i = 0; i < 150; i++) g = gullStep(g, { dt: 1 / 60, grid: 100, fish: [], air, random: () => 0 });
  const x = g.x; g = gullStep(g, { dt: 0.1, grid: 100, fish: [], air, random: () => 0 });
  assert.ok(Math.abs(Math.cos(g.way) + 1) < 0.1, 'facing into the wind');
  assert.ok(Math.abs(g.x - x) < 5, 'making little way');
});

test('a heron turns to a fish within reach and stabs', () => {
  const heron = { x: 0, y: 0, hx: 0, hy: 0, a: 0, mode: 'stand', wait: 0, strike: 0, h: 0 };
  const b = heronStep(heron, { dt: 1 / 60, grid: 100, fish: [{ x: 50, y: 0 }], random: () => 0.9 });
  assert.equal(b.strike, 0.35);
  assert.ok(Math.abs(b.a - Math.PI / 2) < 1e-6, 'facing it');
  const none = heronStep(heron, { dt: 1 / 60, grid: 100, fish: [{ x: 500, y: 0 }], random: () => 0.9 });
  assert.equal(none.strike, 0);
});
