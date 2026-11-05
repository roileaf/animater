import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duckStep, heronStep, frogStep } from '../../../scripts/engines/motion/pond-life.mjs';
import { rippleDue } from '../../../scripts/engines/motion/step-ripples.mjs';

const duck = (over = {}) => ({ x: 0, y: 0, a: 0, wait: 5, turn: 0, mode: 'swim', up: 0, h: 0, ...over });
const heron = (over = {}) => ({ x: 0, y: 0, hx: 0, hy: 0, a: 0, mode: 'stand', wait: 5, strike: 0, h: 0, t: 0, vx: 0, vy: 0, ...over });
const frog = (over = {}) => ({ x: 0, y: 0, hx: 0, hy: 0, a: 0, mode: 'sit', wait: 5, puff: 0, h: 0, t: 0, ...over });
const pond = (x, y) => Math.hypot(x, y) < 300;

test('a duck paddles round the pond and never climbs out of it', () => {
  let q = duck({ wait: 0 });
  for (let i = 0; i < 6000; i++) { q = duckStep(q, { dt: 1 / 60, grid: 100, ok: pond }); assert.ok(pond(q.x, q.y), `at ${q.x}, ${q.y}`); }
});

test('a duck clatters up away from anyone near, and comes down only on water', () => {
  const near = [{ x: 0, y: 100 }];
  const up = duckStep(duck(), { grid: 100, near, random: () => 0.5 });
  assert.equal(up.mode, 'fly');
  assert.ok(up.vy < 0, 'away from it');
  assert.equal(duckStep(duck(), { grid: 100, near: [{ x: 0, y: 900 }] }).mode, 'swim');
  assert.equal(duckStep(duck(), { grid: 100, scare: true, random: () => 0.5 }).mode, 'fly');
  let q = up; for (let i = 0; i < 10000 && q.mode === 'fly' && !q.gone; i++) q = duckStep(q, { dt: 1 / 60, grid: 100, ok: pond, random: () => 0.5 });
  assert.ok(q.gone || (q.mode === 'swim' && pond(q.x, q.y) && q.h === 0), `came down at ${q.x}, ${q.y}`);
  // No water anywhere: it does not land, it leaves.
  let lost = up; for (let i = 0; i < 10000 && !lost.gone; i++) lost = duckStep(lost, { dt: 1 / 60, grid: 100, ok: () => false, random: () => 0.5 });
  assert.equal(lost.gone, true);
});

test('a heron stands still till someone comes, flies, and returns to its spot only when it is clear', () => {
  let b = heron();
  for (let i = 0; i < 2000; i++) b = heronStep(b, { dt: 1 / 60, grid: 100 });
  assert.equal(b.mode, 'stand'); assert.deepEqual([b.x, b.y], [0, 0]);
  const near = [{ x: 0, y: 200 }];
  b = heronStep(b, { grid: 100, near });
  assert.equal(b.mode, 'fly'); assert.ok(b.vy < 0, 'away from it');
  // Someone still at its spot: it keeps away, whatever the time.
  for (let i = 0; i < 3000; i++) { b = heronStep(b, { dt: 1 / 60, grid: 100, near }); assert.equal(b.mode, 'fly'); }
  for (let i = 0; i < 5000 && b.mode === 'fly'; i++) b = heronStep(b, { dt: 1 / 60, grid: 100 });
  assert.equal(b.mode, 'stand'); assert.deepEqual([b.x, b.y, b.h], [0, 0, 0]);
});

test('a frog puffs on its pad, leaps into water from anyone near, and climbs back when it is clear', () => {
  const puffed = frogStep(frog({ wait: 0 }), { grid: 100, random: () => 0.5 });
  assert.ok(puffed.puff > 0);
  const near = [{ x: 0, y: 150 }];
  const off = frogStep(frog(), { grid: 100, near, ok: pond, random: () => 0.5 });
  assert.equal(off.mode, 'leap');
  assert.ok(off.ty < 0 && pond(off.tx, off.ty), 'ahead of them, into the water');
  let f = off; for (let i = 0; i < 40; i++) f = frogStep(f, { dt: 1 / 60, grid: 100, near, ok: pond, random: () => 0.5 });
  assert.equal(f.mode, 'swim'); assert.equal(f.h, 0);
  for (let i = 0; i < 2000; i++) f = frogStep(f, { dt: 1 / 60, grid: 100, near, ok: pond, random: () => 0.5 });
  assert.equal(f.mode, 'swim', 'stays under while they are by its pad');
  for (let i = 0; i < 4000 && f.mode !== 'sit'; i++) f = frogStep(f, { dt: 1 / 60, grid: 100, ok: pond, random: () => 0.5 });
  assert.equal(f.mode, 'sit'); assert.deepEqual([f.x, f.y], [0, 0]);
});

