import test from 'node:test';
import assert from 'node:assert/strict';
import { arcOf, arcShape, arcTracks, flightTiming, shadowStage, footprintPoints, clearPoint, missLine, planFlight, withFlightPaths, wallHit } from '../../../scripts/engines/playback/flight-path.mjs';
import { sideOf } from '../../../scripts/systems/outcome.mjs';

// A full-height wall at x (blocks every line that crosses it, of any type).
const wallAtX = (x) => (a, b, type) => (a.x < x) !== (b.x < x) ? { x, y: a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x), type } : null;
// A short wall at x covering only y in [y0, y1].
const segmentAtX = (x, y0, y1, extra = {}) => (a, b) => {
  if ((a.x < x) === (b.x < x)) return null;
  const y = a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x);
  return y >= y0 && y <= y1 ? { x, y, ...extra } : null;
};
const rect = { x: 400, y: 0, w: 100, h: 100 };
const from = { x: 0, y: 50 };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;
// Two seeds that fall on opposite sides.
const seedA = 'msg-a';
const seedB = ['msg-b', 'msg-c', 'msg-d', 'msg-e', 'msg-f'].find((s) => sideOf(s) !== sideOf(seedA));

test('a hit with a clear centre flies to the centre', () => {
  const r = planFlight({ from, targetRect: rect, role: 'attack-hit', gridPx: 100, collides: () => null });
  assert.deepEqual([r.outcome, r.to], ['target', { x: 450, y: 50 }]);
});

test('a blocked hit aims at the visible part of the target', () => {
  const calls = [];
  const collides = (a, b, type) => (calls.push(type), segmentAtX(200, 40, 60)(a, b));
  const r = planFlight({ from, targetRect: rect, role: 'attack-hit', gridPx: 100, collides });
  assert.equal(r.outcome, 'target');
  // Centre and the left/right inset midpoints sit behind the wall; the top inset midpoint is clear.
  assert.deepEqual(r.to, { x: 450, y: 20 });
  assert.ok(calls.every((t) => t === 'sight'));
});

test('nothing visible: the hit strikes the movement wall', () => {
  const r = planFlight({ from, targetRect: rect, role: 'attack-hit', gridPx: 100, collides: wallAtX(200) });
  assert.equal(r.outcome, 'wall'); assert.equal(r.to.x, 200);
  assert.equal(r.to.y, 50);
});

test('a wall that hides but does not stop lets the hit through', () => {
  const collides = (a, b, type) => type === 'sight' ? wallAtX(200)(a, b) : null;
  const r = planFlight({ from, targetRect: rect, role: 'attack-hit', gridPx: 100, collides });
  assert.deepEqual([r.outcome, r.to], ['target', { x: 450, y: 50 }]);
});

test('a door the hit strikes is reported', () => {
  const r = planFlight({ from, targetRect: rect, role: 'attack-hit', gridPx: 100, collides: segmentAtX(200, -1000, 1000, { door: true }) });
  assert.equal(r.outcome, 'wall'); assert.equal(r.wallDoor, true);
});

test('a miss flies past, or stops at a wall', () => {
  const past = planFlight({ from, targetRect: rect, role: 'attack-miss', seed: seedA, gridPx: 100, collides: () => null });
  assert.equal(past.outcome, 'past');
  const dx = past.to.x - from.x, dy = past.to.y - from.y;
  assert.ok(near(Math.hypot(dx, dy), 450 + 200), 'flies 2 squares past the target centre');
  assert.ok(near(Math.abs(Math.atan2(dy, dx)) * 180 / Math.PI, 12), '12 degrees off the line');
  const walled = planFlight({ from, targetRect: rect, role: 'attack-miss', seed: seedA, gridPx: 100, collides: wallAtX(600) });
  assert.equal(walled.outcome, 'wall'); assert.ok(near(walled.to.x, 600));
});

test('a miss stops at movement walls only', () => {
  const types = [];
  planFlight({ from, targetRect: rect, role: 'attack-miss', seed: seedA, gridPx: 100, collides: (a, b, type) => (types.push(type), null) });
  assert.deepEqual(types, ['move']);
});

