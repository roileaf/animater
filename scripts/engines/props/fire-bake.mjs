// The look of a burning stretch of ground, drawn once into small pictures and then laid out as sprites.
//
// What it draws (approved against the reference photos, see tools/fx-gallery/fire-looks-mock.html):
//  - squares that touch along a row burn as ONE front: one continuous body whose top edge boils across the whole row,
//    squares that touch only diagonally stay apart;
//  - the body is thin (0.42) and its brightness is built from vertical currents rising inside it, added together and
//    clipped to it; the currents bunch into a few hot knots, and cooler channels are taken out of the mass;
//  - there is no bottom edge: the foot is erased along a wandering line and the heat comes back as uneven seats of light;
//  - hot at the foot, deep red at the tip, fading to nothing; no outline; only the very top frays into a few licks;
//  - dark scorch under it and dark smoke above it, which is where the contrast comes from.
//
// That needs canvas gradients and the "lighter" and "destination-out" composite modes, which PIXI.Graphics has no
// equivalent of, so the pictures are painted with a canvas 2D context. Painting every frame is far too dear on a map
// with hundreds of burning squares; instead a small set is painted once (a few seeded variants, a short loop of frames)
// and the map only places and cycles sprites.
//
// How a front of N squares stays one mass: a front is a row of tiles, one per square, cut from ONE endless strip.
// Everything in the strip (the boiling edge, the currents, the channels, the foot, the seats) is a function of position
// along it that repeats every RING squares, so the tile a square gets is the strip's slice for its place in the ring and
// its neighbour's slice begins exactly where it ends. The two ends of a front get end tiles, where the edge falls to
// the ground. Light that spills across a seam (a seat, a lobe, a lick) is painted into both tiles from the neighbour's
// own features, so nothing is cut at a seam.
//
// Everything is seeded. The same variant, tile and frame paint the same pixels on every screen; time is the loop's
// phase, never a clock read here. The pure parts (grouping, the edge, the plans) have no canvas in them.
import { seededRandom } from "../fragments/fragments.mjs";

export const VARIANTS = 3;
export const FRAMES = 8;
export const LOOP_MS = 1200;
export const FRAME_MS = LOOP_MS / FRAMES;
export const RING = 8;
export const CELL_PX = 64;
// The picture of a tile reaches this many squares above the foot line and this many below it; the foot line is
// FOOT of the way down a square, as in the approved drawing.
export const ABOVE = 3.1, BELOW = 0.3, FOOT = 0.82;
// A ground picture reaches this far past its square.
const G_LEFT = 0.5, G_RIGHT = 0.5, G_UP = 1.6, G_DOWN = 1.15;

const TAU = Math.PI * 2;
const MID = "#ff9a21", DEEP = "#d33c0e", SOOT = "#1a1209";
const mixSeed = (...parts) => { let h = 0x811c9dc5; for (const p of parts) { h = Math.imul(h ^ (p | 0), 0x01000193) >>> 0; h ^= h >>> 15; } return (h >>> 0) || 1; };
const rng = (...parts) => seededRandom(mixSeed(...parts));
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wave = (theta, turns, phase = 0) => Math.sin(TAU * (turns * theta) + phase);

// ---- pure: which squares burn together ----

// Squares that touch along a row are one front; squares that touch only at a corner are not. Cells are {id, seed, rect}.
// A front is {x, y, w, h, cells} with its cells left to right. The order of fronts is the same on every screen.
export function frontsOf(cells) {
  const list = (cells ?? []).filter((c) => c?.rect && [c.rect.x, c.rect.y, c.rect.w, c.rect.h].every(Number.isFinite) && c.rect.w > 0).slice();
  list.sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  const out = [];
  let run = null;
  for (const c of list) {
    const last = run?.cells[run.cells.length - 1];
    const joins = last && Math.abs(c.rect.y - last.rect.y) < 0.5 && Math.abs(c.rect.x - (last.rect.x + last.rect.w)) < 0.5 && Math.abs(c.rect.w - last.rect.w) < 0.5;
    if (joins) run.cells.push(c);
    else { run = { cells: [c] }; out.push(run); }
  }
  return out.map(({ cells: row }) => ({ x: row[0].rect.x, y: row[0].rect.y, w: row[0].rect.w, h: row[0].rect.h, cells: row }));
}

