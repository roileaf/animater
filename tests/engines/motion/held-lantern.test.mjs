import test from 'node:test';
import assert from 'node:assert/strict';
import { lanternPose, lanternSwing } from '../../../scripts/engines/motion/held-lantern.mjs';
import { torchPose } from '../../../scripts/engines/motion/held-torch.mjs';

test('the lantern hangs from the hand, its glass below it, inside the token’s square', () => {
  const p = lanternPose({ x: 500, y: 500, width: 100 }, 100), hand = torchPose({ x: 500, y: 500, width: 100 }, 100).hand;
  assert.deepEqual(p.hand, hand);
  assert.ok(p.centre.y > hand.y && p.centre.x === hand.x);
  assert.ok(p.centre.y + p.size * 0.4 < 550, 'inside the square');
  assert.ok(lanternPose({ x: 0, y: 0, width: 800 }, 100).size <= 100 * 2.2 * 0.3 + 1e-9);
  const torch = torchPose({ x: 500, y: 500, width: 100 }, 100);
  assert.ok(p.size / torch.length > 0.6 && p.size / torch.length < 0.9, 'about two-thirds of a torch');
  assert.ok(lanternPose({ x: 500, y: 500, width: 100, side: -1 }, 100).hand.x < 480);
});

test('it sways a little at rest and swings back as the creature walks', () => {
  const rest = Array.from({ length: 50 }, (_, i) => lanternSwing('k', i / 10));
  assert.ok(Math.max(...rest.map(Math.abs)) < 0.08 && Math.max(...rest) - Math.min(...rest) > 0.02);
  assert.ok(lanternSwing('k', 1, 0.5) < lanternSwing('k', 1, 0) - 0.3, 'walking right swings it back');
});
