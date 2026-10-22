// Room-aware sound, the audio side: one shared reverb per room class per audio context. A sound joins the room
// it is heard in through a send, which slots into its effects like Foundry's own reverb: the dry sound passes
// through untouched and a quieter copy feeds the room's convolver.
import { ROOMS, shapeImpulse } from './room-acoustics.mjs';

// Foundry's own reverb impulse, loaded as its ConvolverEffect does.
const IMPULSE = 'sounds/impulse-responses/ir-full.wav';
function loadFoundryImpulse(context) {
  return new globalThis.foundry.audio.Sound(IMPULSE, { context }).load().then((s) => s.buffer);
}

export function createReverbBuses({ contextOf = () => null, loadImpulse = () => loadFoundryImpulse(contextOf()) } = {}) {
  // The impulse cut to each room's tail, worked out once and copied into each context's convolvers.
  let shaped = null, loading = null;
  const buses = new WeakMap();
  const load = () => {
    if (shaped || loading || !contextOf()) return;
    loading = Promise.resolve().then(loadImpulse).then((buffer) => {
      const samples = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
      const rooms = {};
      for (const [room, { tail }] of Object.entries(ROOMS)) rooms[room] = shapeImpulse(samples, buffer.sampleRate, { tail });
      shaped = { rooms, sampleRate: buffer.sampleRate };
    }).catch(() => {}).finally(() => { loading = null; });
  };
  // A context's convolvers, built on first use and wired to the node Foundry sends its sounds to (the context's
  // master volume when it has one), so this player's volume for that context still applies.
  const busesFor = (context) => {
    let set = buses.get(context);
    if (set) return set;
    set = {};
    const out = context.gainNode ?? context.destination;
    for (const [room, { lowpass }] of Object.entries(ROOMS)) {
      const channels = shaped.rooms[room];
      const buffer = context.createBuffer(channels.length, channels[0].length, shaped.sampleRate);
      channels.forEach((c, i) => buffer.copyToChannel(c, i));
      const convolver = context.createConvolver();
      convolver.buffer = buffer;
      if (lowpass) {
        const dark = context.createBiquadFilter();
        dark.type = 'lowpass'; dark.frequency.value = lowpass;
        convolver.connect(dark); dark.connect(out);
      } else convolver.connect(out);
      set[room] = convolver;
    }
    buses.set(context, set);
    return set;
  };
  return {
    ready() { load(); return !!shaped; },
    send(context, room, level) {
      load();
      if (!shaped || !context || !ROOMS[room]) return null;
      const into = busesFor(context)[room];
      const through = context.createGain(), tap = context.createGain();
      tap.gain.value = Math.max(0, Number(level) || 0);
      tap.connect(into);
      through.onConnectFrom = (node) => node.connect(tap);
      return through;
    },
  };
}