// Where a square sits on the grid, as whole squares: the strip is laid out by these, never by which fire it belongs to, so
// a square that catches beside a front leaves the tiles already drawn exactly as they were.
export const cellAt = (rect) => ({ col: Math.floor(rect.x / rect.w + 0.5), row: Math.floor(rect.y / rect.h + 0.5) });

// The strip a row of squares is cut from: which of the baked variants, where in the loop it starts and where round the ring
// it begins, all from the row alone. Every front in a row is a stretch of the same strip, so fronts that grow or join
// never change the look of the squares already burning. Same row, same answer, on every screen.
export function stripLook(row) {
  const r = rng(row | 0, 0xf17e);
  return { variant: Math.floor(r() * VARIANTS), phase: Math.floor(r() * FRAMES), shift: Math.floor(r() * RING) };
}
// The same for the ground picture of one square.
export function groundLook(seed) {
  const r = rng(seed >>> 0, 0x6407);
  return { variant: Math.floor(r() * VARIANTS), phase: Math.floor(r() * FRAMES) };
}

// The tiles a front of n squares is built from, in order from its start: the picture for each square and the place it
// has in the ring, the strip beginning `offset` squares round it. A single square is its own two ends.
export function tilePlan(n, offset = 0) {
  const count = Math.max(1, Math.floor(n) || 1), o = ((Math.floor(offset) || 0) % RING + RING) % RING;
  if (count === 1) return [{ kind: "solo", k: o }];
  const plan = [{ kind: "left", k: o }];
  for (let i = 1; i < count - 1; i++) plan.push({ kind: "mid", k: (o + i) % RING });
  plan.push({ kind: "right", k: (o + count - 1) % RING });
  return plan;
}

// The tiles of a front {cells}: for each square its picture family and the look of its row's strip. A square's ring place is
// its column (plus its row's shift), so it is the same whichever fire it is part of; only its end-ness (an end tile has the
// edge fall to the ground) changes when a neighbour catches.
export function frontTiles(front) {
  const first = cellAt(front.cells[0].rect), look = stripLook(first.row);
  const o = (((first.col + look.shift) % RING) + RING) % RING;
  return { look, tiles: tilePlan(front.cells.length, o).map((spec) => ({ ...spec, variant: look.variant })) };
}

// How much of each of two consecutive frames to show, `t` of the way from the first to the second. Both fade, so a pixel
// that is the same in both frames keeps nearly the same alpha all the way through (laying the second over a whole first
// would climb to 1-(1-A)^2 and snap back at the flip).
export const fadeWeights = (t) => ({ base: 1 - t, over: t });
// The alpha a pixel of alpha `a` in the first frame and `b` in the second ends up with, composited as two sprites.
export function compositeAlpha(a, b, t) {
  const w = fadeWeights(t);
  return 1 - (1 - w.base * a) * (1 - w.over * b);
}

