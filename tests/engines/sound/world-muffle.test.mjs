import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorldMuffle } from '../../../scripts/engines/sound/world-muffle.mjs';

// An AudioContext as Foundry makes one: a master gainNode wired to the destination; nodes record their wiring.
function context(name) {
  const param = (v) => ({ value: v, target: null, setTargetAtTime(x) { this.target = x; }, cancelScheduledValues() {} });
  const node = (kind) => ({ kind, out: new Set(), connect(n) { this.out.add(n); return n; }, disconnect(n) { if (n === undefined) this.out.clear(); else if (!this.out.delete(n)) throw new Error('not connected'); } });
  const ctx = { name, currentTime: 1, state: 'running', destination: node('destination') };
  ctx.gainNode = node('master');
  ctx.gainNode.connect(ctx.destination);
  ctx.createBiquadFilter = () => Object.assign(node('lowpass'), { type: '', frequency: param(350), Q: param(1) });
  ctx.createGain = () => Object.assign(node('gain'), { gain: param(1) });
  return ctx;
}
const straight = (ctx) => ctx.gainNode.out.size === 1 && ctx.gainNode.out.has(ctx.destination);

function setup() {
  const music = context('music'), env = context('environment'), timers = [];
  let list = [music, env];
  const m = createWorldMuffle({ contexts: () => list, schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, cancel: () => {} });
  return { m, music, env, timers, setList: (l) => { list = l; } };
}

test('muffling inserts a lowpass and a duck between each context\'s master gain and its destination', () => {
  const { m, music, env } = setup();
  assert.ok(m.set({ cutoff: 800, gain: 0.4 }));
  for (const ctx of [music, env]) {
    const [lp] = [...ctx.gainNode.out];
    assert.equal(ctx.gainNode.out.size, 1);
    assert.equal(lp.kind, 'lowpass');
    assert.equal(lp.type, 'lowpass');
    assert.equal(lp.frequency.target, 800);
    const [duck] = [...lp.out];
    assert.equal(duck.gain.target, 0.4);
    assert.ok(duck.out.has(ctx.destination));
  }
  assert.deepEqual(m.active, { cutoff: 800, gain: 0.4 });
  // Deeper: the same nodes, new targets.
  m.set({ cutoff: 300, gain: 0.15 });
  assert.equal([...music.gainNode.out][0].frequency.target, 300);
  assert.equal(m.wired, 2);
});

test('release eases back open, then wires each context back as Foundry made it', () => {
  const { m, music, env, timers } = setup();
  m.set({ cutoff: 800, gain: 0.4 });
  const lp = [...music.gainNode.out][0];
  m.release({ ms: 900 });
  assert.equal(lp.frequency.target, 20000);
  assert.equal([...lp.out][0].gain.target, 1);
  assert.ok(!straight(music), 'still easing');
  timers.at(-1).fn();
  assert.ok(straight(music) && straight(env));
  assert.equal(m.wired, 0);
  assert.equal(m.active, null);
});

test('muffled again while releasing: kept wired; restore puts everything back at once', () => {
  const { m, music, env, timers } = setup();
  m.set({ cutoff: 800, gain: 0.4 });
  m.release();
  m.set({ cutoff: 600, gain: 0.3 });
  timers[0].fn();
  assert.equal(m.wired, 2, 'not unwired under a new muffle');
  m.restore();
  assert.ok(straight(music) && straight(env));
  assert.equal(m.active, null);
  assert.equal(m.release(), false, 'nothing to release');
});

test('contexts not made yet are skipped; a replaced or closed context is put back and forgotten', () => {
  const { m, music, env, setList } = setup();
  setList([undefined, null]);
  assert.equal(m.set({ cutoff: 800, gain: 0.5 }), false);
  setList([music, env]);
  m.set({ cutoff: 700, gain: 0.5 });
  assert.equal(m.wired, 2);
  env.state = 'closed';
  m.set({ cutoff: 600, gain: 0.5 });
  assert.equal(m.wired, 1);
  assert.ok(straight(env));
  m.restore();
  assert.ok(straight(music));
});

test('an analyser Foundry hung on the master gain stays connected', () => {
  const { m, music } = setup();
  const analyser = { kind: 'analyser' };
  music.gainNode.connect(analyser);
  m.set({ cutoff: 800, gain: 0.4 });
  assert.ok(music.gainNode.out.has(analyser));
  m.restore();
  assert.ok(music.gainNode.out.has(analyser) && music.gainNode.out.has(music.destination));
});
