// Token fragments: the real token's artwork cut into pieces that fly apart (halves, top/bottom,
// shards, dust, cross, claw, diced, starburst, rings, pixelate, ribbons). Pure geometry in the
// token's unit square (-0.5..0.5); every client derives the same pieces and flights from the shared seed.
import { samplePath, normalizeKeyframes } from "../motion/keyframe-path.mjs";

export const FRAGMENT_PATTERNS = {
  halves: "Slice in half", topBottom: "Top / bottom", shards: "Shards", dust: "Dust",
  cross: "Cross cut", claw: "Claw marks", diced: "Diced", starburst: "Starburst", rings: "Rings", pixelate: "Pixelate", ribbons: "Ribbons",
  perforate: "Perforate", slashes: "Slashes", crush: "Crush", lightning: "Lightning",
};
// [lo, hi, default] for the stored `pieces`. Diced counts per side (4 is 4x4); rings counts rings of 8 segments.
export const FRAGMENT_COUNTS = {
  halves: [2, 2, 2], topBottom: [2, 2, 2], shards: [4, 10, 7], dust: [16, 64, 48],
  cross: [4, 4, 4], claw: [4, 4, 4], diced: [2, 6, 4], starburst: [6, 16, 10], rings: [2, 4, 3], pixelate: [16, 64, 36], ribbons: [6, 16, 10],
  perforate: [3, 6, 4], slashes: [2, 4, 3], crush: [2, 4, 3], lightning: [2, 2, 2],
};
export const FRAGMENT_BEHAVIORS = {
  burst: "Burst apart", implode: "Implode", absorb: "Drawn to the attacker", rise: "Rise away", bounce: "Fall and bounce", drip: "Melt down", crumble: "Crumble to a heap",
  flatten: "Crushed flat", shudder: "Shudder apart", glitch: "Glitch out", sink: "Sink and fade",
};
export const FRAGMENT_TINTS = { none: "None", frozen: "Frozen", charred: "Charred", stone: "Stone", ghost: "Ghostly", burning: "Burning", electric: "Electric", acid: "Acid", poison: "Poison" };
// How a tint draws: a PIXI tint on the table (stone adds one shared greyscale filter), a CSS filter
// in the studio, and an alpha factor for both.
export const FRAGMENT_TINT_LOOKS = {
  none: { alpha: 1 },
  frozen: { tint: 0xa8d8ff, alpha: 0.9, css: "saturate(.6) hue-rotate(170deg) brightness(1.1)" },
  charred: { tint: 0x3a2a22, alpha: 1, css: "brightness(.35) sepia(.4)" },
  stone: { tint: 0xb0aca4, alpha: 1, greyscale: 0.55, css: "grayscale(.85) brightness(.9)" },
  ghost: { tint: 0xd8f0ff, alpha: 0.5, css: "brightness(1.3) saturate(.3)" },
  // The table renderer has no glow layer, so burning is a tint only.
  burning: { tint: 0xff9a4a, alpha: 1, css: "sepia(.6) saturate(2.2) hue-rotate(-10deg) brightness(1.15)" },
  electric: { tint: 0xbfe6ff, alpha: 0.95, css: "saturate(.4) brightness(1.35) hue-rotate(180deg)" },
  acid: { tint: 0xa6e05a, alpha: 1, css: "sepia(.5) saturate(2) hue-rotate(40deg)" },
  poison: { tint: 0x9ac885, alpha: 0.9, css: "sepia(.4) saturate(1.6) hue-rotate(50deg) brightness(.9)" },
};
const clamp = (v, min, max, fallback) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Math.min(max, Math.max(min, Number(v))) : fallback);
const TOWARDS_LIMIT = 40;

export function normalizeFragments(s = {}) {
  const pattern = Object.hasOwn(FRAGMENT_PATTERNS, s.pattern) ? s.pattern : "halves", [lo, hi, def] = FRAGMENT_COUNTS[pattern];
  const seed = Number(s.seed), cutAngle = s.cutAngle === null || s.cutAngle === "" ? NaN : Number(s.cutAngle);
  const behavior = Object.hasOwn(FRAGMENT_BEHAVIORS, s.behavior) ? s.behavior : "burst", tint = Object.hasOwn(FRAGMENT_TINTS, s.tint) ? s.tint : "none";
  const tx = s.towards?.x, ty = s.towards?.y, limit = (v) => Math.min(TOWARDS_LIMIT, Math.max(-TOWARDS_LIMIT, v));
  return {
    pattern, cut: s.cut === "fixed" ? "fixed" : "attack", angle: clamp(s.angle, 0, 180, 0),
    pieces: Math.round(clamp(s.pieces, lo, hi, def)), spread: clamp(s.spread, 0, 3, 0.6), spin: clamp(s.spin, 0, 720, 30),
    fall: clamp(s.fall, 0, 1, 0.3), drift: clamp(s.drift, 0, 1, 0), fade: clamp(s.fade, 100, 3000, 600),
    ...(Number.isInteger(seed) && seed >= 0 ? { seed } : {}),
    // The sender's cut angle (radians, on screen), so every client cuts the same way.
    ...(Number.isFinite(cutAngle) ? { cutAngle: Math.atan2(Math.sin(cutAngle), Math.cos(cutAngle)) } : {}),
    // Burst and no tint stay unstored, so stages saved before them read back unchanged.
    ...(behavior !== "burst" ? { behavior } : {}),
    ...(tint !== "none" ? { tint } : {}),
    // The sender's attacker centre less the target's, in screen squares: where "absorb" flies.
    ...(Number.isFinite(tx) && Number.isFinite(ty) ? { towards: { x: limit(tx), y: limit(ty) } } : {}),
  };
}
// A stage normalized once (per renderer start); the geometry below takes it as is. Behaviour, tint
// and towards are always set, so junk the raw stage carries under those keys (the generic effect
// colour `tint: "#ffffff"`, say) never survives the spread.
const PREPARED = new WeakSet();
export function prepareFragments(stage) {
  if (stage && PREPARED.has(stage)) return stage;
  const n = normalizeFragments(stage);
  const s = { ...stage, ...n, behavior: n.behavior ?? "burst", tint: n.tint ?? "none", towards: n.towards };
  PREPARED.add(s);
  return s;
}