// Which frame of the loop shows at `ms`, for a front that starts `phase` frames in. Read off the shared clock by the
// caller; when the fire is still the frame is the front's own start frame.
export function frameAt(ms, phase = 0, still = false) {
  const f = FRAMES, p = ((Math.floor(phase) % f) + f) % f;
  if (still) return p;
  return ((Math.floor((Number(ms) || 0) / FRAME_MS) + p) % f + f) % f;
}
// The two frames to blend at `ms` and how much of the second: the loop is played continuously by cross-fading each frame
// into the next, so 8 baked frames move smoothly. Settled, it is the start frame alone.
export function frameMix(ms, phase = 0, still = false) {
  const f = FRAMES, p = ((Math.floor(phase) % f) + f) % f;
  if (still) return { a: p, b: p, t: 0 };
  const pos = (Number(ms) || 0) / FRAME_MS, whole = Math.floor(pos);
  return { a: (((whole + p) % f) + f) % f, b: (((whole + p + 1) % f) + f) % f, t: pos - whole };
}
// How far the whole front leans, in radians of shear at the foot line: all its tiles together, so it moves as one.
export const LEAN = 0.07;
export const leanAt = (ms, phase = 0, still = false) => (still ? 0 : Math.sin((Number(ms) || 0) / 1100 + phase) * LEAN);

// ---- pure: the boiling top edge ----

// Whole turns per RING squares, all odd: about 0.6, 1.4, 2.6 and 4.1 a square. Odd, so half a ring along the edge is a different
// edge and the true period is the whole ring, not half of it.
const EDGE_CYCLES = [5, 11, 21, 33];
const edgePhases = (variant) => { const r = rng(variant, 0xed9e); return [r() * TAU, r() * TAU, r() * TAU, r() * TAU]; };

// How far up the top of a front stands, as a multiple of its lift, at `x` squares along the ring and `theta` of the
// loop. `fromEnd` is how far (in squares) the nearest end of the front is: the edge falls to nothing there and is full
// from a seventh of a square in. Repeats every RING squares and every loop, so tiles and frames join.
export function topAt(x, theta, variant, fromEnd = Infinity) {
  const ph = edgePhases(variant), per = EDGE_CYCLES.map((n) => (TAU * n) / RING);
  const a = Math.sin(per[0] * x + TAU * theta + ph[0]);
  const b = Math.sin(per[1] * x - TAU * theta + ph[1]);
  const c = Math.sin(per[2] * x + TAU * 2 * theta + ph[2]);
  const d = Math.sin(per[3] * x - TAU * 2 * theta + ph[3]);
  const shoulder = clamp01(fromEnd * 7);
  const roll = 0.58 + 0.26 * a + 0.16 * b + 0.09 * c + 0.05 * d;
  return shoulder * Math.max(0.12, roll);
}
// The height of the front's mass: breathes with the loop.
export const liftAt = (theta) => 1.9 + 0.45 * (0.5 + 0.5 * Math.sin(TAU * theta));

// How far up the erased foot reaches (in squares) at `x` along the ring: a smooth wandering line through random anchors a
// quarter of a square apart, so the foot is uneven but has no comb in it. Repeats every RING squares.
export function footAt(x, variant) {
  const per = 4, n = RING * per, g = x * per, j = Math.floor(g), t = g - j, u = (1 - Math.cos(Math.PI * t)) / 2;
  const anchor = (i) => 0.18 + 0.26 * rng(variant, ((i % n) + n) % n, 0xf007)();
  return anchor(j) * (1 - u) + anchor(j + 1) * u;
}

// ---- pure: the seeded features of one square of the strip ----

// Everything random about one square of the ring, for one variant: where its knots, currents, channels, lobes, licks,
// foot slices and seats are. Numbers only (0-1 draws), so the same call gives the same features everywhere.
export function cellFeatures(variant, k) {
  const r = rng(variant, k, 0xce11);
  const knots = [0, 1].map(() => ({ u: 0.12 + 0.76 * r(), pull: 0.5 + 0.5 * r(), tall: 0.7 + 0.55 * r() }));
  const knotCount = r() < 0.5 ? 2 : 1;
  const columns = Array.from({ length: 9 }, () => ({ knot: Math.floor(r() * knotCount), spread: r() - 0.5, phase: r() * TAU, tall: r(), wide: r() }));
  const channels = Array.from({ length: r() < 0.5 ? 3 : 2 }, () => ({ u: 0.1 + 0.8 * r(), tall: 0.3 + 0.4 * r() }));
  const lobes = Array.from({ length: 7 }, () => ({ u: 0.12 + 0.76 * r(), turns: r() < 0.5 ? 1 : 2, phase: r() * TAU, y: 0.12 + 0.5 * r(), rad: 0.1 + 0.16 * r() }));
  const licks = Array.from({ length: r() < 0.5 ? 3 : 2 }, () => ({ u: 0.2 + 0.6 * r(), wide: 0.07 + 0.05 * r(), tall: 0.22 + 0.18 * r(), phase: r() * TAU }));
  const seats = Array.from({ length: 3 }, () => ({ u: 0.08 + 0.84 * r(), rad: 0.05 + 0.07 * r() + 0.06, phase: r() * TAU }));
  return { knots, columns, channels, lobes, licks, seats };
}

