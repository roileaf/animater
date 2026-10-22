import test from 'node:test';
import assert from 'node:assert/strict';
import { footprintPoints, clearPoint, missLine, planFlight, withFlightPaths, wallHit, arrivalOf, wallArrivalOf } from '../../../scripts/engines/playback/flight-path.mjs';
import { sideOf } from '../../../scripts/systems/outcome.mjs';
import { MEDIA_LANDINGS } from '../../../data/media-landings.mjs';

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

// withFlightPaths over planned stages.
const token = (id, cx, cy, size = 100) => ({ id, center: { x: cx, y: cy }, w: size, h: size });
const shooter = token('src', 0, 0), far = token('t1', 1000, 0);
const flight = (extra = {}) => ({ stageId: 'shot', kind: 'travel', origin: shooter, endpoint: far, destination: far, delay: 0, duration: 1000, contact: 600, assets: ['jb2a.arrow.physical.white.01'], asset: 'jb2a.arrow.physical.white.01', ...extra });
const ctx = (extra = {}) => ({ source: shooter, targets: [far], type: 'attack', outcome: 'success', messageId: seedA, ...extra });
const opts = (extra = {}) => ({ context: ctx(), gridPx: 100, collides: wallAtX(500), walls: true, preview: false, ...extra });

test('a projectile stopped by a wall strikes it as its move ends', () => {
  // Sequencer moves it over its whole stage (no move speed), so the shorter line arrives no sooner.
  const { plan, blocked, missed } = withFlightPaths([flight({ kind: 'projectile' })], opts());
  const [s] = plan;
  assert.equal(s.flightOutcome, 'wall');
  assert.deepEqual(s.flightFrom, { x: 0, y: 0 });
  assert.equal(s.flightTo.x, 500);
  assert.equal(s.contact, 1000);
  // 400 ms after the recipe's own arrival (600 ms): what followed the hit moves with it.
  assert.equal(s.flightArrivalShift, 400);
  assert.deepEqual([...blocked], ['t1']);
  assert.equal(missed.size, 0);
  // A launch pause does not change it: the move still ends with the stage.
  assert.equal(withFlightPaths([flight({ kind: 'projectile', moveDelay: 300, contact: 0 })], opts()).plan[0].contact, 1000);
});

// The measured landing of the white longbow arrow's range variant (data/media-landings.mjs).
const ARROW = 'jb2a.arrow.physical.white.01';
const landingAt = (ft) => MEDIA_LANDINGS[`${ARROW}.${ft}`];
// A longbow's flight: the 90 ft arrow clip (2400 ms) + 150 ms, its recipe contact 650 ms; a target 90 ft out.
const longbow = (extra = {}) => flight({ duration: 2550, contact: 650, endpoint: token('t1', 1800, 0), destination: token('t1', 1800, 0), ...extra });

test('a longbow arrow stopped at 15 ft strikes the wall as the 15 ft variant lands', () => {
  // 3 squares to the wall: Sequencer plays the 15 ft clip (from 2 squares), not the 90 ft one the target needs.
  const { plan, blocked } = withFlightPaths([longbow()], opts({ collides: wallAtX(300) }));
  const [s] = plan;
  assert.deepEqual([s.flightOutcome, s.flightTo.x], ['wall', 300]);
  assert.equal(s.contact, landingAt('15ft'));
  assert.ok(s.contact >= 600 && s.contact <= 700, `${s.contact} ms`);
  assert.equal(s.flightArrivalShift, s.contact - 650 || undefined);
  assert.deepEqual([...blocked], ['t1']);
});

test('a longbow arrow stopped at 60 ft strikes the wall as the 60 ft variant lands', () => {
  const { plan } = withFlightPaths([longbow()], opts({ collides: wallAtX(1200) }));
  assert.equal(plan[0].contact, landingAt('60ft'));
  assert.ok(landingAt('60ft') > landingAt('15ft'));
  // At 30 ft (5 squares, 500 px) the 30 ft variant.
  assert.equal(withFlightPaths([longbow()], opts({ collides: wallAtX(500) })).plan[0].contact, landingAt('30ft'));
});

test('a measured landing plays from the skipped opening at the stage media speed', () => {
  const { plan } = withFlightPaths([longbow({ playbackRate: 2, clipStart: 100 })], opts({ collides: wallAtX(300) }));
  assert.equal(plan[0].contact, Math.round((landingAt('15ft') - 100) / 2));
  // A stage that ends before the arrow lands strikes as it ends.
  assert.equal(withFlightPaths([longbow({ duration: 300 })], opts({ collides: wallAtX(1200) })).plan[0].contact, 300);
});

test('an unmeasured travel clip stopped by a wall strikes it at the end of its travel', () => {
  // No measurement says when its variant's object lands: the wall is struck 200 ms before the stage ends,
  // never before the recipe's arrival.
  const { plan, blocked } = withFlightPaths([flight({ asset: 'jb2a.unmeasured.clip' })], opts());
  const [s] = plan;
  assert.deepEqual([s.flightOutcome, s.flightTo.x, s.contact, s.flightArrivalShift], ['wall', 500, 800, 200]);
  assert.deepEqual([...blocked], ['t1']);
});

