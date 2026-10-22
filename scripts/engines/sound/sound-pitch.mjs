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
export function installSoundPitch({ hooks = globalThis.Hooks, Sound = globalThis.foundry?.audio?.Sound, now = () => Date.now(), mix = () => null, listener = () => null, acoustics = () => null, enabled = () => true, room = () => null, muffle = () => false } = {}) {
  if (!hooks || !Sound?.prototype?._createNodes || Sound.prototype._createNodes.animaterPitch) return () => {};
  // Waiting shaping by file: Sequencer announces a sound just before Foundry loads and starts it.
  const pending = new Map();
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
    pending.set(data.file, [...(pending.get(data.file) ?? []).filter((p) => p.until > now()), { rate: rate > 0 ? rate : 1, echo, place, space, muffled, until: now() + MATCH_MS }]);
  });
  const take = (src) => {
    const path = decodeURIComponent(String(src ?? ""));
    for (const [file, list] of pending) {
      if (!path.endsWith(file)) continue;
      const fresh = list.filter((p) => p.until > now()), next = fresh.shift();
      if (fresh.length) pending.set(file, fresh); else pending.delete(file);
      if (next) return next;
    }
    return null;
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
        if (shape.place?.pan && c.createStereoPanner) { const side = c.createStereoPanner(); side.pan.value = shape.place.pan; added.push(side); }
        if (shape.echo) added.push(echoNode(c, shape.echo));
        // A share of it all, taken after the sound's own volume, goes to the room's reverb: a muffled sound's room
        // is muffled too, and the sound's level, fades and mutes (Blood off) carry to its reverb. Foundry cuts every
        // output of the volume node when the sound stops.
        let send = null;
        if (shape.space && this.gainNode?.connect) {
          try { send = shape.space.node?.(c) ?? null; if (send) this.gainNode.connect(send); } catch { try { send?.disconnect?.(); } catch { /* gone */ } send = null; /* plays dry */ }
        }
        if (added.length) this.effects.push(...added);
        if (added.length || send) {
          const gain = this.gainNode;
          source.addEventListener?.("ended", () => {
            for (const n of added) { const i = this.effects.indexOf(n); if (i >= 0) this.effects.splice(i, 1); }
            if (send) { try { gain.disconnect(send); } catch { /* already cut at stop */ } try { send.disconnect(); } catch { /* gone */ } }
          }, { once: true });
        }
      }
    }
    return result;
  }
  createNodes.animaterPitch = true;
  Sound.prototype._createNodes = createNodes;
  return () => { hooks.off("createSequencerSound", id); if (Sound.prototype._createNodes === createNodes) Sound.prototype._createNodes = create; };
}
