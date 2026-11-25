// What a Huge creature on the wing does to the world under it: the air its wings push goes with it as a gust
// (gusts.mjs), bending the trees and leaning the flames in its wake, and the animals bolt as it comes. Pure: the gusts,
// the scare and the timers are handed in.

// How long after its last stride a flier's gust is let go, in ms: it has stopped, or gone out of sight.
export const WAKE_LINGER_MS = 500;
// The animals are scared again every this many squares it travels.
export const SCARE_EVERY = 3;

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/**
 * How hard a flier's wings blow on the ground under it (pure), 0-1. `weight`: its step weight (movement-feel.mjs
 * stepWeight; 4 Huge, 5 Gargantuan); `height`: how far up it is, in squares. Smaller than Huge: none. Full under two
 * squares up, less the higher, none from twelve.
 */
export function wakeStrength({ weight = 0, height = 0 } = {}) {
  if (!(weight >= 4)) return 0;
  const near = clamp(1 - (Math.max(0, Number(height) || 0) - 2) / 10, 0, 1);
  return +((weight >= 5 ? 1 : 0.6) * near).toFixed(3);
}

/**
 * The fliers stirring the air now. fly(token { id, width px }, at { x, y, heading }, { weight, height, gust, scare })
 * is told on each stride of a winged flier: it holds that creature's one gust and takes it along, and scares the
 * animals as it comes (`gust`, `scare`: either can be off). clear() lets everything go.
 */
export function createGiantWakes({ gusts, scare = () => {}, grid = () => 100, later = (fn, ms) => setTimeout(fn, ms), cancel = (id) => clearTimeout(id) }) {
  const flying = new Map();
  const drop = (id) => { const f = flying.get(id); if (!f) return; flying.delete(id); cancel(f.timer); if (f.gust !== null) gusts.end(f.gust); };
  return {
    fly(token, at, { weight = 0, height = 0, gust = true, scare: scares = true } = {}) {
      const strength = wakeStrength({ weight, height });
      if (!(strength > 0) || !token?.id) return;
      const g = grid(), wide = Math.max(Number(token.width) || g, g * 2);
      let f = flying.get(token.id);
      if (!f) { f = { gust: null, timer: null, scared: null }; flying.set(token.id, f); }
      if (gust) {
        if (f.gust === null) f.gust = gusts.add({ x: at.x, y: at.y, heading: at.heading ?? 0, strength, width: wide * 1.2, length: wide * 3 });
        else gusts.move(f.gust, { x: at.x, y: at.y, heading: at.heading ?? 0 });
      }
      if (scares && (!f.scared || Math.hypot(at.x - f.scared.x, at.y - f.scared.y) >= g * SCARE_EVERY)) { f.scared = { x: at.x, y: at.y }; scare({ x: at.x, y: at.y, radius: wide * 2 }); }
      cancel(f.timer);
      f.timer = later(() => drop(token.id), WAKE_LINGER_MS);
    },
    clear() { for (const id of [...flying.keys()]) drop(id); },
    get count() { return flying.size; },
  };
}

// At most this many waters ring from one footfall.
export const WATERS_RUNG = 4;
// How fast the blow travels through the ground to the water, in squares a second.
const SHOCK_SPEED = 12;
// How many swells a step sends, how far apart (ms), and how much weaker each is than the one before. One: a step is
// one blow. (Three, each a train of three crests, was nine crests a step; Roi: "isnt it too many ripples per step?")
export const RIPPLE_RINGS = 1, RIPPLE_GAP_MS = 450, RIPPLE_FALL = 0.22;
// How far toward its bank a pond's ripple is sent, a share of the way: it is gone just short of the edge, not on it
// (Roi: "the ripple should fade slightly before the water edge").
export const BANK_SHARE = 0.94;
// A water wider than this across has no middle worth the name (a river, a lake, the sea): it rings where the blow reaches it.
const POND_SQUARES = 6;

