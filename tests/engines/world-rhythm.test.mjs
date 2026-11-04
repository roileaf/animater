import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stuckShotsOf } from '../../scripts/engines/playback/flight-path.mjs';
import { dayShift, chorusGap, chorusSpot } from '../../scripts/engines/motion/day-shift.mjs';
import { flameWind, gustAt } from '../../scripts/engines/motion/flame-wind.mjs';
import { TRACK_FLOORS, TRACK_CAP, trackMode, trackHours, stepsAlong, pruneTracks, trackLook } from '../../scripts/engines/motion/old-tracks.mjs';

const at = (hour) => ({ day: hour / 24, sunrise: 0.25, sunset: 0.75 });

test('arrows and bolts stick; elemental bolts and hits on a creature do not', () => {
  const flight = (asset, extra) => ({ kind: 'travel', asset, flightFrom: { x: 0, y: 0 }, flightTo: { x: 100, y: 0 }, ...extra });
  const out = stuckShotsOf([
    flight('jb2a.arrow.physical.white', { flightOutcome: 'wall' }),
    flight('jb2a.bolt.physical.orange', { flightOutcome: 'past' }),
    flight('jb2a.arrow.physical.white', { flightOutcome: 'target' }),
    flight('jb2a.bolt.fire', { flightOutcome: 'wall' }),
    flight('jb2a.lightning_bolt.wide', { flightOutcome: 'wall' }),
    flight('jb2a.arrow.physical.white', { shieldBlock: true, endpoint: { id: 'shieldy' } }),
    { kind: 'impact', asset: 'jb2a.arrow.physical.white', flightOutcome: 'wall' },
  ]);
  assert.deepEqual(out.map((s) => [s.into, s.kind]), [['wall', 'arrow'], ['floor', 'bolt'], ['shield', 'arrow']]);
  assert.equal(out[2].token, 'shieldy');
});

test('the chorus is fullest at sunrise and gone by mid morning', () => {
  assert.equal(dayShift(at(6)).chorus, 1);
  assert.ok(dayShift(at(5.7)).chorus > 0 && dayShift(at(5.7)).chorus < 1);
  assert.equal(dayShift(at(10)).chorus, 0);
  assert.equal(dayShift(at(2)).chorus, 0);
});

test('birds stop, a hush falls, then the crickets start', () => {
  assert.equal(dayShift(at(14)).birds, 1);
  assert.equal(dayShift(at(14)).crickets, 0);
  const dusk = dayShift(at(18.2));
  assert.ok(dusk.birds < 0.05 && dusk.crickets === 0 && dusk.hush > 0.9, JSON.stringify(dusk));
  assert.equal(dayShift(at(19.5)).crickets, 1);
  assert.equal(dayShift(at(2)).crickets, 1);
});

test('crickets give way before the dawn chorus takes over', () => {
  assert.equal(dayShift(at(5.8)).crickets, 0);
  assert.ok(dayShift(at(5)).crickets > 0);
});

test('a world with no clock keeps things as they were', () => {
  assert.deepEqual(dayShift(null), { chorus: 0, birds: 1, crickets: 1, hush: 0 });
});

test('the fuller the chorus the closer the birds', () => {
  assert.equal(chorusGap(0, () => 0.5), Infinity);
  assert.ok(chorusGap(1, () => 0.5) < chorusGap(0.3, () => 0.5));
});

test('a singing bird is never on top of the listener', () => {
  for (let i = 0; i < 50; i++) { const s = chorusSpot({ x: 0, y: 0 }, 100); assert.ok(Math.hypot(s.x, s.y) >= 300); }
});

test('no wind and full shelter leave a flame alone', () => {
  assert.deepEqual(flameWind({ wind: 0, angle: 1 }), { lean: 0, dip: 0, drift: { x: 0, y: 0 } });
  assert.deepEqual(flameWind({ wind: 1, angle: 1, shelter: 1 }), { lean: 0, dip: 0, drift: { x: 0, y: 0 } });
});

test('a flame leans the way the wind blows', () => {
  assert.ok(flameWind({ wind: 0.8, angle: 0, t: 3 }).lean > 0);
  assert.ok(flameWind({ wind: 0.8, angle: Math.PI, t: 3 }).lean < 0);
  assert.ok(flameWind({ wind: 0.8, angle: Math.PI / 2, t: 3 }).drift.y > 0);
});

