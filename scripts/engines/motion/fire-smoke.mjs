// Smoke above fires (the "Smoke above fires" setting): every fire light (a light animated as a torch or a flame —
// see distortion/fire-haze.mjs isFireLight) sends up a thin, steady trail of grey smoke, as a burning torch does: puffs
// leave just above the flame, rise (north on the map, as heat rises off the board), sway, widen and thin out. A bigger
// fire smokes more and wider; a candle barely. Drawn on this screen only, through movement-feel's particle layer.
import { reachToward } from './wall-reach.mjs';
import { particleState } from './movement-feel.mjs';

export const SMOKE_CAP = 320;
export const SMOKE_FIRES = 24;
// Mid greys, never black: on a bright daylight map a dark puff reads as a stain on the floor, not smoke in the air.
const GREYS = [0x4e4c49, 0x585652, 0x625f5b, 0x6c6964];
// A chimney's smoke over the roofs: paler and fuller, so it reads against dark shingles, by night too.
const PALE_GREYS = [0x9c9893, 0xa8a49e, 0xb4b0aa, 0xc0bcb6];

// What a fire's smoke is made of, chosen on the light itself ("Smoke colour"): wood and oil smoke grey, a cooking pot
// steams white, a forge burns pitch black, and a witch's fire whatever she put in it. Four tones each, as the grey has,
// so a plume keeps its variation instead of reading as one flat blob; `dark` in the room, `pale` out of the chimney,
// where it has the sky and the shingles behind it. None of them is flat black or flat white, which read as a hole.
export const SMOKE_COLOURS = Object.freeze({
  "": { name: "Grey", about: "wood and oil", dark: GREYS, pale: PALE_GREYS },
  white: { name: "White", about: "steam, a cooking pot", dark: [0xb6b3ad, 0xc3c0ba, 0xd0cdc7, 0xdddad4], pale: [0xd8d5cf, 0xe1ded8, 0xe9e6e0, 0xf1eee8] },
  black: { name: "Black", about: "pitch, a forge", dark: [0x2b2926, 0x34322e, 0x3d3b36, 0x46433e], pale: [0x5e5b55, 0x6a675f, 0x76726a, 0x827e75] },
  brown: { name: "Brown", about: "damp wood, a smokehouse", dark: [0x594a3a, 0x665644, 0x73624f, 0x806e59], pale: [0x9c8871, 0xa9957d, 0xb6a289, 0xc3af95] },
  green: { name: "Green", about: "poison, a witch's fire", dark: [0x42543a, 0x4d6046, 0x586c51, 0x63785c], pale: [0x8da87f, 0x99b48b, 0xa5c097, 0xb1cca3] },
  purple: { name: "Purple", about: "arcane, a summoning", dark: [0x493f56, 0x554a64, 0x615672, 0x6d6280], pale: [0x9d8fb5, 0xa99bc1, 0xb5a7cd, 0xc1b3d9] },
  yellow: { name: "Yellow", about: "sulphur, alchemy", dark: [0x5b5334, 0x69603e, 0x776d48, 0x857a52], pale: [0xb2a673, 0xbeb27f, 0xcabe8b, 0xd6ca97] },
  red: { name: "Red", about: "embers, a blood rite", dark: [0x5a3e37, 0x684840, 0x76524a, 0x845f52], pale: [0xac8679, 0xb89285, 0xc49e91, 0xd0aa9d] },
  blue: { name: "Blue", about: "cold fire, a spirit flame", dark: [0x3c4854, 0x465462, 0x506070, 0x5a6c7e], pale: [0x8b9eb0, 0x97aabc, 0xa3b6c8, 0xafc2d4] },
});
// The four tones a fire's smoke draws from. An unknown or missing colour is grey, so a light saved by an older version,
// or one whose colour has been taken out, smokes as it always did.
export function smokeRamp(which = "", pale = false) {
  const ramp = SMOKE_COLOURS[typeof which === "string" ? which : ""] ?? SMOKE_COLOURS[""];
  return pale ? ramp.pale : ramp.dark;
}

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

// The `n`th puff of a fire { key, x, y, size, drift?, reach? }: a small soft grey disc just above the flame that rises steadily,
// drifts a little to one side, widens and fades over a few seconds. `drift` ({ x, y }, in rises): the wind carrying it
// off (a chimney's plume above the roofs leans downwind); `pale`: a chimney's paler, fuller smoke; `smokeColor`: which
// of SMOKE_COLOURS this fire sends up (grey when it has none).
export function smokePuff(fire, { grid = 100, n = 0 } = {}) {
  const random = rng(`${fire.key}:${n}:smoke`), size = Math.min(2.5, Math.max(0.3, Number(fire.size) || 1));
  const unit = grid * Math.sqrt(size), rise = grid * (0.55 + random() * 0.25) * Math.sqrt(size);
  // A slow sideways lean that changes puff to puff, so the column sways.
  const lean = Math.sin(n * 0.25 + phase(fire.key) * 6.28) * 0.2 + (random() - 0.5) * 0.08;
  const life = Math.round((2400 + random() * 1000) * Math.min(1.5, 0.8 + 0.3 * size));
  // A wall in its way (`reach`, wall-reach.mjs): it goes no further than the wall, however long it lasts.
  let vx = (lean + (Number(fire.drift?.x) || 0)) * rise, vy = (-1 + (Number(fire.drift?.y) || 0)) * rise;
  if (fire.reach) { const went = Math.hypot(vx, vy) * 1.58 * (life / 1000), open = Math.max(0, reachToward(fire.reach, vx, vy) - unit * 0.3); if (went > open) { const k = Math.max(0.05, open / went); vx *= k; vy *= k; } }
  const ramp = smokeRamp(fire.smokeColor, !!fire.pale);
  return {
    kind: 'smoke', owner: fire.key, color: ramp[Math.floor(random() * ramp.length) % ramp.length],
    x: fire.x + (random() - 0.5) * unit * 0.06, y: fire.y - unit * 0.08,
    vx, vy, radius: unit * (0.1 + random() * 0.03),
    alpha: (fire.pale ? 0.42 : 0.3) + random() * 0.1, delay: 0, life,
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
export const chimneyPlume = (fire, wind = 0, angle = 0) => ({ ...fire, pale: true, size: Math.max(1.2, (Number(fire.size) || 1) * 1.3),
  drift: { x: Math.cos(angle) * (0.15 + 0.85 * Math.min(1, Math.max(0, Number(wind) || 0))), y: Math.sin(angle) * (0.15 + 0.85 * Math.min(1, Math.max(0, Number(wind) || 0))) } });
