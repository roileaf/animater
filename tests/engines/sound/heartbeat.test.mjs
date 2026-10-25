import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heartbeatPlan, heartbeatLinger, heartbeatWanted, HEARTBEAT, playHeartbeat } from '../../../scripts/engines/sound/heartbeat.mjs';
import { LENS_BLOOD } from '../../../scripts/engines/camera/lens-blood.mjs';

const hp = (value, max = 40) => ({ value, max, down: value <= 0, marked: false });
const gaps = (beats) => beats.slice(1).map((b, i) => b.at - beats[i].at);

test('a hit: a few heavy beats that slow and fade, within the tunnel pulse', () => {
  const plan = heartbeatPlan(0.6);
  assert.ok(plan.length >= 3);
  const g = gaps(plan);
  for (let i = 1; i < g.length; i++) assert.ok(g[i] > g[i - 1], 'slows');
  for (let i = 1; i < plan.length; i++) assert.ok(plan[i].gain < plan[i - 1].gain, 'fades');
  assert.equal(plan[0].at, 0);
  assert.ok(plan.at(-1).at < LENS_BLOOD.tunnelMs(0.6));
  for (const b of plan) assert.ok(b.dubAt > 200 && b.dubAt < 340 && b.dubGain < b.gain);
});

test('harder hits: louder, faster, more beats', () => {
  const light = heartbeatPlan(0.2), heavy = heartbeatPlan(1);
  assert.ok(heavy.length > light.length);
  assert.ok(heavy[0].gain > light[0].gain);
  assert.ok(gaps(heavy)[0] < gaps(light)[0]);
  assert.ok(light.length >= 2 && heavy.length <= 6);
});

test('Subtle: quieter and fewer beats', () => {
  const heavy = heartbeatPlan(0.8), subtle = heartbeatPlan(0.8, { amount: 'subtle' });
  assert.ok(subtle.length < heavy.length);
  assert.ok(subtle[0].gain < heavy[0].gain);
  assert.deepEqual(heartbeatPlan(0), []);
});

test('only on a player\'s screen with its switch on, gore not off and quality not Off', () => {
  const on = { isGM: false, on: true, quality: 'full', gore: 'full' };
  assert.equal(heartbeatWanted(on), true);
  assert.equal(heartbeatWanted({ ...on, isGM: true }), false);
  assert.equal(heartbeatWanted({ ...on, on: false }), false);
  assert.equal(heartbeatWanted({ ...on, quality: 'off' }), false);
  assert.equal(heartbeatWanted({ ...on, gore: 'off' }), false);
});

test('lingering beat at or under a quarter HP in combat: slower, heavier and fainter in its second beat the lower, quiet', () => {
  const base = { isGM: false, on: true, inCombat: true, quality: 'full', gore: 'full' };
  const at8 = heartbeatLinger(hp(8), base), at2 = heartbeatLinger(hp(2), base);
  assert.ok(at8 && at2);
  assert.ok(at2.intervalMs > at8.intervalMs, 'slows as death nears');
  assert.ok(at2.intervalMs >= 1300 && heartbeatLinger(hp(10), base).intervalMs <= 750, 'about 85 bpm at a quarter HP, about 40 near 0');
  assert.ok(at2.dubAt > at8.dubAt && at2.dubGain / at2.gain < at8.dubGain / at8.gain, 'the second beat comes later and fainter');
  assert.ok(at2.gain >= at8.gain, 'heavier');
  assert.ok(at8.gain > 0 && at8.gain < heartbeatPlan(0.3)[0].gain);
  assert.ok(heartbeatLinger(hp(2), { ...base, amount: 'subtle' }).gain < at2.gain);
});

test('lingering beat stops when healed, out of combat, down, for a GM or with the switch off', () => {
  const base = { isGM: false, on: true, inCombat: true, quality: 'full', gore: 'full' };
  assert.equal(heartbeatLinger(hp(11), base), null);
  assert.equal(heartbeatLinger(hp(5), { ...base, inCombat: false }), null);
  assert.equal(heartbeatLinger(hp(0), base), null);
  assert.equal(heartbeatLinger(hp(5), { ...base, isGM: true }), null);
  assert.equal(heartbeatLinger(hp(5), { ...base, on: false }), null);
  assert.equal(heartbeatLinger(null, base), null);
  assert.equal(heartbeatLinger({ ...hp(5), unconscious: true }, base), null);
});

test('playHeartbeat schedules a lub and a dub per beat on the given context, scaled by volume', () => {
  const started = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() { return this; }, disconnect() {}, gain: param(), frequency: param(), start(t) { started.push(t); }, stop() {} });
  const ctx = { currentTime: 10, sampleRate: 8000, createOscillator: node, createGain: node, createBiquadFilter: node,
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }), createBufferSource: node };
  const plan = heartbeatPlan(0.6);
  const stop = playHeartbeat(ctx, node(), plan, { volume: 0.5 });
  assert.equal(typeof stop, 'function');
  // Lub and dub oscillators plus a click each.
  assert.ok(started.length >= plan.length * 2);
  assert.ok(started.every((t) => t >= 10));
  assert.equal(playHeartbeat(ctx, node(), plan, { volume: 0 }), null);
  assert.ok(HEARTBEAT.volume > 0 && HEARTBEAT.volume <= 1);
  stop();
});
