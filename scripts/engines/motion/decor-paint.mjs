// Decorations painted for a region (decorations.mjs): rocks, trees, puddles and the rest, each drawn once into a small image in the
// look of a hand-inked battlemap: foliage built from hundreds of small outlined leaves, darker at the rim and lit in patches; stone
// shaded softly from a pale face to a dark brown rim, with faint cracks and ledges; blades and fronds each outlined in fine ink;
// muted, earthy colours. Every one is drawn from a seed, so every screen paints the same thing. Pure canvas 2D: no Foundry, no PIXI.

// A small seeded random: the same seed gives the same numbers on every screen.
export const seeded = (seed) => {
  let s = (seed >>> 0) || 1;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
export const hashText = (text) => { let h = 2166136261; for (const ch of String(text)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };

// Smooth value noise, for where light falls in patches and how ragged an edge is.
const lattice = (x, y, k) => { let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(k | 0, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const noise = (x, y, k = 0) => { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = lattice(ix, iy, k), b = lattice(ix + 1, iy, k), c = lattice(ix, iy + 1, k), d = lattice(ix + 1, iy + 1, k); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };

const INK = 'rgba(14,11,6,0.92)';
const parse = (c) => { if (c.startsWith('rgb')) return c.match(/[\d.]+/g).slice(0, 3).map(Number); const n = parseInt(c.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const mix = (a, b, t) => { const pa = parse(a), pb = parse(b); return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(',')})`; };
const shade = (c, by) => (by < 0 ? mix(c, '#0c0904', Math.min(1, -by)) : mix(c, '#f4ead0', Math.min(1, by)));
const pick = (rng, list) => list[Math.floor(rng() * list.length)];
// Toward the light: top left, as the map is lit. 1 on the lit side, -1 on the far side.
const towardLight = (x, y, r) => (-(x * 0.62) - y * 0.78) / Math.max(r, 1e-6);

// A rough closed outline round a centre: n points, each pushed in or out by noise.
const blob = (rng, cx, cy, rx, ry, n = 12, rough = 0.15, turn = rng() * 6.28) => {
  const pts = [], k0 = rng() * 50;
  for (let i = 0; i < n; i++) { const a = turn + (i / n) * Math.PI * 2, k = 1 + (noise(Math.cos(a) * 1.6 + k0, Math.sin(a) * 1.6) - 0.5) * rough * 2.4; pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
  return pts;
};
// (fresh false: added to the path already begun, for a ring cut by its inner outline.)
const trace = (g, pts, fresh = true) => {
  const m = (i) => { const a = pts[i % pts.length], b = pts[(i + 1) % pts.length]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  if (fresh) g.beginPath(); const s = m(0); g.moveTo(s[0], s[1]);
  for (let i = 1; i <= pts.length; i++) { const p = pts[i % pts.length], e = m(i); g.quadraticCurveTo(p[0], p[1], e[0], e[1]); }
  g.closePath();
};
const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); };
const moved = (pts, cx, cy, k, dx = 0, dy = 0) => pts.map(([x, y]) => [cx + (x - cx) * k + dx, cy + (y - cy) * k + dy]);
const centre = (pts) => pts.reduce((s, p) => [s[0] + p[0] / pts.length, s[1] + p[1] / pts.length], [0, 0]);
const reach = (pts, [cx, cy] = centre(pts)) => Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)));
const line = (g, pts, color, width, cap = 'round') => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]); g.strokeStyle = color; g.lineWidth = width; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); };
// A wandering line: start, heading, steps, each step turning a little.
const wander = (rng, x, y, a, steps, step, turn) => { const pts = [[x, y]]; for (let i = 0; i < steps; i++) { a += (rng() - 0.5) * turn; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); } return pts; };

// --- Foliage --------------------------------------------------------------------------------------------------------------------------
// Leaf colours: shadow, body, lit, bright. Muted olive, as the map's.
const LEAVES = {
  spring: ['#3c4a12', '#6e8424', '#98aa2e', '#c2c03c'],
  summer: ['#38320c', '#6a5c14', '#9e7c1e', '#c8962a'],
  autumn: ['#4a2c0e', '#8a5218', '#b47a28', '#d8a636'],
  winter: ['#2e3218', '#4e522a', '#6a6c40', '#908c56'],
};
// One small leaf at (x, y), length len, turned to a, outlined, in its tree's own shape:
// 'oval' pointed (a bush, a fruit tree); 'oak' long with round lobes down each side; 'maple' a hand of five pointed lobes;
// 'birch' a small toothed diamond; 'willow' long and narrow; 'flower' five round petals round a dot (blossom).
function leaf(g, x, y, len, a, fill, ink, wide = 0.42, shape = 'oval') {
  const c = Math.cos(a), s = Math.sin(a), at = (u, v) => [x + c * u - s * v, y + s * u + c * v];
  g.beginPath();
  if (shape === 'maple') {
    // Five lobes fanned from the stalk, the middle longest, each pointed, with a notch between.
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const ang = (k - 2) * 0.62, reach = len * [0.62, 0.92, 1, 0.92, 0.62][k], notch = len * 0.42, nAng = ang + 0.31;
      pts.push(at(Math.cos(ang - 0.12) * reach * 0.7, Math.sin(ang - 0.12) * reach * 0.7), at(Math.cos(ang) * reach, Math.sin(ang) * reach), at(Math.cos(ang + 0.12) * reach * 0.7, Math.sin(ang + 0.12) * reach * 0.7));
      if (k < 4) pts.push(at(Math.cos(nAng) * notch, Math.sin(nAng) * notch));
    }
    pts.unshift(at(-len * 0.08, 0)); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath();
  } else if (shape === 'oak') {
    // Down each side four round lobes, widest past the middle.
    const n = 4, side = [];
    for (let i = 0; i <= n * 2; i++) { const t = i / (n * 2), w = len * wide * 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.1)) * (i % 2 ? 0.55 : 1); side.push([len * t, w]); }
    g.moveTo(...at(0, 0)); for (let i = 1; i < side.length; i += 2) g.quadraticCurveTo(...at(side[i][0], side[i][1] * 2.2), ...at(side[i + 1]?.[0] ?? len, side[i + 1]?.[1] ?? 0));
    for (let i = side.length - 2; i >= 1; i -= 2) g.quadraticCurveTo(...at(side[i][0], -side[i][1] * 2.2), ...at(side[i - 1][0], -side[i - 1][1]));
    g.closePath();
  } else if (shape === 'birch') {
    // A small diamond, broad near its base, its edges finely toothed.
    const pts = [], teeth = 5;
    for (let i = 0; i <= teeth; i++) { const t = i / teeth, w = len * wide * (t < 0.35 ? t / 0.35 : (1 - t) / 0.65); pts.push(at(len * t, w * (i % 2 ? 0.8 : 1))); }
    for (let i = teeth; i >= 0; i--) { const t = i / teeth, w = len * wide * (t < 0.35 ? t / 0.35 : (1 - t) / 0.65); pts.push(at(len * t, -w * (i % 2 ? 0.8 : 1))); }
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath();
  } else if (shape === 'flower') {
    // Five round petals; their dot drawn after.
    for (let k = 0; k < 5; k++) { const pa = a + k * 1.2566, px = x + Math.cos(pa) * len * 0.32, py = y + Math.sin(pa) * len * 0.32; g.moveTo(px + len * 0.26, py); g.arc(px, py, len * 0.26, 0, 6.283); }
  } else {
    const w = len * (shape === 'willow' ? Math.min(wide, 0.22) : wide), tip = at(len, 0), back = at(-len * 0.15, 0);
    g.moveTo(...back); g.quadraticCurveTo(...at(len * 0.4, w), ...tip); g.quadraticCurveTo(...at(len * 0.4, -w), ...back);
  }
  g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = ink; g.stroke();
  if (shape === 'flower') { g.fillStyle = '#c8962a'; g.beginPath(); g.arc(x, y, len * 0.12, 0, 6.283); g.fill(); }
  // A midrib down the bigger leaves, darker, as the map's own leaves have.
  else if (shape === 'maple' || shape === 'oak') { g.beginPath(); g.moveTo(...at(-len * 0.05, 0)); g.lineTo(...at(len * 0.8, 0)); g.strokeStyle = 'rgba(20,16,6,0.45)'; g.lineWidth = ink * 0.6; g.stroke(); }
}
// A patch of snow lying on something's top at (x, y): soft-edged, white toward the light and blue-grey where it rounds away,
// thinning to crumbs at its rim, never a flat white shape. Clipped by the caller to what it lies on.
function snowPatch(g, rng, x, y, rx, ry, o) {
  if (!(o.snow > 0) || rx <= 0) return;
  // Not one shape: a few overlapping drifts, thickest toward the light, the surface showing between them.
  const r = Math.max(rx, ry);
  g.save(); g.filter = `blur(${Math.max(0.8, r * 0.1)}px)`;
  for (let i = 0; i < 3; i++) {
    const k = i ? 0.45 + rng() * 0.3 : 0.75, px = x + (i ? (rng() - 0.6) * rx : 0), py = y + (i ? (rng() - 0.6) * ry : 0), sg = g.createRadialGradient(px - rx * k * 0.3, py - ry * k * 0.35, 0, px, py, r * k);
    sg.addColorStop(0, 'rgba(240,244,247,0.82)'); sg.addColorStop(0.65, 'rgba(208,217,227,0.7)'); sg.addColorStop(1, 'rgba(160,174,190,0.35)');
    trace(g, blob(rng, px, py, rx * k, ry * k, 14, 0.35)); g.fillStyle = sg; g.fill();
  }
  g.restore();
  for (let i = 0; i < 6 + r * 0.4; i++) { const a = rng() * 6.283, d = 0.85 + rng() * 0.35; g.fillStyle = 'rgba(236,240,244,0.75)'; g.beginPath(); g.arc(x + Math.cos(a) * rx * d, y + Math.sin(a) * ry * d, Math.max(0.6, o.ink * (0.4 + rng() * 0.7)), 0, 6.283); g.fill(); }
}
// Snow lying on a crown: soft drifts on its lit tops rather than white leaves, the leaves still showing at their edges, blue-grey
// where they turn away, a few bright crumbs. spots: [x, y, r] where it lies.
function snowDrifts(g, rng, spots, hull, o) {
  if (!spots.length) return;
  g.save(); trace(g, hull); g.clip();
  g.filter = `blur(${Math.max(1, o.unit * 0.02)}px)`;
  for (const [x, y, r] of spots) { const sg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, 0, x, y, r); sg.addColorStop(0, `rgba(240,244,247,${0.68 * o.snow})`); sg.addColorStop(0.65, `rgba(214,222,230,${0.45 * o.snow})`); sg.addColorStop(1, 'rgba(180,192,206,0)'); g.fillStyle = sg; g.beginPath(); g.ellipse(x, y, r, r * 0.8, rng() * 3, 0, 6.283); g.fill(); }
  g.filter = 'none';
  for (const [x, y, r] of spots) for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(248,250,252,0.75)'; g.beginPath(); g.arc(x + (rng() - 0.5) * r, y + (rng() - 0.5) * r, Math.max(0.6, o.ink * (0.5 + rng() * 0.6)), 0, 6.283); g.fill(); }
  g.restore();
}
// A mass of leaves filling a ragged round shape of radius R: outer and lower leaves dark, lit patches toward the top left, snow
// lying on the most lit. Leaves drawn from the rim inward, so the crown sits on top. Returns its silhouette outline.
// Options: wide (leaf breadth to length), bed (how solid the dark under the leaves, below 1 for airy crowns that show ground and
// branches), outward (leaves turned to point away from the middle, for drooping crowns), under (draws beneath the leaves, for a
// tree's branches), lightFrom (a second colour set some leaves take, e.g. blossom among green), mixIn (its share).
function leafMass(g, rng, R, o, { leafLen, count, lobes = 7, rough = 0.16, cx = 0, cy = 0, colors, wide = 0.58, bed = 1, outward = 0, under, lightFrom, mixIn = 0, shape = 'oval', lightShape = null } = {}) {
  const set = colors ?? LEAVES[o.season] ?? LEAVES.summer, k0 = rng() * 100, edge = (a) => R * (1 + (noise(Math.cos(a) * lobes * 0.32 + k0, Math.sin(a) * lobes * 0.32) - 0.5) * rough * 2.6);
  const hull = []; for (let i = 0; i < 40; i++) { const a = (i / 40) * 6.28; hull.push([cx + Math.cos(a) * edge(a) * 1.02, cy + Math.sin(a) * edge(a) * 1.02]); }
  // A dark bed under the leaves, so no gaps show ground (or only some, for an airy crown).
  if (bed > 0) { g.save(); g.globalAlpha = bed; trace(g, moved(hull, cx, cy, 0.94)); g.fillStyle = shade(set[0], -0.45); g.fill(); g.restore(); }
  under?.();
  const leaves = [];
  for (let i = 0; i < count; i++) { const a = rng() * 6.28, t = Math.sqrt(rng()), d = t * edge(a) * 0.98; leaves.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, t, outward && t > 0.3 ? a +(rng() - 0.5) * (1 - outward) * 6.28 : rng() * 6.28]); }
  // Drawn in a loose rim-to-middle order, jittered, so no rings or rays show.
  leaves.sort((p, q) => (q[2] + (lattice(q[0] * 7, q[1] * 7, 1) - 0.5) * 0.5) - (p[2] + (lattice(p[0] * 7, p[1] * 7, 1) - 0.5) * 0.5));
  const drifts = [];
  for (const [x, y, t, a] of leaves) {
    const lx = x - cx, ly = y - cy, patch = noise(lx / (R * 0.3) + k0, ly / (R * 0.3), 3), lit = towardLight(lx, ly, R) * 0.4 + (patch - 0.5) * 1.6 + (1 - t) * 0.15 - t * t * 0.55 + (rng() - 0.5) * 0.4;
    const other = lightFrom && rng() < mixIn, from = other ? lightFrom : set;
    let fill = lit < -0.35 ? from[0] : lit < 0.15 ? from[1] : lit < 0.55 ? from[2] : from[3];
    // Under snow the leaves cool and dull; the snow itself lies over them afterwards, in drifts.
    if (o.snow > 0) fill = mix(fill, '#6a7480', 0.25 * o.snow);
    if (o.snow > 0 && lit > 0.7 - o.snow * 0.4 && rng() < 0.3) drifts.push([x, y, leafLen * (0.7 + rng() * 0.5)]);
    fill = mix(fill, shade(fill, (rng() - 0.5) * 0.3), 0.6);
    leaf(g, x, y, leafLen * (0.8 + rng() * 0.45), a, fill, o.ink * 0.85, wide, other && lightShape ? lightShape : shape);
  }
  snowDrifts(g, rng, drifts, hull, o);
  if (o.wet > 0) { g.save(); trace(g, hull); g.clip(); g.fillStyle = `rgba(6,10,14,${0.18 * o.wet})`; g.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6); g.restore(); }
  return hull;
}

// --- Stone ----------------------------------------------------------------------------------------------------------------------------
const STONES = ['#6e5f46', '#665a44', '#73644a', '#62563f'];
// Underground stone: cooler and greyer, out of the sun's warmth.
const CAVE_STONES = ['#5e5c58', '#55534f', '#64605a', '#4e4c49'];
const stonesOf = (o) => (o.cave ? CAVE_STONES : STONES);
// A stone face: warm grey where the light meets it, sinking into a broad dark-brown rim on the far side; softly mottled; a net of
// faint pale cracks; a lobe line where a second bulge of rock meets the first; a firm ink edge.
function stone(g, rng, pts, base, o, { cracks = 3, ledges = 1, ink = 1 } = {}) {
  const [cx, cy] = centre(pts), r = reach(pts, [cx, cy]), soft = Math.max(1, r * 0.06);
  g.save(); trace(g, pts); g.clip();
  // Dark brown underneath; the lit face laid over it shifted toward the light, its edge softened, leaving a dark crescent on the far side.
  g.fillStyle = mix(base, '#1e1206', 0.75); g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
  g.filter = `blur(${soft * 1.6}px)`;
  trace(g, moved(pts, cx, cy, 0.88, -r * 0.12, -r * 0.15)); g.fillStyle = mix(base, '#3a2810', 0.4); g.fill();
  g.filter = `blur(${soft}px)`;
  trace(g, moved(pts, cx, cy, 0.8, -r * 0.15, -r * 0.18)); g.fillStyle = base; g.fill();
  for (let i = 0; i < 18; i++) { const x = cx + (rng() - 0.6) * r * 1.6, y = cy + (rng() - 0.6) * r * 1.6, s = r * (0.1 + rng() * 0.25); g.fillStyle = rng() < 0.55 ? 'rgba(40,30,16,0.14)' : 'rgba(225,215,190,0.12)'; g.beginPath(); g.ellipse(x, y, s, s * 0.6, rng() * 3, 0, 6.28); g.fill(); }
  g.filter = 'none';
  // Stipple: fine grain all over the face.
  for (let i = 0; i < r * r * 0.6; i++) { const x = cx + (rng() - 0.5) * r * 2, y = cy + (rng() - 0.5) * r * 2; g.fillStyle = rng() < 0.55 ? 'rgba(20,12,4,0.16)' : 'rgba(215,200,165,0.11)'; g.fillRect(x, y, 1 + rng() * 1.2, 1 + rng() * 1.2); }
  // The crack net: many fine pale lines, each branching once or twice, and a few dark ones.
  for (let i = 0; i < cracks * 4; i++) { const a = rng() * 6.28, p = wander(rng, cx + (rng() - 0.6) * r * 1.3, cy + (rng() - 0.6) * r * 1.3, a, 3 + Math.floor(rng() * 5), r * 0.09, 1.4); line(g, p, `rgba(236,228,206,${0.18 + rng() * 0.22})`, Math.max(0.5, o.ink * (0.4 + rng() * 0.4))); if (rng() < 0.5) line(g, wander(rng, ...p[Math.min(2, p.length - 1)], a + (rng() < 0.5 ? 1 : -1), 3, r * 0.07, 1.2), 'rgba(236,228,206,0.2)', Math.max(0.4, o.ink * 0.4)); }
  for (let i = 0; i < Math.ceil(cracks / 2); i++) line(g, wander(rng, cx + (rng() - 0.5) * r, cy + (rng() - 0.5) * r, rng() * 6.28, 4, r * 0.1, 1), 'rgba(30,20,10,0.45)', o.ink * 0.6);
  // Lobe lines: part of a smaller outline, toward the shaded side, where another bulge of the rock begins.
  for (let i = 0; i < ledges; i++) { const l = moved(pts, cx, cy, 0.62 + rng() * 0.15, r * (0.12 + i * 0.1), r * (0.16 + i * 0.08)), from = Math.floor(rng() * l.length), part = Array.from({ length: Math.ceil(l.length * 0.45) }, (_, j) => l[(from + j) % l.length]); g.beginPath(); g.moveTo(...part[0]); for (let j = 1; j < part.length - 1; j++) g.quadraticCurveTo(...part[j], (part[j][0] + part[j + 1][0]) / 2, (part[j][1] + part[j + 1][1]) / 2); g.strokeStyle = 'rgba(28,18,8,0.7)'; g.lineWidth = o.ink * 1.1; g.lineCap = 'round'; g.stroke(); }
  if (o.wet > 0) { g.fillStyle = `rgba(8,10,14,${0.22 * o.wet})`; g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6); g.strokeStyle = `rgba(230,240,250,${0.55 * o.wet})`; g.lineWidth = Math.max(0.8, r * 0.035); g.beginPath(); g.arc(cx - r * 0.05, cy - r * 0.02, r * 0.62, Math.PI * 1.08, Math.PI * 1.42); g.stroke(); }
  snowPatch(g, rng, cx - r * 0.22, cy - r * 0.26, r * (0.25 + 0.2 * o.snow), r * (0.2 + 0.16 * o.snow), o);
  g.restore();
  trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * ink * 1.8; g.lineJoin = 'round'; g.stroke();
}
// A stone that stands up off the ground: its footprint, then its side wall showing on the far side from the light (dark, streaked
// down its face, darkest at the foot), then its top face lifted toward the light and drawn as a stone face. lift: how tall, as a
// share of its size; the taller, the more wall shows.
function standing(g, rng, pts, base, o, { lift = 0.25, ...face } = {}) {
  const [cx, cy] = centre(pts), r = reach(pts, [cx, cy]), dx = -r * lift * 0.55, dy = -r * lift * 0.7;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), rx = (Math.max(...xs) - Math.min(...xs)) / 2, ry = (Math.max(...ys) - Math.min(...ys)) / 2;
  // The top: its own rounded shape, not a copy of the foot, so the rock bulges rather than standing as a drum.
  const top = blob(rng, cx + dx, cy + dy, rx * (1 - lift * 0.45), ry * (1 - lift * 0.4), 32, 0.1);
  g.save(); trace(g, pts); g.clip();
  // The wall: shaded round its curve, darkest low on the far side, with the stone's own grain on it.
  const wall = g.createRadialGradient(cx + dx * 1.4, cy + dy * 1.4, r * 0.2, cx, cy, r * 1.15); wall.addColorStop(0, mix(base, '#2a1c0c', 0.45)); wall.addColorStop(0.6, mix(base, '#1e1206', 0.72)); wall.addColorStop(1, mix(base, '#0e0802', 0.9));
  g.fillStyle = wall; g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
  for (let i = 0; i < r * r * 0.4; i++) { const x = cx + (rng() - 0.5) * r * 2, y = cy + (rng() - 0.5) * r * 2; g.fillStyle = rng() < 0.55 ? 'rgba(10,6,2,0.18)' : 'rgba(200,180,140,0.1)'; g.fillRect(x, y, 1 + rng(), 1 + rng()); }
  // Runnels down the wall: from the top's edge toward the foot, bowing outward with the rock's curve, some broken off short.
  for (let i = 0; i < 26; i++) { const [x, y] = top[Math.floor(rng() * top.length)], ox = x - cx, oy = y - cy, n = Math.hypot(ox, oy) || 1, len = 0.5 + rng() * 0.8, ex = x - dx * len + (ox / n) * r * 0.08, ey = y - dy * len + (oy / n) * r * 0.08; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x - dx * len * 0.5 + (ox / n) * r * 0.1, y - dy * len * 0.5 + (oy / n) * r * 0.1, ex, ey); g.strokeStyle = rng() < 0.65 ? 'rgba(12,6,2,0.5)' : 'rgba(210,190,150,0.16)'; g.lineWidth = o.ink * (0.5 + rng() * 0.6); g.lineCap = 'round'; g.stroke(); }
  // The top: no edge of its own. The stone's face laid on softly, so it rolls over into the wall instead of sitting on it like a lid.
  const soft = Math.max(1.5, r * 0.09);
  g.filter = `blur(${soft * 1.4}px)`; trace(g, moved(top, cx + dx, cy + dy, 0.97)); g.fillStyle = mix(base, '#2a1c0c', 0.3); g.fill();
  g.filter = `blur(${soft}px)`; trace(g, moved(top, cx + dx, cy + dy, 0.82, dx * 0.2, dy * 0.2)); g.fillStyle = base; g.fill();
  trace(g, moved(top, cx + dx, cy + dy, 0.55, dx * 0.5, dy * 0.5)); g.fillStyle = shade(base, 0.1); g.fill();
  for (let i = 0; i < 14; i++) { const x = cx + dx + (rng() - 0.5) * r * 1.4, y = cy + dy + (rng() - 0.5) * r * 1.4, s = r * (0.08 + rng() * 0.2); g.fillStyle = rng() < 0.55 ? 'rgba(40,30,16,0.12)' : 'rgba(225,215,190,0.1)'; g.beginPath(); g.ellipse(x, y, s, s * 0.6, rng() * 3, 0, 6.28); g.fill(); }
  g.filter = 'none';
  for (let i = 0; i < r * r * 0.4; i++) { const x = cx + dx + (rng() - 0.5) * r * 1.6, y = cy + dy + (rng() - 0.5) * r * 1.6; g.fillStyle = rng() < 0.55 ? 'rgba(20,12,4,0.13)' : 'rgba(215,200,165,0.1)'; g.fillRect(x, y, 1 + rng(), 1 + rng()); }
  // The crack net, across the face and running on down over the brow.
  for (let i = 0; i < (face.cracks ?? 3) * 1.6; i++) { const a = rng() * 6.28, p = wander(rng, cx + dx + (rng() - 0.5) * r * 1.1, cy + dy + (rng() - 0.5) * r * 1.1, a, 3 + Math.floor(rng() * 4), r * 0.13, 0.7); line(g, p, `rgba(236,228,206,${0.14 + rng() * 0.16})`, Math.max(0.5, o.ink * (0.4 + rng() * 0.3))); if (rng() < 0.4) line(g, wander(rng, ...p[1], a + (rng() < 0.5 ? 0.9 : -0.9), 2, r * 0.1, 0.6), 'rgba(236,228,206,0.14)', Math.max(0.4, o.ink * 0.35)); }
  for (let i = 0; i < Math.ceil((face.cracks ?? 3) / 2); i++) line(g, wander(rng, cx + (rng() - 0.5) * r, cy + (rng() - 0.5) * r, rng() * 6.28, 4, r * 0.1, 1), 'rgba(30,20,10,0.45)', o.ink * 0.6);
  // The brow: an ink line only where the top turns down into the wall (its edge facing away from the light), thickest in the
  // middle of that stretch and thinning to nothing at its ends, as a pen would draw it.
  const away = [-dx, -dy], n0 = Math.hypot(...away) || 1;
  for (let i = 0; i < top.length; i++) {
    const a = top[i], b = top[(i + 1) % top.length], mx = (a[0] + b[0]) / 2 - (cx + dx), my = (a[1] + b[1]) / 2 - (cy + dy), facing = (mx * away[0] + my * away[1]) / ((Math.hypot(mx, my) || 1) * n0);
    if (facing <= 0.15) continue;
    line(g, [a, b], `rgba(14,10,4,${0.35 + 0.5 * facing})`, o.ink * (0.4 + 1.1 * (facing - 0.15)));
  }
  // Snow on the top: soft-edged, blue-grey where it rounds away from the light, thinning to specks at its rim.
  snowPatch(g, rng, cx + dx * 1.3, cy + dy * 1.3, rx * (0.26 + 0.22 * o.snow), ry * (0.22 + 0.2 * o.snow), o);
  g.restore();
  trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 1.8; g.lineJoin = 'round'; g.stroke();
  if (o.wet > 0) { g.save(); trace(g, pts); g.clip(); g.fillStyle = `rgba(8,10,14,${0.15 * o.wet})`; g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6); g.restore(); }
}
// Moss creeping over something: dense small speckles in a patch, clipped by the caller.
function speckle(g, rng, cx, cy, rx, ry, count, colors, size) {
  for (let i = 0; i < count; i++) { const a = rng() * 6.28, t = Math.sqrt(rng()), x = cx + Math.cos(a) * rx * t, y = cy + Math.sin(a) * ry * t, s = size * (0.5 + rng()); g.fillStyle = pick(rng, colors); g.beginPath(); g.ellipse(x, y, s, s * (0.6 + rng() * 0.4), rng() * 3, 0, 6.28); g.fill(); }
}
const MOSS = { spring: ['#4a5c18', '#6a7a22', '#8c962e', '#2e3a10'], summer: ['#434e16', '#626c20', '#82852c', '#2a320e'], autumn: ['#5a5418', '#7a6c22', '#9a842e', '#38300e'], winter: ['#3e4426', '#585c34', '#727046', '#2a2e18'] };

// --- Blades ---------------------------------------------------------------------------------------------------------------------------
// A narrow pointed blade from (x, y) along a, bending: dark at its base, yellowing toward its tip, a pale line down its middle, inked.
function blade(g, x, y, a, len, wide, bend, base, tip, ink) {
  const c = Math.cos(a), s = Math.sin(a), bx = -s * bend * len, by = c * bend * len, ex = x + c * len + bx, ey = y + s * len + by, mx = x + c * len * 0.5 + bx * 0.35, my = y + s * len * 0.5 + by * 0.35;
  g.beginPath(); g.moveTo(x - s * wide, y + c * wide); g.quadraticCurveTo(mx - s * wide, my + c * wide, ex, ey); g.quadraticCurveTo(mx + s * wide, my - c * wide, x + s * wide, y - c * wide); g.closePath();
  const grad = g.createLinearGradient(x, y, ex, ey); grad.addColorStop(0, base); grad.addColorStop(1, tip);
  g.fillStyle = grad; g.fill(); g.strokeStyle = INK; g.lineWidth = ink; g.stroke();
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(mx, my, x + (ex - x) * 0.85, y + (ey - y) * 0.85); g.strokeStyle = 'rgba(220,226,140,0.35)'; g.lineWidth = Math.max(0.4, ink * 0.6); g.stroke();
}
const GREENS = { spring: ['#22300c', '#b4c444'], summer: ['#1e2a0a', '#aab83c'], autumn: ['#2a200a', '#c49a36'], winter: ['#20240e', '#8a8a52'] };

// --- Wood -----------------------------------------------------------------------------------------------------------------------------
// The end of a cut trunk or log: pale wood with growth rings, split by a crack, a dark line of bark round it.
function woodEnd(g, rng, cx, cy, rx, ry, o) {
  const pts = blob(rng, cx, cy, rx, ry, 14, 0.06);
  g.save(); trace(g, pts); g.clip();
  const grad = g.createRadialGradient(cx - rx * 0.2, cy - ry * 0.2, 0, cx, cy, Math.max(rx, ry)); grad.addColorStop(0, '#b89a6c'); grad.addColorStop(1, '#7e6040');
  g.fillStyle = grad; g.fillRect(cx - rx * 1.2, cy - ry * 1.2, rx * 2.4, ry * 2.4);
  for (let k = 1; k < 6; k++) { trace(g, moved(pts, cx, cy, k / 6, 0, 0)); g.strokeStyle = 'rgba(70,46,24,0.45)'; g.lineWidth = o.ink * 0.55; g.stroke(); }
  line(g, wander(rng, cx, cy, rng() * 6.28, 4, Math.max(rx, ry) * 0.26, 0.5), 'rgba(30,20,10,0.75)', o.ink * 0.8);
  snowPatch(g, rng, cx - rx * 0.15, cy - ry * 0.15, rx * (0.3 + 0.3 * o.snow), ry * (0.3 + 0.3 * o.snow), o);
  g.restore();
  trace(g, pts); g.strokeStyle = '#3a2814'; g.lineWidth = o.ink * 2.2; g.stroke(); trace(g, moved(pts, cx, cy, 1.04)); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
}
// Bark: dark brown plates running along a shape, clipped to it, darker toward the shadowed side.
function bark(g, rng, pts, along, o) {
  const [cx, cy] = centre(pts), r = reach(pts, [cx, cy]), c = Math.cos(along), s = Math.sin(along);
  g.save(); trace(g, pts); g.clip();
  const grad = g.createLinearGradient(cx + s * r, cy - c * r, cx - s * r, cy + c * r); grad.addColorStop(0, '#6a5034'); grad.addColorStop(0.5, '#4e3a24'); grad.addColorStop(1, '#2a1e12');
  g.fillStyle = grad; g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6);
  for (let i = 0; i < 46; i++) { const u = (rng() - 0.5) * r * 2.2, v = (rng() - 0.5) * r * 2.2, len = r * (0.15 + rng() * 0.35), x = cx + c * u - s * v, y = cy + s * u + c * v; line(g, [[x, y], [x + c * len, y + s * len]], rng() < 0.6 ? 'rgba(20,12,6,0.7)' : 'rgba(150,120,84,0.35)', o.ink * (0.6 + rng() * 0.8)); }
  if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.2 * o.wet})`; g.fillRect(cx - r * 1.3, cy - r * 1.3, r * 2.6, r * 2.6); }
  g.restore();
  trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke();
}

// --- Trees ----------------------------------------------------------------------------------------------------------------------------
// Crown colours per tree kind, by season: shadow, body, lit, bright.
const MAPLE = { spring: ['#34440e', '#62781e', '#8ea02c', '#b8b83a'], summer: ['#32380c', '#5e6418', '#8a8424', '#b2a030'], autumn: ['#4a0e08', '#8a2010', '#c03c18', '#e06a2a'], winter: LEAVES.winter };
const BIRCH = { spring: ['#4a5a16', '#7e9a2a', '#a8bc3a', '#d0d24a'], summer: ['#3e4c14', '#6e8424', '#9cae32', '#c4c442'], autumn: ['#6a4a0e', '#b08a1a', '#d8b02a', '#f0d040'], winter: LEAVES.winter };
const WILLOW = { spring: ['#3a4a14', '#6e8628', '#9cb03c', '#c6d05a'], summer: ['#36400f', '#647424', '#90a036', '#b8c050'], autumn: ['#5a4a10', '#9a8420', '#c4aa30', '#e0cc50'], winter: LEAVES.winter };
const BLOSSOM = { pink: ['#7a3a4a', '#b46a7c', '#dc9eac', '#f4d0d8'], white: ['#8a8070', '#c8c0b0', '#e8e2d6', '#faf6ee'] };
// Leafless in winter; snow then lies along the branches.
const bareSeason = (o) => o.season === 'winter';
// How many leaves a crown of radius s takes: per, per grid square of radius.
const crown = (s, o, per) => Math.round(per * (s / o.unit) ** 2);
// Branches from above: forking and thinning outward from the trunk. droop: thin strands hanging from the ends (willow);
// marks: dark bands across pale bark (birch); gnarl: how much each limb twists; one limb snapped short for a twisted old tree.
function bareBranches(g, rng, s, o, { color = '#5a4632', count = 7, reach = 0.38, width = 0.05, depth = 3, marks = false, droop = false, gnarl = 0.5 } = {}) {
  const tips = [], segs = [];
  const grow = (x, y, a, len, w, left) => {
    const p = wander(rng, x, y, a, 3, len / 3, gnarl), [ex, ey] = p[p.length - 1];
    for (let i = 1; i < p.length; i++) segs.push([p[i - 1], p[i], [p[i][0] + 0.5, p[i][1] + 0.5]]);
    line(g, p, INK, w + o.ink * 1.4); line(g, p, color, w); line(g, p.map(([px, py]) => [px - w * 0.2, py - w * 0.2]), 'rgba(235,225,205,0.35)', w * 0.3);
    // Snow along the top of the thicker limbs only, broken where it has slid off, the bark showing beside it.
    if (o.snow > 0 && w > o.ink * 1.5) for (let i = 1; i < p.length; i++) if (rng() < 0.65) line(g, [p[i - 1], p[i]].map(([px, py]) => [px - w * 0.2, py - w * 0.25]), `rgba(228,234,240,${0.55 + 0.25 * rng()})`, Math.max(o.ink * 0.5, w * 0.28 * o.snow));
    if (marks) for (let i = 1; i < p.length; i++) if (rng() < 0.6) { const [px, py] = p[i], q = p[i - 1], d = Math.atan2(py - q[1], px - q[0]) + Math.PI / 2; line(g, [[px - Math.cos(d) * w * 0.5, py - Math.sin(d) * w * 0.5], [px + Math.cos(d) * w * 0.5, py + Math.sin(d) * w * 0.5]], 'rgba(20,16,12,0.85)', o.ink * 0.9); }
    if (left > 0) for (const t of [-0.45, 0.45]) grow(ex, ey, a + t + (rng() - 0.5) * 0.3, len * 0.68, w * 0.62, left - 1); else tips.push([ex, ey, a]);
  };
  for (let i = 0; i < count; i++) grow(0, 0, (i / count) * 6.28 + rng() * 0.4, s * reach * (gnarl > 0.8 && i === 0 ? 0.45 : 1), o.unit * width, gnarl > 0.8 && i === 0 ? 0 : depth);
  if (droop) for (const [x, y, a] of tips) for (let k = 0; k < 3; k++) line(g, wander(rng, x, y, a + (rng() - 0.5) * 0.8, 4, s * 0.06, 0.3), 'rgba(110,96,60,0.8)', o.ink * 0.8);
  return segs;
}
// A tree's trunk at its foot, seen from above once its crown is out of the way (a token walking under it): the bark of the
// trunk going up, darker toward its middle, and roots flaring out into the ground. Drawn under tokens; the crown over them.
const TRUNKS = { oak: ['#5a4430', 0.15, 6], maple: ['#5e4834', 0.13, 5], birch: ['#d8d2c2', 0.09, 4], willow: ['#56462e', 0.15, 7], fruitTree: ['#5a4430', 0.1, 4], blossom: ['#46302a', 0.1, 4], pine: ['#5e3e26', 0.11, 5], spruce: ['#4a3422', 0.1, 5], palm: ['#7a6040', 0.09, 0], deadTree: ['#6e665a', 0.13, 5] };
function paintTrunk(g, rng, s, o, kind) {
  const [color, width, roots] = TRUNKS[kind] ?? TRUNKS.oak, R = s * width * 2;
  for (let i = 0; i < roots; i++) { const a = (i / roots) * 6.28 + rng() * 0.6, p = wander(rng, Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.6, a, 5, R * (0.3 + rng() * 0.25), 0.6), w0 = R * (0.38 - i * 0.025);
    // Tapering as it runs out: each step thinner, ending in a point.
    for (const pass of [0, 1, 2]) for (let j = 1; j < p.length; j++) { const w = w0 * (1 - (j - 1) / p.length) ** 1.3; line(g, [p[j - 1], p[j]], pass === 0 ? INK : pass === 1 ? shade(color, -0.15) : 'rgba(200,170,130,0.3)', pass === 0 ? w + o.ink * 1.6 : pass === 1 ? w : w * 0.3); } }
  const pts = blob(rng, 0, 0, R, R * 0.95, 18, 0.12);
  g.save(); trace(g, pts); g.clip();
  const tg = g.createRadialGradient(-R * 0.35, -R * 0.35, 0, 0, 0, R * 1.1); tg.addColorStop(0, shade(color, 0.12)); tg.addColorStop(0.6, color); tg.addColorStop(1, shade(color, -0.45)); g.fillStyle = tg; g.fillRect(-R * 1.2, -R * 1.2, R * 2.4, R * 2.4);
  if (kind === 'palm') for (let k = 1; k < 5; k++) { g.beginPath(); g.arc(0, 0, R * k / 5, 0, 6.28); g.strokeStyle = 'rgba(40,26,12,0.55)'; g.lineWidth = o.ink * 0.8; g.stroke(); }
  else if (kind === 'birch') for (let i = 0; i < 7; i++) { const a = rng() * 6.28, d = R * (0.3 + rng() * 0.6); line(g, [[Math.cos(a) * d, Math.sin(a) * d], [Math.cos(a + 0.4) * d, Math.sin(a + 0.4) * d]], 'rgba(20,16,12,0.85)', o.ink * 1.4); }
  else for (let i = 0; i < 30; i++) { const a = rng() * 6.28, d0 = R * rng() * 0.8, d1 = d0 + R * (0.15 + rng() * 0.3); line(g, [[Math.cos(a) * d0, Math.sin(a) * d0], [Math.cos(a + 0.05) * d1, Math.sin(a + 0.05) * d1]], rng() < 0.65 ? 'rgba(14,8,2,0.6)' : 'rgba(190,160,120,0.3)', o.ink * (0.6 + rng())); }
  snowPatch(g, rng, -R * 0.3, -R * 0.35, R * 0.4 * o.snow, R * 0.25 * o.snow, o);
  g.restore(); trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 1.4; g.stroke();
}
function bareTree(g, rng, s, o, options = {}) {
  // Its shadow is its branches', not a crown's.
  const segs = bareBranches(g, rng, s, o, options);
  woodEnd(g, rng, 0, 0, s * 0.12, s * 0.12, o);
  return segs;
}

// --- Water ----------------------------------------------------------------------------------------------------------------------------
// The outline of each kind holding water, drawn the same by its painter and by waterOutline, so the water engine's water fills exactly
// what the painted rim goes round. Always the first draws from the kind's seeded random.
const WATER_SHAPES = {
  puddle: (rng, s, o) => { const grow = 1 + (o.wet ?? 0) * 0.35; return blob(rng, 0, 0, s * 0.9 * grow, s * 0.58 * grow, 16, 0.22); },
  cavePool: (rng, s) => blob(rng, 0, 0, s * 0.9, s * 0.65, 18, 0.2),
};
// A painted ring round water: from `outer` times its outline in to the outline, then a darker line where it meets the water.
function rim(g, pts, outer, fill, edge, o) {
  g.save(); trace(g, moved(pts, 0, 0, outer)); trace(g, pts, false); g.fillStyle = fill; g.fill('evenodd'); g.restore();
  trace(g, pts); g.strokeStyle = edge; g.lineWidth = o.ink * 2.2; g.stroke();
}
/**
 * Where a decoration's water lies on the map (pure), for the water engine: its outline as flat x, y pairs in scene pixels, turned and
 * flipped as the decoration is drawn (flipped across, then turned), or null for a kind with no water. `look` as for paintDecor
 * (a wet spell grows a puddle).
 */
export function waterOutline(d, grid, look = {}) {
  const shape = WATER_SHAPES[d?.kind]; if (!shape) return null;
  const s = Math.max(8, Math.ceil(d.size * grid)) / 2, pts = shape(seeded(d.seed), s, look), c = Math.cos(d.turn ?? 0), n = Math.sin(d.turn ?? 0);
  // The painter traces a smooth line through the points' midpoints: a few more points along each stretch keep the water on it.
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], m0 = [(pts[(i + pts.length - 1) % pts.length][0] + a[0]) / 2, (pts[(i + pts.length - 1) % pts.length][1] + a[1]) / 2], m1 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    for (let k = 0; k < 4; k++) { const t = k / 4, x = (1 - t) ** 2 * m0[0] + 2 * (1 - t) * t * a[0] + t * t * m1[0], y = (1 - t) ** 2 * m0[1] + 2 * (1 - t) * t * a[1] + t * t * m1[1], fx = d.flip ? -x : x; out.push(d.x + fx * c - y * n, d.y + fx * n + y * c); }
  }
  return out;
}

// Each kind: how tall it stands (for its shadow), whether it lies flat, its usual size in grid squares, and its painter. A painter
// draws centred on (0, 0) within radius s, and returns outlines for its shadow (or nothing for a flat kind).
const KINDS = {
  rock: { label: 'Rocks', size: 0.4, height: 0.35, paint(g, s, rng, o) {
    const pts = blob(rng, 0, 0, s * 0.92, s * 0.72, 11, 0.18); standing(g, rng, pts, pick(rng, stonesOf(o)), o, { lift: 0.16, cracks: 2, ledges: 0 }); return [pts];
  } },
  boulder: { label: 'Boulders', size: 1.3, height: 1.2, paint(g, s, rng, o) {
    const pts = blob(rng, 0, 0, s * 0.95, s * 0.8, 14, 0.13); standing(g, rng, pts, pick(rng, stonesOf(o)), o, { lift: 0.3, cracks: 6, ledges: Math.floor(rng() * 2), ink: 1.2 });
    return [pts];
  } },
  pebbles: { label: 'Pebbles', size: 0.5, height: 0.06, paint(g, s, rng, o) {
    const out = [];
    for (let i = 0; i < 8; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.7, r = s * (0.08 + rng() * 0.1), pts = blob(rng, Math.cos(a) * d, Math.sin(a) * d, r, r * 0.75, 9, 0.15); stone(g, rng, pts, pick(rng, stonesOf(o)), o, { cracks: 0, ledges: 0, ink: 0.8 }); out.push(pts); }
    return out;
  } },
  bush: { label: 'Bushes', size: 0.9, height: 0.5, paint(g, s, rng, o) {
    const hull = leafMass(g, rng, s * 0.88, o, { leafLen: o.unit * 0.15, count: Math.round(85 * (s / (o.unit * 0.45)) ** 2), lobes: 6, rough: 0.2 });
    if (o.season === 'summer' || o.season === 'autumn') for (let i = 0; i < 7; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.65, x = Math.cos(a) * d, y = Math.sin(a) * d, r = o.unit * 0.022; g.fillStyle = '#7a1e18'; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.6; g.stroke(); g.fillStyle = 'rgba(255,220,200,0.6)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, 6.28); g.fill(); }
    return [hull];
  } },
  oak: { label: 'Oaks', size: 2.6, height: 2.4, tree: true, paint(g, s, rng, o) {
    if (bareSeason(o)) return bareTree(g, rng, s, o);
    return [leafMass(g, rng, s * 0.92, o, { leafLen: o.unit * 0.19, count: crown(s, o, 300), lobes: 9, rough: 0.14, shape: 'oak', wide: 0.6 })];
  } },
  maple: { label: 'Maples', size: 2.2, height: 2.2, tree: true, paint(g, s, rng, o) {
    if (bareSeason(o)) return bareTree(g, rng, s, o, { color: '#4e3c2c' });
    return [leafMass(g, rng, s * 0.92, o, { leafLen: o.unit * 0.16, count: crown(s, o, 300), lobes: 7, rough: 0.2, colors: MAPLE[o.season], shape: 'maple' })];
  } },
  birch: { label: 'Birches', size: 1.6, height: 2.2, tree: true, paint(g, s, rng, o) {
    // Small pale leaves in an airy crown, the white bark of its branches showing through.
    const branches = () => bareBranches(g, rng, s, o, { color: '#e2dccc', count: 6, reach: 0.4, width: 0.035, depth: 2, marks: true });
    if (bareSeason(o)) { const segs = branches(); woodEnd(g, rng, 0, 0, s * 0.1, s * 0.1, o); return segs; }
    return [leafMass(g, rng, s * 0.9, o, { leafLen: o.unit * 0.11, count: crown(s, o, 520), lobes: 10, rough: 0.24, wide: 0.42, colors: BIRCH[o.season], bed: 0.55, under: branches, shape: 'birch' })];
  } },
  willow: { label: 'Willows', size: 2.6, height: 2.0, tree: true, paint(g, s, rng, o) {
    // Long narrow leaves hanging from the middle outward, so the crown streaks from its centre to a soft fringe.
    if (bareSeason(o)) return bareTree(g, rng, s, o, { color: '#6a5a3a', count: 10, reach: 0.44, width: 0.03, depth: 2, droop: true });
    return [leafMass(g, rng, s * 0.95, o, { leafLen: o.unit * 0.22, count: crown(s, o, 420), lobes: 12, rough: 0.12, wide: 0.22, colors: WILLOW[o.season], bed: 0.85, outward: 0.92, shape: 'willow' })];
  } },
  fruitTree: { label: 'Fruit trees', size: 1.8, height: 1.8, tree: true, paint(g, s, rng, o) {
    if (bareSeason(o)) return bareTree(g, rng, s, o, { count: 6, reach: 0.36 });
    const hull = leafMass(g, rng, s * 0.9, o, { leafLen: o.unit * 0.13, count: crown(s, o, 430), lobes: 8, rough: 0.16, colors: LEAVES[o.season === 'autumn' ? 'summer' : o.season], lightFrom: o.season === 'spring' ? BLOSSOM.white : null, mixIn: 0.35, lightShape: 'flower' });
    // Fruit: red and yellow apples in late summer and autumn, lying on the crown.
    if (o.season === 'summer' || o.season === 'autumn') for (let i = 0; i < 16; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.75, x = Math.cos(a) * d, y = Math.sin(a) * d, r = o.unit * 0.035; g.fillStyle = pick(rng, ['#9a2218', '#b8401c', '#c89a2a']); g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.7; g.stroke(); g.fillStyle = 'rgba(255,230,200,0.55)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, 6.28); g.fill(); }
    return [hull];
  } },
  blossom: { label: 'Blossom trees', size: 1.9, height: 1.9, tree: true, paint(g, s, rng, o) {
    if (bareSeason(o)) return bareTree(g, rng, s, o, { color: '#3e2a24', count: 6, reach: 0.38 });
    const spring = o.season === 'spring';
    const hull = leafMass(g, rng, s * 0.92, o, { leafLen: o.unit * 0.12, count: crown(s, o, 470), lobes: 9, rough: 0.18, wide: 0.72, colors: spring ? BLOSSOM.pink : MAPLE[o.season] ?? LEAVES[o.season], lightFrom: spring ? LEAVES.spring : null, mixIn: 0.18, shape: spring ? 'flower' : 'oval', lightShape: 'oval' });
    // Petals fallen round it in spring.
    if (spring) for (let i = 0; i < 30; i++) { const a = rng() * 6.28, d = s * (0.85 + rng() * 0.25), x = Math.cos(a) * d, y = Math.sin(a) * d; leaf(g, x, y, o.unit * 0.04, rng() * 6.28, pick(rng, BLOSSOM.pink.slice(2)), o.ink * 0.4, 0.8); }
    return [hull];
  } },
  pine: { label: 'Pines', size: 1.9, height: 2.8, tree: true, paint(g, s, rng, o) {
    // Tufts of long needles, each a small burst, packed into a round crown: dark below, yellow-green on the lit tips.
    const set = ['#14220e', '#304e1e', '#527432', '#8aa842'], R = s * 0.92, k0 = rng() * 50, hull = blob(rng, 0, 0, R, R, 18, 0.1);
    trace(g, moved(hull, 0, 0, 0.92)); g.fillStyle = '#0e1a0a'; g.fill();
    const tufts = []; for (let i = 0; i < crown(s, o, 120); i++) { const a = rng() * 6.28, t = Math.sqrt(rng()); tufts.push([Math.cos(a) * t * R * 0.86, Math.sin(a) * t * R * 0.86, t]); }
    tufts.sort((p, q) => q[2] - p[2]);
    for (const [x, y, t] of tufts) {
      const lit = towardLight(x, y, R) * 0.45 + (noise(x / (R * 0.35) + k0, y / (R * 0.35)) - 0.5) * 1.4 + (1 - t) * 0.3 - t * t * 0.5, color = lit < -0.3 ? set[1] : lit < 0.25 ? set[2] : set[3], snowy = o.snow > 0 && lit > 0.5 - o.snow * 0.5, len = o.unit * (0.13 + rng() * 0.06), n = 14, turn = rng() * 6.28;
      for (let k = 0; k < n; k++) { const a = turn + (k / n) * 6.28 + (rng() - 0.5) * 0.3, l = len * (0.7 + rng() * 0.3), p = [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]]; line(g, p, INK, o.ink * 1.7); line(g, p, snowy && k % 2 ? '#dfe5e8' : mix(color, shade(color, (rng() - 0.5) * 0.4), 0.5), o.ink * 1); }
    }
    return [hull];
  } },
  spruce: { label: 'Spruces', size: 1.6, height: 3.0, tree: true, paint(g, s, rng, o) {
    // Seen from above, a spruce is a star of tiers, each narrower and lighter toward the tip at its centre: blue-green and dense.
    const set = ['#0a1612', '#3c6250'], out = [];
    g.fillStyle = '#08120e'; trace(g, blob(rng, 0, 0, s * 0.82, s * 0.82, 16, 0.08)); g.fill();
    for (let tier = 0; tier < 5; tier++) {
      const r = s * (0.95 - tier * 0.17), n = 20 - tier * 2, sx = -tier * s * 0.035, sy = -tier * s * 0.045;
      for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rng() * 0.3 + tier; blade(g, sx, sy, a, r * (0.85 + rng() * 0.2), o.unit * 0.045, (rng() - 0.5) * 0.2, shade(set[0], tier * 0.05), shade(set[1], tier * 0.08), o.ink * 0.7); }
      if (o.snow > 0) for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + tier + 0.3, d = r * 0.62; if (towardLight(Math.cos(a), Math.sin(a), 1) < -0.2 || rng() < 0.4) continue; g.save(); g.filter = `blur(${Math.max(0.6, r * 0.02)}px)`; g.fillStyle = `rgba(226,233,239,${0.45 + 0.25 * rng()})`; g.beginPath(); g.ellipse(sx + Math.cos(a) * d, sy + Math.sin(a) * d, r * 0.13 * o.snow, r * 0.04 * o.snow, a, 0, 6.28); g.fill(); g.restore(); }
      if (!tier) { const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.28; pts.push([Math.cos(a) * r * 0.95, Math.sin(a) * r * 0.95]); } out.push(pts); }
    }
    return out;
  } },
  palm: { label: 'Palms', size: 2.0, height: 2.6, tree: true, paint(g, s, rng, o) {
    // Fronds from a rough brown crown: each a bending rib with narrow leaflets on both sides, dark at the base, yellowing out.
    const n = 7 + Math.floor(rng() * 3), turn = rng() * 6.28, base = '#1e2e0e', tip = o.season === 'autumn' ? '#a89a3a' : '#8aa83a', out = [], fronds = [];
    for (let i = 0; i < n; i++) fronds.push([turn + (i / n) * 6.28 + (rng() - 0.5) * 0.3, s * (0.82 + rng() * 0.16), (rng() - 0.5) * 0.5, rng() < 0.15]);
    fronds.sort((p, q) => towardLight(Math.cos(p[0]), Math.sin(p[0]), 1) - towardLight(Math.cos(q[0]), Math.sin(q[0]), 1));
    for (const [a, len, bend, dead] of fronds) {
      const c = Math.cos(a), sn = Math.sin(a), at = (t) => [c * len * t - sn * bend * len * t * t, sn * len * t + c * bend * len * t * t];
      for (let k = 2; k <= 18; k++) { const t = k / 19, [x, y] = at(t), [nx, ny] = at(t + 0.01), dir = Math.atan2(ny - y, nx - x), l = len * 0.3 * Math.sin(t * Math.PI * 0.85 + 0.15); for (const side of [-1, 1]) leaf(g, x, y, l, dir + side * 1.05 + 0.25 * side, dead ? mix('#6a5228', '#a88a4a', t) : mix(base, tip, 0.25 + t * 0.7 + (rng() - 0.5) * 0.15), o.ink * 0.6, 0.16); }
      line(g, Array.from({ length: 10 }, (_, k) => at(k / 9)), INK, o.ink * 2.2); line(g, Array.from({ length: 10 }, (_, k) => at(k / 9)), dead ? '#8a7040' : '#6a7a2a', o.ink * 1.1);
      out.push([[0, 0], at(0.5).map((v, j) => v + (j ? c : -sn) * len * 0.22), at(1), at(0.5).map((v, j) => v - (j ? c : -sn) * len * 0.22)]);
    }
    const husk = blob(rng, 0, 0, s * 0.12, s * 0.12, 10, 0.25); trace(g, husk); g.fillStyle = '#5a4428'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    return out;
  } },
  deadTree: { label: 'Dead trees', size: 2.0, height: 2.0, tree: true, paint(g, s, rng, o) {
    // Grey and gnarled, bare in every season, one limb snapped short.
    return bareTree(g, rng, s, o, { color: '#6e665a', count: 5, reach: 0.42, width: 0.06, depth: 3, gnarl: 1.0 });
  } },
  stump: { label: 'Stumps', size: 0.8, height: 0.3, paint(g, s, rng, o) {
    // The trunk flaring into roots: one outline bulging out at each root, bark grain running outward along them; the cut top with
    // rings, or hollow and dark inside a ring of pale rotten wood.
    const roots = 4 + Math.floor(rng() * 4), a0 = rng() * 6.28, lens = Array.from({ length: roots }, () => 0.35 + rng() * 0.65), outer = [];
    for (let i = 0; i < 72; i++) { const a = (i / 72) * 6.28, u = ((a - a0) / 6.28 * roots % 1 + 1) % 1, which = Math.floor((((a - a0) / 6.28 * roots) % roots + roots) % roots), flare = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 4), rr = s * (0.52 + 0.46 * flare * lens[which]) * (1 + (noise(a * 3, 2) - 0.5) * 0.08); outer.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    g.save(); poly(g, outer); g.clip();
    const bg = g.createRadialGradient(-s * 0.2, -s * 0.2, 0, 0, 0, s); bg.addColorStop(0, '#6e563a'); bg.addColorStop(0.6, '#4a3824'); bg.addColorStop(1, '#2a1e12'); g.fillStyle = bg; g.fillRect(-s, -s, s * 2, s * 2);
    for (let i = 0; i < 110; i++) { const a = rng() * 6.28, d0 = s * (0.35 + rng() * 0.45), d1 = d0 + s * (0.12 + rng() * 0.35), b = a + (rng() - 0.5) * 0.1; line(g, [[Math.cos(a) * d0, Math.sin(a) * d0], [Math.cos(b) * d1, Math.sin(b) * d1]], rng() < 0.65 ? 'rgba(14,8,2,0.75)' : 'rgba(170,140,100,0.4)', o.ink * (0.8 + rng() * 1.2)); }
    if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.2 * o.wet})`; g.fillRect(-s, -s, s * 2, s * 2); }
    g.restore(); poly(g, outer); g.strokeStyle = INK; g.lineWidth = o.ink * 1.4; g.lineJoin = 'round'; g.stroke();
    const top = blob(rng, -s * 0.02, -s * 0.02, s * 0.44, s * 0.42, 16, 0.08);
    if (rng() < 0.45) { trace(g, top); g.fillStyle = '#8e7656'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 1.2; g.stroke(); for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.28 + rng() * 0.2; line(g, [[Math.cos(a) * s * 0.3 - s * 0.02, Math.sin(a) * s * 0.3 - s * 0.02], [Math.cos(a) * s * 0.46 - s * 0.02, Math.sin(a) * s * 0.46 - s * 0.02]], 'rgba(30,20,10,0.7)', o.ink * 0.8); } const hole =moved(top, -s * 0.02, -s * 0.02, 0.8); trace(g, hole); g.fillStyle = '#1a0c06'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke(); }
    else woodEnd(g, rng, -s * 0.02, -s * 0.02, s * 0.42, s * 0.4, o);
    if (o.season !== 'winter' && rng() < 0.6) for (let i = 0; i < 3; i++) { const a = rng() * 6.28, x = Math.cos(a) * s * 0.58, y = Math.sin(a) * s * 0.58, r = o.unit * 0.03; g.fillStyle = '#8a3a22'; g.beginPath(); g.arc(x, y, r, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.6; g.stroke(); }
    return [outer];
  } },
  log: { label: 'Fallen logs', size: 1.8, height: 0.35, paint(g, s, rng, o) {
    const len = s * 0.92, w = s * 0.2, pts = [];
    for (let i = 0; i <= 10; i++) pts.push([-len + 2 * len * (i / 10), -w * (1 + (noise(i * 0.7, 1) - 0.5) * 0.3)]);
    for (let i = 10; i >= 0; i--) pts.push([-len + 2 * len * (i / 10), w * (1 + (noise(i * 0.7, 5) - 0.5) * 0.3)]);
    bark(g, rng, pts, 0, o);
    if (o.season !== 'winter') { g.save(); trace(g, pts); g.clip(); speckle(g, rng, -len * 0.3, w * 0.35, len * 0.4, w * 0.6, 120, MOSS[o.season] ?? MOSS.summer, o.unit * 0.012); g.restore(); }
    for (let i = 0; i < 3; i++) { const x = -len * 0.1 + i * o.unit * 0.12, f = blob(rng, x, w * 1.02, o.unit * 0.07, o.unit * 0.045, 9, 0.1); trace(g, f); g.fillStyle = mix('#a8885a', '#c8aa72', rng()); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.6; g.stroke(); }
    if (o.snow > 0) { g.save(); trace(g, pts); g.clip(); for (let i = 0; i < 5; i++) snowPatch(g, rng, -len * 0.75 + i * len * 0.35 + (rng() - 0.5) * len * 0.1, -w * 0.45, len * 0.2, w * 0.45 * o.snow, o); g.restore(); }
    woodEnd(g, rng, len, 0, w * 0.85, w * 1.02, o);
    return [pts];
  } },
  puddle: { label: 'Puddles', size: 1.1, height: 0, flat: true, water: 'still', paint(g, s, rng, o) {
    const pts = WATER_SHAPES.puddle(rng, s, o);
    // The water itself is the water engine's (o.liveWater): only the mud round it is painted, dark and wet at the water's edge.
    if (o.liveWater) { rim(g, pts, 1.14, 'rgba(40,30,16,0.6)', 'rgba(20,14,8,0.5)', o); return null; }
    // A dark muddy margin, then water: deep teal, lighter swirls, a soft pale rim where it meets the mud.
    g.save(); trace(g, moved(pts, 0, 0, 1.12)); g.fillStyle = 'rgba(40,30,16,0.55)'; g.fill(); g.restore();
    g.save(); trace(g, pts); g.clip();
    if (o.frozen) { const ig = g.createLinearGradient(-s, -s, s, s); ig.addColorStop(0, '#b8ccd2'); ig.addColorStop(1, '#7c969e'); g.fillStyle = ig; g.fillRect(-s * 2, -s * 2, s * 4, s * 4); for (let i = 0; i < 6; i++) line(g, wander(rng, (rng() - 0.5) * s, (rng() - 0.5) * s * 0.6, rng() * 6.28, 5, s * 0.15, 1), 'rgba(250,252,255,0.6)', o.ink * 0.6); }
    else {
      const wg = g.createRadialGradient(0, 0, 0, 0, 0, s); wg.addColorStop(0, '#0f2a28'); wg.addColorStop(0.7, '#173a36'); wg.addColorStop(1, '#244a40'); g.fillStyle = wg; g.fillRect(-s * 2, -s * 2, s * 4, s * 4);
      for (let i = 0; i < 14; i++) line(g, wander(rng, (rng() - 0.5) * s * 1.4, (rng() - 0.5) * s * 0.8, rng() * 6.28, 5, s * 0.1, 0.8), 'rgba(170,210,200,0.16)', o.ink * (0.6 + rng()));
      g.strokeStyle = 'rgba(220,236,232,0.45)'; g.lineWidth = o.ink; g.beginPath(); g.ellipse(-s * 0.2, -s * 0.12, s * 0.35, s * 0.08, -0.1, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    }
    trace(g, pts); g.strokeStyle = 'rgba(180,200,180,0.35)'; g.lineWidth = o.ink * 3; g.stroke();
    g.restore();
    trace(g, pts); g.strokeStyle = 'rgba(14,11,6,0.7)'; g.lineWidth = o.ink; g.stroke();
    return null;
  } },
  mushrooms: { label: 'Mushrooms', size: 0.4, height: 0.12, paint(g, s, rng, o) {
    const out = [], red = rng() < 0.5, base = red ? '#8e2a1e' : '#9a7a4e';
    for (let i = 0; i < 6; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.6, r = s * (0.12 + rng() * 0.14), x = Math.cos(a) * d, y = Math.sin(a) * d, pts = blob(rng, x, y, r, r, 12, 0.05);
      g.save(); trace(g, pts); g.clip(); const cg = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r * 1.1); cg.addColorStop(0, shade(base, 0.35)); cg.addColorStop(1, shade(base, -0.45)); g.fillStyle = cg; g.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
      if (red) for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(236,226,200,0.85)'; g.beginPath(); g.arc(x + (rng() - 0.5) * r * 1.2, y + (rng() - 0.5) * r * 1.2, r * 0.12, 0, 6.28); g.fill(); }
      snowPatch(g, rng, x - r * 0.25, y - r * 0.25, r * 0.55 * o.snow, r * 0.45 * o.snow, o);
      g.restore(); trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 0.7; g.stroke(); out.push(pts); }
    return out;
  } },
  fairyRing: { label: 'Mushroom rings', size: 1.6, height: 0.06, paint(g, s, rng, o) {
    const out = [], n = 18, glow = o.night;
    g.save(); g.globalAlpha = 0.45; speckle(g, rng, 0, 0, s * 0.82, s * 0.82, 220, ['#5a6a1c', '#6e7a26', '#3e4a12'], o.unit * 0.012); g.restore();
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.28 + rng() * 0.2, d = s * (0.78 + (rng() - 0.5) * 0.1), r = o.unit * (0.035 + rng() * 0.025), x = Math.cos(a) * d, y = Math.sin(a) * d, pts = blob(rng, x, y, r, r, 9, 0.06);
      if (glow) { const gg = g.createRadialGradient(x, y, 0, x, y, r * 3); gg.addColorStop(0, 'rgba(150,240,190,0.45)'); gg.addColorStop(1, 'rgba(150,240,190,0)'); g.fillStyle = gg; g.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); }
      g.save(); trace(g, pts); g.clip(); const cg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r); cg.addColorStop(0, glow ? '#d8ffe4' : '#e2d8bc'); cg.addColorStop(1, glow ? '#5aa078' : '#8c7a5a'); g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 0.6; g.stroke(); out.push(pts); }
    return out;
  } },
  moss: { label: 'Moss', size: 1.2, height: 0, flat: true, paint(g, s, rng, o) {
    const set = MOSS[o.season] ?? MOSS.summer;
    for (let i = 0; i < 5; i++) { const a = rng() * 6.28, d = rng() * s * 0.45; speckle(g, rng, Math.cos(a) * d, Math.sin(a) * d, s * (0.35 + rng() * 0.2), s * (0.25 + rng() * 0.15), 260, set, o.unit * 0.014); }
    return null;
  } },
  fern: { label: 'Ferns', size: 0.8, height: 0.3, paint(g, s, rng, o) {
    const [base, tip] = GREENS[o.season] ?? GREENS.summer, out = [], n = 7;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.28 + rng() * 0.5, len = s * (0.75 + rng() * 0.25), bend = (rng() - 0.5) * 0.5, c = Math.cos(a), sn = Math.sin(a), at = (t) => [c * len * t - sn * bend * len * t * t, sn * len * t + c * bend * len * t * t];
      for (let k = 1; k <= 11; k++) { const t = k / 12, [x, y] = at(t), w = Math.sin(t * Math.PI * 0.9 + 0.2) * len * 0.22, dir = Math.atan2(at(t + 0.01)[1] - y, at(t + 0.01)[0] - x); for (const side of [-1, 1]) leaf(g, x, y, w, dir + side * 1.1, mix(base, tip, 0.35 + t * 0.6 + (rng() - 0.5) * 0.15), o.ink * 0.55); }
      line(g, Array.from({ length: 9 }, (_, k) => at(k / 8)), shade(base, -0.2), o.ink * 0.9);
      out.push([[0, 0], at(0.5).map((v, j) => v + (j ? c : -sn) * len * 0.18), at(1), at(0.5).map((v, j) => v - (j ? c : -sn) * len * 0.18)]);
    }
    return out;
  } },
  agave: { label: 'Spiky plants', size: 0.8, height: 0.35, paint(g, s, rng, o) {
    const [base, tip] = GREENS[o.season] ?? GREENS.summer, n = 24 + Math.floor(rng() * 8), blades = [];
    for (let i = 0; i < n; i++) blades.push([rng() * 6.28, s * (0.35 + rng() * 0.65)]);
    blades.sort((p, q) => q[1] - p[1]);
    for (const [a, len] of blades) blade(g, 0, 0, a, len, o.unit * 0.05, (rng() - 0.5) * 0.3, base, tip, o.ink * 0.95);
    return [blob(rng, 0, 0, s * 0.6, s * 0.6, 10, 0.3)];
  } },
  reeds: { label: 'Reeds', size: 0.7, height: 0.8, paint(g, s, rng, o) {
    const [base, tip] = o.season === 'winter' || o.season === 'autumn' ? ['#3a2e14', '#a8904e'] : ['#1e2a0c', '#90a03a'], out = [];
    for (let i = 0; i < 22; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.35, x = Math.cos(a) * d, y = Math.sin(a) * d, aim = -Math.PI / 2 + (rng() - 0.5) * 2.6, len = s * (0.5 + rng() * 0.45); blade(g, x, y, aim, len, o.unit * 0.02, (rng() - 0.5) * 0.4, base, tip, o.ink * 0.55);
      if (rng() < 0.3) { const tx = x + Math.cos(aim) * len * 0.8, ty = y + Math.sin(aim) * len * 0.8; g.save(); g.translate(tx, ty); g.rotate(aim); g.fillStyle = '#4a2e16'; g.beginPath(); g.ellipse(0, 0, o.unit * 0.05, o.unit * 0.018, 0, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.6; g.stroke(); g.restore(); }
      out.push([[x, y], [x + Math.cos(aim) * len, y + Math.sin(aim) * len], [x + 1, y + 1]]); }
    return out;
  } },
  flowers: { label: 'Wildflowers', size: 0.8, height: 0, flat: true, paint(g, s, rng, o) {
    if (o.season === 'winter') return null;
    const sets = o.season === 'autumn' ? ['#c8963a', '#a8582a'] : ['#e8e2c8', '#e0c84a', '#c87a9a', '#9a8ad0'];
    speckle(g, rng, 0, 0, s * 0.8, s * 0.8, 140, (MOSS[o.season] ?? MOSS.summer), o.unit * 0.012);
    for (let i = 0; i < 26; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.8, x = Math.cos(a) * d, y = Math.sin(a) * d, r = o.unit * (0.012 + rng() * 0.008), color = pick(rng, sets);
      for (let k = 0; k < 5; k++) { g.fillStyle = color; g.beginPath(); g.arc(x + Math.cos(k * 1.256) * r, y + Math.sin(k * 1.256) * r, r * 0.8, 0, 6.28); g.fill(); }
      g.fillStyle = '#b07a18'; g.beginPath(); g.arc(x, y, r * 0.5, 0, 6.28); g.fill(); }
    return null;
  } },
  grass: { label: 'Grass tufts', size: 0.5, height: 0.2, paint(g, s, rng, o) {
    const [base, tip] = o.season === 'winter' ? ['#3a3a1e', '#8a8656'] : o.season === 'autumn' ? ['#3a3010', '#a8963e'] : (GREENS[o.season] ?? GREENS.summer), out = [];
    for (let i = 0; i < 26; i++) { const a = rng() * 6.28, len = s * (0.45 + rng() * 0.5); blade(g, (rng() - 0.5) * s * 0.15, (rng() - 0.5) * s * 0.15, a, len, o.unit * 0.022, (rng() - 0.5) * 0.4, base, tip, o.ink * 0.45); out.push([[0, 0], [Math.cos(a) * len, Math.sin(a) * len], [1, 1]]); }
    return out;
  } },
  leaves: { label: 'Leaf litter', size: 1.0, height: 0, flat: true, paint(g, s, rng, o) {
    const sets = o.season === 'autumn' ? ['#9a4a1a', '#b8782a', '#7a2e12', '#a8862e'] : ['#4e3e20', '#665230', '#3e3018', '#5e5a2a'], count = o.season === 'autumn' ? 70 : 34;
    for (let i = 0; i < count; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.85; leaf(g, Math.cos(a) * d, Math.sin(a) * d, o.unit * (0.06 + rng() * 0.04), rng() * 6.28, pick(rng, sets), o.ink * 0.6); }
    return null;
  } },
  bones: { label: 'Bones', size: 0.6, height: 0.05, paint(g, s, rng, o) {
    const out = [], boneFill = (x0, y0, x1, y1) => { const bg = g.createLinearGradient(x0 - s * 0.1, y0 - s * 0.1, x1 + s * 0.1, y1 + s * 0.1); bg.addColorStop(0, '#d8cdb0'); bg.addColorStop(1, '#8e8266'); return bg; };
    for (let i = 0; i < 3; i++) {
      const a = rng() * 6.28, x = (rng() - 0.5) * s * 0.8, y = (rng() - 0.5) * s * 0.8, len = s * (0.28 + rng() * 0.2), w = o.unit * 0.022, c = Math.cos(a), sn = Math.sin(a);
      const shape = []; for (const k of [-1, 1]) { const ex = x + c * len * k, ey = y + sn * len * k; for (const side of [-1, 1]) shape.push([ex - sn * w * 1.6 * side + c * w * k, ey + c * w * 1.6 * side + sn * w * k]); }
      const pts = [[x - c * len - sn * w * 1.8, y - sn * len + c * w * 1.8], [x - c * len * 0.7 - sn * w, y - sn * len * 0.7 + c * w], [x + c * len * 0.7 - sn * w, y + sn * len * 0.7 + c * w], [x + c * len - sn * w * 1.8, y + sn * len + c * w * 1.8], [x + c * len * 1.12, y + sn * len * 1.12], [x + c * len + sn * w * 1.8, y + sn * len - c * w * 1.8], [x + c * len * 0.7 + sn * w, y + sn * len * 0.7 - c * w], [x - c * len * 0.7 + sn * w, y - sn * len * 0.7 - c * w], [x - c * len + sn * w * 1.8, y - sn * len - c * w * 1.8], [x - c * len * 1.12, y - sn * len * 1.12]];
      trace(g, pts); g.fillStyle = boneFill(x - c * len, y - sn * len, x + c * len, y + sn * len); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.7; g.stroke(); out.push(pts); void shape;
    }
    if (rng() < 0.5) { const pts = blob(rng, s * 0.3, -s * 0.3, s * 0.16, s * 0.19, 12, 0.05); trace(g, pts); g.fillStyle = boneFill(s * 0.15, -s * 0.5, s * 0.45, -s * 0.1); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.7; g.stroke(); for (const dx of [-1, 1]) { g.fillStyle = '#1a120a'; g.beginPath(); g.ellipse(s * 0.3 + dx * s * 0.06, -s * 0.25, s * 0.035, s * 0.045, 0, 0, 6.28); g.fill(); } out.push(pts); }
    return out;
  } },
  crate: { label: 'Crates', size: 0.8, height: 0.55, paint(g, s, rng, o) {
    const r = s * 0.78, turn = (rng() - 0.5) * 0.9, ct = Math.cos(turn), st = Math.sin(turn), at = (x, y) => [x * ct - y * st, x * st + y * ct], box = [at(-r, -r), at(r, -r), at(r, r), at(-r, r)];
    g.save(); poly(g, box); g.clip();
    const wg = g.createLinearGradient(...at(-r, -r), ...at(r, r)); wg.addColorStop(0, '#8a6a42'); wg.addColorStop(1, '#4a3420'); g.fillStyle = wg; g.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
    for (let k = 0; k < 5; k++) { const y = -r + (k + 0.5) * (2 * r / 5); for (let i = 0; i < 4; i++) line(g, [at(-r, y + (rng() - 0.5) * r * 0.25), at(r, y + (rng() - 0.5) * r * 0.25)], 'rgba(40,26,12,0.35)', o.ink * 0.5); line(g, [at(-r, y + r / 5), at(r, y + r / 5)], 'rgba(20,12,6,0.8)', o.ink * 0.8); }
    for (const [a, b] of [[[-r, -r], [r, r]], [[r, -r], [-r, r]]]) { line(g, [at(...a), at(...b)], INK, r * 0.2); line(g, [at(...a), at(...b)], '#6a4c2c', r * 0.15); }
    for (const [x, y] of [[-r, -r], [r, -r], [r, r], [-r, r]]) { const c = at(x * 0.8, y * 0.8); g.fillStyle = '#3e3e3c'; g.beginPath(); g.arc(c[0], c[1], r * 0.18, 0, 6.28); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.6; g.stroke(); }
    snowPatch(g, rng, ...at(-r * 0.3, -r * 0.35), r * 0.6 * o.snow, r * 0.45 * o.snow, o);
    if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.22 * o.wet})`; g.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4); }
    g.restore(); poly(g, box); g.strokeStyle = INK; g.lineWidth = o.ink * 1.2; g.stroke(); return [box];
  } },
  barrel: { label: 'Barrels', size: 0.6, height: 0.6, paint(g, s, rng, o) {
    const r = s * 0.85, pts = blob(rng, 0, 0, r, r, 24, 0.01);
    g.save(); trace(g, pts); g.clip();
    const wg = g.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); wg.addColorStop(0, '#a8875a'); wg.addColorStop(1, '#5e4428'); g.fillStyle = wg; g.fillRect(-r, -r, r * 2, r * 2);
    for (let k = -3; k <= 3; k++) { const y = k * r * 0.27; line(g, [[-r, y], [r, y]], 'rgba(30,18,8,0.75)', o.ink * 0.7); for (let i = 0; i < 2; i++) line(g, [[-r, y + rng() * r * 0.25], [r, y + rng() * r * 0.25]], 'rgba(60,40,20,0.3)', o.ink * 0.4); }
    snowPatch(g, rng, -r * 0.2, -r * 0.2, r * 0.6 * o.snow, r * 0.55 * o.snow, o);
    g.restore();
    for (const k of [1, 0.86]) { g.beginPath(); g.arc(0, 0, r * k, 0, 6.28); g.strokeStyle = INK; g.lineWidth = o.ink * (k === 1 ? 3 : 1.2); g.stroke(); }
    g.beginPath(); g.arc(0, 0, r * 0.97, 0, 6.28); g.strokeStyle = '#4a4744'; g.lineWidth = o.ink * 1.6; g.stroke();
    return [pts];
  } },
  campfire: { label: 'Old campfires', size: 0.9, height: 0.1, paint(g, s, rng, o) {
    const ash = blob(rng, 0, 0, s * 0.62, s * 0.56, 14, 0.2); g.save(); trace(g, ash); g.clip(); const ag = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.62); ag.addColorStop(0, '#5a5450'); ag.addColorStop(0.6, '#2a2420'); ag.addColorStop(1, '#16110c'); g.fillStyle = ag; g.fillRect(-s, -s, s * 2, s * 2); speckle(g, rng, 0, 0, s * 0.4, s * 0.4, 80, ['#8a8480', '#3a3430', '#a09a90'], o.unit * 0.008); g.restore();
    for (let i = 0; i < 3; i++) { const a = rng() * 6.28, p = [[Math.cos(a) * s * 0.42, Math.sin(a) * s * 0.42], [-Math.cos(a) * s * 0.08, -Math.sin(a) * s * 0.08]]; line(g, p, INK, o.unit * 0.07); line(g, p, '#1e1612', o.unit * 0.055); }
    const out = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28 + rng() * 0.2, pts = blob(rng, Math.cos(a) * s * 0.72, Math.sin(a) * s * 0.72, s * 0.13, s * 0.11, 9, 0.15); stone(g, rng, pts, pick(rng, stonesOf(o)), o, { cracks: 0, ledges: 0, ink: 0.8 }); out.push(pts); }
    return out;
  } },
  roots: { label: 'Roots', size: 1.2, height: 0.05, paint(g, s, rng, o) {
    const out = [];
    for (let i = 0; i < 4; i++) { const p = wander(rng, (rng() - 0.5) * s * 0.4, (rng() - 0.5) * s * 0.4, rng() * 6.28, 7, s * 0.14, 0.9), w = o.unit * (0.035 + rng() * 0.02); line(g, p, INK, w + o.ink * 1.6); line(g, p, '#4a3622', w); line(g, p.map(([x, y]) => [x - w * 0.18, y - w * 0.18]), 'rgba(150,118,80,0.4)', w * 0.3); out.push([...p, ...p.slice().reverse().map(([x, y]) => [x + 1, y + 1])]); }
    return out;
  } },
  crystals: { label: 'Crystals', size: 0.6, height: 0.6, paint(g, s, rng, o) {
    const out = [], hue = pick(rng, ['#5e8ea4', '#8a6ea8', '#5e9a80']);
    if (o.night || o.cave) { const gg = g.createRadialGradient(0, 0, 0, 0, 0, s); gg.addColorStop(0, 'rgba(150,200,240,0.35)'); gg.addColorStop(1, 'rgba(150,200,240,0)'); g.fillStyle = gg; g.fillRect(-s, -s, s * 2, s * 2); }
    for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (rng() - 0.5) * 2.4, len = s * (0.4 + rng() * 0.45), w = s * (0.08 + rng() * 0.06), c = Math.cos(a), sn = Math.sin(a), bx = (rng() - 0.5) * s * 0.3, by = (rng() - 0.2) * s * 0.3, pts = [[bx - sn * w, by + c * w], [bx + c * len * 0.78 - sn * w, by + sn * len * 0.78 + c * w], [bx + c * len, by + sn * len], [bx + c * len * 0.78 + sn * w, by + sn * len * 0.78 - c * w], [bx + sn * w, by - c * w]];
      poly(g, pts); const cg = g.createLinearGradient(bx, by, bx + c * len, by + sn * len); cg.addColorStop(0, shade(hue, -0.5)); cg.addColorStop(1, shade(hue, 0.15)); g.fillStyle = cg; g.fill();
      poly(g, [pts[0], pts[1], pts[2], [bx + c * len * 0.1, by + sn * len * 0.1]]); g.fillStyle = 'rgba(230,240,250,0.22)'; g.fill();
      poly(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 0.7; g.stroke(); out.push(pts); }
    return out;
  } },

  // --- Underground --------------------------------------------------------------------------------------------------------------------
  stalagmite: { label: 'Stalagmites', size: 0.7, height: 1.1, set: 'cave', paint(g, s, rng, o) {
    // A cone seen from above: rings of dripstone climbing toward the light to a wet pale tip, each ring a little lighter.
    const base = pick(rng, CAVE_STONES), foot = blob(rng, 0, 0, s * 0.8, s * 0.75, 16, 0.18);
    stone(g, rng, foot, mix(base, '#1a1612', 0.3), o, { cracks: 0, ledges: 0 });
    let ring = foot;
    for (let k = 1; k <= 4; k++) { const t = k / 5; ring = blob(rng, -s * 0.12 * t, -s * 0.15 * t, s * 0.8 * (1 - t * 0.82), s * 0.75 * (1 - t * 0.82), 14, 0.14); trace(g, ring); const rg = g.createRadialGradient(-s * 0.15 * t - s * 0.1, -s * 0.18 * t - s * 0.1, 0, -s * 0.12 * t, -s * 0.15 * t, s * 0.8 * (1 - t * 0.8)); rg.addColorStop(0, shade(base, 0.1 + t * 0.25)); rg.addColorStop(1, mix(base, '#14100c', 0.5 - t * 0.3)); g.fillStyle = rg; g.fill(); g.strokeStyle = 'rgba(14,10,6,0.6)'; g.lineWidth = o.ink * 0.8; g.stroke(); }
    g.fillStyle = 'rgba(230,236,240,0.75)'; g.beginPath(); g.arc(-s * 0.16, -s * 0.2, s * 0.05, 0, 6.28); g.fill();
    trace(g, foot); g.strokeStyle = INK; g.lineWidth = o.ink * 1.5; g.stroke();
    return [foot];
  } },
  column: { label: 'Rock columns', size: 1.4, height: 3, set: 'cave', paint(g, s, rng, o) {
    // A pillar of flowstone floor to roof: folds of stone draped down its sides like wax, pooled into a ringed base.
    const base = pick(rng, CAVE_STONES), skirt = blob(rng, 0, 0, s * 0.95, s * 0.9, 22, 0.16), body = blob(rng, -s * 0.06, -s * 0.07, s * 0.62, s * 0.6, 20, 0.1);
    stone(g, rng, skirt, mix(base, '#1a1612', 0.25), o, { cracks: 1, ledges: 1 });
    standing(g, rng, body, base, o, { lift: 0.32, cracks: 2, ledges: 0 });
    // Drapery: folds running out from the pillar down the skirt.
    g.save(); trace(g, skirt); g.clip();
    for (let i = 0; i < 26; i++) { const a = (i / 26) * 6.28 + rng() * 0.1, r0 = s * 0.58, r1 = s * (0.8 + rng() * 0.15), p = [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a + 0.04) * (r0 + r1) / 2, Math.sin(a + 0.04) * (r0 + r1) / 2], [Math.cos(a) * r1, Math.sin(a) * r1]]; line(g, p, 'rgba(12,8,4,0.55)', o.ink * 1.1); line(g, p.map(([x, y]) => [x - o.ink, y - o.ink]), 'rgba(210,200,180,0.2)', o.ink * 0.6); }
    g.restore();
    return [skirt];
  } },
  rubble: { label: 'Rubble', size: 1.1, height: 0.35, set: 'both', paint(g, s, rng, o) {
    // A heap of broken stone: angular chunks, the big ones first, smaller ones lying over them, grit between.
    const out = [];
    speckle(g, rng, 0, 0, s * 0.85, s * 0.7, 120, o.cave ? ['#3a3834', '#4a4844', '#2a2826'] : ['#4a3e2c', '#5a4c36', '#3a3022'], o.unit * 0.012);
    const chunks = []; for (let i = 0; i < 14; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.62, r = s * (0.1 + rng() * 0.2); chunks.push([Math.cos(a) * d, Math.sin(a) * d, r]); }
    chunks.sort((p, q) => q[2] - p[2]);
    for (const [x, y, r] of chunks) { const pts = blob(rng, x, y, r, r * (0.6 + rng() * 0.3), 5 + Math.floor(rng() * 2), 0.32); stone(g, rng, pts, pick(rng, stonesOf(o)), o, { cracks: 0, ledges: 0, ink: 0.8 }); out.push(pts); }
    return out;
  } },
  cavePool: { label: 'Cave pools', size: 1.3, height: 0, flat: true, set: 'cave', water: 'still', paint(g, s, rng, o) {
    // Still black water ringed by rimstone: pale mineral terraces in wavy steps round its edge, a cold glint on it.
    const pts = WATER_SHAPES.cavePool(rng, s, o);
    // Each terrace a ring, so with the water engine's water (o.liveWater) the middle stays open for it.
    for (let k = 3; k >= 1; k--) { g.save(); trace(g, moved(pts, 0, 0, 1 + k * 0.07)); if (o.liveWater) { trace(g, pts, false); } g.fillStyle = mix('#9a948a', '#5a564e', k / 3); g.fill('evenodd'); g.restore(); trace(g, moved(pts, 0, 0, 1 + k * 0.07)); g.strokeStyle = 'rgba(20,16,10,0.55)'; g.lineWidth = o.ink * 0.8; g.stroke(); }
    if (o.liveWater) { trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke(); return null; }
    g.save(); trace(g, pts); g.clip();
    const wg = g.createRadialGradient(0, 0, 0, 0, 0, s); wg.addColorStop(0, '#060c10'); wg.addColorStop(0.8, '#0c1a20'); wg.addColorStop(1, '#1c3036'); g.fillStyle = wg; g.fillRect(-s * 2, -s * 2, s * 4, s * 4);
    for (let i = 0; i < 6; i++) line(g, wander(rng, (rng() - 0.5) * s * 1.2, (rng() - 0.5) * s * 0.7, rng() * 6.28, 4, s * 0.1, 0.6), 'rgba(140,190,200,0.14)', o.ink * 0.8);
    g.strokeStyle = 'rgba(210,230,236,0.5)'; g.lineWidth = o.ink; g.beginPath(); g.ellipse(-s * 0.2, -s * 0.12, s * 0.3, s * 0.06, -0.1, Math.PI * 1.05, Math.PI * 1.6); g.stroke();
    g.restore(); trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    return null;
  } },
  glowShrooms: { label: 'Glowing mushrooms', size: 0.6, height: 0.15, set: 'cave', glow: { color: '#5fe0c8', radius: 1.6 }, paint(g, s, rng, o) {
    // Pale caps lit from within, blue-green, with a soft halo round the cluster: a light of their own in the dark.
    const out = [], hue = pick(rng, [['#7ff0d8', '#1e6a64'], ['#8ac8ff', '#24407a'], ['#c8a0ff', '#4a2a7a']]);
    const halo = g.createRadialGradient(0, 0, 0, 0, 0, s); halo.addColorStop(0, `${hue[0]}55`); halo.addColorStop(1, `${hue[0]}00`); g.fillStyle = halo; g.fillRect(-s, -s, s * 2, s * 2);
    for (let i = 0; i < 9; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.6, r = o.unit * (0.035 + rng() * 0.05), x = Math.cos(a) * d, y = Math.sin(a) * d, pts = blob(rng, x, y, r, r, 10, 0.06);
      g.save(); trace(g, pts); g.clip(); const cg = g.createRadialGradient(x - r * 0.2, y - r * 0.2, 0, x, y, r); cg.addColorStop(0, '#f4fffc'); cg.addColorStop(0.45, hue[0]); cg.addColorStop(1, hue[1]); g.fillStyle = cg; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
      trace(g, pts); g.strokeStyle = 'rgba(10,20,24,0.8)'; g.lineWidth = o.ink * 0.6; g.stroke(); out.push(pts); }
    return out;
  } },
  lichen: { label: 'Lichen', size: 1.0, height: 0, flat: true, set: 'both', paint(g, s, rng, o) {
    // Crusts on the stone: rings of grey-green, rust and pale yellow, each spreading with a lighter edge.
    for (let i = 0; i < 9; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.6, r = s * (0.12 + rng() * 0.22), c = pick(rng, ['#8a9a72', '#a8762e', '#c8b860', '#6e7a64']), pts = blob(rng, Math.cos(a) * d, Math.sin(a) * d, r, r * 0.85, 14, 0.25);
      trace(g, pts); g.fillStyle = `${c}aa`; g.fill(); g.strokeStyle = shade(c, 0.25); g.lineWidth = o.ink * 0.9; g.stroke(); trace(g, moved(pts, centre(pts)[0], centre(pts)[1], 0.55)); g.strokeStyle = shade(c, -0.25); g.lineWidth = o.ink * 0.5; g.stroke(); }
    return null;
  } },
  cobweb: { label: 'Cobwebs', size: 1.0, height: 0, flat: true, set: 'cave', paint(g, s, rng, o) {
    // Threads out from a corner and a spiral across them, grey and faint, a little dust caught in them.
    const n = 7 + Math.floor(rng() * 3), turn = rng() * 6.28, spokes = [];
    for (let i = 0; i < n; i++) { const a = turn + (i / n) * 6.28 * 0.75, r = s * (0.75 + rng() * 0.25); spokes.push([a, r]); line(g, [[0, 0], [Math.cos(a) * r, Math.sin(a) * r]], 'rgba(220,220,214,0.5)', o.ink * 0.5); }
    for (let k = 1; k < 9; k++) { const d = k / 9; g.beginPath(); spokes.forEach(([a, r], i) => { const x = Math.cos(a) * r * d, y = Math.sin(a) * r * d; if (i) { const [pa, pr] = spokes[i - 1], mx = (Math.cos(pa) * pr * d + x) / 2 * 0.92, my = (Math.sin(pa) * pr * d + y) / 2 * 0.92; g.quadraticCurveTo(mx, my, x, y); } else g.moveTo(x, y); }); g.strokeStyle = 'rgba(214,214,206,0.38)'; g.lineWidth = o.ink * 0.4; g.stroke(); }
    return null;
  } },
  fissure: { label: 'Fissures', size: 1.6, height: 0, flat: true, set: 'both', paint(g, s, rng, o) {
    // A crack in the floor: jagged, dark deep inside, its lips catching a little light, fine cracks running off it.
    const a = rng() * 6.28, main = wander(rng, -Math.cos(a) * s * 0.85, -Math.sin(a) * s * 0.85, a, 10, s * 0.17, 0.7);
    const left = [], right = []; main.forEach(([x, y], i) => { const t = i / (main.length - 1), w = s * 0.09 * Math.sin(t * Math.PI) * (0.6 + rng() * 0.6) + 0.5, nx = -Math.sin(a), ny = Math.cos(a); left.push([x + nx * w, y + ny * w]); right.push([x - nx * w, y - ny * w]); });
    poly(g, [...left, ...right.reverse()]); g.fillStyle = '#050403'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    line(g, left.map(([x, y]) => [x - o.ink, y - o.ink]), 'rgba(200,190,170,0.25)', o.ink * 0.8);
    for (let i = 0; i < 6; i++) { const [x, y] = main[1 + Math.floor(rng() * (main.length - 2))]; line(g, wander(rng, x, y, a + (rng() < 0.5 ? 1.2 : -1.2), 3, s * 0.08, 0.8), 'rgba(10,8,6,0.7)', o.ink * 0.6); }
    return null;
  } },
  lavaCrack: { label: 'Glowing cracks', size: 1.6, height: 0, flat: true, set: 'cave', glow: { color: '#ff7a2a', radius: 2 }, paint(g, s, rng, o) {
    // A crack with molten rock deep in it: orange core, yellow where hottest, the rock round it scorched dark and warm.
    const a = rng() * 6.28, main = wander(rng, -Math.cos(a) * s * 0.85, -Math.sin(a) * s * 0.85, a, 10, s * 0.17, 0.7);
    line(g, main, 'rgba(60,20,8,0.5)', s * 0.28); line(g, main, 'rgba(18,10,6,0.9)', s * 0.12);
    line(g, main, '#c8401a', s * 0.07); line(g, main, '#ffb040', s * 0.03); line(g, main, '#fff2b0', s * 0.012);
    for (let i = 0; i < 5; i++) { const [x, y] = main[1 + Math.floor(rng() * (main.length - 2))], b = wander(rng, x, y, a + (rng() < 0.5 ? 1.1 : -1.1), 3, s * 0.08, 0.8); line(g, b, 'rgba(18,10,6,0.9)', s * 0.05); line(g, b, '#d85a1e', s * 0.02); }
    return null;
  } },
  timberProps: { label: 'Mine timbers', size: 1.2, height: 2.2, set: 'cave', paint(g, s, rng, o) {
    // A mine's roof prop seen from above: two posts and the beam across them, adzed timber, iron bands at the joints.
    const turn = (rng() - 0.5) * 0.5, ct = Math.cos(turn), st = Math.sin(turn), at = (x, y) => [x * ct - y * st, x * st + y * ct], r = s * 0.85, w = s * 0.17;
    const beam = [at(-r, -w), at(r, -w), at(r, w), at(-r, w)];
    for (const side of [-1, 1]) { const post = [at(side * r * 0.82 - w * 1.1, -w * 1.1), at(side * r * 0.82 + w * 1.1, -w * 1.1), at(side * r * 0.82 + w * 1.1, w * 1.1), at(side * r * 0.82 - w * 1.1, w * 1.1)]; poly(g, post); g.fillStyle = '#4a3420'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 1.2; g.stroke(); }
    g.save(); poly(g, beam); g.clip(); const bg = g.createLinearGradient(...at(0, -w), ...at(0, w)); bg.addColorStop(0, '#8a6a42'); bg.addColorStop(1, '#4a3420'); g.fillStyle = bg; g.fillRect(-s, -s, s * 2, s * 2);
    for (let i = 0; i < 8; i++) { const y = (rng() - 0.5) * w * 1.8; line(g, [at(-r, y), at(r, y + (rng() - 0.5) * w * 0.3)], 'rgba(30,18,8,0.45)', o.ink * 0.6); }
    for (const x of [-r * 0.82, r * 0.82]) { poly(g, [at(x - w * 0.3, -w), at(x + w * 0.3, -w), at(x + w * 0.3, w), at(x - w * 0.3, w)]); g.fillStyle = '#3e3c3a'; g.fill(); }
    g.restore(); poly(g, beam); g.strokeStyle = INK; g.lineWidth = o.ink * 1.3; g.stroke();
    return [beam];
  } },
};
// Where each kind belongs: above ground, below it, or both (stone, bones, crates and the like). Unlisted: above ground.
const SETS = { rock: 'both', boulder: 'both', pebbles: 'both', mushrooms: 'both', bones: 'both', crate: 'both', barrel: 'both', campfire: 'both', roots: 'both', crystals: 'both' };
const setOf = (id) => KINDS[id].set ?? SETS[id] ?? 'surface';
export const DECOR_KINDS = Object.freeze(Object.fromEntries(Object.entries(KINDS).map(([id, k]) => [id, Object.freeze({ id, label: k.label, size: k.size, height: k.height, flat: !!k.flat, tree: !!k.tree, set: setOf(id), water: k.water ?? null, glow: k.glow ?? (id === 'crystals' ? { color: '#9ac8f0', radius: 1.2 } : null) })])));
export const DECOR_IDS = Object.freeze(Object.keys(KINDS));

