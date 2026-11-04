// How far a fire's sparks, smoke and heat can go before a wall (pure): eight ways round it, so what it throws stays in its
// own room. A torch on a wall stands on the wall's line, and walls stop nothing there: it belongs to the side the room is on.

const TAU = Math.PI * 2;
export const REACH_WAYS = 8;
const blocks = (w) => Number(w.move) > 0 && !(Number(w.door) > 0 && Number(w.ds) === 1);

// How far along a ray from `at` a wall stands (px), Infinity when none; `skip` walls are not looked at.
const rayToWall = (at, dx, dy, walls, skip) => {
  let best = Infinity;
  for (const w of walls) {
    if (skip?.has(w) || !blocks(w)) continue;
    const [x1, y1, x2, y2] = w.c, ex = x2 - x1, ey = y2 - y1, cross = dx * ey - dy * ex;
    if (Math.abs(cross) < 1e-6) continue;
    const t = ((x1 - at.x) * ey - (y1 - at.y) * ex) / cross, u = ((x1 - at.x) * dy - (y1 - at.y) * dx) / cross;
    if (t > 0 && t < best && u >= 0 && u <= 1) best = t;
  }
  return best;
};

// The walls a fire stands on (within a tenth of a square of its line, along its length), and which way is its room: the
// way its light mostly goes (`home`, mothHome's middle of what it lights), else the side with more open floor.
// { walls: [...], nx, ny } or null when it stands on none.
export function wallSide(at, walls = [], { grid = 100, home = null } = {}) {
  const on = [];
  for (const w of walls) {
    if (!blocks(w)) continue;
    const [x1, y1, x2, y2] = w.c, ex = x2 - x1, ey = y2 - y1, len2 = ex * ex + ey * ey; if (!len2) continue;
    const k = ((at.x - x1) * ex + (at.y - y1) * ey) / len2; if (k < -0.05 || k > 1.05) continue;
    if (Math.hypot(at.x - (x1 + ex * k), at.y - (y1 + ey * k)) <= grid * 0.1) on.push(w);
  }
  if (!on.length) return null;
  const [x1, y1, x2, y2] = on[0].c, len = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / len, ny = (x2 - x1) / len;
  // Off the line, it is already on its room's side.
  const off = (at.x - x1) * nx + (at.y - y1) * ny;
  let side = Math.abs(off) > grid * 0.01 ? Math.sign(off) : 0;
  if (!side && home) { const lean = (home.x - at.x) * nx + (home.y - at.y) * ny; if (Math.abs(lean) > grid * 0.02) side = Math.sign(lean); }
  if (!side) { const skip = new Set(on), far = (s) => Math.min(grid * 6, rayToWall(at, nx * s, ny * s, walls, skip)); side = far(1) >= far(-1) ? 1 : -1; }
  return { walls: on, nx: nx * side, ny: ny * side };
}

// How far (px) from `at` each of REACH_WAYS ways is open, at most `max`: the nearest wall across a little fan about each
// way (the way itself and a little to each side), nothing at all back through the wall it stands on.
export function reachAround(at, walls = [], { grid = 100, max = grid * 4, home = null } = {}) {
  const near = walls.filter((w) => { const [x1, y1, x2, y2] = w.c; return Math.min(x1, x2) - max <= at.x && at.x <= Math.max(x1, x2) + max && Math.min(y1, y2) - max <= at.y && at.y <= Math.max(y1, y2) + max; });
  const side = wallSide(at, near, { grid, home }), skip = side ? new Set(side.walls) : null;
  return Array.from({ length: REACH_WAYS }, (_, i) => {
    let best = max;
    for (const fan of [-0.3, 0, 0.3]) {
      const a = (i / REACH_WAYS) * TAU + fan, dx = Math.cos(a), dy = Math.sin(a);
      if (side && dx * side.nx + dy * side.ny < 0) return 0;
      best = Math.min(best, rayToWall(at, dx, dy, near, skip));
    }
    return best;
  });
}

// How far is open along (dx, dy), from reachAround's list.
export function reachToward(reach, dx, dy) {
  if (!reach) return Infinity;
  const a = Math.atan2(dy, dx), i = Math.round((((a % TAU) + TAU) % TAU) / TAU * REACH_WAYS) % REACH_WAYS;
  return reach[i];
}

// A fire's heat haze, kept off the walls round it: where its circle goes and how big, when one is nearer than its
// radius (moved away from the nearest wall, and smaller); null when it fits where it is.
export function hazeFit(at, radius, reach, { grid = 100 } = {}) {
  if (!reach) return null;
  let nearest = Infinity, way = 0;
  reach.forEach((r, i) => { if (r < nearest) { nearest = r; way = i; } });
  if (nearest >= radius) return null;
  const a = (way / REACH_WAYS) * TAU + Math.PI, push = (radius - nearest) / 2;
  return { x: at.x + Math.cos(a) * push, y: at.y + Math.sin(a) * push, radius: Math.max(grid * 0.3, (radius + nearest) / 2) };
}

// A polygon (flat x, y) cut to one side of a line through `at` with normal (nx, ny): what lies that way stays.
export function clipToSide(points, at, nx, ny) {
  const out = [], n = points.length / 2, side = (i) => (points[i * 2] - at.x) * nx + (points[i * 2 + 1] - at.y) * ny;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = side(i), b = side(j);
    if (a >= 0) out.push(points[i * 2], points[i * 2 + 1]);
    if ((a >= 0) !== (b >= 0)) { const k = a / (a - b); out.push(points[i * 2] + (points[j * 2] - points[i * 2]) * k, points[i * 2 + 1] + (points[j * 2 + 1] - points[i * 2 + 1]) * k); }
  }
  return out;
}
