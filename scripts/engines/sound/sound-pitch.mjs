// Sequencer plays every sound at its recorded pitch, dry. A cue that asks for a slight pitch shift (a surface
// hit, so blow after blow is not the same sound) or an echo (a blow ringing off a shield or a ward) carries it
// in the sound's data; each client that plays it applies the same shaping as Foundry builds the sound's audio
// source, before it starts.
const MATCH_MS = 5000;
// An echo under the sound: the dry sound passes through untouched, and quieter, darker repeats join it (a
// feedback delay, wired as Foundry's own reverb effect is: the node is the output, the sound feeds it on connect).
function echoNode(context, { delay = 0.05, wet = 0.1, feedback = 0.1, tone = 3000 } = {}) {
  const out = context.createGain(), line = context.createDelay(1), dark = context.createBiquadFilter(), level = context.createGain(), back = context.createGain();
  line.delayTime.value = Math.min(0.9, Math.max(0.01, delay));
  dark.type = "lowpass"; dark.frequency.value = tone;
  level.gain.value = Math.min(0.5, Math.max(0, wet));
  back.gain.value = Math.min(0.5, Math.max(0, feedback));
  line.connect(dark); dark.connect(level); level.connect(out); dark.connect(back); back.connect(line);
  out.onConnectFrom = (node) => node.connect(line);
  return out;
}
// Where a sound happens, heard from this player's seat: their token (else the middle of their view). Further away
// is quieter and duller; left or right of the middle of the screen pans that way, gently.
export function placeSound(at, { ear, view, grid = 100 } = {}) {
  if (!at || !ear || !Number.isFinite(at.x) || !Number.isFinite(ear.x)) return null;
  const far = Math.max(0, Math.hypot(at.x - ear.x, at.y - ear.y) / (grid || 100) - 3);
  const pan = view?.width > 0 ? Math.max(-1, Math.min(1, (at.x - view.x) / (view.width / 2))) * 0.6 : 0;
  return { gain: Math.max(0.35, 1 / (1 + far * 0.07)), cutoff: Math.round(Math.max(2500, 20000 / (1 + far * 0.3))), pan: Math.round(pan * 100) / 100 };
}
// A scene's acoustics: open air swallows the echo; a hall or a cave lengthens it, and gives every other Animater
// sound a little room too.
export const ACOUSTICS = {
  outdoors: { delay: 0, wet: 0.45, feedback: 0, room: null },
  hall: { delay: 0.04, wet: 1.4, feedback: 0.1, room: { delay: 0.07, wet: 0.08, feedback: 0.2, tone: 3500 } },
  cave: { delay: 0.08, wet: 1.8, feedback: 0.2, tone: 2500, room: { delay: 0.11, wet: 0.12, feedback: 0.3, tone: 2500 } },
};
export function sceneEcho(echo, acoustics) {
  const a = ACOUSTICS[acoustics];
  if (!a) return echo;
  if (!echo) return a.room ? { ...a.room } : null;
  return { delay: echo.delay + a.delay, wet: echo.wet * a.wet, feedback: Math.min(0.5, (echo.feedback ?? 0) + a.feedback), tone: a.tone ? Math.min(a.tone, echo.tone ?? a.tone) : echo.tone };
}
// Each player's own mix of surface sounds: their level, how much blood they hear (gore), how much room (echo).
const GORE = { full: 1, subtle: 0.4, off: 0 };
export function mixSurfaceSound(data, mix) {
  const role = data?.animaterSurface;
  if (!role || !mix) return data;
  data.volume = Math.max(0, (Number(data.volume) || 0) * (mix.volume ?? 1) * (role === "blood" ? GORE[mix.gore] ?? 1 : 1));
  if (data.animaterEcho) data.animaterEcho = { ...data.animaterEcho, wet: (data.animaterEcho.wet ?? 0) * (mix.echo ?? 1) };
  return data;
}
// A wall between this player and a sound muffles it as Foundry muffles a door's sound (lowpass, intensity 5).
const MUFFLED_HZ = 600;
// Where walls are heard from: the selected token, else (a player) their own token, else (a player) the middle of
// their view. A GM with no token selected has no ear, as in Foundry: nothing is muffled for them.
export function muffleEar({ controlled = null, owned = null, isGM = false, view = null } = {}) {
  const token = controlled ?? (isGM ? null : owned);
  if (token) return token.center ?? null;
  return isGM ? null : view;
}
// room(data): the room the sound rings in, as { node(context) } giving its reverb send's input, or null. muffle(data): a wall
// stands between this player and the sound. Either one failing leaves the sound as it was.
export function createSoundShapeQueue({now = () => Date.now(), max = 1024} = {}) {
  const pending = new Map();
  let count = 0, sweepAt = -Infinity;
  const pathOf = src => { try { return decodeURIComponent(String(src ?? '')); } catch { return String(src ?? ''); } };
  const sweep = time => {
    if (time < sweepAt) return;
    sweepAt = time + 1000;
    for (const [file, list] of pending) {
      const fresh = list.filter(p => p.until > time);
      count -= list.length - fresh.length;
      if (fresh.length) pending.set(file, fresh); else pending.delete(file);
    }
  };
  return {
    add(file, shape) {
      const time = now(); sweep(time); file = pathOf(file);
      while (count >= max && pending.size) {
        const [key, list] = pending.entries().next().value;
        list.shift(); count--;
        if (!list.length) pending.delete(key);
      }
      const list = pending.get(file) ?? [];
      list.push({...shape, until: time + MATCH_MS}); pending.set(file, list); count++;
    },
    take(src) {
      const time = now(); sweep(time);
      const path = pathOf(src);
      for (const [file, list] of pending) {
        if (!path.endsWith(file)) continue;
        const fresh = list.filter(p => p.until > time), next = fresh.shift();
        count -= list.length - fresh.length;
        if (fresh.length) pending.set(file, fresh); else pending.delete(file);
        if (next) return next;
      }
      return null;
    },
    clear() { pending.clear(); count = 0; sweepAt = -Infinity; },
    get size() { return count; },
  };
}