// Paints one decoration into a fresh canvas. px: the drawing's full width in pixels; look.unit: pixels per grid square, so leaves and
// blades keep the map's own scale whatever the object's size. look: { season, snow 0..1, wet 0..1, frozen, night, unit }. Returns
// { canvas, shadow, width, height }: shadow is its silhouette in white on clear (null for a flat kind), both centred on the object.
export function paintDecor(kind, seed, px, look = {}, make = defaultCanvas) {
  const k = KINDS[kind]; if (!k) return null;
  const size = Math.max(8, Math.ceil(px)), pad = Math.ceil(size * 0.12), w = size + pad * 2;
  const canvas = make(w, w), g = canvas.getContext('2d'), rng = seeded(seed);
  const unit = look.unit ?? size / k.size;
  const o = { season: 'summer', snow: 0, wet: 0, frozen: false, night: false, ...look, unit, ink: Math.max(1, unit / 60) };
  g.translate(w / 2, w / 2);
  const outlines = k.paint(g, size / 2, rng, o);
  let shadow = null;
  if (outlines && !k.flat) {
    shadow = make(w, w); const s = shadow.getContext('2d'); s.translate(w / 2, w / 2); s.fillStyle = '#fff'; s.strokeStyle = '#fff'; s.lineJoin = 'round'; s.lineCap = 'round';
    for (const pts of outlines) { if (pts.length < 4) { s.beginPath(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); s.lineWidth = o.ink * 3; s.stroke(); continue; } trace(s, pts); s.fill(); s.lineWidth = o.ink * 2; s.stroke(); }
  }
  // A tree's trunk, for the ground under it (tokens walk over it, under the crown).
  let trunk = null;
  if (k.tree) { trunk = make(w, w); const t = trunk.getContext('2d'); t.translate(w / 2, w / 2); paintTrunk(t, seeded(seed + 1), size / 2, o, kind); }
  return { canvas, shadow, trunk, width: w, height: w };
}
const defaultCanvas = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// Where each decoration of a region goes: seeded scatter by kind and density over the region's bounds, kept inside the shape and
// apart from each other. inside(x, y) answers whether a point is in the region. Returns [{ kind, x, y, size, turn, seed, flip }].
// Big kinds go down first so small ones fill round them; puddles draw reeds and moss to their edges; trees drop leaves and roots.
// One decoration for a brush dab at (x, y): a kind picked from those chosen (by their amounts), somewhere within radius, kept off
// standing things already there. Returns the placement, or null when there is no room.
export function stampDecor({ x, y, radius, grid, kinds, seed, existing = [], scale = 1 }) {
  const rng = seeded(seed), list = (kinds ?? []).map((k) => (typeof k === 'string' ? { id: k } : k)).filter((k) => KINDS[k.id] && (k.amount ?? 1) > 0);
  if (!list.length) return null;
  const total = list.reduce((s, k) => s + (k.amount ?? 1), 0); let roll = rng() * total, pickK = list[0];
  for (const k of list) { roll -= k.amount ?? 1; if (roll <= 0) { pickK = k; break; } }
  const k = KINDS[pickK.id], size = k.size * (pickK.size ?? 1) * scale * (0.7 + rng() * 0.6);
  for (let t = 0; t < 6; t++) {
    const a = rng() * 6.28, d = Math.sqrt(rng()) * radius, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const free = k.flat || existing.every((e) => KINDS[e.kind]?.flat || (e.x - px) ** 2 + (e.y - py) ** 2 > ((e.size + size) * grid * 0.42) ** 2);
    if (free) return { kind: pickK.id, x: Math.round(px), y: Math.round(py), size: +size.toFixed(3), turn: +(rng() * 6.283).toFixed(3), seed: (rng() * 2 ** 31) >>> 0, flip: rng() < 0.5 };
  }
  return null;
}

