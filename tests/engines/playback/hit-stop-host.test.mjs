import test from 'node:test';
import assert from 'node:assert/strict';
import { createHitStopHost, sessionUser } from '../../../scripts/engines/playback/hit-stop-host.mjs';

const SESSION = 'animater-u1-1b4e28ba-2fa1-11d2-883f-0016d3cca427';
const tag = { afterMs: 300, holdMs: 120 };

function make({ ok = true } = {}) {
  const out = { timers: [], effects: [], motions: [], ok };
  const host = createHitStopHost({
    allowed: () => out.ok,
    holdEffects: (s, ms) => out.effects.push([s, ms]),
    holdMotions: (o, ms) => out.motions.push([o, ms]),
    schedule: (fn, ms) => out.timers.push({ fn, ms }),
    now: () => 0,
  });
  return { host, out };
}

test('one freeze per session at afterMs', () => {
  const { host, out } = make();
  host.onEffect({ name: SESSION, animaterHitStop: tag });
  host.onEffect({ name: SESSION, animaterHitStop: { afterMs: 500, holdMs: 99 } });
  assert.equal(out.timers.length, 1);
  assert.equal(out.timers[0].ms, 300);
  out.timers[0].fn();
  assert.deepEqual(out.effects, [[SESSION, 120]]);
  assert.deepEqual(out.motions, [[`u1:${SESSION}`, 120]]);
});

test('motion and effect arrivals of a session share one freeze', () => {
  const { host, out } = make();
  host.onMotion({ userId: 'u1', session: SESSION, stage: { hitStop: tag } });
  host.onEffect({ name: SESSION, animaterHitStop: tag });
  assert.equal(out.timers.length, 1);
  out.timers[0].fn();
  assert.deepEqual(out.motions, [[`u1:${SESSION}`, 120]]);
});

test('not allowed at fire time: nothing held', () => {
  const { host, out } = make();
  host.onEffect({ name: SESSION, animaterHitStop: tag });
  out.ok = false;
  out.timers[0].fn();
  assert.deepEqual(out.effects, []);
  assert.deepEqual(out.motions, []);
});

test('untagged and foreign data ignored', () => {
  const { host, out } = make();
  host.onEffect({ name: SESSION });
  host.onEffect({ name: 'other-u1-x', animaterHitStop: tag });
  host.onEffect({ name: SESSION + 'x', animaterHitStop: { afterMs: -1, holdMs: 100 } });
  host.onEffect(undefined);
  host.onMotion({ userId: 'u1', stage: { hitStop: tag } });
  host.onMotion({ userId: 'u1', session: SESSION, stage: {} });
  assert.equal(out.timers.length, 0);
});

test('the user id is the second segment of the session', () => {
  assert.equal(sessionUser(SESSION), 'u1');
  assert.equal(sessionUser('nope'), '');
});
