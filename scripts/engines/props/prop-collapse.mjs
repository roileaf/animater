// How a piece of furniture folds when it breaks: boards cut along its long side, one or more snapped with a jagged
// break, slumping in toward the middle and sliding a little along the hit; leg stubs stay at the corners and a dust
// mark settles under it. Pure, seeded from the note alone. Everything is tile-local px (origin at the tile's top-left,
// in the tile's own unturned frame). Timing (delay, dur) is a share of the 0-1 piece timeline. Drawn by prop-pieces.mjs.
import { seededRandom } from "../fragments/fragments.mjs";

const lerp = (a, b, u) => a + (b - a) * u;
const PIECE_MS = 1400; // the timeline the mock's millisecond timings are read against

// A jagged line from (x0,y0) to (x1,y1): n steps, each inner point pushed sideways by up to `amp`.
function jag(x0, y0, x1, y1, n, amp, rand) {
  const out = [], nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
  for (let i = 0; i <= n; i++) {
    const u = i / n, j = i === 0 || i === n ? 0 : (rand() - 0.5) * 2 * amp;
    out.push(lerp(x0, x1, u) + (nx / l) * j, lerp(y0, y1, u) + (ny / l) * j);
  }
  return out;
}
const reversed = (pts) => { const o = []; for (let i = pts.length - 2; i >= 0; i -= 2) o.push(pts[i], pts[i + 1]); return o; };
function centroid(poly) {
  let x = 0, y = 0; const n = poly.length / 2;
  for (let i = 0; i < poly.length; i += 2) { x += poly[i]; y += poly[i + 1]; }
  return { x: x / n, y: y / n };
}

// note: {seed, cutAngle}; width/height: the tile's size; legs: whether stubs stay; rotation: the tile's turn in degrees;
// box: the painted part of the tile as shares [x0, y0, x1, y1] (the art's opaque bounds), the whole tile by default.
export function collapseLayout(note, { width, height, legs = false, rotation = 0, box = [0, 0, 1, 1] }) {
  const rand = seededRandom((note.seed >>> 0) * 613 + 29);
  const tw = Math.max(1, Number(width) || 0), th = Math.max(1, Number(height) || 0);
  const ok = Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1];
  const [f0, g0, f1, g1] = ok ? box.map((v) => Math.min(1, Math.max(0, v))) : [0, 0, 1, 1];
  const x0 = f0 * tw, y0 = g0 * th, x1 = Math.max(x0 + 1, f1 * tw), y1 = Math.max(y0 + 1, g1 * th), w = x1 - x0, h = y1 - y0;
  const angle = note.cutAngle - ((Number(rotation) || 0) * Math.PI) / 180; // the hit in the tile's own frame
  const dir = [Math.cos(angle), Math.sin(angle)];
  // Only the part of a sideways nudge that is across the slide: the slide alone sets how far a piece goes along the hit.
  const across = (vx, vy) => { const k = vx * dir[0] + vy * dir[1]; return [vx - k * dir[0], vy - k * dir[1]]; };
  const long = w >= h, size = Math.max(w, h);
  const P = (l, a) => (long ? [l, a] : [a, l]); // (along the boards, across them) -> x, y
  const len0 = long ? x0 : y0, len1 = long ? x1 : y1, across0 = long ? y0 : x0, across1 = long ? y1 : x1, mid = (across0 + across1) / 2;

  const n = [2, 3, 3, 4, 4][Math.floor(rand() * 5)];
  const snaps = new Set(Array.from({ length: n }, (_, i) => i).filter(() => rand() < 0.45));
  if (!snaps.size) snaps.add(Math.floor(rand() * n));
  const seams = Array.from({ length: n + 1 }, (_, i) => lerp(across0, across1, i / n) + (i && i < n ? (rand() - 0.5) * 2 : 0));

  const planks = [];
  for (let board = 0; board < n; board++) {
    const a0 = seams[board], a1 = seams[board + 1], broken = snaps.has(board);
    const cutAt = lerp(len0, len1, 0.35 + rand() * 0.3), zig = jag(...P(cutAt, a0), ...P(cutAt + (rand() - 0.5) * 8, a1), 5, 5, rand);
    const polys = broken ? [[...P(len0, a0), ...zig, ...P(len0, a1)], [...P(len1, a0), ...P(len1, a1), ...reversed(zig)]]
      : [[...P(len0, a0), ...P(len1, a0), ...P(len1, a1), ...P(len0, a1)]];
    polys.forEach((poly, k) => {
      const home = centroid(poly), off = (long ? home.y : home.x) - mid, side = k === 0 ? -1 : 1;
      // Slump toward the middle line, the outer boards most; a snapped board's halves part a little into a shallow V.
      const slump = -off * (0.22 + rand() * 0.12), slide = size * (0.08 + rand() * 0.18);
      const rot = broken ? side * (0.1 + rand() * 0.12) * Math.sign(off || 1) : (rand() - 0.5) * 0.14;
      const part = broken ? side * 4 : 0;
      const [nx, ny] = across(...P(part, slump));
      const delay = (rand() * 60) / PIECE_MS, dur = (520 + rand() * 200) / PIECE_MS;
      planks.push({
        board, poly, home, delay, dur,
        to: { x: home.x + dir[0] * slide + nx, y: home.y + dir[1] * slide + ny, rot },
        ...(broken ? { edge: zig } : {}),
      });
    });
  }

  const stubs = [];
  if (legs) {
    const ls = Math.min(w, h) * 0.16;
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x1, y0, -1, 1], [x0, y1, 1, -1], [x1, y1, -1, -1]]) {
      stubs.push({ x: cx + sx * ls * 0.7, y: cy + sy * ls * 0.7, size: ls * (0.75 + rand() * 0.3), rot: (rand() - 0.5) * 0.5 });
    }
  }
  const ar = h / w;
  const dust = { x: (x0 + x1) / 2 + dir[0] * size * 0.1, y: (y0 + y1) / 2 + dir[1] * size * 0.1, r: size * 0.5, squash: Math.min(1, ar < 1 ? ar + 0.2 : 1 / ar + 0.2), angle: ar > 1 ? Math.PI / 2 : 0 };
  return { planks, legs: stubs, dust };
}