// How many pieces a stage cuts (absorb staggers by it; pixelate orders by it).
export function fragmentCount(stage) {
  const s = prepareFragments(stage);
  switch (s.pattern) {
    case "halves": case "topBottom": return 2;
    case "cross": case "claw": return 4;
    case "diced": return s.pieces * s.pieces;
    case "rings": return s.pieces * 8;
    case "slashes": return s.pieces + 1;
    case "crush": return s.pieces * CRUSH_WEDGES;
    case "lightning": return BOLT_SEGMENTS * 2;
    // Each puncture's cell splits into a seeded 2 or 3 wedges: count them.
    case "perforate": return fragmentPieces(s, 0).length;
    case "dust": case "pixelate": { const cols = Math.ceil(Math.sqrt(s.pieces)); return cols * Math.round(s.pieces / cols); }
    default: return s.pieces;
  }
}

// mulberry32: tiny, fast and identical on every client.
export function seededRandom(seed) {
  let a = (seed >>> 0) || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const polygonArea = (pts) => Math.abs(pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0)) / 2;
export function pointInPolygon(p, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
const centroidOf = (pts) => {
  let a = 0, x = 0, y = 0;
  pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length], c = p.x * q.y - q.x * p.y; a += c; x += (p.x + q.x) * c; y += (p.y + q.y) * c; });
  return a ? { x: x / (3 * a), y: y / (3 * a) } : { x: 0, y: 0 };
};
const SQUARE = [{ x: -0.5, y: -0.5 }, { x: 0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, { x: -0.5, y: 0.5 }];
// Sutherland–Hodgman: keep the part of a convex polygon where n·p >= d.
function clip(pts, n, d) {
  const out = [], side = (p) => n.x * p.x + n.y * p.y - d;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length], sp = side(p), sq = side(q);
    if (sp >= 0) out.push(p);
    if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); out.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
  });
  return out;
}
const piece = (polygon) => ({ polygon, centroid: centroidOf(polygon) });
const normal = (a) => ({ x: -Math.sin(a), y: Math.cos(a) });
const flip = (n) => ({ x: -n.x, y: -n.y });
// A wedge from angle t0 to t1 (under a half-turn) around c: two half-plane clips cut it exactly.
function wedge(t0, t1, c = { x: 0, y: 0 }) {
  const n0 = { x: -Math.sin(t0), y: Math.cos(t0) }, n1 = { x: Math.sin(t1), y: -Math.cos(t1) };
  return clip(clip(SQUARE, n0, n0.x * c.x + n0.y * c.y), n1, n1.x * c.x + n1.y * c.y);
}
// The part of a convex polygon where lo <= n·p <= hi; an infinite bound is not cut.
function band(pts, n, lo, hi) {
  let out = pts;
  if (lo > -Infinity) out = clip(out, n, lo);
  if (hi < Infinity) out = clip(out, flip(n), -hi);
  return out;
}
// A cols x rows grid of rects (dust, diced, pixelate), row by row; `ordered` numbers the cells.
function gridPieces(cols, rows, ordered = false) {
  const w = 1 / cols, h = 1 / rows, out = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = -0.5 + c * w, y = -0.5 + r * h;
    out.push({ ...piece([{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }]), rect: { x, y, w, h }, ...(ordered ? { order: r * cols + c } : {}) });
  }
  return out;
}

// A wedge from t0 to t1 (under a half-turn) around c, cut from any convex polygon.
function wedgeOf(poly, t0, t1, c) {
  const n0 = { x: -Math.sin(t0), y: Math.cos(t0) }, n1 = { x: Math.sin(t1), y: -Math.cos(t1) };
  return clip(clip(poly, n0, n0.x * c.x + n0.y * c.y), n1, n1.x * c.x + n1.y * c.y);
}
// An angle that is not a number (no attack known) cuts as if along +x.
const finite = (a) => (Number.isFinite(a) ? a : 0);

