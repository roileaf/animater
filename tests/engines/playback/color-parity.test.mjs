import test from 'node:test';
import assert from 'node:assert/strict';
import { fallbackColorParity } from '../../../scripts/engines/playback/color-parity.mjs';
import { planRecipe } from '../../../scripts/core/model.mjs';

test('fallback footage of a different hue is colorized to the first choice', () => {
  assert.deepEqual(fallbackColorParity({ assets: ['jb2a.liquid.splash.green', 'jb2a.liquid.blob.blue'] }, 'jb2a.liquid.blob.blue'), { tintEnabled: true, colorize: true, tint: '#7fd36b' });
  assert.equal(fallbackColorParity({ assets: ['jb2a.fumes.toxic.green', 'jb2a.fumes.04.complete.grey'] }, 'jb2a.fumes.04.complete.grey').tint, '#7fd36b');
});
test('first choice, near hues, neutral first choices and authored tints are left alone', () => {
  assert.deepEqual(fallbackColorParity({ assets: ['jb2a.impact.001.orange'] }, 'jb2a.impact.001.orange'), {});
  assert.deepEqual(fallbackColorParity({ assets: ['jb2a.fire_ring.500px.orange', 'jb2a.fire_ring.500px.red'] }, 'jb2a.fire_ring.500px.red'), {});
  assert.deepEqual(fallbackColorParity({ assets: ['jb2a.impact.005.white', 'jb2a.impact.005.orange'] }, 'jb2a.impact.005.orange'), {});
  assert.deepEqual(fallbackColorParity({ assets: ['jb2a.liquid.splash.green', 'jb2a.liquid.blob.blue'], tintEnabled: true }, 'jb2a.liquid.blob.blue'), {});
  assert.deepEqual(fallbackColorParity({ assets: ['jb2a.boulder.toss.01.01', 'jb2a.impact.001.blue'] }, 'jb2a.impact.001.blue'), {});
});
test('planned Free stages carry the parity tint', () => {
  const recipe = { id: 'p', name: 'p', trigger: 'use', stages: [{ kind: 'impact', assets: ['jb2a.liquid.splash.green', 'jb2a.liquid.blob.blue'], duration: 1000 }] };
  const plan = planRecipe(recipe, [{ key: 'jb2a.liquid.blob.blue', file: 'x.webm' }], { source: { id: 's', center: { x: 0, y: 0 } }, targets: [{ id: 't', center: { x: 100, y: 0 } }], gridSize: 100 });
  assert.equal(plan[0].tint, '#7fd36b');
  assert.equal(plan[0].colorize, true);
});