// kinds: ids, or { id, size, amount } to scale one kind's size and how many of it (1 as usual).
export function scatterDecor({ bounds, inside, grid, kinds, density = 0.5, scale = 1, seed = 1, limit = 600 }) {
  const rng = seeded(seed), out = [], each = new Map((kinds ?? []).map((k) => (typeof k === 'string' ? { id: k } : k)).filter((k) => KINDS[k.id]).map((k) => [k.id, { size: k.size ?? 1, amount: k.amount ?? 1 }])), chosen = [...each.keys()];
  if (!chosen.length || !(grid > 0)) return out;
  const area = (bounds.w * bounds.h) / (grid * grid), order = chosen.slice().sort((a, b) => KINDS[b].size - KINDS[a].size);
  const room = (x, y, r, flat) => out.every((d) => { if (flat || KINDS[d.kind].flat) return true; const gap = (d.size + r) * grid * 0.42; return (d.x - x) ** 2 + (d.y - y) ** 2 > gap * gap; });
  const place = (kind, x, y, size) => { const d = { kind, x: Math.round(x), y: Math.round(y), size: +size.toFixed(3), turn: +(rng() * Math.PI * 2).toFixed(3), seed: (rng() * 2 ** 31) >>> 0, flip: rng() < 0.5 }; out.push(d); return d; };
  for (const kind of order) {
    const k = KINDS[kind], mine = each.get(kind), big = k.size * mine.size, want = mine.amount > 0 ? Math.max(1, Math.round(mine.amount * area * density * 0.9 / (chosen.length * Math.max(0.35, big * big) * 1.2))) : 0, tries = want * 8;
    let made = 0;
    for (let t = 0; t < tries && made < want && out.length < limit; t++) {
      const x = bounds.x + rng() * bounds.w, y = bounds.y + rng() * bounds.h, size = big * scale * (0.7 + rng() * 0.6);
      if (!inside(x, y)) continue;
      if (!room(x, y, size, k.flat)) continue;
      const d = place(kind, x, y, size); made++;
      const friends = kind === 'puddle' ? ['reeds', 'moss'] : k.tree && kind !== 'palm' ? ['leaves', 'roots'] : kind === 'boulder' ? ['agave', 'fern'] : [];
      for (const f of friends) if (chosen.includes(f) && rng() < 0.6 && out.length < limit) {
        const a = rng() * 6.28, r = d.size * grid * (f === 'reeds' || f === 'agave' ? 0.5 : 0.3), fx = d.x + Math.cos(a) * r, fy = d.y + Math.sin(a) * r;
        if (inside(fx, fy)) place(f, fx, fy, KINDS[f].size * each.get(f).size * scale * (0.6 + rng() * 0.4));
      }
    }
  }
  return out.sort((a, b) => (KINDS[b.kind].flat - KINDS[a.kind].flat) || (KINDS[a.kind].height - KINDS[b.kind].height));
}