/**
 * The waters a heavy footfall sets ringing (pure): [{ x, y, reach px, strength 0-1, delay ms }], one big ripple for each. The creature
 * comes down on the ground, near the water or some way off, and its weight shakes the water: one ripple spreading
 * through a pond from its middle to its banks, as a glass of water rings when something vast walks by (Roi,
 * 2026-11-25: "it steps on the ground next to water (can also be from afar) and the weight is making the ripples";
 * "a big ripple spreading through the water from its center"). A water too wide to have a middle rings from where the
 * blow reaches it, the edge nearest the creature.
 *
 * `weight`: its step weight (4 Huge, 5 Gargantuan; lighter shakes nothing). It reaches eight squares past its edge,
 * a Gargantuan one twelve; fainter and later the further off. `wide`: its width in pixels. `bodies`: the waters,
 * [{ x, y (its middle), radius and span (half its narrower and its wider way across, pixels), test(x, y): whether
 * that point is its water }].
 */
export function waterRipples({ at, grid = 100, weight = 0, wide = 0, bodies = [] } = {}) {
  if (!(weight >= 4) || !at) return [];
  const half = Math.max(0, (Number(wide) || 0) / grid / 2), reach = weight >= 5 ? 12 : 8, heavy = weight >= 5 ? 1.25 : 1, found = [];
  const late = (gap) => Math.round((gap / SHOCK_SPEED) * 1000), felt = (gap) => 0.55 + 0.45 * (1 - gap / reach);
  for (const body of bodies ?? []) {
    const R = Math.max(0.5, (Number(body?.radius) || 0) / grid), span = Math.max(R, (Number(body?.span) || 0) / grid), inWater = typeof body.test === 'function' ? body.test : () => true;
    if (span <= POND_SQUARES && inWater(body.x, body.y)) {
      // A pond: from its middle, big enough to run to its banks. (From the creature's edge to the water's, taking the
      // pond as round: near enough to say how hard and how late.)
      const gap = Math.max(0, Math.hypot(body.x - at.x, body.y - at.y) / grid - R - half);
      // (Sized by the blow, not by the pond: the rings fade out where the water ends, so a big one in a small pond
      // simply reaches its banks sooner. Sized to fit the pond, as it first was, a small pond got a ring as faint
      // as a duck's: 0.4 to 0.6 on Roi's four-square pool.)
      // And it runs from the middle all the way to the banks (Roi, seeing the first one die out half way: "shouldnt
      // the ripples go from the center until the water edge?"): `reach` is how far that is, to its furthest bank.
      if (gap <= reach) found.push({ x: body.x, y: body.y, gap, delay: late(gap), reach: Math.round(span * BANK_SHARE * grid), strength: +Math.min(1, felt(gap) * heavy * 0.8).toFixed(3) });
      continue;
    }
    // Wide water, or water round an island: where the blow reaches it. Looked for outward from the creature every way
    // round; the nearest water found is where it rings, a square in from that edge.
    let best = null;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, ux = Math.cos(a), uy = Math.sin(a);
      for (let s = half + 0.5; s <= half + reach && (!best || s < best.s); s += 0.5) {
        if (!inWater(at.x + ux * s * grid, at.y + uy * s * grid)) continue;
        best = { s, ux, uy };
        break;
      }
    }
    if (!best) continue;
    const gap = best.s - half, deep = inWater(at.x + best.ux * (best.s + 1) * grid, at.y + best.uy * (best.s + 1) * grid) ? 1 : 0;
    found.push({ x: at.x + best.ux * (best.s + deep) * grid, y: at.y + best.uy * (best.s + deep) * grid, gap, delay: late(gap), reach: (weight >= 5 ? 9 : 6) * grid, strength: +Math.min(1, felt(gap) * heavy * 0.8).toFixed(3) });
  }
  return found.sort((p, q) => p.gap - q.gap).slice(0, WATERS_RUNG).map(({ gap, ...ripple }) => ripple);
}
