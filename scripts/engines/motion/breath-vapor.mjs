// Breath vapor: in the cold, breathing creatures on screen puff a faint white cloud from the face with each breath out,
// in time with their idle breathing (idle-life.mjs: each token's own seeded period and phase). Pure logic: main.mjs
// says which tokens are cold, breathe and are seen here, and supplies the drawing layer (movement-feel-render.mjs).
// Local only, nothing is saved.

import { breathPeriod, idlePhase } from './idle-life.mjs';
import { particleState } from './movement-feel.mjs';

// At most this many creatures breathe vapor at once (the caller lists them nearest the middle of the view first).
export const VAPOR_CAP = 20;
// How far into each breath cycle the breath goes out.
const EXHALE = 0.25;

// How many breaths out the token `id` has made by `ms` (on the caller's clock).
const exhales = (id, ms, squares = 1) => {
  const period = breathPeriod(id, squares);
  return Math.floor((ms / 1000 + idlePhase(id) * period) / period - EXHALE);
};
// Does the token breathe out between `fromMs` (excluded) and `toMs` (included)?
export function vaporDue(id, fromMs, toMs, squares = 1) {
  if (!(toMs > fromMs)) return false;
  return exhales(id, toMs, squares) > exhales(id, fromMs, squares);
}

// Same text, same numbers.
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
// One breath's cloud: two or three soft white puffs just in front of the face, drifting out and a little up as they
// swell and thin out over about two seconds. The face is where the token looks: Foundry's rotation 0 faces down the
// screen. Sized by the creature (a giant's breath is a bigger cloud). `n` the breath's number, for its seed.
// How a token's art is drawn: most tokens are portraits (a face looking out, upright, often in a ring), so breath
// leaves the mouth just above the centre; top-down art turns with the creature, so a token that can turn (not
// rotation-locked, no dynamic ring) and has been turned breathes where it faces.
export function vaporArt({ ring = false, lockRotation = false, rotation = 0 } = {}) {
  const turned = ((Number(rotation) || 0) % 360 + 360) % 360 !== 0;
  return !ring && !lockRotation && turned ? 'topdown' : 'portrait';
}
export function vaporPuff(token, { grid = 100, n = 0 } = {}) {
  const random = rng(`${token.id}:${n}:vapor`), width = token.width || grid;
  // Bigger creatures breathe bigger, fuller, longer clouds: size grows with the token (as its other marks do), 1–2
  // puffs for a Tiny one up to 4–5 for a Gargantuan one.
  const squares = width / (grid || 100), scale = Math.pow(Math.max(0.4, squares), 0.85), reach = Math.sqrt(Math.max(0.4, squares));
  const count = (squares < 1 ? 1 : squares < 3 ? 2 : squares < 5 ? 3 : 4) + Math.floor(random() * 2), linger = Math.min(1.6, Math.max(0.8, 1 + 0.15 * (squares - 1))), out = [];
  // Portrait: from the mouth (a little above the centre), out to one side (alternating now and then) and rising.
  // Top-down: out of the front, where the token faces (rotation 0 faces down the screen).
  let ox, oy, dx, dy;
  // A token's own choice (Breath from, in its configuration) wins: an edge of the token, or where it faces.
  const EDGES = { right: [1, 0], left: [-1, 0], top: [0, -1], bottom: [0, 1] };
  const mouth = token.mouth && token.mouth !== 'auto' ? token.mouth : null;
  if (EDGES[mouth]) {
    const [ex, ey] = EDGES[mouth], rise = ey === 0 ? -0.25 : 0, len = Math.hypot(ex, ey + rise);
    dx = ex / len; dy = (ey + rise) / len; ox = ex * width * 0.42; oy = ey * width * 0.42;
  } else if (mouth === 'facing' || (!mouth && (token.art ?? 'portrait') === 'topdown')) {
    const facing = (((Number(token.rotation) || 0) + 90) * Math.PI) / 180;
    dx = Math.cos(facing); dy = Math.sin(facing); ox = dx * width * 0.3; oy = dy * width * 0.3;
  } else {
    const side = random() < 0.5 ? -1 : 1, lift = -0.45;
    const len = Math.hypot(1, lift);
    dx = side / len; dy = lift / len; ox = side * width * 0.05; oy = -width * 0.08;
  }
  for (let i = 0; i < count; i++) {
    const speed = grid * (0.1 + random() * 0.06) * reach, side = (random() - 0.5) * 0.5;
    out.push({
      kind: 'puff', owner: token.id, color: 0xf4f8fc, x: token.x + ox, y: token.y + oy,
      // Readable at table zoom on light and dark maps alike: a soft cloud about a fifth of a square, half opaque.
      vx: (dx - dy * side) * speed, vy: (dy + dx * side) * speed - grid * 0.03, radius: grid * 0.1 * scale * (0.8 + random() * 0.4),
      alpha: 0.5 + random() * 0.12, delay: i * 110, life: Math.round((1700 + random() * 500) * linger), hold: 0.2,
      rotation: 0, spin: 0, grow: 1.6 + random() * 0.8,
    });
  }
  return out;
}

// The per-frame controller. `tokens()` lists views {id, x, y (centre), width (px), rotation (deg), visible, breathes,
// cold}; `layer` draws (addParticle/updateParticle/removeParticle/clear).
export function createBreathVapor({ tokens, enabled, grid, now, layer, cap = VAPOR_CAP }) {
  const particles = new Set(), last = new Map(), breaths = new Map();
  const drop = (p) => { particles.delete(p); try { layer.removeParticle(p.handle); } catch { /* keep going */ } };
  const clear = () => {
    particles.clear(); last.clear(); breaths.clear();
    try { layer.clear(); } catch { /* canvas gone */ }
  };
  const tick = () => {
    if (!enabled()) { if (particles.size || last.size) clear(); return; }
    const time = now(), size = grid() || 100, seen = new Set();
    let count = 0;
    for (const token of tokens() ?? []) {
      if (count >= cap) break;
      try {
        if (!token?.visible || !token.breathes || !token.cold) continue;
        count++;
        seen.add(token.id);
        const from = last.get(token.id) ?? time;
        last.set(token.id, time);
        if (!vaporDue(token.id, from, time, (token.width || size) / (size || 100))) continue;
        const n = (breaths.get(token.id) ?? 0) + 1;
        breaths.set(token.id, n);
        for (const spec of vaporPuff(token, { grid: size, n })) particles.add({ spec, handle: layer.addParticle(spec), born: time });
      } catch { /* a token mid-teardown: skip it */ }
    }
    for (const id of [...last.keys()]) if (!seen.has(id)) { last.delete(id); breaths.delete(id); }
    for (const p of [...particles]) {
      let state = null;
      try { state = particleState(p.spec, time - p.born); } catch { /* drop it */ }
      try { if (state) layer.updateParticle(p.handle, state); else drop(p); } catch { particles.delete(p); }
    }
  };
  return { tick, clear, get size() { return particles.size; } };
}