// ---- painting (any canvas 2D context) ----

export const tileSize = (S = CELL_PX) => ({ w: S, h: Math.ceil((ABOVE + BELOW) * S) });

// One thin rising curl, as the approved drawing's `limb`: two curved flanks that pinch to a drawn-out tip.
function limb(c, fx, fy, w, hgt, lean, sway) {
  const tipX = fx + lean + sway * w * 0.35, tipY = fy - hgt, midY = fy - hgt * 0.52, waist = w * 0.34;
  c.beginPath();
  c.moveTo(fx - w * 0.5, fy);
  c.quadraticCurveTo(fx - waist + lean * 0.3, midY, tipX - w * 0.06, tipY);
  c.quadraticCurveTo(tipX + w * 0.1, tipY + hgt * 0.07, tipX + w * 0.02, tipY + hgt * 0.13);
  c.quadraticCurveTo(fx + waist + lean * 0.3, midY, fx + w * 0.5, fy);
  c.closePath();
}
// A thin lick that has torn free of the top and climbs on its own.
function wisp(c, x, y, w, h, sway) {
  const s = sway * w * 0.8;
  c.beginPath();
  c.moveTo(x - w * 0.3, y);
  c.quadraticCurveTo(x + s * 0.4, y - h * 0.55, x + s, y - h);
  c.quadraticCurveTo(x + s * 0.5 + w * 0.25, y - h * 0.5, x + w * 0.3, y);
  c.closePath();
}

// The squares whose light reaches a tile: its own, and the ring neighbours on any side that is not an end.
function reachOf(variant, kind, k) {
  const left = kind === "left" || kind === "solo", right = kind === "right" || kind === "solo", out = [];
  for (const dk of [-1, 0, 1]) {
    if ((dk < 0 && left) || (dk > 0 && right)) continue;
    out.push({ ox: dk, f: cellFeatures(variant, (((k + dk) % RING) + RING) % RING) });
  }
  return out;
}

