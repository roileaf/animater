// Plants that break (approved mock "Breaking more", scene 7): a web, vine or bush burning away from the hit side, and
// a web cut in two by a slash. Pure and seeded from the note alone, so every client and every reload lays the same
// burn and the same cut. All points are tile-local px (origin at the tile's top-left, unturned). Drawn by prop-wreck.mjs.
import { seededRandom } from "../fragments/fragments.mjs";

export const BURN_AWAY_MS = 1500; // the burn front's run across the plant
const NOISE = 9; // the burn time's noise: a 9 x 9 grid of values, read bilinearly (8 cells across)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, u) => a + (b - a) * u;
const localAngle = (cutAngle, rotation) => cutAngle - ((Number(rotation) || 0) * Math.PI) / 180;

// How far along the burn a point is, 0-1.1 (u, v: shares of the tile across and down): its place along the hit, the
// hit side first, plus seeded noise so the front runs ragged. The front reaches it at (burnAt + 0.05) / 1.5 of the run.
// The drawing's shader computes exactly this per pixel (prop-wreck.mjs).
export function burnAt(L, u, v) {
  const p = ((u - 0.5) * L.width * L.dir.x + (v - 0.5) * L.height * L.dir.y) / L.half;
  const X = clamp(u, 0, 1) * (NOISE - 1), Y = clamp(v, 0, 1) * (NOISE - 1), ix = Math.min(NOISE - 2, Math.floor(X)), iy = Math.min(NOISE - 2, Math.floor(Y));
  const fx = X - ix, fy = Y - iy, q = (a, b) => L.noise[b * NOISE + a];
  const nz = lerp(lerp(q(ix, iy), q(ix + 1, iy), fx), lerp(q(ix, iy + 1), q(ix + 1, iy + 1), fx), fy);
  return ((p + 1) / 2) * 0.8 + nz * 0.3;
}
// The share of the run at which the front reaches burn time b.
export const frontAt = (b) => (b + 0.05) / 1.5;

// rotation: the tile's turn in degrees; dir is the hit's direction in the tile's own frame. embers: 20-40 (more for a
// bigger plant), each caught when the front reaches it (t0, ms), drifting up and dimming over life ms. ash: the ash
// mark's centre and radius. noise: the burn time's grid (burnAt).
export function burnLayout(note, { width, height, grid = 100, rotation = 0 }) {
  const rand = seededRandom((note.seed >>> 0) * 389 + 17), a = localAngle(note.cutAngle, rotation);
  const dir = { x: Math.cos(a), y: Math.sin(a) }, side = Math.max(width, height), k = grid / 100;
  const noise = Array.from({ length: NOISE * NOISE }, () => rand());
  const L = { dir, ms: BURN_AWAY_MS, width, height, half: Math.max(1e-6, (Math.abs(dir.x) * width + Math.abs(dir.y) * height) / 2), noise };
  const count = clamp(Math.round(10 + (10 * side) / grid), 20, 40);
  L.embers = Array.from({ length: count }, () => {
    const t = rand() * Math.PI * 2, d = Math.sqrt(rand()) * 0.42, u = 0.5 + Math.cos(t) * d, v = 0.5 + Math.sin(t) * d;
    return { x: u * width, y: v * height, t0: frontAt(burnAt(L, u, v)) * BURN_AWAY_MS, life: 700 + rand() * 500,
      vx: (rand() - 0.5) * 30 * k, vy: -(40 + rand() * 50) * k, s: (0.9 + rand() * 1.2) * k, ph: rand() * 9 };
  });
  L.ash = { x: width / 2, y: height / 2, r: 0.42 * side };
  return L;
}

// Sutherland-Hodgman: a polygon (flat [x, y, ...]) clipped to the box 0-w by 0-h.
function clipToBox(poly, w, h) {
  let pts = [];
  for (let i = 0; i < poly.length; i += 2) pts.push([poly[i], poly[i + 1]]);
  const edges = [[(p) => p[0] >= 0, (a, b) => a[0] / (a[0] - b[0])], [(p) => p[0] <= w, (a, b) => (a[0] - w) / (a[0] - b[0])],
    [(p) => p[1] >= 0, (a, b) => a[1] / (a[1] - b[1])], [(p) => p[1] <= h, (a, b) => (a[1] - h) / (a[1] - b[1])]];
  for (const [inside, cross] of edges) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ia = inside(a), ib = inside(b);
      if (ia) out.push(a);
      if (ia !== ib) { const t = cross(a, b); out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]); }
    }
    pts = out;
  }
  return pts.flat();
}
function centroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < poly.length; i += 2) {
    const j = (i + 2) % poly.length, c = poly[i] * poly[j + 1] - poly[j] * poly[i + 1];
    a += c; cx += (poly[i] + poly[j]) * c; cy += (poly[i + 1] + poly[j + 1]) * c;
  }
  if (Math.abs(a) < 1e-9) return { x: poly[0] ?? 0, y: poly[1] ?? 0 };
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

