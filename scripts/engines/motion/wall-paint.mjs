// A wall's art, painted rather than fetched: the same hand as the decorations (decor-paint.mjs, whose PAINT_KIT this
// borrows so the two never drift apart), from nothing but the wall segments a scene already has for its vision.
//
// Two shapes of wall, and they are not the same thing turned a different colour:
//
//   Above ground a wall is a RUN. Floor on both sides, an edge all the way round it, a shadow falling onto the floor
//   beside it. It is painted as a ribbon: a nearly flat top, a hand-drawn edge, and the height carried by the shadow
//   rather than by a side anyone can see, which is how a wall actually reads looked straight down on.
//
//   Underground the stone is EVERYTHING and a room is the hole cut out of it. There is only ever one mass of rock —
//   that is what being underground means — so the mass has one material and what changes room by room is how its
//   boundary was worked: faced with block, cut with a chisel, or never worked at all. A dug hall opening into a cave
//   is two facings in one stone, not two walls.
//
// Everything here is pure canvas 2D: no Foundry, no PIXI, no clock. Where the walls are and which material each one is
// belongs to wall-looks.mjs; putting the pictures on the canvas belongs to painted-walls.mjs.

import { PAINT_KIT, seeded, hashText } from './decor-paint.mjs';

const { poly, line, wander, shade, mix, noise, centre, INK, defaultCanvas } = PAINT_KIT;

// Toward the light: top left, as the maps are lit (the same corner decor-paint.mjs paints toward).
export const LIT = Object.freeze([-0.62, -0.78]);

/**
 * Which way the light is falling while a picture is being painted, as a unit vector pointing at the sun — the same
 * one the floors use, so a roof and the ground it stands on agree about where the sun is.
 *
 * It is held here rather than passed down because every painter in this file and in roof-paint, door-paint and
 * window-paint reaches for it, often three deep inside a helper that has no business knowing about the sky. One
 * picture is painted at a time and painting never waits, so `underLight` sets it, paints, and puts back whatever
 * was there before. Nothing outside a paint should read it.
 */
export const LIGHT = { at: LIT };

/**
 * How many picture pixels a painted thing gets for each pixel it covers on the map. A roof or a wall is painted
 * once into a canvas and then shown at whatever the table is zoomed to, so at one-to-one it goes soft as soon as
 * anybody leans in (Roi: "we need to increase the roof\walls\door\windows resolution i think"). Two is a quarter
 * again of the memory for a picture that holds up at twice the zoom; the `most` a painter will make still caps it,
 * so a roof over a whole map is no bigger than it was.
 */
export const PICTURE_SHARP = 2;

/** How much of the GM's colour goes into the stuff by default: enough to say which colour, not enough to flatten it. */
export const TINT_MUCH = 0.5;

/**
 * A material's own colour with a chosen colour mixed into it. Mixed, never replaced: a tinted wall is still stone,
 * with its blotches, its grain and its darks, and a flat fill of one colour would throw all of that away. Washing
 * over the painted stuff afterwards would do the same — this goes in before a single stone is drawn, so every
 * stone is that colour's own shade of itself.
 */
export function tinted(colour, tint, much = TINT_MUCH) {
  if (typeof tint !== 'string' || !/^#[0-9a-f]{3,8}$/i.test(tint)) return colour;
  const by = Math.max(0, Math.min(1, Number.isFinite(Number(much)) ? Number(much) : TINT_MUCH));
  return by > 0 ? mix(colour, tint, by) : colour;
}

/** A whole material wearing that colour: its face, and the dark of its edges with it. */
export const tintedKind = (kind, tint, much = TINT_MUCH) => (
  typeof tint === 'string' && kind
    ? { ...kind, base: tinted(kind.base, tint, much), ...(kind.edge ? { edge: tinted(kind.edge, tint, much * 0.7) } : {}) }
    : kind
);

/** The direction of a sun standing at `angle` degrees, as the scene's sun reports it. */
export const litFrom = (angle) => {
  const a = ((Number(angle) || 0) * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a)];
};

/** Paint with the light coming from `from` (null for the painters' own fixed light). */
export function underLight(from, paint) {
  const was = LIGHT.at;
  LIGHT.at = Array.isArray(from) && from.length === 2 && Number.isFinite(from[0]) && Number.isFinite(from[1]) ? from : LIT;
  try { return paint(); } finally { LIGHT.at = was; }
}

// How thick a wall is drawn and how far it stands off the floor, in grid squares.
export const WALL_THICK = 0.17;
export const WALL_LIFT = 0.1;

// ---------------------------------------------------------------------------------------------------- geometry

/** One segment of a run: its ends, its length, its direction and its normal. */
export const wallSeg = (a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  return { a, b, len, d: [dx / len, dy / len], n: [-dy / len, dx / len] };
};

/**
 * One side of an open run, offset by `half` and mitred at every turn, so the two sides of a wall never cross each
 * other at a corner (they did, and every corner flooded).
 */
export function offsetSide(segs, half, sign, closed = false) {
  const out = [], n = segs.length;
  // A ring has no ends: the seam where it comes back on itself is a corner like any other, and is mitred like one.
  // Walked as though it were open, that seam came out as two square butts meeting, which is what showed.
  //
  // It still walks one past the last segment, closed or not. A ring stopping at its last corner left runOutline
  // crossing the wall there and going back down the other side, so the edge from that corner round to the seam was
  // never walked at all and never filled: a whole segment of wall simply missing (Roi: "making a rectangle of a
  // room\house still leaves an opening on it's own"). It only showed when the seam fell in the middle of a straight
  // wall; at a corner the mitre covered it. One more step closes the side on itself, and the gap has nowhere to be.
  const last = n;
  for (let i = 0; i <= last; i++) {
    const prev = closed ? segs[(i - 1 + n) % n] : segs[i - 1], next = closed ? segs[i % n] : segs[i];
    const p = next ? next.a : prev.b;
    if (!prev || !next) { const s = next ?? prev; out.push([p[0] + s.n[0] * half * sign, p[1] + s.n[1] * half * sign]); continue; }
    const mx = prev.n[0] + next.n[0], my = prev.n[1] + next.n[1], ml = Math.hypot(mx, my) || 1, ux = mx / ml, uy = my / ml;
    // Clamped, so a hairpin turn makes a blunt corner instead of shooting off across the map.
    const cos = Math.max(0.34, ux * next.n[0] + uy * next.n[1]);
    out.push([p[0] + (ux * half) / cos * sign, p[1] + (uy * half) / cos * sign]);
  }
  return out;
}

