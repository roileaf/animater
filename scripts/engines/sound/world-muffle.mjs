// Muffles the world's music and ambience on this screen (the wounded view, engines/camera/lens-wounds.mjs muffleFor):
// a lowpass and a duck laid between each Foundry audio context's master gain (game.audio.music / environment:
// ctx.gainNode, where every sound of that context ends) and its destination, eased in and out. Released, the
// context is wired back as Foundry made it (gainNode -> destination) and the nodes dropped. Interface sounds (the
// heartbeat, hit sounds) are never touched. contexts(): the AudioContexts to muffle now (missing ones skipped; Foundry
// makes them on the first user gesture).

const OPEN_HZ = 20000;

export function createWorldMuffle({ contexts = () => [], schedule = (fn, ms) => setTimeout(fn, ms), cancel = (h) => clearTimeout(h) } = {}) {
  // Per context: { lp, duck, target } while wired.
  const wired = new Map();
  let target = null, unwireTimer = null;
  const live = () => (contexts() ?? []).filter((c) => c && c.gainNode && c.destination && c.state !== 'closed');
  const unwire = (ctx) => {
    const w = wired.get(ctx);
    if (!w) return;
    wired.delete(ctx);
    try { ctx.gainNode.disconnect(w.lp); } catch { /* already apart */ }
    try { w.lp.disconnect(); } catch { /* gone */ }
    try { w.duck.disconnect(); } catch { /* gone */ }
    // Back as Foundry wires it, whatever happened in between.
    try { ctx.gainNode.connect(ctx.destination); } catch { /* the context is gone */ }
  };
  const wire = (ctx) => {
    let w = wired.get(ctx);
    if (w) return w;
    const lp = ctx.createBiquadFilter(), duck = ctx.createGain();
    lp.type = 'lowpass';
    lp.frequency.value = OPEN_HZ;
    lp.Q.value = 0.5;
    duck.gain.value = 1;
    try { ctx.gainNode.disconnect(ctx.destination); } catch { /* not wired straight: still insert ours */ }
    ctx.gainNode.connect(lp);
    lp.connect(duck);
    duck.connect(ctx.destination);
    w = { lp, duck };
    wired.set(ctx, w);
    return w;
  };
  const ease = (ctx, w, { cutoff, gain }, ms) => {
    const t = ctx.currentTime ?? 0, tc = Math.max(0.02, ms / 1000 / 3);
    try {
      w.lp.frequency.cancelScheduledValues?.(t);
      w.lp.frequency.setTargetAtTime(Math.max(40, Math.min(OPEN_HZ, cutoff)), t, tc);
      w.duck.gain.cancelScheduledValues?.(t);
      w.duck.gain.setTargetAtTime(Math.max(0, Math.min(1, gain)), t, tc);
    } catch {
      w.lp.frequency.value = cutoff;
      w.duck.gain.value = gain;
    }
  };
  const same = (a, b) => a && b && a.cutoff === b.cutoff && a.gain === b.gain;
  return {
    /** Muffles to { cutoff, gain } over ms (null releases, as release()). */
    set(m, { ms = 800 } = {}) {
      if (!m) return this.release({ ms });
      if (unwireTimer) { cancel(unwireTimer); unwireTimer = null; }
      const list = live();
      // Contexts Foundry replaced or closed are put back and forgotten.
      for (const ctx of [...wired.keys()]) if (!list.includes(ctx)) unwire(ctx);
      if (same(target, m) && list.every((c) => wired.has(c))) return true;
      target = { cutoff: m.cutoff, gain: m.gain };
      for (const ctx of list) { try { ease(ctx, wire(ctx), target, ms); } catch { unwire(ctx); } }
      return wired.size > 0;
    },
    /** Eases back to open, then unwires. */
    release({ ms = 900 } = {}) {
      if (!target && !wired.size) return false;
      target = null;
      for (const [ctx, w] of wired) { try { ease(ctx, w, { cutoff: OPEN_HZ, gain: 1 }, ms); } catch { /* unwired below */ } }
      if (unwireTimer) cancel(unwireTimer);
      unwireTimer = schedule(() => { unwireTimer = null; if (!target) for (const ctx of [...wired.keys()]) unwire(ctx); }, ms + 150);
      return true;
    },
    /** Puts every context back at once. */
    restore() {
      if (unwireTimer) { cancel(unwireTimer); unwireTimer = null; }
      target = null;
      for (const ctx of [...wired.keys()]) unwire(ctx);
    },
    get active() { return target ? { ...target } : null; },
    get wired() { return wired.size; },
  };
}