// Paint one tile of a front at `theta` (0-1 through the loop) into a context sized tileSize(S). Units are squares: x runs
// 0-1 across the tile, y is 0 at the foot line and negative upward.
export function paintTile(c, { variant, kind, k }, theta, S = CELL_PX) {
  const left = kind === "left" || kind === "solo", right = kind === "right" || kind === "solo";
  const fromEnd = (x) => Math.min(left ? x : Infinity, right ? 1 - x : Infinity);
  const glow = 0.5 + 0.5 * Math.sin(TAU * theta), lift = liftAt(theta);
  const top = (x) => -lift * topAt(k + x, theta, variant, fromEnd(x));
  c.setTransform(S, 0, 0, S, 0, ABOVE * S);
  c.globalAlpha = 1; c.globalCompositeOperation = "source-over";

  const lo = left ? 0.03 : 0, hi = right ? 0.97 : 1;
  const body = () => {
    c.beginPath(); c.moveTo(lo, 0); c.lineTo(lo, top(lo));
    for (let s = 1; s < 28; s++) { const x = s / 28; if (x > lo && x < hi) c.lineTo(x, top(x)); }
    c.lineTo(hi, top(hi)); c.lineTo(hi, 0); c.closePath();
  };
  const gBody = c.createLinearGradient(0, 0, 0, -lift);
  gBody.addColorStop(0, "#ffd982"); gBody.addColorStop(0.2, "#ffb43a"); gBody.addColorStop(0.5, MID); gBody.addColorStop(0.8, DEEP); gBody.addColorStop(1, "#7d1a0400");
  c.globalAlpha = 0.42; c.fillStyle = gBody; body(); c.fill(); // thin on its own: the brightness is built up below

  const own = cellFeatures(variant, k);
  const reach = reachOf(variant, kind, k);

  c.save(); body(); c.clip();
  c.globalCompositeOperation = "lighter"; // heat adds up, it does not stack like paint
  for (const { ox, f } of reach) {
    f.columns.forEach((col, i) => { // currents rising inside the one mass, bunched round the knots
      const K = f.knots[col.knot];
      const u = Math.min(1.06, Math.max(-0.06, K.u + col.spread * 0.26 * (1.3 - K.pull)));
      const near = 1 - Math.min(1, Math.abs(u - K.u) * 5); // nearer the knot: taller and hotter
      const cx = ox + u + Math.sin(TAU * theta + i * 1.7) * 0.025;
      const ch = lift * K.tall * (0.3 + 0.62 * near) * (0.85 + 0.2 * glow) * (0.7 + 0.5 * col.tall);
      const cw = (0.03 + 0.035 * col.wide) * (0.8 + 0.5 * near);
      const gc = c.createLinearGradient(0, 0, 0, -ch);
      // Every current starts at the same foot and added up there they would blow out to white, so each is nearly clear
      // at its base and only gains weight once it has risen.
      gc.addColorStop(0, "rgba(255,214,120,0.04)");
      gc.addColorStop(0.18, `rgba(255,190,90,${(0.16 + 0.2 * near).toFixed(2)})`);
      gc.addColorStop(0.45, "#ff9d2a33"); gc.addColorStop(0.78, "#e8500e1a"); gc.addColorStop(1, "#c6380000");
      c.globalAlpha = 0.9; c.fillStyle = gc;
      limb(c, cx, 0, cw * 2.4, ch, Math.sin(TAU * theta + i) * 0.02, Math.sin(TAU * theta + col.phase + cx * 4));
      c.fill();
    });
  }
  c.globalCompositeOperation = "destination-out"; // the cooler channels: taken out of the mass, so they darken without an edge
  for (const { ox, f } of reach) {
    for (const ch of f.channels) {
      const cx = ox + ch.u, h = lift * ch.tall;
      const gd = c.createLinearGradient(0, -h * 0.2, 0, -h);
      gd.addColorStop(0, "#0000"); gd.addColorStop(0.5, "#00000055"); gd.addColorStop(1, "#0000");
      c.fillStyle = gd; c.fillRect(cx - 0.035, -h, 0.07, h);
    }
  }
  c.globalCompositeOperation = "lighter";
  for (const { ox, f } of reach) {
    for (const lb of f.lobes) { // soft lobes boiling inside the mass
      const px = ox + lb.u + wave(theta, lb.turns, lb.phase) * 0.1;
      const py = -lift * lb.y - ((theta * 2) % 1) * 0.4;
      const gl = c.createRadialGradient(px, py, 0.01, px, py, lb.rad);
      gl.addColorStop(0, "#ffd87e66"); gl.addColorStop(1, "#ff6a0000");
      c.globalAlpha = 0.5; c.fillStyle = gl; c.beginPath(); c.arc(px, py, lb.rad, 0, TAU); c.fill();
    }
  }
  for (const { ox } of reach) { // the white heart is small and low: a hot seat at the base, never a glowing dome
    const gHeart = c.createLinearGradient(0, 0, 0, -lift * 0.26);
    gHeart.addColorStop(0, "#ffe9a566"); gHeart.addColorStop(1, "#ffb43300");
    c.globalAlpha = 0.26; c.fillStyle = gHeart;
    c.beginPath(); c.ellipse(ox + 0.5, 0, 0.4, lift * 0.2, 0, Math.PI, 0); c.fill();
  }
  c.restore();
  c.globalCompositeOperation = "source-over";

  own.licks.forEach((lk, i) => { // only the top frays into separate licks (kept clear of the ends and the seams, so they are this tile's own)
    const bx = lk.u, by = -lift * topAt(k + lk.u, theta, variant) + 0.03;
    const gw = c.createLinearGradient(0, by, 0, by - 0.34);
    gw.addColorStop(0, "#ff9a2199"); gw.addColorStop(0.6, "#e2500c55"); gw.addColorStop(1, "#c6380000");
    c.globalAlpha = 0.55; c.fillStyle = gw;
    wisp(c, bx, by, lk.wide, lk.tall, Math.sin(TAU * theta + lk.phase + i));
    c.fill();
  });

  // Dissolve the foot: fire has no bottom edge. The erase line wanders, so the foot does not end on a level line either.
  c.globalAlpha = 1; c.globalCompositeOperation = "destination-out";
  const COLS = 48; // thin side-by-side columns, each as high as the wandering line is there: neighbours differ little, so no comb
  for (let s = 0; s < COLS; s++) {
    const u0 = s / COLS, xm = k + u0 + 0.5 / COLS;
    const t = -footAt(xm, variant) - Math.sin(TAU * (1.5 * xm + theta)) * 0.05;
    const g = c.createLinearGradient(0, 0.12, 0, t);
    g.addColorStop(0, "#000f"); g.addColorStop(0.6, "#0008"); g.addColorStop(1, "#0000");
    c.fillStyle = g; c.fillRect(u0, t, 1 / COLS + 0.004, 0.12 - t);
  }
  c.globalCompositeOperation = "source-over"; c.globalAlpha = 1;
}