/** The whole run as one outline: up one side and back the other. */
export const runOutline = (segs, half, closed = false) => [...offsetSide(segs, half, 1, closed), ...offsetSide(segs, half, -1, closed).reverse()];

/** A closed outline pushed out by `d`, mitred at every corner. Negative `d` pulls it in. */
export function offsetClosed(pts, d) {
  const n = pts.length, turn = signedArea(pts) > 0 ? 1 : -1;
  const en = pts.map((p, i) => { const q = pts[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1; return [(dy / l) * turn, (-dx / l) * turn]; });
  return pts.map((p, i) => {
    const a = en[(i - 1 + n) % n], b = en[i], mx = a[0] + b[0], my = a[1] + b[1], ml = Math.hypot(mx, my) || 1, ux = mx / ml, uy = my / ml;
    const cos = Math.max(0.35, ux * b[0] + uy * b[1]);
    return [p[0] + (ux * d) / cos, p[1] + (uy * d) / cos];
  });
}

export const signedArea = (pts) => pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + (p[0] * q[1] - q[0] * p[1]); }, 0) / 2;

/** More points along the same shape, so a hand-drawn wobble has somewhere to show. */
export function subdivide(pts, step) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.round(len / step));
    for (let k = 0; k < n; k++) out.push([a[0] + (b[0] - a[0]) * (k / n), a[1] + (b[1] - a[1]) * (k / n)]);
  }
  return out;
}

/** The hand-drawn edge: every point nudged along the outline's own normal by smooth noise, so no line is ever ruled. */
export function ragged(pts, amp, k = 0) {
  return pts.map((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    const push = (noise(p[0] * 0.09, p[1] * 0.09, k) - 0.5) * 2 + (noise(p[0] * 0.31, p[1] * 0.31, k + 9) - 0.5) * 0.7;
    return [p[0] + (-dy / l) * push * amp, p[1] + (dx / l) * push * amp];
  });
}

/**
 * A run carried past the corners it meets. `join` is [start, end]: an end that touches another painted wall is run on
 * by the wall's own half-thickness, so where two runs meet they overlap and no cap shows between them.
 */
export function joinEnds(points, half, join = null) {
  if (!join || points.length < 2) return points;
  const out = points.map((p) => [...p]);
  const push = (from, to, by) => { const dx = to[0] - from[0], dy = to[1] - from[1], l = Math.hypot(dx, dy) || 1; return [to[0] + (dx / l) * by, to[1] + (dy / l) * by]; };
  if (join[0]) out[0] = push(out[1], out[0], half * 1.05);
  if (join[1]) out[out.length - 1] = push(out[out.length - 2], out[out.length - 1], half * 1.05);
  return out;
}

/**
 * A drawn run bent into a curve: a smooth line through the corners it was drawn with, cut into short chords. The
 * walls themselves are those chords, so a curved wall still stops sight and movement exactly where it looks as if it
 * should — there is no such thing as a curved wall in Foundry, only a short enough straight one.
 * Two points are a straight line and come back untouched.
 */
export function smoothRun(points, step = 20) {
  if (!Array.isArray(points) || points.length < 3) return points ?? [];
  const p = points.map((q) => (Array.isArray(q) ? { x: q[0], y: q[1] } : { x: q.x, y: q.y }));
  const at = (i) => p[Math.max(0, Math.min(p.length - 1, i))];
  const out = [[p[0].x, p[0].y]];
  for (let i = 0; i < p.length - 1; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), d = at(i + 2);
    const span = Math.hypot(c.x - b.x, c.y - b.y), n = Math.max(1, Math.ceil(span / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      // Catmull-Rom: the line passes through every corner it was drawn with, and leans into the next one.
      const x = 0.5 * (2 * b.x + (c.x - a.x) * t + (2 * a.x - 5 * b.x + 4 * c.x - d.x) * t2 + (3 * b.x - a.x - 3 * c.x + d.x) * t3);
      const y = 0.5 * (2 * b.y + (c.y - a.y) * t + (2 * a.y - 5 * b.y + 4 * c.y - d.y) * t2 + (3 * b.y - a.y - 3 * c.y + d.y) * t3);
      out.push([x, y]);
    }
  }
  return out;
}

/** The box a painted run needs, in pixels, with room for its shadow and its roughened edge. */
export function runBox(points, grid, { thick = WALL_THICK } = {}) {
  const pad = grid * (thick + 0.55);
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad;
  return { x, y, w: Math.max(...xs) + pad - x, h: Math.max(...ys) + pad - y };
}

// ---------------------------------------------------------------------------------------------------- the face

/**
 * A wall top as it reads from above: close to flat. A base colour, a slow drift lighter and darker over a few squares,
 * a few broad soft blotches, and a fine grain. No shade band and no emboss — the shape is read from its edge and from
 * the shadow it throws, never from a bevel. (A bevel is what made the first try look like a toy.)
 */
export function faceStone(g, rng, pts, base, o, { grain = 0.1, blotch = 7, drift = 0.9 } = {}) {
  const c = centre(pts), r = Math.max(...pts.map(([x, y]) => Math.hypot(x - c[0], y - c[1])));
  poly(g, pts); g.fillStyle = base; g.fill();
  if (drift > 0) {
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const step = o.unit * 0.42, k = (o.seed ?? 1) % 97;
    g.save(); poly(g, pts); g.clip(); g.filter = `blur(${o.unit * 0.5}px)`;
    // (Kept small and spaced wider than it is drawn: overlapping passes used to stack up and bleach the stone pale.)
    for (let y = y0 - step; y < y1 + step; y += step) for (let x = x0 - step; x < x1 + step; x += step) {
      const n = noise(x / (o.unit * 2.4), y / (o.unit * 2.4), k) - 0.5;
      g.fillStyle = n < 0 ? `rgba(14,12,9,${Math.min(0.3, -n * 0.72 * drift)})` : `rgba(242,236,222,${Math.min(0.22, n * 0.5 * drift)})`;
      g.beginPath(); g.arc(x, y, step * 0.62, 0, 6.283); g.fill();
    }
    g.restore();
  }
  g.save(); poly(g, pts); g.clip();
  g.filter = `blur(${Math.max(2, r * 0.1)}px)`;
  for (let i = 0; i < blotch; i++) {
    const x = c[0] + (rng() - 0.5) * r * 2, y = c[1] + (rng() - 0.5) * r * 2, rr = r * (0.1 + rng() * 0.3);
    g.fillStyle = rng() < 0.5 ? `rgba(18,16,12,${0.05 + rng() * 0.06})` : `rgba(236,230,214,${0.03 + rng() * 0.05})`;
    g.beginPath(); g.ellipse(x, y, rr, rr * (0.4 + rng() * 0.6), rng() * 3, 0, 6.283); g.fill();
  }
  g.filter = 'none';
  const n = Math.min(2600, Math.round(r * r * 0.5));
  for (let i = 0; i < n; i++) {
    g.fillStyle = rng() < 0.55 ? `rgba(14,12,9,${grain})` : `rgba(240,235,222,${grain * 0.7})`;
    g.fillRect(c[0] + (rng() - 0.5) * r * 2, c[1] + (rng() - 0.5) * r * 2, 1, 1);
  }
  g.restore();
}

