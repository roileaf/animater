import test from 'node:test';
import assert from 'node:assert/strict';
import { ceilingFall } from '../../../scripts/engines/motion/ceiling-dust.mjs';

test('a heavier jolt shakes down more dust, further around it; the same jolt always falls the same', () => {
  const large = ceilingFall({ at: { x: 0, y: 0 }, weight: 4, grid: 100, seed: 'a' }), huge = ceilingFall({ at: { x: 0, y: 0 }, weight: 8, grid: 100, seed: 'a' });
  assert.ok(huge.length > large.length);
  const far = (list) => Math.max(...list.map((p) => Math.hypot(p.x, p.y)));
  assert.ok(far(huge) > far(large));
  assert.ok(large.some((p) => p.puff) && large.some((p) => !p.puff), 'grit and puffs both');
  assert.deepEqual(ceilingFall({ at: { x: 5, y: 5 }, weight: 6, seed: 'x' }), ceilingFall({ at: { x: 5, y: 5 }, weight: 6, seed: 'x' }));
});
