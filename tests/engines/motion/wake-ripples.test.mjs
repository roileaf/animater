import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wakeAim, wakeReach, wakeSpread, wakeLife, wakeFade, createWakeTrails } from '../../../scripts/engines/motion/wake-ripples.mjs';

const east = { x: 1, y: 0 }, south = { x: 0, y: 1 };

test('the way a swimmer is going, once it has come far enough', () => {
  assert.deepEqual(wakeAim({ x: 0, y: 0 }, { x: 100, y: 0 }, 10), east);
  assert.equal(wakeAim(null, { x: 1, y: 1 }), null, 'nowhere yet to come from');
  assert.equal(wakeAim({ x: 5, y: 5 }, { x: 5, y: 5 }), null, 'it has not moved');
  assert.equal(wakeAim({ x: 0, y: 0 }, { x: 5, y: 0 }, 10), null, 'not far enough');
});

test('a wake opens to one angle, about 19.5 degrees each side, by its end whatever the speed or size', () => {
  for (const [g, speed] of [[100, 60], [100, 300], [100, 1200], [40, 300]]) {
    const life = wakeLife(g, speed), behind = speed * life, angle = Math.atan((wakeSpread(g, speed, life) - wakeSpread(g, speed, 0)) / behind) * 180 / Math.PI;
    assert.ok(Math.abs(angle - 19.47) < 0.01, `${angle} at ${speed}`);
  }
  assert.equal(wakeSpread(100, 300, 0), 45, 'from its flanks');
});

test('its arms curve: spreading quickly and then less so', () => {
  const at = (age) => wakeSpread(100, 300, age);
  assert.ok(at(0.5) - at(0.25) > at(2) - at(1.75));
});

test('a piece of wake comes up and then fades away, sooner the faster it was made', () => {
  assert.equal(wakeFade(0), 0);
  assert.ok(wakeFade(0.3) > wakeFade(1.5));
  assert.equal(wakeFade(2.6), 0);
  assert.ok(wakeLife(100, 1200) < wakeLife(100, 300));
  assert.equal(wakeLife(100, 10), 2.6, 'no longer than this however slow');
  assert.ok(wakeFade(1, wakeLife(100, 1200)) === 0, 'a fast one is gone sooner');
});

test('what is left in the water stays where it was made, whatever the swimmer does next', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 40, y: 0, g: 100, dir: east }, 0.1);
  const made = structuredClone(pieces.trails[0].points);
  pieces.drive('a', { x: 40, y: 40, g: 100, dir: south }, 0.2);
  pieces.drive('a', { x: 40, y: 90, g: 100, dir: south }, 0.3);
  assert.deepEqual(pieces.trails[0].points.slice(0, made.length), made);
});

test('a piece remembers how fast and how far along it was made', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 60, y: 0, g: 100, dir: east }, 0.2);
  const made = pieces.trails[0].points[1];
  assert.ok(Math.abs(made.speed - 300) < 1e-6);
  assert.equal(made.u, 60);
});

test('a slow swimmer still leaves its wake: only how far it has come counts', () => {
  const pieces = createWakeTrails();
  for (let i = 0; i <= 100; i++) pieces.drive('slow', { x: i * 2, y: 0, g: 100, dir: east }, i * 0.1);
  assert.ok(pieces.total > 3);
  assert.equal(pieces.trails.length, 1, 'one unbroken trail');
});

test('it fades away after the swimmer stops, and starting again begins anew', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 40, y: 0, g: 100, dir: east }, 0.1);
  pieces.drive('a', { x: 80, y: 0, g: 100, dir: east }, 1);
  assert.equal(pieces.trails.length, 2, 'stopped a while');
  pieces.sweep(10);
  assert.equal(pieces.trails.length, 0);
  assert.equal(pieces.total, 0);
});

test('a jump across the water does not draw a wake between', () => {
  const pieces = createWakeTrails();
  pieces.drive('a', { x: 0, y: 0, g: 100, dir: east }, 0);
  pieces.drive('a', { x: 2000, y: 0, g: 100, dir: east }, 0.1);
  assert.equal(pieces.trails.length, 2);
});

test('however many animals are paddling, a token keeps its wake', () => {
  const pieces = createWakeTrails({ limit: 20 });
  for (let n = 0; n < 12; n++) for (let i = 0; i < 6; i++) pieces.drive(`duck${n}`, { x: i * 40, y: n * 500, g: 100, dir: east }, i * 0.1);
  for (let i = 0; i < 6; i++) pieces.drive('token', { x: i * 40, y: 9000, g: 100, dir: east, keep: true }, 0.6 + i * 0.1);
  assert.equal(pieces.total, 20);
  assert.equal(pieces.trails.find((t) => t.key === 'token').points.length, 6);
});

test('the rings of something staying put fit the quad over them', () => {
  assert.ok(wakeReach(1, 200) > wakeReach(0.3, 200));
  assert.ok(wakeReach(0.62, 200) > 200 * 0.62 * 0.85 * 3);
});