/**
 * A scribed line: a thin dark groove with a faint pale lip on the light side. This is how a course of block shows on a
 * wall top — cut into the face. Outlining each block instead is what read as a cartoon.
 */
export function scribe(g, pts, o, dark = 0.42, pale = 0.1) {
  line(g, pts.map(([x, y]) => [x + LIGHT.at[0] * o.ink * 0.9, y + LIGHT.at[1] * o.ink * 0.9]), `rgba(242,236,222,${pale})`, o.ink * 0.9);
  line(g, pts, `rgba(16,13,9,${dark})`, o.ink * 0.95);
}

// ---------------------------------------------------------------------------------------------------- materials

/** Courses of squared block: the joints scribed, each block a shade off its neighbours, a few corners chipped. */
function courses(g, rng, segs, half, o, { step, rows, stagger, vary = 0.055, chip = 0.2 }) {
  const ch = (half * 2) / rows;
  for (const s of segs) {
    const [dx, dy] = s.d, [nx, ny] = s.n;
    for (let c = 0; c < rows; c++) {
      const n0 = -half + c * ch, n1 = n0 + ch, off = stagger ? (c % 2) * step * stagger : 0;
      if (c > 0) scribe(g, [[s.a[0] + nx * n0, s.a[1] + ny * n0], [s.b[0] + nx * n0, s.b[1] + ny * n0]], o, 0.4, 0.1);
      let t = -off;
      while (t < s.len) {
        const w = step * (1 + (rng() - 0.5) * 0.22), t0 = Math.max(0, t), t1 = Math.min(s.len, t + w);
        if (t1 - t0 > step * 0.2) {
          const q = [[s.a[0] + dx * t0 + nx * n0, s.a[1] + dy * t0 + ny * n0], [s.a[0] + dx * t1 + nx * n0, s.a[1] + dy * t1 + ny * n0],
            [s.a[0] + dx * t1 + nx * n1, s.a[1] + dy * t1 + ny * n1], [s.a[0] + dx * t0 + nx * n1, s.a[1] + dy * t0 + ny * n1]];
          const d = (rng() - 0.5) * vary * 2;
          g.fillStyle = d < 0 ? `rgba(16,14,10,${-d * 2.2})` : `rgba(240,234,220,${d * 1.7})`; poly(g, q); g.fill();
          if (rng() < chip) {
            const k = rng() < 0.5 ? 0 : 3, p = q[k];
            poly(g, [p, [p[0] + dx * step * 0.2, p[1] + dy * step * 0.2],
              [p[0] + nx * ch * 0.3 * (k ? -1 : 1) + dx * step * 0.1, p[1] + ny * ch * 0.3 * (k ? -1 : 1) + dy * step * 0.1]]);
            g.fillStyle = 'rgba(18,15,10,0.16)'; g.fill();
          }
        }
        if (t1 < s.len) scribe(g, [[s.a[0] + dx * t1 + nx * n0, s.a[1] + dy * t1 + ny * n0], [s.a[0] + dx * t1 + nx * n1, s.a[1] + dy * t1 + ny * n1]], o, 0.38, 0.09);
        t += w;
      }
    }
  }
}

/**
 * What a wall can be made of. `base` is its top, `edge` the sliver of side it shows, `grain` how coarse its face is,
 * and `face` scribes whatever a mason (or nobody) left on it. A GM picks one per wall; wall-looks.mjs guesses when
 * they have not.
 */
