import test from 'node:test';
import assert from 'node:assert/strict';
import { pathRegion, pathPieces, pathShapes, tidyLine, smoothLine, flowAlong, pathWideOf, PATH_KINDS, PATH_IDS } from '../../../scripts/engines/mapbuild/path-lay.mjs';
import { DECOR_KINDS, bakedLean, runSpan, seeded, paintSeedOf } from '../../../scripts/engines/motion/decor-paint.mjs';
import { decorSettings } from '../../../scripts/engines/motion/decor-regions.mjs';
import { turnOf } from '../../../scripts/engines/motion/decorations.mjs';

// Roi: "the fence decoration is only single part maybe we need a path tool of some sort". A fence was one stamp two
// squares long, dropped at a random spot in the brush and leaning its own way, kept apart from the next: fences came
// out as scattered hurdles. A path is a line; what is laid along it follows it.
const own = (region) => region.flags.animater;
const near = (a, b, by = 1e-6) => Math.abs(a - b) <= by;

test('a drawn line is tidied, and smoothing keeps its ends where they were', () => {
  assert.deepEqual(tidyLine([{ x: 0, y: 0 }, { x: 1, y: 1 }, [100, 0], [100, 0], [NaN, 3], [200, 0]], 4), [[0, 0], [100, 0], [200, 0]]);
  const smooth = smoothLine([[0, 0], [100, 0], [100, 100]]);
  assert.deepEqual(smooth[0], [0, 0]); assert.deepEqual(smooth.at(-1), [100, 100]);
  assert.ok(smooth.length > 8 && !smooth.some((p) => p[0] === 100 && p[1] === 0), 'the corner is rounded off');
});

test('a road is a painted floor as wide as asked, along the line', () => {
  const road = pathRegion('road', [[0, 500], [1000, 500]], { grid: 100, wide: 2, levelId: 'L1' });
  assert.equal(own(road).floor, 'dirt'); assert.deepEqual(own(road).textureStyles, { dirt: 'road' }); assert.equal(own(road).texture, 'on'); assert.equal(own(road).stepEdge, 0.6);
  assert.equal(own(road).path, 'road'); assert.deepEqual(road.levels, ['L1']);
  const ys = road.shapes[0].points.filter((_, i) => i % 2);
  assert.equal(Math.max(...ys) - Math.min(...ys), 200, 'two squares wide');
  assert.equal(pathRegion('road', [[0, 0], [1000, 0]]).shapes[0].type, 'polygon');
  assert.equal(pathWideOf('road', null), PATH_KINDS.road.wide); assert.equal(pathWideOf('road', 99), 8); assert.equal(pathWideOf('fence', 99), 2);
});

test('a path with sharp corners is a box a leg and a round at each corner', () => {
  const shapes = pathShapes([[0, 0], [500, 0], [500, 500]], 100, false);
  assert.deepEqual(shapes.map((s) => s.type), ['polygon', 'polygon', 'ellipse']);
  assert.deepEqual([shapes[2].x, shapes[2].y, shapes[2].radiusX], [500, 0, 50]);
});

test('a stream is moving water that runs the way it was drawn', () => {
  const stream = pathRegion('stream', [[1000, 0], [1100, 800], [1000, 2000]], { grid: 100 });
  assert.equal(own(stream).floor, 'water'); assert.equal(own(stream).waterKind, 'river'); assert.equal(own(stream).flowTo, 's');
  assert.equal(flowAlong([[0, 0], [500, 0]]), 'e'); assert.equal(flowAlong([[500, 500], [0, 0]]), 'nw'); assert.equal(flowAlong([[0, 500], [0, 0]]), 'n');
  assert.equal(own(pathRegion('boardwalk', [[0, 0], [600, 0]])).overWater, true, 'a boardwalk stands over the water it crosses');
  assert.equal(own(pathRegion('boardwalk', [[0, 0], [600, 0]])).stepEdgeOff, true);
});