test('miss side follows the seed', () => {
  const to = { x: 450, y: 50 };
  const a1 = missLine(from, to, { seed: seedA, gridPx: 100 }), a2 = missLine(from, to, { seed: seedA, gridPx: 100 });
  const b = missLine(from, to, { seed: seedB, gridPx: 100 });
  assert.deepEqual(a1, a2);
  assert.ok(near(a1.x, b.x)); assert.ok(near(a1.y - 50, -(b.y - 50)));
  assert.ok(Math.abs(a1.y - 50) > 1);
});

test('other flights never strike walls', () => {
  const r = planFlight({ from, targetRect: rect, role: 'other', gridPx: 100, collides: wallAtX(200) });
  assert.deepEqual([r.outcome, r.to], ['target', { x: 450, y: 50 }]);
  const seen = planFlight({ from, targetRect: rect, role: 'other', gridPx: 100, collides: segmentAtX(200, 40, 60) });
  assert.deepEqual([seen.outcome, seen.to], ['target', { x: 450, y: 20 }]);
});

test('fixed flights keep their endpoint', () => {
  const r = planFlight({ from, targetRect: rect, role: 'fixed', gridPx: 100, collides: wallAtX(200) });
  assert.deepEqual([r.outcome, r.to], ['target', { x: 450, y: 50 }]);
});

test('shield block is left alone', () => {
  for (const role of ['attack-miss', 'attack-hit']) {
    const r = planFlight({ from, targetRect: rect, role, seed: seedA, gridPx: 100, collides: wallAtX(200), shieldBlock: true });
    assert.deepEqual([r.outcome, r.to], ['target', { x: 450, y: 50 }]);
  }
});

test('zero distance keeps the endpoint', () => {
  const r = planFlight({ from: { x: 450, y: 50 }, targetRect: rect, role: 'attack-miss', seed: seedA, gridPx: 100, collides: wallAtX(200) });
  assert.deepEqual([r.outcome, r.to], ['target', { x: 450, y: 50 }]);
});

test('an explicit aim point is tried first', () => {
  const r = planFlight({ from, targetRect: rect, to: { x: 430, y: 70 }, role: 'attack-hit', gridPx: 100, collides: () => null });
  assert.deepEqual(r.to, { x: 430, y: 70 });
});

test('footprint points: centre, inset edge midpoints, then inset corners', () => {
  assert.deepEqual(footprintPoints(rect), [
    { x: 450, y: 50 }, { x: 420, y: 50 }, { x: 480, y: 50 }, { x: 450, y: 20 }, { x: 450, y: 80 },
    { x: 420, y: 20 }, { x: 480, y: 20 }, { x: 420, y: 80 }, { x: 480, y: 80 },
  ]);
  // A wide footprint: the nearer edge midpoints come first.
  const wide = footprintPoints({ x: 0, y: 0, w: 200, h: 100 });
  assert.deepEqual(wide.slice(0, 3), [{ x: 100, y: 50 }, { x: 100, y: 20 }, { x: 100, y: 80 }]);
  assert.equal(clearPoint(from, rect, wallAtX(200)), null);
});

test('arcs by asset and override', () => {
  assert.equal(arcOf({ assets: ['jb2a.throwable.throw.bomb.01.red'] }).kind, 'lob');
  assert.equal(arcOf({ assets: ['jb2a.throwable.launch.cannon_ball.01.black'] }).kind, 'lob');
  assert.equal(arcOf({ assets: ['jb2a.javelin.01.throw'] }).kind, 'low');
  assert.equal(arcOf({ assets: ['jb2a.dagger.throw.01.white'] }).kind, 'low');
  assert.equal(arcOf({ asset: 'jb2a.chakram.01.throw.blue', assets: [] }).kind, 'low');
  assert.equal(arcOf({ assets: ['jb2a.arrow.physical.white.01'] }).kind, 'none');
  assert.equal(arcOf({ assets: ['jb2a.arrow.physical.white.01'], flight: 'lob' }).kind, 'lob');
  assert.equal(arcOf({ assets: ['jb2a.javelin.01.throw'], flight: 'straight' }).kind, 'none');
  assert.equal(arcOf({ assets: ['jb2a.javelin.01.throw'], flight: 'auto' }).kind, 'low');
  assert.deepEqual(arcShape('lob', 1000, 100), { apexPx: 250, peakScale: 1.35 });
  assert.equal(arcShape('lob', 100, 100).apexPx, 75);
  assert.equal(arcShape('lob', 10000, 100).apexPx, 300);
  assert.equal(arcShape('low', 3000, 100).apexPx, 100);
  assert.deepEqual(arcShape('low', 500, 100), { apexPx: 40, peakScale: 1.1 });
  assert.deepEqual(arcShape('none', 500, 100), { apexPx: 0, peakScale: 1 });
});

