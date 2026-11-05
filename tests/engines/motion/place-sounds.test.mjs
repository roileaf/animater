import test from 'node:test';
import assert from 'node:assert/strict';

test('a waterfall is as loud as its stream is strong', async () => {
  const { fallLoudness } = await import('../../../scripts/engines/motion/place-sounds.mjs');
  assert.equal(fallLoudness(1), 1);
  assert.ok(fallLoudness(0.4) < fallLoudness(1) && fallLoudness(0.1) < fallLoudness(0.4));
  assert.ok(fallLoudness(0) > 0);
  assert.ok(Number.isFinite(fallLoudness('much')));
});

test('a strong fall further off can drown a weak one close by, and each is heard no louder than it is', async () => {
  const { placeHeard, placeHeardLouds } = await import('../../../scripts/engines/motion/place-sounds.mjs');
  const square = (x) => [x, 0, x + 100, 0, x + 100, 100, x, 100], ears = [{ x: 0, y: 50 }], near = square(100), far = square(300), options = { grid: 100 };
  assert.ok(Math.abs(placeHeardLouds('waterfall', [near], [1], ears, options).level - placeHeard('waterfall', [near], ears, options).level) < 1e-9);
  const weakNear = placeHeardLouds('waterfall', [near], [0.3], ears, options);
  assert.ok(weakNear.level < placeHeard('waterfall', [near], ears, options).level);
  const both = placeHeardLouds('waterfall', [near, far], [0.3, 1], ears, options);
  assert.ok(both.level > weakNear.level);
  assert.equal(both.at.x, placeHeard('waterfall', [far], ears, options).at.x);
  assert.equal(placeHeardLouds('waterfall', [], [], ears, options).level, 0);
});
