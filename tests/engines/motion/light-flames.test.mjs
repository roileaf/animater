import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireKindOf, fireTongues, underTile, tileDrawnAt } from '../../../scripts/engines/motion/light-flames.mjs';

test('a roof faded for a creature inside is not drawn, though its own alpha stays whole', () => {
  const at = { x: 5, y: 5 }, roof = { alpha: 1, elevation: 20 };
  assert.equal(tileDrawnAt(roof, [], at), 1, 'nobody under it');
  assert.equal(tileDrawnAt({ ...roof, state: { fade: 1 } }, [], at), 0, 'the fade Foundry does in its shader');
  assert.equal(tileDrawnAt({ ...roof, occludedAlpha: 0.25, state: { fade: 1 } }, [], at), 0.25, 'the tile says how far it fades');
  assert.equal(tileDrawnAt({ ...roof, alpha: 0.5 }, [], at), 0.5);
});

test('a radial or vision roof opens only where a creature below it reaches', () => {
  const at = { x: 5, y: 5 }, roof = { alpha: 1, elevation: 20 };
  const near = { elevation: 0, radial: () => true, vision: () => false }, sees = { elevation: 0, radial: () => false, vision: () => true };
  const far = { elevation: 0, radial: () => false, vision: () => false };
  assert.equal(tileDrawnAt({ ...roof, state: { radial: 1 } }, [near], at), 0);
  assert.equal(tileDrawnAt({ ...roof, state: { radial: 1 } }, [far], at), 1, 'out of reach, still drawn');
  assert.equal(tileDrawnAt({ ...roof, state: { vision: 1 } }, [sees], at), 0);
  assert.equal(tileDrawnAt({ ...roof, state: { vision: 1 } }, [far], at), 1);
  assert.equal(tileDrawnAt({ ...roof, state: { radial: 1 } }, [{ ...near, elevation: 30 }], at), 1, 'above the roof');
  assert.equal(tileDrawnAt({ ...roof, state: { radial: 1 } }, [near], null), 1, 'no place asked about');
});

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