// withFlightPaths over planned stages.
const token = (id, cx, cy, size = 100) => ({ id, center: { x: cx, y: cy }, w: size, h: size });
const shooter = token('src', 0, 0), far = token('t1', 1000, 0);
const flight = (extra = {}) => ({ stageId: 'shot', kind: 'travel', origin: shooter, endpoint: far, destination: far, delay: 0, duration: 1000, contact: 600, assets: ['jb2a.arrow.physical.white.01'], asset: 'jb2a.arrow.physical.white.01', ...extra });
const ctx = (extra = {}) => ({ source: shooter, targets: [far], type: 'attack', outcome: 'success', messageId: seedA, ...extra });
const opts = (extra = {}) => ({ context: ctx(), gridPx: 100, collides: wallAtX(500), walls: true, arcs: true, preview: false, ...extra });

test('a flight cut short by a wall arrives sooner', () => {
  const { plan, blocked } = withFlightPaths([flight()], opts());
  const [s] = plan;
  assert.equal(s.flightOutcome, 'wall');
  assert.deepEqual(s.flightFrom, { x: 0, y: 0 });
  assert.equal(s.flightTo.x, 500);
  assert.equal(s.contact, 300);
  assert.equal(s.flightArrivalCut, 300);
  assert.deepEqual([...blocked], ['t1']);
});

test('without a contact the arrival is 55% of the flight', () => {
  const { plan } = withFlightPaths([flight({ contact: 0 })], opts());
  assert.equal(plan[0].contact, 275);
});

test('a clear hit keeps its timing and blocks nothing', () => {
  const { plan, blocked } = withFlightPaths([flight()], opts({ collides: () => null }));
  assert.equal(plan[0].flightOutcome, 'target');
  assert.deepEqual(plan[0].flightTo, { x: 1000, y: 0 });
  assert.equal(plan[0].contact, 600);
  assert.equal(plan[0].flightArrivalCut, undefined);
  assert.equal(blocked.size, 0);
});

test('a D&D per-target outcome decides the role', () => {
  const { plan, blocked } = withFlightPaths([flight()], opts({ context: ctx({ outcome: undefined, targetOutcomes: { t1: 'failure' } }), collides: () => null }));
  assert.equal(plan[0].flightOutcome, 'past');
  assert.equal(blocked.size, 0);
});

test('a miss into a wall blocks nothing (its target effects are already gone)', () => {
  const { plan, blocked } = withFlightPaths([flight()], opts({ context: ctx({ outcome: 'criticalFailure' }) }));
  assert.equal(plan[0].flightOutcome, 'wall');
  assert.equal(blocked.size, 0);
});

test('flights with no attack outcome never stop at walls', () => {
  for (const context of [ctx({ outcome: undefined }), ctx({ type: 'save', outcome: 'failure' })]) {
    const { plan, blocked } = withFlightPaths([flight()], opts({ context }));
    assert.deepEqual([plan[0].flightOutcome, plan[0].flightTo, plan[0].contact], ['target', { x: 1000, y: 0 }, 600]);
    assert.equal(blocked.size, 0);
  }
});

test('reverse, chain, fan and area flights keep their path but still arc', () => {
  const bomb = { assets: ['jb2a.throwable.throw.bomb.01.red'], asset: 'jb2a.throwable.throw.bomb.01.red' };
  for (const extra of [{ travelOrigin: 'target', origin: far, endpoint: shooter }, { travelOrigin: 'previousTarget' }, { areaFan: true }, { travelDestination: 'area', endpoint: { x: 1000, y: 0 } }]) {
    const { plan, blocked } = withFlightPaths([flight({ ...bomb, ...extra })], opts());
    const [s] = plan;
    assert.equal(s.flightTo, undefined); assert.equal(s.flightOutcome, undefined);
    assert.equal(s.contact, 600);
    assert.deepEqual(s.flightArc, { kind: 'lob', apexPx: 250, peakScale: 1.35 });
    assert.equal(blocked.size, 0);
  }
});

