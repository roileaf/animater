import test from 'node:test';
import assert from 'node:assert/strict';
import { readOpenEdges, openAt, edgeTouches, cliffRuns, walkerPath, simplifyLoop, readHeight, readRamp, heightField, walkerElevation, nextHeight, rampFromDrag, rampOutline, heightRegionData, rampRegionData, cliffEdges, shadowOffset, heightsHoverLine, carryHeights, refitHeights } from '../../../scripts/engines/regions/heights.mjs';

// Roi: "regarding our map building brush, can you think of a cool and smart way to define paths and elevated parts?", then
// "Build it" from the heights and ramps mock: walkers only take the ground's height, raised parts cast a shadow, cliff edges
// with no ramp block movement.
const box = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
const shelf = { id: 'S', height: 15, areas: [box(100, 100, 300, 300)] };
const rock = { id: 'R', height: 20, areas: [box(150, 150, 200, 200)] };
// A ramp from the floor at x 360 up onto the shelf at x 260, 40 wide, along y 250.
const ramp = { id: 'P', a: { x: 360, y: 250 }, b: { x: 260, y: 250 }, w: 40 };
const field = () => heightField({ parts: [shelf, rock], ramps: [ramp] });

test('a region is raised by its height flag, and a ramp is read from its own', () => {
  assert.equal(readHeight({ height: 15 }), 15);
  assert.equal(readHeight({ height: 0 }), null); assert.equal(readHeight({}), null); assert.equal(readHeight({ height: 'x' }), null);
  assert.deepEqual(readRamp({ ramp: { ax: 1, ay: 2, bx: 3, by: 4, w: 5 } }), { a: { x: 1, y: 2 }, b: { x: 3, y: 4 }, w: 5, kind: 'ramp', lo: null, hi: null });
  assert.equal(readRamp({ ramp: { ax: 1, ay: 2, bx: 1, by: 2, w: 5 } }), null, 'no length');
  assert.equal(readRamp({}), null);
});

test('the ground stands at the highest raised part under a point; a ramp climbs from its low end to its high end', () => {
  const f = field();
  assert.equal(f.groundAt({ x: 50, y: 50 }), 0);
  assert.equal(f.groundAt({ x: 120, y: 120 }), 15);
  assert.equal(f.groundAt({ x: 175, y: 175 }), 20, 'the rock on the shelf');
  assert.equal(f.heightAt({ x: 310, y: 250 }), 7.5, 'half way up the ramp');
  assert.equal(f.heightAt({ x: 310, y: 300 }), 0, 'beside the ramp');
  assert.deepEqual(f.rampEnds(ramp), [0, 15]);
});

test('a walker takes the ground where it arrives; a flier keeps its height', () => {
  const f = field();
  assert.equal(walkerElevation({ elevation: 0, from: { x: 50, y: 50 }, to: { x: 120, y: 120 }, field: f }), 15);
  assert.equal(walkerElevation({ elevation: 15, from: { x: 120, y: 120 }, to: { x: 50, y: 50 }, field: f }), 0);
  assert.equal(walkerElevation({ elevation: 0, from: { x: 50, y: 50 }, to: { x: 310, y: 250 }, field: f }), 7.5, 'onto the ramp');
  assert.equal(walkerElevation({ elevation: 30, from: { x: 50, y: 50 }, to: { x: 120, y: 120 }, field: f }), null, 'flying');
  assert.equal(walkerElevation({ elevation: 0, from: { x: 120, y: 120 }, to: { x: 175, y: 175 }, field: f }), 20, 'a token left on the floor under a part climbs when it moves');
  assert.equal(walkerElevation({ elevation: 0, from: { x: 50, y: 50 }, to: { x: 60, y: 60 }, field: f }), null, 'nothing changes');
  assert.equal(walkerElevation({ elevation: 10, from: { x: 50, y: 50 }, to: { x: 120, y: 120 }, field: f, base: 10 }), 25, 'over the level\'s floor');
});

test('the wheel steps a height by the grid\'s distance, never under one step', () => {
  assert.equal(nextHeight(15, true), 20); assert.equal(nextHeight(15, false), 10); assert.equal(nextHeight(5, false), 5);
  assert.equal(nextHeight(0, true, 10), 10); assert.equal(nextHeight(12, true), 15, 'onto the step');
});

