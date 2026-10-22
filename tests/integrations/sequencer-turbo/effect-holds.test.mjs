import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { trackAnimaterEffect, untrackAnimaterEffect, holdSession, turboState, engineState } from '../../../scripts/integrations/sequencer-turbo/index.mjs';
import { turboizeEngine } from '../../../scripts/integrations/sequencer-turbo/engine.mjs';
import { createOriginalEngine } from '../../fixtures/sequencer-engine/original-engine.mjs';

// Fake timers, with performance.now following the fake clock (holds read it).
mock.timers.enable({ apis: ['setTimeout', 'Date'] });
mock.method(performance, 'now', () => Date.now());

let nextId = 0;
// Just the parts of a Sequencer CanvasEffect that holds touch.
function fakeEffect(session, { lasting = false } = {}) {
  return {
    data: { _id: `effect${nextId++}`, moduleName: 'animater', name: session, animaterLasting: lasting },
    get id() {
      return this.data._id;
    },
    destroyed: false,
    playing: true,
    get mediaIsPlaying() {
      return this.playing;
    },
    calls: [],
    _timeouts: new Set(),
    _setTimeout(fn, ms) {
      const id = setTimeout(() => {
        this._timeouts.delete(id);
        fn();
      }, ms);
      this._timeouts.add(id);
      return id;
    },
    async pauseMedia() {
      this.playing = false;
      this.calls.push('pause');
    },
    async playMedia() {
      this.playing = true;
      this.calls.push('play');
    },
  };
}

test('holdSession pauses and resumes this session only', () => {
  const a = fakeEffect('s1');
  const b = fakeEffect('s2');
  trackAnimaterEffect(a);
  trackAnimaterEffect(b);
  let ended = 0;
  a._setTimeout(() => ended++, 300);
  mock.timers.tick(100);

  assert.equal(holdSession('s1', 200), true);
  assert.equal(holdSession('s1', 200), false);
  assert.equal(turboState.holds.isHeld('s1'), true);
  assert.equal(a.playing, false);
  assert.equal(b.playing, true);
  assert.deepEqual(b.calls, []);

  mock.timers.tick(200);
  assert.equal(a.playing, true);
  assert.deepEqual(a.calls, ['pause', 'play']);
  // The 300 ms end timer waits out the 200 ms hold.
  assert.equal(ended, 0);
  mock.timers.tick(199);
  assert.equal(ended, 0);
  assert.equal(a._timeouts.size, 1);
  mock.timers.tick(1);
  assert.equal(ended, 1);
  assert.equal(a._timeouts.size, 0);
  untrackAnimaterEffect(a);
  untrackAnimaterEffect(b);
});

test('resume skips destroyed effects', () => {
  const a = fakeEffect('s3');
  const b = fakeEffect('s3');
  trackAnimaterEffect(a);
  trackAnimaterEffect(b);
  assert.equal(holdSession('s3', 100), true);
  assert.deepEqual(a.calls, ['pause']);
  assert.deepEqual(b.calls, ['pause']);
  a.destroyed = true;
  untrackAnimaterEffect(b);
  mock.timers.tick(100);
  assert.deepEqual(a.calls, ['pause']);
  assert.deepEqual(b.calls, ['pause']);
  untrackAnimaterEffect(a);
});

test('lasting effects keep their own timers', () => {
  const lasting = fakeEffect('s4', { lasting: true });
  const own = lasting._setTimeout;
  trackAnimaterEffect(lasting);
  assert.equal(lasting._setTimeout, own);
  let fired = 0;
  lasting._setTimeout(() => fired++, 100);
  holdSession('s4', 500);
  mock.timers.tick(100);
  assert.equal(fired, 1);

  const brief = fakeEffect('s5');
  const original = brief._setTimeout;
  trackAnimaterEffect(brief);
  assert.notEqual(brief._setTimeout, original);
  untrackAnimaterEffect(lasting);
  untrackAnimaterEffect(brief);
});

test('other modules\' effects are not tracked', () => {
  const other = fakeEffect('s6');
  other.data.moduleName = 'someone-else';
  const own = other._setTimeout;
  trackAnimaterEffect(other);
  assert.equal(other._setTimeout, own);
  holdSession('s6', 100);
  assert.deepEqual(other.calls, []);
});

test('media Sequencer paused itself stays paused after the hold', () => {
  const gap = fakeEffect('s7');
  gap.playing = false; // e.g. waiting out a loop delay
  const live = fakeEffect('s7');
  trackAnimaterEffect(gap);
  trackAnimaterEffect(live);
  holdSession('s7', 100);
  mock.timers.tick(100);
  assert.deepEqual(gap.calls, []);
  assert.equal(gap.playing, false);
  assert.deepEqual(live.calls, ['pause', 'play']);
  untrackAnimaterEffect(gap);
  untrackAnimaterEffect(live);
});

test('a held session\'s tracked effect stops advancing in the turbo engine; others run on', () => {
  globalThis.foundry ??= { utils: { randomID: () => `id${nextId++}` } };
  const engine = createOriginalEngine();
  turboizeEngine(engine, engineState);
  engine.ticker = { elapsedMS: 50, deltaMS: 50, add() {} };
  const frozen = fakeEffect('s9'), other = fakeEffect('s10'), untracked = fakeEffect('s9');
  trackAnimaterEffect(frozen);
  trackAnimaterEffect(other);
  // Sequencer animates an effect's sprite with the effect id as the origin.
  const [a, b, c] = [{ id: 'a', alpha: 0 }, { id: 'b', alpha: 0 }, { id: 'c', alpha: 0 }];
  engine.addAnimation(frozen.id, { target: a, propertyName: 'alpha', from: 0, to: 1, duration: 200, delay: 0, absolute: true });
  engine.addAnimation(other.id, { target: b, propertyName: 'alpha', from: 0, to: 1, duration: 200, delay: 0, absolute: true });
  engine.addAnimation(untracked.id, { target: c, propertyName: 'alpha', from: 0, to: 1, duration: 200, delay: 0, absolute: true });
  engine.nextFrame();
  assert.deepEqual([a.alpha, b.alpha, c.alpha], [0.25, 0.25, 0.25]);

  assert.equal(holdSession('s9', 100), true);
  engine.nextFrame();
  // Only the tracked effect of the held session waits; an untracked origin of the same name runs.
  assert.deepEqual([a.alpha, b.alpha, c.alpha], [0.25, 0.5, 0.5]);

  mock.timers.tick(100);
  engine.nextFrame();
  assert.deepEqual([a.alpha, b.alpha, c.alpha], [0.5, 0.75, 0.75]);
  untrackAnimaterEffect(frozen);
  untrackAnimaterEffect(other);
});

test('an effect without _setTimeout is tracked without wrapping', () => {
  const bare = fakeEffect('s8');
  delete bare._setTimeout;
  assert.doesNotThrow(() => trackAnimaterEffect(bare));
  assert.equal(bare._setTimeout, undefined);
  holdSession('s8', 100);
  assert.deepEqual(bare.calls, ['pause']);
  untrackAnimaterEffect(bare);
});
