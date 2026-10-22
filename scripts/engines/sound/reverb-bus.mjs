// Room-aware sound, the audio side: one shared reverb per room class per audio context. A sound joins the room
// it is heard in through a send: a quieter copy of the sound, taken after its own volume, feeds the room's
// convolver, while the dry sound plays on untouched.
import { ROOMS, shapeImpulse } from './room-acoustics.mjs';

// Foundry's own reverb impulse, loaded as its ConvolverEffect does.
const IMPULSE = 'sounds/impulse-responses/ir-full.wav';
const RETRY_MS = 30000;
function loadFoundryImpulse(context) {
  return new globalThis.foundry.audio.Sound(IMPULSE, { context }).load().then((s) => s.buffer);
}
// The impulse at another sample rate (a convolver only takes a buffer at its context's rate): straight-line
// in-between samples are good enough for a reverb tail.
function resample(channel, from, to) {
  const n = Math.max(1, Math.round(channel.length * to / from)), out = new Float32Array(n), step = from / to;
  for (let i = 0; i < n; i++) {
    const at = i * step, j = Math.floor(at), k = Math.min(channel.length - 1, j + 1), f = at - j;
    out[i] = (channel[j] ?? 0) * (1 - f) + (channel[k] ?? 0) * f;
  }
  return out;
}

// An impulse channel scaled to carry a sound's energy through unchanged (sum of squares 1): a send at level L
// comes back as a room L² as strong as the sound.
function unitEnergy(channel) {
  let sum = 0;
  for (const v of channel) sum += v * v;
  if (!(sum > 0)) return channel;
  const k = 1 / Math.sqrt(sum), out = new Float32Array(channel.length);
  for (let i = 0; i < channel.length; i++) out[i] = channel[i] * k;
  return out;
}

export function createReverbBuses({ contextOf = () => null, loadImpulse = () => loadFoundryImpulse(contextOf()), now = () => Date.now(), warn = (...a) => console.warn(...a) } = {}) {
  // The loaded impulse, and its cut to each room's tail per sample rate (worked out once per rate).
  let impulse = null, loading = null, retryAt = 0, warned = false;
  const shapedByRate = new Map();
  // Each context's convolvers; false where building them failed, so it is not tried again for every sound.
  const buses = new WeakMap();
  const load = () => {
    if (impulse || loading || now() < retryAt || !contextOf()) return;
    loading = Promise.resolve().then(loadImpulse).then((buffer) => {
      const samples = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      impulse = { samples, sampleRate: buffer.sampleRate };
    }).catch((err) => {
      retryAt = now() + RETRY_MS;
      if (!warned) { warned = true; warn('Animater | room reverb unavailable; sounds play dry', err); }
    }).finally(() => { loading = null; });
  };
  const shapedAt = (rate) => {
    if (shapedByRate.has(rate)) return shapedByRate.get(rate);
    const samples = rate === impulse.sampleRate ? impulse.samples : impulse.samples.map((c) => resample(c, impulse.sampleRate, rate));
    const rooms = {};
    for (const [room, { tail }] of Object.entries(ROOMS)) rooms[room] = shapeImpulse(samples, rate, { tail });
    shapedByRate.set(rate, rooms);
    return rooms;
  };
  // A context's convolvers, built on first use and wired to the node Foundry sends its sounds to (the context's
  // master volume when it has one), so this player's volume for that context still applies.
  const busesFor = (context) => {
    if (buses.has(context)) return buses.get(context);
    let set = false;
    try {
      const rate = context.sampleRate || impulse.sampleRate, shaped = shapedAt(rate), out = context.gainNode ?? context.destination;
      set = {};
      for (const [room, { lowpass }] of Object.entries(ROOMS)) {
        const channels = shaped[room];
        const buffer = context.createBuffer(channels.length, channels[0].length, rate);
        channels.forEach((c, i) => buffer.copyToChannel(unitEnergy(c), i));
        // The browser's own normalizing is calibrated so quiet that the room sank ~30 dB under the dry sound:
        // the impulse is scaled here instead, so the send level alone sets how loud the room is.
        const convolver = context.createConvolver();
        convolver.normalize = false;
        convolver.buffer = buffer;
        if (lowpass) {
          const dark = context.createBiquadFilter();
          dark.type = 'lowpass'; dark.frequency.value = lowpass;
          convolver.connect(dark); dark.connect(out);
        } else convolver.connect(out);
        set[room] = convolver;
      }
    } catch (err) {
      set = false;
      warn('Animater | room reverb could not be built for an audio context', err);
    }
    buses.set(context, set);
    return set;
  };
  return {
    ready() { load(); return !!impulse; },
    // Runs inside Foundry's play path: never throws, null means "play it dry". Else the send's input: the caller
    // feeds it the sound after its volume, so the sound's own level, fades and mutes scale its reverb too.
    send(context, room, level) {
      try {
        load();
        if (!impulse || !context || !ROOMS[room] || !(Number.isFinite(level) && level > 0)) return null;
        const into = busesFor(context)?.[room];
        if (!into) return null;
        const tap = context.createGain();
        tap.gain.value = level;
        tap.connect(into);
        return tap;
      } catch {
        return null;
      }
    },
  };
}