export const WALL_MATERIALS = Object.freeze({
  dressed: {
    label: 'Dressed stone', about: 'long squared blocks, two courses',
    base: '#6c6a62', edge: '#2c2b26', grain: 0.1,
    face(g, rng, segs, half, o) { courses(g, rng, segs, half, o, { step: o.unit * 0.74, rows: 2, stagger: 0.5, chip: 0.25 }); },
  },
  fieldstone: {
    label: 'Fieldstone', about: 'unsquared rubble, packed not coursed',
    base: '#696760', edge: '#2b2a25', grain: 0.11,
    face(g, rng, segs, half, o) {
      // Packed, never marched: a big stone takes the whole thickness, a small one leaves room for one or two beside
      // it, and every cell is turned and squashed its own way.
      const cell = (cx, cy, r, squash, turn) => {
        const ring = [], ca = Math.cos(turn), sa = Math.sin(turn);
        for (let i = 0; i <= 13; i++) {
          const a = (i / 13) * 6.283, k = 1 + (noise(Math.cos(a) * 1.7 + cx * 0.03, Math.sin(a) * 1.7 + cy * 0.03) - 0.5) * 0.62;
          const u = Math.cos(a) * r * k, v = Math.sin(a) * r * k * squash;
          ring.push([cx + ca * u - sa * v, cy + sa * u + ca * v]);
        }
        scribe(g, ring, o, 0.3 + rng() * 0.14, 0.09);
        g.fillStyle = `rgba(${rng() < 0.5 ? '20,18,14' : '238,232,216'},${0.03 + rng() * 0.05})`; poly(g, ring); g.fill();
      };
      for (const s of segs) {
        let t = 0;
        while (t < s.len) {
          if (rng() < 0.42) {
            const r = half * (0.82 + rng() * 0.3);
            cell(s.a[0] + s.d[0] * t + s.n[0] * (rng() - 0.5) * half * 0.25, s.a[1] + s.d[1] * t + s.n[1] * (rng() - 0.5) * half * 0.25, r, 0.6 + rng() * 0.5, rng() * 3.14);
            t += r * (1.1 + rng() * 0.5);
          } else {
            const n = 2 + (rng() < 0.3 ? 1 : 0), step = half * (0.75 + rng() * 0.5);
            for (let i = 0; i < n; i++) {
              const r = half * (0.3 + rng() * 0.3), off = -half + half * 2 * ((i + 0.5 + (rng() - 0.5) * 0.4) / n), jitter = (rng() - 0.5) * step * 0.4;
              cell(s.a[0] + s.d[0] * (t + jitter) + s.n[0] * off, s.a[1] + s.d[1] * (t + jitter) + s.n[1] * off, r, 0.62 + rng() * 0.5, rng() * 3.14);
            }
            t += step;
          }
        }
      }
    },
  },
  brick: {
    label: 'Brick', about: 'three tight courses, muted clay',
    base: '#73574a', edge: '#2e231b', grain: 0.1,
    face(g, rng, segs, half, o) { courses(g, rng, segs, half, o, { step: o.unit * 0.36, rows: 3, stagger: 0.5, vary: 0.07, chip: 0.1 }); },
  },
  timber: {
    label: 'Timber', about: 'planking, grain along the run, iron straps',
    base: '#5e4d33', edge: '#271f14', grain: 0.12,
    face(g, rng, segs, half, o) {
      for (const s of segs) {
        const rows = 3, ph = (half * 2) / rows, ang = Math.atan2(s.d[1], s.d[0]);
        for (let p = 1; p < rows; p++) {
          const off = -half + p * ph;
          scribe(g, [[s.a[0] + s.n[0] * off, s.a[1] + s.n[1] * off], [s.b[0] + s.n[0] * off, s.b[1] + s.n[1] * off]], o, 0.45, 0.1);
        }
        for (let i = 0; i < s.len / (o.unit * 0.05); i++) {
          const t = rng() * s.len, off = (rng() - 0.5) * half * 1.9, x = s.a[0] + s.d[0] * t + s.n[0] * off, y = s.a[1] + s.d[1] * t + s.n[1] * off, l = o.unit * (0.1 + rng() * 0.3);
          line(g, [[x - Math.cos(ang) * l, y - Math.sin(ang) * l], [x + Math.cos(ang) * l, y + Math.sin(ang) * l]], rng() < 0.6 ? 'rgba(20,16,8,0.16)' : 'rgba(238,228,206,0.08)', o.ink * 0.6);
        }
        for (let i = 1; i < 3; i++) {
          const t = (s.len * i) / 3, q = [[s.a[0] + s.d[0] * t + s.n[0] * -half, s.a[1] + s.d[1] * t + s.n[1] * -half], [s.a[0] + s.d[0] * t + s.n[0] * half, s.a[1] + s.d[1] * t + s.n[1] * half]];
          line(g, q, 'rgba(44,40,36,0.5)', o.ink * 2.4);
          line(g, q.map(([x, y]) => [x + LIGHT.at[0] * o.ink, y + LIGHT.at[1] * o.ink]), 'rgba(226,218,198,0.1)', o.ink * 0.8);
        }
      }
    },
  },
  palisade: {
    label: 'Palisade', about: 'log tops, rings and all',
    base: '#5d4d33', edge: '#261f13', grain: 0.11,
    face(g, rng, segs, half, o) {
      for (const s of segs) {
        const r = half * 0.92;
        let t = r * 0.85;
        while (t < s.len) {
          const cx = s.a[0] + s.d[0] * t, cy = s.a[1] + s.d[1] * t, rr = r * (0.9 + rng() * 0.16);
          const ring = (k) => {
            const p = [];
            for (let i = 0; i <= 15; i++) { const a = (i / 15) * 6.283, w = 1 + (noise(Math.cos(a) * 2 + t, Math.sin(a) * 2) - 0.5) * 0.16; p.push([cx + Math.cos(a) * rr * k * w, cy + Math.sin(a) * rr * k * w]); }
            return p;
          };
          poly(g, ring(1)); g.fillStyle = shade(this.base, (rng() - 0.5) * 0.12); g.fill();
          scribe(g, ring(1), o, 0.5, 0.12);
          for (let k = 1; k <= 3; k++) scribe(g, ring(0.24 * k).map(([x, y]) => [x + LIGHT.at[0] * rr * 0.07, y + LIGHT.at[1] * rr * 0.07]), o, 0.2 - k * 0.03, 0.05);
          line(g, wander(rng, cx - rr * 0.1, cy - rr * 0.1, rng() * 6.28, 3, rr * 0.3, 0.9), 'rgba(22,18,10,0.3)', o.ink * 0.8);
          t += rr * 1.78;
        }
      }
    },
  },
  adobe: {
    label: 'Adobe', about: 'rendered mud, no course at all',
    base: '#897858', edge: '#3a3023', grain: 0.09,
    face(g, rng, segs, half, o) {
      for (const s of segs) for (let i = 0; i < s.len / (o.unit * 0.55); i++) {
        const t = rng() * s.len, off = (rng() - 0.5) * half * 1.7;
        scribe(g, wander(rng, s.a[0] + s.d[0] * t + s.n[0] * off, s.a[1] + s.d[1] * t + s.n[1] * off, rng() * 6.28, 3, half * 0.45, 1.2), o, 0.2, 0.05);
      }
    },
  },
  hewn: {
    label: 'Hewn rock', about: 'cut from the rock, chisel marks only',
    base: '#5a5953', edge: '#252420', grain: 0.12,
    face(g, rng, segs, half, o) {
      for (const s of segs) for (let i = 0; i < s.len / (o.unit * 0.1); i++) {
        const t = rng() * s.len, off = (rng() - 0.5) * half * 1.8, x = s.a[0] + s.d[0] * t + s.n[0] * off, y = s.a[1] + s.d[1] * t + s.n[1] * off;
        const a = Math.atan2(s.n[1], s.n[0]) + (rng() - 0.5) * 0.7, l = o.unit * (0.05 + rng() * 0.09);
        const p0 = [x - Math.cos(a) * l, y - Math.sin(a) * l], p1 = [x + Math.cos(a) * l, y + Math.sin(a) * l];
        line(g, [p0.map((v, k) => v + LIGHT.at[k] * o.ink), p1.map((v, k) => v + LIGHT.at[k] * o.ink)], 'rgba(240,235,222,0.14)', o.ink * 0.7);
        line(g, [p0, p1], 'rgba(16,14,10,0.4)', o.ink * 0.8);
      }
    },
  },
  natural: {
    label: 'Living rock', about: 'never cut: it was always this shape',
    base: '#4f4d47', edge: '#1f1e1b', grain: 0.13,
    face(g, rng, segs, half, o) {
      for (const s of segs) for (let i = 0; i < s.len / (o.unit * 0.5); i++) {
        const t = rng() * s.len, off = (rng() - 0.5) * half * 1.8;
        scribe(g, wander(rng, s.a[0] + s.d[0] * t + s.n[0] * off, s.a[1] + s.d[1] * t + s.n[1] * off, rng() * 6.28, 4, half * 0.6, 1.3), o, 0.26, 0.06);
      }
    },
  },
});

