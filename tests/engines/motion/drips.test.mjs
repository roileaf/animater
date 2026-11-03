import test from 'node:test';
import assert from 'node:assert/strict';
import { dripsIn } from '../../../scripts/engines/motion/drips.mjs';

test('drops fall inside the dripping area, more in a bigger one, the same each time', () => {
  const small = [0, 0, 200, 0, 200, 200, 0, 200], big = [0, 0, 1600, 0, 1600, 1600, 0, 1600];
  const a = dripsIn(small, { grid: 100 }).drops, b = dripsIn(big, { grid: 100 }).drops;
  assert.ok(a.length >= 2 && b.length > a.length);
  assert.ok(b.every((p) => p.x >= 0 && p.x <= 1600 && p.y >= 0 && p.y <= 1600));
  assert.deepEqual(dripsIn(big, { grid: 100 }), dripsIn(big, { grid: 100 }));
});

test('a slow drip is fewer spots, each far slower; a fast one more and quicker', () => {
  const area = [0, 0, 300, 0, 300, 300, 0, 300], rate = ({ drops }) => drops.reduce((s, d) => s + 1 / d.every, 0);
  const slow = dripsIn(area, { grid: 100, pace: 'slow' }), steady = dripsIn(area, { grid: 100 }), fast = dripsIn(area, { grid: 100, pace: 'faster' });
  assert.ok(slow.drops.length < steady.drops.length && fast.drops.length > steady.drops.length);
  assert.ok(rate(slow) < rate(steady) / 6, 'drops a second, all spots together');
  assert.ok(rate(slow) < 0.5, 'slow: under one drop every two seconds');
  assert.ok(rate(fast) > rate(steady) * 3);
});
