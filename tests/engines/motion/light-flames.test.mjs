import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireKindOf, fireTongues } from '../../../scripts/engines/motion/light-flames.mjs';

test('a torch light burns as a torch, a flame or fire light as a brazier, unless the light says', () => {
  assert.equal(fireKindOf('', 'torch'), 'torch');
  assert.equal(fireKindOf('', 'flame'), 'torch');
  assert.equal(fireKindOf(undefined, 'fire'), 'torch');
  assert.equal(fireKindOf('brazier', 'flame'), 'brazier');
  assert.equal(fireKindOf('bonfire', 'torch'), 'bonfire');
  assert.equal(fireKindOf('nonsense', 'flame'), 'torch');
});

test('a torch is one tongue; a brazier one big flame with smaller ones pressed to it, drawn in front; a bonfire wider and taller', () => {
  assert.deepEqual(fireTongues('torch', 100), [{ x: 0, y: 0, scale: 1 }]);
  const bed = fireTongues('brazier', 100), big = fireTongues('bonfire', 100);
  assert.equal(bed.length, 3); assert.equal(big.length, 5);
  const middle = bed[bed.length - 1];
  assert.ok(bed.every((t) => t === middle || t.scale < middle.scale), 'the tallest drawn last, in front');
  assert.ok(bed.every((t) => Math.hypot(t.x, t.y) <= 10), 'close enough to burn as one');
  assert.ok(Math.max(...big.map((t) => Math.abs(t.x))) > Math.max(...bed.map((t) => Math.abs(t.x))));
  assert.ok(big[big.length - 1].scale > middle.scale);
});