export const WALL_MATERIAL_IDS = Object.freeze(Object.keys(WALL_MATERIALS));
/** What the settings and the wall's own configuration offer, without the painting functions. */
export const WALL_MATERIAL_CHOICES = Object.freeze(Object.entries(WALL_MATERIALS).map(([id, m]) => Object.freeze({ id, label: m.label, about: m.about, base: m.base })));

// How roughly a boundary was worked, in grid squares of wobble. A faced hall barely wanders; a cave wanders badly.
export const WORKED = Object.freeze({ faced: 0.035, cut: 0.06, raw: 0.16 });

// ---------------------------------------------------------------------------------------------------- a run

/**
 * One run of wall, painted into `g` in the picture's own pixels. `points` are already relative to the picture.
 * The shadow on the floor carries the height; the wall itself is nearly flat, with a hand-drawn edge.
 * `o`: { unit (pixels a grid square), ink, seed, snow, moss, soot, ruin, thick, height }.
 */
/** Painted with the light where o.lit says it is, so a wall agrees with the ground it stands on. */
/**
 * A wall covered with a picture of a strip of wall the GM owns (roof-cover.mjs) in place of stones painted one by
 * one. The line, its thickness, its corners and its ends stay ours: the strip is scaled so its wall is exactly as
 * thick as this wall is drawn — so the doorways and windows cut in it still fit — laid along each stretch with its
 * courses carried on from the stretch before, and each stretch cut to a mitre where it meets the next, which holds
 * at any angle. (The pack's own corner pieces were tried and left gaps: they are made for corners on the grid.)
 */
function layStrip(g, segs, half, cover, closed) {
  const [top, bottom] = Array.isArray(cover.band) ? cover.band : [0, cover.height];
  const k = (half * 2) / Math.max(1, bottom - top), w = cover.width * k, h = cover.height * k, mid = ((top + bottom) / 2) * k;
  if (!(w > 1)) return;
  const A = offsetSide(segs, half * 1.05, 1, closed), B = offsetSide(segs, half * 1.05, -1, closed);
  let along = 0;
  segs.forEach((s, i) => {
    g.save(); poly(g, [A[i], A[i + 1], B[i + 1], B[i]]); g.clip();
    g.translate(s.a[0], s.a[1]); g.rotate(Math.atan2(s.d[1], s.d[0]));
    for (let x = -(along % w) - w, n = 0; x < s.len + w && n < 400; x += w, n++) g.drawImage(cover.image, x, -mid, w, h);
    g.restore(); along += s.len;
  });
}

export function paintRun(g, points, material, o) { return underLight(o?.lit, () => paintRunLit(g, points, material, o)); }
function paintRunLit(g, points, material, o) {
  // The material wearing whatever colour it was painted in, before any of it is drawn, so the tint runs through
  // the stone rather than sitting on top of it.
  const m = tintedKind(WALL_MATERIALS[material] ?? WALL_MATERIALS.dressed, o.tint, o.tintMuch);
  const rng = seeded(o.seed ?? 11), segs = [];
  const half = o.unit * (o.thick ?? WALL_THICK), lift = o.unit * (o.height ?? WALL_LIFT);
  // (A wall covered with a picture keeps a straight edge: the picture has its own drawn one, and a ragged cut eats it.)
  const cover = o.cover?.image && o.cover.width > 0 && o.cover.height > 0 ? o.cover : null, rough = cover ? 0 : half * 0.11;
  // A ring comes back to where it started, so it has no ends at all: nothing to run on past, nothing to cap.
  const ring = o.closed === true && points.length > 3 && Math.hypot(points[0][0] - points.at(-1)[0], points[0][1] - points.at(-1)[1]) < 1;
  // An end that meets another wall is run on past the corner, so the two overlap and neither shows a cap. An end that
  // meets nothing — a doorway's jamb, the stub of a ruin — keeps its own edge, because there the wall really stops.
  const run = ring ? points : joinEnds(points, half, o.join);
  for (let i = 0; i < run.length - 1; i++) segs.push(wallSeg(run[i], run[i + 1]));
  if (!segs.length) return;
  // A ring has no ends, so its outline is two loops — the outside and the inside — and the one polygon that holds
  // both has to be slit open somewhere to join them. The fill does not mind the slit; the ink line did, and drew it:
  // a stroke straight across the wall at the corner the run happened to start from (Roi: "why left side is not
  // connecting seamlessly?"). So the two sides are kept apart here, and the ink walks each loop on its own.
  const sideA = ring ? ragged(subdivide(offsetSide(segs, half, 1, true), 7), rough, o.seed ?? 1) : null;
  const sideB = ring ? ragged(subdivide(offsetSide(segs, half, -1, true), 7), rough, (o.seed ?? 1) + 5) : null;
  const edge = ring ? [...sideA, ...sideB.slice().reverse()] : ragged(subdivide(runOutline(segs, half, false), 7), rough, o.seed ?? 1);
  const face = edge.map(([x, y]) => [x + LIGHT.at[0] * lift, y + LIGHT.at[1] * lift]);
  // What the ink goes round: one loop for a run with ends, where the caps are edges like any other; two for a ring.
  const inked = ring ? [face.slice(0, sideA.length), face.slice(sideA.length)] : [face];

  // Thrown away from the light, soft and long; then a tight one hugging the wall, which is what sells the height.
  g.save(); g.filter = `blur(${Math.max(3, o.unit * 0.11)}px)`; g.translate(-LIGHT.at[0] * o.unit * 0.3, -LIGHT.at[1] * o.unit * 0.3);
  poly(g, edge); g.fillStyle = 'rgba(12,10,7,0.34)'; g.fill(); g.restore();
  g.save(); g.filter = `blur(${Math.max(2, o.unit * 0.05)}px)`; poly(g, edge); g.fillStyle = 'rgba(12,10,7,0.4)'; g.fill(); g.restore();

  // The sliver of side it shows: the gap between its foot and its lifted top.
  g.save(); poly(g, edge); g.clip(); g.fillStyle = mix(m.edge, '#0b0a08', 0.3); poly(g, edge); g.fill(); g.restore();

  if (cover) { poly(g, face); g.fillStyle = mix(m.edge, '#0b0a08', 0.5); g.fill(); } else faceStone(g, rng, face, m.base, o, { grain: m.grain });
  const lifted = segs.map((s) => wallSeg([s.a[0] + LIGHT.at[0] * lift, s.a[1] + LIGHT.at[1] * lift], [s.b[0] + LIGHT.at[0] * lift, s.b[1] + LIGHT.at[1] * lift]));
  g.save(); poly(g, face); g.clip();
  if (cover) layStrip(g, lifted, half, cover, ring); else m.face(g, rng, lifted, half, o);
  weather(g, rng, lifted, half, o);
  g.restore();

  // (A covering picture has its own drawn edge along both sides; only its cut ends want closing, with one plain line.)
  if (cover) { for (const loop of inked) line(g, [...loop, loop[0]], INK, o.ink * 0.9); if (o.ruin > 0) bites(g, rng, lifted, half, o, face); return; }
  // A pale lip where the light catches the top, then the ink line, its weight uneven as a drawn one is.
  g.save(); poly(g, face); g.clip();
  for (const loop of inked) line(g, [...loop, loop[0]].map(([x, y]) => [x + LIGHT.at[0] * o.ink * 1.6, y + LIGHT.at[1] * o.ink * 1.6]), 'rgba(244,238,224,0.17)', o.ink * 1.8);
  g.restore();
  for (const loop of inked) {
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i], b = loop[(i + 1) % loop.length], w = 1 + (noise(a[0] * 0.05, a[1] * 0.05, 4) - 0.5) * 0.9;
      line(g, [a, b], INK, o.ink * 1.45 * w);
    }
  }
  if (o.ruin > 0) bites(g, rng, lifted, half, o, face);
}