// Perforate: punctures along the attack line, -0.3..0.3 with a little jitter, each owning its
// Voronoi cell (the square clipped by the perpendicular bisectors), split into 2-3 wedges around it.
// Three punctures always take three wedges each, so there are 8-18 pieces.
function perforatePieces(s, a, rand) {
  const d = { x: Math.cos(a), y: Math.sin(a) }, across = { x: -d.y, y: d.x }, k = s.pieces;
  const gap = k > 1 ? 0.6 / (k - 1) : 0, slide = Math.min(0.08, gap * 0.3);
  const holes = Array.from({ length: k }, (_, i) => {
    const t = (k > 1 ? -0.3 + i * gap : 0) + (rand() * 2 - 1) * slide, off = (rand() * 2 - 1) * 0.08;
    return { x: d.x * t + across.x * off, y: d.y * t + across.y * off };
  });
  const out = [];
  holes.forEach((h, i) => {
    let cell = SQUARE;
    holes.forEach((o, j) => { if (j !== i) cell = clip(cell, { x: h.x - o.x, y: h.y - o.y }, (h.x * h.x + h.y * h.y - o.x * o.x - o.y * o.y) / 2); });
    const m = k === 3 ? 3 : rand() < 0.5 ? 2 : 3, base = rand() * Math.PI * 2, step = (Math.PI * 2) / m;
    for (let w = 0; w < m; w++) out.push({ ...piece(wedgeOf(cell, base + w * step, base + (w + 1) * step, h)), cell: i, puncture: { x: h.x, y: h.y } });
  });
  return out;
}
// Slashes: parallel cuts along the swing, all tilted by one seeded angle (up to 8 degrees) so they
// never cross, offsets spread evenly with a little jitter: pieces + 1 strips.
const SLASH_TILT = (8 * Math.PI) / 180;
function slashPieces(s, a, rand) {
  const n = normal(a + (rand() * 2 - 1) * SLASH_TILT), e = (Math.abs(n.x) + Math.abs(n.y)) / 2, gap = (2 * e) / (s.pieces + 1);
  const cuts = Array.from({ length: s.pieces }, (_, i) => -e + (i + 1) * gap + (rand() * 2 - 1) * Math.min(0.06, gap * 0.3));
  const bounds = [-Infinity, ...cuts, Infinity];
  return bounds.slice(0, -1).map((lo, i) => ({ ...piece(band(SQUARE, n, lo, bounds[i + 1])), strip: i }));
}
// Crush: a spiderweb around the impact, 0.25 toward the attacker: 7 wedges, each banded into rings
// by lines square to its bisector (as rings does). Ring k starts 0.22k/(N-1) out; the square
// reaches at least 0.25 all round the impact, so no cell is ever empty.
const CRUSH_WEDGES = 7;
function crushPieces(s, a, rand) {
  const c = { x: -Math.cos(a) * 0.25, y: -Math.sin(a) * 0.25 }, base = rand() * Math.PI * 2, step = (Math.PI * 2) / CRUSH_WEDGES, out = [];
  const radius = (k) => (0.22 * k) / Math.max(1, s.pieces - 1);
  for (let k = 0; k < s.pieces; k++) for (let j = 0; j < CRUSH_WEDGES; j++) {
    const t0 = base + j * step, mid = t0 + step / 2, b = { x: Math.cos(mid), y: Math.sin(mid) }, at = b.x * c.x + b.y * c.y;
    out.push({ ...piece(band(wedge(t0, t0 + step, c), b, k ? at + radius(k) : -Infinity, k < s.pieces - 1 ? at + radius(k + 1) : Infinity)), ring: k });
  }
  return out;
}
// Lightning: a zig-zag of 5 segments along the attack, kinked up to 0.12 either side. Each segment's
// slab is cut by its own straight piece of the bolt, so both halves are convex parts; group 1 is the
// side the bolt's normal points to, and each group moves as one.
const BOLT_SEGMENTS = 5;
function lightningPieces(a, rand) {
  const u = { x: Math.cos(a), y: Math.sin(a) }, v = { x: -u.y, y: u.x }, e = (Math.abs(u.x) + Math.abs(u.y)) / 2;
  const kinks = Array.from({ length: BOLT_SEGMENTS + 1 }, (_, j) => {
    const along = -e + (2 * e * j) / BOLT_SEGMENTS, off = j === 0 || j === BOLT_SEGMENTS ? 0 : (rand() * 2 - 1) * 0.12;
    return { along, x: u.x * along + v.x * off, y: u.y * along + v.y * off };
  });
  const out = [];
  for (let j = 0; j < BOLT_SEGMENTS; j++) {
    const p = kinks[j], q = kinks[j + 1], slab = band(SQUARE, u, j ? p.along : -Infinity, j < BOLT_SEGMENTS - 1 ? q.along : Infinity);
    const n = { x: -(q.y - p.y), y: q.x - p.x }, d = n.x * p.x + n.y * p.y;
    out.push({ ...piece(clip(slab, flip(n), -d)), group: 0, bolt: j }, { ...piece(clip(slab, n, d)), group: 1, bolt: j });
  }
  return out;
}

