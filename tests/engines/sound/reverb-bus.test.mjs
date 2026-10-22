import test from 'node:test';
import assert from 'node:assert/strict';
import { createReverbBuses } from '../../../scripts/engines/sound/reverb-bus.mjs';

// A stand-in AudioContext: records every node it makes and every connection between them.
function fakeContext({ sampleRate = 1000 } = {}) {
  const made = [];
  const node = (kind, extra = {}) => {
    const n = { kind, outs: [], connect(to) { this.outs.push(to); return to; }, disconnect() { this.outs.length = 0; }, ...extra };
    made.push(n);
    return n;
  };
  const ctx = {
    sampleRate, made,
    destination: { kind: 'destination', outs: [] },
    createGain: () => node('gain', { gain: { value: 1 } }),
    createConvolver: () => node('convolver', { buffer: null, normalize: true }),
    createBiquadFilter: () => node('filter', { type: 'lowpass', frequency: { value: 350 } }),
    createBuffer: (channels, length, rate) => {
      const data = Array.from({ length: channels }, () => new Float32Array(length));
      return { numberOfChannels: channels, length, sampleRate: rate, copyToChannel: (src, i) => data[i].set(src), getChannelData: (i) => data[i] };
    },
  };
  // Foundry gives each of its contexts a master volume node in front of the speakers.
  ctx.gainNode = { kind: 'master', outs: [], connect() {} };
  return ctx;
}
// A 3 s stereo impulse at 1000 Hz.
const impulse = () => {
  const ch = [new Float32Array(3000).fill(1), new Float32Array(3000).fill(1)];
  return { numberOfChannels: 2, sampleRate: 1000, length: 3000, getChannelData: (i) => ch[i] };
};
const settle = () => new Promise((r) => setImmediate(r));
async function readyBuses(ctx) {
  let loads = 0;
  const buses = createReverbBuses({ loadImpulse: async () => { loads++; return impulse(); }, contextOf: () => ctx });
  buses.ready();
  await settle();
  return { buses, loads: () => loads };
}
const convolvers = (ctx) => ctx.made.filter((n) => n.kind === 'convolver');

test('three convolvers per context, built once', async () => {
  const a = fakeContext(), b = fakeContext();
  const { buses, loads } = await readyBuses(a);
  assert.equal(buses.ready(), true);
  buses.send(a, 'small', 0.1); buses.send(a, 'room', 0.2); buses.send(a, 'hall', 0.3); buses.send(a, 'room', 0.2);
  assert.equal(convolvers(a).length, 3);
  buses.send(b, 'room', 0.2);
  assert.equal(convolvers(b).length, 3);
  assert.equal(loads(), 1);
  // Each convolver holds the impulse cut to its room's tail.
  assert.deepEqual(convolvers(a).map((c) => c.buffer.length).sort((x, y) => x - y), [300, 800, 1800]);
  assert.equal(convolvers(a)[0].buffer.numberOfChannels, 2);
});

test('send wires into its class', async () => {
  const ctx = fakeContext();
  const { buses } = await readyBuses(ctx);
  const out = buses.send(ctx, 'room', 0.22);
  const conv = convolvers(ctx).find((c) => c.buffer.length === 800);
  // The send is the tap itself: the sound (after its volume) feeds it, and it feeds the room's convolver at the
  // send level. It is not an effect in the sound's chain, so the dry sound is left alone.
  assert.equal(out.kind, 'gain');
  assert.equal(out.gain.value, 0.22);
  assert.equal(out.onConnectFrom, undefined);
  assert.deepEqual(out.outs, [conv]);
  // Wet joins the context's master volume, as Foundry's own sounds do.
  assert.deepEqual(conv.outs, [ctx.gainNode]);
  // A fresh send each time.
  assert.notEqual(buses.send(ctx, 'room', 0.22), out);
  assert.equal(buses.send(ctx, 'open', 0.2), null);
});

