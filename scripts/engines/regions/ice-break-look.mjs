// The shapes of thin ice breaking: the cracks painted in a square that has cracked, the jagged hole of dark water where it gave
// way, and the loose shards of ice floating in that hole. Geometry only, pure: no Foundry, no PIXI, no drawing; a later layer
// draws what these return. Everything is in absolute canvas pixels (a square "col,row" has its corner at col*grid, row*grid)
// and seeded from the square key and `seed`, so every client draws the same break from what the GM stored. Junk input (a
// malformed key, no grid, no size) gives an empty result rather than an error.

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

// "3,4" or "-1,2" -> { col, row }, else null.
function parseKey(key) {
  const m = typeof key === "string" ? /^(-?\d+),(-?\d+)$/.exec(key) : null;
  return m ? { col: Number(m[1]), row: Number(m[2]) } : null;
}

// A stream of 0-1 numbers for one square, one seed and one purpose (`salt`: cracks, hole and shards each draw their own).
// The same three give the same stream; any of them changing gives another.
function stream({ col, row }, seed, salt) {
  const base = col * 12.9898 + row * 78.233 + (Number(seed) || 0) * 37.719 + salt * 5.31;
  let i = 0;
  return () => hash(base + 1.618 * i++);
}

const validGrid = (grid) => Number.isFinite(grid) && grid > 0;

/** The cracks in a cracked square: 4 to 6 jagged polylines radiating from near its centre, each point inside the square.
 *  [[{x, y}, ...], ...] */
export function crackLines(key, { grid, seed = 0 } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid)) return [];
  const next = stream(sq, seed, 1);
  const x0 = sq.col * grid, y0 = sq.row * grid, margin = grid * 0.03;
  const clamp = (v, lo) => Math.min(lo + grid - margin, Math.max(lo + margin, v));
  const cx = x0 + grid / 2, cy = y0 + grid / 2;
  const count = 4 + Math.floor(next() * 3);
  const lines = [];
  for (let k = 0; k < count; k++) {
    let angle = ((k + next() * 0.6) / count) * Math.PI * 2;
    let x = cx + (next() - 0.5) * grid * 0.12, y = cy + (next() - 0.5) * grid * 0.12;
    const line = [{ x, y }];
    const steps = 3 + Math.floor(next() * 2);
    for (let s = 0; s < steps; s++) {
      angle += (next() - 0.5) * 1.1; // each step veers, so the crack zigzags
      const len = grid * 0.13 * (0.7 + next() * 0.6);
      x = clamp(x + Math.cos(angle) * len, x0); y = clamp(y + Math.sin(angle) * len, y0);
      line.push({ x, y });
    }
    lines.push(line);
  }
  return lines;
}

// Points round the hole, and how wide it is: about the creature's size plus one square across, its radius never under
// LOW of that, so shards placed inside LOW * half are always in the hole.
const RING_POINTS = 16, LOW = 0.78;

/** The hole a creature falls through: a jagged ring about `size` + 1 squares across (`size` in squares: 1 Medium, 2 Large...),
 *  centred on the square it broke, as [{x, y}, ...]. It is star-shaped: one radius per angle, the angles strictly rising round
 *  the centre and every radius above zero, so it can never cross itself. Wound by rising angle, which in canvas coordinates
 *  (y down) is clockwise on screen, a positive shoelace sum. The first point is NOT repeated at the end. */
export function holeOutline(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const next = stream(sq, seed, 2);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid, half = ((size + 1) / 2) * grid;
  const turn = next() * Math.PI * 2, step = (Math.PI * 2) / RING_POINTS;
  const ring = [];
  for (let k = 0; k < RING_POINTS; k++) {
    const angle = turn + (k + (next() - 0.5) * 0.6) * step; // up to 0.3 of a step either way: never reaches a neighbour
    // Odd points range over the whole depth, even ones only the outer half: a ragged edge of broken ice, not a wobbly circle.
    const radius = half * (LOW + (1 - LOW) * (k % 2 ? next() : 0.5 + next() * 0.5));
    ring.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  return ring;
}

/** Loose pieces of ice floating in the hole: [{x, y, r, turn}], the centre in pixels, a radius r in pixels and a turn in
 *  radians. About three more for each square of size; every shard sits well inside the hole. */
export function shards(key, { grid, seed = 0, size } = {}) {
  const sq = parseKey(key);
  if (!sq || !validGrid(grid) || !(Number(size) > 0) || !Number.isFinite(size)) return [];
  const next = stream(sq, seed, 3);
  const cx = (sq.col + 0.5) * grid, cy = (sq.row + 0.5) * grid, reach = ((size + 1) / 2) * grid * LOW * 0.45;
  const count = 3 + Math.round(size * 3);
  const out = [];
  for (let k = 0; k < count; k++) {
    const angle = next() * Math.PI * 2, dist = Math.sqrt(next()) * reach;
    out.push({ x: cx + Math.cos(angle) * dist, y: cy + Math.sin(angle) * dist, r: grid * (0.06 + next() * 0.1), turn: (next() - 0.5) * Math.PI * 2 });
  }
  return out;
}