/** Season and state on a wall's top: soot, moss in beds along the foot the light misses, snow on the side it comes from. */
export function weather(g, rng, segs, half, o) {
  if (o.soot > 0) {
    g.save(); g.filter = `blur(${half * 0.35}px)`;
    for (let i = 0; i < 44 * o.soot; i++) {
      const s = segs[Math.floor(rng() * segs.length)], t = rng() * s.len, off = (rng() - 0.5) * half * 2;
      const x = s.a[0] + s.d[0] * t + s.n[0] * off, y = s.a[1] + s.d[1] * t + s.n[1] * off, rr = half * (0.3 + rng() * 0.9);
      g.fillStyle = `rgba(16,13,11,${0.16 + rng() * 0.26 * o.soot})`; g.beginPath(); g.ellipse(x, y, rr, rr * 0.7, rng() * 3, 0, 6.28); g.fill();
    }
    g.restore();
  }
  if (o.moss > 0) {
    // In runs, not as a sprinkle: a few beds, each a chain of clumps thinning at its ends, laid dark first and lit on
    // top so it has some body at the zoom a map is actually read at.
    const DEEP = '#26300f', BODY = '#44511b', TOP = '#6c7a2e';
    const blobAt = (x, y, rr, fill, a) => {
      const p = [];
      for (let k = 0; k <= 11; k++) { const ang = (k / 11) * 6.283, w = 1 + (noise(Math.cos(ang) * 2.2 + x * 0.05, Math.sin(ang) * 2.2 + y * 0.05) - 0.5) * 0.85; p.push([x + Math.cos(ang) * rr * w, y + Math.sin(ang) * rr * w * 0.8]); }
      g.globalAlpha = a; g.fillStyle = fill; poly(g, p); g.fill(); g.globalAlpha = 1;
    };
    const beds = Math.max(2, Math.round((3 + 4 * o.moss) * segs.length * 0.5));
    for (let b = 0; b < beds; b++) {
      const s = segs[Math.floor(rng() * segs.length)], t0 = rng() * s.len, run = half * (2.5 + rng() * 7) * (0.5 + o.moss * 0.5);
      const side = rng() < 0.86 ? 1 : -1, n = Math.max(4, Math.round(run / (half * 0.42)));
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1), taper = Math.sin(f * Math.PI) ** 0.6, t = t0 + run * f;
        if (t < 0 || t > s.len) continue;
        const off = half * side * (0.52 + (noise(t * 0.06, b * 3.1) - 0.5) * 0.7), rr = half * (0.2 + 0.4 * taper) * (0.75 + rng() * 0.5);
        const x = s.a[0] + s.d[0] * t + s.n[0] * off, y = s.a[1] + s.d[1] * t + s.n[1] * off;
        blobAt(x - LIGHT.at[0] * rr * 0.2, y - LIGHT.at[1] * rr * 0.2, rr * 1.12, DEEP, 0.5 * o.moss + 0.25);
        blobAt(x, y, rr, BODY, 0.62 * o.moss + 0.3);
        blobAt(x + LIGHT.at[0] * rr * 0.26, y + LIGHT.at[1] * rr * 0.26, rr * 0.6, TOP, 0.4 * o.moss + 0.2);
        for (let k = 0; k < 7; k++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr; g.fillStyle = rng() < 0.5 ? 'rgba(126,140,56,0.5)' : 'rgba(26,34,12,0.45)'; g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.4, 1.4); }
        if (rng() < 0.5) line(g, wander(rng, x, y, Math.atan2(s.n[1], s.n[0]) * side + (rng() - 0.5), 2, rr * 0.55, 0.9), 'rgba(72,86,32,0.6)', o.ink * 0.7);
      }
    }
  }
  if (o.snow > 0) {
    for (let i = 0; i < 26 * o.snow; i++) {
      const s = segs[Math.floor(rng() * segs.length)], t = rng() * s.len, off = -half * (0.52 + rng() * 0.48) * (rng() < 0.9 ? 1 : -1);
      const x = s.a[0] + s.d[0] * t + s.n[0] * off, y = s.a[1] + s.d[1] * t + s.n[1] * off, rr = half * (0.16 + rng() * 0.3), p = [];
      for (let k = 0; k <= 10; k++) { const a = (k / 10) * 6.283, w = 1 + (noise(Math.cos(a) * 2.2 + t, Math.sin(a) * 2.2) - 0.5) * 0.9; p.push([x + Math.cos(a) * rr * w, y + Math.sin(a) * rr * w * 0.7]); }
      poly(g, p.map(([px, py]) => [px - LIGHT.at[0] * rr * 0.2, py - LIGHT.at[1] * rr * 0.2])); g.fillStyle = 'rgba(146,162,186,0.5)'; g.fill();
      poly(g, p); g.fillStyle = 'rgba(236,241,248,0.88)'; g.fill();
      poly(g, p.map(([px, py]) => [px + LIGHT.at[0] * rr * 0.13, py + LIGHT.at[1] * rr * 0.13])); g.fillStyle = 'rgba(252,253,255,0.6)'; g.fill();
    }
  }
}

