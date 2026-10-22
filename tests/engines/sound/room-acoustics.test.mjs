import test from 'node:test';
import assert from 'node:assert/strict';
import { ROOMS, classifyRoom, measurePolygon, createRoomCache, roomFor, reverbSend, shapeImpulse } from '../../../scripts/engines/sound/room-acoustics.mjs';

const square = (half) => [-half, -half, half, -half, half, half, -half, half];
const fakeCache = (room) => ({ classAt: () => room });

test('classify by openness then area', () => {
  assert.equal(classifyRoom({ openness: 0.7, area: 400 }), 'open');
  assert.equal(classifyRoom({ openness: 0.5, area: 12 }), 'open');
  assert.equal(classifyRoom({ openness: 0.1, area: 12 }), 'small');
  assert.equal(classifyRoom({ openness: 0.1, area: 60 }), 'room');
  assert.equal(classifyRoom({ openness: 0.1, area: 300 }), 'hall');
  assert.equal(classifyRoom({ openness: 0.1, area: 20 }), 'room');
  assert.equal(classifyRoom({ openness: 0.1, area: 120 }), 'room');
});

test('ROOMS holds the tails and sends', () => {
  assert.deepEqual(ROOMS, { small: { tail: 0.3, send: 0.12 }, room: { tail: 0.8, send: 0.22 }, hall: { tail: 1.8, send: 0.32, lowpass: 4000 } });
});

test('measurePolygon: a closed 4x4 room is enclosed with area 16', () => {
  const m = measurePolygon(square(200), { origin: { x: 0, y: 0 }, radius: 3000, gridPx: 100 });
  assert.equal(m.openness, 0);
  assert.equal(m.area, 16);
});

test('measurePolygon: an unbounded sweep is open', () => {
  const pts = [];
  for (let i = 0; i < 32; i++) pts.push(3000 * Math.cos(i / 32 * 2 * Math.PI), 3000 * Math.sin(i / 32 * 2 * Math.PI));
  const m = measurePolygon(pts, { origin: { x: 0, y: 0 }, radius: 3000, gridPx: 100 });
  assert.equal(m.openness, 1);
  assert.ok(m.area > 1000);
});

test('measurePolygon: a half-open sweep counts the share at the radius', () => {
  const pts = [100, 0, 3000, 0, 3000, 100, 0, 100];
  const m = measurePolygon(pts, { origin: { x: 0, y: 0 }, radius: 3000, gridPx: 100 });
  assert.equal(m.openness, 0.5);
});

// A small unwalled map: the sweep stops at the canvas edge, never at its reach.
const canvasRect = { x: 0, y: 0, width: 2500, height: 2500 };
test('measurePolygon: the canvas edge is open, not a wall', () => {
  const pts = [0, 0, 2500, 0, 2500, 2500, 0, 2500];
  const m = measurePolygon(pts, { origin: { x: 1250, y: 1250 }, radius: 3000, gridPx: 100, bounds: canvasRect });
  assert.equal(m.openness, 1);
  assert.equal(classifyRoom(m), 'open');
  // Without the bounds it would read as a closed 625-square hall.
  assert.equal(classifyRoom(measurePolygon(pts, { origin: { x: 1250, y: 1250 }, radius: 3000, gridPx: 100 })), 'hall');
});

test('measurePolygon: walls on two sides, the canvas edge on the others', () => {
  // A wall across x = 1000 and one across y = 1000, the rest the canvas edge.
  const pts = [1000, 1000, 2500, 1000, 2500, 2500, 1000, 2500];
  const m = measurePolygon(pts, { origin: { x: 1500, y: 1500 }, radius: 3000, gridPx: 100, bounds: canvasRect });
  assert.equal(m.openness, 0.75);
  // A closed room inside the canvas stays closed.
  const room = measurePolygon(square(200).map((v) => v + 1250), { origin: { x: 1250, y: 1250 }, radius: 3000, gridPx: 100, bounds: canvasRect });
  assert.equal(room.openness, 0);
});

test('cache measures against the canvas bounds', () => {
  const cache = createRoomCache({ sweep: () => [0, 0, 2500, 0, 2500, 2500, 0, 2500], bounds: () => canvasRect });
  assert.equal(cache.classAt('s', 'l', { x: 1250, y: 1250 }, 100), 'open');
});

test('cache sweeps once per square and epoch', () => {
  let sweeps = 0;
  const cache = createRoomCache({ sweep: () => { sweeps++; return square(200); } });
  assert.equal(cache.classAt('s', 'l', { x: 10, y: 10 }, 100), 'small');
  assert.equal(cache.classAt('s', 'l', { x: 90, y: 90 }, 100), 'small');
  assert.equal(sweeps, 1);
  cache.classAt('s', 'l', { x: 110, y: 10 }, 100);
  assert.equal(sweeps, 2);
  cache.bump();
  cache.classAt('s', 'l', { x: 10, y: 10 }, 100);
  assert.equal(sweeps, 3);
});

