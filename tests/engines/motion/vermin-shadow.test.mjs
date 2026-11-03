import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shadowFrom } from '../../../scripts/engines/motion/vermin.mjs';

test('no light, no shadow', () => {
  assert.equal(shadowFrom(null, { x: 0, y: 0 }), null);
  assert.equal(shadowFrom({ x: 0, y: 0, strength: 0 }, { x: 10, y: 0 }), null);
});

test('a rat\'s shadow lies just beside it, away from the light', () => {
  const s = shadowFrom({ x: 0, y: 0, strength: 1 }, { x: 200, y: 0 }, { grid: 100 });
  assert.ok(s.x > 200 && s.x < 210 && Math.abs(s.y) < 1e-9);
  assert.ok(s.alpha > 0.3);
});

test('a bat\'s shadow falls well away from it, further, bigger and fainter-edged the nearer the light', () => {
  const near = shadowFrom({ x: 0, y: 0, strength: 1 }, { x: 0, y: 100 }, { grid: 100, high: 2 });
  const far = shadowFrom({ x: 0, y: 0, strength: 1 }, { x: 0, y: 400 }, { grid: 100, high: 2 });
  assert.ok(near.y > 100 + 100 && Math.abs(near.x) < 1e-9, 'away from the light');
  assert.ok(near.y - 100 > far.y - 400, 'nearer the light, thrown further');
  assert.ok(near.scale > far.scale);
  assert.ok(near.alpha < 0.32);
});
