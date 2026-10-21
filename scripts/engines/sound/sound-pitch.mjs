// Sequencer plays every sound at its recorded pitch. A cue that asks for a slight shift (a surface hit,
// so blow after blow is not the same sound) carries it in the sound's data; each client that plays it
// applies the same shift as Foundry builds the sound's audio source, before it starts.
const MATCH_MS = 5000;
export function installSoundPitch({ hooks = globalThis.Hooks, Sound = globalThis.foundry?.audio?.Sound, now = () => Date.now() } = {}) {
  if (!hooks || !Sound?.prototype?._createNodes || Sound.prototype._createNodes.animaterPitch) return () => {};
  // Waiting shifts by file: Sequencer announces a sound just before Foundry loads and starts it.
  const pending = new Map();
  const id = hooks.on("createSequencerSound", (data) => {
    const rate = Number(data?.animaterPitch);
    if (!(rate > 0) || rate === 1 || typeof data.file !== "string") return;
    pending.set(data.file, [...(pending.get(data.file) ?? []).filter((p) => p.until > now()), { rate, until: now() + MATCH_MS }]);
  });
  const take = (src) => {
    const path = decodeURIComponent(String(src ?? ""));
    for (const [file, list] of pending) {
      if (!path.endsWith(file)) continue;
      const fresh = list.filter((p) => p.until > now()), next = fresh.shift();
      if (fresh.length) pending.set(file, fresh); else pending.delete(file);
      if (next) return next.rate;
    }
    return null;
  };
  const create = Sound.prototype._createNodes;
  function createNodes(...args) {
    const result = create.apply(this, args), rate = pending.size ? take(this.src) : null;
    if (rate) {
      if (this.sourceNode?.playbackRate) this.sourceNode.playbackRate.value = rate;
      else if (this.element) { this.element.preservesPitch = false; this.element.playbackRate = rate; }
    }
    return result;
  }
  createNodes.animaterPitch = true;
  Sound.prototype._createNodes = createNodes;
  return () => { hooks.off("createSequencerSound", id); if (Sound.prototype._createNodes === createNodes) Sound.prototype._createNodes = create; };
}