// The cut angle is on screen; `turn` is the token art's rotation, so pieces are cut in the art's
// own frame at the screen angle minus the turn (top/bottom stays level on screen).
const screenCut = (s, cutAngle) => (s.pattern === "topBottom" ? 0 : s.cut === "fixed" ? (s.angle * Math.PI) / 180 : cutAngle);
export function fragmentPieces(stage, cutAngle, turn = 0) {
  const s = prepareFragments(stage), rand = seededRandom(s.seed ?? 1);
  if (s.pattern === "halves" || s.pattern === "topBottom") {
    const a = screenCut(s, cutAngle) - turn;
    const n = { x: -Math.sin(a), y: Math.cos(a) };
    return [piece(clip(SQUARE, { x: -n.x, y: -n.y }, 0)), piece(clip(SQUARE, n, 0))];
  }
  if (s.pattern === "dust" || s.pattern === "pixelate") {
    const cols = Math.ceil(Math.sqrt(s.pieces));
    return gridPieces(cols, Math.round(s.pieces / cols), s.pattern === "pixelate");
  }
  if (s.pattern === "diced") return gridPieces(s.pieces, s.pieces);
  if (s.pattern === "cross") {
    // Two perpendicular cuts through the centre at the swing +-45 degrees: one wedge faces the swing.
    const a = screenCut(s, cutAngle) - turn, n1 = normal(a + Math.PI / 4), n2 = normal(a - Math.PI / 4);
    return [[n1, n2], [n1, flip(n2)], [flip(n1), flip(n2)], [flip(n1), n2]].map(([u, v]) => piece(clip(clip(SQUARE, u, 0), v, 0)));
  }
  if (s.pattern === "claw") {
    // Three parallel rakes along the swing tilted 30 degrees, a quarter apart: four strips.
    const n = normal(screenCut(s, cutAngle) + Math.PI / 6 - turn), cuts = [-Infinity, -0.25, 0, 0.25, Infinity];
    return cuts.slice(0, 4).map((lo, i) => piece(band(SQUARE, n, lo, cuts[i + 1])));
  }
  if (s.pattern === "starburst") {
    // Even wedges around the exact centre, no jitter; only the base angle is seeded.
    const base = rand() * Math.PI * 2, step = (Math.PI * 2) / s.pieces;
    return Array.from({ length: s.pieces }, (_, i) => piece(wedge(base + i * step, base + (i + 1) * step)));
  }
  if (s.pattern === "rings") {
    // Eight 45-degree wedges, each banded by straight lines square to its bisector at k/N of the
    // half-diagonal: each segment stays convex, neighbours share edges exactly, the last ring takes the corners.
    const step = Math.SQRT1_2 / s.pieces, out = [];
    for (let k = 0; k < s.pieces; k++) for (let j = 0; j < 8; j++) {
      const t0 = (j * Math.PI) / 4, mid = t0 + Math.PI / 8, b = { x: Math.cos(mid), y: Math.sin(mid) };
      const poly = band(wedge(t0, t0 + Math.PI / 4), b, k ? k * step : -Infinity, k < s.pieces - 1 ? (k + 1) * step : Infinity);
      if (poly.length >= 3 && polygonArea(poly) > 1e-9) out.push({ ...piece(poly), ring: k });
    }
    return out;
  }
  if (s.pattern === "ribbons") {
    // Screen x in the art's own frame: the strips stay upright on screen however the token is turned.
    const u = { x: Math.cos(turn), y: -Math.sin(turn) }, e = (Math.abs(u.x) + Math.abs(u.y)) / 2, w = (2 * e) / s.pieces;
    return Array.from({ length: s.pieces }, (_, i) => piece(band(SQUARE, u, i ? -e + i * w : -Infinity, i < s.pieces - 1 ? -e + (i + 1) * w : Infinity)));
  }
  if (s.pattern === "perforate") return perforatePieces(s, finite(screenCut(s, cutAngle) - turn), rand);
  if (s.pattern === "slashes") return slashPieces(s, finite(screenCut(s, cutAngle) - turn), rand);
  if (s.pattern === "crush") return crushPieces(s, finite(screenCut(s, cutAngle) - turn), rand);
  if (s.pattern === "lightning") return lightningPieces(finite(screenCut(s, cutAngle) - turn), rand);
  // Shards: wedges around a jittered centre; each wedge stays under a half-turn so two
  // half-plane clips cut it exactly.
  const c = { x: (rand() - 0.5) * 0.3, y: (rand() - 0.5) * 0.3 }, base = rand() * Math.PI * 2, step = (Math.PI * 2) / s.pieces;
  const angles = Array.from({ length: s.pieces }, (_, i) => base + i * step + (rand() - 0.5) * step * 0.4);
  return angles.map((t0, i) => piece(wedge(t0, i === angles.length - 1 ? angles[0] + Math.PI * 2 : angles[i + 1], c)));
}