test('walls off: only arcs; arcs off: straight', () => {
  const off = withFlightPaths([flight()], opts({ walls: false }));
  assert.equal(off.plan[0].flightTo, undefined); assert.equal(off.plan[0].contact, 600);
  assert.deepEqual(off.plan[0].flightArc, { kind: 'none', apexPx: 0, peakScale: 1 });
  assert.equal(off.blocked.size, 0);
  const flat = withFlightPaths([flight({ asset: 'jb2a.javelin.01.throw', assets: ['jb2a.javelin.01.throw'], flight: 'lob' })], opts({ arcs: false, collides: () => null }));
  assert.deepEqual(flat.plan[0].flightArc, { kind: 'none', apexPx: 0, peakScale: 1 });
});

test('no collision backend: flights play as today', () => {
  const { plan } = withFlightPaths([flight()], opts({ collides: null }));
  assert.equal(plan[0].flightTo, undefined);
});

test('the arc spans the planned flight, wall included', () => {
  const lob = { asset: 'jb2a.throwable.throw.flask.01.orange', assets: ['jb2a.throwable.throw.flask.01.orange'] };
  const { plan } = withFlightPaths([flight(lob)], opts());
  assert.deepEqual(plan[0].flightArc, { kind: 'lob', apexPx: 125, peakScale: 1.35 });
});

test('preview never blocks', () => {
  const { plan, blocked } = withFlightPaths([flight()], opts({ preview: true }));
  assert.equal(blocked.size, 0);
  assert.equal(plan[0].flightOutcome, 'target');
});

test('a shield block flies into the shield', () => {
  const { plan, blocked } = withFlightPaths([flight({ shieldBlock: true })], opts({ context: ctx({ outcome: 'failure' }) }));
  assert.deepEqual([plan[0].flightOutcome, plan[0].flightTo, plan[0].contact], ['target', { x: 1000, y: 0 }, 600]);
  assert.equal(blocked.size, 0);
});

test('other stages pass through untouched', () => {
  const impact = { stageId: 'hit', kind: 'impact', delay: 600, duration: 500 };
  const { plan } = withFlightPaths([impact], opts());
  assert.equal(plan[0], impact);
});

test('a projectile aims at its landing point', () => {
  const { plan } = withFlightPaths([flight({ kind: 'projectile', landing: { x: 1020, y: 10 } })], opts({ collides: () => null }));
  assert.deepEqual(plan[0].flightTo, { x: 1020, y: 10 });
});

test('wallHit: a plain door knocks on wood; a secret door stays stone', () => {
  const vertex = (door, viaPlaceable = false) => ({ x: 12, y: 34, edges: new Set([{ object: viaPlaceable ? { document: { door } } : { door } }]) });
  assert.deepEqual(wallHit(vertex(1)), { x: 12, y: 34, door: true });
  assert.deepEqual(wallHit(vertex(1, true)), { x: 12, y: 34, door: true });
  assert.deepEqual(wallHit(vertex(2)), { x: 12, y: 34 });
  assert.deepEqual(wallHit(vertex(0)), { x: 12, y: 34 });
  assert.equal(wallHit(null), null);
});

// Arc drawing: absolute values on the effect's spriteContainer (grid squares for position).
const up = (property, from, to, duration, delay) => ({ property, from, to, duration, delay, ease: 'easeOutQuad' });
const down = (property, from, to, duration, delay) => ({ property, from, to, duration, delay, ease: 'easeInQuad' });

test('lob tracks rise then fall around the apex', () => {
  const arc = { kind: 'lob', ...arcShape('lob', 1000, 100) };
  assert.deepEqual(arcTracks(arc, 800, 100), [
    up('position.y', 0, -2.5, 400, 0), down('position.y', -2.5, 0, 400, 400),
    up('scale.x', 1, 1.35, 400, 0), down('scale.x', 1.35, 1, 400, 400),
    up('scale.y', 1, 1.35, 400, 0), down('scale.y', 1.35, 1, 400, 400),
  ]);
  // A flight that starts moving later arcs from then.
  assert.deepEqual(arcTracks(arc, 800, 100, { start: 100 }).slice(0, 2), [up('position.y', 0, -2.5, 400, 100), down('position.y', -2.5, 0, 400, 500)]);
});