test('ducks and herons in flight stay out of walled and closed places', () => {
  const barred = (x, y) => y < -300;
  let q = duckStep(duck(), { grid: 100, near: [{ x: 0, y: 100 }], random: () => 0.5 });
  for (let i = 0; i < 2000 && q.mode === 'fly' && !q.gone; i++) { q = duckStep(q, { dt: 1 / 60, grid: 100, barred, ok: pond }); assert.ok(q.y >= -300, `at ${q.y}`); }
  let b = heronStep(heron(), { grid: 100, near: [{ x: 0, y: 200 }] });
  for (let i = 0; i < 2000 && b.mode === 'fly'; i++) { b = heronStep(b, { dt: 1 / 60, grid: 100, barred }); assert.ok(b.y >= -300, `at ${b.y}`); }
});

test('a ripple comes only when something has moved far enough since the last', () => {
  assert.equal(rippleDue(null, { x: 0, y: 0 }, 50), true, 'the first');
  assert.equal(rippleDue({ x: 0, y: 0 }, { x: 30, y: 0 }, 50), false);
  assert.equal(rippleDue({ x: 0, y: 0 }, { x: 30, y: 40 }, 50), true);
});

test('a frog with no water to leap into stays where it is', () => {
  const f = frogStep(frog(), { grid: 100, near: [{ x: 0, y: 150 }], ok: () => false, random: () => 0.5 });
  assert.equal(f.mode, 'sit');
});

test('a duck on water gone bad goes up and straight to good water, however far, and swims there', async () => {
  const { duckRunsOff } = await import('../../../scripts/engines/motion/pond-life.mjs');
  const good = (x) => x > 2500, spots = [{ x: 3000, y: 0 }], bad = (x) => x < 500, grid = 100;
  assert.equal(duckRunsOff(duck({ x: 1000 }), { spots, bad, grid }).flee, undefined, 'good water is left alone');
  let q = duckRunsOff(duck(), { spots, bad, grid });
  q = duckStep(q, { dt: 1 / 60, grid, ok: good });
  assert.equal(q.mode, 'fly');
  let top = 0, n = 0;
  while (q.mode === 'fly' && n++ < 2000) { q = duckStep(q, { dt: 1 / 60, grid, ok: good }); top = Math.max(top, q.h); }
  assert.equal(q.mode, 'swim', 'came down');
  assert.ok(good(q.x, q.y), 'on the good water');
  assert.ok(!q.gone);
  assert.ok(top > 0.9, 'and flew up to get there');
});

test('a duck with no good water left flies away and is gone, and comes to good water that turns up on its way', async () => {
  const { duckRunsOff } = await import('../../../scripts/engines/motion/pond-life.mjs');
  let q = duckRunsOff(duck(), { spots: [], bad: () => true });
  q = duckStep(q, { dt: 1 / 60, ok: () => false, random: () => 0.5 });
  assert.equal(q.leaving, true);
  for (let i = 0; i < 400 && !q.gone; i++) q = duckStep(q, { dt: 1 / 60, ok: () => false, random: () => 0.5 });
  assert.equal(q.gone, true);
  const flying = { ...duck(), mode: 'fly', t: 1, h: 1, vx: 1, vy: 0, to: { x: 50, y: 0 }, tries: 0 };
  const turned = duckRunsOff(flying, { spots: [{ x: 900, y: 0 }], bad: (x) => x < 100 });
  assert.equal(turned.to.x, 900, 'bound for water that went bad: on to other water');
});

test('a heron whose spot goes bad flies to new good water and stands there; with none it goes, and comes back to some', async () => {
  const { heronRunsOff } = await import('../../../scripts/engines/motion/pond-life.mjs');
  const dt = 1 / 30, spots = [{ x: 1500, y: 0 }], bad = (x) => x < 500;
  assert.equal(heronRunsOff(heron({ x: 900, hx: 900 }), { spots, bad }).flee, undefined);
  let b = heronStep(heronRunsOff(heron(), { spots, bad }), { dt });
  assert.equal(b.mode, 'fly');
  assert.equal(b.hx, 1500);
  assert.ok(b.vx > 0, 'heading for it');
  for (let i = 0; i < 1500 && b.mode === 'fly'; i++) b = heronStep(b, { dt });
  assert.equal(b.mode, 'stand');
  assert.deepEqual([b.x, b.y], [1500, 0]);
  let lost = heronStep(heronRunsOff(heron(), { spots: [], bad: () => true }), { dt, random: () => 0.5 });
  assert.equal(lost.leaving, true);
  for (let i = 0; i < 300 && !lost.gone; i++) lost = heronStep(lost, { dt, random: () => 0.5 });
  assert.equal(lost.gone, true);
  const again = heronRunsOff({ ...heron(), mode: 'fly', t: 2, leaving: true }, { spots, bad: () => false });
  assert.equal(again.leaving, false, 'water found while still leaving');
  assert.equal(again.hx, 1500);
});