// A web cut by a slash: the cut runs through the middle along the hit, jagged. Half 0 lies on its left-hand side (up
// the page for a hit going right), half 1 on the right. Each half sags apart across the cut toward the side it is
// anchored on, drawn in a little toward that anchor (sx, sy) and turned slightly, with a small droop down the page.
// to: that move (an offset from home, which is the half's own middle). threads: loose strands hanging from both cut
// edges into the gap, settled: (x0, y0) where it hangs from (moved with its half), (x1, y1) its free end, c its curl.
const SAG = 0.124, DROOP = 0.03, JAG = 0.03, SAG_TURN = 0.12, SAG_SCALE = 0.88;
export function splitLayout(note, { width, height, rotation = 0 }) {
  const rand = seededRandom((note.seed >>> 0) * 733 + 29), a = localAngle(note.cutAngle, rotation), side = Math.max(width, height);
  const d = { x: Math.cos(a), y: Math.sin(a) }, n = { x: -d.y, y: d.x }, c = { x: width / 2, y: height / 2 };
  const turn = ((Number(rotation) || 0) * Math.PI) / 180, down = { x: Math.sin(turn), y: Math.cos(turn) }; // the page's down, in the tile's frame
  // the jagged cut, well past the tile at both ends
  const reach = Math.hypot(width, height), steps = 16, amp = JAG * side;
  const cut = Array.from({ length: steps + 1 }, (_, i) => {
    const t = lerp(-reach, reach, i / steps), off = i === 0 || i === steps ? 0 : (rand() - 0.5) * 2 * amp;
    return [c.x + d.x * t + n.x * off, c.y + d.y * t + n.y * off, t, off];
  });
  const big = reach * 2, line = cut.flatMap(([x, y]) => [x, y]);
  const halves = [-1, 1].map((sgn) => {
    const far = [c.x + d.x * reach + n.x * sgn * big, c.y + d.y * reach + n.y * sgn * big, c.x - d.x * reach + n.x * sgn * big, c.y - d.y * reach + n.y * sgn * big];
    const poly = clipToBox([...line, ...far], width, height);
    return { poly, home: centroid(poly), to: { x: n.x * sgn * SAG * side + down.x * DROOP * side, y: n.y * sgn * SAG * side + down.y * DROOP * side, rot: sgn * SAG_TURN, sx: SAG_SCALE, sy: SAG_SCALE } };
  });
  // where the cut is inside the tile: t from the middle, along d
  const span = (p, q, size) => (Math.abs(q) < 1e-9 ? [-Infinity, Infinity] : [Math.min((0 - p) / q, (size - p) / q), Math.max((0 - p) / q, (size - p) / q)]);
  const [ax0, ax1] = span(c.x, d.x, width), [ay0, ay1] = span(c.y, d.y, height), t0 = Math.max(ax0, ay0), t1 = Math.min(ax1, ay1);
  const offAt = (t) => { const f = ((t + reach) / (2 * reach)) * steps, i = Math.min(steps - 1, Math.floor(f)); return lerp(cut[i][3], cut[i + 1][3], f - i); };
  const threads = Array.from({ length: 14 }, (_, i) => {
    const u = 0.15 + (i / 13) * 0.7 + (rand() - 0.5) * 0.04, t = lerp(t0, t1, u), off = offAt(t), half = i % 2, sgn = half ? 1 : -1, h = halves[half];
    const x0 = c.x + d.x * t + n.x * off + h.to.x, y0 = c.y + d.y * t + n.y * off + h.to.y, l = ((10 + rand() * 18) / 210) * side;
    // it hangs back across the gap from its half's edge, and down
    return { half, x0, y0, x1: x0 - n.x * sgn * l + down.x * l * 0.6, y1: y0 - n.y * sgn * l + down.y * l * 0.6, c: ((rand() - 0.5) * 10 / 210) * side };
  });
  return { halves, threads };
}