test('a ramp is dragged up across an edge, either way round; flat or short drags make none', () => {
  const f = heightField({ parts: [shelf] });
  assert.deepEqual(rampFromDrag({ a: { x: 360, y: 250 }, b: { x: 260, y: 250 }, w: 40, field: f }), { a: { x: 360, y: 250 }, b: { x: 260, y: 250 }, w: 40, kind: 'ramp' });
  assert.deepEqual(rampFromDrag({ a: { x: 260, y: 250 }, b: { x: 360, y: 250 }, w: 40, field: f }).a, { x: 360, y: 250 }, 'turned to climb');
  assert.equal(rampFromDrag({ a: { x: 360, y: 250 }, b: { x: 400, y: 250 }, w: 40, field: f }), null, 'flat');
  assert.equal(rampFromDrag({ a: { x: 305, y: 250 }, b: { x: 295, y: 250 }, w: 40, field: f }), null, 'too short');
  assert.deepEqual(rampOutline({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, w: 4 }), [0, 2, 10, 2, 10, -2, 0, -2]);
});

test('raised parts and ramps are regions of their own, on the level painted', () => {
  const d = heightRegionData({ shapes: [{ type: 'polygon', points: box(0, 0, 10, 10), hole: false }], height: 15, levelId: 'L1' });
  assert.equal(d.name, 'Raised 15 ft'); assert.deepEqual(d.levels, ['L1']); assert.deepEqual(d.flags, { animater: { height: 15 } });
  const r = rampRegionData({ a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, w: 40 });
  assert.equal(r.name, 'Ramp'); assert.deepEqual(r.flags.animater.ramp, { ax: 0, ay: 0, bx: 100, by: 0, w: 40 }); assert.equal(r.shapes[0].points.length, 8);
  assert.deepEqual(readRamp(r.flags.animater), { a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, w: 40, kind: 'ramp', lo: null, hi: null });
});

test('cliff edges run round each raised part, its own, and open where a ramp meets them', () => {
  const plain = cliffEdges({ field: heightField({ parts: [shelf] }) });
  assert.ok(plain.length >= 4 && plain.every((e) => e.of === 'S'));
  const length = (edges) => edges.reduce((s, e) => s + Math.hypot(e.c[2] - e.c[0], e.c[3] - e.c[1]), 0);
  assert.ok(Math.abs(length(plain) - 800) < 1, 'the whole outline');
  const all = cliffEdges({ field: field() });
  assert.ok(all.some((e) => e.of === 'R') && all.some((e) => e.of === 'S'), 'the rock owns its own edge');
  const east = all.filter((e) => e.of === 'S' && e.c[0] === 300 && e.c[2] === 300);
  assert.ok(east.length === 2, 'the east edge is cut where the ramp meets it');
  assert.ok(!east.some((e) => Math.min(e.c[1], e.c[3]) < 250 && Math.max(e.c[1], e.c[3]) > 250), 'open at the ramp');
  assert.ok(Math.abs(length(east) - 150) < 30, 'only about the ramp\'s width open');
  assert.deepEqual(cliffEdges({ field: heightField({ parts: [shelf] }), gap: 20 }), [], 'too small a step to block');
});

test('a raised part\'s shadow falls away from the sun, longer for higher ground and a lower sun', () => {
  const at = (height, sunHeight) => shadowOffset({ height, sun: { angle: -135, height: sunHeight }, pxPerUnit: 20 });
  const s = at(15, 45);
  assert.ok(s.x > 0 && s.y > 0, 'a sun in the north-west throws it south-east');
  assert.ok(Math.abs(Math.hypot(s.x, s.y) - 300) < 1e-6, '15 ft × 20 px at 45°');
  assert.ok(Math.hypot(at(15, 20).x, at(15, 20).y) > 300 && Math.hypot(at(5, 45).x, at(5, 45).y) < 300);
  assert.equal(shadowOffset({ height: 15, sun: null, pxPerUnit: 20 }), null);
  assert.ok(Math.hypot(shadowOffset({ height: 15, sun: { angle: 0, height: 5 }, pxPerUnit: 20, most: 100 }).x, 0) <= 100);
});

