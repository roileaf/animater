import test from 'node:test';
import assert from 'node:assert/strict';
import { plank, drawLadder, drawRope, drawBridge, wood, hemp } from '../../../scripts/engines/regions/height-crossings.mjs';

// Roi: "can we also add option to put ladders/ropes/bridges?"; of the first mock, "too cartoony"; then "Build them".
const fakeG = () => { const calls = []; const g = new Proxy({}, { get: (_, k) => (k === 'calls' ? calls : (...a) => { calls.push([k, a]); return g; }) }); return g; };
const lum = (h) => ((h >> 16) & 255) + ((h >> 8) & 255) + (h & 255);

test('wood and rope are muted and dark, not bright tan', () => {
  assert.ok(lum(wood(1)) < 3 * 140 && lum(hemp(1)) < 3 * 150);
  assert.ok(lum(wood(0)) < lum(wood(1)), 'its underside darker');
});

test('a ladder has uneven rungs with one gone, two rails, and a shadow drawn apart', () => {
  const g = fakeG(), sh = fakeG(), rungs = drawLadder(g, sh, 0, 0, 0, 120, { w: 20 });
  const steps = []; let t = 8, i = 0; while (t < 117) { steps.push(i); t += 9; i++; }
  assert.ok(rungs >= 6 && rungs < steps.length, `rungs (${rungs}), one missing`);
  assert.ok(sh.calls.length > 0, 'its shadow');
});

test('a rope sags from a stake to a loose coil; a bridge has uneven planks, one gone, rails and posts', () => {
  const g = fakeG(), sh = fakeG(); drawRope(g, sh, 0, 0, 10, 100);
  assert.ok(g.calls.filter(([k]) => k === 'drawEllipse').length >= 2, 'the stake');
  assert.ok(g.calls.some(([k]) => k === 'quadraticCurveTo'));
  const b = fakeG(), bs = fakeG(), planks = drawBridge(b, bs, 0, 0, 200, 0, { w: 30, drop: 20 });
  assert.ok(planks > 15, `planks (${planks})`);
  assert.ok(bs.calls.some(([k]) => k === 'drawPolygon'), 'its shadow on the ground');
  const p = fakeG(); plank(p, 0, 0, 10, 0, 4, 1, { x: -0.7, y: -0.7 });
  assert.ok(p.calls.filter(([k]) => k === 'drawPolygon').length >= 3, 'underside, lit side, ink');
});