// The heat put back at the foot as light, in uneven seats under the knots, not one even band. It is added to what is under
// it (the ground) rather than laid over it, so it is its own picture, drawn with additive blending. Units are squares, y 0
// at the foot line, x 0-1 across the tile.
export const SEAT_UP = 0.25, SEAT_DOWN = 0.25;
export const seatSize = (S = CELL_PX) => ({ w: S, h: Math.ceil((SEAT_UP + SEAT_DOWN) * S), ay: SEAT_UP * S });
export function paintSeats(c, { variant, kind, k }, theta, S = CELL_PX) {
  c.setTransform(S, 0, 0, S, 0, SEAT_UP * S);
  c.globalCompositeOperation = "source-over";
  for (const { ox, f } of reachOf(variant, kind, k)) {
    f.seats.forEach((st, i) => {
      const sx = ox + st.u, sy = -0.02 + Math.sin(TAU * theta + i) * 0.01;
      const gS = c.createRadialGradient(sx, sy, 0.01, sx, sy, st.rad);
      gS.addColorStop(0, `rgba(255,150,54,${(0.13 + 0.1 * Math.sin(TAU * theta + st.phase) ** 2).toFixed(2)})`);
      gS.addColorStop(1, "#ff8a1a00");
      c.globalAlpha = 1; c.fillStyle = gS; c.beginPath(); c.arc(sx, sy, st.rad, 0, TAU); c.fill();
    });
  }
}