test('hovering on Heights says what is under the pointer and what a click or the wheel does there', () => {
  const f = field();
  // (Roi: "it doesnt let me raise the ground with a brush". Raise is a brush now.)
  assert.equal(heightsHoverLine({ field: f, at: { x: 120, y: 120 } }), 'Over: raised 15 ft · a stroke grows it, the wheel raises or lowers it, Shift-drag rubs it out, Alt-drag along its edge opens it');
  assert.equal(heightsHoverLine({ field: f, at: { x: 50, y: 50 } }), 'Over: the floor · drag to raise it a step · Alt-drag along a raised edge opens it');
  assert.equal(heightsHoverLine({ field: f, at: { x: 310, y: 250 } }), 'Over: ramp 0 ft → 15 ft · here 7.5 ft · Shift-click removes it');
  assert.equal(heightsHoverLine({ field: f, at: { x: 50, y: 50 }, mode: 'ramp' }), 'Over: the floor · drag up across a raised edge to make a ramp');
});

// Live, a rock clicked on a real map traced pixel by pixel made a hundred walls of 5 px each.
test('a traced outline\'s pixel steps are smoothed before its walls are made', () => {
  const steps = []; for (let i = 0; i < 40; i++) steps.push(i * 5, i * 5, i * 5 + 5, i * 5); // a staircase from (0,0) to (200,200)
  const loop = [...steps, 200, 200, 0, 200];
  const flat = simplifyLoop(loop, 8);
  assert.ok(flat.length / 2 <= 4, `a staircase is one slope (${flat.length / 2} corners)`);
  assert.deepEqual(simplifyLoop(box(0, 0, 10, 10), 8), box(0, 0, 10, 10), 'four corners stay');
  const part = { id: 'T', height: 10, areas: [loop] };
  assert.ok(cliffEdges({ field: heightField({ parts: [part] }), piece: 1000, smooth: 8 }).length <= 4);
  assert.ok(cliffEdges({ field: heightField({ parts: [part] }), piece: 1000 }).length > 40, 'unsmoothed, a wall per step');
});

// Live: an elevation set in preUpdateToken was dropped (the move is fixed by then), so each waypoint gets the ground's height.
test('along a move\'s waypoints a walker climbs the ramp step by step; a flier keeps its own', () => {
  const f = field();
  assert.deepEqual(walkerPath({ elevation: 0, from: { x: 400, y: 250 }, path: [{ x: 360, y: 250 }, { x: 310, y: 250 }, { x: 250, y: 250 }], field: f }), [0, 7.5, 15]);
  assert.equal(walkerPath({ elevation: 40, from: { x: 400, y: 250 }, path: [{ x: 250, y: 250 }], field: f }), null);
});

// Roi: "what if it's raised only from one side?" A cliff shows only where the ground drops.
test('a raised part shows a cliff only where the ground just outside is lower: not against ground as high, a ramp, or the map\'s edge', () => {
  const runsOf = (o) => cliffRuns({ step: 5, ...o });
  const all = runsOf({ field: heightField({ parts: [shelf] }) });
  assert.equal(all.length, 1); assert.equal(all[0].closed, true, 'an island: the whole way round');
  assert.ok(all[0].points.every((p) => Math.hypot(p.nx, p.ny) > 0.99), 'outward normals');
  const east = all[0].points.find((p) => p.x === 300 && p.y > 150 && p.y < 250); assert.ok(east && east.nx > 0.9, 'pointing off the part');
  // A terrace: the shelf against a 15 ft bank on its east, so its east side meets ground as high.
  const bank = { id: 'B', height: 15, areas: [box(300, 50, 500, 350)] };
  const terrace = runsOf({ field: heightField({ parts: [shelf, bank] }) }).filter((r) => r.of === 'S');
  assert.ok(terrace.length >= 1 && terrace.every((r) => !r.closed));
  assert.ok(!terrace.some((r) => r.points.some((p) => p.x === 300 && p.y > 110 && p.y < 290)), 'no cliff where it meets ground as high');
  // Off the map on the west: no cliff there either.
  const edge = runsOf({ field: heightField({ parts: [shelf] }), bounds: { x: 100, y: 0, width: 600, height: 600 } });
  assert.ok(!edge.some((r) => r.points.some((p) => p.x === 100 && p.y > 110 && p.y < 290)), 'the map\'s edge counts as level');
  // A ramp across the east edge: open there.
  const ramped = runsOf({ field: field() }).filter((r) => r.of === 'S');
  assert.ok(!ramped.some((r) => r.points.some((p) => p.x === 300 && Math.abs(p.y - 250) < 12)), 'open where the ramp meets it');
  assert.ok(runsOf({ field: field() }).some((r) => r.of === 'R'), 'the rock on the shelf has its own');
  assert.equal(cliffEdges({ field: heightField({ parts: [shelf] }), bounds: { x: 100, y: 0, width: 600, height: 600 } }).some((e) => e.c[0] === 100 && e.c[2] === 100), false, 'and no wall along the map\'s edge');
});

