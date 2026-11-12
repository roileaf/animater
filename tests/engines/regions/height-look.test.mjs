import test from 'node:test';
import assert from 'node:assert/strict';
import { cliffColours, faceDepth, layOut, drawCliffRun, footShade, topGlow, castOffset, drawSlope, depthHaze, drawStone, faceFeet, cliffStops, onCliffFace, weatherColours, SNOW } from '../../../scripts/engines/regions/height-look.mjs';
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

test('a wall hangs half its height down the map (2:1), deeper for a bigger drop', () => {
  // Roi: "maybe we should do 2:1?": a face drawn half its height down the map.
  assert.equal(faceDepth(40, 100), 400, 'a 40 ft cliff four squares'); assert.equal(faceDepth(20, 100), 200);
  assert.ok(faceDepth(1, 100) >= 15, 'never a hair'); assert.ok(faceDepth(5000, 100) <= 1200 + 1e-9, 'never past twelve squares');
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

// Roi, of a token walking onto a cliff's painted face from below: "make sure the cliff is not passable on the cliff side".
test('the rock face is walled at its foot, shut to the rim at its ends, none along a thin north lip, and not past the drawn foot', () => {
  const run = mesa(), walls = faceFeet([run], { grid: 100, piece: 25 }), L = layOut(run, { grid: 100 });
  assert.ok(walls.length > 8 && walls.every((w) => w.of === 'P'));
  const ys = walls.flatMap((w) => [w.c[1], w.c[3]]); assert.ok(Math.max(...ys) > 300 + 40, 'below the south rim');
  assert.ok(Math.max(...ys) < Math.max(...L.map((p) => p.fy)), 'inside the drawn foot');
  assert.ok(!walls.some((w) => w.c[1] < 100 - 5 && w.c[3] < 100 - 5), 'none hanging off the north lip');
  const at = run.points.findIndex((p) => p.ny > 0.9), O = { ...run, closed: false, points: run.points.slice(at, at + 30) }, open = faceFeet([O], { grid: 100 });
  assert.ok(open.length >= 2); { const ends = [open[0].c.slice(0, 2), open.at(-1).c.slice(2)], rim = O.points.map((p) => [p.x, p.y]);
    assert.ok(ends.every(([x, y]) => rim.some(([a, b]) => Math.hypot(a - x, b - y) < 6)), 'shut to the rim'); }
});

// Roi: "all non flying animals should know about cliffs and not walk on them like they are ground".
test('a creature on foot never steps up or down a cliff nor onto its face; a slope or a ramp it walks', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'P', height: 20, areas: [sq(100, 100, 300, 300)], open: [{ x: 100, y: 200, r: 40 }] }], ramps: [{ id: 'R', a: { x: 200, y: 450 }, b: { x: 200, y: 280 }, w: 60, kind: 'ramp', lo: null, hi: null }, { id: 'L', a: { x: 280, y: 60 }, b: { x: 280, y: 120 }, w: 30, kind: 'ladder', lo: null, hi: null }] });
  const stops = (a, b) => cliffStops({ field, a, b, grid: 100 });
  assert.ok(stops({ x: 250, y: 90 }, { x: 250, y: 110 }), 'up the north rim');
  assert.ok(stops({ x: 250, y: 290 }, { x: 250, y: 310 }) || stops({ x: 250, y: 330 }, { x: 250, y: 320 }), 'down the south rim, or onto its face');
  assert.ok(stops({ x: 250, y: 500 }, { x: 250, y: 330 }), 'onto the face from below');
  assert.ok(!stops({ x: 250, y: 330 }, { x: 250, y: 500 }), 'off the face');
  assert.ok(!stops({ x: 90, y: 200 }, { x: 110, y: 200 }), 'up an open edge');
  for (let y = 440; y > 290; y -= 5) assert.ok(!stops({ x: 200, y }, { x: 200, y: y - 5 }), `up the ramp at ${y}`);
  assert.ok(stops({ x: 280, y: 70 }, { x: 280, y: 110 }), 'not up a ladder');
  assert.ok(!stops({ x: 500, y: 500 }, { x: 520, y: 500 }), 'level ground');
  assert.ok(stops({ x: 50, y: 250 }, { x: 350, y: 250 }), 'a long look clean over the raised part'); // Roi: "they are getting stuck"
});

test('the ground under a south cliff\'s painted wall is its face; open ground, a top or a ramp is not', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'P', height: 20, areas: [sq(100, 100, 300, 300)] }], ramps: [{ id: 'R', a: { x: 200, y: 450 }, b: { x: 200, y: 280 }, w: 60, kind: 'ramp', lo: null, hi: null }] });
  assert.ok(onCliffFace(field, { x: 250, y: 330 }, { grid: 100 }));
  assert.ok(!onCliffFace(field, { x: 250, y: 600 }, { grid: 100 }) && !onCliffFace(field, { x: 250, y: 200 }, { grid: 100 }) && !onCliffFace(field, { x: 200, y: 330 }, { grid: 100 }));
});

test('a cliff\'s wall is as deep whatever the time of day', () => {
  const run = mesa(), at = (sun) => layOut(run, { grid: 100, sun }).map((p) => p.w);
  assert.deepEqual(at({ x: -1, y: 0 }), at({ x: 1, y: 0 })); assert.deepEqual(at(sun), at(null));
});

// Roi: "lets make heights support weather"; he chose the mock's wet and snowy looks.
test('in the rain the rock is darker with runs down it; under snow a white cap lies on the rim and the ledges, the rock paler', () => {
  const lum = (h) => ((h >> 16) & 255) + ((h >> 8) & 255) + (h & 255), base = cliffColours();
  assert.ok(lum(weatherColours(base, { wet: 1 }).stone) < lum(base.stone) && lum(weatherColours(base, { snow: 1 }).stone) > lum(base.stone));
  assert.equal(weatherColours(base, {}), base, 'dry: as it was');
  const draw = (w) => { const g = fakeG(); drawCliffRun(g, mesa(), { grid: 100, sun, colours: cliffColours(), ...w }); return g.calls; };
  const fills = (calls, c) => calls.filter(([k, a]) => k === 'beginFill' && a[0] === c).length;
  assert.equal(fills(draw({}), SNOW), 0); assert.ok(fills(draw({ snow: 1 }), SNOW) > 20, 'a cap along the rim, snow on the stones');
  const runs = (calls) => calls.filter(([k, a]) => k === 'lineStyle' && a[1] === 0x0a0c12).length;
  assert.equal(runs(draw({})), 0); assert.ok(runs(draw({ wet: 1 })) > 5, 'dark wet runs down the face');
});
