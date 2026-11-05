import test from 'node:test';
import assert from 'node:assert/strict';
import { createGroundTrails } from '../../../scripts/engines/motion/ground-trails.mjs';

const opts = { grid: 100, width: 100, seed: 'b' };

test('stepping in wet blood carries it onto the next floors, in its colour, fading, and water rinses it off', () => {
  let wet = { color: 0x00aa00 };
  const trails = createGroundTrails({ bloodUnder: () => wet }), token = { id: 'b', gait: 'boots' };
  const step = (floor, index) => trails.marks(token, { x: index * 50, y: 0, heading: 0, index }, floor, opts).filter((p) => p.carried === 'blood');
  assert.deepEqual(step('stone', 0), [], 'filling the feet leaves no print yet');
  wet = null;
  const first = step('stone', 1), later = step('stone', 2);
  assert.ok(first.length > 0);
  assert.ok(first.every((p) => p.color === 0x00aa00), 'its own colour');
  assert.ok(later[0].alpha < first[0].alpha, 'fading');
  for (let i = 3; i < 9; i++) step('stone', i);
  assert.deepEqual(step('stone', 9), [], 'worn off');
  wet = { color: 0x00aa00 };
  step('stone', 8);
  wet = null;
  step('water', 9);
  assert.deepEqual(step('stone', 10), [], 'water took over');
});

test('creatures that leave no separate prints carry no blood', () => {
  const trails = createGroundTrails({ bloodUnder: () => ({ color: 1 }) }), token = { id: 's', gait: 'smear' };
  trails.marks(token, { x: 0, y: 0, heading: 0, index: 0 }, 'stone', opts);
  assert.deepEqual(trails.marks(token, { x: 50, y: 0, heading: 0, index: 1 }, 'stone', opts).filter((p) => p.carried), []);
});
