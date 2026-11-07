import test from 'node:test';
import assert from 'node:assert/strict';
import { squirrelStep, snakeStep } from '../../../scripts/engines/motion/field-life.mjs';

// Bokken's Hut: a squirrel by the map's edge, no tree to run to, bolting from a creature and ending up in the padding.
test('a squirrel racing off with no tree to run to stops at the map\'s edge; a fleeing snake too', () => {
  const within = (x, y) => x > 20 && y > 20 && x < 2000 && y < 2000;
  let s = { x: 120, y: 500, a: 0, mode: 'forage', wait: 2, tree: -1, t: 0, v: 0 };
  for (let i = 0; i < 400; i++) s = squirrelStep(s, { dt: 1 / 60, grid: 100, near: [{ x: 300, y: 500 }], within, trees: [], random: () => 0.5 });
  assert.ok(within(s.x, s.y), `stayed on the map, at ${Math.round(s.x)}, ${Math.round(s.y)}`);
  let n = { x: 60, y: 500, a: -Math.PI / 2, mode: 'lie', wait: 5, t: 0, v: 0 };
  for (let i = 0; i < 400; i++) n = snakeStep(n, { dt: 1 / 60, grid: 100, near: [{ x: 200, y: 500 }], within, random: () => 0.5 });
  assert.ok(within(n.x, n.y), `the snake too, at ${Math.round(n.x)}, ${Math.round(n.y)}`);
});

test('without the map check a racing squirrel does run off: the check is what holds it', () => {
  let s = { x: 120, y: 500, a: 0, mode: 'forage', wait: 2, tree: -1, t: 0, v: 0 };
  for (let i = 0; i < 400; i++) s = squirrelStep(s, { dt: 1 / 60, grid: 100, near: [{ x: 300, y: 500 }], trees: [], random: () => 0.5 });
  assert.ok(s.x < 20, 'it bolts past the edge with nothing to stop it');
});