/** A crumbling top: the stone gone and the wall's broken core showing, never a hole punched through to the floor. */
function bites(g, rng, segs, half, o, face) {
  for (let i = 0; i < 8 * o.ruin; i++) {
    const s = segs[Math.floor(rng() * segs.length)], t = rng() * s.len, side = rng() < 0.5 ? 1 : -1;
    const x = s.a[0] + s.d[0] * t + s.n[0] * half * side, y = s.a[1] + s.d[1] * t + s.n[1] * half * side, rr = half * (0.35 + rng() * 0.8), p = [];
    for (let k = 0; k <= 11; k++) { const a = (k / 11) * 6.283, w = 1 + (noise(Math.cos(a) * 2 + t, Math.sin(a) * 2, 5) - 0.5) * 0.7; p.push([x + Math.cos(a) * rr * w, y + Math.sin(a) * rr * w]); }
    g.save(); poly(g, face); g.clip();
    poly(g, p); g.fillStyle = 'rgba(30,27,22,0.72)'; g.fill();
    for (let k = 0; k < 24; k++) { const a = rng() * 6.283, d = Math.sqrt(rng()) * rr; g.fillStyle = rng() < 0.5 ? 'rgba(12,10,8,0.5)' : 'rgba(188,180,164,0.22)'; g.fillRect(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.6, 1.6); }
    poly(g, p); g.strokeStyle = INK; g.lineWidth = o.ink * 1.2; g.stroke();
    g.restore();
  }
}

// ---------------------------------------------------------------------------------------------------- underground

/**
 * A room's floor, where the painter is laying one. Warm and flat against the cool rock, so the two never read as the
 * same material — they did, and the map looked like a stencil. Slabs on the grid where someone laid them; worn bedrock
 * with cracks wandering across it where nobody did.
 */
export function floorUnder(g, rng, edge, o, { laid = true } = {}) {
  const xs = edge.map((p) => p[0]), ys = edge.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  g.fillStyle = laid ? '#6a6054' : '#5d5449';
  g.fillRect(x0 - 4, y0 - 4, x1 - x0 + 8, y1 - y0 + 8);
  g.save(); g.filter = `blur(${o.unit * 0.45}px)`;
  for (let y = y0; y < y1 + o.unit; y += o.unit * 0.5) for (let x = x0; x < x1 + o.unit; x += o.unit * 0.5) {
    const n = noise(x / (o.unit * 2), y / (o.unit * 2), 31) - 0.5;
    g.fillStyle = n < 0 ? `rgba(18,15,12,${-n * 0.5})` : `rgba(236,228,210,${n * 0.26})`;
    g.beginPath(); g.arc(x, y, o.unit * 0.5, 0, 6.283); g.fill();
  }
  g.restore();
  if (!laid) {
    for (let i = 0; i < (x1 - x0) / (o.unit * 0.35); i++) scribe(g, wander(rng, x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), rng() * 6.283, 5, o.unit * 0.3, 1.1), o, 0.2, 0.05);
  } else {
    const step = o.unit;
    for (let x = Math.floor(x0 / step) * step; x < x1 + step; x += step) scribe(g, [[x, y0 - 4], [x, y1 + 4]], o, 0.3, 0.07);
    for (let y = Math.floor(y0 / step) * step; y < y1 + step; y += step) scribe(g, [[x0 - 4, y], [x1 + 4, y]], o, 0.3, 0.07);
    for (let x = Math.floor(x0 / step) * step; x < x1 + step; x += step) for (let y = Math.floor(y0 / step) * step; y < y1 + step; y += step) {
      const d = noise(x * 0.02, y * 0.02, 12) - 0.5;
      g.fillStyle = d < 0 ? `rgba(16,13,10,${-d * 0.3})` : `rgba(240,232,214,${d * 0.16})`;
      g.fillRect(x, y, step, step);
    }
  }
  const n = Math.min(4000, Math.round(((x1 - x0) * (y1 - y0)) / 26));
  for (let i = 0; i < n; i++) { g.fillStyle = rng() < 0.55 ? 'rgba(16,13,10,0.09)' : 'rgba(234,226,208,0.06)'; g.fillRect(x0 + rng() * (x1 - x0), y0 + rng() * (y1 - y0), 1, 1); }
}

/**
 * The rock, and the rooms cut out of it. `rooms`: [{ pts, face, worked, coursed, laid }], already in picture pixels.
 * `mass` is the one material the whole stone is; a room's `face` only says how its own boundary was worked.
 */
