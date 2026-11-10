import test from 'node:test';
import assert from 'node:assert/strict';
import { VARIANTS, crownOpen, pictureOf, shadowReach, turnOf } from '../../../scripts/engines/motion/decorations.mjs';

test('decorations share a few pictures a kind: a look by seed, a size step, and the weather that changes its paint', () => {
  const a = pictureOf({ kind: 'rock', seed: 3, size: 0.4 }), b = pictureOf({ kind: 'rock', seed: 3 + VARIANTS, size: 0.41 });
  assert.equal(a.key, b.key, 'same look and size step');
  assert.notEqual(pictureOf({ kind: 'rock', seed: 4, size: 0.4 }).key, a.key, 'another look');
  assert.notEqual(pictureOf({ kind: 'rock', seed: 3, size: 0.8 }).key, a.key, 'another size step');
  assert.notEqual(pictureOf({ kind: 'oak', seed: 3, size: 2.6 }, { season: 'autumn' }).key, pictureOf({ kind: 'oak', seed: 3, size: 2.6 }, { season: 'summer' }).key, 'its season');
});

test('a crown opens over a creature under it and stays shut for one beside it', () => {
  const tree = { x: 500, y: 500, size: 2.6 };
  assert.equal(crownOpen(tree, [{ x: 500, y: 500, width: 100 }], 100), 1);
  assert.equal(crownOpen(tree, [{ x: 900, y: 500, width: 100 }], 100), 0);
  const edge = crownOpen(tree, [{ x: 640, y: 500, width: 100 }], 100);
  assert.ok(edge > 0 && edge <= 1);
});

test('a shadow reaches as far as the thing is tall and the sun is low', () => {
  assert.equal(shadowReach(0, 2, 100), 0);
  assert.ok(shadowReach(2, 2, 100) > shadowReach(1, 2, 100));
  assert.ok(shadowReach(1, 2.5, 100) > shadowReach(1, 0.4, 100));
});

test('solid things only turn a little; crowns and plants any way', () => {
  assert.equal(turnOf({ kind: 'oak', turn: 2 }), 2);
  assert.ok(Math.abs(turnOf({ kind: 'crate', turn: 2 })) < 1);
});
