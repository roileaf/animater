// Fog and mist getting indoors: through what stands open between a room and the outdoors, as far as the wind carries them.
// Which walls, how far, and how it comes and goes are worked out here (pure); the sky pass draws it (sky-light.mjs seep).

// What lets the air through, between a room and outside (pure): a door standing open, or any wall that does not stop light.
// `inside(point, room)` whether a point is in a room. Each: `id`, a point just inside it (x, y), and the way into the room (nx, ny).
export function airOpenings({ walls = [], rooms = [], grid = 100, inside = () => false } = {}) {
  const out = [];
  if (!rooms.length) return out;
  for (const w of walls) {
    // (A window that opens and closes goes by that: shut glass lets the light through, not the air.)
    const open = Number(w.door) > 0 ? Number(w.ds) === 1 : w.kind === 'woodWindow' || w.kind === 'shutterWindow' || w.kind === 'glassWindow' ? w.open === true : Number(w.light) === 0;
    if (!open || !Array.isArray(w.c) || w.c.length < 4) continue;
    const [ax, ay, bx, by] = w.c.map(Number), len = Math.hypot(bx - ax, by - ay);
    if (!(len > 0)) continue;
    const nx = -(by - ay) / len, ny = (bx - ax) / len, mx = (ax + bx) / 2, my = (ay + by) / 2, step = grid * 0.3;
    const inA = rooms.some((room) => inside({ x: mx + nx * step, y: my + ny * step }, room)), inB = rooms.some((room) => inside({ x: mx - nx * step, y: my - ny * step }, room));
    if (inA === inB) continue;
    const into = inA ? 1 : -1;
    out.push({ id: w.id, x: mx + nx * into * grid * 0.15, y: my + ny * into * grid * 0.15, nx: nx * into, ny: ny * into });
  }
  return out;
}

// How far in it gets (pure), in map pixels: a little by itself, far with the wind blowing in, hardly at all with it blowing out. `wind` 0-1, `windAngle` radians, the way the air goes.
export function seepReach(opening, { wind = 0, windAngle = 0, grid = 100 } = {}) {
  const w = Math.min(1, Math.max(0, Number(wind) || 0)), inward = Math.cos(windAngle) * opening.nx + Math.sin(windAngle) * opening.ny;
  return grid * (1.6 + 4 * w * Math.max(0, inward)) * (1 + 0.75 * w * Math.min(0, inward));
}

// How much is in by now (pure, 0-1): it creeps in over some seconds, and lingers, thinning away slowly once it stops. `amounts` Map id -> 0-1; `open` the ids still letting it in. Returns the new map and whether it changed enough to draw again.
export const SEEP_IN_SECONDS = 7, SEEP_OUT_SECONDS = 10;
export function seepStep(amounts, open, seconds) {
  const next = new Map(); let moved = false;
  for (const id of new Set([...amounts.keys(), ...open])) {
    const was = amounts.get(id) ?? 0, now = open.has(id) ? Math.min(1, was + seconds / SEEP_IN_SECONDS) : Math.max(0, was - seconds / SEEP_OUT_SECONDS);
    if (now > 0) next.set(id, now);
    if (now !== was) moved = true;
  }
  return { amounts: next, moved };
}

// The rings each opening is drawn as (pure): thicker near it, thinning to nothing at its reach. Radii and the strength each adds.
export const SEEP_RINGS = Object.freeze([[1, 0.2], [0.72, 0.25], [0.46, 0.3], [0.22, 0.25]]);