test('straight has no tracks', () => {
  assert.deepEqual(arcTracks({ kind: 'none', apexPx: 0, peakScale: 1 }, 800, 100), []);
  assert.deepEqual(arcTracks(undefined, 800, 100), []);
  assert.deepEqual(arcTracks({ kind: 'lob', apexPx: 250, peakScale: 1.35 }, 0, 100), []);
});

test('a stretched clip lifts screen-up in its own turned frame and only thickens', () => {
  const arc = { kind: 'lob', apexPx: 250, peakScale: 1.35 };
  // Flying straight down the screen: the clip's x axis points down, so screen-up is its -x.
  const downScreen = arcTracks(arc, 800, 100, { angle: Math.PI / 2, stretched: true });
  assert.deepEqual(downScreen, [
    up('position.x', 0, -2.5, 400, 0), down('position.x', -2.5, 0, 400, 400),
    up('scale.y', 1, 1.35, 400, 0), down('scale.y', 1.35, 1, 400, 400),
  ]);
  // Flying right to left: the clip is upside down, so screen-up is its +y.
  assert.deepEqual(arcTracks(arc, 800, 100, { angle: Math.PI, stretched: true }).slice(0, 2), [up('position.y', 0, 2.5, 400, 0), down('position.y', 2.5, 0, 400, 400)]);
  // On a diagonal both axes share the lift.
  const diagonal = arcTracks(arc, 800, 100, { angle: Math.PI / 4, stretched: true });
  const peak = (p) => diagonal.find((t) => t.property === p && t.delay === 0).to;
  assert.ok(near(peak('position.x'), -2.5 * Math.SQRT1_2, 1e-4) && near(peak('position.y'), -2.5 * Math.SQRT1_2, 1e-4));
});

test('shadow follows the ground line and is tier 2', () => {
  const arc = { kind: 'lob', apexPx: 250, peakScale: 1.35 };
  const fly = flight({ stageId: 'fly', delay: 250, contact: 0, flightFrom: { x: 0, y: 0 }, flightTo: { x: 500, y: 20 }, flightArc: arc });
  const s = shadowStage(fly);
  assert.equal(s.stageId, 'fly-shadow');
  assert.equal(s.kind, 'projectile');
  assert.equal(s.tier, 2);
  assert.equal(s.animaterShadow, true);
  assert.equal(s.below, true);
  assert.deepEqual([s.flightFrom, s.flightTo], [{ x: 0, y: 0 }, { x: 500, y: 20 }]);
  // It lands when the object does (55% of a travel clip without a contact).
  assert.deepEqual([s.delay, s.duration, s.moveDelay ?? 0], [250, 550, 0]);
  // A soft black ellipse, half a square by 0.3 (Sequencer draws an ellipse from its half sizes).
  assert.deepEqual(s.shape, { type: 'ellipse', width: 0.25, height: 0.15, gridUnits: true, fillColor: '#000000', fillAlpha: 1 });
  assert.equal(s.opacity, 0.35);
  // Smallest and faintest at the apex: 0.6 of its size, 0.15 opacity (0.35 x the track).
  const at = (p, delay) => s.flightTracks.find((t) => t.property === p && t.delay === delay);
  for (const p of ['scale.x', 'scale.y']) {
    assert.deepEqual(at(p, 0), up(p, 1, 0.6, 275, 0));
    assert.deepEqual(at(p, 275), down(p, 0.6, 1, 275, 275));
  }
  assert.ok(near(at('alpha', 0).to * s.opacity, 0.15, 1e-4));
  assert.equal(at('alpha', 275).to, 1);
  // Without a planned path it runs between the flight's own ends.
  const plain = shadowStage(flight({ flightArc: arc }));
  assert.deepEqual([plain.flightFrom, plain.flightTo], [{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  assert.equal(plain.duration, 600);
});

test('a projectile arcs over its whole move', () => {
  const arc = { kind: 'low', apexPx: 40, peakScale: 1.1 };
  const fly = flight({ kind: 'projectile', moveDelay: 100, moveEase: 'easeOutCubic', contact: 0, flightArc: arc });
  assert.deepEqual(flightTiming(fly), { start: 100, arrive: 900 });
  assert.deepEqual(flightTiming(flight({ contact: 0 })), { start: 0, arrive: 550 });
  const s = shadowStage(fly);
  assert.deepEqual([s.duration, s.moveDelay, s.moveEase], [1000, 100, 'easeOutCubic']);
  assert.equal(s.flightTracks[0].delay, 100);
});
