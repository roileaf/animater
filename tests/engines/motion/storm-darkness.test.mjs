import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stormDarkAsked, stormDarkStep, stormDarkTarget } from '../../../scripts/engines/motion/storm-darkness.mjs';

test('Storm darkness at 100% is the scene at its darkest', async () => {
  const { stormGloom } = await import('../../../scripts/engines/motion/sky-light.mjs');
  const asked = (most, rain = 0, cover = 1) => stormDarkTarget(stormGloom({ cover, rain, most, cap: 1 }));
  assert.equal(asked(1), 1, 'all the way');
  assert.equal(asked(1, 1), 1, 'and rain goes no further');
  assert.equal(asked(0.5), 0.5, 'follows the setting');
  assert.ok(Math.abs(asked(0.5, 1) - 0.625) < 1e-9, 'a little darker in the rain');
  assert.equal(asked(1, 0, 0.9), 0, 'plain overcast asks nothing');
  assert.equal(asked(0), 0, 'turned off');
  assert.equal(stormDarkTarget(0.01), 0, 'too little to save');
  assert.ok(stormGloom({ cover: 1, rain: 1, most: 1 }) <= 0.85, 'the wash alone keeps its limit');
});

test('the storm comes in, keeping what the clock said', () => {
  assert.deepEqual(stormDarkStep({ darkness: 0.1, target: 0.6 }), { darkness: 0.6, kept: { base: 0.1, target: 0.6 } });
  assert.equal(stormDarkStep({ darkness: 0.1, target: 0 }), null, 'no storm, nothing written');
  assert.equal(stormDarkStep({ darkness: 0.93, target: 0.6 }), null, 'night is darker already: left alone');
});

test('a small change waits; a big one moves it; the end puts it back', () => {
  const kept = { base: 0.1, target: 0.6 };
  assert.equal(stormDarkStep({ darkness: 0.6, kept, target: 0.62 }), null, 'a gust');
  assert.deepEqual(stormDarkStep({ darkness: 0.6, kept, target: 0.7 }), { darkness: 0.7, kept: { base: 0.1, target: 0.7 } });
  assert.deepEqual(stormDarkStep({ darkness: 0.6, kept, target: 0 }), { darkness: 0.1, kept: null }, 'over');
  assert.deepEqual(stormDarkStep({ darkness: 0.6, kept, target: 0.1 }), { darkness: 0.1, kept: null }, 'no darker than the clock');
});

test('the clock moving under a storm changes what it goes back to, not the dark', () => {
  const kept = { base: 0.1, target: 0.6 };
  assert.deepEqual(stormDarkAsked(0.3, kept), { darkness: 0.6, kept: { base: 0.3, target: 0.6 } });
  assert.deepEqual(stormDarkAsked(0.9, kept), { darkness: 0.9, kept: null }, 'night overtakes the storm');
  assert.equal(stormDarkAsked(0.3, null), null, 'no storm: not ours to touch');
});