test('only a real wind ever presses a flame down', () => {
  for (let t = 0; t < 200; t += 0.5) assert.equal(flameWind({ wind: 0.3, t, key: 'a' }).dip, 0);
  let most = 0; for (let t = 0; t < 400; t += 0.25) most = Math.max(most, flameWind({ wind: 1, t, key: 'a' }).dip);
  assert.ok(most > 0 && most <= 0.6);
});

test('gusts differ fire to fire', () => {
  assert.notEqual(gustAt(10, 0.1), gustAt(10, 0.7));
});

test('old tracks are off unless the GM chose, and the lifetime is sane', () => {
  assert.equal(trackMode(undefined), 'off');
  assert.equal(trackMode('nonsense'), 'off');
  assert.equal(trackMode('gm'), 'gm');
  assert.equal(trackHours('x'), 24);
  assert.equal(trackHours(-3), 24);
  assert.equal(trackHours(6), 6);
});

test('steps go left and right along the way walked, by stride', () => {
  const { steps } = stepsAlong({ x: 0, y: 0 }, { x: 500, y: 0 }, { grid: 100, worldTime: 77 });
  assert.equal(steps.length, 10);
  assert.equal(steps[0][5], 77);
  assert.ok(Math.sign(steps[0][1]) !== Math.sign(steps[1][1]));
});

test('a stride carries on across separate moves', () => {
  const a = stepsAlong({ x: 0, y: 0 }, { x: 70, y: 0 }, { grid: 100 });
  const b = stepsAlong({ x: 70, y: 0 }, { x: 140, y: 0 }, { grid: 100, left: a.left, side: a.side });
  assert.equal(a.steps.length + b.steps.length, 2);
  assert.ok(Math.abs(b.steps[0][0] - 100) < 1, String(b.steps[0][0]));
});

test('water leaves no prints', () => {
  assert.equal(stepsAlong({ x: 0, y: 0 }, { x: 500, y: 0 }, { floorAt: () => 'water' }).steps.length, 0);
  assert.equal(stepsAlong({ x: 0, y: 0 }, { x: 500, y: 0 }, { floorAt: () => null }).steps.length, 0);
});

const step = (floor, when, secret = 0) => [0, 0, 0, 1, TRACK_FLOORS.indexOf(floor), when, secret, 1];

test('each floor keeps a print as long as it can, oldest go past the cap', () => {
  const hour = 3600;
  assert.equal(pruneTracks([step('mud', 0)], 23 * hour, 24).length, 1);
  assert.equal(pruneTracks([step('stone', 0)], 23 * hour, 24).length, 0);
  const many = Array.from({ length: TRACK_CAP + 5 }, (_, i) => step('mud', i));
  const kept = pruneTracks(many, 100, 24);
  assert.equal(kept.length, TRACK_CAP);
  assert.equal(kept[0][5], 5);
});

test('players see nothing in GM mode, nor secret steps, and the GM sees it all', () => {
  const plain = step('mud', 0), hidden = step('mud', 0, 1), opts = { now: 3600, hours: 24 };
  assert.equal(trackLook(plain, { ...opts, mode: 'off', viewer: 'gm' }), null);
  assert.equal(trackLook(plain, { ...opts, mode: 'gm', viewer: 'player' }), null);
  assert.ok(trackLook(plain, { ...opts, mode: 'gm', viewer: 'gm' }));
  assert.ok(trackLook(plain, { ...opts, mode: 'everyone', viewer: 'player' }));
  assert.equal(trackLook(hidden, { ...opts, mode: 'everyone', viewer: 'player' }), null);
  assert.ok(trackLook(hidden, { ...opts, mode: 'everyone', viewer: 'gm' }));
});

test('tracks fade with age and wait out the first half minute', () => {
  const s = step('mud', 0), opts = { hours: 24, mode: 'everyone' };
  assert.equal(trackLook(s, { ...opts, now: 10 }), null);
  assert.ok(trackLook(s, { ...opts, now: 3600 }).alpha > trackLook(s, { ...opts, now: 3600 * 20 }).alpha);
  assert.equal(trackLook(s, { ...opts, now: 3600 * 25 }), null);
});
