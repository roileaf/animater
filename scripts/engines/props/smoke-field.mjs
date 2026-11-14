// Smoke that fills a room: the pure simulation. One call is one round of the GM's tick (dt = 1).
// No Foundry globals, no clock, no randomness; it runs under plain node and gives the same answer every time.

// Density tiers. Thick blocks sight, thin only conceals; anything at or under the floor is gone.
export const THICK = 1.1;
export const THIN = 0.3;
export const DROP_FLOOR = 0.02;

// How much of the difference between two touching cells moves across their shared edge each round.
const SPREAD = 0.1;
// A draught pulls smoke into an opening: flow into an opening cell runs this much faster.
const PULL = 2;
// Nothing may leave across one edge faster than this, so four edges together never move more than a cell holds.
const EDGE_MAX = 0.2;
// The share lost every round from every cell, so a room with no source empties.
const FADE = 0.1;
// The share lost every round from a cell that is an opening (an open door, a broken window).
const LEAK = 0.35;
// Each opening also lets the whole room breathe out: this share more is lost from every cell, per opening.
const VENT = 0.4;
// Density a source with rate 1 adds to its own cell each round.
const SOURCE = 2;
// How much a unit wind speeds flow along it and slows flow against it.
const WIND_LEAN = 0.5;

// No cell holds more than this, so a room that burned a long time does not take proportionally for ever to clear.
export const DENSITY_CAP = 4;

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function smokeTier(v) {
  if (v >= THICK) return "thick";
  if (v >= THIN) return "thin";
  return null;
}

// cells: [{i, v}] with i = row * cols + col. sources: [{i, rate}]. openings: [i]. blocked: [{from, to}] cell pairs a wall
// separates (smoke does not cross either way). wind: {x, y} with length up to 1. dt: rounds, default 1. cap: the most any cell holds (default DENSITY_CAP), applied last.
// Returns {cells} sorted by i, with every cell at or below DROP_FLOOR left out.
export function smokeStep({ cells = [], sources = [], cols, rows, openings = [], blocked = [], wind = null, dt = 1, cap = DENSITY_CAP } = {}) {
  const total = cols * rows;
  const inGrid = (i) => Number.isInteger(i) && i >= 0 && i < total;
  const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 10)) : 1;
  const v = new Map();
  for (const c of cells) if (inGrid(c.i) && c.v > 0) v.set(c.i, (v.get(c.i) ?? 0) + c.v);
  for (const s of sources) if (inGrid(s.i) && s.rate > 0) v.set(s.i, (v.get(s.i) ?? 0) + SOURCE * s.rate * step);

  const open = new Set(openings.filter(inGrid));
  const walls = new Set();
  for (const b of blocked) walls.add(Math.min(b.from, b.to) * total + Math.max(b.from, b.to));
  let wx = 0, wy = 0;
  if (wind && (wind.x || wind.y)) { const len = Math.hypot(wind.x, wind.y), k = Math.min(1, len) / len; wx = wind.x * k; wy = wind.y * k; }

  // Each edge is visited once: from the lower index when both ends hold smoke, from the loaded end otherwise.
  const delta = new Map();
  const add = (i, d) => delta.set(i, (delta.get(i) ?? 0) + d);
  for (const [k, vk] of v) {
    const col = k % cols, row = (k - col) / cols;
    for (const [dx, dy] of STEPS) {
      const nc = col + dx, nr = row + dy;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      const n = nr * cols + nc;
      if (v.has(n) && n < k) continue;
      if (walls.has(Math.min(k, n) * total + Math.max(k, n))) continue;
      const vn = v.get(n) ?? 0, gap = vk - vn;
      if (gap === 0) continue;
      // The way the smoke goes across this edge: out of k toward n when k is the fuller, otherwise into k.
      const sx = gap > 0 ? dx : -dx, sy = gap > 0 ? dy : -dy, to = gap > 0 ? n : k;
      const rate = Math.min(EDGE_MAX, SPREAD * step * (open.has(to) ? PULL : 1) * (1 + WIND_LEAN * (sx * wx + sy * wy)));
      const moved = Math.abs(gap) * rate;
      add(k, gap > 0 ? -moved : moved);
      add(n, gap > 0 ? moved : -moved);
    }
  }

  // What is left of a cell's smoke after the round's fade, the room-wide venting, and, at an opening, the local leak.
  const stays = Math.pow((1 - FADE) * Math.pow(1 - VENT, open.size), step), staysAtOpening = stays * Math.pow(1 - LEAK, step);
  const out = [];
  for (const [i, vi] of v) {
    const next = (vi + (delta.get(i) ?? 0)) * (open.has(i) ? staysAtOpening : stays);
    if (next > DROP_FLOOR) out.push({ i, v: Math.min(cap, next) });
  }
  for (const [i, d] of delta) {
    if (v.has(i)) continue;
    const next = d * (open.has(i) ? staysAtOpening : stays);
    if (next > DROP_FLOOR) out.push({ i, v: Math.min(cap, next) });
  }
  out.sort((a, b) => a.i - b.i);
  return { cells: out };
}