// Roi: "can we also add option to put ladders/ropes/bridges?", then "Build them" from the mock.
test('crossings: ladders and ropes climb as a ramp does, a bridge is walked only from its own height', () => {
  assert.equal(readRamp({ ramp: { ax: 0, ay: 0, bx: 10, by: 0, w: 5, kind: 'ladder' } }).kind, 'ladder');
  assert.equal(readRamp({ ramp: { ax: 0, ay: 0, bx: 10, by: 0, w: 5, kind: 'boat' } }).kind, 'ramp', 'an unknown kind is a ramp');
  assert.deepEqual([readRamp({ ramp: { ax: 0, ay: 0, bx: 10, by: 0, w: 5, lo: 3, hi: '' } }).lo, readRamp({ ramp: { ax: 0, ay: 0, bx: 10, by: 0, w: 5, lo: 3, hi: '' } }).hi], [3, null], 'ends set by hand');
  const west = { id: 'W', height: 15, areas: [box(0, 0, 100, 200)] }, east = { id: 'E', height: 15, areas: [box(300, 0, 400, 200)] };
  const span = { id: 'X', a: { x: 90, y: 100 }, b: { x: 310, y: 100 }, w: 40, kind: 'bridge', lo: null, hi: null };
  const f = heightField({ parts: [west, east], ramps: [span] });
  assert.equal(f.heightAt({ x: 200, y: 100 }), 15, 'on the bridge');
  assert.equal(f.heightAt({ x: 200, y: 100 }, 0), 0, 'under it, from the ground');
  assert.deepEqual(walkerPath({ elevation: 15, from: { x: 50, y: 100 }, path: [{ x: 150, y: 100 }, { x: 250, y: 100 }, { x: 350, y: 100 }], field: f }), [15, 15, 15], 'across it');
  assert.deepEqual(walkerPath({ elevation: 0, from: { x: 200, y: 300 }, path: [{ x: 200, y: 100 }, { x: 200, y: -50 }], field: f }), [0, 0], 'under it');
  assert.deepEqual(rampFromDrag({ a: { x: 90, y: 100 }, b: { x: 310, y: 100 }, w: 40, field: heightField({ parts: [west, east] }), kind: 'bridge' }), { a: { x: 90, y: 100 }, b: { x: 310, y: 100 }, w: 40, kind: 'bridge' }, 'between equal heights');
  assert.equal(rampFromDrag({ a: { x: 150, y: 300 }, b: { x: 250, y: 300 }, w: 40, field: heightField({ parts: [west, east] }), kind: 'bridge' }), null, 'over nothing raised');
  const ladder = { id: 'L', a: { x: 150, y: 100 }, b: { x: 90, y: 100 }, w: 20, kind: 'ladder', lo: null, hi: null };
  assert.equal(heightField({ parts: [west], ramps: [ladder] }).heightAt({ x: 120, y: 100 }), 7.5, 'half way up the ladder');
  assert.equal(heightField({ parts: [west], ramps: [{ ...ladder, lo: 5 }] }).rampEnds({ ...ladder, lo: 5 })[0], 5, 'an end set by hand wins');
  assert.equal(rampRegionData({ a: { x: 0, y: 0 }, b: { x: 10, y: 0 }, w: 4, kind: 'rope' }).name, 'Rope');
});