test('buses wait for the context', async () => {
  let ctx = null, loads = 0;
  const buses = createReverbBuses({ loadImpulse: async () => { loads++; return impulse(); }, contextOf: () => ctx });
  const a = fakeContext();
  assert.equal(buses.ready(), false);
  assert.equal(buses.send(a, 'room', 0.2), null);
  await settle();
  assert.equal(loads, 0);
  ctx = a;
  assert.equal(buses.send(a, 'room', 0.2), null);
  assert.equal(buses.ready(), false);
  await settle();
  assert.equal(loads, 1);
  assert.equal(buses.ready(), true);
  assert.ok(buses.send(a, 'room', 0.2));
});

test('a failed load warns once and tries again after a pause', async () => {
  const ctx = fakeContext();
  let loads = 0, t = 0;
  const warnings = [];
  const buses = createReverbBuses({ loadImpulse: async () => { if (++loads <= 2) throw new Error('no file'); return impulse(); }, contextOf: () => ctx, now: () => t, warn: (...a) => warnings.push(a) });
  buses.ready();
  await settle();
  assert.equal(buses.ready(), false);
  await settle();
  assert.equal(loads, 1);
  t = 29000;
  assert.equal(buses.send(ctx, 'room', 0.2), null);
  await settle();
  assert.equal(loads, 1);
  t = 30000;
  buses.ready();
  await settle();
  assert.equal(loads, 2);
  assert.equal(warnings.length, 1);
  t = 60000;
  buses.ready();
  await settle();
  assert.equal(loads, 3);
  assert.equal(buses.ready(), true);
});

test('send never throws: a failed build plays dry and is not retried', async () => {
  const ctx = fakeContext();
  let builds = 0;
  ctx.createConvolver = () => { builds++; throw new Error('no convolver'); };
  const warnings = [];
  const buses = createReverbBuses({ loadImpulse: async () => impulse(), contextOf: () => ctx, warn: (...a) => warnings.push(a) });
  buses.ready();
  await settle();
  assert.equal(buses.send(ctx, 'room', 0.2), null);
  assert.equal(buses.send(ctx, 'hall', 0.3), null);
  assert.equal(builds, 1);
  assert.equal(warnings.length, 1);
  // A context that throws on anything still gets null.
  const broken = { get sampleRate() { throw new Error('closed'); } };
  assert.equal(buses.send(broken, 'room', 0.2), null);
});

test('each context gets the impulse at its own sample rate', async () => {
  const a = fakeContext({ sampleRate: 1000 }), b = fakeContext({ sampleRate: 2000 });
  const { buses } = await readyBuses(a);
  buses.send(a, 'room', 0.2); buses.send(b, 'room', 0.2);
  const roomOf = (ctx) => convolvers(ctx).find((c) => c.buffer.length === Math.round(0.8 * ctx.sampleRate));
  assert.equal(roomOf(a).buffer.sampleRate, 1000);
  assert.equal(roomOf(b).buffer.sampleRate, 2000);
  assert.equal(roomOf(b).buffer.getChannelData(0)[0], 1);
});

test('no send for a silent or missing level', async () => {
  const ctx = fakeContext();
  const { buses } = await readyBuses(ctx);
  for (const level of [0, -0.2, NaN, undefined, null, 'loud']) assert.equal(buses.send(ctx, 'room', level), null);
  assert.ok(buses.send(ctx, 'room', 0.01));
});

test('hall has a lowpass, small does not', async () => {
  const ctx = fakeContext();
  const { buses } = await readyBuses(ctx);
  buses.send(ctx, 'small', 0.1);
  const filters = ctx.made.filter((n) => n.kind === 'filter');
  assert.equal(filters.length, 1);
  assert.equal(filters[0].type, 'lowpass');
  assert.equal(filters[0].frequency.value, 4000);
  const hall = convolvers(ctx).find((c) => c.buffer.length === 1800), small = convolvers(ctx).find((c) => c.buffer.length === 300);
  assert.deepEqual(hall.outs, [filters[0]]);
  assert.deepEqual(filters[0].outs, [ctx.gainNode]);
  assert.deepEqual(small.outs, [ctx.gainNode]);
});

test('a context without a master volume goes to its speakers', async () => {
  const ctx = fakeContext();
  delete ctx.gainNode;
  const { buses } = await readyBuses(ctx);
  buses.send(ctx, 'small', 0.1);
  assert.deepEqual(convolvers(ctx).find((c) => c.buffer.length === 300).outs, [ctx.destination]);
});
