import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skylightShare } from '../../../scripts/engines/motion/cavern.mjs';

// One opening: the square 0–100 on each side.
const opening = [0, 0, 100, 0, 100, 100, 0, 100];
const inside = ({ x, y }, p) => x >= p[0] && x <= p[2] && y >= p[1] && y <= p[5];

test('the pool lights a point under it, softly at its edge, and nothing elsewhere', () => {
  assert.equal(skylightShare({ x: 50, y: 50 }, [opening], [0, 0], { grid: 100, inside }), 1);
  assert.equal(skylightShare({ x: 500, y: 50 }, [opening], [0, 0], { grid: 100, inside }), 0);
  const edge = skylightShare({ x: 100, y: 50 }, [opening], [0, 0], { grid: 100, inside });
  assert.ok(edge > 0 && edge < 1, 'part lit at the edge');
});

test('the pool lies where the light lands, not under the hole', () => {
  assert.equal(skylightShare({ x: 250, y: 50 }, [opening], [200, 0], { grid: 100, inside }), 1, 'landed');
  assert.equal(skylightShare({ x: 50, y: 50 }, [opening], [200, 0], { grid: 100, inside }), 0, 'the floor right under the hole is out of it');
});

test('no openings, no light', () => {
  assert.equal(skylightShare({ x: 50, y: 50 }, [], [0, 0], { grid: 100, inside }), 0);
});
