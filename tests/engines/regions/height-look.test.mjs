import test from 'node:test';
import assert from 'node:assert/strict';
import { cliffColours, faceDepth, layOut, drawCliffRun, footShade, topGlow, castOffset, drawSlope, depthHaze, drawStone } from '../../../scripts/engines/regions/height-look.mjs';
import { cliffRuns, heightField } from '../../../scripts/engines/regions/heights.mjs';

// Roi's friend, of rock boulders round the rim: "this doesnt look elevated at all"; the friend's "brighter in the middle and
// darker the more you go down"; Roi chose look D: a wall seen from the south, a cast shadow, the top lit, the ground below darker.
const box = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
const fakeG = () => { const calls = []; const g = new Proxy({}, { get: (_, k) => (k === 'calls' ? calls : (...a) => { calls.push([k, a]); return g; }) }); return g; };
const sun = { x: -Math.SQRT1_2, y: -Math.SQRT1_2 }; // from the north-west
const mesa = () => cliffRuns({ field: heightField({ parts: [{ id: 'P', height: 20, areas: [box(100, 100, 300, 300)] }] }), step: 5 })[0];

test('the rock takes the ground\'s colour toward stone; a colour that is no number is none', () => {
  const c = cliffColours(0xc8b088, 0x6a8a3a), lum = (h) => ((h >> 16) & 255) + ((h >> 8) & 255) + (h & 255);
  assert.ok(lum(c.light) > lum(c.stone) && lum(c.dark) < lum(c.stone));
  assert.ok(((c.stone >> 16) & 255) > (c.stone & 255), 'a sandy bank stays warm');
  assert.deepEqual(cliffColours(NaN, NaN), cliffColours());
});

test('a wall is deeper for a bigger drop, so 20, 50 and 110 ft read apart, compressed, never past three squares', () => {
  assert.ok(faceDepth(30, 100) > faceDepth(5, 100)); assert.ok(faceDepth(5000, 100) <= 300 + 1e-9);
  assert.ok(faceDepth(20, 100) > 80 && faceDepth(20, 100) < 120, 'about a square for 20 ft');
  assert.ok(faceDepth(110, 100) > faceDepth(50, 100) * 1.4 && faceDepth(50, 100) > faceDepth(20, 100) * 1.4, 'apart');
  assert.ok(faceDepth(110, 100) < faceDepth(5, 100) * 6, 'compressed');
});

test('the ground far below grows hazier only under a tall cliff', () => {
  assert.equal(depthHaze(5), 0); assert.equal(depthHaze(10), 0); assert.ok(depthHaze(50) > 0.3 && depthHaze(50) < 0.5); assert.equal(depthHaze(300), 1);
  const run = mesa(); assert.ok(footShade(run, { grid: 100, sun, far: 3 }).flat().length === footShade(run, { grid: 100, sun }).flat().length, 'same pieces, reaching further');
});

test('the wall hangs straight down the map: deep where the edge faces south, a thin lip on the north; it tapers where an open cliff ends', () => {
  const run = mesa(), L = layOut(run, { grid: 100, sun });
  const avg = (pred) => { const s = L.filter(pred); return s.reduce((n, p) => n + p.w, 0) / s.length; };
  assert.ok(avg((p) => p.ny > 0.9) > avg((p) => p.ny < -0.9) * 4, 'south deep, north a lip');
  const p = L.find((q) => q.ny > 0.9); assert.ok(p.fy > p.ry && Math.abs(p.fx - p.rx) < 1, 'straight down');
  const O = layOut({ ...run, closed: false, points: run.points.slice(0, 80) }, { grid: 100, sun });
  assert.equal(O[0].w, 0); assert.equal(O.at(-1).w, 0, 'gone at its ends');
});

test('a run draws its wall in columns, streaks, scree and a rim heavier on the south', () => {
  const g = fakeG(), columns = drawCliffRun(g, mesa(), { grid: 100, sun, colours: cliffColours() });
  assert.ok(columns > 100, `columns (${columns})`);
  assert.ok(g.calls.filter(([k]) => k === 'drawPolygon').length >= columns * 3, 'each light, its own, dark at its foot');
  assert.ok(g.calls.some(([k]) => k === 'drawEllipse'), 'scree');
  const inks = g.calls.filter(([k, a]) => k === 'lineStyle' && typeof a[0] === 'object').map(([, a]) => a[0].width);
  assert.ok(Math.max(...inks) > Math.min(...inks) * 1.8, 'the rim heavier on the south');
});