test('cache is bounded', () => {
  let sweeps = 0;
  const cache = createRoomCache({ sweep: () => { sweeps++; return square(200); }, limit: 3 });
  for (let i = 0; i < 5; i++) cache.classAt('s', 'l', { x: i * 100, y: 0 }, 100);
  assert.equal(sweeps, 5);
  cache.classAt('s', 'l', { x: 400, y: 0 }, 100);
  assert.equal(sweeps, 5);
  cache.classAt('s', 'l', { x: 0, y: 0 }, 100);
  assert.equal(sweeps, 6);
});

test('sweep failure classes as unknown', () => {
  assert.equal(createRoomCache({ sweep: () => null }).classAt('s', 'l', { x: 0, y: 0 }, 100), null);
  assert.equal(createRoomCache({ sweep: () => { throw new Error('no canvas'); } }).classAt('s', 'l', { x: 0, y: 0 }, 100), null);
});

test('a failing sweep runs once per square and epoch within the expiry, then retries', () => {
  let sweeps = 0, t = 0;
  const cache = createRoomCache({ sweep: () => { sweeps++; throw new Error('canvas not ready'); }, now: () => t });
  const at = { x: 10, y: 10 };
  assert.equal(cache.classAt('s', 'l', at, 100), null);
  assert.equal(cache.classAt('s', 'l', at, 100), null);
  assert.equal(sweeps, 1);
  t = 4999;
  cache.classAt('s', 'l', at, 100);
  assert.equal(sweeps, 1);
  t = 5000;
  cache.classAt('s', 'l', at, 100);
  assert.equal(sweeps, 2);
  cache.bump();
  cache.classAt('s', 'l', at, 100);
  assert.equal(sweeps, 3);
});

test('a transient failure recovers after the expiry', () => {
  let t = 0, ready = false;
  const cache = createRoomCache({ sweep: () => (ready ? square(200) : null), now: () => t });
  assert.equal(cache.classAt('s', 'l', { x: 0, y: 0 }, 100), null);
  ready = true; t = 6000;
  assert.equal(cache.classAt('s', 'l', { x: 0, y: 0 }, 100), 'small');
});

test('a polygon with fewer than 3 vertices is a sweep failure', () => {
  assert.equal(createRoomCache({ sweep: () => [] }).classAt('s', 'l', { x: 0, y: 0 }, 100), null);
  assert.equal(createRoomCache({ sweep: () => [0, 0, 10, 10] }).classAt('s', 'l', { x: 0, y: 0 }, 100), null);
});

test('GM choice wins; other scene is dry', () => {
  assert.equal(roomFor({ animaterScene: 's', animaterAt: { x: 0, y: 0 } }, { sceneAcoustics: 'cave', viewedScene: 's', enabled: true }).kind, 'gm');
  assert.equal(roomFor({ animaterScene: 'other', animaterAt: { x: 0, y: 0 } }, { sceneAcoustics: null, viewedScene: 's', enabled: true, cache: fakeCache('room') }).kind, 'dry');
});

test('roomFor: reverb when enabled, in the viewed scene and enclosed', () => {
  const data = { animaterScene: 's', animaterAt: { x: 0, y: 0 } };
  const base = { sceneAcoustics: null, viewedScene: 's', enabled: true, gridPx: 100 };
  assert.deepEqual(roomFor(data, { ...base, cache: fakeCache('hall') }), { kind: 'reverb', room: 'hall' });
  assert.equal(roomFor(data, { ...base, cache: fakeCache('open') }).kind, 'dry');
  assert.equal(roomFor(data, { ...base, cache: fakeCache(null) }).kind, 'dry');
  assert.equal(roomFor(data, { ...base, enabled: false, cache: fakeCache('room') }).kind, 'dry');
  assert.equal(roomFor({ animaterScene: 's' }, { ...base, cache: fakeCache('room') }).kind, 'dry');
});

test('send follows the echo mix', () => {
  assert.equal(reverbSend('room', 0.5), 0.11);
  assert.equal(reverbSend('hall'), 0.32);
  assert.equal(reverbSend('open'), 0);
});

test('shapeImpulse trims to the tail and fades out', () => {
  const ones = new Float32Array(2000).fill(1);
  const [a, b] = shapeImpulse([ones, new Float32Array(ones)], 1000, { tail: 0.3 });
  assert.equal(a.length, 300);
  assert.equal(b.length, 300);
  assert.equal(a[100], 1);
  assert.ok(Math.abs(a[299]) < 1e-6);
  assert.ok(a[250] < 1 && a[250] > 0);
});

test('shapeImpulse keeps a short impulse whole', () => {
  const [a] = shapeImpulse([new Float32Array(100).fill(1)], 1000, { tail: 0.3 });
  assert.equal(a.length, 100);
});
