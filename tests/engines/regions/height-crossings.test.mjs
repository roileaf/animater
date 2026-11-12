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

// Roi: "can we have realistic shadows for the bridge? and also to a leaning ladder\rope against a cliff".
test('a bridge\'s shadow is its planks, each thrown by its own height over the ground; a ladder\'s meets it at the foot', () => {
  const sun = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }, g = fakeG(), sh = fakeG();
  const planks = drawBridge(g, sh, 0, 0, 0, 300, { w: 60, sun, rise: (t) => (t < 0.2 || t > 0.8 ? 0 : 40) });
  const quads = sh.calls.filter(([k]) => k === 'drawPolygon').map(([, a]) => a[0]);
  assert.equal(quads.length, planks, 'one shadow per plank, gaps between');
  const ends = quads.filter((q) => q[1] < 50), mid = quads.filter((q) => q[1] > 120 && q[1] < 180);
  const cx = (q) => (q[0] + q[2] + q[4] + q[6]) / 4; assert.ok(ends.every((q) => Math.abs(cx(q)) < 3) && mid.every((q) => cx(q) > 25), 'none at its ends, pushed off over the low ground');
  const lg = fakeG(), ls = fakeG(); drawLadder(lg, ls, 0, 0, 0, 120, { w: 20, sun, reach: 12 });
  const pts = ls.calls.filter(([k]) => k === 'moveTo' || k === 'lineTo').map(([, a]) => a);
  const foot = pts.filter(([, y]) => y >= 119), top = pts.filter(([, y]) => y <= 6);
  assert.ok(foot.every(([x]) => Math.abs(Math.abs(x) - 10) < 0.5), 'touching at its foot'); assert.ok(top.some(([x]) => x > 15), 'away at its top');
});

test('snow lies on a bridge\'s planks, a ladder\'s rungs and a rope\'s coil; wet wood is darker', () => {
  const snowy = (draw) => { const g = fakeG(), sh = fakeG(); draw(g, sh); return g.calls.filter(([k, a]) => k === 'beginFill' && a[0] === 0xf3f6fb).length; };
  assert.equal(snowy((g, sh) => drawBridge(g, sh, 0, 0, 0, 200, { w: 60 })), 0);
  assert.ok(snowy((g, sh) => drawBridge(g, sh, 0, 0, 0, 200, { w: 60, snow: 1 })) > 10);
  assert.ok(snowy((g, sh) => drawLadder(g, sh, 0, 0, 0, 120, { w: 20, snow: 1 })) > 5);
  assert.equal(snowy((g, sh) => drawRope(g, sh, 0, 0, 10, 100, { snow: 1 })), 1);
  const tone = (wet) => { const g = fakeG(); drawBridge(g, fakeG(), 0, 0, 0, 200, { w: 60, wet }); const f = g.calls.find(([k]) => k === 'beginFill'); return ((f[1][0] >> 16) & 255); };
  assert.ok(tone(1) < tone(0), 'darker wet');
});