// Roi: "how do i make a semi cliff so it's not closed from all sides??", then "Yes, add it": open edges painted on its rim.
test('an open edge takes the cliff and its walls off that stretch of a raised part\'s rim', () => {
  assert.deepEqual(readOpenEdges({ openEdges: [[300, 200, 30], ['x', 1, 2], [1, 2, 0]] }), [{ x: 300, y: 200, r: 30 }]);
  const open = { ...shelf, open: [{ x: 300, y: 200, r: 40 }] };
  assert.ok(openAt(open, { x: 300, y: 210 }) && !openAt(open, { x: 100, y: 100 }));
  assert.ok(edgeTouches(shelf, { x: 300, y: 200, r: 10 }) && !edgeTouches(shelf, { x: 200, y: 200, r: 10 }), 'only where its outline passes');
  const runs = cliffRuns({ field: heightField({ parts: [open] }), step: 5 });
  assert.ok(runs.length === 1 && !runs[0].closed, 'no longer all the way round');
  assert.ok(!runs[0].points.some((p) => openAt(open, p)), 'no cliff inside the open edge');
  assert.ok(!cliffEdges({ field: heightField({ parts: [open] }), piece: 10 }).some((e) => openAt(open, { x: (e.c[0] + e.c[2]) / 2, y: (e.c[1] + e.c[3]) / 2 })), 'nor walls');
});

// Roi chose B of the slope mock for open sides: the ground darkening as it falls away. Those stretches are the slope runs.
test('the slope runs are a raised part\'s open stretches where the ground drops', () => {
  const open = { ...shelf, open: [{ x: 300, y: 200, r: 40 }] };
  const slopes = cliffRuns({ field: heightField({ parts: [open] }), step: 5, want: 'slope' });
  assert.equal(slopes.length, 1); assert.ok(slopes[0].points.every((p) => openAt(open, p)));
  assert.deepEqual(cliffRuns({ field: heightField({ parts: [shelf] }), step: 5, want: 'slope' }), [], 'none without open edges');
});

test('dragging a crossing moves its ends, dragging a raised part its open edges; nothing when it did not move', () => {
  const out = carryHeights({ ramp: { ax: 0, ay: 0, bx: 100, by: 0, w: 50, kind: 'bridge' }, openEdges: [[10, 10, 30]] }, 200, -50);
  assert.deepEqual(out.ramp, { ax: 200, ay: -50, bx: 300, by: -50, w: 50, kind: 'bridge' });
  assert.deepEqual(out.openEdges, [[210, -40, 30]]);
  assert.deepEqual(carryHeights({ height: 20 }, 10, 0), {}); assert.deepEqual(carryHeights({ ramp: { ax: 0, ay: 0, bx: 1, by: 1 } }, 0, 0), {});
});

test('stretching a crossing\'s region stretches the crossing to fill it; a drag only moves it', () => {
  const own = { ramp: { ax: 100, ay: 50, bx: 300, by: 50, w: 60, kind: 'bridge' } };
  const out = refitHeights(own, { x: 100, y: 20, w: 200, h: 60 }, { x: 0, y: 0, w: 400, h: 120 });
  assert.deepEqual(out.ramp, { ax: 0, ay: 60, bx: 400, by: 60, w: 120, kind: 'bridge' });
  assert.deepEqual(refitHeights(own, { x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 0, w: 10, h: 10 }).ramp.ax, 105);
  assert.deepEqual(refitHeights(own, { x: 0, y: 0, w: 10, h: 10 }, { x: 0, y: 0, w: 10, h: 10 }), {});
});

// Roi, of a ladder cut through a cliff: "why the hell ladder breaks the cliff?" A ladder or rope climbs the face; a ramp replaces it.
test('drawn with climbs, a ladder or rope leaves the cliff whole; a ramp still cuts it; the walls open at all three', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1], part = { id: 'P', height: 20, areas: [sq(100, 100, 300, 300)] };
  const runsWith = (kind, climbs) => cliffRuns({ field: heightField({ parts: [part], ramps: [{ id: 'L', a: { x: 200, y: 360 }, b: { x: 200, y: 260 }, w: 40, kind, lo: null, hi: null }] }), step: 5, climbs });
  for (const kind of ['ladder', 'rope']) { const r = runsWith(kind, true); assert.equal(r.length, 1); assert.ok(r[0].closed, kind); assert.ok(!runsWith(kind, false)[0].closed, 'walls open'); }
  assert.ok(!runsWith('ramp', true)[0].closed, 'a ramp still cuts it');
});