// Each piece's own flight, in screen squares relative to where it started: the piece's centroid
// is turned onto the screen first, so falls go down and wind blows away on screen. `size` is the
// art's size in squares: only the flights that aim at a point (implode, absorb) need it.
export function fragmentFlight(stage, p, index, cutAngle, turn = 0, size = { w: 1, h: 1 }) {
  const s = prepareFragments(stage), rand = seededRandom(((s.seed ?? 1) + index * 7919) >>> 0);
  const c = { x: Math.cos(turn) * p.centroid.x - Math.sin(turn) * p.centroid.y, y: Math.sin(turn) * p.centroid.x + Math.cos(turn) * p.centroid.y };
  const len = Math.hypot(c.x, c.y) || 1, out = { x: c.x / len, y: c.y / len };
  if (s.behavior !== "burst") return behaviorFlight(s, p, index, cutAngle, turn, size, c, out, rand);
  if (s.pattern === "dust") {
    const wind = { x: Math.cos(cutAngle), y: Math.sin(cutAngle) }, lead = 0.5 - (c.x * wind.x + c.y * wind.y);
    const start = Math.min(0.4, Math.max(0, lead * 0.4)), end = Math.min(1, start + 0.6), reach = s.spread * (0.5 + rand() * 0.5);
    const dx = out.x * reach * 0.4 + wind.x * (reach * 0.6 + s.drift), dy = out.y * reach * 0.4 + wind.y * (reach * 0.6 + s.drift) - 0.2;
    return { start, end, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: end, x: dx, y: dy, rotation: s.spin * (rand() * 2 - 1), ease: "easeOutQuad" }, { at: 1, x: dx, y: dy, rotation: s.spin * (rand() * 2 - 1), ease: "easeInOutQuad" }]) };
  }
  if (s.pattern === "perforate") {
    // The exit wound: out in a cone of +-35 degrees along the attack; the far side goes first.
    const a = finite(screenCut(s, cutAngle)), along = c.x * Math.cos(a) + c.y * Math.sin(a), start = Math.min(0.35, Math.max(0, (0.5 - along) * 0.3));
    const dir = a + (rand() * 2 - 1) * ((35 * Math.PI) / 180), dist = s.spread * (0.9 + rand() * 0.6);
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: Math.cos(dir) * dist, y: Math.sin(dir) * dist, rotation: s.spin * (rand() * 2 - 1), ease: "easeOutCubic" }]) };
  }
  if (s.pattern === "slashes") {
    // Strips slide along the cut, alternating sides; the higher a strip, the farther it slides and topples.
    const a = finite(screenCut(s, cutAngle)), strip = p.strip ?? index, side = strip % 2 ? 1 : -1, high = Math.min(1, Math.max(0, 0.5 - c.y));
    const slide = side * s.spread * (0.3 + 0.7 * high), start = Math.min(0.3, strip * 0.06);
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: Math.cos(a) * slide, y: Math.sin(a) * slide + s.fall * 0.3, rotation: side * s.spin * (0.3 + high), ease: "easeOutQuad" }]) };
  }
  if (s.pattern === "crush") {
    // The inner ring stays and sinks; the outer rings scatter low, the outermost last.
    const ring = p.ring ?? 0;
    if (!ring) return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: 0, y: 0.15 + s.fall * 0.2, scale: 0.85, ease: "easeInQuad" }]) };
    const dist = s.spread * (0.4 + 0.3 * ring) * (0.8 + rand() * 0.4), start = (0.1 * ring) / Math.max(1, s.pieces - 1);
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: out.x * dist, y: Math.abs(out.y) * dist * 0.3 + 0.2 + s.fall * 0.3, rotation: s.spin * (rand() * 2 - 1), ease: "easeOutCubic" }]) };
  }
  if (s.pattern === "lightning") {
    // Each half jerks apart along the bolt's normal with two quick kinks, then settles; a half moves as one.
    const a = finite(screenCut(s, cutAngle)), n = { x: -Math.sin(a), y: Math.cos(a) }, d = { x: Math.cos(a), y: Math.sin(a) }, push = (p.group ? 1 : -1) * s.spread * 0.5;
    const jerk = (u, k) => ({ x: n.x * push * u + d.x * k, y: n.y * push * u + d.y * k });
    return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.1, ...jerk(0.35, 0.06), sharp: true }, { at: 0.2, ...jerk(0.55, -0.06), sharp: true },
      { at: 0.3, ...jerk(0.8, 0.04), sharp: true }, { at: 1, ...jerk(1, 0), ease: "easeOutQuad" }]) };
  }
  if (s.pattern === "shards") {
    const dist = s.spread * (0.7 + rand() * 0.6);
    return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: out.x * dist, y: out.y * dist + s.fall * 0.3, rotation: s.spin * (rand() * 2 - 1), ease: "easeOutCubic" }]) };
  }
  if (s.pattern === "cross") {
    // Each wedge flies out along its centroid, tipping outward.
    const dist = s.spread * (0.8 + rand() * 0.4);
    return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: out.x * dist, y: out.y * dist + s.fall * 0.3, rotation: Math.sign(out.x || 1) * s.spin, ease: "easeOutCubic" }]) };
  }
  if (s.pattern === "claw") {
    // Strips slide apart along the rake normal, one after another; the outer ones go further.
    const a = screenCut(s, cutAngle) + Math.PI / 6, n = { x: -Math.sin(a), y: Math.cos(a) }, off = c.x * n.x + c.y * n.y, side = Math.sign(off || 1);
    const push = side * s.spread * (0.3 + Math.abs(off) * 1.6), start = Math.min(0.3, index * 0.08);
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: n.x * push, y: n.y * push + s.fall * 0.3, rotation: side * s.spin * 0.5, ease: "easeOutQuad" }]) };
  }
  if (s.pattern === "diced") {
    // Cubes hop out a little, then drop by `fall`, tumbling.
    const dist = s.spread * 0.5 * (0.6 + rand() * 0.8), roll = rand() * 2 - 1;
    return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.35, x: out.x * dist, y: out.y * dist - 0.15, rotation: s.spin * roll * 0.4, ease: "easeOutQuad" }, { at: 1, x: out.x * dist * 1.2, y: out.y * dist + s.fall, rotation: s.spin * roll, ease: "easeInQuad" }]) };
  }
  if (s.pattern === "starburst") {
    // A fast radial burst out to spread x 1.2, then held while it fades.
    const dist = s.spread * 1.2 * (0.9 + rand() * 0.2), x = out.x * dist, y = out.y * dist, rotation = s.spin * (rand() * 2 - 1);
    return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.6, x, y, rotation, ease: "easeOutCubic" }, { at: 1, x, y, rotation, ease: "easeOutCubic" }]) };
  }
  if (s.pattern === "rings") {
    // Each ring expands outward; outer rings start later.
    const ring = p.ring ?? 0, start = s.pieces > 1 ? (0.3 * ring) / (s.pieces - 1) : 0, dist = s.spread * (0.6 + ring * 0.3);
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: out.x * dist, y: out.y * dist, rotation: s.spin * 0.3 * (rand() * 2 - 1), ease: "easeOutCubic" }]) };
  }
  if (s.pattern === "pixelate") {
    // Cells drop out in scanline order, each fading and falling a little over its own window.
    const total = fragmentCount(s), order = p.order ?? index, start = total > 1 ? (0.6 * order) / (total - 1) : 0, end = Math.min(1, start + 0.4);
    const dx = (rand() * 2 - 1) * s.drift * 0.3, dy = 0.15 + s.fall * 0.3;
    return { start, end, fade: [start, end], keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: end, x: dx, y: dy, ease: "easeInQuad" }, { at: 1, x: dx, y: dy, ease: "easeInQuad" }]) };
  }
  if (s.pattern === "ribbons") {
    // Strips sway sideways on a sine while they fall, starting one after another.
    const start = s.pieces > 1 ? (0.3 * index) / (s.pieces - 1) : 0, amp = 0.08 + s.drift * 0.2, drop = s.fall + 0.2, phase = index * 0.7;
    const sway = Array.from({ length: 6 }, (_, j) => {
      const u = (j + 1) / 6;
      return { at: start + (1 - start) * u, x: amp * (Math.sin(phase + u * Math.PI * 3) - Math.sin(phase)), y: drop * u * u, ease: "linear" };
    });
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, ...sway]) };
  }
  // Halves: apart along the cut's normal; top/bottom lets the top half slide off and topple.
  const a = screenCut(s, cutAngle);
  const n = { x: -Math.sin(a), y: Math.cos(a) }, side = Math.sign(c.x * n.x + c.y * n.y) || 1;
  if (s.pattern === "topBottom" && side > 0) return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.4 }, { at: 1, x: 0, y: s.fall * 0.1, ease: "easeInQuad" }]) };
  const along = s.pattern === "topBottom" ? s.spread * 0.3 : 0;
  const mx = n.x * side * s.spread * 0.5 + Math.cos(a) * along, my = n.y * side * s.spread * 0.5 + Math.sin(a) * along + s.fall * 0.3;
  return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: 0.15, x: mx * 0.15, y: my * 0.15, ease: "easeInOutQuad" }, { at: 1, x: mx, y: my, rotation: side * s.spin * (s.pattern === "topBottom" ? 3 : 1), ease: "easeOutQuad" }]) };
}

