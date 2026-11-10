// A toppled statue or pillar: where it lies, the rubble Region it leaves (v14 modifyMovementCost, walking costs double)
// and the GM's whisper about who stands under the fall, and how it looks falling (toppleLayout). Pure: no Foundry globals.
import { onLevel } from "./prop-pick.mjs";
import { seededRandom } from "../fragments/fragments.mjs";

const RUBBLE_COLOR = "#7a6a55";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const tidy = (v) => Math.round(v * 1000) / 1000 + 0; // no float dust, no -0

// The strip the statue falls along: from the rect's centre along cutAngle (away from the blow), as long as the rect's
// longer side and as wide as its shorter side. rect: {x, y, width, height} (top-left).
export function toppleStrip(rect, cutAngle) {
  const { x, y, width, height } = rect;
  return { from: { x: x + width / 2, y: y + height / 2 }, angle: cutAngle, length: Math.max(width, height), width: Math.min(width, height) };
}

// The strip's four corners as x, y pairs: the start edge's left, the far edge's left, its right, the start edge's right.
export function stripPolygon({ from, angle, length, width }) {
  const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy * (width / 2), ny = dx * (width / 2);
  const ex = from.x + dx * length, ey = from.y + dy * length;
  return [from.x - nx, from.y - ny, ex - nx, ey - ny, ex + nx, ey + ny, from.x + nx, from.y + ny].map(tidy);
}

// The Region the rubble is made of: a polygon on the statue's level that doubles the cost of walking (other movement
// actions keep their cost). flags.animater.propRubble names the tile so undo and Repair can find it.
export function rubbleRegionData({ strip, tileId, levels = [], bottom = null, top = null } = {}) {
  return {
    name: "Rubble", color: RUBBLE_COLOR,
    shapes: [{ type: "polygon", points: stripPolygon(strip) }],
    elevation: { bottom, top }, levels: [...levels],
    behaviors: [{ type: "modifyMovementCost", name: "Rubble", system: { difficulties: { walk: 2 } } }],
    flags: { animater: { propRubble: tileId } },
  };
}

// Whether two convex polygons (flat x, y lists) overlap with area: a shared edge or corner alone is not enough.
function overlap(a, b) {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i += 2) {
      const j = (i + 2) % poly.length, ax = poly[j + 1] - poly[i + 1], ay = poly[i] - poly[j]; // an edge's normal
      const range = (p) => { let lo = Infinity, hi = -Infinity; for (let k = 0; k < p.length; k += 2) { const d = p[k] * ax + p[k + 1] * ay; lo = Math.min(lo, d); hi = Math.max(hi, d); } return [lo, hi]; };
      const [alo, ahi] = range(a), [blo, bhi] = range(b), eps = 1e-6 * Math.hypot(ax, ay);
      if (ahi <= blo + eps || bhi <= alo + eps) return false;
    }
  }
  return true;
}

// The names of the tokens {name, x, y, w, h, level} whose square overlaps the strip, on the fall's levels.
export function tokensUnderStrip(tokens, strip, levels) {
  const poly = stripPolygon(strip);
  return (tokens ?? []).filter((t) => onLevel(t.level, levels) && overlap(poly, [t.x, t.y, t.x + t.w, t.y, t.x + t.w, t.y + t.h, t.x, t.y + t.h])).map((t) => t.name);
}

export function toppleWhisper(propName, names = []) {
  if (!names.length) return "";
  return `<p><b>${esc(propName || "A statue")} toppled.</b></p><p>Under the fall: ${names.map(esc).join(", ")}.</p>`;
}

// --- The look (approved mock "Breaking more", scene 6) ---
// The plinth stays as a broken stump; the figure tips along the hit, and from above it lengthens as it goes down (its
// foot at the plinth's edge, its head away) over TOPPLE_MS; then it breaks into big chunks of itself that jolt apart
// along the rubble strip, with stone chips, a pale dust mark and a dust cloud. Drawn by prop-wreck.mjs.
export const TOPPLE_MS = 600;
export const CHUNK_MS = 600; // the chunks' own timeline after the impact: their delay and dur are shares of it
const TAU = Math.PI * 2;
const lerp = (a, b, u) => a + (b - a) * u;
const MOCK_WID = 83; // the mock statue's lying width (px): puff sizes are read against it

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
const centroid = (poly) => { let x = 0, y = 0; for (let i = 0; i < poly.length; i += 2) { x += poly[i]; y += poly[i + 1]; } return { x: (x * 2) / poly.length, y: (y * 2) / poly.length }; };
// A lying figure seen from above, its half-width as a share at u along it (0 the feet, 1 the head): narrow at the
// feet, broad shoulders, a neck, a round head.
const profile = (u) => (u < 0.08 ? 0.42 + u * 2 : u < 0.62 ? 0.56 + u * 0.35 : u < 0.8 ? 0.82 - (u - 0.62) * 1.2 : u < 0.84 ? 0.38 : 0.5 * Math.sqrt(Math.max(0, 1 - ((u - 0.92) / 0.085) ** 2)));

