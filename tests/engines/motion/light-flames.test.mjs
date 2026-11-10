import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fireKindOf, fireTongues, underTile, tileDrawnAt, fireGlow } from '../../../scripts/engines/motion/light-flames.mjs';

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

test('a sconce in the map\'s foreground picture leaves its flame showing, a roof does not', () => {
  const at = { x: 500, y: 500 }, reach = 100;
  // Its picture only within this far of the fire, and along one side as a wall would be.
  const patch = (r, wall = false) => (p) => Math.hypot(p.x - at.x, p.y - at.y) <= r || (wall && p.x > at.x + 10);
  const foreground = (covers) => [{ elevation: 20, covers, fixtureReach: reach }];
  assert.equal(underTile(foreground(patch(30)), at), false, 'a sconce alone');
  assert.equal(underTile(foreground(patch(30, true)), at), false, 'a sconce on a wall');
  assert.equal(underTile(foreground(patch(1000)), at), true, 'a roof');
  assert.equal(underTile(foreground(() => false), at), false, 'nothing drawn there');
  assert.equal(underTile([{ elevation: 20, covers: patch(30) }], at), true, 'a small tile a GM placed still hides it');
  assert.equal(underTile([{ elevation: 0, covers: patch(1000), fixtureReach: reach }], at, 5), false, 'nothing below the fire hides it');
});

test("a fire's halo and heart: sized by its flame and its bed, fading with its heat", () => {
  const torch = fireGlow({ unit: 20 });
  assert.equal(torch.halo.size, 36);
  assert.ok(Math.abs(torch.halo.y + 5.4) < 1e-9, "a little above the root");
  assert.equal(torch.halo.alpha, 0.16);
  assert.ok(Math.abs(torch.heart.w - 8) < 1e-9 && Math.abs(torch.heart.h - 3.2) < 1e-9);
  assert.ok(Math.abs(torch.heart.alpha - 0.35) < 1e-9);
  // a bed spreads both; a taller flicker grows the halo
  const bed = fireGlow({ unit: 20, spread: 10, tall: 1.2 });
  assert.ok(bed.halo.size > torch.halo.size && bed.heart.w > torch.heart.w && bed.heart.h > torch.heart.h);
  assert.ok(Math.abs(bed.halo.size - 2 * 30 * 0.92) < 1e-9);
  // dying down: both fade to nothing
  const out = fireGlow({ unit: 20, heat: 0 });
  assert.equal(out.halo.alpha, 0); assert.equal(out.heart.alpha, 0);
  assert.ok(Math.abs(fireGlow({ unit: 20, heat: 0.5 }).halo.alpha - 0.08) < 1e-9);
});
