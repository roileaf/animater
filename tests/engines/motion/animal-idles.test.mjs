import test from 'node:test';
import assert from 'node:assert/strict';
import { foxStep } from '../../../scripts/engines/motion/field-life.mjs';
import { farmStep } from '../../../scripts/engines/motion/farm-life.mjs';

// Roi: "can you please make sure all animals idle animations work as and trigger". The fox had none: it trotted without
// ever stopping unless it was hunting, so its look-about picture never showed.
test('a fox with no rabbit about stops now and then to look round, then trots on', () => {
  let f = { x: 0, y: 0, a: 0, want: 0, mode: 'trot', t: 0, wait: 0.01, v: 60, gait: 0, way: 0, h: 0, seed: 1 };
  let s = 7; const random = () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296); // seeded
  let looked = 0, still = 0, back = false;
  for (let i = 0; i < 60 * 120; i++) {
    const was = f.mode;
    f = foxStep(f, { dt: 1 / 60, grid: 100, random, time: i / 60 });
    if (f.mode === 'look' && was !== 'look') looked++;
    if (f.mode === 'look' && f.v <= 3) still++;
    if (was === 'look' && f.mode === 'trot') back = true;
  }
  assert.ok(looked >= 3, `it stopped to look ${looked} times in two minutes`);
  assert.ok(still > 60, 'and stood still long enough for the look picture to show');
  assert.ok(back, 'then trotted on');
});

test('a fox that sees a sitting rabbit still stalks it rather than stopping to look', () => {
  const f = foxStep({ x: 0, y: 0, a: 0, want: 0, mode: 'trot', t: 0, wait: 0.001, v: 60, gait: 0, way: 0, h: 0 }, { dt: 1 / 60, grid: 100, prey: [{ x: 200, y: 0, mode: 'sit' }], random: () => 0.1 });
  assert.equal(f.mode, 'stalk');
});

test('a startled farm animal runs two to four seconds, not the rest of its graze', () => {
  const cow = { kind: 'cows', x: 0, y: 0, a: 0, mode: 'graze', wait: 11, v: 0 };
  const ran = farmStep(cow, { dt: 1 / 20, grid: 100, near: [{ x: 50, y: 0 }], random: () => 0.5 });
  assert.equal(ran.mode, 'flee');
  assert.ok(ran.wait <= 4 && ran.wait >= 2 - 0.1, `runs ${ran.wait.toFixed(2)} s`);
  // One already running and chased again keeps the longer of the two.
  const again = farmStep({ ...ran, wait: 3.9 }, { dt: 1 / 20, grid: 100, near: [{ x: 50, y: 0 }], random: () => 0 });
  assert.ok(again.wait > 3.5, 'keeps its longer run');
});
