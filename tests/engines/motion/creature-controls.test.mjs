import { test } from 'node:test';
import assert from 'node:assert/strict';
import { creatureAmount, creatureSize, sizePercent, ratStep } from '../../../scripts/engines/motion/vermin.mjs';
import { puffsFor } from '../../../scripts/engines/motion/movement-feel.mjs';

test('a scene\'s creature amounts and sizes, the usual when unset', () => {
  assert.equal(creatureAmount(''), 1);
  assert.equal(creatureAmount(undefined), 1);
  assert.equal(creatureAmount('none'), 0);
  assert.equal(creatureAmount('few'), 0.5);
  assert.equal(creatureAmount('many'), 3);
  assert.equal(creatureAmount('nonsense'), 1);
  assert.equal(creatureSize(''), 1);
  assert.equal(creatureSize('big'), 1.4);
  assert.equal(creatureSize('nonsense'), 1);
});

test('a size is a percent of the usual, and the whole map multiplies it', () => {
  assert.equal(creatureSize(25), 0.25);
  assert.equal(creatureSize('25'), 0.25, 'as a form saves it');
  assert.equal(creatureSize('small'), 0.7, 'scenes saved before the sliders look the same');
  assert.equal(creatureSize('huge'), 1.8);
  assert.equal(sizePercent(0), 10, 'never nothing');
  assert.equal(sizePercent(9999), 300);
  assert.equal(sizePercent(undefined), 100);
  assert.equal(sizePercent(null), 100);
  assert.equal(creatureSize(50, 50), 0.25);
  assert.equal(creatureSize('big', 50), 0.7);
  assert.equal(creatureSize(10, 10), 0.05, 'small enough to still draw');
  assert.equal(creatureSize(300, 300), 4, 'and no bigger than can');
});

test('a rat in the light runs out of it instead of turning on the spot', () => {
  // Bright to the left (x < 0), fading out to the right.
  const lit = (x) => (x < 0 ? 1 : Math.max(0, 0.9 - x / 100));
  const r = ratStep({ x: 0, y: 0, angle: 0, speed: 100, wait: 1 }, { dt: 0.02, grid: 100, lit, random: () => 0.5 });
  assert.ok(r.x > 0, 'stepped on toward the dark');
  assert.equal(r.angle, 0, 'did not turn');
});

test('a rat in the dark still turns back from the light', () => {
  const lit = (x) => (x > 10 ? 1 : 0);
  const r = ratStep({ x: 9, y: 0, angle: 0, speed: 100, wait: 1 }, { dt: 0.02, grid: 100, lit, random: () => 0.5 });
  assert.equal(r.x, 9, 'did not step into the light');
});

test('how much a step kicks up: fewer and fainter below the usual, none at nothing, footprints stay', () => {
  const at = { x: 0, y: 0, heading: 0, index: 2 }, bits = (floor, amount) => puffsFor(floor, at, { seed: 'k', grid: 100, amount }).filter((p) => p.kind !== 'print');
  assert.ok(bits('stone', 0.5).length < bits('stone', 1).length);
  assert.ok(bits('stone', 1.5).length > bits('stone', 1).length);
  const peak = (list) => Math.max(...list.map((p) => p.alpha));
  assert.ok(peak(bits('stone', 0.25)) < peak(bits('stone', 1)), 'fainter');
  assert.equal(bits('stone', 0).length, 0);
  assert.ok(puffsFor('snow', at, { seed: 'k', grid: 100, amount: 0 }).some((p) => p.kind === 'print'), 'prints stay');
});

// How much a rat's heading swings frame to frame: a shake is many big swings.
const swings = (rat, opts, frames = 180) => { let r = rat, n = 0, moved = 0; for (let i = 0; i < frames; i++) { const was = r; r = ratStep(r, { dt: 1 / 60, grid: 100, ...opts }); if (Math.abs(r.angle - was.angle) > 0.5) n++; moved = Math.max(moved, Math.hypot(r.x - rat.x, r.y - rat.y)); } return { n, moved, r }; };
let seed = 11; const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

test('a rat between a creature and a wall runs along the wall, it does not shake', () => {
  const wall = (a, b) => (a.x < 100) !== (b.x < 100), near = [{ x: 0, y: 0 }];
  const { n, moved } = swings({ x: 80, y: 0, angle: 0, speed: 0, wait: 1 }, { near, blocked: wall, random });
  assert.ok(n <= 8, `${n} swings in three seconds`);
  assert.ok(moved > 150, 'it got away');
});

test('a rat with no way out at all cowers, still', () => {
  const { n, moved, r } = swings({ x: 80, y: 0, angle: 0, speed: 0, wait: 1 }, { near: [{ x: 0, y: 0 }], blocked: () => true, random });
  assert.equal(moved, 0);
  assert.equal(n, 0, 'not turning on the spot');
  assert.equal(r.speed, 0);
});

test('a rat left alone in a corner stops and turns, it does not spin', () => {
  const corner = (a, b) => b.x > 100 || b.y > 100;
  const { n } = swings({ x: 90, y: 90, angle: 0.7, speed: 200, wait: 2 }, { blocked: corner, random }, 120);
  assert.ok(n <= 12, `${n} swings in two seconds`);
});
