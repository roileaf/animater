import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { skyStep, fallClock, SKY_STEP_MAX, FALL_WRAP, FALL_WRAP_FORCED } from '../../../scripts/engines/motion/sky-light.mjs';

// What falls is drawn as a lattice of cells scrolling with the fall clock, each cell's drop given its length, its place
// in the cell and its brightness by a hash of the cell's number. The card works both out in float32, which counts more
// coarsely the bigger the number: let the clock run far enough and neighbouring cells round together, every drop comes
// back the same, and the rain falls as one sheet of identical streaks instead of a scatter (reported from a long
// session: "after navigating away from the tab and coming back, it seems all the rain particles have synced up").

// The nearest rain layer's cell number, as rainAbove works it out: (log r + t * 1.6) * 33.1, five to a cell.
const cellOf = (clock) => Math.fround(clock * 1.6 * 33.1) / 5;
// How far apart float32 can still tell two numbers of this size: a cell counted this coarsely is a cell its neighbours
// fall into.
const step32 = (x) => Math.max(Number.MIN_VALUE, Math.abs(Math.fround(x)) * 2 ** -23);

test('a frame is a frame, however long the tab was hidden', () => {
  assert.equal(skyStep(0.016), 0.016);
  assert.equal(skyStep(900), SKY_STEP_MAX, 'a quarter hour away is not a quarter hour of rain in one draw');
  assert.equal(skyStep(-5), 0);
  assert.equal(skyStep(undefined), 0);
  assert.equal(fallClock(10, 900), 10 + SKY_STEP_MAX, 'the drops carry on from where they were');
});

test('the fall clock keeps the drops far enough apart for the card to tell them apart', () => {
  // A day at 60 frames a second, with the tab hidden now and then (the long frames that come of it included).
  let clock = 0, worst = 0;
  for (let frame = 0; frame < 60 * 60 * 24; frame++) {
    clock = fallClock(clock, frame % 9000 === 0 ? 600 : 1 / 60, { speed: 1.5, falling: frame % 9000 !== 0 });
    worst = Math.max(worst, cellOf(clock));
  }
  assert.ok(clock < FALL_WRAP_FORCED, `a day in, the clock is still ${clock.toFixed(0)}s`);
  assert.ok(step32(worst) < 0.05, `cells still get numbers of their own (${step32(worst).toFixed(3)} apart at worst)`);
});

test('the clock goes back an hour where it will not show: when nothing is falling', () => {
  assert.equal(fallClock(FALL_WRAP - 0.01, 0.02, { falling: false }) < 1, true, 'the hour comes off');
  assert.equal(fallClock(FALL_WRAP - 0.01, 0.02, { falling: true }) > FALL_WRAP, true, 'never mid-shower');
  // Rain that has not stopped in four hours gets it anyway: one frame of redealt drops beats drops counted as one.
  assert.ok(fallClock(FALL_WRAP_FORCED - 0.01, 0.02, { falling: true }) < FALL_WRAP);
  assert.ok(Math.abs(fallClock(100, 0.1, { speed: 2 }) - 100.2) < 1e-9, 'the weather\'s own speed still counts');
});

test('the weather\'s hash does not ask a sine about cells far from the origin', () => {
  const source = readFileSync(new URL('../../../scripts/engines/motion/sky-light.mjs', import.meta.url), 'utf8');
  const weather = source.slice(source.indexOf('const FRAG = `'), source.indexOf('const SHIMMER = `'));
  const hash = weather.match(/^float hash\(vec2 p\)\{.*$/m)?.[0] ?? '';
  assert.ok(hash, 'the weather shader has its hash');
  // fract(sin(x)) is worked out in float32: once x counts in the hundreds of millions it steps by more than a radian,
  // and whole swathes of cells come back with the one value (measured on an RTX card: an hour of rain left 11 different
  // drops out of 256, four hours one). A hash that only multiplies and takes fractions holds far out.
  assert.doesNotMatch(hash, /sin\(/, 'no sine in the hash the falling weather is laid out by');
  assert.match(hash, /fract\(/);
});
