import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHolds, pausableTimeout } from '../../../scripts/integrations/sequencer-turbo/holds.mjs';

// Fake clock plus a timer queue, so tests control time exactly.
function makeClock() {
  let t = 0;
  let nextId = 1;
  const timers = new Map();
  return {
    now: () => t,
    set(fn, ms) {
      const id = nextId++;
      timers.set(id, { at: t + ms, fn });
      return id;
    },
    advanceTo(target) {
      for (;;) {
        let best = null;
        for (const [id, timer] of timers) {
          if (timer.at <= target && (!best || timer.at < best[1].at)) best = [id, timer];
        }
        if (!best) break;
        timers.delete(best[0]);
        t = best[1].at;
        best[1].fn();
      }
      t = target;
    },
    set time(value) { t = value; },
  };
}

test('one hold per session', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  clock.time = 1000;
  assert.equal(holds.hold('s', 100), true);
  assert.equal(holds.hold('s', 100), false);
  clock.time = 1050;
  assert.equal(holds.isHeld('s'), true);
  assert.equal(holds.untilMs('s'), 1100);
  clock.time = 1101;
  assert.equal(holds.isHeld('s'), false);
  assert.equal(holds.hold('s', 100), false);
  assert.equal(holds.isHeld('other'), false);
  assert.equal(holds.untilMs('other'), null);
});

test('forget lets a session be held again', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  holds.hold('s', 100);
  holds.forget('s');
  assert.equal(holds.isHeld('s'), false);
  assert.equal(holds.hold('s', 100), true);
});

test('heldMs counts only overlap', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  clock.time = 1000;
  holds.hold('s', 100);
  clock.time = 2000;
  assert.equal(holds.heldMs('s', 1050), 50);
  assert.equal(holds.heldMs('s', 0), 100);
  assert.equal(holds.heldMs('s', 1500), 0);
  assert.equal(holds.heldMs('none', 0), 0);
});

test('heldMs counts a hold that is still running only up to now', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  clock.time = 1000;
  holds.hold('s', 100);
  clock.time = 1030;
  assert.equal(holds.heldMs('s', 0), 30);
});

test('pausable timeout re-arms by held time', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  const calls = [];
  const arm = pausableTimeout(holds, 's', { set: clock.set, now: clock.now });
  const id = arm(() => calls.push(clock.now()), 300);
  assert.ok(id != null);
  clock.advanceTo(200);
  holds.hold('s', 100);
  clock.advanceTo(399);
  assert.deepEqual(calls, []);
  clock.advanceTo(1000);
  assert.deepEqual(calls, [400]);
});

test('pausable timeout without a hold fires on time', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  const calls = [];
  pausableTimeout(holds, 's', { set: clock.set, now: clock.now })(() => calls.push(clock.now()), 300);
  clock.advanceTo(1000);
  assert.deepEqual(calls, [300]);
});

test('pausable timeout armed during a hold waits for the rest of it only', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  const calls = [];
  clock.time = 100;
  holds.hold('s', 100);
  clock.time = 150;
  pausableTimeout(holds, 's', { set: clock.set, now: clock.now })(() => calls.push(clock.now()), 100);
  clock.advanceTo(1000);
  // armed at 150, due 250; held 150..200 overlaps by 50 -> 300
  assert.deepEqual(calls, [300]);
});

test('pausable timeout still running hold is waited out once', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  const calls = [];
  pausableTimeout(holds, 's', { set: clock.set, now: clock.now })(() => calls.push(clock.now()), 300);
  clock.advanceTo(250);
  holds.hold('s', 100);
  clock.advanceTo(1000);
  assert.deepEqual(calls, [400]);
});

test('holds are bounded', () => {
  const clock = makeClock();
  const holds = createHolds({ now: clock.now });
  for (let i = 0; i < 201; i++) holds.hold(`s${i}`, 100);
  clock.time = 50;
  assert.equal(holds.isHeld('s0'), false);
  assert.equal(holds.isHeld('s1'), true);
  assert.equal(holds.isHeld('s200'), true);
  assert.equal(holds.hold('s0', 100), true);
});
