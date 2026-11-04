import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireKindOf, fireTongues, underTile } from '../../../scripts/engines/motion/light-flames.mjs';

test('a flame under a roof drawn now is hidden; a faded roof, a low tile or a gap in it hides nothing', () => {
  const roof = (over = {}) => ({ elevation: 20, alpha: 1, visible: true, covers: () => true, ...over }), at = { x: 5, y: 5 };
  assert.equal(underTile([roof()], at, 0), true);
  assert.equal(underTile([roof({ alpha: 0.1 })], at, 0), false, 'faded for someone inside');
  assert.equal(underTile([roof({ visible: false })], at, 0), false);
  assert.equal(underTile([roof({ elevation: 0 })], at, 0), false, 'a floor tile');
  assert.equal(underTile([roof()], at, 30), false, 'flying above the roof');
  assert.equal(underTile([roof({ covers: () => false })], at, 0), false, 'a gap in the leaves');
  assert.equal(underTile([], at, 0), false);
});

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