// note: {seed, cutAngle}; width/height: the tile's; grid: px per square; rotation: the tile's turn in degrees (the
// layout is tile-local, so the hit is turned back by it); box: the painted part (the plinth) as shares [x0, y0, x1, y1].
// Everything is tile-local px (origin at the tile's top-left, unturned) except fall.outline, which is in the fall's own
// frame: x along the fall from the break, y across it (centred).
// stump: {poly (the broken middle), ring (the plinth's outline), cracks [[x0, y0, x1, y1]], centre}.
// fall: {ms, from: {rot: 0}, to: {stretch}, at (the break, at the plinth's edge), angle, length, width, along (its
//   length when it starts to fall: length / stretch), src [x, y, w, h] (the figure's part of the picture), axis (the
//   picture's turn that lies along the fall), outline}.
// chunks: [{poly, home, to: {x, y, rot}, delay, dur (shares of CHUNK_MS), edge? (the fresh break at its plinth end)}],
//   5-8 of them, their targets inside the rubble strip grown by a quarter square.
// dust: puffs {x, y, vx, vy, r0, r1, a, at (ms after the impact), life, seed}; chips: {x0, y0, x, y, rot0, rot, l, w,
//   tone, sh, small}; mark: {x, y, r, squash, angle} (a pale stone mark, flattened along the fall).
export function toppleLayout(note, { width, height, grid = 100, rotation = 0, box = [0, 0, 1, 1] } = {}) {
  const rand = seededRandom(((note?.seed ?? 0) >>> 0) * 197 + 61);
  const tw = Math.max(1, Number(width) || 0), th = Math.max(1, Number(height) || 0), gs = Number(grid) || 100, gk = gs / 100;
  const ok = Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) && box[2] > box[0] && box[3] > box[1];
  const [f0, g0, f1, g1] = ok ? box.map((v) => Math.min(1, Math.max(0, v))) : [0, 0, 1, 1];
  const x0 = f0 * tw, y0 = g0 * th, x1 = Math.max(x0 + 1, f1 * tw), y1 = Math.max(y0 + 1, g1 * th), bw = x1 - x0, bh = y1 - y0;
  const a = (Number(note?.cutAngle) || 0) - ((Number(rotation) || 0) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  const bc = { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, inset = 0.154 * Math.min(bw, bh);

  // The stump: the plinth's ring stays, its middle a broken stone top with cracks running out from the centre.
  const amp = (4 / 22) * inset;
  const poly = [...jag(x0 + inset, y0 + inset, x1 - inset, y0 + inset, 6, amp, rand), ...jag(x1 - inset, y1 - inset, x0 + inset, y1 - inset, 6, amp, rand)];
  const hole = Math.min(bw, bh) - 2 * inset;
  const cracks = Array.from({ length: 5 }, () => { const ca = rand() * TAU, r = hole * (0.2 + rand() * 0.28); return [bc.x, bc.y, bc.x + Math.cos(ca) * r, bc.y + Math.sin(ca) * r * 0.9]; });
  const stump = { poly, ring: [x0, y0, x1, y0, x1, y1, x0, y1], cracks, centre: bc };

  // The fall: it breaks off a little inside the plinth's edge and lies to the strip's end. The picture's axis nearest
  // the fall lies along it, so the picture turns by at most an eighth of a turn.
  const axis = Math.round(a / (Math.PI / 2)) * (Math.PI / 2), sideways = Math.abs(uy) > Math.abs(ux);
  const src = [x0 + inset / 2, y0 + inset / 2, bw - inset, bh - inset];
  const edge = Math.min(ux ? bw / 2 / Math.abs(ux) : Infinity, uy ? bh / 2 / Math.abs(uy) : Infinity), out = Math.max(0, edge - 0.8 * inset);
  const at = { x: bc.x + ux * out, y: bc.y + uy * out };
  const strip = toppleStrip({ x: 0, y: 0, width: tw, height: th }, a);
  const length = strip.length - ((at.x - strip.from.x) * ux + (at.y - strip.from.y) * uy);
  const along = Math.min(sideways ? src[3] : src[2], length / 1.4), across = sideways ? src[2] : src[3];
  const wid = Math.min(0.78 * across, 0.85 * strip.width, 0.38 * length); // slender, as the mock's (0.31 of its length)
  const outline = [];
  for (let i = 0; i <= 40; i++) outline.push((i / 40) * length, -profile(i / 40) * (wid / 2) * (0.94 + rand() * 0.1));
  for (let i = 40; i >= 0; i--) outline.push((i / 40) * length, profile(i / 40) * (wid / 2) * (0.94 + rand() * 0.1));
  const fall = { ms: TOPPLE_MS, from: { rot: 0 }, to: { stretch: length / along }, at, angle: a, length, width: wid, along, src, axis, outline };

  // From the fall's frame to tile-local px, and a target kept on the strip grown by (just under) a quarter square.
  const T = (x, y) => ({ x: at.x + ux * x - uy * y, y: at.y + uy * x + ux * y });
  const flat = (pts) => { const o = []; for (let i = 0; i < pts.length; i += 2) { const p = T(pts[i], pts[i + 1]); o.push(p.x, p.y); } return o; };
  const q = 0.24 * gs;
  const onStrip = (p) => {
    const dx = p.x - strip.from.x, dy = p.y - strip.from.y;
    const l = Math.min(strip.length + q, Math.max(-q, dx * ux + dy * uy)), c = Math.min(strip.width / 2 + q, Math.max(-strip.width / 2 - q, -dx * uy + dy * ux));
    return { x: strip.from.x + ux * l - uy * c, y: strip.from.y + uy * l + ux * c };
  };

  // The chunks: the lying figure cut across with jagged breaks; the further from the plinth, the further they jolt.
  // Five over the mock's 2.7 squares of figure, one more for each 0.9 square past that, at most eight.
  const n = 5 + Math.min(3, Math.max(0, Math.floor((length / gs - 2.7) / 0.9)));
  const part = length / n, cuts = [0];
  for (let i = 1; i < n; i++) cuts.push(length * (i / n) + (rand() - 0.5) * 0.33 * part);
  cuts.push(length);
  const lines = cuts.map((c, i) => (i === 0 || i === n ? [c, -wid / 2, c, wid / 2] : jag(c, -wid / 2, c + (rand() - 0.5) * 0.24 * wid, wid / 2, 4, 0.084 * wid, rand)));
  const chunks = [];
  for (let i = 0; i < n; i++) {
    const lp = [...lines[i], ...reversed(lines[i + 1])], h = centroid(lp);
    const push = ((i / n) * 0.1 + rand() * 0.03) * length, side = (rand() - 0.5) * 0.22 * wid, rot = (rand() - 0.5) * 0.5;
    const to = onStrip(T(h.x + push, h.y + side)), dur = (380 + rand() * 120) / CHUNK_MS;
    chunks.push({ poly: flat(lp), home: T(h.x, h.y), to: { x: to.x, y: to.y, rot }, delay: 0, dur, ...(i ? { edge: flat(lines[i]) } : {}) });
  }

  // Dust along the fallen figure, drifting a little up the page.
  const s = wid / MOCK_WID, base = ((note?.seed ?? 0) >>> 0) % 100000;
  const dust = Array.from({ length: 12 }, (_, i) => {
    const p = T(length * (i / 11), (rand() - 0.5) * 0.48 * wid);
    return { x: p.x, y: p.y, vx: (rand() - 0.5) * 70 * s, vy: ((rand() - 0.5) * 70 - 20) * s, r0: 20 * s, r1: (60 + rand() * 20) * s, a: 0.45, at: rand() * 80, life: 1300 + rand() * 500, seed: base + i };
  });
  // Stone chips thrown all round from the middle of the fall: 40 big ones, and 60 small ones that settle into the mark.
  const mid = T(length * 0.55, 0);
  const chipsOf = (count, dist, len, wd, tones, small) => Array.from({ length: count }, () => {
    const ca = a + (rand() - 0.5) * TAU, d = 100 * gk * lerp(dist[0], dist[1], rand() ** 1.4), l = lerp(len[0], len[1], rand()) * gk, w = lerp(wd[0], wd[1], rand()) * gk;
    const rot0 = rand() * Math.PI, spin = (rand() - 0.5) * 8, tone = Math.floor(rand() * tones), ox = (rand() - 0.5) * 10 * gk, oy = (rand() - 0.5) * 10 * gk, sh = 0.7 + rand() * 0.6;
    const cx = mid.x + ox, cy = mid.y + oy;
    return { x0: cx, y0: cy, x: cx + Math.cos(ca) * d, y: cy + Math.sin(ca) * d, rot0, rot: rot0 + spin, l, w, tone, sh, small };
  });
  const chips = [...chipsOf(40, [0.2, 1.7], [5, 13], [4, 8], 4, false), ...chipsOf(60, [0.1, 1.5], [2, 4], [2, 3], 2, true)];
  const mark = { x: mid.x, y: mid.y, r: 0.56 * length, squash: 0.42, angle: a };
  return { stump, fall, chunks, dust, chips, mark };
}
