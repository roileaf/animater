// Gusts of wind at a place: the air a great wing pushes, or anything else that blows for a moment in one spot. The
// scene's own wind is one value for the whole map; a gust is added to it only near where it is, so the trees, flames
// and cloth there bend and the rest of the map stays as it was. Pure: no canvas, the clock handed in.

// How long a gust takes to rise, and to die away once ended, in ms: nothing snaps over or snaps back.
export const GUST_EASE_MS = 330;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (k) => { const t = clamp(k, 0, 1); return t * t * (3 - 2 * t); };

/**
 * How much of a gust is felt at a point (pure), 0-1. `g`: { x, y, heading, width, length } in map pixels, blowing the
 * way it heads. Strongest a little behind its head; it dies away to the sides over `width`, behind over `length`,
 * and sharply ahead, where the air is not yet moved. `flat`: this far behind its head it is as strong as at the head,
 * and only dies away behind that (a wind spell blows at full strength from the hand that cast it to its far end).
 */
export function gustShare(g, x, y) {
  const dx = x - g.x, dy = y - g.y, c = Math.cos(g.heading), s = Math.sin(g.heading), along = dx * c + dy * s, across = -dx * s + dy * c;
  const width = g.width || 300, behind = -along - width / 3, back = behind > 0 ? Math.max(0, behind - (g.flat > 0 ? g.flat : 0)) : behind, reach = back > 0 ? (g.length || 600) : width * 0.4;
  return Math.exp(-(across * across) / (width * width)) * Math.exp(-(back * back) / (reach * reach));
}

/** The wind at a place (pure): the scene's { wind 0-1, angle } and the gust there { x, y }, added as they blow. `gust`: how much of it is the gust's. */
export function windAt(scene = {}, gust = { x: 0, y: 0 }) {
  const wind = Number(scene.wind) || 0, angle = Number(scene.angle) || 0, push = Math.hypot(gust.x, gust.y);
  if (!(push > 1e-6)) return { wind, angle, gust: 0 };
  const x = Math.cos(angle) * wind + gust.x, y = Math.sin(angle) * wind + gust.y;
  return { wind: Math.min(1, Math.hypot(x, y)), angle: Math.atan2(y, x), gust: Math.min(1, push) };
}

/**
 * The gusts blowing now. add({ x, y, heading, strength, width, length, ms }) starts one and returns its id (`ms`: it
 * ends by itself after that long; without, it blows until end(id)); move(id, { x, y, heading }) takes it along with
 * what makes it; at(x, y) is what they add to the wind there, as { x, y }.
 */
export function createGusts({ now = () => globalThis.performance?.now?.() ?? Date.now() } = {}) {
  const live = new Map();
  let next = 1;
  // How far a gust has risen or fallen (0-1); gone once it has died away.
  const felt = (g, t) => {
    if (g.until !== null && t >= g.until && g.ended === null) g.ended = g.until;
    const rise = smooth((t - g.born) / GUST_EASE_MS);
    return g.ended === null ? rise : rise * (1 - smooth((t - g.ended) / GUST_EASE_MS));
  };
  const prune = (t) => { for (const [id, g] of live) { felt(g, t); if (g.ended !== null && t - g.ended >= GUST_EASE_MS) live.delete(id); } };
  return {
    // `inside`: it blows under a ceiling too (a wind spell cast in a room); without, it is the open air's and stays out.
    add({ x = 0, y = 0, heading = 0, strength = 1, width = 300, length = 600, flat = 0, ms = null, inside = false } = {}) {
      const id = next++, t = now();
      live.set(id, { x, y, heading, strength: clamp(Number(strength) || 0, 0, 1), width, length, flat: flat > 0 ? flat : 0, inside: inside === true, born: t, until: Number.isFinite(ms) ? t + ms : null, ended: null });
      return id;
    },
    move(id, { x, y, heading } = {}) { const g = live.get(id); if (!g) return false; if (Number.isFinite(x)) g.x = x; if (Number.isFinite(y)) g.y = y; if (Number.isFinite(heading)) g.heading = heading; return true; },
    end(id) { const g = live.get(id); if (g && g.ended === null) g.ended = now(); },
    // Keeps one blowing until `ms` from now, when that is later than it would have ended (a spell's wind lasts as
    // long as the spell is seen). False once it has already died away.
    hold(id, ms) { const g = live.get(id), t = now(); if (!g || g.ended !== null || g.until === null || !(ms > 0)) return false; g.until = Math.max(g.until, t + ms); return true; },
    // `sheltered`: the place is under a ceiling, where only the gusts that came inside are felt.
    at(x, y, { sheltered = false } = {}) {
      if (!live.size) return { x: 0, y: 0 };
      const t = now(); prune(t);
      let ax = 0, ay = 0;
      for (const g of live.values()) { if (sheltered && !g.inside) continue; const k = gustShare(g, x, y) * felt(g, t) * g.strength; ax += Math.cos(g.heading) * k; ay += Math.sin(g.heading) * k; }
      return { x: ax, y: ay };
    },
    clear() { live.clear(); },
    get busy() { if (live.size) prune(now()); return live.size > 0; },
    get count() { if (live.size) prune(now()); return live.size; },
  };
}