test('the ground below is darker in pieces; the top is lit more the higher it stands; the cast shadow falls away from the sun', () => {
  const run = mesa(), pieces = footShade(run, { grid: 100, sun });
  assert.ok(pieces.length >= run.points.length / 8 && pieces.every((p) => p.length <= 9 * 4));
  assert.ok(topGlow(50) > topGlow(5) && topGlow(500) <= 0.26 && topGlow(110) > topGlow(20) + 0.04);
  const off = castOffset({ height: 20, grid: 100, sun }); assert.ok(off.x > 0 && off.y > 0, 'south-east of a north-west sun');
  assert.ok(Math.hypot(castOffset({ height: 500, grid: 100, sun, sunHeight: 15 }).x, castOffset({ height: 500, grid: 100, sun, sunHeight: 15 }).y) <= 350 + 1e-9, 'never past three and a half squares');
  assert.ok(Math.hypot(castOffset({ height: 110, grid: 100, sun }).x, castOffset({ height: 110, grid: 100, sun }).y) > Math.hypot(castOffset({ height: 20, grid: 100, sun }).x, castOffset({ height: 20, grid: 100, sun }).y) * 1.8, 'longer from a taller cliff');
  const len = (sh) => Math.hypot(castOffset({ height: 20, grid: 100, sun, sunHeight: sh }).x, castOffset({ height: 20, grid: 100, sun, sunHeight: sh }).y);
  assert.ok(len(70) < len(30), 'shorter with the sun high');
  assert.equal(castOffset({ height: 20, grid: 100, sun: null }), null, 'none by night');
});

// Live: a hill's cliff run crossed where its outline starts, and its whole wall went missing (only the rim was drawn).
test('a run crossing where its outline starts still has its wall, tapering only at its own ends', () => {
  const run = mesa(), n = run.points.length, half = Math.floor(n / 2);
  const wrapped = { ...run, closed: false, points: [...run.points.slice(half), ...run.points.slice(0, 40)] };
  const L = layOut(wrapped, { grid: 100, sun });
  assert.ok(L.filter((p) => p.ny > 0.9).some((p) => p.w > 20), 'a wall on its south side');
  assert.equal(L[0].w, 0); assert.equal(L.at(-1).w, 0);
});

// Roi chose B of the slope mock: "will it fix also this transition that doesnt seem to look good or natural...?"
test('a slope is lit warmer facing the sun and darker facing away, rising from inside the top to its edge, gone just past it', () => {
  const field = heightField({ parts: [{ id: 'P', height: 20, areas: [box(100, 100, 300, 300)], open: [{ x: 200, y: 200, r: 300 }] }] });
  const [run] = cliffRuns({ field, step: 5, want: 'slope' }), g = fakeG();
  assert.ok(drawSlope(g, run, { grid: 100, sun }) > 10);
  const fills = g.calls.filter(([k]) => k === 'beginFill');
  assert.ok(fills.some(([, a]) => a[0] === 0xfff1cf) && fills.some(([, a]) => a[0] === 0x0e0905), 'both lit and shaded slopes');
  assert.ok(fills.every(([, a]) => a[1] <= 0.36 + 1e-9));
  const polys = g.calls.filter(([k]) => k === 'drawPolygon').map(([, a]) => a[0]);
  assert.ok(polys.every((p) => p.every((v, i) => (i % 2 ? v > 100 - 20 && v < 300 + 20 : v > 100 - 20 && v < 300 + 20))), 'nothing far outside the edge');
});

test('a loose rock is an angular outline flat at its foot with a lit facet, not a round pebble', () => {
  const g = fakeG(), corners = drawStone(g, 0, 0, 10, { seed: 3, sun });
  assert.ok(corners >= 5 && corners <= 7);
  const outline = g.calls.filter(([k]) => k === 'drawPolygon').map(([, a]) => a[0]); assert.ok(outline.length >= 2, 'outline and a facet');
  const ys = outline[0].filter((_, i) => i % 2); assert.ok(Math.max(...ys) <= 4.5 + 1e-9, 'flat at its foot');
});