test('a fence is laid end post on end post, each piece standing in line', () => {
  const pieces = pathPieces('fence', [[0, 0], [1000, 0]], { grid: 100, seed: 5 });
  const step = DECOR_KINDS.fence.size * runSpan('fence') * 100;
  assert.equal(pieces.length, Math.round(1000 / step));
  for (const [i, d] of pieces.entries()) {
    assert.equal(d.kind, 'fence'); assert.equal(d.fixed, true); assert.equal(d.y, 0);
    assert.ok(near(d.turn + bakedLean(d), 0), 'turned back by the lean its picture was painted with');
    assert.equal(turnOf(d), d.turn, 'and the painter turns it exactly so, not by the little a crate gets');
    if (i) assert.ok(Math.abs((d.x - pieces[i - 1].x) - d.size * runSpan('fence') * 100) <= 1, 'the next begins where this ends');
  }
  assert.ok(Math.abs(pieces[0].x - (pieces[0].size * runSpan('fence') * 100) / 2) <= 1, 'the first post is on the line\'s start');
  assert.ok(new Set(pieces.map((d) => d.seed)).size === pieces.length);
});

test('the lean a run undoes is the one the painter draws', () => {
  const d = { kind: 'fence', seed: 12345 };
  assert.equal(bakedLean(d), (seeded(paintSeedOf(d))() - 0.5) * 0.3);
  assert.equal(bakedLean({ kind: 'stakeFence', seed: 9 }), (seeded(paintSeedOf({ kind: 'stakeFence', seed: 9 }))() - 0.5) * 0.4);
  assert.equal(bakedLean({ kind: 'crate', seed: 9 }), 0); assert.equal(runSpan('fence'), 0.9); assert.equal(runSpan('stakeFence'), 0.85); assert.equal(runSpan('crate'), 0.9);
});

test('a fence turns at its corners and meets itself there', () => {
  const pieces = pathPieces('stakeFence', [[0, 0], [600, 0], [600, 500]], { grid: 100, seed: 2 });
  const along = pieces.filter((d) => near(d.turn + bakedLean(d), 0)), down = pieces.filter((d) => near(d.turn + bakedLean(d), Math.PI / 2));
  assert.ok(along.length >= 3 && down.length >= 2 && along.length + down.length === pieces.length);
  const last = along.at(-1), first = down[0], half = (d) => (d.size * runSpan('stakeFence') * 100) / 2;
  assert.ok(Math.abs(last.x + half(last) - 600) <= 1, 'the first leg ends on the corner');
  assert.ok(Math.abs(first.y - half(first)) <= 1 && first.x === 600, 'and the second starts on it');
});

test('a hedge follows the line wherever it bends', () => {
  const line = [[0, 0], [500, 0], [500, 500], [1000, 500]];
  const pieces = pathPieces('hedge', line, { grid: 100, seed: 3 });
  assert.ok(pieces.length > 12 && pieces.every((d) => d.kind === 'bush'));
  assert.ok(!pieces.some((d) => d.x === 500 && d.y === 0), 'round the corner, not into it');
  assert.ok(pieces.length < pathPieces('hedge', line, { grid: 100, seed: 3, scale: 0.5 }).length, 'smaller bushes, more of them');
});

test('a laid path is a decorations region of its own, small enough to pick up and move', () => {
  const fence = pathRegion('fence', [[100, 100], [900, 100]], { grid: 100, seed: 4 });
  const decor = decorSettings(own(fence).decor);
  assert.equal(decor.density, 0, 'nothing scattered: only what was laid');
  assert.equal(decor.brushed.length, own(fence).decor.brushed.length); assert.ok(decor.brushed.every((d) => d.fixed === true), 'the region keeps each piece turned as it was laid');
  assert.equal(own(fence).path, 'fence');
  const ys = fence.shapes.flatMap((s) => (s.points ?? []).filter((_, i) => i % 2));
  assert.ok(Math.min(...ys) < 0 && Math.max(...ys) > 200 && Math.max(...ys) < 400, 'a strip round the fence, not the whole map');
  assert.ok(own(pathRegion('fence', Array.from({ length: 80 }, (_, i) => [i * 2000, (i % 2) * 2000]), { grid: 100 })).decor.brushed.length <= 600);
});

test('too short a line is no path, and every kind lays something', () => {
  assert.equal(pathRegion('road', [[5, 5]]), null); assert.equal(pathRegion('fence', [[5, 5], [5, 5]]), null); assert.equal(pathRegion('road', []), null);
  assert.equal(own(pathRegion('nonsense', [[0, 0], [500, 0]])).path, 'nonsense'.length ? 'nonsense' : '');
  assert.equal(own(pathRegion('nonsense', [[0, 0], [500, 0]])).floor, 'dirt', 'an unknown kind is a road');
  for (const id of PATH_IDS) { const region = pathRegion(id, [[0, 0], [400, 100], [900, 0]], { grid: 100 }); assert.ok(region?.shapes.length, id); assert.ok(own(region).floor || own(region).decor.brushed.length, id); }
});