export function installSoundPitch({ hooks = globalThis.Hooks, Sound = globalThis.foundry?.audio?.Sound, now = () => Date.now(), mix = () => null, listener = () => null, acoustics = () => null, enabled = () => true, room = () => null, muffle = () => false } = {}) {
  if (!hooks || !Sound?.prototype?._createNodes || Sound.prototype._createNodes.animaterPitch) return () => {};
  // Waiting shaping by file: Sequencer announces a sound just before Foundry loads and starts it.
  const pending = createSoundShapeQueue({now});
  const teardown = hooks.on('canvasTearDown', () => pending.clear());
  const id = hooks.on("createSequencerSound", (data) => {
    if (!data || typeof data !== "object") return;
    // This player turned the engine off: no surface hits, and Animater's other sounds play plain.
    if (!enabled()) { if (data.animaterSurface) data.volume = 0; return; }
    mixSurfaceSound(data, mix());
    const animater = data.animaterAt || data.animaterSurface || data.animaterEcho || data.animaterPitch;
    const place = animater && data.animaterAt ? placeSound(data.animaterAt, listener() ?? {}) : null;
    if (place) data.volume = (Number(data.volume) || 0) * place.gain;
    const rate = Number(data.animaterPitch), mixed = data.animaterEcho && typeof data.animaterEcho === "object" ? data.animaterEcho : null;
    const echo = animater ? sceneEcho(mixed, acoustics()) : mixed;
    // The walls around where it happens: the room it rings in, and whether one stands between it and this player.
    const walled = (fn) => { try { return data.animaterAt ? fn(data) : null; } catch { return null; } };
    const space = walled(room) ?? null, muffled = walled(muffle) === true;
    if (!((rate > 0 && rate !== 1) || echo || place || space || muffled) || typeof data.file !== "string") return;
    pending.add(data.file, { rate: rate > 0 ? rate : 1, echo, place, space, muffled });
  });
  // Animater's own positional sounds (footsteps, footfall thuds) ask for their pitch directly, just before they play,
  // so it is set as the sound's nodes are built: a short thud's whole impact is in its first milliseconds, and a rate
  // set after it starts would let that impact through at the recorded pitch.
  const direct = hooks.on("animater.shapeSound", (data) => {
    const rate = Number(data?.rate) > 0 ? Number(data.rate) : 1;
    // A heavy footfall may also ask to be darkened (`lowpass` Hz) and given body (`bass` dB, a low shelf).
    const lowpass = Number(data?.lowpass) > 0 ? Number(data.lowpass) : null, bass = Number(data?.bass) > 0 ? Math.min(15, Number(data.bass)) : null;
    if (typeof data?.file !== "string") return;
    // Where it happens (`at`: x, y, elevation, sceneId, level): it rings in the room and is muffled behind a wall
    // exactly as a hit is, at `roomShare` of a hit's room (a footstep is a small sound). Foundry's playAtPosition
    // already makes it quieter with distance, so distance only dulls and pans it here.
    const at = data.at && Number.isFinite(data.at.x) && Number.isFinite(data.at.y) ? data.at : null;
    let place = null, space = null, muffled = false, echo = null, roomShare = 1;
    if (at) {
      const where = { file: data.file, animaterAt: { x: at.x, y: at.y, elevation: at.elevation }, animaterScene: at.sceneId, animaterLevel: at.level };
      const share = Number(data.roomShare);
      roomShare = Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 1;
      try { place = placeSound(where.animaterAt, listener() ?? {}); } catch { place = null; }
      try { echo = sceneEcho(null, acoustics()); } catch { echo = null; }
      if (echo) echo = { ...echo, wet: (echo.wet ?? 0) * roomShare };
      try { space = room(where) ?? null; } catch { space = null; }
      try { muffled = muffle(where) === true; } catch { muffled = false; }
      if (!(roomShare > 0)) { space = null; echo = null; }
    }
    if (rate === 1 && !lowpass && !bass && !place && !space && !muffled && !echo) return;
    pending.add(data.file, { rate, lowpass, bass, echo, place, space, muffled, roomShare });
  });
  const take = (src) => {
    return pending.take(src);
  };
  const create = Sound.prototype._createNodes;
  function createNodes(...args) {
    const result = create.apply(this, args), shape = pending.size ? take(this.src) : null;
    if (shape) {
      const source = this.sourceNode;
      if (shape.rate !== 1) {
        if (source?.playbackRate) source.playbackRate.value = shape.rate;
        else if (this.element) { this.element.preservesPitch = false; this.element.playbackRate = shape.rate; }
      }
      // Foundry runs a sound through its effects before its volume: these join them for this play only. Distance
      // dulls it, a wall muffles it, its place on screen pans it, then the echo.
      if (source?.context && Array.isArray(this.effects)) {
        const added = [], c = source.context;
        if (shape.place?.cutoff < 18000 && c.createBiquadFilter) { const dull = c.createBiquadFilter(); dull.type = "lowpass"; dull.frequency.value = shape.place.cutoff; added.push(dull); }
        if (shape.muffled && c.createBiquadFilter) { const wall = c.createBiquadFilter(); wall.type = "lowpass"; wall.frequency.value = MUFFLED_HZ; added.push(wall); }
        // Weight: the slap on top filtered off, the low end lifted.
        if (shape.lowpass && c.createBiquadFilter) { const dark = c.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = shape.lowpass; added.push(dark); }
        if (shape.bass && c.createBiquadFilter) { const body = c.createBiquadFilter(); body.type = "lowshelf"; body.frequency.value = 110; body.gain.value = shape.bass; added.push(body); }
        // A boosted low end can run past full scale (a thud is nearly all bass): a fast, hard limiter last, just
        // under 0 dBFS, so a giant's footfall never clips.
        if (shape.bass && c.createDynamicsCompressor) {
          const limit = c.createDynamicsCompressor();
          limit.threshold.value = -3; limit.knee.value = 0; limit.ratio.value = 20; limit.attack.value = 0.001; limit.release.value = 0.1;
          added.push(limit);
        }
        if (shape.place?.pan && c.createStereoPanner) { const side = c.createStereoPanner(); side.pan.value = shape.place.pan; added.push(side); }
        if (shape.echo) added.push(echoNode(c, shape.echo));
        // A share of it all, taken after the sound's own volume, goes to the room's reverb: a muffled sound's room
        // is muffled too, and the sound's level, fades and mutes (Blood off) carry to its reverb. Foundry cuts every
        // output of the volume node when the sound stops.
        // A smaller sound (a footstep) sends only its share, through a gain of its own in front of the room.
        let send = null, share = null;
        if (shape.space && this.gainNode?.connect) {
          try {
            send = shape.space.node?.(c) ?? null;
            if (send && shape.roomShare < 1 && c.createGain) { share = c.createGain(); share.gain.value = shape.roomShare; share.connect(send); }
            if (send) this.gainNode.connect(share ?? send);
          } catch { try { share?.disconnect?.(); send?.disconnect?.(); } catch { /* gone */ } send = null; share = null; /* plays dry */ }
        }
        if (added.length) this.effects.push(...added);
        if (added.length || send) {
          const gain = this.gainNode;
          source.addEventListener?.("ended", () => {
            for (const n of added) { const i = this.effects.indexOf(n); if (i >= 0) this.effects.splice(i, 1); }
            if (send) {
              try { gain.disconnect(share ?? send); } catch { /* already cut at stop */ }
              if (share) { try { share.disconnect(); } catch { /* gone */ } }
              try { send.disconnect(); } catch { /* gone */ }
            }
          }, { once: true });
        }
      }
    }
    return result;
  }
  createNodes.animaterPitch = true;
  Sound.prototype._createNodes = createNodes;
  return () => { pending.clear(); hooks.off('canvasTearDown', teardown); hooks.off("createSequencerSound", id); hooks.off("animater.shapeSound", direct); if (Sound.prototype._createNodes === createNodes) Sound.prototype._createNodes = create; };
}
