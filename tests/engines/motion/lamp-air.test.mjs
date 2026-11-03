import test from 'node:test';
import assert from 'node:assert/strict';
import { fireSparksOf, MAX_FIRES } from '../../../scripts/engines/motion/lamp-air.mjs';

test('sparks fly from the fires in view, nearest first, never more than the pass can draw', () => {
  const view = { x: 0, y: 0, w: 1000, h: 1000 };
  const lights = [
    { x: 500, y: 500, radius: 400, fire: true }, { x: 900, y: 900, radius: 400, fire: true },
    { x: 5000, y: 5000, radius: 400, fire: true }, { x: 520, y: 520, radius: 400, fire: false },
  ];
  const out = fireSparksOf(lights, view, 100);
  assert.equal(out.length, 2, 'the lamp that is no fire and the fire far away throw none');
  assert.equal(out[0].x, 500, 'nearest the middle first');
  const many = Array.from({ length: 60 }, (_, i) => ({ x: 400 + i, y: 400, radius: 300, fire: true }));
  assert.equal(fireSparksOf(many, view, 100).length, MAX_FIRES);
});