test('a frog on water gone bad swims quickly under to a new pad, and its old pad sinks before the new one opens', async () => {
  const { frogRunsOff, padStep } = await import('../../../scripts/engines/motion/pond-life.mjs');
  const dt = 1 / 30, spots = [{ x: 800, y: 0 }, { x: 900, y: 0 }], bad = (x) => x < 500;
  assert.equal(frogRunsOff(frog({ x: 700, hx: 700 }), { spots, bad }).flee, undefined);
  let f = frogRunsOff(frog(), { spots, bad, taken: [{ x: 800, y: 0 }], swims: () => true });
  assert.equal(f.hx, 900, 'not on another frog\'s pad');
  let pad = { padX: f.padX, padY: f.padY, padA: f.padA };
  f = frogStep(f, { dt });
  assert.equal(f.mode, 'leap');
  let n = 0;
  for (; n < 900 && !(f.mode === 'sit' && !f.hurry); n++) { f = frogStep(f, { dt }); pad = padStep({ ...f, ...pad }, dt); }
  assert.equal(f.mode, 'sit');
  assert.deepEqual([f.x, f.y], [900, 0]);
  assert.ok(n * dt < 12, 'quickly: ' + (n * dt));
  assert.equal(pad.padX, 900);
  assert.ok(pad.padA > 0.5, 'and the new pad is open');
  const fading = padStep({ hx: 900, hy: 0, padX: 0, padY: 0, padA: 0.5 }, 0.1);
  assert.equal(fading.padX, 0);
  assert.ok(fading.padA < 0.5, 'the old one sinks first');
});

test('a frog with no water it can swim to stays under, and comes back when its own water comes good', async () => {
  const { frogRunsOff } = await import('../../../scripts/engines/motion/pond-life.mjs');
  const dt = 1 / 30, overLand = (x) => x < 300 || x > 700;
  let f = frogRunsOff(frog(), { spots: [{ x: 900, y: 0 }], bad: (x) => x < 300, swims: overLand });
  assert.equal(f.noPond, true, 'the other pond is over land');
  assert.equal(f.hx, 0);
  f = frogStep(f, { dt });
  for (let i = 0; i < 60; i++) f = frogStep(f, { dt });
  assert.equal(f.mode, 'swim');
  const x = f.x;
  for (let i = 0; i < 60; i++) f = frogStep(f, { dt });
  assert.equal(f.x, x, 'it waits');
  f = frogRunsOff(f, { spots: [{ x: 0, y: 0 }], bad: () => false });
  assert.equal(f.noPond, false);
  for (let i = 0; i < 900 && f.mode !== 'sit'; i++) f = frogStep(f, { dt });
  assert.equal(f.mode, 'sit');
  assert.deepEqual([f.x, f.y], [0, 0]);
});

test('ducks and herons driven onto the sea fly home when fresh water comes good, and not before', async () => {
  const { duckRunsOff, heronRunsOff } = await import('../../../scripts/engines/motion/pond-life.mjs');
  const sea = [{ x: 5000, y: 0 }], river = [{ x: 0, y: 0 }], poor = (x) => x < 500, none = () => false;
  const q = duckRunsOff(duck(), { spots: sea, bad: poor, home: false });
  assert.equal(q.exile, true);
  const settled = { ...q, flee: null, mode: 'swim', x: 5000 };
  assert.equal(duckRunsOff(settled, { spots: sea, bad: poor, home: false }).flee, null, 'still none: it stays');
  const back = duckRunsOff(settled, { spots: river, bad: none, home: true });
  assert.equal(back.flee.to, river[0]);
  assert.equal(back.exile, false);
  assert.equal(duckRunsOff(duck({ x: 5000 }), { spots: river, bad: none, home: true }).flee, undefined, 'one that lives there stays');
  const b = heronRunsOff(heron(), { spots: sea, bad: poor, home: false });
  assert.equal(b.exile, true);
  const home = heronRunsOff({ ...b, flee: null, hx: 5000, x: 5000 }, { spots: river, bad: none, home: true });
  assert.equal(home.flee.to, river[0]);
});