// The dark under and over a burning square: the scorch it lies on (paintScorch), the glow it throws on the ground, and the
// smoke that climbs off it. Units are squares with 0,0 at the square's top-left corner; the picture reaches past it on every side.
// The scorch the fire lies on never moves, so it is one picture with no frames (cross-fading a still, dark picture would make
// it pulse).
export function paintScorch(c, S = CELL_PX) {
  c.setTransform(S, 0, 0, S, G_LEFT * S, G_UP * S);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 0.72; c.fillStyle = SOOT;
  c.beginPath(); c.ellipse(0.5, 0.78, 0.46, 0.22, 0, 0, TAU); c.fill();
  c.globalAlpha = 0.3;
  c.beginPath(); c.ellipse(0.5, 0.74, 0.62, 0.3, 0, 0, TAU); c.fill();
  c.globalAlpha = 1;
}
export function paintGround(c, variant, theta, S = CELL_PX) {
  const glow = 0.5 + 0.5 * Math.sin(TAU * theta);
  c.setTransform(S, 0, 0, S, G_LEFT * S, G_UP * S);
  c.globalCompositeOperation = "source-over";
  c.globalAlpha = 0.5 + 0.3 * glow;
  const halo = c.createRadialGradient(0.5, 0.6, 0.02, 0.5, 0.6, 0.95);
  halo.addColorStop(0, "#ff9a2155"); halo.addColorStop(1, "#ff9a2100");
  c.fillStyle = halo; c.beginPath(); c.arc(0.5, 0.6, 0.95, 0, TAU); c.fill();
  const r2 = rng(variant, 0x5a0c);
  for (let i = 0; i < 7; i++) {
    const t = (theta + i / 7) % 1;
    c.globalAlpha = 0.34 * (1 - t);
    c.fillStyle = i % 2 ? "#2b241c" : "#3a3028";
    const sx = 0.3 + 0.4 * r2() + Math.sin(t * 5 + i) * 0.16, sy = 0.5 - t * 1.5, rad = 0.16 + 0.3 * t;
    c.beginPath(); c.ellipse(sx, sy, rad, rad * 0.78, 0, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
}

// ---- baking: canvases, then textures ----

const defaultCanvas = () => (typeof document === "undefined" ? null : (w, h) => { const cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; });

// All FRAMES pictures of one tile family, as canvases.
export function bakeTile(makeCanvas, spec, S = CELL_PX) {
  const { w, h } = tileSize(S);
  return Array.from({ length: FRAMES }, (_, f) => { const cv = makeCanvas(w, h), c = cv.getContext("2d"); paintTile(c, spec, f / FRAMES, S); return cv; });
}
export function bakeSeats(makeCanvas, spec, S = CELL_PX) {
  const { w, h } = seatSize(S);
  return Array.from({ length: FRAMES }, (_, f) => { const cv = makeCanvas(w, h), c = cv.getContext("2d"); paintSeats(c, spec, f / FRAMES, S); return cv; });
}
export function bakeGround(makeCanvas, variant, S = CELL_PX) {
  const w = Math.ceil((1 + G_LEFT + G_RIGHT) * S), h = Math.ceil((G_UP + G_DOWN) * S);
  return Array.from({ length: FRAMES }, (_, f) => { const cv = makeCanvas(w, h), c = cv.getContext("2d"); paintGround(c, variant, f / FRAMES, S); return cv; });
}
export const groundPx = (S = CELL_PX) => ({ w: Math.ceil((1 + G_LEFT + G_RIGHT) * S), h: Math.ceil((G_UP + G_DOWN) * S), ax: G_LEFT * S, ay: G_UP * S });

// How many tile families (each: 8 flame frames and 8 foot-light frames) the bank keeps baked at once. A family is
// 8 x 55,808 + 8 x 8,192 = 512,000 bytes of texture, so 24 of them are 12.3 MB; the 3 ground variants (8 x 90,112 each) and
// the one scorch add 2.3 MB: about 14.6 MB all told, under the 16 MB asked for. Families that sprites are using are never
// evicted, so a scene with more distinct families on screen than this is the only way past it.
export const FAMILY_CAP = 24;
export const familyKey = (spec) => `${spec.variant}:${spec.kind}:${spec.k}`;

// The textures, baked on first use and kept while anything draws with them, then least-recently-used first out. Never
// baked per tick or per front.
export function createFlameBank({ PIXI, makeCanvas = defaultCanvas(), S = CELL_PX, cap = FAMILY_CAP }) {
  if (!makeCanvas || typeof PIXI?.Texture?.from !== "function") return null;
  const families = new Map(), grounds = new Map();
  let scorch = null, held = new Set(), bakes = 0, gone = false;
  const upload = (cvs) => cvs.map((cv) => PIXI.Texture.from(cv));
  const tw = tileSize(S), gp = groundPx(S), sw = seatSize(S);
  const free = (cvs, tex) => {
    for (const t of tex) { try { t.destroy(true); } catch { /* gone */ } }
    for (const cv of cvs) { try { cv.width = 0; cv.height = 0; } catch { /* a canvas that cannot shrink */ } }
  };
  const evict = () => {
    for (const [key, fam] of families) {
      if (families.size <= cap) break;
      if (held.has(key)) continue;
      free(fam.cvs, [...fam.tex, ...fam.light]);
      families.delete(key);
    }
  };
  const family = (spec) => {
    const key = familyKey(spec);
    let fam = families.get(key);
    if (fam) { families.delete(key); families.set(key, fam); return fam; } // most recently used goes last
    if (gone) return { tex: [], light: [] };
    const tcv = bakeTile(makeCanvas, spec, S), lcv = bakeSeats(makeCanvas, spec, S);
    fam = { tex: upload(tcv), light: upload(lcv), cvs: [...tcv, ...lcv] };
    families.set(key, fam); bakes++;
    evict();
    return fam;
  };
  return {
    S,
    cap,
    // The flame and foot-light textures of one tile family: {variant, kind, k}.
    family,
    tile: (spec) => family(spec).tex,
    seats: (spec) => family(spec).light,
    // The families a layout is using: these are not evicted until the next call replaces them.
    hold(specs) { held = new Set(specs.map(familyKey)); evict(); },
    ground(variant) {
      if (!grounds.has(variant) && !gone) { const cv = bakeGround(makeCanvas, variant, S); grounds.set(variant, { tex: upload(cv), cvs: cv }); bakes++; }
      return grounds.get(variant)?.tex ?? [];
    },
    // The one still scorch picture, shared by every burning square.
    scorch() {
      if (!scorch && !gone) { const cv = makeCanvas(gp.w, gp.h); paintScorch(cv.getContext("2d"), S); scorch = { tex: upload([cv]), cvs: [cv] }; bakes++; }
      return scorch?.tex[0] ?? null;
    },
    stats() {
      const f = families.size * FRAMES, g = grounds.size * FRAMES + (scorch ? 1 : 0);
      return { families: families.size, grounds: grounds.size, textures: f * 2 + g, bakes, bytes: (f * tw.w * tw.h + f * sw.w * sw.h + g * gp.w * gp.h) * 4 };
    },
    destroy() {
      gone = true;
      for (const fam of families.values()) free(fam.cvs, [...fam.tex, ...fam.light]);
      for (const g of grounds.values()) free(g.cvs, g.tex);
      if (scorch) free(scorch.cvs, scorch.tex);
      families.clear(); grounds.clear(); scorch = null;
    },
  };
}

// One bank for the whole module, shared by whatever draws fire and let go of when the last of them lets go.
let shared = null, holders = 0;
export function acquireFlameBank(PIXI, makeCanvas) {
  if (shared && shared.PIXI !== PIXI) { shared.bank.destroy(); shared = null; holders = 0; }
  if (!shared) {
    const bank = createFlameBank({ PIXI, makeCanvas });
    if (!bank) return null;
    shared = { PIXI, bank };
  }
  holders++;
  return shared.bank;
}
export function releaseFlameBank() {
  holders = Math.max(0, holders - 1);
  if (!holders && shared) { shared.bank.destroy(); shared = null; }
}
