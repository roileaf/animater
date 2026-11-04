import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creatureAmount, creatureSize, ratStep } from '../../../scripts/engines/motion/vermin.mjs';

test('a scene\'s creature amounts and sizes, the usual when unset', () => {
  assert.equal(creatureAmount(''), 1);
  assert.equal(creatureAmount(undefined), 1);
  assert.equal(creatureAmount('none'), 0);
  assert.equal(creatureAmount('few'), 0.5);
  assert.equal(creatureAmount('many'), 3);
  assert.equal(creatureAmount('nonsense'), 1);
  assert.equal(creatureSize(''), 1);
  assert.equal(creatureSize('big'), 1.4);
  assert.equal(creatureSize('nonsense'), 1);
});

test('a rat in the light runs out of it instead of turning on the spot', () => {
  // Bright to the left (x < 0), fading out to the right.
  const lit = (x) => (x < 0 ? 1 : Math.max(0, 0.9 - x / 100));
  const r = ratStep({ x: 0, y: 0, angle: 0, speed: 100, wait: 1 }, { dt: 0.02, grid: 100, lit, random: () => 0.5 });
  assert.ok(r.x > 0, 'stepped on toward the dark');
  assert.equal(r.angle, 0, 'did not turn');
});

test('a rat in the dark still turns back from the light', () => {
  const lit = (x) => (x > 10 ? 1 : 0);
  const r = ratStep({ x: 9, y: 0, angle: 0, speed: 100, wait: 1 }, { dt: 0.02, grid: 100, lit, random: () => 0.5 });
  assert.equal(r.x, 9, 'did not step into the light');
});