// Roi: "tokens should be able to walk UNDER bridges". Under a bridge's end the cliff and its wall stay, marked with the bridge's height.
test('a bridge over a rim keeps its cliff drawn and its wall, marked with the bridge\'s height, so the ground under it does not lead up', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'N', height: 10, areas: [sq(0, 0, 400, 200)] }, { id: 'S', height: 10, areas: [sq(0, 400, 400, 600)] }], ramps: [{ id: 'B', a: { x: 200, y: 150 }, b: { x: 200, y: 450 }, w: 60, kind: 'bridge', lo: null, hi: null }] });
  const edges = cliffEdges({ field, piece: 25 }), tagged = edges.filter((e) => e.bridge !== undefined);
  assert.ok(tagged.length >= 2 && tagged.every((e) => e.bridge === 10), 'both ends, at the bridge\'s height');
  assert.ok(tagged.every((e) => Math.min(e.c[0], e.c[2]) >= 160 && Math.max(e.c[0], e.c[2]) <= 240), 'only the stretch under it');
  assert.ok(edges.some((e) => e.bridge === undefined && e.c[1] === 200), 'the rest plain');
  const runs = cliffRuns({ field, step: 5 }).filter((r) => r.of === 'N');
  assert.ok(runs.some((r) => r.points.some((p) => Math.abs(p.x - 200) < 5 && Math.abs(p.y - 200) < 3)), 'drawn on under the bridge');
});

test('a sloping bridge marks both its ends with its lower end\'s height, so one who stepped on at the low end walks off the high one', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'N', height: 15, areas: [sq(0, 0, 400, 200)] }, { id: 'S', height: 5, areas: [sq(0, 400, 400, 600)] }], ramps: [{ id: 'B', a: { x: 200, y: 450 }, b: { x: 200, y: 150 }, w: 60, kind: 'bridge', lo: null, hi: null }] });
  const tagged = cliffEdges({ field, piece: 25 }).filter((e) => e.bridge !== undefined);
  assert.ok(tagged.some((e) => e.of === 'N') && tagged.every((e) => e.bridge === 5), JSON.stringify(tagged.map((e) => [e.of, e.bridge])));
});

test('one long drag up a sloping bridge stays on it the whole way, while one walking under it stays on the ground', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'N', height: 20, areas: [sq(0, 0, 400, 200)] }, { id: 'S', height: 5, areas: [sq(0, 600, 400, 800)] }], ramps: [{ id: 'B', a: { x: 200, y: 650 }, b: { x: 200, y: 150 }, w: 100, kind: 'bridge', lo: null, hi: null }] });
  const up = walkerPath({ elevation: 5, from: { x: 200, y: 640 }, path: [{ x: 200, y: 400 }, { x: 200, y: 160 }], field });
  assert.ok(up[0] > 8 && up[1] >= 19, JSON.stringify(up));
  assert.deepEqual(walkerPath({ elevation: 0, from: { x: 50, y: 400 }, path: [{ x: 350, y: 400 }], field }), [0]);
});

// Live: a ladder under a bridge carried a token walking down the bridge to the ground. Roi: "working for going up a bridge not down".
test('walking down a bridge with a ladder under it keeps to the bridge; from the ground the ladder still climbs', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'N', height: 20, areas: [sq(0, 0, 400, 200)] }], ramps: [
    { id: 'L', a: { x: 200, y: 420 }, b: { x: 200, y: 180 }, w: 60, kind: 'ladder', lo: null, hi: null },
    { id: 'B', a: { x: 200, y: 800 }, b: { x: 200, y: 180 }, w: 200, kind: 'bridge', lo: null, hi: null }] });
  const down = walkerPath({ elevation: 20, from: { x: 200, y: 150 }, path: [{ x: 200, y: 500 }, { x: 200, y: 790 }], field });
  assert.ok(down[0] > 7 && down[0] < 12 && down[1] < 2, JSON.stringify(down));
  const up = walkerPath({ elevation: 0, from: { x: 200, y: 440 }, path: [{ x: 200, y: 150 }], field }); assert.equal(up[0], 20);
});

// Roi: "we need another toggle for cliff or hill".
test('a hill is a slope on every side: no cliff edges nor walls, only slopes', () => {
  const sq = (x0, y0, x1, y1) => [x0, y0, x1, y0, x1, y1, x0, y1];
  const field = heightField({ parts: [{ id: 'H', height: 20, areas: [sq(100, 100, 300, 300)], hill: true }] });
  assert.equal(cliffRuns({ field, step: 5 }).length, 0); assert.equal(cliffEdges({ field, piece: 25 }).length, 0);
  assert.ok(cliffRuns({ field, step: 5, want: 'slope' }).length >= 1);
});