export function paintRock(g, rooms, mass, o, w, h) { return underLight(o?.lit, () => paintRockLit(g, rooms, mass, o, w, h)); }
function paintRockLit(g, rooms, mass, o, w, h) {
  const m = WALL_MATERIALS[mass] ?? WALL_MATERIALS.hewn, rng = seeded(o.seed ?? 5), rect = [[0, 0], [w, 0], [w, h], [0, h]];
  const edges = rooms.map((r, i) => ragged(subdivide(r.pts, 6), o.unit * (r.worked ?? WORKED.cut), (o.seed ?? 1) + i * 17));

  g.fillStyle = '#1a1816'; g.fillRect(0, 0, w, h);
  edges.forEach((e, i) => { g.save(); poly(g, e); g.clip(); floorUnder(g, rng, e, o, { laid: rooms[i].laid !== false }); g.restore(); });

  const rockPath = () => {
    g.beginPath();
    rect.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    for (const e of edges) { e.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); }
  };
  g.save(); rockPath(); g.clip('evenodd');
  // The mass is darker and cooler than any floor laid on it, so the two never read as one material.
  faceStone(g, rng, rect, mix(m.base, '#232220', 0.56), o, { grain: m.grain, blotch: Math.round((w * h) / 9000), drift: 0.7 });
  // Its detail is read off the room boundaries, since that is the only place the rock is ever seen up close — and
  // each boundary is worked its own way, so one mass can hold a faced hall and a raw cave at once.
  edges.forEach((e, i) => {
    const segs = [];
    for (let k = 0; k < e.length; k++) segs.push(wallSeg(e[k], e[(k + 1) % e.length]));
    (WALL_MATERIALS[rooms[i].face] ?? m).face(g, rng, segs, o.unit * WALL_THICK, o);
  });
  for (const room of rooms.filter((r) => r.coursed)) {
    const rings = [offsetClosed(room.pts, o.unit * 0.17), offsetClosed(room.pts, o.unit * 0.44)];
    g.save(); poly(g, rings[1]); g.fillStyle = 'rgba(232,226,210,0.07)'; g.fill();
    poly(g, rings[0]); g.fillStyle = 'rgba(20,18,14,0.1)'; g.fill(); g.restore();
    for (const ring of rings) scribe(g, [...ring, ring[0]], o, 0.6, 0.15);
    const [a, b] = rings;
    for (let i = 0; i < a.length; i++) {
      const pa = a[i], pb = b[i], na = a[(i + 1) % a.length], nb = b[(i + 1) % b.length];
      const run = Math.hypot(na[0] - pa[0], na[1] - pa[1]), n = Math.max(1, Math.round(run / (o.unit * 0.66)));
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n;
        scribe(g, [[pa[0] + (na[0] - pa[0]) * f, pa[1] + (na[1] - pa[1]) * f], [pb[0] + (nb[0] - pb[0]) * f, pb[1] + (nb[1] - pb[1]) * f]], o, 0.5, 0.13);
      }
    }
  }
  g.restore();

  // Each room's own darkness: the rock crowds it, so the light dies at its edge and its corners go deepest.
  edges.forEach((e, i) => {
    g.save(); poly(g, e); g.clip();
    g.filter = `blur(${o.unit * 0.22}px)`; poly(g, e); g.strokeStyle = 'rgba(10,9,7,0.4)'; g.lineWidth = o.unit * 0.3; g.stroke();
    g.filter = `blur(${o.unit * 0.07}px)`; poly(g, e); g.strokeStyle = 'rgba(10,9,7,0.34)'; g.lineWidth = o.unit * 0.09; g.stroke();
    g.restore();
    g.save(); rockPath(); g.clip('evenodd');
    line(g, [...e, e[0]].map(([x, y]) => [x + LIGHT.at[0] * o.ink * 1.8, y + LIGHT.at[1] * o.ink * 1.8]), 'rgba(244,238,224,0.15)', o.ink * 2);
    g.restore();
    for (let k = 0; k < e.length; k++) {
      const p = e[k], q = e[(k + 1) % e.length], wgt = 1 + (noise(p[0] * 0.05, p[1] * 0.05, 4) - 0.5) * 0.9;
      line(g, [p, q], INK, o.ink * 1.4 * wgt);
    }
    if (rooms[i].laid === false) scree(g, rng, e, m, o);
  });
}

/** Loose stone gathered where the rock meets the floor of a chamber nobody ever finished. */
function scree(g, rng, edge, m, o) {
  const inner = offsetClosed(edge, -o.unit * 0.12);
  for (let i = 0; i < inner.length; i += 2) {
    if (rng() >= 0.4) continue;
    const p = inner[i], rr = o.unit * (0.012 + rng() * 0.032), q = [];
    for (let k = 0; k <= 8; k++) { const ang = (k / 8) * 6.283, n = 1 + (noise(Math.cos(ang) * 2 + i, Math.sin(ang) * 2, 6) - 0.5) * 0.6; q.push([p[0] + Math.cos(ang) * rr * n, p[1] + Math.sin(ang) * rr * n * 0.85]); }
    faceStone(g, rng, q, shade(m.base, (rng() - 0.5) * 0.25), o, { grain: m.grain * 0.7, blotch: 1, drift: 0 });
    poly(g, q); g.strokeStyle = INK; g.lineWidth = o.ink * 0.9; g.stroke();
  }
}

// ---------------------------------------------------------------------------------------------------- pictures

/** The seed a run is painted from: the same wall paints the same way on every screen, and on every reload. */
export const runSeed = (key) => hashText(String(key ?? 'wall'));

/**
 * One run's picture. `points` are in scene pixels; the picture covers runBox and the drawing is offset into it.
 * Returns { canvas, box } — or null when the run has no length, or the box would be bigger than `most` pixels a side.
 */
export function paintRunPicture(points, material, look = {}, make = defaultCanvas, most = 2048) {
  if (!Array.isArray(points) || points.length < 2) return null;
  const grid = look.grid ?? 100, box = runBox(points, grid, look);
  const k = Math.min(Math.max(1, Number(look.sharp) || PICTURE_SHARP), most / Math.max(box.w, box.h, 1));
  const w = Math.max(1, Math.ceil(box.w * k)), h = Math.max(1, Math.ceil(box.h * k));
  const canvas = make(w, h), g = canvas.getContext('2d');
  if (!g) return null;
  g.scale(k, k);
  paintRun(g, points.map(([x, y]) => [x - box.x, y - box.y]), material, {
    unit: grid, ink: Math.max(0.7, grid / 90), seed: look.seed ?? 1,
    snow: look.snow ?? 0, moss: look.moss ?? 0, soot: look.soot ?? 0, ruin: look.ruin ?? 0,
    thick: look.thick ?? WALL_THICK, height: look.height ?? WALL_LIFT, join: look.join ?? null, closed: look.closed === true, lit: look.lit ?? null, tint: look.tint ?? null, tintMuch: look.tintMuch, cover: look.cover ?? null,
  });
  return { canvas, box, scale: k };
}