// Behaviours other than burst replace the pattern's own flight, for every pattern. Absorb's
// point can be 40 squares out plus the piece's own offset, so those keyframes get a wider clamp.
const AIMED = { limit: 48 };
function behaviorFlight(s, p, index, cutAngle, turn, size, c, out, rand) {
  // The piece's centroid offset from the token's centre, on screen, in squares.
  const lx = p.centroid.x * size.w, ly = p.centroid.y * size.h;
  const home = { x: Math.cos(turn) * lx - Math.sin(turn) * ly, y: Math.sin(turn) * lx + Math.cos(turn) * ly };
  const spin = s.spin * (rand() * 2 - 1);
  if (s.behavior === "implode") {
    // To the centre, shrinking; the outer pieces go first.
    const start = 0.35 * (1 - Math.min(1, Math.hypot(c.x, c.y) / Math.SQRT1_2));
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: -home.x, y: -home.y, rotation: spin * 0.5, scale: 0.05, ease: "easeInQuad" }], AIMED) };
  }
  if (s.behavior === "absorb") {
    // To the attacker, one after another, bending a little on the way, fading over the last quarter.
    const to = s.towards ?? { x: -Math.cos(cutAngle) * 1.5, y: -Math.sin(cutAngle) * 1.5 };
    const d = { x: to.x - home.x, y: to.y - home.y }, dl = Math.hypot(d.x, d.y) || 1, bend = (rand() * 2 - 1) * 0.15 * dl;
    const start = (0.4 * index) / Math.max(1, fragmentCount(s) - 1), mid = start + (1 - start) / 2;
    return { start, end: 1, fade: [start + (1 - start) * 0.75, 1], keyframes: normalizeKeyframes([{ at: 0 }, { at: start },
      { at: mid, x: d.x / 2 - (d.y / dl) * bend, y: d.y / 2 + (d.x / dl) * bend, rotation: spin * 0.5, scale: 0.6, ease: "easeInQuad" },
      { at: 1, x: d.x, y: d.y, rotation: spin, scale: 0.2, ease: "easeOutQuad" }], AIMED) };
  }
  if (s.behavior === "rise") {
    // Up by spread + 0.5 squares, swaying 0.15 either side, shrinking to 0.4.
    const side = rand() < 0.5 ? -1 : 1, start = rand() * 0.2, up = -(s.spread + 0.5), at = (u) => start + (1 - start) * u;
    return { start, end: 1, keyframes: normalizeKeyframes([{ at: 0 }, { at: start },
      { at: at(1 / 3), x: 0.15 * side, y: up / 3, scale: 0.8, ease: "linear" },
      { at: at(2 / 3), x: -0.15 * side, y: (2 * up) / 3, rotation: spin * 0.15, scale: 0.6, ease: "linear" },
      { at: 1, x: 0, y: up, rotation: spin * 0.3, scale: 0.4, ease: "linear" }]) };
  }
  if (s.behavior === "bounce") {
    // Out a little, down to a floor 0.4 below the start, one bounce of 0.15, settled. Sharp
    // keyframes keep each fall a straight line, so a piece never dips under its floor.
    const ox = out.x * s.spread * 0.4, r = spin * 0.5;
    return { start: 0, end: 1, keyframes: normalizeKeyframes([{ at: 0 },
      { at: 0.2, x: ox * 0.5, y: -0.2, rotation: r * 0.3, ease: "easeOutQuad" },
      { at: 0.5, x: ox * 0.8, y: 0.4, rotation: r * 0.7, sharp: true, ease: "easeInQuad" },
      { at: 0.68, x: ox * 0.9, y: 0.25, rotation: r * 0.85, ease: "easeOutQuad" },
      { at: 0.84, x: ox, y: 0.4, rotation: r, sharp: true, ease: "easeInQuad" },
      { at: 1, x: ox, y: 0.4, rotation: r, ease: "easeOutQuad" }]) };
  }
  if (s.behavior === "crumble") {
    // Straight down, top first (by the piece's height on screen), landing in a low heap at the
    // token's feet: 0.45-0.55 of the art's height below its centre, spread a little wider than
    // the token, with a small sideways jitter and a little roll (a piece already that low stays put,
    // a turned corner below the heap only settles onto it). Fades only late in the stage's window.
    const h = size.h || 1, w = size.w || 1, height = Math.min(1, Math.max(0, home.y / h + 0.5));
    const start = 0.45 * height, end = start + 0.4, jitter = (rand() * 2 - 1) * 0.06 * w;
    const dx = home.x * 0.15 + jitter, dy = Math.max(h * (0.45 + rand() * 0.1), Math.min(home.y, h * 0.55)) - home.y, roll = s.spin * 0.25 * (rand() * 2 - 1);
    const window = Math.max(0, 1 - s.fade / Math.max(1, s.duration ?? 1400));
    return { start, end, fade: [window + (1 - window) * 0.6, 1], keyframes: normalizeKeyframes([{ at: 0 }, { at: start, sharp: true },
      { at: start + 0.2, x: dx * 0.3 - jitter * 0.5, y: dy * 0.25, rotation: roll * 0.3, sharp: true, ease: "easeInQuad" },
      { at: end, x: dx, y: dy, rotation: roll, sharp: true, ease: "easeInQuad" },
      { at: 1, x: dx, y: dy, rotation: roll, ease: "linear" }], AIMED) };
  }
  if (s.behavior === "flatten") {
    // Squashed to 0.35 of its height and 1.15 of its width about the art's bottom on screen over
    // the first quarter, then skidding out along that floor, slowing.
    const h = size.h || 1, w = size.w || 1, floor = (Math.abs(Math.cos(turn)) * h + Math.abs(Math.sin(turn)) * w) / 2;
    const sx = home.x * 0.15, sy = (floor - home.y) * 0.65, side = Math.sign(home.x) || (rand() < 0.5 ? -1 : 1), skid = side * s.spread * (0.5 + rand() * 0.5);
    return { start: 0, end: 1, squash: { until: 0.25, x: 1.15, y: 0.35 }, keyframes: normalizeKeyframes([{ at: 0 },
      { at: 0.25, x: sx, y: sy, sharp: true, ease: "easeOutQuad" },
      { at: 1, x: sx + skid, y: sy, rotation: spin * 0.15, ease: "easeOutQuad" }], AIMED) };
  }
  if (s.behavior === "shudder") {
    // The whole token shakes for the first 35% (fragmentPose adds the shake), then bursts with the
    // pattern's own flight squeezed into the rest.
    const burst = fragmentFlight({ ...s, behavior: "burst" }, p, index, cutAngle, turn, size), squeeze = (t) => 0.35 + 0.65 * t;
    const fade = burst.fade ? burst.fade.map(squeeze) : s.pattern === "dust" ? [squeeze(burst.start + (burst.end - burst.start) * 0.3), squeeze(burst.end)] : null;
    return { start: squeeze(burst.start), end: squeeze(burst.end), ...(fade ? { fade } : {}), shake: { until: 0.35, amp: 0.04, seed: s.seed ?? 1 },
      keyframes: normalizeKeyframes([{ at: 0 }, ...burst.keyframes.map((k, i) => ({ ...k, at: squeeze(k.at), ...(i ? {} : { sharp: true }) }))]) };
  }
  if (s.behavior === "glitch") {
    // 6-8 seeded moments, each snapping to an offset of up to 0.15 and blinking 1 / 0.3; gone at the
    // piece's own end time. fragmentPose holds each step; the keyframes only say where it ends.
    const count = 6 + Math.floor(rand() * 3), last = 0.75 + rand() * 0.2, steps = [];
    for (let j = 0; j < count; j++) steps.push({ at: (last * (j + 0.5 + (rand() - 0.5) * 0.6)) / count, x: (rand() * 2 - 1) * 0.15, y: (rand() * 2 - 1) * 0.15, alpha: j % 2 ? 0.3 : 1 });
    const final = steps.at(-1);
    steps.push({ at: last, x: final.x, y: final.y, alpha: 0 });
    return { start: steps[0].at, end: last, steps, keyframes: normalizeKeyframes([{ at: 0 }, { at: 1, x: final.x, y: final.y, sharp: true }]) };
  }
  if (s.behavior === "sink") {
    // Down 0.3 squares, pulled a little inward, shrinking to 0.85, fading over the last half.
    const start = rand() * 0.15;
    return { start, end: 1, fade: [0.5, 1], keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, x: -home.x * 0.15, y: 0.3, scale: 0.85, ease: "easeInQuad" }], AIMED) };
  }
  // Drip: each piece starts within the first 30%, stretches to 2.2x its height and slides down.
  const start = rand() * 0.3;
  return { start, end: 1, stretchY: 2.2, keyframes: normalizeKeyframes([{ at: 0 }, { at: start }, { at: 1, y: s.fall + 0.4, ease: "easeInQuad" }]) };
}

