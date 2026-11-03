// Smoke above fires (the "Smoke above fires" setting): every fire light (a light animated as a torch or a flame —
// see distortion/fire-haze.mjs isFireLight) sends up a thin, steady trail of grey smoke, as a burning torch does: puffs
// leave just above the flame, rise (north on the map, as heat rises off the board), sway, widen and thin out. A bigger
// fire smokes more and wider; a candle barely. Drawn on this screen only, through movement-feel's particle layer.
import { particleState } from './movement-feel.mjs';

export const SMOKE_CAP = 320;
export const SMOKE_FIRES = 24;
// Mid greys, never black: on a bright daylight map a dark puff reads as a stain on the floor, not smoke in the air.
const GREYS = [0x4e4c49, 0x585652, 0x625f5b, 0x6c6964];

function rng(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// How big a fire is, in grid squares of flame (0.3 a candle … 2.5 a bonfire), from its light: its bright radius, else
// half its dim one (both in pixels, as Foundry's light sources give them).
export function fireSize({ bright = 0, dim = 0, radius = 0 } = {}, grid = 100) {
  const reach = Number(bright) || (Number(dim) || Number(radius) || 0) / 2;
  return Math.min(2.5, Math.max(0.3, reach / ((grid || 100) * 4)));
}

// Puffs a second for a fire of `size`.
// Many small puffs rather than a few big ones, so they run together into one thin plume instead of separate blobs.
export const smokeRate = (size = 1) => 10 * Math.sqrt(Math.max(0.3, size));
const phase = (key) => rng(`${key}:phase`)();
// How many puffs a fire sends up between two moments (seeded per fire, so fires do not puff in step).
export function smokeDue(key, fromMs, toMs, size = 1) {
  if (!(toMs > fromMs)) return 0;
  const rate = smokeRate(size) / 1000, p = phase(key);
  return Math.max(0, Math.floor(toMs * rate + p) - Math.floor(fromMs * rate + p));
}

// The `n`th puff of a fire { key, x, y, size, drift? }: a small soft grey disc just above the flame that rises steadily,
// drifts a little to one side, widens and fades over a few seconds. `drift` ({ x, y }, in rises): the wind carrying it
// off (a chimney's plume above the roofs leans downwind).
export function smokePuff(fire, { grid = 100, n = 0 } = {}) {
  const random = rng(`${fire.key}:${n}:smoke`), size = Math.min(2.5, Math.max(0.3, Number(fire.size) || 1));
  const unit = grid * Math.sqrt(size), rise = grid * (0.55 + random() * 0.25) * Math.sqrt(size);
  // A slow sideways lean that changes puff to puff, so the column sways.
  const lean = Math.sin(n * 0.25 + phase(fire.key) * 6.28) * 0.2 + (random() - 0.5) * 0.08;
  const life = Math.round((2400 + random() * 1000) * Math.min(1.5, 0.8 + 0.3 * size));
  return {
    kind: 'smoke', owner: fire.key, color: GREYS[Math.floor(random() * GREYS.length) % GREYS.length],
    x: fire.x + (random() - 0.5) * unit * 0.06, y: fire.y - unit * 0.08,
    vx: (lean + (Number(fire.drift?.x) || 0)) * rise, vy: (-1 + (Number(fire.drift?.y) || 0)) * rise, radius: unit * (0.1 + random() * 0.03),
    alpha: 0.3 + random() * 0.1, delay: 0, life,
    // Still rising as it fades (its motion would only ease to a stop well after it is gone), so the plume stays a column.
    motionLife: life * 2.4,
    hold: 0.1, rotation: random() * Math.PI * 2, spin: (random() - 0.5) * 0.6, grow: 1.6 + random() * 0.8,
  };
}

// `fires()`: the fires to smoke now, [{ key, x, y, size, visible }] (nearest the view first); `layer` draws.
// `amount()` scales how much smoke (this player's Smoke amount: 0.25 to 2).
export function createFireSmoke({ fires, enabled, grid, now, layer, cap = SMOKE_CAP, maxFires = SMOKE_FIRES, amount = () => 1 }) {
  const particles = new Set(), last = new Map(), puffs = new Map();
  const drop = (p) => { particles.delete(p); try { layer.removeParticle(p.handle); } catch { /* keep going */ } };
  const clear = () => {
    particles.clear(); last.clear(); puffs.clear();
    try { layer.clear(); } catch { /* canvas gone */ }
  };
  const tick = () => {
    let on = false;
    try { on = enabled(); } catch { /* off */ }
    if (!on) { if (particles.size || last.size) clear(); return; }
    const time = now(), size = grid() || 100, seen = new Set();
    let count = 0;
    for (const fire of fires() ?? []) {
      if (count >= maxFires) break;
      try {
        if (!fire?.visible) continue;
        count++;
        seen.add(fire.key);
        const from = last.get(fire.key) ?? time;
        last.set(fire.key, time);
        // A long gap (the tab hidden, a scene loading) does not dump a backlog of puffs at once.
        let k = 1;
        try { k = Math.min(2, Math.max(0.25, Number(amount()) || 1)); } catch { /* as drawn */ }
        const due = Math.min(3, smokeDue(fire.key, from * k, time * k, fire.size));
        for (let i = 0; i < due && particles.size < cap; i++) {
          const n = (puffs.get(fire.key) ?? 0) + 1;
          puffs.set(fire.key, n);
          const spec = smokePuff(fire, { grid: size, n });
          particles.add({ spec, handle: layer.addParticle(spec), born: time });
        }
      } catch { /* a light mid-teardown: skip it */ }
    }
    for (const key of [...last.keys()]) if (!seen.has(key)) { last.delete(key); puffs.delete(key); }
    for (const p of [...particles]) {
      let state = null;
      try { state = particleState(p.spec, time - p.born); } catch { /* drop it */ }
      try { if (state) layer.updateParticle(p.handle, state); else drop(p); } catch { particles.delete(p); }
    }
  };
  return { tick, clear, get size() { return particles.size; } };
}

// Whether a fire smokes out of a chimney, above the roof, instead of in the room: `choice` the light's own (true always,
// false never, else auto); auto, a fire in a room (`indoors`) under a roof drawn now (`roofShown`, 0–1). A carried torch
// never does.
export function chimneyOf({ choice = null, indoors = false, roofShown = 0, carried = false } = {}) {
  if (carried) return false;
  if (choice === true || choice === 'true') return true;
  if (choice === false || choice === 'false') return false;
  return !!indoors && (Number(roofShown) || 0) > 0.5;
}
// A chimney's plume: fuller than an open fire's, carried downwind (`wind` 0–1 blowing toward `angle`, radians).
export const chimneyPlume = (fire, wind = 0, angle = 0) => ({ ...fire, size: Math.max(1.2, (Number(fire.size) || 1) * 1.3),
  drift: { x: Math.cos(angle) * (0.15 + 0.85 * Math.min(1, Math.max(0, Number(wind) || 0))), y: Math.sin(angle) * (0.15 + 0.85 * Math.min(1, Math.max(0, Number(wind) || 0))) } });