test('the fallback wall arrival never comes before the recipe arrival, nor after the stage', () => {
  const line = { flightFrom: { x: 0, y: 0 }, flightTo: { x: 500, y: 0 } };
  assert.equal(wallArrivalOf({ kind: 'travel', duration: 1000, contact: 950 }), 950);
  assert.equal(wallArrivalOf({ kind: 'travel', duration: 1000 }), 800);
  assert.equal(wallArrivalOf({ kind: 'travel', duration: 300 }), 300);
  assert.equal(wallArrivalOf({ kind: 'travel', duration: 500 }), 400);
  assert.equal(wallArrivalOf({ kind: 'travel', duration: 1000, asset: ARROW, ...line }, { landings: {} }), 800);
  assert.equal(wallArrivalOf({ kind: 'travel', duration: 1000, asset: ARROW, ...line }, { landings: { [`${ARROW}.30ft`]: 420 } }), 420);
  assert.equal(wallArrivalOf({ kind: 'projectile', duration: 1200, contact: 400, moveDelay: 200, asset: ARROW, ...line }), 1200);
});

test('without a contact the arrival is 55% of the flight', () => {
  assert.equal(arrivalOf({ kind: 'projectile', duration: 500 }), 275);
  assert.equal(arrivalOf({ kind: 'projectile', duration: 500, contact: 0 }), 275);
});

test('a miss into a wall strikes it as its variant lands too', () => {
  // About 2 squares to the wall along the miss line: the 15 ft variant.
  const { plan } = withFlightPaths([flight()], opts({ context: ctx({ outcome: 'failure' }), collides: wallAtX(200) }));
  assert.deepEqual([plan[0].flightOutcome, plan[0].contact], ['wall', landingAt('15ft')]);
});

test('a clear hit keeps its timing and blocks nothing', () => {
  const { plan, blocked, missed } = withFlightPaths([flight()], opts({ collides: () => null }));
  assert.equal(plan[0].flightOutcome, 'target');
  assert.deepEqual(plan[0].flightTo, { x: 1000, y: 0 });
  assert.equal(plan[0].contact, 600);
  assert.equal(plan[0].flightArrivalShift, undefined);
  assert.equal(blocked.size, 0);
  assert.equal(missed.size, 0);
});

test('a D&D per-target outcome decides the role, and its miss is reported', () => {
  // The roll-wide outcome is empty (several targets), so nothing else drops the missed target's effects.
  const { plan, blocked, missed } = withFlightPaths([flight()], opts({ context: ctx({ outcome: undefined, targetOutcomes: { t1: 'failure' } }), collides: () => null }));
  assert.equal(plan[0].flightOutcome, 'past');
  assert.equal(blocked.size, 0);
  assert.deepEqual([...missed], ['t1']);
});

test('a miss into a wall is a miss, not a block', () => {
  const { plan, blocked, missed } = withFlightPaths([flight()], opts({ context: ctx({ outcome: 'criticalFailure' }) }));
  assert.equal(plan[0].flightOutcome, 'wall');
  assert.equal(blocked.size, 0);
  assert.deepEqual([...missed], ['t1']);
});

test('a miss with no planned path (walls off, no backend, a shield block) is not reported', () => {
  const miss = ctx({ outcome: 'failure' });
  for (const [stage, extra] of [[flight(), { walls: false }], [flight(), { collides: null }], [flight({ shieldBlock: true }), {}]])
    assert.equal(withFlightPaths([stage], opts({ context: miss, ...extra })).missed.size, 0);
});

test('flights with no attack outcome never stop at walls', () => {
  for (const context of [ctx({ outcome: undefined }), ctx({ type: 'save', outcome: 'failure' })]) {
    const { plan, blocked } = withFlightPaths([flight()], opts({ context }));
    assert.deepEqual([plan[0].flightOutcome, plan[0].flightTo, plan[0].contact], ['target', { x: 1000, y: 0 }, 600]);
    assert.equal(blocked.size, 0);
  }
});

test('reverse, chain, fan and area flights keep their path', () => {
  for (const extra of [{ travelOrigin: 'target', origin: far, endpoint: shooter }, { travelOrigin: 'previousTarget' }, { areaFan: true }, { travelDestination: 'area', endpoint: { x: 1000, y: 0 } }]) {
    const stage = flight(extra);
    const { plan, blocked } = withFlightPaths([stage], opts());
    const [s] = plan;
    assert.equal(s, stage);
    assert.equal(s.flightTo, undefined); assert.equal(s.flightOutcome, undefined);
    assert.equal(s.contact, 600);
    assert.equal(blocked.size, 0);
  }
});

test('walls off: flights play as planned', () => {
  const off = withFlightPaths([flight()], opts({ walls: false }));
  assert.equal(off.plan[0].flightTo, undefined); assert.equal(off.plan[0].contact, 600);
  assert.equal(off.blocked.size, 0);
});

test('no collision backend: flights play as today', () => {
  const { plan } = withFlightPaths([flight()], opts({ collides: null }));
  assert.equal(plan[0].flightTo, undefined);
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