// Shudder's shake: one seeded offset per 1/48 of the stage, the same for every piece.
const SHAKE_STEPS = 48;
function shakeOffset({ amp, seed }, q) {
  const r = seededRandom(((seed >>> 0) * 31 + Math.floor(q * SHAKE_STEPS) + 1) >>> 0);
  return { x: (r() * 2 - 1) * amp, y: (r() * 2 - 1) * amp };
}

export function fragmentPose(stage, p, flight, t) {
  const s = prepareFragments(stage), q = Math.min(1, Math.max(0, t));
  // Glitch: each step's offset and alpha hold until the next step.
  if (flight.steps) {
    let step = null;
    for (const k of flight.steps) { if (q < k.at) break; step = k; }
    return { x: step?.x ?? 0, y: step?.y ?? 0, rotation: 0, alpha: step?.alpha ?? 1, scale: 1, stretchX: 1, stretchY: 1 };
  }
  const at = samplePath(flight.keyframes, q);
  // Pieces fade over the stage's last `fade` ms; a bursting dust speck fades over its own window,
  // and a flight with its own `fade` window (pixels, absorbed pieces) over that.
  const speck = s.pattern === "dust" && s.behavior === "burst";
  const fadeFrom = flight.fade ? flight.fade[0] : speck ? flight.start + (flight.end - flight.start) * 0.3 : Math.max(0, 1 - s.fade / Math.max(1, stage.duration ?? 1400));
  const fadeTo = flight.fade ? flight.fade[1] : speck ? flight.end : 1;
  const alpha = q <= fadeFrom ? 1 : q >= fadeTo ? 0 : 1 - (q - fadeFrom) / (fadeTo - fadeFrom);
  const grow = flight.stretchY ? Math.min(1, Math.max(0, (q - flight.start) / Math.max(1e-9, flight.end - flight.start))) : 0;
  // Flatten squashes over its first stretch of time, then holds.
  const squash = flight.squash ? Math.min(1, q / Math.max(1e-9, flight.squash.until)) : 0;
  const shake = flight.shake && q < flight.shake.until ? shakeOffset(flight.shake, q) : null;
  return {
    x: shake ? at.x + shake.x : at.x, y: shake ? at.y + shake.y : at.y, rotation: at.rotation, alpha, scale: at.scale,
    stretchX: flight.squash ? 1 + (flight.squash.x - 1) * squash : 1,
    stretchY: flight.squash ? 1 + (flight.squash.y - 1) * squash : flight.stretchY ? 1 + (flight.stretchY - 1) * grow : 1,
  };
}
