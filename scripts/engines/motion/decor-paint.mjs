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
  summer: ['#302c0c', '#5c5414', '#8a7c1e', '#b49e2c'],
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
  // As the map's crowns: many small leaves, finely inked, heaped in clumps. Each clump a little dome, lit on its own top-left and
  // sinking into dark hollows where it meets the next, so the crown reads as bunched foliage rather than a flat tile of leaves.
  leafLen *= 0.62; count = Math.round(count * 2.4);
  const clumps = [[cx + R * 0.05 * (rng() - 0.5), cy + R * 0.05 * (rng() - 0.5), R * (0.34 + rng() * 0.08), 0]];
  for (let i = 0; i < lobes * 1.7; i++) { const a = rng() * 6.28, t = 0.35 + Math.sqrt(rng()) * 0.6, d = t * edge(a) * 0.82; clumps.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d, R * (0.22 + rng() * 0.14) * (1.1 - t * 0.35), t]); }
  const clumpOf = (x, y) => { let best = clumps[0], bd = Infinity; for (const c of clumps) { const d = Math.hypot(x - c[0], y - c[1]) / c[2]; if (d < bd) { bd = d; best = c; } } return [best, bd]; };
  const leaves = [];
  for (let i = 0; i < count; i++) { const a = rng() * 6.28, t = Math.sqrt(rng()), d = t * edge(a) * 0.98, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d, [c, cd] = clumpOf(x, y); leaves.push([x, y, t, outward && t > 0.3 ? a + (rng() - 0.5) * (1 - outward) * 6.28 : rng() * 6.28, c, Math.min(1.4, cd)]); }
  // Drawn clump by clump, rim clumps first, and in each from its edge to its top, so each clump heaps over its hollow.
  leaves.sort((p, q) => (q[4][3] - p[4][3]) * 4 + (q[5] - p[5]) + (lattice(p[0] * 7, p[1] * 7, 1) - 0.5) * 0.2);
  const drifts = [];
  for (const [x, y, t, a, c, cd] of leaves) {
    const lx = x - cx, ly = y - cy, patch = noise(lx / (R * 0.3) + k0, ly / (R * 0.3), 3);
    const lit = towardLight(x - c[0], y - c[1], c[2]) * 0.55 - cd * cd * 0.55 + 0.3 + towardLight(lx, ly, R) * 0.25 + (patch - 0.5) * 0.7 - t * t * 0.3 + (rng() - 0.5) * 0.35;
    const other = lightFrom && rng() < mixIn, from = other ? lightFrom : set;
    let fill = lit < -0.35 ? from[0] : lit < 0.15 ? from[1] : lit < 0.55 ? from[2] : from[3];
    // Under snow the leaves cool and dull; the snow itself lies over them afterwards, in drifts.
    if (o.snow > 0) fill = mix(fill, '#6a7480', 0.25 * o.snow);
    if (o.snow > 0 && lit > 0.7 - o.snow * 0.4 && rng() < 0.3) drifts.push([x, y, leafLen * (0.7 + rng() * 0.5)]);
    fill = mix(fill, shade(fill, (rng() - 0.5) * 0.3), 0.6);
    leaf(g, x, y, leafLen * (0.8 + rng() * 0.45), a, fill, o.ink * 0.55, wide, other && lightShape ? lightShape : shape);
  }
  snowDrifts(g, rng, drifts, hull, o);
  if (o.wet > 0) { g.save(); trace(g, hull); g.clip(); g.fillStyle = `rgba(6,10,14,${0.18 * o.wet})`; g.fillRect(cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6); g.restore(); }
  return hull;
}

// A crown of needle tufts within hull (radius R about cx, cy), each tuft a small burst of finely inked needles, the tufts heaped
// in clumps that are lit on their own top-left and dark where they meet. bed: the dark under them (null for none, but then a soft
// shadow falls from them on what lies beneath, as an upper tier on a lower). Snow lies on the most lit tips.
function needleCrown(g, rng, R, o, { hull, cx = 0, cy = 0, set, bed, tufts, len, n, clumps: many = 7 }) {
  if (bed) { trace(g, moved(hull, cx, cy, 0.8)); g.fillStyle = bed; g.fill(); }
  else { g.save(); g.filter = `blur(${Math.max(1, R * 0.06)}px)`; trace(g, moved(hull, cx + R * 0.06, cy + R * 0.08, 1)); g.fillStyle = 'rgba(0,4,2,0.55)'; g.fill(); g.restore(); }
  const k0 = rng() * 50, clumps = [[cx, cy, R * 0.4, 0]];
  for (let i = 0; i < many; i++) { const a = rng() * 6.28, t = 0.4 + rng() * 0.5; clumps.push([cx + Math.cos(a) * t * R, cy + Math.sin(a) * t * R, R * (0.25 + rng() * 0.12), t]); }
  const all = [];
  for (let i = 0; i < tufts; i++) { const a = rng() * 6.28, t = Math.sqrt(rng()), x = cx + Math.cos(a) * t * R * 0.84, y = cy + Math.sin(a) * t * R * 0.84; let c = clumps[0], cd = Infinity; for (const q of clumps) { const d = Math.hypot(x - q[0], y - q[1]) / q[2]; if (d < cd) { cd = d; c = q; } } all.push([x, y, t, c, Math.min(1.4, cd)]); }
  all.sort((p, q) => (q[3][3] - p[3][3]) * 4 + (q[4] - p[4]));
  for (const [x, y, t, c, cd] of all) {
    const lit = towardLight(x - c[0], y - c[1], c[2]) * 0.55 - cd * cd * 0.55 + 0.3 + towardLight(x - cx, y - cy, R) * 0.2 + (noise((x - cx) / (R * 0.35) + k0, (y - cy) / (R * 0.35)) - 0.5) * 0.6 - t * t * 0.3 + (rng() - 0.5) * 0.3;
    const color = lit < -0.35 ? set[0] : lit < 0.1 ? set[1] : lit < 0.5 ? set[2] : set[3], snowy = o.snow > 0 && lit > 0.55 - o.snow * 0.45, l0 = o.unit * len * (0.8 + rng() * 0.4), turn = rng() * 6.28;
    for (let k = 0; k < n; k++) { const a = turn + (k / n) * 6.28 + (rng() - 0.5) * 0.4, l = l0 * (0.65 + rng() * 0.35), p = [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]]; line(g, p, 'rgba(8,10,4,0.85)', o.ink * 1.15); line(g, p, snowy && k % 2 ? '#dfe5e8' : mix(color, shade(color, (rng() - 0.5) * 0.4), 0.5), o.ink * 0.6); }
  }
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
  // Facets, as the desert maps draw their small stones: a line or two across the top where its planes meet, the plane toward the
  // light a shade lighter.
  if (face.facets) for (let f = 0; f < face.facets; f++) {
    const p0 = [cx + dx * 0.7 + (rng() - 0.5) * rx * 0.35, cy + dy * 0.7 + (rng() - 0.5) * ry * 0.35], i0 = Math.floor(rng() * top.length), i1 = (i0 + Math.floor(top.length * (0.28 + rng() * 0.22))) % top.length;
    const arc = []; for (let k = i0; k !== i1; k = (k + 1) % top.length) arc.push(top[k]); arc.push(top[i1]);
    const lit = towardLight(arc[Math.floor(arc.length / 2)][0] - cx, arc[Math.floor(arc.length / 2)][1] - cy, r) > 0;
    poly(g, [p0, ...arc]); g.fillStyle = lit ? 'rgba(255,245,220,0.13)' : 'rgba(20,12,4,0.16)'; g.fill();
    line(g, [top[i0], p0, top[i1]], 'rgba(16,10,4,0.75)', o.ink * 0.9);
  }
  // Moss on its top, as the mine's boulders have: soft green patches and a fine stipple over the stone (not in winter, nor underground).
  if (face.moss && o.season !== 'winter' && !o.cave) {
    const set = MOSS[o.season] ?? MOSS.summer;
    g.save(); g.filter = `blur(${Math.max(1, soft)}px)`;
    // The whole stone olive under its moss, patches thicker on top.
    g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(168,166,104,0.6)'; trace(g, pts); g.fill(); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 6; i++) { const px = cx + dx + (rng() - 0.6) * rx * 1.1, py = cy + dy + (rng() - 0.6) * ry * 1.1; g.fillStyle = `rgba(${rng() < 0.5 ? '78,84,40' : '120,118,70'},0.32)`; g.beginPath(); g.ellipse(px, py, rx * (0.22 + rng() * 0.25), ry * (0.16 + rng() * 0.2), rng() * 3, 0, 6.283); g.fill(); }
    g.restore();
    speckle(g, rng, cx + dx, cy + dy, rx * 0.75, ry * 0.65, Math.round(r * 4), set, o.unit * 0.01);
  }
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
// A small mushroom cap from above: dull, its colour sinking to the rim, a darker knob at its middle, a few pale flecks on some,
// inked. `tilted`: lying over, its pale gills showing as fine lines from the stem.
function mushroomCap(g, rng, x, y, r, color, o, tilted = false) {
  if (tilted) {
    const a = rng() * 6.28; g.save(); g.translate(x, y); g.rotate(a);
    g.beginPath(); g.ellipse(0, 0, r, r * 0.62, 0, 0, 6.283); g.fillStyle = '#b8a27a'; g.fill();
    for (let k = 0; k < 14; k++) { const t = (k / 14) * 6.283; line(g, [[0, 0], [Math.cos(t) * r * 0.95, Math.sin(t) * r * 0.6]], 'rgba(70,52,30,0.55)', Math.max(0.5, o.ink * 0.4)); }
    g.beginPath(); g.arc(0, 0, r * 0.18, 0, 6.283); g.fillStyle = '#d8c8a2'; g.fill();
    g.beginPath(); g.ellipse(0, 0, r, r * 0.62, 0, 0, 6.283); g.strokeStyle = INK; g.lineWidth = o.ink * 0.8; g.stroke(); g.restore();
    return;
  }
  const pts = blob(rng, x, y, r, r * (0.9 + rng() * 0.1), 12, 0.07);
  g.save(); trace(g, pts); g.clip();
  const cg = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r * 1.05); cg.addColorStop(0, shade(color, 0.18)); cg.addColorStop(0.6, color); cg.addColorStop(1, shade(color, -0.5)); g.fillStyle = cg; g.fillRect(x - r * 1.2, y - r * 1.2, r * 2.4, r * 2.4);
  g.beginPath(); g.arc(x - r * 0.05, y - r * 0.05, r * 0.28, 0, 6.283); g.fillStyle = shade(color, -0.25); g.fill();
  if (rng() < 0.45) for (let k = 0; k < 5; k++) { g.fillStyle = 'rgba(220,205,170,0.45)'; g.beginPath(); g.arc(x + (rng() - 0.5) * r * 1.3, y + (rng() - 0.5) * r * 1.3, r * (0.05 + rng() * 0.05), 0, 6.283); g.fill(); }
  snowPatch(g, rng, x - r * 0.25, y - r * 0.25, r * 0.55 * o.snow, r * 0.45 * o.snow, o);
  g.restore(); trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 0.85; g.stroke();
  return pts;
}
// Grain along a board or bark between two points: a few long, slightly wandering thin lines, darker and paler.
function grainAlong(g, rng, x0, y0, x1, y1, width, count, o) {
  const len = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / (len || 1), uy = (y1 - y0) / (len || 1), nx = -uy, ny = ux;
  for (let i = 0; i < count; i++) {
    const off = (rng() - 0.5) * width * 0.85, start = rng() * len * 0.3, end = len * (0.6 + rng() * 0.4), pts = [];
    for (let t = start; t <= end; t += len / 8) { const w = off + (noise(t / (len || 1) * 3 + i, i) - 0.5) * width * 0.25; pts.push([x0 + ux * t + nx * w, y0 + uy * t + ny * w]); }
    if (pts.length > 1) line(g, pts, rng() < 0.65 ? 'rgba(24,14,6,0.55)' : 'rgba(190,160,115,0.28)', Math.max(0.5, o.ink * (0.4 + rng() * 0.4)));
  }
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
    // Tapering along the limb to the width its forks start at, so it reads as wood rather than tubing: inked, then the bark,
    // darker on its shadowed side, a thin lit edge, and a streak or two of its grain.
    const wAt = (i) => w * (1 - 0.38 * (i / (p.length - 1)));
    for (let i = 1; i < p.length; i++) line(g, [p[i - 1], p[i]], INK, wAt(i - 0.5) + o.ink * 1.1);
    for (let i = 1; i < p.length; i++) line(g, [p[i - 1], p[i]], shade(color, -0.22), wAt(i - 0.5));
    for (let i = 1; i < p.length; i++) line(g, [p[i - 1], p[i]].map(([px, py]) => [px - wAt(i) * 0.12, py - wAt(i) * 0.15]), color, wAt(i - 0.5) * 0.6);
    line(g, p.map(([px, py], i) => [px - wAt(i) * 0.28, py - wAt(i) * 0.32]), 'rgba(235,225,205,0.28)', w * 0.18);
    if (w > o.ink * 2) line(g, p.map(([px, py], i) => [px + wAt(i) * 0.1, py + wAt(i) * 0.05]), 'rgba(10,6,2,0.35)', Math.max(0.5, o.ink * 0.4));
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
  // Where the limbs leave the trunk: a knot of bark seen from above, rounded and dark, lit on one side, not a cut end.
  const color = options.color ?? '#5a4632', r = s * 0.1, knot = blob(rng, 0, 0, r, r * 0.92, 12, 0.2);
  const kg = g.createRadialGradient(-r * 0.35, -r * 0.4, 0, 0, 0, r * 1.1); kg.addColorStop(0, shade(color, 0.1)); kg.addColorStop(0.7, shade(color, -0.2)); kg.addColorStop(1, shade(color, -0.5));
  trace(g, knot); g.fillStyle = kg; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke();
  for (let i = 0; i < 4; i++) line(g, wander(rng, (rng() - 0.5) * r, (rng() - 0.5) * r, rng() * 6.28, 3, r * 0.3, 0.6), 'rgba(10,6,2,0.4)', Math.max(0.5, o.ink * 0.5));
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
    o = { ...o, ink: o.ink * 0.7 };
    // A fist-to-knee-high stone, faceted, heavy ink round it, as the maps draw theirs.
    const pts = blob(rng, 0, 0, s * 0.92, s * 0.74, 9, 0.24); standing(g, rng, pts, pick(rng, stonesOf(o)), o, { lift: 0.18, cracks: 1, ledges: 0, facets: 1 + Math.floor(rng() * 2) }); return [pts];
  } },
  boulder: { label: 'Boulders', size: 1.3, height: 1.2, paint(g, s, rng, o) {
    const pts = blob(rng, 0, 0, s * 0.95, s * 0.8, 14, 0.13); standing(g, rng, pts, pick(rng, stonesOf(o)), o, { lift: 0.3, cracks: 6, ledges: Math.floor(rng() * 2), ink: 1.2, moss: rng() < 0.55 });
    return [pts];
  } },
  pebbles: { label: 'Pebbles', size: 0.5, height: 0.06, paint(g, s, rng, o) {
    o = { ...o, ink: o.ink * 0.4 };
    const out = [];
    // A scatter of small faceted stones, a few bigger, some half sunk in grit.
    const stones = []; for (let i = 0; i < 5 + Math.floor(rng() * 4); i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.65; stones.push([Math.cos(a) * d, Math.sin(a) * d, s * (0.1 + rng() * rng() * 0.2)]); }
    speckle(g, rng, 0, 0, s * 0.6, s * 0.5, 50, o.cave ? ['#3a3834', '#55524c'] : ['#5a4e3a', '#7a6c54', '#3e3428'], o.unit * 0.008);
    stones.sort((p, q) => q[2] - p[2]);
    for (const [x, y, r] of stones) { const pts = blob(rng, x, y, r, r * (0.65 + rng() * 0.25), 8, 0.25); standing(g, rng, pts, shade(pick(rng, stonesOf(o)), 0.15), o, { lift: 0.05, cracks: 0, ledges: 0, facets: rng() < 0.6 ? 1 : 0 }); out.push(pts); }
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
    return [leafMass(g, rng, s * 0.95, o, { leafLen: o.unit * 0.2, count: crown(s, o, 420), lobes: 12, rough: 0.22, wide: 0.2, colors: WILLOW[o.season], bed: 0.85, outward: 0.92, shape: 'willow' })];
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
    // Tufts of long needles, each a small burst, heaped in clumps over a round crown: dark below, yellow-green on lit tips.
    const R = s * 0.92, hull = blob(rng, 0, 0, R, R, 18, 0.12);
    needleCrown(g, rng, R, o, { hull, set: ['#14220e', '#2c4a1c', '#4c6e2e', '#7e9c3e'], bed: '#0c1608', tufts: crown(s, o, 420), len: 0.13, n: 13 });
    return [hull];
  } },
  spruce: { label: 'Spruces', size: 1.6, height: 3.0, tree: true, paint(g, s, rng, o) {
    // From above a spruce is its tiers of short, stiff, blue-green needles, rising to its tip in the middle: a tight, ragged-edged
    // crown, each tier lighter than the one beneath and stepped toward the light, the tip a small bright tuft.
    const R = s * 0.86, hull = blob(rng, 0, 0, R, R, 22, 0.16);
    trace(g, moved(hull, 0, 0, 0.8)); g.fillStyle = '#06100c'; g.fill();
    for (let tier = 0; tier < 4; tier++) {
      const r = R * (1 - tier * 0.22), sx = -tier * R * 0.04, sy = -tier * R * 0.05, ring = blob(rng, sx, sy, r, r, 18, 0.18);
      needleCrown(g, rng, r, o, { hull: ring, cx: sx, cy: sy, set: [shade('#0c1a16', tier * 0.08), shade('#22403a', tier * 0.08), shade('#3a6052', tier * 0.08), shade('#6a8c78', tier * 0.06)], bed: tier ? null : '#081410', tufts: Math.round(crown(r, o, 520)), len: 0.1, n: 11, clumps: 5 + tier });
    }
    return [hull];
  } },
  palm: { label: 'Palms', size: 2.0, height: 2.6, tree: true, paint(g, s, rng, o) {
    // Fronds from a rough brown crown: each a bending rib with narrow leaflets on both sides, dark at the base, yellowing out.
    // Two layers: older fronds beneath, long, drooping, darker and some browned; young ones above, shorter and fresher. Leaflets
    // narrow and many, unevenly long, a few torn away, so no frond is a neat comb.
    const turn = rng() * 6.28, base = '#1a280c', tip = o.season === 'autumn' ? '#9a8e36' : '#7c9634', out = [], fronds = [];
    const low = 8 + Math.floor(rng() * 3), high = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < low; i++) fronds.push([turn + (i / low) * 6.28 + (rng() - 0.5) * 0.4, s * (0.8 + rng() * 0.2), (rng() - 0.5) * 0.6, rng() < 0.25, 0]);
    for (let i = 0; i < high; i++) fronds.push([turn + 0.3 + (i / high) * 6.28 + (rng() - 0.5) * 0.5, s * (0.5 + rng() * 0.2), (rng() - 0.5) * 0.4, false, 1]);
    fronds.sort((p, q) => p[4] - q[4] || towardLight(Math.cos(p[0]), Math.sin(p[0]), 1) - towardLight(Math.cos(q[0]), Math.sin(q[0]), 1));
    for (const [a, len, bend, dead, layer] of fronds) {
      const c = Math.cos(a), sn = Math.sin(a), at = (t) => [c * len * t - sn * bend * len * t * t, sn * len * t + c * bend * len * t * t], dark = layer ? 0 : 0.18;
      for (let k = 2; k <= 30; k++) { const t = k / 31, [x, y] = at(t), [nx, ny] = at(t + 0.01), dir = Math.atan2(ny - y, nx - x); for (const side of [-1, 1]) { if (rng() < 0.08) continue; const l = len * 0.28 * Math.sin(t * Math.PI * 0.85 + 0.15) * (0.7 + rng() * 0.45), lit = towardLight(Math.cos(a + side * 0.6), Math.sin(a + side * 0.6), 1) * 0.12; leaf(g, x, y, l, dir + side * (0.95 + rng() * 0.25), dead ? mix('#5a4422', '#9a7e44', t) : shade(mix(base, tip, 0.2 + t * 0.65 + (rng() - 0.5) * 0.2), lit - dark), o.ink * 0.4, 0.12); } }
      line(g, Array.from({ length: 10 }, (_, k) => at(k / 9)), 'rgba(8,10,4,0.85)', o.ink * 1.4); line(g, Array.from({ length: 10 }, (_, k) => at(k / 9)), dead ? '#7a6038' : shade('#5e6a26', -dark), o.ink * 0.7);
      if (!layer) out.push([[0, 0], at(0.5).map((v, j) => v + (j ? c : -sn) * len * 0.22), at(1), at(0.5).map((v, j) => v - (j ? c : -sn) * len * 0.22)]);
    }
    const husk = blob(rng, 0, 0, s * 0.12, s * 0.12, 10, 0.25); trace(g, husk); g.fillStyle = '#5a4428'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
    return out;
  } },
  deadTree: { label: 'Dead trees', size: 2.0, height: 2.0, tree: true, paint(g, s, rng, o) {
    // Grey and gnarled, bare in every season, one limb snapped short.
    return bareTree(g, rng, s, o, { color: '#625a4e', count: 5, reach: 0.42, width: 0.06, depth: 3, gnarl: 1.0 });
  } },
  stump: { label: 'Stumps', size: 0.9, height: 0.3, paint(g, s, rng, o) {
    // As the map draws them: the trunk flaring into roots of every length and breadth, pale grey-brown weathered bark with long
    // grain running out along each root, inked; on top the cut wood with its rings and cracks, or a hollow dark inside a crumbling
    // pale ring; now and then a few small mushrooms at its foot.
    const roots = 5 + Math.floor(rng() * 4), spots = Array.from({ length: roots }, (_, i) => ({ a: ((i + (rng() - 0.5) * 0.6) / roots) * 6.283, len: 0.25 + rng() * 0.75, wide: 0.5 + rng() * 0.7 })), outer = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * 6.283; let flare = 0;
      for (const r of spots) { let d = Math.abs(((a - r.a + Math.PI * 3) % 6.283) - Math.PI); d /= (0.42 * r.wide); flare = Math.max(flare, r.len * Math.max(0, 1 - d * d) ** 1.6); }
      const rr = s * (0.5 + 0.48 * flare) * (1 + (noise(a * 4, 3) - 0.5) * 0.12); outer.push([Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    g.save(); poly(g, outer); g.clip();
    const bg = g.createRadialGradient(-s * 0.25, -s * 0.25, 0, 0, 0, s); bg.addColorStop(0, '#7e6c52'); bg.addColorStop(0.55, '#5e4e3a'); bg.addColorStop(1, '#382c20'); g.fillStyle = bg; g.fillRect(-s, -s, s * 2, s * 2);
    // Grain: long lines out along each root, and around the trunk between them.
    for (const r of spots) for (let k = 0; k < 9; k++) { const a = r.a + (rng() - 0.5) * 0.5 * r.wide, d0 = s * (0.2 + rng() * 0.2), d1 = s * (0.5 + 0.48 * r.len) * (0.7 + rng() * 0.3); grainAlong(g, rng, Math.cos(a) * d0, Math.sin(a) * d0, Math.cos(a) * d1, Math.sin(a) * d1, s * 0.08, 1, o); }
    for (let k = 0; k < 28; k++) { const a = rng() * 6.283, d0 = s * (0.3 + rng() * 0.2), d1 = d0 + s * (0.1 + rng() * 0.2); line(g, [[Math.cos(a) * d0, Math.sin(a) * d0], [Math.cos(a + 0.03) * d1, Math.sin(a + 0.03) * d1]], 'rgba(20,14,6,0.6)', o.ink * (0.5 + rng() * 0.6)); }
    if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.2 * o.wet})`; g.fillRect(-s, -s, s * 2, s * 2); }
    g.restore(); poly(g, outer); g.strokeStyle = INK; g.lineWidth = o.ink * 1.7; g.lineJoin = 'round'; g.stroke();
    const top = blob(rng, -s * 0.03, -s * 0.03, s * 0.44, s * 0.41, 18, 0.1);
    if (rng() < 0.5) {
      // Hollow: a pale rotten rim broken into short pieces, black inside.
      trace(g, top); g.fillStyle = '#a8977a'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 1.3; g.stroke();
      const hole = moved(top, -s * 0.03, -s * 0.03, 0.82); trace(g, hole); g.fillStyle = '#170b05'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke();
      for (let i = 0; i < 22; i++) { const k = Math.floor((i / 22) * top.length), [ax, ay] = top[k], [bx, by] = hole[k]; line(g, [[ax, ay], [bx, by]], 'rgba(24,16,8,0.8)', o.ink * 0.8); }
    } else {
      woodEnd(g, rng, -s * 0.03, -s * 0.03, s * 0.42, s * 0.39, o);
      // Cracks out from the heart, as old cut wood splits.
      for (let i = 0; i < 3; i++) { const a = rng() * 6.283; line(g, wander(rng, -s * 0.03, -s * 0.03, a, 4, s * 0.1, 0.4), 'rgba(18,10,4,0.8)', o.ink * (0.8 + rng() * 0.5)); }
    }
    if (o.season !== 'winter' && rng() < 0.5) for (let i = 0; i < 3; i++) { const a = rng() * 6.28, d = s * (0.56 + rng() * 0.1); mushroomCap(g, rng, Math.cos(a) * d, Math.sin(a) * d, o.unit * (0.025 + rng() * 0.02), '#6e2a1c', o); }
    return [outer];
  } },
  log: { label: 'Fallen logs', size: 1.8, height: 0.35, paint(g, s, rng, o) {
    // As the map draws them: deep bark of overlapping plates, each its own little inked scale, the dark showing in the cracks between;
    // one end broken off ragged, the other sawn with its rings showing, or both broken; a few snapped-off twigs.
    const len = s * 0.92, w = s * (0.18 + rng() * 0.05), sawn = rng() < 0.6, top = [], bottom = [];
    const jag = (x, side) => (noise(x * 3.1, side) - 0.5) * w * 0.25;
    for (let i = 0; i <= 14; i++) { const t = i / 14, x = -len + 2 * len * t, taper = 1 - 0.18 * t; top.push([x, -w * taper + jag(t, 1)]); bottom.push([x, w * taper + jag(t, 5)]); }
    // The broken end(s): a ragged zigzag.
    // A snapped end: splinters of every length, a few long ones standing proud, the rest short and torn.
    const broken = (x, dir, h) => { const n = 9 + Math.floor(rng() * 4); return Array.from({ length: n }, (_, k) => { const t = k / (n - 1), long = rng() < 0.25 ? 1.1 + rng() * 0.8 : rng() * 0.5; return [x + dir * (k % 2 ? long : rng() * 0.15) * w * 0.8, -h + 2 * h * t + (rng() - 0.5) * h * 0.08]; }); };
    const right = sawn ? [] : broken(len, 1, w * 0.82), left = broken(-len, -1, w).reverse();
    const pts = [...top, ...right, ...bottom.slice().reverse(), ...left];
    g.save(); poly(g, pts); g.clip();
    g.fillStyle = '#1e140c'; g.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4);
    // Plates, row by row along it, lighter on the side toward the light.
    for (let row = -3; row <= 3; row++) for (let x = -len - w; x < len + w;) {
      const pl = w * (0.9 + rng() * 1.1), ph = w * (0.16 + rng() * 0.14), cy = (row / 3.4) * w + (rng() - 0.5) * w * 0.16, cx = x + pl / 2, lit = -row / 3;
      const plate = blob(rng, cx, cy, pl / 2, ph / 2, 10, 0.32, 0);
      trace(g, plate); g.fillStyle = mix(mix('#2e2014', '#5e4630', 0.5 + lit * 0.45), '#1e140a', rng() * 0.35); g.fill(); g.strokeStyle = 'rgba(8,4,0,0.95)'; g.lineWidth = o.ink * 1.1; g.stroke();
      if (rng() < 0.5) line(g, [[cx - pl * 0.3, cy], [cx + pl * 0.3, cy + (rng() - 0.5) * ph * 0.3]], 'rgba(150,120,85,0.3)', o.ink * 0.5);
      x += pl * (0.6 + rng() * 0.3);
    }
    // Moss in the cracks along its shaded side: soft olive, not dots.
    if (o.season !== 'winter' && rng() < 0.5) { const mx = (rng() - 0.5) * len; g.save(); g.filter = `blur(${Math.max(1, w * 0.12)}px)`; g.globalCompositeOperation = 'multiply'; g.fillStyle = 'rgba(120,130,60,0.7)'; g.beginPath(); g.ellipse(mx, w * 0.45, len * (0.2 + rng() * 0.2), w * 0.35, 0, 0, 6.283); g.fill(); g.restore(); }
    if (o.snow > 0) for (let i = 0; i < 5; i++) snowPatch(g, rng, -len * 0.75 + i * len * 0.35 + (rng() - 0.5) * len * 0.1, -w * 0.45, len * 0.2, w * 0.45 * o.snow, o);
    if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.2 * o.wet})`; g.fillRect(-s * 1.2, -s * 1.2, s * 2.4, s * 2.4); }
    g.restore();
    poly(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 1.5; g.lineJoin = 'round'; g.stroke();
    // Snapped twigs along its sides.
    // Snapped branch stubs, leaning toward the log's top end, tapering, bark-dark with a pale broken tip.
    for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) {
      const x = (rng() - 0.5) * len * 1.5, side = rng() < 0.5 ? -1 : 1, y = side * w * 0.8, a = side * (Math.PI / 2) - side * (0.5 + rng() * 0.5), l = w * (0.35 + rng() * 0.35), ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l, b = w * 0.11;
      const nx = -Math.sin(a), ny = Math.cos(a), stub = [[x + nx * b, y + ny * b], [ex + nx * b * 0.5, ey + ny * b * 0.5], [ex - nx * b * 0.5, ey - ny * b * 0.5], [x - nx * b, y - ny * b]];
      poly(g, stub); g.fillStyle = '#3a2a1a'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink; g.stroke();
      g.beginPath(); g.arc(ex, ey, b * 0.5, 0, 6.283); g.fillStyle = '#9a7e58'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.7; g.stroke();
    }
    // A sawn end, seen from above: almost edge-on, only a narrow sliver of the cut face showing past the bark, a few rings curving
    // across it, the saw line inked.
    // (Inside the log's own outline, from its true top edge to its bottom, so it never sticks out past the bark.)
    if (sawn) {
      const ex = len, yTop = top[top.length - 1][1], yBot = bottom[bottom.length - 1][1], mid = (yTop + yBot) / 2, h = (yBot - yTop) / 2, d = w * 0.16;
      const curve = Array.from({ length: 15 }, (_, k) => { const t = (k / 14) * Math.PI - Math.PI / 2; return [ex - d * Math.cos(t), mid + Math.sin(t) * h]; });
      g.save(); poly(g, pts); g.clip();
      poly(g, [[ex + 2, yTop], ...curve, [ex + 2, yBot]]); g.fillStyle = '#9a7e58'; g.fill();
      for (let k = 1; k < 5; k++) { g.beginPath(); g.ellipse(ex, mid, d * (k / 5), h * (k / 5), 0, Math.PI / 2, Math.PI * 1.5); g.strokeStyle = 'rgba(60,40,20,0.55)'; g.lineWidth = o.ink * 0.5; g.stroke(); }
      line(g, curve, INK, o.ink * 1.2);
      g.restore();
    }
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
    // A clump of small dull caps (red-brown, tan or ochre, as the map's), the big ones first and little ones crowding round them,
    // one or two lying over with their gills showing; a little moss and leaf litter at their feet.
    const out = [], color = pick(rng, ['#6e2a1c', '#7a5634', '#86683a']), caps = [];
    speckle(g, rng, 0, 0, s * 0.55, s * 0.5, 40, MOSS[o.season] ?? MOSS.summer, o.unit * 0.01);
    for (let i = 0; i < 3 + Math.floor(rng() * 4); i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.5; caps.push([Math.cos(a) * d, Math.sin(a) * d, o.unit * (0.05 + rng() * 0.06)]); }
    caps.sort((p, q) => q[2] - p[2]);
    caps.forEach(([x, y, r], i) => { const pts = mushroomCap(g, rng, x, y, r, mix(color, shade(color, (rng() - 0.5) * 0.3), 0.6), o, i > 0 && rng() < 0.2); if (pts) out.push(pts); });
    return out.length ? out : [blob(rng, 0, 0, s * 0.3, s * 0.3, 8, 0.2)];
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
    // Clumps of wildflowers: a rosette of small inked leaves each, and over it a few flowers of one muted colour (white, pale
    // yellow, lilac, dusky pink), each five inked petals round a dot, some still in bud.
    const colors = o.season === 'autumn' ? ['#c8a050', '#b07040'] : o.season === 'spring' ? ['#ece6d2', '#e2d070', '#b8a4d8', '#d8a0b0'] : ['#e4dcc4', '#d8c460', '#a894c8', '#c88c9c'];
    const green = (LEAVES[o.season] ?? LEAVES.summer).slice(0, 3);
    for (let c = 0; c < 4 + Math.floor(rng() * 3); c++) {
      const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.6, cx = Math.cos(a) * d, cy = Math.sin(a) * d, color = pick(rng, colors);
      for (let k = 0; k < 5; k++) leaf(g, cx, cy, o.unit * (0.07 + rng() * 0.04), (k / 5) * 6.283 + rng() * 0.6, pick(rng, green), o.ink * 0.35, 0.3);
      for (let f = 0; f < 2 + Math.floor(rng() * 3); f++) {
        const fx = cx + (rng() - 0.5) * o.unit * 0.12, fy = cy + (rng() - 0.5) * o.unit * 0.12;
        if (rng() < 0.2) { g.beginPath(); g.arc(fx, fy, o.unit * 0.012, 0, 6.283); g.fillStyle = shade(color, -0.2); g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.5; g.stroke(); continue; }
        leaf(g, fx, fy, o.unit * (0.05 + rng() * 0.02), rng() * 6.283, color, o.ink * 0.35, 0.6, 'flower');
      }
    }
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
    o = { ...o, ink: o.ink * 0.6 };
    // Old bones in the dirt: yellowed and stained, darker where they lie in the earth, heavily inked. Long bones with knobbed
    // ends, often a ribcage's curve of ribs off a broken spine, sometimes a skull, and splinters round them.
    const out = [], ivory = o.cave ? ['#b8b09a', '#8a826c', '#4e483a'] : ['#cdbf98', '#9a8a64', '#54482e'];
    const stain = (pts) => { g.save(); trace(g, pts); g.clip(); for (let i = 0; i < 5; i++) { const [x, y] = pick(rng, pts); g.fillStyle = `rgba(${rng() < 0.5 ? '70,48,20' : '40,34,18'},${0.15 + rng() * 0.2})`; g.beginPath(); g.ellipse(x, y, s * (0.04 + rng() * 0.06), s * (0.03 + rng() * 0.04), rng() * 3, 0, 6.283); g.fill(); } g.restore(); };
    const fill = (pts, x0, y0, x1, y1) => { const bg = g.createLinearGradient(x0, y0, x1, y1); bg.addColorStop(0, ivory[0]); bg.addColorStop(0.6, ivory[1]); bg.addColorStop(1, ivory[2]); trace(g, pts); g.fillStyle = bg; g.fill(); stain(pts); trace(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke(); };
    // A long bone from (x, y) along a: a shaft pinched in the middle, each end two knuckles.
    const longBone = (x, y, a, len, w, broken) => {
      const c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [x + c * u - sn * v, y + sn * u + c * v];
      // Round the outline: the shaft's top edge to a knuckled end, its bottom edge back, the other end knuckled or snapped.
      const end = [[0.72, 0.55], [0.92, 1.25], [1.04, 1.0], [1.1, 0.45], [1.0, 0.05], [1.1, -0.4], [1.04, -0.9], [0.94, -1.15], [0.72, -0.55]];
      const far = broken ? [[-0.34, -0.55], [-0.42, -0.2], [-0.3, 0.1], [-0.38, 0.55]] : end.map(([u, v]) => [-u, -v]);
      const pts = [...end, [0, -0.5], ...far, [0, 0.5]].map(([u, v]) => at(u * len, v * w * (0.9 + rng() * 0.2)));
      fill(pts, ...at(-len, -w * 2), ...at(len, w * 2)); line(g, [at(-len * 0.6, -w * 0.15), at(len * 0.6, -w * 0.2)], 'rgba(255,248,225,0.35)', Math.max(0.6, w * 0.25)); out.push(pts);
    };
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) longBone((rng() - 0.5) * s * 0.9, (rng() - 0.5) * s * 0.9, rng() * 6.28, s * (0.22 + rng() * 0.16), o.unit * 0.022, rng() < 0.3);
    if (rng() < 0.55) {
      // A ribcage: a spine of knuckled vertebrae, and ribs curving off one side of it, a few broken short.
      const sa = rng() * 6.28, sx = (rng() - 0.5) * s * 0.4, sy = (rng() - 0.5) * s * 0.4, c = Math.cos(sa), sn = Math.sin(sa), side = rng() < 0.5 ? 1 : -1, len = s * 0.55;
      for (let k = 0; k < 6; k++) { const u = (k / 5 - 0.5) * len, bx = sx + c * u, by = sy + sn * u, reach = s * (0.32 + Math.sin((k / 5) * Math.PI) * 0.14) * (rng() < 0.2 ? 0.5 : 1), p = []; for (let t = 0; t <= 6; t++) { const f = t / 6, ang = sa + side * (Math.PI / 2) - side * f * 1.2; p.push([bx + Math.cos(ang) * reach * f + c * f * f * reach * 0.35, by + Math.sin(ang) * reach * f + sn * f * f * reach * 0.35]); } line(g, p, INK, o.unit * 0.02 + o.ink * 1.1); line(g, p, ivory[1], o.unit * 0.02); line(g, p.map(([px, py]) => [px - 0.6, py - 0.6]), ivory[0], o.unit * 0.008); out.push(p); }
      for (let k = 0; k < 8; k++) { const u = (k / 7 - 0.5) * len * 1.15, v = blob(rng, sx + c * u, sy + sn * u, o.unit * 0.026, o.unit * 0.02, 8, 0.15); fill(v, sx + c * u - s * 0.05, sy + sn * u - s * 0.05, sx + c * u + s * 0.05, sy + sn * u + s * 0.05); out.push(v); }
    }
    if (rng() < 0.5) {
      // A skull, face up: the cranium, deep sockets, the nose hole, a row of teeth along the jaw, a crack across the dome.
      const kx = (rng() - 0.5) * s * 0.6, ky = (rng() - 0.5) * s * 0.6, r = s * 0.17, turn = rng() * 6.28, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [kx + c * u - sn * v, ky + sn * u + c * v];
      const dome = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * 6.283, rr = r * (Math.sin(t) > 0 ? 1 : 0.82), u = Math.cos(t) * rr * 0.85, v = Math.sin(t) * rr * 1.05 - (Math.sin(t) < 0 ? 0 : 0); dome.push(at(u, v - r * 0.1)); }
      fill(dome, ...at(-r, -r), ...at(r, r));
      for (const k of [-1, 1]) { g.beginPath(); const [ex, ey] = at(k * r * 0.36, r * 0.32); g.ellipse(ex, ey, r * 0.22, r * 0.19, turn, 0, 6.283); g.fillStyle = '#140c06'; g.fill(); }
      poly(g, [at(0, r * 0.52), at(-r * 0.09, r * 0.7), at(r * 0.09, r * 0.7)]); g.fillStyle = '#140c06'; g.fill();
      for (let k = -3; k <= 3; k++) line(g, [at(k * r * 0.1, r * 0.8), at(k * r * 0.1, r * 0.92)], 'rgba(20,12,6,0.8)', Math.max(0.6, o.ink * 0.6));
      line(g, wander(rng, ...at(-r * 0.2, -r * 0.7), turn + 1.2, 3, r * 0.2, 0.8), 'rgba(20,12,6,0.6)', Math.max(0.5, o.ink * 0.5)); out.push(dome);
    }
    // Splinters.
    for (let i = 0; i < 4; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.85, x = Math.cos(a) * d, y = Math.sin(a) * d, b = rng() * 6.28, l = s * (0.04 + rng() * 0.05); line(g, [[x, y], [x + Math.cos(b) * l, y + Math.sin(b) * l]], INK, o.unit * 0.012 + o.ink); line(g, [[x, y], [x + Math.cos(b) * l, y + Math.sin(b) * l]], ivory[1], o.unit * 0.012); }
    return out;
  } },
  crate: { label: 'Crates', size: 0.8, height: 0.55, paint(g, s, rng, o) {
    // As the map draws one: a lid of planks laid across it, worn and grained, inside a frame — iron bands with rivets, or on a
    // plainer crate boards nailed round the edge; heavy ink round it all, the lit edge toward the top left.
    const r = s * 0.8, turn = (rng() - 0.5) * 0.9, ct = Math.cos(turn), st = Math.sin(turn), at = (x, y) => [x * ct - y * st, x * st + y * ct], box = [at(-r, -r), at(r, -r), at(r, r), at(-r, r)];
    const iron = rng() < 0.65, band = r * (iron ? 0.22 : 0.24), diagonal = rng() < 0.4, braced = rng() < 0.55;
    g.save(); g.rotate(turn);
    g.save(); g.beginPath(); g.rect(-r, -r, r * 2, r * 2); g.clip();
    g.fillStyle = '#4e3a24'; g.fillRect(-r, -r, r * 2, r * 2);
    // The lid's planks, across or slanting, each its own shade with grain and a dark seam.
    const pw = r * 0.36;
    g.save(); if (diagonal) g.rotate(Math.PI / 4);
    for (let k = -4; k <= 4; k++) {
      const y0 = k * pw - pw / 2, shadeK = (rng() - 0.5) * 0.25;
      g.fillStyle = mix('#64482a', shade('#64482a', shadeK), 0.8); g.fillRect(-r * 1.5, y0, r * 3, pw);
      grainAlong(g, rng, -r * 1.5, y0 + pw / 2, r * 1.5, y0 + pw / 2, pw, 4, o);
      line(g, [[-r * 1.5, y0], [r * 1.5, y0]], 'rgba(14,8,2,0.9)', o.ink * 1.1);
      if (rng() < 0.4) { const kx = (rng() - 0.5) * r * 1.4; g.beginPath(); g.ellipse(kx, y0 + pw / 2, pw * 0.16, pw * 0.1, 0, 0, 6.283); g.strokeStyle = 'rgba(30,18,8,0.7)'; g.lineWidth = o.ink * 0.6; g.stroke(); }
    }
    g.restore();
    // An X of two boards braced across the lid, as on the mine's crates.
    if (braced) for (const [ax, ay, bx, by] of [[-r, -r, r, r], [r, -r, -r, r]]) {
      const bw = r * 0.22, len = Math.hypot(bx - ax, by - ay), ang = Math.atan2(by - ay, bx - ax);
      g.save(); g.translate((ax + bx) / 2, (ay + by) / 2); g.rotate(ang);
      g.fillStyle = '#6e5232'; g.fillRect(-len / 2, -bw / 2, len, bw); grainAlong(g, rng, -len / 2, 0, len / 2, 0, bw, 3, o);
      g.strokeStyle = INK; g.lineWidth = o.ink * 1.2; g.strokeRect(-len / 2, -bw / 2, len, bw); g.restore();
    }
    // Light: the lid catches it toward the top left.
    const lg = g.createLinearGradient(-r, -r, r, r); lg.addColorStop(0, 'rgba(255,240,210,0.08)'); lg.addColorStop(1, 'rgba(10,6,2,0.38)'); g.fillStyle = lg; g.fillRect(-r, -r, r * 2, r * 2);
    // The frame.
    const ring = () => { g.beginPath(); g.rect(-r, -r, r * 2, r * 2); g.rect(-r + band, -r + band, (r - band) * 2, (r - band) * 2); };
    ring(); g.fillStyle = iron ? '#55534e' : '#5a4228'; g.fill('evenodd');
    if (!iron) for (const [x0, y0, x1, y1] of [[-r, -r + band / 2, r, -r + band / 2], [-r, r - band / 2, r, r - band / 2], [-r + band / 2, -r, -r + band / 2, r], [r - band / 2, -r, r - band / 2, r]]) grainAlong(g, rng, x0, y0, x1, y1, band, 3, o);
    line(g, [[-r, -r + 1], [r, -r + 1]], iron ? 'rgba(200,200,190,0.35)' : 'rgba(220,190,140,0.3)', o.ink); line(g, [[-r + 1, -r], [-r + 1, r]], iron ? 'rgba(200,200,190,0.3)' : 'rgba(220,190,140,0.25)', o.ink);
    // Rivets or nails along it.
    const n = iron ? 4 : 3;
    for (let i = 0; i <= n; i++) for (const side of [0, 1, 2, 3]) {
      const t = -r + band / 2 + (i / n) * (r * 2 - band), [x, y] = side === 0 ? [t, -r + band / 2] : side === 1 ? [t, r - band / 2] : side === 2 ? [-r + band / 2, t] : [r - band / 2, t];
      g.beginPath(); g.arc(x, y, band * (iron ? 0.2 : 0.12), 0, 6.283); g.fillStyle = iron ? '#2a2826' : '#262422'; g.fill(); g.fillStyle = 'rgba(220,220,210,0.4)'; g.beginPath(); g.arc(x - band * 0.05, y - band * 0.05, band * 0.06, 0, 6.283); g.fill();
    }
    snowPatch(g, rng, -r * 0.3, -r * 0.35, r * 0.6 * o.snow, r * 0.45 * o.snow, o);
    if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.22 * o.wet})`; g.fillRect(-r, -r, r * 2, r * 2); }
    g.restore();
    g.beginPath(); g.rect(-r + band, -r + band, (r - band) * 2, (r - band) * 2); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke();
    g.beginPath(); g.rect(-r, -r, r * 2, r * 2); g.strokeStyle = INK; g.lineWidth = o.ink * 2.4; g.stroke();
    g.restore();
    return [box];
  } },
  barrel: { label: 'Barrels', size: 0.6, height: 0.6, paint(g, s, rng, o) {
    // From above: the iron hoop round its rim with its rivets, the dark end grain of the staves' tops (the chime), and the head of
    // planks laid across, grained and seamed, with its bung; worn, lit toward the top left, inked.
    const r = s * 0.85, pts = Array.from({ length: 32 }, (_, i) => [Math.cos(i / 32 * 6.283) * r, Math.sin(i / 32 * 6.283) * r]), turn = rng() * 6.283;
    const circle = (k) => { g.beginPath(); g.arc(0, 0, r * k, 0, 6.283); };
    circle(1); g.fillStyle = '#3e3c38'; g.fill();
    // The hoop: grey iron, a pale edge toward the light, rivets round it.
    const hg = g.createLinearGradient(-r, -r, r, r); hg.addColorStop(0, '#6a6862'); hg.addColorStop(1, '#2e2c28'); circle(1); g.fillStyle = hg; g.fill();
    for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.283 + turn; g.beginPath(); g.arc(Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, r * 0.035, 0, 6.283); g.fillStyle = '#1e1c1a'; g.fill(); }
    // The chime: the staves' ends, a ring of short dark segments.
    circle(0.86); g.fillStyle = '#4a3420'; g.fill();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283 + turn; line(g, [[Math.cos(a) * r * 0.74, Math.sin(a) * r * 0.74], [Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.86]], 'rgba(12,8,4,0.85)', o.ink * 0.8); }
    // The head: planks across, grained.
    g.save(); circle(0.74); g.clip(); g.rotate(turn);
    const pw = r * 0.3;
    for (let k = -3; k <= 3; k++) { const y0 = k * pw - pw / 2; g.fillStyle = mix('#6e5232', shade('#6e5232', (rng() - 0.5) * 0.25), 0.8); g.fillRect(-r, y0, r * 2, pw); grainAlong(g, rng, -r, y0 + pw / 2, r, y0 + pw / 2, pw, 4, o); line(g, [[-r, y0], [r, y0]], 'rgba(14,8,2,0.9)', o.ink * 1); }
    // The bung, plugged.
    const bx = r * 0.32, by = pw * 0.1; g.beginPath(); g.arc(bx, by, r * 0.09, 0, 6.283); g.fillStyle = '#5a3e22'; g.fill(); g.strokeStyle = INK; g.lineWidth = o.ink * 0.8; g.stroke();
    g.restore();
    const lg = g.createLinearGradient(-r, -r, r, r); lg.addColorStop(0, 'rgba(255,240,210,0.12)'); lg.addColorStop(1, 'rgba(10,6,2,0.32)'); circle(1); g.fillStyle = lg; g.fill();
    g.save(); circle(0.74); g.clip(); snowPatch(g, rng, -r * 0.2, -r * 0.2, r * 0.55 * o.snow, r * 0.5 * o.snow, o); if (o.wet > 0) { g.fillStyle = `rgba(6,8,10,${0.22 * o.wet})`; g.fillRect(-r, -r, r * 2, r * 2); } g.restore();
    circle(0.74); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke(); circle(0.86); g.strokeStyle = 'rgba(14,10,6,0.9)'; g.lineWidth = o.ink; g.stroke(); circle(1); g.strokeStyle = INK; g.lineWidth = o.ink * 2; g.stroke();
    return [pts];
  } },
  campfire: { label: 'Old campfires', size: 0.9, height: 0.1, paint(g, s, rng, o) {
    // As the maps draw one: scorched ground round it, a tight ring of dark inked stones touching each other, and inside it a heap of
    // charred sticks and coals over grey ash; a few wood chips scattered about.
    g.save(); g.filter = `blur(${Math.max(1, s * 0.08)}px)`; trace(g, blob(rng, 0, 0, s * 0.95, s * 0.9, 14, 0.25)); g.fillStyle = 'rgba(14,10,6,0.55)'; g.fill(); g.restore();
    const ring = s * 0.56, ash = blob(rng, 0, 0, ring * 0.92, ring * 0.9, 14, 0.12);
    g.save(); trace(g, ash); g.clip(); const ag = g.createRadialGradient(0, 0, 0, 0, 0, ring); ag.addColorStop(0, '#4e4844'); ag.addColorStop(0.7, '#262220'); ag.addColorStop(1, '#100c08'); g.fillStyle = ag; g.fillRect(-s, -s, s * 2, s * 2);
    speckle(g, rng, 0, 0, ring * 0.7, ring * 0.7, 70, ['#7a7470', '#2e2a26', '#9a948c'], o.unit * 0.008);
    // A heap of charred sticks and coals, black, a few still brown at their ends.
    g.save(); trace(g, blob(rng, 0, 0, ring * 0.6, ring * 0.55, 10, 0.3)); g.fillStyle = '#0e0a08'; g.fill(); g.restore();
    for (let i = 0; i < 16; i++) { const a = rng() * 6.283, l = ring * (0.35 + rng() * 0.55), cx = (rng() - 0.5) * ring * 0.6, cy = (rng() - 0.5) * ring * 0.6, p = [[cx - Math.cos(a) * l / 2, cy - Math.sin(a) * l / 2], [cx + Math.cos(a) * l / 2, cy + Math.sin(a) * l / 2]], w = o.unit * (0.025 + rng() * 0.03); line(g, p, INK, w + o.ink * 1.3); line(g, p, rng() < 0.25 ? '#3e2c1c' : '#16110d', w); if (rng() < 0.4) line(g, p, 'rgba(120,110,100,0.3)', w * 0.3); }
    g.restore();
    // The ring: a stone each step round, big enough to touch the next.
    const out = [], n = 11 + Math.floor(rng() * 4), size = (Math.PI * ring) / n;
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rng() * 0.12, d = ring * (1 + (rng() - 0.5) * 0.08), pts = blob(rng, Math.cos(a) * d, Math.sin(a) * d, size * (0.95 + rng() * 0.3), size * (0.8 + rng() * 0.25), 8, 0.22); stone(g, rng, pts, pick(rng, o.cave ? CAVE_STONES : ['#3e3a35', '#36332f', '#46423b']), o, { cracks: 0, ledges: 0, ink: 1.3 }); out.push(pts); }
    for (let i = 0; i < 9; i++) { const a = rng() * 6.283, d = s * (0.72 + rng() * 0.25), x = Math.cos(a) * d, y = Math.sin(a) * d, b = rng() * 6.283, l = o.unit * (0.04 + rng() * 0.05); line(g, [[x, y], [x + Math.cos(b) * l, y + Math.sin(b) * l]], INK, o.ink * 2); line(g, [[x, y], [x + Math.cos(b) * l, y + Math.sin(b) * l]], '#8a6a42', o.ink * 0.9); }
    return out;
  } },
  roots: { label: 'Roots', size: 1.2, height: 0.05, paint(g, s, rng, o) {
    const out = [];
    for (let i = 0; i < 4; i++) { const p = wander(rng, (rng() - 0.5) * s * 0.4, (rng() - 0.5) * s * 0.4, rng() * 6.28, 7, s * 0.14, 0.9), w = o.unit * (0.035 + rng() * 0.02); line(g, p, INK, w + o.ink * 1.6); line(g, p, '#4a3622', w); line(g, p.map(([x, y]) => [x - w * 0.18, y - w * 0.18]), 'rgba(150,118,80,0.4)', w * 0.3); out.push([...p, ...p.slice().reverse().map(([x, y]) => [x + 1, y + 1])]); }
    return out;
  } },
  crystals: { label: 'Crystals', size: 0.6, height: 0.6, paint(g, s, rng, o) {
    o = { ...o, ink: o.ink * 0.6 };
    // A cluster grown out of a lump of rock, seen from above: shards leaning out every way from its heart, each a prism with a
    // lit plane and a shadowed one meeting along its ridge, a pale tip, heavily inked. Muted, mineral colours, not candy.
    const out = [], [hue, glow] = pick(rng, [['#6e5a7e', '170,140,210'], ['#4e727a', '130,190,200'], ['#9a968a', '210,210,190'], ['#5e7a5e', '150,200,150']]);
    const rock = blob(rng, 0, 0, s * 0.5, s * 0.42, 10, 0.25); standing(g, rng, rock, pick(rng, stonesOf(o)), o, { lift: 0.14, cracks: 1, ledges: 0, facets: 1 }); out.push(rock);
    if (o.night || o.cave) { const gg = g.createRadialGradient(0, 0, 0, 0, 0, s); gg.addColorStop(0, `rgba(${glow},0.28)`); gg.addColorStop(1, `rgba(${glow},0)`); g.fillStyle = gg; g.fillRect(-s, -s, s * 2, s * 2); }
    const shards = []; for (let i = 0; i < 6 + Math.floor(rng() * 4); i++) shards.push([rng() * 6.28, s * (0.35 + rng() * 0.5), s * (0.07 + rng() * 0.06), (rng() - 0.5) * s * 0.2, (rng() - 0.5) * s * 0.2]);
    // Shards leaning away from the light first, so those toward it stand over them; the tallest last of all.
    shards.sort((p, q) => towardLight(Math.cos(q[0]), Math.sin(q[0]), 1) - towardLight(Math.cos(p[0]), Math.sin(p[0]), 1) || p[1] - q[1]);
    for (const [a, len, w, bx, by] of shards) {
      const c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [bx + c * u - sn * v, by + sn * u + c * v];
      const l = [at(0, w), at(len * 0.78, w), at(len, 0)], r = [at(len, 0), at(len * 0.78, -w), at(0, -w)], ridge = [at(0, w * 0.1), at(len * 0.8, w * 0.05)];
      const litSide = towardLight(-sn, c, 1) > 0, light = shade(hue, 0.18), dark = shade(hue, -0.35);
      poly(g, [...l, ...ridge.slice().reverse()]); g.fillStyle = litSide ? light : dark; g.fill();
      poly(g, [...ridge, ...r]); g.fillStyle = litSide ? dark : light; g.fill();
      poly(g, [at(len * 0.78, w * 0.6), at(len, 0), at(len * 0.78, -w * 0.6), at(len * 0.82, 0)]); g.fillStyle = 'rgba(240,240,232,0.35)'; g.fill();
      line(g, [...ridge, at(len, 0)], 'rgba(255,255,245,0.4)', Math.max(0.6, o.ink * 0.5));
      for (let k = 0; k < 2; k++) { const u = len * (0.2 + rng() * 0.5); line(g, [at(u, w * 0.8), at(u + len * 0.08, w * 0.2)], 'rgba(10,8,14,0.35)', Math.max(0.5, o.ink * 0.4)); }
      const pts = [...l, r[1], r[2]]; poly(g, pts); g.strokeStyle = INK; g.lineWidth = o.ink * 1.1; g.stroke(); out.push(pts);
    }
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
    // Crusts on the stone, ragged rather than round: each patch grown from a few points, an edge of small crowded lobes, the
    // older middle faded and cracked to grey with the stone showing through, a fine stipple over it all. Muted grey-green,
    // ochre and dull straw, a crust or two of each.
    const colors = o.cave ? ['#6e7466', '#8a8670', '#5e6a5a'] : ['#7e8a6a', '#9a7a3a', '#aaa27a', '#6a7660'];
    for (let i = 0; i < 4 + Math.floor(rng() * 3); i++) {
      const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.55, px = Math.cos(a) * d, py = Math.sin(a) * d, R = s * (0.14 + rng() * 0.2), c = pick(rng, colors), lobe = R * 0.13;
      const seeds = Array.from({ length: 3 + Math.floor(rng() * 3) }, () => [px + (rng() - 0.5) * R, py + (rng() - 0.5) * R, R * (0.35 + rng() * 0.3)]);
      g.save(); g.globalAlpha = 0.8;
      // The lobed rim: crowded small rounds round each seed's edge, lighter at their outer lip.
      for (const [sx, sy, sr] of seeds) for (let k = 0; k < 22; k++) { const t = rng() * 6.283, dd = sr * (0.75 + rng() * 0.3), lx = sx + Math.cos(t) * dd, ly = sy + Math.sin(t) * dd, lr = lobe * (0.6 + rng() * 0.7); g.beginPath(); g.arc(lx, ly, lr, 0, 6.283); g.fillStyle = shade(c, (rng() - 0.5) * 0.2); g.fill(); g.beginPath(); g.arc(lx, ly, lr, t - 1, t + 1); g.strokeStyle = shade(c, 0.3); g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); }
      // The body inside, a shade darker, and its old middle fading grey with cracks.
      for (const [sx, sy, sr] of seeds) { const pts = blob(rng, sx, sy, sr * 0.8, sr * 0.75, 12, 0.3); trace(g, pts); g.fillStyle = shade(c, -0.1); g.fill(); }
      for (const [sx, sy, sr] of seeds) { if (rng() < 0.4) continue; g.beginPath(); g.ellipse(sx, sy, sr * 0.4, sr * 0.35, rng() * 3, 0, 6.283); g.fillStyle = 'rgba(140,138,124,0.5)'; g.fill(); line(g, wander(rng, sx, sy, rng() * 6.28, 3, sr * 0.2, 0.9), 'rgba(30,26,18,0.4)', Math.max(0.5, o.ink * 0.4)); }
      g.restore();
      speckle(g, rng, px, py, R, R, 30, [shade(c, -0.35), shade(c, 0.3)], Math.max(0.5, o.unit * 0.005));
    }
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
// --- Drafts ---------------------------------------------------------------------------------------------------------------------------
// Kinds still being looked at in the mock: painted by paintDecor, but offered nowhere (not in DECOR_KINDS, the bar, the panel or the
// scatter) until they are taken in. Drawn as the world's maps draw such things: straight from above, flat muted fills, a soft
// darker band on the side away from the light, fine hatching (grain, straw, weave) and a heavy dark outline with thin lines inside.
const INKD = 'rgba(22,14,6,0.95)';
// A soft round glow (a lamp's warmth on what is round it), inside the picture.
const glowAt = (g, x, y, r, color, a = 0.5) => { const gg = g.createRadialGradient(x, y, 0, x, y, r); gg.addColorStop(0, `rgba(${color},${a})`); gg.addColorStop(1, `rgba(${color},0)`); g.fillStyle = gg; g.fillRect(x - r, y - r, r * 2, r * 2); };
const pathOf = (g, pts, sharp) => (sharp ? poly(g, pts) : trace(g, pts));
// The maps' finish on a shape: flat base, shade band, faint lit edge, hatching along `grain` (radians), heavy outline.
function inked(g, rng, pts, base, o, { sharp = false, grain = null, lines = 0, hatch = 0.22, band = 0.42, lit = 0.05, ink = 1.5, cross = false } = {}) {
  pathOf(g, pts, sharp); g.fillStyle = base; g.fill();
  const c = centre(pts), r = reach(pts, c);
  g.save(); pathOf(g, pts, sharp); g.clip();
  if (grain !== null && lines > 0) for (const a of cross ? [grain, grain + 1.57] : [grain]) for (let i = 0; i < lines; i++) {
    const off = (rng() - 0.5) * r * 2.1, ca = Math.cos(a), sa = Math.sin(a), sx = c[0] - sa * off - ca * r * 1.2, sy = c[1] + ca * off - sa * r * 1.2;
    const p = []; for (let k = 0; k <= 6; k++) { const t = k / 6; p.push([sx + ca * r * 2.4 * t + (rng() - 0.5) * r * 0.03, sy + sa * r * 2.4 * t + (rng() - 0.5) * r * 0.03]); }
    if (rng() < 0.35) p.length = 2 + Math.floor(rng() * 4);
    line(g, p, `rgba(20,12,4,${hatch * (0.6 + rng() * 0.6)})`, Math.max(0.5, o.ink * (0.3 + rng() * 0.3)));
  }
  g.filter = `blur(${Math.max(1, r * 0.1)}px)`;
  g.save(); g.translate(r * 0.13, r * 0.16); pathOf(g, pts, sharp); g.lineWidth = r * 0.42; g.strokeStyle = `rgba(14,8,2,${band})`; g.stroke(); g.restore();
  g.save(); g.translate(-r * 0.1, -r * 0.12); pathOf(g, pts, sharp); g.lineWidth = r * 0.16; g.strokeStyle = `rgba(255,240,210,${lit})`; g.stroke(); g.restore();
  g.filter = 'none'; g.restore();
  pathOf(g, pts, sharp); g.strokeStyle = INKD; g.lineWidth = o.ink * ink; g.lineJoin = 'round'; g.stroke();
}
// A box (half sizes w by h about cx, cy, turned) as corner points.
const boxAt = (cx, cy, w, h, turn) => { const c = Math.cos(turn), s = Math.sin(turn); return [[-w, -h], [w, -h], [w, h], [-w, h]].map(([u, v]) => [cx + c * u - s * v, cy + s * u + c * v]); };
const softShadow = (g, pts, o, a = 0.4) => { const c = centre(pts), r = reach(pts, c); g.save(); g.filter = `blur(${Math.max(1, r * 0.12)}px)`; g.translate(r * 0.06, r * 0.08); trace(g, pts); g.fillStyle = `rgba(10,6,2,${a})`; g.fill(); g.restore(); };
const ember = (g, rng, cx, cy, r, n, o) => { for (let i = 0; i < n; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * r, hot = rng(); g.fillStyle = hot > 0.75 ? '#ffd27a' : hot > 0.4 ? '#f07a22' : '#8a2a0c'; g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(1, o.unit * 0.008), Math.max(1, o.unit * 0.008)); } };
const tuft = (g, rng, x, y, r, o, colors = ['#4e5a1c', '#6e7a2a', '#8a9030']) => { for (let i = 0; i < 7; i++) { const a = rng() * 6.28; blade(g, x, y, a, r * (0.6 + rng() * 0.5), r * 0.12, (rng() - 0.5) * 0.4, colors[0], pick(rng, colors.slice(1)), o.ink * 0.4); } };
const DRAFTS = {
  // --- Town and village --------------------------------------------------------------------------------------------------------------
  lampPost: { label: 'Street lamps', size: 1.0, height: 2.4, light: { dim: 5, bright: 2, color: '#ffc878', animation: { type: 'torch', speed: 2, intensity: 2 } }, paint(g, s, rng, o) {
    // A street lamp from above: the iron post's round foot, a curled bracket reaching out from it, and on the end the lantern, a
    // four-sided iron cage round warm glass under a pyramid cap, inked as the maps ink their iron.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], post = at(-s * 0.45, 0), head = at(s * 0.25, 0), L = s * 0.22;
    if (o.night || o.cave) glowAt(g, ...head, s * 0.75, '255,190,100', 0.55);
    const foot = blob(rng, ...post, s * 0.13, s * 0.13, 12, 0.02); softShadow(g, foot, o, 0.4); inked(g, rng, foot, '#2a2824', o, { band: 0.3, ink: 1.6 });
    g.beginPath(); g.arc(...post, s * 0.06, 0, 6.283); g.fillStyle = '#4a4640'; g.fill();
    const arm = [post, at(-s * 0.2, -s * 0.08), at(0, -s * 0.05), head]; for (const [col, w] of [[INKD, o.unit * 0.04 + o.ink * 1.6], ['#3a3632', o.unit * 0.04]]) { g.beginPath(); g.moveTo(...arm[0]); g.bezierCurveTo(...arm[1], ...arm[2], ...arm[3]); g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.stroke(); }
    const curl = at(-s * 0.12, -s * 0.12); g.beginPath(); g.arc(...curl, s * 0.06, 0, 5.5); g.strokeStyle = INKD; g.lineWidth = o.ink * 2.4; g.stroke(); g.strokeStyle = '#3a3632'; g.lineWidth = o.ink * 1.1; g.stroke();
    const glass = boxAt(...head, L, L, a + Math.PI / 4); inked(g, rng, glass, o.night || o.cave ? '#ffd890' : '#c8b47a', o, { sharp: true, band: 0.25, lit: 0.2, ink: 1.2 });
    const cap = boxAt(...head, L * 0.82, L * 0.82, a + Math.PI / 4); inked(g, rng, cap, '#2a2824', o, { sharp: true, grain: a, lines: 6, hatch: 0.3, ink: 1.6 });
    for (const p of cap) line(g, [p, head], 'rgba(150,140,120,0.5)', o.ink * 0.6);
    for (const p of glass) { g.beginPath(); g.arc(...p, Math.max(1, s * 0.025), 0, 6.283); g.fillStyle = '#1a1814'; g.fill(); }
    g.beginPath(); g.arc(...head, L * 0.18, 0, 6.283); g.fillStyle = '#1a1814'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    return [foot, glass];
  } },
  brazier: { label: 'Braziers', size: 0.8, height: 0.9, light: { dim: 4.5, bright: 2, color: '#ff9a48', animation: { type: 'torch', speed: 4, intensity: 4 } }, paint(g, s, rng, o) {
    // As Irovetti's palace draws one: a black iron basket of slats round a bed of embers speckled orange.
    const R = s * 0.68, rim = blob(rng, 0, 0, R, R, 28, 0.02);
    softShadow(g, rim, o);
    inked(g, rng, rim, '#1e1a16', o, { ink: 1.8, band: 0.3 });
    g.save(); trace(g, moved(rim, 0, 0, 0.78)); g.clip(); g.fillStyle = '#1a0a04'; g.fillRect(-R, -R, R * 2, R * 2); ember(g, rng, 0, 0, R * 0.8, 380, o); g.filter = `blur(${Math.max(1, R * 0.15)}px)`; g.fillStyle = 'rgba(255,120,30,0.35)'; g.beginPath(); g.arc(0, 0, R * 0.45, 0, 6.283); g.fill(); g.restore();
    for (let i = 0; i < 16; i++) { const a = (i / 16) * 6.283, p = [[Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78], [Math.cos(a) * R * 1.04, Math.sin(a) * R * 1.04]]; line(g, p, INKD, o.ink * 3); line(g, p, '#4a4640', o.ink * 1.4); }
    g.beginPath(); g.arc(0, 0, R * 0.78, 0, 6.283); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.4; g.stroke();
    return [rim];
  } },
  candles: { label: 'Candles', size: 0.6, height: 0.25, light: { dim: 2, bright: 0.7, color: '#ffd090', animation: { type: 'torch', speed: 3, intensity: 3 } }, paint(g, s, rng, o) {
    // A round wooden dish with a carved rim, as the tournament grounds' fire bowl: candles stood in it, wax run over, small flames.
    const R = s * 0.82, dish = blob(rng, 0, 0, R, R, 30, 0.01); softShadow(g, dish, o);
    inked(g, rng, dish, '#6a5236', o, { grain: rng() * 3, lines: 22, hatch: 0.3 });
    g.beginPath(); g.arc(0, 0, R * 0.8, 0, 6.283); g.strokeStyle = 'rgba(22,14,6,0.7)'; g.lineWidth = o.ink * 0.8; g.stroke();
    for (let k = 0; k < 18; k++) { const a = (k / 18) * 6.283; line(g, [[Math.cos(a) * R * 0.82, Math.sin(a) * R * 0.82], [Math.cos(a + 0.12) * R * 0.95, Math.sin(a + 0.12) * R * 0.95]], 'rgba(22,14,6,0.45)', Math.max(0.5, o.ink * 0.5)); }
    const n = 1 + Math.floor(rng() * 3), out = [dish];
    for (let i = 0; i < n; i++) { const a = (i / n) * 6.283 + rng(), d = n > 1 ? R * 0.32 : 0, x = Math.cos(a) * d, y = Math.sin(a) * d, r = R * (0.2 + rng() * 0.06);
      const wax = blob(rng, x, y, r * 1.35, r * 1.3, 12, 0.25); trace(g, wax); g.fillStyle = '#d8d2c0'; g.fill(); g.strokeStyle = 'rgba(60,50,30,0.6)'; g.lineWidth = o.ink * 0.5; g.stroke();
      const top = blob(rng, x, y, r, r, 14, 0.04); inked(g, rng, top, '#ece6d6', o, { band: 0.25, ink: 1.1 });
      g.beginPath(); g.arc(x, y, r * 0.45, 0, 6.283); g.fillStyle = '#ffe9a8'; g.fill(); g.beginPath(); g.arc(x, y, r * 0.22, 0, 6.283); g.fillStyle = '#fff8e0'; g.fill(); }
    return out;
  } },
  well: { label: 'Wells', size: 1.4, height: 0.8, paint(g, s, rng, o) {
    // As Whiterose Abbey's: a ring of grey fieldstones, dark mortar between, moss in the joints, the shaft falling away to black.
    const R = s * 0.82, outer = blob(rng, 0, 0, R, R, 40, 0.02); softShadow(g, outer, o);
    trace(g, outer); g.fillStyle = '#2a2a24'; g.fill();
    for (let ring = 0; ring < 2; ring++) { const r0 = R * (ring ? 0.62 : 0.78), r1 = R * (ring ? 0.78 : 0.99), n = ring ? 12 : 16, off = rng();
      for (let i = 0; i < n; i++) { const a0 = ((i + off) / n) * 6.283 + 0.03, a1 = ((i + 1 + off) / n) * 6.283 - 0.03, pts = []; for (let k = 0; k <= 5; k++) { const a = a0 + (a1 - a0) * (k / 5); pts.push([Math.cos(a) * (r1 - (rng() * 0.03 * R)), Math.sin(a) * (r1 - rng() * 0.03 * R)]); } for (let k = 5; k >= 0; k--) { const a = a0 + (a1 - a0) * (k / 5); pts.push([Math.cos(a) * r0, Math.sin(a) * r0]); }
        inked(g, rng, pts, shade(pick(rng, ['#5e5e54', '#56584e', '#646258']), (rng() - 0.5) * 0.2), o, { grain: rng() * 3, lines: 10, hatch: 0.4, band: 0.5, ink: 1.3 }); } }
    const shaft = blob(rng, 0, 0, R * 0.62, R * 0.62, 28, 0.03); trace(g, shaft); const sg = g.createRadialGradient(0, 0, 0, 0, 0, R * 0.62); sg.addColorStop(0, '#000'); sg.addColorStop(0.65, '#050403'); sg.addColorStop(1, '#2a2620'); g.fillStyle = sg; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.4; g.stroke();
    if (o.season !== 'winter' && !o.cave) for (let i = 0; i < 9; i++) { const a = rng() * 6.28, d = R * (0.6 + rng() * 0.4); speckle(g, rng, Math.cos(a) * d, Math.sin(a) * d, R * 0.08, R * 0.05, 14, MOSS[o.season] ?? MOSS.summer, o.unit * 0.008); }
    return [outer];
  } },
  haystack: { label: 'Hay bales', size: 1.2, height: 0.7, paint(g, s, rng, o) {
    // Square bales as the village barn draws them: pale straw hatched in strands, two cords round each, the shaded side darker.
    const out = [], n = 1 + Math.floor(rng() * 3), turn = (rng() - 0.5) * 0.8;
    for (let i = 0; i < n; i++) { const w = s * 0.62, h = s * 0.34, cx = Math.cos(turn + 1.57) * (i - (n - 1) / 2) * h * 2.05, cy = Math.sin(turn + 1.57) * (i - (n - 1) / 2) * h * 2.05, b = boxAt(cx + (rng() - 0.5) * s * 0.06, cy, w, h, turn + (rng() - 0.5) * 0.12);
      softShadow(g, b, o);
      inked(g, rng, b, pick(rng, ['#8a7444', '#7e6a3e', '#96804c']), o, { sharp: true, grain: turn + (rng() - 0.5) * 0.4, lines: 220, hatch: 0.7, band: 0.55, ink: 1.6 });
      g.save(); poly(g, b); g.clip(); for (let k = 0; k < 90; k++) { const [x, y] = [cx + (rng() - 0.5) * w * 2, cy + (rng() - 0.5) * h * 2], a = turn + (rng() - 0.5) * 0.6, l = w * (0.1 + rng() * 0.2); line(g, [[x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]], 'rgba(220,196,130,0.45)', Math.max(0.5, o.ink * 0.4)); } g.restore();
      for (const k of [-0.45, 0.45]) { const c = Math.cos(turn), sn = Math.sin(turn); line(g, [[cx + c * w * k - sn * h, cy + sn * w * k + c * h], [cx + c * w * k + sn * h, cy + sn * w * k - c * h]], '#3a2a14', o.ink * 1.4); }
      out.push(b); }
    for (let i = 0; i < 24; i++) { const a = rng() * 6.28, d = s * (0.7 + rng() * 0.25), b = rng() * 6.28, l = s * 0.06; line(g, [[Math.cos(a) * d, Math.sin(a) * d], [Math.cos(a) * d + Math.cos(b) * l, Math.sin(a) * d + Math.sin(b) * l]], 'rgba(200,180,110,0.8)', Math.max(0.5, o.ink * 0.4)); }
    if (o.snow > 0) for (const b of out) { g.save(); poly(g, b); g.clip(); snowPatch(g, rng, ...centre(b), s * 0.5, s * 0.25, o); g.restore(); }
    return out;
  } },
  firewood: { label: 'Firewood stacks', size: 1.2, height: 0.7, paint(g, s, rng, o) {
    // As the homestead's hearth pile: split logs laid side by side in one or two stacks, each a long piece of red-brown bark split
    // by black cracks along it, its ridges catching the light, a little askew on the one below.
    const turn = (rng() - 0.5) * 0.5, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], stacks = rng() < 0.6 ? 2 : 1, W = s * 0.82, H = s * 0.7, out = [];
    softShadow(g, boxAt(0, 0, W, H, turn), o, 0.55);
    for (let st = 0; st < stacks; st++) { const cu = stacks === 2 ? (st ? W * 0.5 : -W * 0.5) : 0, half = stacks === 2 ? W * 0.47 : W * 0.95, rows = 8;
      for (let r = 0; r < rows; r++) { const v = -H + (r + 0.5) * (H * 2 / rows), [x, y] = at(cu + (rng() - 0.5) * s * 0.05, v), a = turn + 1.57 * 0 + (rng() - 0.5) * 0.12, len = half * (0.85 + rng() * 0.15), th = H / rows * (1.05 + rng() * 0.25);
        const log = []; for (let k = 0; k <= 6; k++) log.push([x + Math.cos(a) * (-len + (k / 6) * len * 2) - Math.sin(a) * (-th + (rng() - 0.5) * th * 0.15), y + Math.sin(a) * (-len + (k / 6) * len * 2) + Math.cos(a) * (-th + (rng() - 0.5) * th * 0.15)]); for (let k = 6; k >= 0; k--) log.push([x + Math.cos(a) * (-len + (k / 6) * len * 2) - Math.sin(a) * (th + (rng() - 0.5) * th * 0.15), y + Math.sin(a) * (-len + (k / 6) * len * 2) + Math.cos(a) * (th + (rng() - 0.5) * th * 0.15)]);
        inked(g, rng, log, pick(rng, ['#5a2e1c', '#6a3822', '#4e2818', '#73402a']), o, { sharp: true, band: 0.5, ink: 1.4 });
        g.save(); poly(g, log); g.clip();
        for (let k = 0; k < 9; k++) { const u0 = -len + rng() * len * 2, w0 = (rng() - 0.5) * th * 1.6, l0 = len * (0.15 + rng() * 0.35); line(g, [[x + Math.cos(a) * u0 - Math.sin(a) * w0, y + Math.sin(a) * u0 + Math.cos(a) * w0], [x + Math.cos(a) * (u0 + l0) - Math.sin(a) * (w0 + (rng() - 0.5) * th * 0.3), y + Math.sin(a) * (u0 + l0) + Math.cos(a) * (w0 + (rng() - 0.5) * th * 0.3)]], 'rgba(8,3,1,0.85)', Math.max(0.7, o.ink * (0.6 + rng() * 0.6))); }
        for (let k = 0; k < 7; k++) { const u0 = -len + rng() * len * 2, w0 = -th * (0.2 + rng() * 0.6), l0 = len * (0.08 + rng() * 0.2); line(g, [[x + Math.cos(a) * u0 - Math.sin(a) * w0, y + Math.sin(a) * u0 + Math.cos(a) * w0], [x + Math.cos(a) * (u0 + l0) - Math.sin(a) * w0, y + Math.sin(a) * (u0 + l0) + Math.cos(a) * w0]], pick(rng, ['rgba(190,110,70,0.55)', 'rgba(150,80,50,0.6)']), Math.max(0.6, o.ink * 0.7)); }
        g.restore(); out.push(log); } }
    return out;
  } },
  choppingBlock: { label: 'Chopping blocks', size: 1.2, height: 0.45, paint(g, s, rng, o) {
    // As Thorn River Camp's: a broad round of trunk with roots still spreading from it, its cut face pale and drawn with many fine
    // wobbling rings to the heart, split by a crack or two, a notched band of bark round it, an axe bitten into it.
    const R = s * 0.5;
    const roots = 6 + Math.floor(rng() * 3), spots = Array.from({ length: roots }, (_, i) => ({ a: ((i + (rng() - 0.5) * 0.6) / roots) * 6.283, len: 0.35 + rng() * 0.65, wide: 0.5 + rng() * 0.6 })), outer = [];
    for (let i = 0; i < 96; i++) { const q = (i / 96) * 6.283; let flare = 0; for (const r of spots) { let d = Math.abs(((q - r.a + Math.PI * 3) % 6.283) - Math.PI); d /= (0.42 * r.wide); flare = Math.max(flare, r.len * Math.max(0, 1 - d * d) ** 1.6); } const rr = R * (1.02 + 0.95 * flare) * (1 + (noise(q * 4, 3) - 0.5) * 0.1); outer.push([Math.cos(q) * rr, Math.sin(q) * rr]); }
    softShadow(g, outer, o, 0.45);
    inked(g, rng, outer, '#6a5640', o, { sharp: true, band: 0.5, ink: 1.6 });
    g.save(); poly(g, outer); g.clip(); for (const r of spots) for (let k = 0; k < 8; k++) { const q = r.a + (rng() - 0.5) * 0.5 * r.wide, d0 = R * 0.9, d1 = R * (1.02 + 0.95 * r.len) * (0.7 + rng() * 0.3); grainAlong(g, rng, Math.cos(q) * d0, Math.sin(q) * d0, Math.cos(q) * d1, Math.sin(q) * d1, R * 0.18, 3, o); for (let k = 0; k < 5; k++) { const q = r.a + (rng() - 0.5) * 0.6 * r.wide, d0 = R * (0.95 + rng() * 0.2), d1 = d0 + R * (0.2 + rng() * 0.5) * r.len; line(g, [[Math.cos(q) * d0, Math.sin(q) * d0], [Math.cos(q + (rng() - 0.5) * 0.1) * d1, Math.sin(q + (rng() - 0.5) * 0.1) * d1]], 'rgba(14,8,2,0.7)', Math.max(0.6, o.ink * (0.5 + rng() * 0.5))); } } g.restore();
    const bark = blob(rng, 0, 0, R, R * 0.96, 26, 0.07); softShadow(g, bark, o);
    inked(g, rng, bark, '#3e3020', o, { band: 0.3, ink: 1.8 });
    for (let i = 0; i < 60; i++) { const a = rng() * 6.28; line(g, [[Math.cos(a) * R * 0.86, Math.sin(a) * R * 0.86], [Math.cos(a) * R * (0.97 + rng() * 0.05), Math.sin(a) * R * (0.97 + rng() * 0.05)]], 'rgba(8,4,1,0.7)', Math.max(0.5, o.ink * 0.6)); }
    const face = blob(rng, 0, 0, R * 0.84, R * 0.8, 26, 0.06); inked(g, rng, face, '#a88a5c', o, { band: 0.3, ink: 1.3 });
    const k0 = rng() * 50; for (let k = 1; k < 13; k++) { const f = k / 13.5, ring = face.map(([x, y], j) => { const wob = 1 + (noise(j * 0.7 + k0, k * 0.9) - 0.5) * 0.12; return [x * f * wob, y * f * wob]; }); trace(g, ring); g.strokeStyle = `rgba(70,46,20,${0.35 + (k % 3 === 0 ? 0.2 : 0)})`; g.lineWidth = Math.max(0.5, o.ink * (k % 3 === 0 ? 0.7 : 0.45)); g.stroke(); }
    for (let i = 0; i < 2; i++) { const a = rng() * 6.28; line(g, wander(rng, Math.cos(a) * R * 0.05, Math.sin(a) * R * 0.05, a, 4, R * 0.2, 0.4), 'rgba(30,16,6,0.75)', Math.max(0.6, o.ink * 0.8)); }
    const a = rng() * 6.28, hx = Math.cos(a) * R * 0.1, hy = Math.sin(a) * R * 0.1;
    inked(g, rng, boxAt(hx + Math.cos(a) * R * 0.85, hy + Math.sin(a) * R * 0.85, R * 0.8, R * 0.07, a), '#7a5a34', o, { sharp: true, grain: a, lines: 5, hatch: 0.4, ink: 1.4 });
    inked(g, rng, [[hx - Math.sin(a) * R * 0.32, hy + Math.cos(a) * R * 0.32], [hx + Math.sin(a) * R * 0.26, hy - Math.cos(a) * R * 0.26], [hx + Math.cos(a) * R * 0.14 + Math.sin(a) * R * 0.12, hy + Math.sin(a) * R * 0.14 - Math.cos(a) * R * 0.12], [hx + Math.cos(a) * R * 0.14 - Math.sin(a) * R * 0.12, hy + Math.sin(a) * R * 0.14 + Math.cos(a) * R * 0.12]], '#6e6c66', o, { sharp: true, band: 0.35, ink: 1.5 });
    return [bark];
  } },
  cart: { label: 'Carts', size: 2.6, height: 1.0, paint(g, s, rng, o) {
    // As Oleg's wagon: a grey-brown plank bed in a frame, iron bands bolted at its corners, the wheels' rims either side, two shafts.
    const turn = rng() * 6.28, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.62, W = s * 0.4;
    for (const k of [-1, 1]) { const shaft = boxAt(...at(L * 1.2, k * W * 0.55), L * 0.32, W * 0.06, turn - k * 0.08); inked(g, rng, shaft, '#6a5a44', o, { sharp: true, grain: turn, lines: 3, ink: 1.2 }); }
    for (const k of [-1, 1]) for (const j of [-0.15]) { const wheel = boxAt(...at(L * j, k * W * 1.1), L * 0.42, W * 0.1, turn); inked(g, rng, wheel, '#3a3028', o, { sharp: true, band: 0.3, ink: 1.4 }); for (let i = -2; i <= 2; i++) { g.beginPath(); g.arc(...at(L * j + i * L * 0.18, k * W * 1.1), Math.max(1, W * 0.035), 0, 6.283); g.fillStyle = '#8a8478'; g.fill(); } }
    const bed = boxAt(0, 0, L, W, turn); softShadow(g, bed, o, 0.5); inked(g, rng, bed, '#857660', o, { sharp: true, grain: turn, lines: 40, hatch: 0.45, ink: 1.7 });
    for (let i = 1; i < 6; i++) line(g, [at(-L, -W + (i / 6) * W * 2), at(L, -W + (i / 6) * W * 2)], 'rgba(20,12,4,0.7)', o.ink * 0.8);
    for (const k of [-1, 1]) { const rail = boxAt(...at(0, k * W * 0.93), L, W * 0.08, turn); inked(g, rng, rail, '#5a4e3e', o, { sharp: true, grain: turn, lines: 3, ink: 1.2 }); }
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const band = boxAt(...at(u * L * 0.9, v * W * 0.9), L * 0.1, W * 0.12, turn); inked(g, rng, band, '#3e3c38', o, { sharp: true, band: 0.2, ink: 1 }); g.beginPath(); g.arc(...at(u * L * 0.9, v * W * 0.9), Math.max(1, W * 0.04), 0, 6.283); g.fillStyle = '#9a948a'; g.fill(); }
    return [bed];
  } },
  sacks: { label: 'Sacks', size: 1.4, height: 0.5, paint(g, s, rng, o) {
    // As the village alley's: burlap sacks fat at the bottom and gathered at the neck, slumped against each other, the weave hatched
    // fine both ways, folds running down from the neck, a grey shade band, and the neck tied off with cord in a loose knot.
    const out = [], n = 2 + Math.floor(rng() * 2), base = rng() * 6.28;
    for (let i = 0; i < n; i++) { const off = (i - (n - 1) / 2) * s * 0.42, x = -Math.sin(base) * off + (rng() - 0.5) * s * 0.12, y = Math.cos(base) * off + (rng() - 0.5) * s * 0.12, r = s * (0.33 + rng() * 0.06), turn = base + (rng() - 0.5) * 0.6, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [x + c * u - sn * v, y + sn * u + c * v];
      // Pear-shaped: wide at its bottom (u < 0), drawn in toward the neck (u > 0).
      const sack = []; for (let k = 0; k < 24; k++) { const q = (k / 24) * 6.283, u = Math.cos(q) * r, wide = u < 0 ? 1 : 1 - (u / r) * 0.32; sack.push(at(u, Math.sin(q) * r * 0.82 * wide * (1 + (rng() - 0.5) * 0.06))); }
      softShadow(g, sack, o, 0.45); inked(g, rng, sack, pick(rng, ['#b8ae94', '#aca288', '#c2b89e']), o, { grain: turn + 0.785, lines: 180, hatch: 0.1, cross: true, band: 0.6, ink: 1.8 });
      for (let k = 0; k < 4; k++) { const v0 = (rng() - 0.5) * r * 0.25, p = [at(r * 0.95, v0), at(r * 0.4, v0 * 2.2 + (rng() - 0.5) * r * 0.2), at(-r * (0.1 + rng() * 0.4), v0 * 3 + (rng() - 0.5) * r * 0.3)]; g.beginPath(); g.moveTo(...p[0]); g.quadraticCurveTo(...p[1], ...p[2]); g.strokeStyle = 'rgba(40,32,20,0.45)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); }
      const neck = []; for (let k = 0; k < 14; k++) { const q = (k / 14) * 6.283; neck.push(at(r * 1.12 + Math.cos(q) * r * 0.26, Math.sin(q) * r * 0.36 * (k % 2 ? 0.72 : 1))); } inked(g, rng, neck, '#a89e84', o, { sharp: true, band: 0.45, ink: 1.5, grain: turn, lines: 10, hatch: 0.3 }); for (let k = 0; k < 5; k++) { const v = (k - 2) * r * 0.08; line(g, [at(r * 0.95, v * 0.6), at(r * 1.3, v * 1.3)], 'rgba(40,32,20,0.55)', Math.max(0.6, o.ink * 0.6)); }
      for (const k of [-1, 1]) { const [lx, ly] = at(r * 0.9, k * r * 0.16); g.beginPath(); g.ellipse(lx, ly, r * 0.12, r * 0.07, turn + k * 0.9, 0, 6.283); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.8; g.stroke(); g.strokeStyle = '#6a5a3e'; g.lineWidth = o.ink * 0.8; g.stroke(); }
      line(g, [at(r * 0.92, -r * 0.2), at(r * 0.92, r * 0.2)], INKD, o.ink * 1.8);
      out.push(sack); }
    return out;
  } },
  fence: { label: 'Fences', size: 2.0, height: 0.8, paint(g, s, rng, o) {
    // As the village barn's: one squared brown rail, grain along it, square posts at either end and between with a ring on their tops.
    const turn = (rng() - 0.5) * 0.3, out = [], rail = boxAt(0, 0, s * 0.96, s * 0.045, turn); softShadow(g, rail, o, 0.35);
    inked(g, rng, rail, '#6a5236', o, { sharp: true, grain: turn, lines: 8, hatch: 0.45, ink: 1.4 }); out.push(rail);
    for (let i = 0; i < 3; i++) { const u = -s * 0.9 + i * s * 0.9, x = Math.cos(turn) * u, y = Math.sin(turn) * u, post = boxAt(x, y, s * 0.085, s * 0.085, turn + (rng() - 0.5) * 0.2);
      inked(g, rng, post, '#5e4a32', o, { sharp: true, grain: rng() * 3, lines: 4, hatch: 0.35, ink: 1.5 });
      for (let k = 1; k <= 2; k++) { g.beginPath(); g.arc(x, y, s * 0.028 * k, 0, 6.283); g.strokeStyle = 'rgba(30,18,8,0.55)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); } out.push(post); }
    return out;
  } },
  signpost: { label: 'Signposts', size: 0.8, height: 1.8, paint(g, s, rng, o) {
    // From above: the post's squared top and boards pointing two or three ways, grain along them, their letters cut as dark notches.
    const out = [], n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) { const a = rng() * 6.28, l = s * (0.72 + rng() * 0.15), w = s * 0.1, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], board = [at(-s * 0.05, -w), at(l - w, -w), at(l, 0), at(l - w, w), at(-s * 0.05, w)];
      softShadow(g, board, o, 0.3); inked(g, rng, board, '#7a6040', o, { sharp: true, grain: a, lines: 6, hatch: 0.4, ink: 1.3 });
      for (let k = 0; k < 5; k++) { const u = s * 0.18 + k * l * 0.13; line(g, [at(u, -w * 0.35), at(u, w * 0.35)], 'rgba(20,12,4,0.55)', Math.max(0.6, o.ink * 0.6)); } out.push(board); }
    const top = boxAt(0, 0, s * 0.11, s * 0.11, rng()); inked(g, rng, top, '#5a4430', o, { sharp: true, grain: 0, lines: 3, ink: 1.4 }); out.push(top);
    return out;
  } },
  rubbish: { label: 'Rubbish heaps', size: 1.6, height: 0.3, paint(g, s, rng, o) {
    // As Whiterose Abbey's midden: big terracotta pots lying on their sides, mouths dark, holed and cracked, splintered planks
    // thrown across, straw and scraps between.
    speckle(g, rng, 0, 0, s * 0.8, s * 0.65, 120, ['#3a2c1a', '#5a4a2a', '#8a7a50'], o.unit * 0.008);
    for (let i = 0; i < 26; i++) { const a = rng() * 6.28, d = rng() * s * 0.8, b = rng() * 6.28, l = s * 0.07; line(g, [[Math.cos(a) * d, Math.sin(a) * d], [Math.cos(a) * d + Math.cos(b) * l, Math.sin(a) * d + Math.sin(b) * l]], 'rgba(190,170,110,0.7)', Math.max(0.5, o.ink * 0.45)); }
    const out = [], n = 2 + Math.floor(rng() * 2), base = rng() * 6.28;
    for (let i = 0; i < n; i++) { const a = base + (i / n) * 6.283, d = s * 0.42, x = Math.cos(a) * d, y = Math.sin(a) * d, r = s * (0.24 + rng() * 0.05), turn = rng() * 6.28, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [x + c * u - sn * v, y + sn * u + c * v];
      // On its side: a fat belly narrowing to a neck, the mouth an open dark ring at the narrow end.
      const pot = []; for (let k = 0; k < 24; k++) { const q = (k / 24) * 6.283, u = Math.cos(q) * r, wide = u > r * 0.4 ? 0.62 + 0.38 * (1 - (u - r * 0.4) / (r * 0.6)) : 1; pot.push(at(u, Math.sin(q) * r * 0.8 * wide)); }
      softShadow(g, pot, o, 0.5); inked(g, rng, pot, pick(rng, ['#9a5232', '#8a4a2c', '#a85e38']), o, { grain: turn + 1.57, lines: 14, hatch: 0.2, band: 0.55, lit: 0.08, ink: 1.7 });
      const mouth = []; for (let k = 0; k < 16; k++) { const q = (k / 16) * 6.283; mouth.push(at(r * 1.0 + Math.cos(q) * r * 0.12, Math.sin(q) * r * 0.5)); } inked(g, rng, mouth, '#7a3e22', o, { band: 0.3, ink: 1.4 }); trace(g, moved(mouth, ...at(r, 0), 0.6)); g.fillStyle = '#1a0a04'; g.fill();
      if (rng() < 0.7) { const h0 = rng() * 6.28, hc = at(-r * 0.2, (rng() - 0.5) * r * 0.6), hole = []; for (let k = 0; k < 7; k++) { const q = h0 + (k / 7) * 6.283; hole.push([hc[0] + Math.cos(q) * r * (0.16 + rng() * 0.1), hc[1] + Math.sin(q) * r * (0.16 + rng() * 0.1)]); } poly(g, hole); g.fillStyle = '#1e0e06'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.2; g.stroke(); }
      line(g, wander(rng, ...at(-r * 0.7, -r * 0.3), turn + 0.6, 4, r * 0.2, 1.3), INKD, Math.max(0.7, o.ink * 0.9)); out.push(pot); }
    for (let i = 0; i < 2; i++) { const a = base + 0.8 + i * 2.2, plank = boxAt((rng() - 0.5) * s * 0.3, (rng() - 0.5) * s * 0.3, s * (0.62 + rng() * 0.15), s * 0.075, a); inked(g, rng, plank, '#7a5e3c', o, { sharp: true, grain: a, lines: 8, hatch: 0.45, ink: 1.4 }); const [x, y] = plank[1]; for (let k = 0; k < 4; k++) { const b = a + (rng() - 0.5) * 0.6, l = s * (0.06 + rng() * 0.1); poly(g, [[x, y - s * 0.02], [x + Math.cos(b) * l, y + Math.sin(b) * l], [x, y + s * 0.02]]); g.fillStyle = '#8a6c46'; g.fill(); g.strokeStyle = INKD; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); } }
    return out;
  } },
  cobbles: { label: 'Paving', size: 1.4, height: 0, flat: true, paint(g, s, rng, o) {
    // Cut setts as the Pitaxian avenue lays them: sandstone squares rounded at their corners, warm and slightly worn, set in dark
    // brown grout in rough curved rows, the patch breaking up at its edges.
    const cell = o.unit * 0.17, turn = (rng() - 0.5) * 0.4, c = Math.cos(turn), sn = Math.sin(turn), bend = (rng() - 0.5) * 0.4;
    const setts = [];
    for (let v = -s; v < s; v += cell) for (let u = -s + (Math.round(v / cell) % 2 ? cell / 2 : 0); u < s; u += cell) { const vv = v + bend * (u * u) / s, x = c * u - sn * vv, y = sn * u + c * vv, d = Math.hypot(x, y) / (s * 0.85); if (d > 1 || rng() < (d - 0.6) * 1.8) continue; setts.push([x, y]); }
    g.save(); for (const [x, y] of setts) { g.beginPath(); g.arc(x, y, cell * 0.56, 0, 6.283); g.fillStyle = '#6e5028'; g.fill(); } g.restore();
    for (const [x, y] of setts) { const w = cell * (0.45 + rng() * 0.03), h = cell * (0.43 + rng() * 0.04), tt = turn + (rng() - 0.5) * 0.18, pts = []; for (let k = 0; k < 16; k++) { const q = (k / 16) * 6.283, ex = Math.sign(Math.cos(q)) * Math.pow(Math.abs(Math.cos(q)), 0.5) * w, ey = Math.sign(Math.sin(q)) * Math.pow(Math.abs(Math.sin(q)), 0.5) * h; pts.push([x + Math.cos(tt) * ex - Math.sin(tt) * ey + (rng() - 0.5) * cell * 0.05, y + Math.sin(tt) * ex + Math.cos(tt) * ey + (rng() - 0.5) * cell * 0.05]); }
      inked(g, rng, pts, shade(pick(rng, ['#c8ac74', '#bca068', '#d4b880']), (rng() - 0.5) * 0.14), o, { band: 0.45, lit: 0.08, ink: 0.9, grain: rng() * 3, lines: 4, hatch: 0.2 }); }
    return null;
  } },
  tombstone: { label: 'Gravestones', size: 1.0, height: 0.3, paint(g, s, rng, o) {
    // As Whiterose Abbey's: a grey slab lying flat (or tipped back), its edges worn round, two lines of an inscription cut in it, ferns
    // and grass crowding round its foot.
    const turn = (rng() - 0.5) * 0.4, slab = blob(rng, 0, 0, s * 0.42, s * 0.62, 12, 0.03, turn + 1.57 * 0), w = s * 0.5, h = s * 0.58, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v];
    const pts = []; for (let i = 0; i < 24; i++) { const t = (i / 24) * 6.283, ex = Math.sign(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), 0.3) * w, ey = Math.sign(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), 0.3) * h; pts.push(at(ex + (rng() - 0.5) * s * 0.02, ey + (rng() - 0.5) * s * 0.02)); }
    void slab; softShadow(g, pts, o, 0.5);
    inked(g, rng, pts, pick(rng, ['#8a8a80', '#7e7e74', '#94928a']), o, { grain: turn, lines: 10, hatch: 0.15, band: 0.4, ink: 1.6 });
    for (let k = 0; k < 2 + Math.floor(rng() * 2); k++) line(g, [at(-w * 0.55, -h * 0.25 + k * h * 0.22), at(-w * 0.1, -h * 0.25 + k * h * 0.22 + s * 0.01), at(w * 0.5, -h * 0.25 + k * h * 0.22)], 'rgba(20,16,10,0.65)', o.ink * 0.9);
    if (o.season !== 'winter') for (let i = 0; i < 3; i++) tuft(g, rng, ...at((rng() - 0.5) * w * 2.2, h * (0.8 + rng() * 0.3)), s * 0.35, o);
    if (o.snow > 0) { g.save(); trace(g, pts); g.clip(); snowPatch(g, rng, 0, 0, w, h, o); g.restore(); }
    return [pts];
  } },
  // --- Wildlife ------------------------------------------------------------------------------------------------------------------------
  nest: { label: 'Bird nests', size: 0.6, height: 0.2, paint(g, s, rng, o) {
    // A woven ring of twigs and straw, each strand inked, the cup inside lined pale, eggs in it (or empty).
    const R = s * 0.78, out = blob(rng, 0, 0, R, R * 0.92, 16, 0.08); softShadow(g, out, o);
    trace(g, out); g.fillStyle = '#4a3a24'; g.fill();
    for (let i = 0; i < 120; i++) { const a = rng() * 6.28, d = R * (0.5 + rng() * 0.48), b = a + 1.57 + (rng() - 0.5) * 0.7, l = R * (0.2 + rng() * 0.3), p = [[Math.cos(a) * d - Math.cos(b) * l / 2, Math.sin(a) * d - Math.sin(b) * l / 2], [Math.cos(a) * d + Math.cos(b) * l / 2, Math.sin(a) * d + Math.sin(b) * l / 2]]; line(g, p, INKD, Math.max(0.8, o.ink * 0.9)); line(g, p, pick(rng, ['#8a7048', '#a8905a', '#6a5232', '#c8b07a']), Math.max(0.5, o.ink * 0.45)); }
    const cup = blob(rng, 0, 0, R * 0.5, R * 0.46, 14, 0.1); trace(g, cup); g.fillStyle = '#5a4a32'; g.fill(); g.save(); trace(g, cup); g.clip(); for (let i = 0; i < 40; i++) { const a = rng() * 6.28, d = rng() * R * 0.5, b = rng() * 6.28, l = R * 0.15; line(g, [[Math.cos(a) * d, Math.sin(a) * d], [Math.cos(a) * d + Math.cos(b) * l, Math.sin(a) * d + Math.sin(b) * l]], 'rgba(200,180,130,0.6)', Math.max(0.5, o.ink * 0.4)); } g.restore(); trace(g, cup); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    if (rng() < 0.75) for (let i = 0; i < 2 + Math.floor(rng() * 2); i++) { const a = rng() * 6.28, x = Math.cos(a) * R * 0.17, y = Math.sin(a) * R * 0.17, egg = blob(rng, x, y, R * 0.15, R * 0.11, 12, 0.02, a); inked(g, rng, egg, pick(rng, ['#d4d8c8', '#c8d0d0', '#d8d0bc']), o, { band: 0.3, ink: 1.1 }); speckle(g, rng, x, y, R * 0.1, R * 0.07, 7, ['#5a4a3a'], R * 0.012); }
    return [out];
  } },
  beehive: { label: 'Beehives', size: 0.7, height: 0.8, paint(g, s, rng, o) {
    // A straw skep: hatched in coils round to its crown, darker where it turns from the light, its door at the foot, a few bees.
    const R = s * 0.68, dome = blob(rng, 0, 0, R, R, 24, 0.02); softShadow(g, dome, o);
    inked(g, rng, dome, '#8e7438', o, { band: 0.55, ink: 1.7 });
    g.save(); trace(g, dome); g.clip(); for (let r = R * 0.95; r > R * 0.1; r -= R * 0.09) { g.beginPath(); g.arc(-(1 - r / R) * R * 0.12, -(1 - r / R) * R * 0.14, r, 0, 6.283); g.strokeStyle = 'rgba(30,18,4,0.3)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); for (let k = 0; k < 44; k++) { const a = (k / 30) * 6.283 + r; line(g, [[Math.cos(a) * r * 0.98, Math.sin(a) * r * 0.98], [Math.cos(a + 0.08) * (r - R * 0.1), Math.sin(a + 0.08) * (r - R * 0.1)]], 'rgba(30,18,4,0.5)', Math.max(0.5, o.ink * 0.4)); } } g.restore();
    const a = 1.2 + rng(); g.beginPath(); g.ellipse(Math.cos(a) * R * 0.9, Math.sin(a) * R * 0.9, R * 0.13, R * 0.07, a + 1.57, 0, 6.283); g.fillStyle = '#0e0802'; g.fill();
    for (let i = 0; i < 7; i++) { const b = rng() * 6.28, d = R * (1.05 + rng() * 0.4); g.beginPath(); g.ellipse(Math.cos(b) * d, Math.sin(b) * d, o.unit * 0.011, o.unit * 0.007, rng() * 3, 0, 6.283); g.fillStyle = '#c89a20'; g.fill(); g.strokeStyle = INKD; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); }
    return [dome];
  } },
  burrow: { label: 'Burrows', size: 0.9, height: 0, flat: true, paint(g, s, rng, o) {
    // A hole dug into the ground, black inside, its lip of earth inked, the spoil thrown out in a fan of loose clods.
    const a = rng() * 6.28;
    for (let i = 0; i < 26; i++) { const b = a + (rng() - 0.5) * 1.6, d = s * (0.35 + rng() * 0.5), r = s * (0.03 + rng() * 0.05), clod = blob(rng, Math.cos(b) * d, Math.sin(b) * d, r, r * 0.8, 6, 0.3); inked(g, rng, clod, pick(rng, ['#6a4e30', '#7a5a38', '#5a4028']), o, { band: 0.3, ink: 0.9 }); }
    const lip = blob(rng, 0, 0, s * 0.38, s * 0.3, 14, 0.15); inked(g, rng, lip, '#5a4228', o, { band: 0.4, ink: 1.5 });
    const hole = moved(lip, 0, 0, 0.72, s * 0.02, s * 0.02); trace(g, hole); const hg = g.createRadialGradient(0, 0, 0, 0, 0, s * 0.3); hg.addColorStop(0, '#000'); hg.addColorStop(0.8, '#0a0604'); hg.addColorStop(1, '#2a1a0c'); g.fillStyle = hg; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.2; g.stroke();
    return null;
  } },
  anthill: { label: 'Anthills', size: 0.8, height: 0.25, paint(g, s, rng, o) {
    // A heap of grit and pine needles hatched over, built up to a dark hole, ants trailing off over the ground.
    const R = s * 0.72, hull = blob(rng, 0, 0, R, R * 0.88, 18, 0.14); softShadow(g, hull, o);
    inked(g, rng, hull, '#5e4a30', o, { band: 0.55, ink: 1.5 });
    g.save(); trace(g, hull); g.clip(); speckle(g, rng, 0, 0, R, R, 420, ['#8a6e46', '#4a3620', '#2a1c10', '#a88c60'], o.unit * 0.006); for (let i = 0; i < 50; i++) { const b = rng() * 6.28, d = rng() * R, c = rng() * 6.28, l = R * 0.12; line(g, [[Math.cos(b) * d, Math.sin(b) * d], [Math.cos(b) * d + Math.cos(c) * l, Math.sin(b) * d + Math.sin(c) * l]], 'rgba(30,20,8,0.55)', Math.max(0.5, o.ink * 0.4)); } g.restore();
    g.beginPath(); g.arc(-R * 0.08, -R * 0.1, R * 0.09, 0, 6.283); g.fillStyle = '#0a0602'; g.fill();
    for (const [x, y] of wander(rng, R * 0.85, 0, rng() * 6.28, 9, R * 0.13, 0.8)) { g.fillStyle = '#0e0804'; g.beginPath(); g.arc(x, y, Math.max(0.8, o.unit * 0.004), 0, 6.283); g.fill(); }
    return [hull];
  } },
  carcass: { label: 'Carcasses', size: 1.5, height: 0.35, paint(g, s, rng, o) {
    // As Hilltop Grave's bones: yellow-ochre bone, heavily inked, a spine and ribs, a skull with antlers, moss creeping on them,
    // dark stains soaked into the ground round them.
    const turn = rng() * 6.28, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.58, out = [], bone = ['#b8a670', '#8e7e50'];
    g.save(); g.filter = `blur(${Math.max(1, s * 0.06)}px)`; trace(g, blob(rng, 0, 0, s * 0.7, s * 0.4, 12, 0.35, turn)); g.fillStyle = 'rgba(40,22,10,0.45)'; g.fill(); g.restore();
    for (let k = 0; k < 8; k++) { const u = -L * 0.5 + (k / 7) * L; for (const side of [-1, 1]) { if (rng() < 0.12) continue; const p = []; for (let t = 0; t <= 5; t++) { const f = t / 5; p.push(at(u - f * f * L * 0.15, side * f * L * 0.5 * (k > 5 ? 0.6 : 1))); } line(g, p, INKD, o.unit * 0.05 + o.ink * 1.8); line(g, p, bone[1], o.unit * 0.05); line(g, p.map(([x, y]) => [x - 0.8, y - 0.8]), bone[0], o.unit * 0.02); out.push(p); } }
    for (let k = 0; k < 11; k++) { const [x, y] = at(-L * 0.75 + k * L * 0.15, 0), v = blob(rng, x, y, o.unit * 0.06, o.unit * 0.045, 8, 0.15, turn); inked(g, rng, v, bone[0], o, { band: 0.4, ink: 1.3 }); out.push(v); }
    const skull = blob(rng, ...at(L * 0.98, s * 0.04), s * 0.15, s * 0.09, 12, 0.08, turn); inked(g, rng, skull, bone[0], o, { band: 0.45, ink: 1.5 }); out.push(skull);
    for (const k of [-1, 1]) { g.beginPath(); g.ellipse(...at(L * 0.98, s * 0.04 + k * s * 0.04), s * 0.025, s * 0.02, turn, 0, 6.283); g.fillStyle = '#1a1006'; g.fill(); }
    for (const side of [-1, 1]) { let a = turn + side * 2.3, [x, y] = at(L * 0.9, s * 0.04 + side * s * 0.05); const p = [[x, y]]; for (let k = 0; k < 4; k++) { x += Math.cos(a) * s * 0.09; y += Math.sin(a) * s * 0.09; p.push([x, y]); if (k === 1 || k === 2) { const q = [[x, y], [x + Math.cos(a + side * 0.9) * s * 0.08, y + Math.sin(a + side * 0.9) * s * 0.08]]; line(g, q, INKD, o.unit * 0.018 + o.ink * 1.2); line(g, q, bone[1], o.unit * 0.018); } a -= side * 0.35; } line(g, p, INKD, o.unit * 0.022 + o.ink * 1.2); line(g, p, bone[1], o.unit * 0.022); }
    if (o.season !== 'winter') for (let i = 0; i < 4; i++) speckle(g, rng, ...at((rng() - 0.5) * L * 1.4, (rng() - 0.5) * L * 0.4), s * 0.08, s * 0.05, 14, MOSS[o.season] ?? MOSS.summer, o.unit * 0.008);
    return out;
  } },
  feathers: { label: 'Feathers', size: 0.6, height: 0, flat: true, paint(g, s, rng, o) {
    // Feathers strewn where something was caught: inked vanes with fine barbs hatched, a dark quill down each.
    const colors = pick(rng, [['#d8d2c4', '#8a8478'], ['#6a5440', '#2a2018'], ['#5a6068', '#c8ccd0']]);
    for (let i = 0; i < 7; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.7, x = Math.cos(a) * d, y = Math.sin(a) * d, b = rng() * 6.28, l = s * (0.2 + rng() * 0.14), cb = Math.cos(b), sb = Math.sin(b);
      const vane = [[x, y]]; for (let k = 1; k <= 8; k++) { const t = k / 8, w = l * 0.16 * Math.sin(t * Math.PI) * (t < 0.9 ? 1 : 0.5); vane.push([x + cb * l * t - sb * w, y + sb * l * t + cb * w]); } for (let k = 8; k >= 1; k--) { const t = k / 8, w = l * 0.13 * Math.sin(t * Math.PI); vane.push([x + cb * l * t + sb * w, y + sb * l * t - cb * w]); }
      inked(g, rng, vane, colors[0], o, { grain: b + 1.1, lines: 10, hatch: 0.35, band: 0.3, ink: 0.9 });
      line(g, [[x - cb * l * 0.12, y - sb * l * 0.12], [x + cb * l * 0.95, y + sb * l * 0.95]], colors[1], Math.max(0.6, o.ink * 0.7)); }
    return null;
  } },
  tracks: { label: 'Tracks', size: 1.4, height: 0, flat: true, paint(g, s, rng, o) {
    // A line of prints pressed into soft ground, each a darker hollow with its rim lit: a deer's split hooves or a wolf's pad and toes.
    const wolf = rng() < 0.5, a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], deep = o.snow > 0 ? '90,110,130' : '26,16,6', rim = o.snow > 0 ? '255,255,255' : '220,200,160', step = o.unit * 0.24;
    const press = (x, y, rx, ry, turn) => { g.beginPath(); g.ellipse(x, y, rx, ry, turn, 0, 6.283); g.fillStyle = `rgba(${deep},0.5)`; g.fill(); g.beginPath(); g.ellipse(x - rx * 0.15, y - ry * 0.2, rx, ry, turn, Math.PI * 0.9, Math.PI * 1.9); g.strokeStyle = `rgba(${rim},0.25)`; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); };
    for (let i = 0, u = -s * 0.9; u < s * 0.9; i++, u += step) { const [x, y] = at(u, (i % 2 ? 1 : -1) * o.unit * 0.06);
      if (wolf) { press(x, y, o.unit * 0.028, o.unit * 0.024, a); for (let k = 0; k < 4; k++) { const t = a + (k - 1.5) * 0.42; press(x + Math.cos(t) * o.unit * 0.048, y + Math.sin(t) * o.unit * 0.048, o.unit * 0.011, o.unit * 0.013, t); } }
      else for (const k of [-1, 1]) press(x - sn * k * o.unit * 0.013, y + c * k * o.unit * 0.013, o.unit * 0.03, o.unit * 0.011, a); }
    return null;
  } },
  // --- Underground and dungeons ---------------------------------------------------------------------------------------------------------
  rails: { label: 'Mine rails', size: 2.0, height: 0, flat: true, paint(g, s, rng, o) {
    // As the collapsed mine's track: pale timber sleepers with ink grain and nail heads, some split, two dark iron rails over them.
    const turn = (rng() - 0.5) * 0.3, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], gauge = s * 0.24;
    for (let u = -s * 0.92; u < s * 0.95; u += s * (0.2 + rng() * 0.06)) { const w = s * (0.06 + rng() * 0.025), sl = boxAt(...at(u + (rng() - 0.5) * s * 0.03, 0), w, gauge * 1.55 * (rng() < 0.15 ? 0.6 : 1), turn + 1.57 * 0 + (rng() - 0.5) * 0.08);
      inked(g, rng, sl.map(([x, y]) => [x, y]), shade('#a88a5a', (rng() - 0.5) * 0.2), o, { sharp: true, grain: turn + 1.57, lines: 5, hatch: 0.45, ink: 1.3 });
      for (const v of [-gauge, gauge]) { g.beginPath(); g.arc(...at(u, v), Math.max(1, s * 0.012), 0, 6.283); g.fillStyle = '#2a2622'; g.fill(); } }
    for (const v of [-gauge, gauge]) { const p = [at(-s * 0.97, v), at(s * 0.97, v)]; line(g, p, INKD, o.unit * 0.045 + o.ink * 1.6); line(g, p, '#2e2a26', o.unit * 0.045); line(g, p.map(([x, y]) => [x, y - o.ink * 0.6]), '#7a746a', o.ink * 0.7); }
    return null;
  } },
  mineCart: { label: 'Mine carts', size: 1.0, height: 0.7, paint(g, s, rng, o) {
    // A plank ore truck in an iron-shod frame, its wheels' rims at the sides, heaped with rounded tan rock as Giant's Cave's crates are.
    const turn = (rng() - 0.5) * 0.5, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.72, W = s * 0.5;
    for (const k of [-1, 1]) for (const j of [-1, 1]) inked(g, rng, boxAt(...at(j * L * 0.6, k * W * 1.08), s * 0.13, s * 0.05, turn), '#2a2826', o, { sharp: true, ink: 1.2 });
    const tub = boxAt(0, 0, L, W, turn); softShadow(g, tub, o, 0.5); inked(g, rng, tub, '#7a5a38', o, { sharp: true, grain: turn, lines: 30, hatch: 0.5, ink: 1.8 }); for (let k = 1; k < 4; k++) line(g, [at(-L, -W + k * W / 2), at(L, -W + k * W / 2)], 'rgba(20,12,4,0.7)', o.ink * 0.9);
    const inner = boxAt(0, 0, L * 0.84, W * 0.76, turn); poly(g, inner); g.fillStyle = '#2a1e12'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    g.save(); poly(g, inner); g.clip(); for (let i = 0; i < 26; i++) { const [x, y] = at((rng() - 0.5) * L * 1.6, (rng() - 0.5) * W * 1.4), r = s * (0.08 + rng() * 0.05); inked(g, rng, blob(rng, x, y, r, r * 0.72, 9, 0.18, rng() * 3), pick(rng, ['#9a8058', '#8a7050', '#a88c62']), o, { band: 0.55, lit: 0.1, ink: 1.2, grain: rng() * 3, lines: 3, hatch: 0.3 }); } g.restore();
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { inked(g, rng, boxAt(...at(u * L * 0.9, v * W * 0.88), L * 0.12, W * 0.12, turn), '#3a3834', o, { sharp: true, band: 0.2, ink: 1 }); g.beginPath(); g.arc(...at(u * L * 0.9, v * W * 0.88), Math.max(1, s * 0.022), 0, 6.283); g.fillStyle = '#8a847a'; g.fill(); }
    return [tub];
  } },
  oreVein: { label: 'Ore veins', size: 1.2, height: 0, flat: true, paint(g, s, rng, o) {
    // A seam of ore in the floor's rock: a dark crack, its walls inked, metal showing in it in dull flakes, a glint here and there.
    const [main, dark] = pick(rng, [['#b89038', '#5a400e'], ['#a8643a', '#4a2410'], ['#7a8a96', '#30383e'], ['#4a9078', '#183e30']]);
    const veins = [wander(rng, -s * 0.85, (rng() - 0.5) * s * 0.4, (rng() - 0.5) * 0.6, 9, s * 0.2, 0.7)]; for (let i = 0; i < 3; i++) { const p = pick(rng, veins[0]); veins.push(wander(rng, p[0], p[1], rng() * 6.28, 4, s * 0.12, 0.8)); }
    for (const v of veins) { line(g, v, INKD, o.unit * 0.05); line(g, v, '#1a1612', o.unit * 0.036); }
    for (const v of veins) for (let k = 1; k < v.length; k++) for (let j = 0; j < 4; j++) { const t = rng(), x = v[k - 1][0] + (v[k][0] - v[k - 1][0]) * t + (rng() - 0.5) * o.unit * 0.02, y = v[k - 1][1] + (v[k][1] - v[k - 1][1]) * t + (rng() - 0.5) * o.unit * 0.02, f = blob(rng, x, y, o.unit * 0.014, o.unit * 0.009, 5, 0.3); inked(g, rng, f, mix(main, dark, rng() * 0.5), o, { band: 0.2, lit: 0.3, ink: 0.6 }); }
    for (const v of veins) for (const [x, y] of v) if (rng() < 0.15) { g.beginPath(); g.arc(x, y, o.unit * 0.005, 0, 6.283); g.fillStyle = 'rgba(255,244,210,0.8)'; g.fill(); }
    return null;
  } },
  pickaxe: { label: 'Dropped tools', size: 0.7, height: 0.05, paint(g, s, rng, o) {
    // A tool left lying: a pick or a shovel, its haft grained and worn, its iron grey and heavily inked as the map's hammers are.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], out = [];
    const haft = boxAt(...at(-s * 0.15, 0), s * 0.7, s * 0.045, a); softShadow(g, haft, o, 0.3); inked(g, rng, haft, '#8a6a42', o, { sharp: true, grain: a, lines: 5, hatch: 0.4, ink: 1.3 }); out.push(haft);
    if (rng() < 0.5) { const head = [at(s * 0.48, -s * 0.52), at(s * 0.64, -s * 0.06), at(s * 0.64, s * 0.06), at(s * 0.48, s * 0.52), at(s * 0.55, 0)]; inked(g, rng, head, '#6a6660', o, { grain: a + 1.57, lines: 4, hatch: 0.3, band: 0.4, ink: 1.5 }); out.push(head); }
    else { const blade = [at(s * 0.5, -s * 0.17), at(s * 0.86, -s * 0.19), at(s * 0.96, 0), at(s * 0.86, s * 0.19), at(s * 0.5, s * 0.17)]; inked(g, rng, blade, '#6e665c', o, { band: 0.45, ink: 1.5 }); speckle(g, rng, ...at(s * 0.74, 0), s * 0.12, s * 0.1, 16, ['#7a3a1a', '#5a2a10'], o.unit * 0.007); out.push(blade); }
    return out;
  } },
  chains: { label: 'Chains', size: 0.9, height: 0.05, paint(g, s, rng, o) {
    // A chain dropped in a tangled heap as the village barn's lies: its links follow the chain's own path round and over itself,
    // each one inked, grey iron with some rust, a shackle open at its end.
    let x = (rng() - 0.5) * s * 0.2, y = (rng() - 0.5) * s * 0.2, a = rng() * 6.28; const path = [[x, y, a]], step = o.unit * 0.042, R = s * 0.6;
    for (let i = 0; i < 140; i++) { a += (rng() - 0.5) * 0.9; const d = Math.hypot(x, y); if (d > R * 0.55) { const home = Math.atan2(-y, -x), diff = Math.atan2(Math.sin(home - a), Math.cos(home - a)); a += diff * 0.18 * (d / R); } x += Math.cos(a) * step; y += Math.sin(a) * step; path.push([x, y, a]); }
    g.save(); g.filter = `blur(${Math.max(1, s * 0.04)}px)`; for (const [px, py] of path) { g.beginPath(); g.arc(px + s * 0.02, py + s * 0.03, step * 0.8, 0, 6.283); g.fillStyle = 'rgba(10,6,2,0.12)'; g.fill(); } g.restore();
    path.forEach(([px, py, pa], i) => { g.beginPath(); g.ellipse(px, py, step * 0.75, i % 2 ? step * 0.42 : step * 0.16, pa, 0, 6.283); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.7; g.stroke(); g.strokeStyle = pick(rng, ['#86827a', '#76726a', '#7e6a56']); g.lineWidth = o.ink * 0.75; g.stroke(); });
    const [ex, ey, ea] = path[path.length - 1]; g.beginPath(); g.arc(ex + Math.cos(ea) * step * 1.5, ey + Math.sin(ea) * step * 1.5, step * 1.6, ea + 0.6, ea + 5.7); g.strokeStyle = INKD; g.lineWidth = o.ink * 3.4; g.stroke(); g.strokeStyle = '#6a665e'; g.lineWidth = o.ink * 1.8; g.stroke();
    return [path.map(([px, py]) => [px, py])];
  } },
  cage: { label: 'Cages', size: 1.1, height: 1.4, paint(g, s, rng, o) {
    // A grate of lashed poles as Sootscale Caverns' pit cover: poles laid across each other, cord bound at every crossing, dark beneath.
    const R = s * 0.75, box = boxAt(0, 0, R, R, (rng() - 0.5) * 0.2), turn = Math.atan2(box[1][1] - box[0][1], box[1][0] - box[0][0]), c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v];
    poly(g, box); g.fillStyle = 'rgba(8,6,4,0.75)'; g.fill();
    const n = 5, pole = (p0, p1) => { const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2], l = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / 2, t = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]); inked(g, rng, boxAt(...mid, l, s * 0.04, t), pick(rng, ['#7a5a36', '#6a4e30', '#8a6840']), o, { sharp: true, grain: t, lines: 4, hatch: 0.4, ink: 1.2 }); };
    for (let i = 0; i < n; i++) { const t = -R * 0.9 + (i / (n - 1)) * R * 1.8; pole(at(t, -R * 1.02), at(t, R * 1.02)); }
    for (let i = 0; i < n; i++) { const t = -R * 0.9 + (i / (n - 1)) * R * 1.8; pole(at(-R * 1.02, t), at(R * 1.02, t)); }
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [x, y] = at(-R * 0.9 + (i / (n - 1)) * R * 1.8, -R * 0.9 + (j / (n - 1)) * R * 1.8); for (const k of [-1, 1]) { const p = [[x - s * 0.04, y - s * 0.04 * k], [x + s * 0.04, y + s * 0.04 * k]]; line(g, p, INKD, Math.max(1, o.ink * 1.6)); line(g, p, '#8a7a5a', Math.max(0.6, o.ink * 0.7)); } }
    return [box];
  } },
  coffin: { label: 'Coffins', size: 1.5, height: 0.5, paint(g, s, rng, o) {
    // A plain plank coffin, wide at the shoulders, its lid shoved half off and cracked, the dark inside showing.
    const turn = rng() * 6.28, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.85, W = s * 0.3;
    const shape = (dx, dy, k) => [at(-L * k, -W * 0.62 * k), at(L * 0.42 * k, -W * k), at(L * k, -W * 0.5 * k), at(L * k, W * 0.5 * k), at(L * 0.42 * k, W * k), at(-L * k, W * 0.62 * k)].map(([x, y]) => [x + dx, y + dy]);
    const body = shape(0, 0, 1); softShadow(g, body, o, 0.5); inked(g, rng, body, '#4e3a26', o, { sharp: true, grain: turn, lines: 10, hatch: 0.4, ink: 1.7 });
    poly(g, shape(0, 0, 0.84)); g.fillStyle = '#0c0805'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    const off = [s * 0.1 * c - s * 0.17 * sn, s * 0.1 * sn + s * 0.17 * c], lid = shape(off[0], off[1], 0.97); softShadow(g, lid, o, 0.4);
    inked(g, rng, lid, '#7a5e3e', o, { sharp: true, grain: turn, lines: 18, hatch: 0.4, ink: 1.6 });
    for (let k = -1; k <= 1; k++) line(g, [at(-L * 0.95, k * W * 0.32), at(L * 0.95, k * W * 0.3)].map(([x, y]) => [x + off[0], y + off[1]]), 'rgba(20,12,4,0.7)', o.ink * 0.8);
    line(g, wander(rng, ...[at(L * 0.2, -W * 0.4)].map(([x, y]) => [x + off[0], y + off[1]])[0], turn + 1.3, 4, W * 0.2, 1), INKD, o.ink * 0.9);
    return [body, lid];
  } },
  sarcophagus: { label: 'Sarcophagi', size: 1.7, height: 0.9, paint(g, s, rng, o) {
    // As the tomb's: a stone box with a carved border, its dark hollow inside, the heavy lid shoved aside and cracked across.
    const turn = rng() * 6.28, c = Math.cos(turn), sn = Math.sin(turn), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.82, W = s * 0.42, base = pick(rng, ['#8e8a7e', '#827e72', '#96928a']);
    const box = boxAt(0, 0, L, W, turn); softShadow(g, box, o, 0.55); inked(g, rng, box, base, o, { sharp: true, grain: turn + 0.6, lines: 10, hatch: 0.15, ink: 1.8 });
    poly(g, boxAt(0, 0, L * 0.9, W * 0.82, turn)); g.strokeStyle = 'rgba(20,16,10,0.55)'; g.lineWidth = o.ink * 0.8; g.stroke();
    const hollow = boxAt(0, 0, L * 0.78, W * 0.6, turn); poly(g, hollow); g.fillStyle = '#16120c'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.2; g.stroke();
    const lid = boxAt(...at(L * 0.35, W * 0.55), L * 0.62, W * 0.95, turn + 0.25); softShadow(g, lid, o, 0.5); inked(g, rng, lid, shade(base, 0.06), o, { sharp: true, grain: turn, lines: 8, hatch: 0.15, ink: 1.7 });
    for (let i = 0; i < 2; i++) line(g, wander(rng, ...centre(lid), turn + 1.57 + (rng() - 0.5), 5, W * 0.25, 1), INKD, o.ink * 1.1);
    return [box];
  } },
  brokenPillar: { label: 'Broken pillars', size: 1.2, height: 1.2, paint(g, s, rng, o) {
    // As Whiterose Abbey's: an octagonal base with a carved band, the round column on it broken off short, rubble in its stump.
    const base = pick(rng, ['#9a968a', '#8e8a80', '#a29e92']), R = s * 0.85, turn = rng() * 0.4, oct = []; for (let i = 0; i < 8; i++) { const a = turn + (i / 8) * 6.283 + Math.PI / 8; oct.push([Math.cos(a) * R, Math.sin(a) * R]); }
    softShadow(g, oct, o, 0.5); inked(g, rng, oct, base, o, { sharp: true, grain: 0.4, lines: 12, hatch: 0.12, ink: 1.8 });
    const inner = oct.map(([x, y]) => [x * 0.82, y * 0.82]); poly(g, inner); g.strokeStyle = 'rgba(20,16,10,0.6)'; g.lineWidth = o.ink; g.stroke();
    for (let i = 0; i < 32; i++) { const a = (i / 32) * 6.283, p = [[Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84], [Math.cos(a + 0.1) * R * 0.9, Math.sin(a + 0.1) * R * 0.9]]; line(g, p, 'rgba(20,16,10,0.4)', Math.max(0.5, o.ink * 0.5)); }
    const col = blob(rng, 0, 0, R * 0.62, R * 0.62, 26, 0.02); inked(g, rng, col, shade(base, 0.08), o, { band: 0.4, ink: 1.6 });
    g.save(); trace(g, moved(col, 0, 0, 0.86)); g.clip(); g.fillStyle = shade(base, -0.35); g.fillRect(-R, -R, R * 2, R * 2); for (let i = 0; i < 14; i++) { const a = rng() * 6.28, d = rng() * R * 0.42, r = R * (0.08 + rng() * 0.08), x = Math.cos(a) * d, y = Math.sin(a) * d, pts = []; for (let k = 0; k < 5; k++) { const q = (k / 5) * 6.283 + rng() * 0.6; pts.push([x + Math.cos(q) * r * (0.6 + rng() * 0.5), y + Math.sin(q) * r * (0.6 + rng() * 0.5)]); } inked(g, rng, pts, shade(base, (rng() - 0.6) * 0.3), o, { sharp: true, band: 0.5, ink: 1.1 }); } g.restore();
    trace(g, moved(col, 0, 0, 0.86)); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.2; g.stroke();
    return [oct];
  } },
  treasure: { label: 'Treasure', size: 1.3, height: 0.2, paint(g, s, rng, o) {
    // As Armag's hoard: orange gold coins heaped thick, grey silver among them, a blue gem or two, each disc inked.
    const R = s * 0.78, hull = blob(rng, 0, 0, R, R * 0.8, 18, 0.25);
    g.save(); g.filter = `blur(${Math.max(1, s * 0.04)}px)`; trace(g, hull); g.fillStyle = 'rgba(70,40,10,0.45)'; g.fill(); g.restore();
    for (let i = 0; i < 220; i++) { const a = rng() * 6.28, d = Math.pow(rng(), 0.75) * R, x = Math.cos(a) * d, y = Math.sin(a) * d * 0.85, r = o.unit * (0.018 + rng() * 0.006), silver = rng() < 0.22;
      g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0, 0, 6.283); g.fillStyle = silver ? pick(rng, ['#b8b8b0', '#9a9a94']) : pick(rng, ['#d8862a', '#e8a038', '#c87420']); g.fill(); g.strokeStyle = 'rgba(40,20,4,0.85)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); g.beginPath(); g.arc(x - r * 0.25, y - r * 0.25, r * 0.3, 0, 6.283); g.fillStyle = 'rgba(255,240,190,0.55)'; g.fill(); }
    for (let i = 0; i < 2; i++) { const a = rng() * 6.28, d = rng() * R * 0.5, x = Math.cos(a) * d, y = Math.sin(a) * d, r = o.unit * 0.04; inked(g, rng, [[x, y - r], [x + r, y], [x, y + r], [x - r, y]], pick(rng, ['#2a6ab8', '#3a7ad0']), o, { sharp: true, band: 0.3, lit: 0.4, ink: 1.1 }); }
    return [hull];
  } },
  papers: { label: 'Scattered papers', size: 1.1, height: 0, flat: true, paint(g, s, rng, o) {
    // As the village alley's: white sheets, a thin ink border, grey scribbled lines of writing, a corner curled.
    for (let i = 0; i < 5; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.5, x = Math.cos(a) * d, y = Math.sin(a) * d, t = rng() * 6.28, c = Math.cos(t), sn = Math.sin(t), w = s * 0.2, h = s * 0.27, at = (u, v) => [x + c * u - sn * v, y + sn * u + c * v];
      const page = [at(-w, -h), at(w, -h), at(w, h * 0.75), at(w * 0.75, h), at(-w, h)]; softShadow(g, page, o, 0.3);
      inked(g, rng, page, pick(rng, ['#ece8dc', '#e0dccc', '#f0ece2']), o, { sharp: true, band: 0.18, ink: 1 });
      for (let k = 0; k < 7; k++) { const v = -h * 0.75 + k * h * 0.22, p = [at(-w * 0.75, v)]; for (let j = 1; j <= 6; j++) p.push(at(-w * 0.75 + j * w * 0.22 * (0.7 + rng() * 0.3), v + (rng() - 0.5) * h * 0.04)); line(g, p.slice(0, 3 + Math.floor(rng() * 4)), 'rgba(60,56,50,0.55)', Math.max(0.5, o.ink * 0.45)); }
      poly(g, [at(w, h * 0.75), at(w * 0.75, h), at(w * 0.78, h * 0.78)]); g.fillStyle = '#c8c4b4'; g.fill(); g.strokeStyle = INKD; g.lineWidth = Math.max(0.5, o.ink * 0.6); g.stroke(); }
    return null;
  } },
  hangingRoots: { label: 'Hanging roots', size: 1.8, height: 0.1, paint(g, s, rng, o) {
    // As Armag's tomb: thick dark roots in a tangle, each heavily inked, forking and thinning, knotted where they cross.
    const strands = [];
    for (let i = 0; i < 8; i++) { const a = rng() * 6.28, p = wander(rng, Math.cos(a) * s * 0.85, Math.sin(a) * s * 0.85, a + Math.PI + (rng() - 0.5) * 0.8, 9, s * 0.17, 0.7); strands.push(p); for (let k = 2; k < p.length - 2; k += 3) if (rng() < 0.6) strands.push(wander(rng, ...p[k], rng() * 6.28, 4, s * 0.1, 1)); }
    for (const p of strands) for (let k = 1; k < p.length; k++) { const w = o.unit * 0.05 * (1 - k / p.length) + o.unit * 0.006; line(g, [p[k - 1], p[k]], INKD, w + o.ink * 1.6); }
    for (const p of strands) for (let k = 1; k < p.length; k++) { const w = o.unit * 0.05 * (1 - k / p.length) + o.unit * 0.006; line(g, [p[k - 1], p[k]], '#3a2c1e', w); line(g, [p[k - 1], p[k]].map(([x, y]) => [x - w * 0.2, y - w * 0.25]), 'rgba(140,120,90,0.25)', w * 0.25); }
    return null;
  } },
  dripSpot: { label: 'Drip spots', size: 0.6, height: 0, flat: true, paint(g, s, rng, o) {
    // Where water drips from the roof: a wet dark stain, a small rimmed basin of pale flowstone round it, inked, a ripple in it.
    g.save(); g.filter = `blur(${Math.max(1, s * 0.08)}px)`; trace(g, blob(rng, 0, 0, s * 0.8, s * 0.65, 12, 0.3)); g.fillStyle = 'rgba(10,14,16,0.5)'; g.fill(); g.restore();
    const rim = blob(rng, 0, 0, s * 0.42, s * 0.36, 16, 0.12); inked(g, rng, rim, '#6e6858', o, { band: 0.4, ink: 1.3, grain: rng() * 3, lines: 4, hatch: 0.3 });
    const pool = moved(rim, 0, 0, 0.72); trace(g, pool); g.fillStyle = '#0c1416'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    g.beginPath(); g.ellipse(s * 0.03, s * 0.02, s * 0.12, s * 0.09, 0, 0, 6.283); g.strokeStyle = 'rgba(170,200,210,0.4)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke();
    return null;
  } },
  bloodstain: { label: 'Old bloodstains', size: 1.2, height: 0, flat: true, paint(g, s, rng, o) {
    // As the Stag Lord's fort: dried blood soaked into the ground, dark red-brown and blotchy, softer at its edges, drops spattered round.
    g.save(); g.filter = `blur(${Math.max(1, o.unit * 0.008)}px)`;
    for (let i = 0; i < 7; i++) { const a = rng() * 6.28, d = rng() * s * 0.35, r = s * (0.15 + rng() * 0.2); trace(g, blob(rng, Math.cos(a) * d, Math.sin(a) * d, r, r * 0.75, 12, 0.4)); g.fillStyle = `rgba(${pick(rng, ['42,12,6', '34,10,4', '54,18,8'])},${0.6 + rng() * 0.25})`; g.fill(); }
    g.restore();
    for (let i = 0; i < 22; i++) { const b = rng() * 6.28, d = s * (0.4 + rng() * 0.5), r = o.unit * (0.006 + rng() * 0.014); g.beginPath(); g.arc(Math.cos(b) * d, Math.sin(b) * d, r, 0, 6.283); g.fillStyle = 'rgba(34,10,4,0.85)'; g.fill(); }
    return null;
  } },
  // --- More town, dungeon and camp kinds ---------------------------------------------------------------------------------------------
  anvil: { label: 'Anvils', size: 0.9, height: 0.6, paint(g, s, rng, o) {
    // As Oleg's: a dark grey anvil, its horn tapering to a point one way, the square heel the other, a lit edge along its face, on
    // a squat block of wood.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v];
    const block = blob(rng, 0, 0, s * 0.42, s * 0.42, 16, 0.08); if (rng() < 0.4) { softShadow(g, block, o, 0.5); inked(g, rng, block, '#4a3824', o, { grain: a + 1.57, lines: 10, hatch: 0.4, ink: 1.4 }); }
    for (const [u, v] of [[-0.38, -1], [-0.38, 1], [0.08, -1], [0.08, 1]]) { const foot = [at(s * u - s * 0.1, v * s * 0.12), at(s * u + s * 0.1, v * s * 0.12), at(s * u + s * 0.14, v * s * 0.36), at(s * u - s * 0.14, v * s * 0.36)]; inked(g, rng, foot, '#4a4844', o, { sharp: true, band: 0.4, ink: 1.4 }); }
    const body = [at(-s * 0.55, -s * 0.2), at(s * 0.15, -s * 0.2), at(s * 0.3, -s * 0.12), at(s * 0.68, 0), at(s * 0.3, s * 0.12), at(s * 0.15, s * 0.2), at(-s * 0.55, s * 0.2), at(-s * 0.6, s * 0.1), at(-s * 0.6, -s * 0.1)];
    softShadow(g, body, o, 0.55); inked(g, rng, body, '#7a7872', o, { sharp: true, grain: a, lines: 8, hatch: 0.25, band: 0.5, lit: 0.12, ink: 1.8 });
    line(g, [at(-s * 0.5, -s * 0.12), at(s * 0.2, -s * 0.12), at(s * 0.7, -s * 0.02)], 'rgba(220,220,210,0.45)', Math.max(0.8, o.ink * 0.9));
    g.beginPath(); g.arc(...at(-s * 0.35, 0), s * 0.05, 0, 6.283); g.fillStyle = '#1a1816'; g.fill();
    return [block, body];
  } },
  urns: { label: 'Urns', size: 1.6, height: 0.5, paint(g, s, rng, o) {
    // As Vordakai's tomb: a cluster of urns seen from above, pale glazed or dark, their open mouths black, a ring or band of
    // pattern round each shoulder; one or two knocked over.
    const out = [], n = 5 + Math.floor(rng() * 4), spots = [];
    for (let i = 0; i < n; i++) { let x = 0, y = 0, r = s * (0.13 + rng() * 0.06); for (let k = 0; k < 12; k++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.62; x = Math.cos(a) * d; y = Math.sin(a) * d; if (spots.every(([px, py, pr]) => Math.hypot(px - x, py - y) > (pr + r) * 0.95)) break; } spots.push([x, y, r]); const pale = rng() < 0.55, base = pale ? pick(rng, ['#c8c4b8', '#b8b4aa', '#d4d0c4']) : pick(rng, ['#3a3632', '#4a4038', '#2e2a26']);
      if (rng() < 0.25) { const t = rng() * 6.28, c = Math.cos(t), sn = Math.sin(t), at = (u, v) => [x + c * u - sn * v, y + sn * u + c * v], side = []; for (let k = 0; k < 20; k++) { const q = (k / 20) * 6.283, u = Math.cos(q) * r * 1.2, w = u > r * 0.5 ? 0.5 + 0.5 * (1 - (u - r * 0.5) / (r * 0.7)) : 1; side.push(at(u, Math.sin(q) * r * 0.85 * w)); } softShadow(g, side, o, 0.45); inked(g, rng, side, base, o, { band: 0.55, lit: 0.12, ink: 1.6 }); g.beginPath(); g.ellipse(...at(r * 1.18, 0), r * 0.1, r * 0.4, t, 0, 6.283); g.fillStyle = '#0c0a08'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke(); out.push(side); continue; }
      const pot = blob(rng, x, y, r, r, 20, 0.02); softShadow(g, pot, o, 0.5); inked(g, rng, pot, base, o, { band: 0.55, lit: 0.14, ink: 1.6 });
      g.beginPath(); g.arc(x, y, r * 0.72, 0, 6.283); g.strokeStyle = pale ? 'rgba(30,26,20,0.7)' : 'rgba(200,190,170,0.4)'; g.lineWidth = Math.max(0.8, o.ink * 0.9); g.stroke();
      if (rng() < 0.6) for (let k = 0; k < 10; k++) { const q = (k / 10) * 6.283; g.beginPath(); g.arc(x + Math.cos(q) * r * 0.86, y + Math.sin(q) * r * 0.86, r * 0.06, 0, 6.283); g.fillStyle = pale ? '#2a2620' : '#9a9080'; g.fill(); }
      g.beginPath(); g.arc(x, y, r * 0.45, 0, 6.283); g.fillStyle = shade(base, -0.2); g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke(); g.beginPath(); g.arc(x, y, r * 0.32, 0, 6.283); g.fillStyle = '#0a0806'; g.fill();
      out.push(pot); }
    return out;
  } },
  timbers: { label: 'Collapsed timbers', size: 2.0, height: 0.6, paint(g, s, rng, o) {
    // As the collapsed mine: heavy squared beams fallen across each other, splintered where they broke, planks among them, dark gaps
    // and broken earth beneath.
    g.save(); g.filter = `blur(${Math.max(1, s * 0.06)}px)`; trace(g, blob(rng, 0, 0, s * 0.85, s * 0.6, 14, 0.3)); g.fillStyle = 'rgba(14,8,4,0.55)'; g.fill(); g.restore();
    speckle(g, rng, 0, 0, s * 0.75, s * 0.5, 80, ['#3a2a18', '#5a4428', '#2a1e10'], o.unit * 0.01);
    const out = [];
    for (let i = 0; i < 6; i++) { const a = rng() * 3.14, big = i < 3, len = s * (big ? 0.75 + rng() * 0.2 : 0.45 + rng() * 0.2), wid = s * (big ? 0.11 : 0.06), cx = (rng() - 0.5) * s * 0.5, cy = (rng() - 0.5) * s * 0.4, beam = boxAt(cx, cy, len, wid, a);
      softShadow(g, beam, o, 0.5); inked(g, rng, beam, pick(rng, ['#7a5e3a', '#6a5032', '#8a6c44']), o, { sharp: true, grain: a, lines: big ? 14 : 7, hatch: 0.5, band: 0.45, ink: 1.6 });
      const c = Math.cos(a), sn = Math.sin(a), end = [cx + c * len, cy + sn * len]; for (let k = 0; k < 5; k++) { const v = (k / 4 - 0.5) * wid * 1.8, l = s * (0.04 + rng() * 0.09); poly(g, [[end[0] - sn * (v - wid * 0.2), end[1] + c * (v - wid * 0.2)], [end[0] + c * l - sn * v, end[1] + sn * l + c * v], [end[0] - sn * (v + wid * 0.2), end[1] + c * (v + wid * 0.2)]]); g.fillStyle = '#9a7a50'; g.fill(); g.strokeStyle = INKD; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); }
      out.push(beam); }
    return out;
  } },
  stakeFence: { label: 'Stake fences', size: 2.0, height: 0.7, paint(g, s, rng, o) {
    // As Sootscale's: sharpened stakes driven in a row, their round tops banded, a rope looped from one to the next and sagging between.
    const a = (rng() - 0.5) * 0.4, c = Math.cos(a), sn = Math.sin(a), n = 4, tops = [], out = [];
    for (let i = 0; i < n; i++) { const u = -s * 0.85 + (i / (n - 1)) * s * 1.7, v = (rng() - 0.5) * s * 0.06; tops.push([c * u - sn * v, sn * u + c * v]); }
    for (let i = 1; i < n; i++) { const [x0, y0] = tops[i - 1], [x1, y1] = tops[i], mx = (x0 + x1) / 2 - sn * s * 0.08, my = (y0 + y1) / 2 + c * s * 0.08; for (const [col, w] of [[INKD, o.ink * 3], ['#a08a5a', o.ink * 1.6]]) { g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(mx, my, x1, y1); g.strokeStyle = col; g.lineWidth = w; g.stroke(); } for (let k = 1; k < 8; k++) { const t = k / 8, px = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * mx + t * t * x1, py = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * my + t * t * y1; line(g, [[px - c * o.ink, py - sn * o.ink], [px + c * o.ink * 0.5 + sn * o.ink, py + sn * o.ink * 0.5 - c * o.ink]], 'rgba(30,20,8,0.7)', Math.max(0.5, o.ink * 0.6)); } }
    for (const [x, y] of tops) { const top = blob(rng, x, y, s * 0.1, s * 0.1, 12, 0.06); softShadow(g, top, o, 0.45); inked(g, rng, top, '#8a5428', o, { band: 0.45, lit: 0.08, ink: 1.7 }); for (let k = 1; k <= 2; k++) { g.beginPath(); g.arc(x, y, s * 0.033 * k, 0, 6.283); g.strokeStyle = 'rgba(40,20,6,0.6)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); } g.beginPath(); g.arc(x, y, s * 0.1, 0, 6.283); g.strokeStyle = 'rgba(200,150,90,0.6)'; g.lineWidth = o.ink * 0.7; g.stroke(); out.push(top); }
    return out;
  } },
  strawBed: { label: 'Straw beds', size: 1.6, height: 0, flat: true, paint(g, s, rng, o) {
    // As Giant's Cave's: a sleeping place of pale loose straw strewn thick in an oval, each strand inked fine, thinning at its edges.
    const R = s * 0.85, k = 0.62;
    g.save(); g.filter = `blur(${Math.max(1, s * 0.05)}px)`; g.beginPath(); g.ellipse(0, 0, R * 0.85, R * k * 0.85, 0, 0, 6.283); g.fillStyle = 'rgba(140,120,70,0.45)'; g.fill(); g.restore();
    for (let i = 0; i < 900; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * (rng() < 0.85 ? 0.9 : 1.1), x = Math.cos(a) * d * R, y = Math.sin(a) * d * R * k, b = rng() * 6.28, l = o.unit * (0.06 + rng() * 0.08); const p = [[x, y], [x + Math.cos(b) * l, y + Math.sin(b) * l]]; line(g, p, 'rgba(40,30,12,0.55)', Math.max(0.7, o.ink * 0.75)); line(g, p, pick(rng, ['#d8c890', '#c8b478', '#e4d6a0', '#b8a468']), Math.max(0.5, o.ink * 0.4)); }
    return null;
  } },
  boneRubble: { label: 'Bones in rubble', size: 1.8, height: 0.35, paint(g, s, rng, o) {
    // A heap of broken stone, pale and angular as the tomb's rubble, with old bones lying in it and a skull half buried.
    const out = [];
    g.save(); g.filter = `blur(${Math.max(1, s * 0.05)}px)`; trace(g, blob(rng, 0, 0, s * 0.8, s * 0.65, 12, 0.3)); g.fillStyle = 'rgba(20,14,8,0.5)'; g.fill(); g.restore();
    const rocks = []; for (let i = 0; i < 18; i++) { const a = rng() * 6.28, d = Math.sqrt(rng()) * s * 0.65; rocks.push([Math.cos(a) * d, Math.sin(a) * d, s * (0.1 + rng() * 0.14)]); } rocks.sort((p, q) => Math.hypot(q[0], q[1]) - Math.hypot(p[0], p[1]));
    for (const [x, y, r] of rocks) { const pts = []; for (let k = 0; k < 5 + Math.floor(rng() * 2); k++) { const q = (k / 6) * 6.283 + rng() * 0.7; pts.push([x + Math.cos(q) * r * (0.6 + rng() * 0.5), y + Math.sin(q) * r * (0.6 + rng() * 0.5)]); } inked(g, rng, pts, shade(pick(rng, o.cave ? ['#8a8680', '#7a7670', '#949088'] : ['#9a948a', '#8a847a', '#a49e92']), (rng() - 0.5) * 0.2), o, { sharp: true, band: 0.5, lit: 0.1, ink: 1.4, grain: rng() * 3, lines: 3, hatch: 0.2 }); out.push(pts); }
    const bone = ['#d8ccb0', '#a89a7a'];
    for (let i = 0; i < 3; i++) { const a = rng() * 6.28, x = (rng() - 0.5) * s * 0.7, y = (rng() - 0.5) * s * 0.6, l = s * (0.18 + rng() * 0.12), p = [[x - Math.cos(a) * l, y - Math.sin(a) * l], [x + Math.cos(a) * l, y + Math.sin(a) * l]]; line(g, p, INKD, o.unit * 0.04 + o.ink * 1.6); line(g, p, bone[1], o.unit * 0.04); line(g, p.map(([px, py]) => [px - 0.6, py - 0.6]), bone[0], o.unit * 0.015); for (const [ex, ey] of p) { g.beginPath(); g.arc(ex, ey, o.unit * 0.032, 0, 6.283); g.fillStyle = bone[0]; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.2; g.stroke(); } }
    const [kx, ky] = [(rng() - 0.5) * s * 0.4, (rng() - 0.5) * s * 0.4], skull = blob(rng, kx, ky, s * 0.13, s * 0.15, 12, 0.04); inked(g, rng, skull, bone[0], o, { band: 0.5, lit: 0.1, ink: 1.5 });
    for (const k of [-1, 1]) { g.beginPath(); g.ellipse(kx + k * s * 0.05, ky + s * 0.02, s * 0.035, s * 0.04, 0, 0, 6.283); g.fillStyle = '#140c06'; g.fill(); } out.push(skull);
    return out;
  } },
  produce: { label: 'Produce crates', size: 1.0, height: 0.45, paint(g, s, rng, o) {
    // An open crate of produce as the homestead's cart carries them: a frame of planks, and heaped inside potatoes, apples, cabbages
    // or turnips, each one inked.
    const turn = (rng() - 0.5) * 0.8, W = s * 0.7, H = s * 0.52, box = boxAt(0, 0, W, H, turn), [base, small, n] = pick(rng, [['#9a7a48', 0.085, 90], ['#9a3420', 0.08, 95], ['#6e7e34', 0.13, 30], ['#c0ae90', 0.09, 70]]);
    softShadow(g, box, o, 0.5); inked(g, rng, box, '#6e5232', o, { sharp: true, grain: turn, lines: 12, hatch: 0.45, ink: 1.8 });
    const inner = boxAt(0, 0, W * 0.84, H * 0.78, turn); poly(g, inner); g.fillStyle = '#3a2814'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    g.save(); poly(g, inner); g.clip(); const c = Math.cos(turn), sn = Math.sin(turn);
    for (let i = 0; i < n; i++) { const u = (rng() - 0.5) * W * 1.7, v = (rng() - 0.5) * H * 1.6, x = c * u - sn * v, y = sn * u + c * v, r = s * small * (0.85 + rng() * 0.3), item = blob(rng, x, y, r, r * (0.8 + rng() * 0.2), 10, 0.1); inked(g, rng, item, shade(base, (rng() - 0.5) * 0.25), o, { band: 0.55, lit: 0.12, ink: 1.1, grain: rng() * 3, lines: base === '#7a8a3a' ? 6 : 1, hatch: 0.3 }); if (base === '#a83a24') { g.beginPath(); g.arc(x, y - r * 0.2, r * 0.12, 0, 6.283); g.fillStyle = '#3a2410'; g.fill(); } }
    g.restore();
    for (const k of [-1, 1]) line(g, [...[[-W, k * H * 0.92], [W, k * H * 0.92]].map(([u, v]) => [c * u - sn * v, sn * u + c * v])], 'rgba(20,12,4,0.6)', o.ink * 0.8);
    return [box];
  } },
  bench: { label: 'Benches', size: 1.6, height: 0.45, paint(g, s, rng, o) {
    // A plank bench: two or three boards side by side, grain along them, nail heads at the ends where the legs are, worn pale on top.
    const a = rng() * 6.28, L = s * 0.85, W = s * 0.2, seat = boxAt(0, 0, L, W, a), c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v];
    softShadow(g, seat, o, 0.5); inked(g, rng, seat, '#7a5e3c', o, { sharp: true, grain: a, lines: 14, hatch: 0.45, ink: 1.6 });
    line(g, [at(-L, 0), at(L, 0)], 'rgba(20,12,4,0.75)', o.ink * 0.9);
    for (const u of [-L * 0.82, L * 0.82]) for (const v of [-W * 0.5, W * 0.5]) { g.beginPath(); g.arc(...at(u, v), Math.max(1, s * 0.018), 0, 6.283); g.fillStyle = '#2a2622'; g.fill(); }
    return [seat];
  } },
  tableStools: { label: 'Tables', size: 1.8, height: 0.8, paint(g, s, rng, o) {
    // As the trading post's and the tavern's: a plank table, square or round, with chairs drawn up to it (each a seat and a slatted
    // back), and on it plates, cups and a loaf or two.
    const a = (rng() - 0.5) * 0.6, round = rng() < 0.45, out = [], n = round ? 4 : 4 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) { const q = round ? a + (i / n) * 6.283 + Math.PI / 4 : a + (i < n / 2 ? -Math.PI / 2 : Math.PI / 2), along = round ? 0 : ((i % Math.ceil(n / 2)) - (Math.ceil(n / 2) - 1) / 2) * s * 0.32, d = round ? s * 0.6 : s * 0.48, cx = Math.cos(q) * d + Math.cos(a) * along, cy = Math.sin(q) * d + Math.sin(a) * along;
      const seat = boxAt(cx, cy, s * 0.13, s * 0.13, q); softShadow(g, seat, o, 0.4); inked(g, rng, seat, '#6a4e30', o, { sharp: true, grain: q + 1.57, lines: 5, hatch: 0.4, ink: 1.4 });
      const back = boxAt(cx + Math.cos(q) * s * 0.16, cy + Math.sin(q) * s * 0.16, s * 0.04, s * 0.15, q); inked(g, rng, back, '#5a4228', o, { sharp: true, band: 0.3, ink: 1.3 }); out.push(seat); }
    const top = round ? blob(rng, 0, 0, s * 0.45, s * 0.45, 28, 0.01) : boxAt(0, 0, s * 0.62, s * 0.3, a); softShadow(g, top, o, 0.55);
    inked(g, rng, top, '#7e623e', o, { sharp: !round, grain: a, lines: 24, hatch: 0.45, ink: 1.8 });
    for (let k = -2; k <= 2; k++) { const off = k * (round ? s * 0.17 : s * 0.12); g.save(); pathOf(g, top, !round); g.clip(); line(g, [[-Math.sin(a) * off - Math.cos(a) * s, Math.cos(a) * off - Math.sin(a) * s], [-Math.sin(a) * off + Math.cos(a) * s, Math.cos(a) * off + Math.sin(a) * s]], 'rgba(20,12,4,0.7)', o.ink * 0.8); g.restore(); }
    for (let i = 0; i < 2 + Math.floor(rng() * 4); i++) { const q = rng() * 6.28, d = rng() * s * (round ? 0.28 : 0.22), x = Math.cos(q) * d, y = Math.sin(q) * d * (round ? 1 : 0.6), what = rng();
      if (what < 0.4) { const plate = blob(rng, x, y, s * 0.08, s * 0.08, 14, 0.01); inked(g, rng, plate, '#c8c0aa', o, { band: 0.25, ink: 1 }); g.beginPath(); g.arc(x, y, s * 0.05, 0, 6.283); g.strokeStyle = 'rgba(60,50,30,0.5)'; g.lineWidth = Math.max(0.5, o.ink * 0.5); g.stroke(); }
      else if (what < 0.75) { const cup = blob(rng, x, y, s * 0.045, s * 0.045, 10, 0.01); inked(g, rng, cup, pick(rng, ['#7a7468', '#6a4a2a']), o, { band: 0.3, ink: 1 }); g.beginPath(); g.arc(x, y, s * 0.028, 0, 6.283); g.fillStyle = '#2a1a0c'; g.fill(); }
      else { const loaf = blob(rng, x, y, s * 0.09, s * 0.055, 12, 0.08, q); inked(g, rng, loaf, '#b8843e', o, { band: 0.45, lit: 0.12, ink: 1.1 }); for (let k = -1; k <= 1; k++) line(g, [[x + Math.cos(q) * k * s * 0.04 - Math.sin(q) * s * 0.03, y + Math.sin(q) * k * s * 0.04 + Math.cos(q) * s * 0.03], [x + Math.cos(q) * k * s * 0.04 + Math.sin(q) * s * 0.03, y + Math.sin(q) * k * s * 0.04 - Math.cos(q) * s * 0.03]], 'rgba(60,30,8,0.6)', Math.max(0.5, o.ink * 0.5)); } }
    out.push(top); return out;
  } },
  trough: { label: 'Water troughs', size: 1.8, height: 0.5, paint(g, s, rng, o) {
    // As the village barn's: a long box of thick planks, blue-grey water standing in it with pale ripple lines, iron bands at its ends.
    const a = rng() * 6.28, L = s * 0.85, W = s * 0.25, box = boxAt(0, 0, L, W, a), inner = boxAt(0, 0, L * 0.9, W * 0.66, a), c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v];
    softShadow(g, box, o, 0.55); inked(g, rng, box, '#6e5434', o, { sharp: true, grain: a, lines: 14, hatch: 0.5, ink: 1.9 });
    poly(g, inner); const wg = g.createLinearGradient(...at(0, -W), ...at(0, W)); wg.addColorStop(0, '#5a6e78'); wg.addColorStop(1, '#2e3c44'); g.fillStyle = wg; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.3; g.stroke();
    for (let k = 0; k < 6; k++) { const u = (rng() - 0.5) * L * 1.5, v = (rng() - 0.5) * W * 0.9, l = L * (0.08 + rng() * 0.12); line(g, [at(u, v), at(u + l, v + (rng() - 0.5) * W * 0.1)], 'rgba(200,220,228,0.45)', Math.max(0.5, o.ink * 0.6)); }
    for (const k of [-0.92, 0.92]) inked(g, rng, boxAt(...at(L * k, 0), s * 0.035, W * 1.06, a), '#3e3c38', o, { sharp: true, band: 0.2, ink: 1.2 });
    return [box];
  } },
  hitchingPost: { label: 'Hitching posts', size: 1.4, height: 0.9, paint(g, s, rng, o) {
    // A rail on two posts to tie horses to: the rail's grain along it, the posts' square tops, a rope tied round it here and there.
    const a = rng() * 6.28, L = s * 0.82, rail = boxAt(0, 0, L, s * 0.05, a), out = [rail];
    softShadow(g, rail, o, 0.4); inked(g, rng, rail, '#6e5434', o, { sharp: true, grain: a, lines: 6, hatch: 0.45, ink: 1.5 });
    for (const k of [-0.85, 0.85]) { const post = boxAt(Math.cos(a) * L * k, Math.sin(a) * L * k, s * 0.09, s * 0.09, a); inked(g, rng, post, '#5a4430', o, { sharp: true, grain: a + 1.57, lines: 4, hatch: 0.4, ink: 1.6 }); out.push(post); }
    if (rng() < 0.7) { const u = (rng() - 0.5) * L, x = Math.cos(a) * u, y = Math.sin(a) * u, p = wander(rng, x, y, a + 1.57, 5, s * 0.08, 0.6); line(g, p, INKD, o.ink * 2.6); line(g, p, '#a8905a', o.ink * 1.3); }
    return out;
  } },
  planter: { label: 'Planters', size: 1.3, height: 0.5, paint(g, s, rng, o) {
    // As the Pitaxian avenue's: a wooden box packed with broad dark-green leaves, veined and inked, a few blooms among them.
    const a = rng() * 6.28, L = s * 0.78, W = s * 0.3, box = boxAt(0, 0, L, W, a), inner = boxAt(0, 0, L * 0.9, W * 0.74, a), c = Math.cos(a), sn = Math.sin(a);
    softShadow(g, box, o, 0.5); inked(g, rng, box, '#6e5234', o, { sharp: true, grain: a, lines: 12, hatch: 0.45, ink: 1.7 });
    poly(g, inner); g.fillStyle = '#1e1608'; g.fill(); g.save(); poly(g, boxAt(0, 0, L * 0.98, W * 1.15, a)); g.clip();
    const green = o.season === 'winter' ? ['#3a4426', '#525a34', '#6a6e44'] : ['#2e4a16', '#46661e', '#62802a', '#7e9a34'], bloom = o.season === 'winter' ? null : pick(rng, [null, '#c8506a', '#e0c050', '#e8e2d2']);
    for (let i = 0; i < 26; i++) { const u = (rng() - 0.5) * L * 1.7, v = (rng() - 0.5) * W * 1.3, x = c * u - sn * v, y = sn * u + c * v, len = o.unit * (0.12 + rng() * 0.06), q = rng() * 6.28; leaf(g, x, y, len, q, pick(rng, green), o.ink * 0.7, 0.55); line(g, [[x, y], [x + Math.cos(q) * len * 0.8, y + Math.sin(q) * len * 0.8]], 'rgba(10,20,4,0.5)', Math.max(0.5, o.ink * 0.4)); }
    if (bloom) for (let i = 0; i < 5; i++) { const u = (rng() - 0.5) * L * 1.4, v = (rng() - 0.5) * W, x = c * u - sn * v, y = sn * u + c * v; leaf(g, x, y, o.unit * 0.07, rng() * 6.28, bloom, o.ink * 0.5, 0.6, 'flower'); }
    g.restore(); return [box];
  } },
  washingLine: { label: 'Washing lines', size: 2.2, height: 1.4, paint(g, s, rng, o) {
    // A line strung between two poles with washing pegged along it, shirts and sheets in faded colours, sagging a little.
    const a = (rng() - 0.5) * 0.6, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], p0 = at(-s * 0.88, 0), p1 = at(s * 0.88, 0), mid = at(0, s * 0.06), out = [];
    for (let i = 0; i < 4 + Math.floor(rng() * 3); i++) { const t = 0.12 + (i / 6) * 0.78 + (rng() - 0.5) * 0.05, x = (1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * mid[0] + t * t * p1[0], y = (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * mid[1] + t * t * p1[1], w = s * (0.08 + rng() * 0.07), h = s * (0.14 + rng() * 0.1), cloth = [[x - c * w, y - sn * w], [x + c * w, y + sn * w], [x + c * w * 0.9 - sn * h, y + sn * w * 0.9 + c * h], [x - c * w * 0.9 - sn * h, y - sn * w * 0.9 + c * h]];
      softShadow(g, cloth, o, 0.35); inked(g, rng, cloth, pick(rng, ['#d8d2c0', '#9aa8b8', '#b88a6a', '#a8b090', '#c8b8a0']), o, { sharp: true, grain: a + 1.57, lines: 6, hatch: 0.25, band: 0.4, ink: 1.1 }); out.push(cloth); }
    for (const [col, w] of [[INKD, o.ink * 2], ['#c8b890', o.ink * 0.9]]) { g.beginPath(); g.moveTo(...p0); g.quadraticCurveTo(...mid, ...p1); g.strokeStyle = col; g.lineWidth = w; g.stroke(); }
    for (const p of [p0, p1]) { const pole = blob(rng, ...p, s * 0.06, s * 0.06, 10, 0.05); inked(g, rng, pole, '#5a4430', o, { ink: 1.4 }); out.push(pole); }
    return out;
  } },
  pump: { label: 'Water pumps', size: 0.9, height: 1.1, paint(g, s, rng, o) {
    // A cast-iron pump on a stone slab: its round body, the handle out one side, the spout the other over a worn wet patch.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v];
    const slab = boxAt(0, 0, s * 0.62, s * 0.5, a + 0.1); softShadow(g, slab, o, 0.5); inked(g, rng, slab, '#7a766c', o, { sharp: true, grain: a, lines: 6, hatch: 0.2, ink: 1.5 });
    g.save(); g.filter = `blur(${Math.max(1, s * 0.05)}px)`; g.beginPath(); g.ellipse(...at(s * 0.35, 0), s * 0.18, s * 0.14, a, 0, 6.283); g.fillStyle = 'rgba(20,30,34,0.5)'; g.fill(); g.restore();
    inked(g, rng, boxAt(...at(s * 0.2, 0), s * 0.18, s * 0.05, a), '#3a3834', o, { sharp: true, band: 0.3, ink: 1.3 });
    const handle = [at(-s * 0.1, 0), at(-s * 0.7, -s * 0.08)]; line(g, handle, INKD, o.ink * 3.6); line(g, handle, '#4a4640', o.ink * 2);
    const body = blob(rng, 0, 0, s * 0.17, s * 0.17, 14, 0.02); inked(g, rng, body, '#3e3c38', o, { band: 0.4, lit: 0.15, ink: 1.7 }); g.beginPath(); g.arc(0, 0, s * 0.07, 0, 6.283); g.fillStyle = '#5a5650'; g.fill();
    return [slab, body];
  } },
  washtub: { label: 'Washtubs', size: 1.0, height: 0.45, paint(g, s, rng, o) {
    // As the village alley's: an oval tub of staves bound with iron, dark water standing in it with a pale edge, a slatted
    // washboard leaning in over its rim, a stool beside.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], RX = s * 0.72, RY = s * 0.55, tub = []; for (let k = 0; k < 32; k++) { const q = (k / 32) * 6.283; tub.push(at(Math.cos(q) * RX, Math.sin(q) * RY)); }
    if (rng() < 0.6) { const stool = blob(rng, ...at(RX * 1.05, RY * 0.9), s * 0.18, s * 0.18, 12, 0.03); softShadow(g, stool, o, 0.4); inked(g, rng, stool, '#6e5234', o, { grain: a, lines: 6, hatch: 0.4, ink: 1.4 }); }
    softShadow(g, tub, o, 0.5); inked(g, rng, tub, '#5e4630', o, { band: 0.4, ink: 1.8 });
    for (let k = 0; k < 22; k++) { const q = (k / 22) * 6.283; line(g, [at(Math.cos(q) * RX * 0.82, Math.sin(q) * RY * 0.8), at(Math.cos(q) * RX, Math.sin(q) * RY)], 'rgba(20,12,4,0.6)', Math.max(0.6, o.ink * 0.6)); }
    const water = tub.map(([x, y]) => [x * 0.8, y * 0.8]); trace(g, water); const wg = g.createLinearGradient(...at(-RX, -RY), ...at(RX, RY)); wg.addColorStop(0, '#3a4448'); wg.addColorStop(1, '#1a2024'); g.fillStyle = wg; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink * 1.3; g.stroke();
    trace(g, tub.map(([x, y]) => [x * 0.74, y * 0.74])); g.strokeStyle = 'rgba(170,190,200,0.35)'; g.lineWidth = o.ink * 0.9; g.stroke();
    for (let k = 0; k < 5; k++) { const v = -RY * 0.45 + k * RY * 0.22; line(g, [at(-RX * 0.6, v), at(-RX * 0.62 + (rng() - 0.5) * RX * 0.1, v + RY * 0.06)], 'rgba(160,185,195,0.25)', Math.max(0.5, o.ink * 0.5)); }
    if (rng() < 0.7) { const board = boxAt(...at(RX * 0.15, -RY * 0.1), RX * 0.42, RY * 0.32, a + 0.4); inked(g, rng, board, '#8a7a5a', o, { sharp: true, band: 0.35, ink: 1.4 }); const bc = centre(board); for (let k = -3; k <= 3; k++) { const q = a + 0.4, off = k * RY * 0.08; line(g, [[bc[0] - Math.cos(q) * RX * 0.34 - Math.sin(q) * off, bc[1] - Math.sin(q) * RX * 0.34 + Math.cos(q) * off], [bc[0] + Math.cos(q) * RX * 0.34 - Math.sin(q) * off, bc[1] + Math.sin(q) * RX * 0.34 + Math.cos(q) * off]], 'rgba(30,24,14,0.65)', Math.max(0.6, o.ink * 0.7)); } }
    return [tub];
  } },
  kennel: { label: 'Kennels', size: 1.0, height: 0.8, paint(g, s, rng, o) {
    // A dog's kennel from above: a pitched roof of boards with its ridge down the middle, the doorway's dark mouth at one end, a bowl.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.55, W = s * 0.42;
    const roof = boxAt(0, 0, L, W, a); softShadow(g, roof, o, 0.55);
    for (const k of [-1, 1]) { const half = [at(-L, 0), at(L, 0), at(L, k * W), at(-L, k * W)]; inked(g, rng, half, k < 0 ? '#7a5c38' : '#5e4630', o, { sharp: true, grain: a + 1.57, lines: 10, hatch: 0.45, band: 0.3, ink: 1.5 }); for (let j = 1; j < 5; j++) line(g, [at(-L + j * L * 0.4, 0), at(-L + j * L * 0.4, k * W)], 'rgba(20,12,4,0.55)', o.ink * 0.7); }
    line(g, [at(-L * 1.04, 0), at(L * 1.04, 0)], INKD, o.ink * 2.4); line(g, [at(-L, 0), at(L, 0)], '#9a7a50', o.ink);
    poly(g, [at(L, -W * 0.45), at(L * 1.12, -W * 0.38), at(L * 1.12, W * 0.38), at(L, W * 0.45)]); g.fillStyle = '#100a04'; g.fill(); g.strokeStyle = INKD; g.lineWidth = o.ink; g.stroke();
    const bowl = blob(rng, ...at(L * 1.4, W * 0.5), s * 0.09, s * 0.09, 10, 0.01); inked(g, rng, bowl, '#6a6660', o, { band: 0.3, ink: 1.1 }); g.beginPath(); g.arc(...at(L * 1.4, W * 0.5), s * 0.05, 0, 6.283); g.fillStyle = '#4a3a24'; g.fill();
    return [roof];
  } },
  weaponRack: { label: 'Weapon racks', size: 1.4, height: 1.2, paint(g, s, rng, o) {
    // A wooden rack with spears, swords and axes stood in it: from above, its rail and uprights, the hafts and blades fanned along it.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.8, rail = boxAt(0, 0, L, s * 0.07, a), out = [rail];
    for (let i = 0; i < 5; i++) { const u = -L * 0.75 + (i / 4) * L * 1.5, b = a + 1.57 + (rng() - 0.5) * 0.25, len = s * (0.35 + rng() * 0.25), x = c * u, y = sn * u, tip = [x + Math.cos(b) * len, y + Math.sin(b) * len], back = [x - Math.cos(b) * len * 0.35, y - Math.sin(b) * len * 0.35];
      line(g, [back, tip], INKD, o.ink * 3); line(g, [back, tip], '#7a5a36', o.ink * 1.6);
      const kind = i % 3, cb = Math.cos(b), sb = Math.sin(b); const blade = kind === 0 ? [[tip[0] - sb * s * 0.04, tip[1] + cb * s * 0.04], [tip[0] + cb * s * 0.14, tip[1] + sb * s * 0.14], [tip[0] + sb * s * 0.04, tip[1] - cb * s * 0.04]] : kind === 1 ? [[tip[0] - sb * s * 0.025 - cb * s * 0.2, tip[1] + cb * s * 0.025 - sb * s * 0.2], [tip[0] + cb * s * 0.08, tip[1] + sb * s * 0.08], [tip[0] + sb * s * 0.025 - cb * s * 0.2, tip[1] - cb * s * 0.025 - sb * s * 0.2]] : [[tip[0], tip[1]], [tip[0] - sb * s * 0.12 - cb * s * 0.04, tip[1] + cb * s * 0.12 - sb * s * 0.04], [tip[0] - sb * s * 0.12 - cb * s * 0.14, tip[1] + cb * s * 0.12 - sb * s * 0.14], [tip[0] - cb * s * 0.1, tip[1] - sb * s * 0.1]];
      inked(g, rng, blade, '#8a8880', o, { sharp: true, band: 0.35, lit: 0.15, ink: 1.2 }); }
    softShadow(g, rail, o, 0.4); inked(g, rng, rail, '#6a4e30', o, { sharp: true, grain: a, lines: 6, hatch: 0.45, ink: 1.6 });
    for (const k of [-1, 1]) { const post = boxAt(c * L * k, sn * L * k, s * 0.08, s * 0.08, a); inked(g, rng, post, '#5a4228', o, { sharp: true, ink: 1.5 }); out.push(post); }
    return out;
  } },
  bedroll: { label: 'Bedrolls', size: 1.3, height: 0.15, paint(g, s, rng, o) {
    // A traveller's bedroll laid out by the fire: a blanket of coarse wool, folded back at the top, a rolled pack for a pillow.
    const a = rng() * 6.28, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.8, W = s * 0.3, col = pick(rng, ['#7a4a34', '#5a6a48', '#6a5a7a', '#8a6a40']);
    const blanket = [at(-L, -W), at(L * 0.7, -W * 1.05), at(L * 0.72, W * 1.05), at(-L, W)]; softShadow(g, blanket, o, 0.4); inked(g, rng, blanket, col, o, { sharp: true, grain: a, lines: 30, hatch: 0.25, cross: true, band: 0.45, ink: 1.4 });
    for (let k = 0; k < 3; k++) line(g, [at(-L * 0.9 + k * L * 0.12, -W), at(-L * 0.9 + k * L * 0.12, W)], 'rgba(230,220,190,0.35)', o.ink * 0.8);
    const fold = [at(L * 0.35, -W * 1.05), at(L * 0.72, -W * 1.05), at(L * 0.74, W * 1.05), at(L * 0.35, W * 1.05)]; inked(g, rng, fold, shade(col, 0.15), o, { sharp: true, band: 0.35, ink: 1.3 });
    const pack = []; for (let k = 0; k < 16; k++) { const q = (k / 16) * 6.283; pack.push(at(L * 0.88 + Math.cos(q) * s * 0.12, Math.sin(q) * W * 0.95)); } inked(g, rng, pack, '#8a7450', o, { grain: a + 1.57, lines: 6, hatch: 0.35, band: 0.45, ink: 1.4 });
    for (const k of [-0.5, 0.5]) line(g, [at(L * 0.8, k * W * 0.9), at(L * 0.96, k * W * 0.9)], '#3a2a14', o.ink * 1.4);
    return [blanket, pack];
  } },
  tent: { label: 'Tents', size: 2.4, height: 1.6, paint(g, s, rng, o) {
    // As the Tiger Lord camp's: a round hide tent of eight panels sewn to a knot at its peak, each panel bellying out between the
    // seams to a scalloped hem, ochre or pale canvas, the side away from the light in shade, pegs at its points.
    const R = s * 0.82, n = 8, turn = rng() * 6.28, col = pick(rng, ['#b8783a', '#c8a870', '#a8986e', '#8a6a44']), pts = [];
    for (let i = 0; i < n * 6; i++) { const t = i / (n * 6), q = turn + t * 6.283, k = (i % 6) / 6, rr = R * (0.88 + 0.12 * Math.cos((k - 0.5) * Math.PI) ** 0.5 * (1 - Math.abs(k - 0.5) * 2) + (k === 0 ? 0.12 : 0)); pts.push([Math.cos(q) * rr, Math.sin(q) * rr]); }
    softShadow(g, pts, o, 0.55);
    for (let i = 0; i < n; i++) { const q0 = turn + (i / n) * 6.283, q1 = turn + ((i + 1) / n) * 6.283, panel = [[0, 0]]; for (let k = 0; k <= 6; k++) { const q = q0 + (q1 - q0) * (k / 6), bulge = Math.sin((k / 6) * Math.PI) * 0.1; panel.push([Math.cos(q) * R * (0.9 + bulge), Math.sin(q) * R * (0.9 + bulge)]); }
      const mid = (q0 + q1) / 2, lit = towardLight(Math.cos(mid), Math.sin(mid), 1); inked(g, rng, panel, shade(col, lit * 0.18 - 0.05), o, { sharp: true, grain: mid, lines: 8, hatch: 0.2, band: 0.3, lit: 0.06, ink: 1.4 }); }
    for (let i = 0; i < n; i++) { const q = turn + (i / n) * 6.283, p = [[0, 0], [Math.cos(q) * R * 0.92, Math.sin(q) * R * 0.92]]; line(g, p, INKD, o.ink * 1.8); line(g, p, shade(col, 0.25), o.ink * 0.6); const peg = [Math.cos(q) * R * 1.08, Math.sin(q) * R * 1.08]; line(g, [[Math.cos(q) * R * 0.92, Math.sin(q) * R * 0.92], peg], 'rgba(40,30,16,0.8)', Math.max(0.7, o.ink * 0.7)); g.beginPath(); g.arc(...peg, Math.max(1.5, s * 0.02), 0, 6.283); g.fillStyle = '#3a2814'; g.fill(); }
    const knot = blob(rng, 0, 0, s * 0.06, s * 0.06, 10, 0.2); inked(g, rng, knot, '#3a2814', o, { ink: 1.4 }); for (let i = 0; i < 8; i++) { const q = rng() * 6.28; line(g, [[0, 0], [Math.cos(q) * s * 0.1, Math.sin(q) * s * 0.1]], INKD, o.ink); }
    if (o.snow > 0) { g.save(); trace(g, pts); g.clip(); snowPatch(g, rng, 0, 0, R * 0.8, R * 0.8, o); g.restore(); }
    return [pts];
  } },
  marketStall: { label: 'Market stalls', size: 2.8, height: 1.4, paint(g, s, rng, o) {
    // As the Pitaxian avenue's stalls: a plank counter of goods under a cream cloth awning stretched on a frame, the cloth creased and
    // sagging between its poles, a fold standing up along its ridge, crates of wares at its side.
    const a = (rng() - 0.5) * 0.5, c = Math.cos(a), sn = Math.sin(a), at = (u, v) => [c * u - sn * v, sn * u + c * v], L = s * 0.7, W = s * 0.48, out = [];
    // Goods crates peeking out at the front, under the awning's edge.
    for (let i = 0; i < 3; i++) { const u = -L * 0.6 + i * L * 0.6, crate = boxAt(...at(u, W * 1.12), s * 0.15, s * 0.12, a + (rng() - 0.5) * 0.2); softShadow(g, crate, o, 0.45); inked(g, rng, crate, '#6a4e30', o, { sharp: true, grain: a, lines: 5, hatch: 0.45, ink: 1.5 }); const cc = centre(crate), col = pick(rng, ['#b8402a', '#c89a3a', '#7a8a3a', '#a07a4a']); g.save(); poly(g, boxAt(...cc, s * 0.12, s * 0.09, a)); g.clip(); for (let k = 0; k < 10; k++) { const p = blob(rng, cc[0] + (rng() - 0.5) * s * 0.22, cc[1] + (rng() - 0.5) * s * 0.16, s * 0.035, s * 0.035, 8, 0.1); inked(g, rng, p, shade(col, (rng() - 0.5) * 0.2), o, { band: 0.4, ink: 0.9 }); } g.restore(); }
    // The awning: a pale cloth over the frame, the far edge drawn tight, the near edge sagging in scallops between the poles.
    const cloth = [at(-L, -W)]; for (let k = 0; k <= 8; k++) cloth.push(at(-L + (k / 8) * L * 2, -W - Math.sin((k / 8) * Math.PI * 2) * s * 0.02)); cloth.push(at(L, W)); for (let k = 8; k >= 0; k--) { const u = -L + (k / 8) * L * 2, sag = Math.sin((k % 4) / 4 * Math.PI) * s * 0.06; cloth.push(at(u, W + sag)); }
    softShadow(g, cloth, o, 0.55); inked(g, rng, cloth, pick(rng, ['#d8ccb0', '#ccc0a2', '#e0d6be']), o, { sharp: true, grain: a + 1.57, lines: 12, hatch: 0.12, band: 0.45, ink: 1.6 });
    for (let k = 0; k < 6; k++) { const u = (rng() - 0.5) * L * 1.8; g.beginPath(); g.moveTo(...at(u, -W)); g.quadraticCurveTo(...at(u + (rng() - 0.5) * L * 0.2, 0), ...at(u + (rng() - 0.5) * L * 0.2, W)); g.strokeStyle = 'rgba(80,66,40,0.35)'; g.lineWidth = Math.max(0.6, o.ink * 0.7); g.stroke(); }
    const fold = [at(-L * 0.95, -W * 0.08), at(L * 0.95, -W * 0.08), at(L * 0.95, W * 0.08), at(-L * 0.95, W * 0.08)]; inked(g, rng, fold, '#efe6d0', o, { sharp: true, band: 0.25, lit: 0.15, ink: 1.1 });
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const pole = blob(rng, ...at(u * L, v * W), s * 0.045, s * 0.045, 8, 0.05); inked(g, rng, pole, '#5a4228', o, { ink: 1.4 }); }
    out.push(cloth); return out;
  } },
};
// Drafts taken in: drawn close enough to the maps' own to offer.
for (const id of ["lampPost","brazier","well","haystack","fence","sacks","cobbles","tombstone","sarcophagus","coffin","rails","pickaxe","treasure","papers","cage","brokenPillar","anvil","urns","timbers","stakeFence","strawBed","boneRubble","produce","tent","washtub","trough","planter","tableStools","marketStall","bench","bedroll"]) { KINDS[id] = DRAFTS[id]; delete DRAFTS[id]; }
/** The draft kinds, for the mock: id → { label, size, height, flat, light }. */
export const DECOR_DRAFTS = Object.freeze(Object.fromEntries(Object.entries(DRAFTS).map(([id, k]) => [id, Object.freeze({ id, label: k.label, size: k.size, height: k.height, flat: !!k.flat, light: k.light ?? null })])));

// Where each kind belongs: above ground, below it, or both (stone, bones, crates and the like). Unlisted: above ground.
const SETS = { rock: 'both', boulder: 'both', pebbles: 'both', mushrooms: 'both', bones: 'both', crate: 'both', barrel: 'both', campfire: 'both', roots: 'both', crystals: 'both', brazier: 'both', sacks: 'both', sarcophagus: 'both', coffin: 'both', rails: 'both', pickaxe: 'both', treasure: 'both', papers: 'both', cage: 'both', brokenPillar: 'both', anvil: 'both', urns: 'both', timbers: 'both', stakeFence: 'both', strawBed: 'both', boneRubble: 'both', produce: 'both', bedroll: 'both' };
const setOf = (id) => KINDS[id].set ?? SETS[id] ?? 'surface';
export const DECOR_KINDS = Object.freeze(Object.fromEntries(Object.entries(KINDS).map(([id, k]) => [id, Object.freeze({ id, label: k.label, size: k.size, height: k.height, flat: !!k.flat, tree: !!k.tree, set: setOf(id), water: k.water ?? null, light: k.light ?? null, glow: k.glow ?? (id === 'crystals' ? { color: '#9ac8f0', radius: 1.2 } : null) })])));
export const DECOR_IDS = Object.freeze(Object.keys(KINDS));


// Paints one decoration into a fresh canvas. px: the drawing's full width in pixels; look.unit: pixels per grid square, so leaves and
// blades keep the map's own scale whatever the object's size. look: { season, snow 0..1, wet 0..1, frozen, night, unit }. Returns
// { canvas, shadow, width, height }: shadow is its silhouette in white on clear (null for a flat kind), both centred on the object.
export function paintDecor(kind, seed, px, look = {}, make = defaultCanvas) {
  const k = KINDS[kind] ?? DRAFTS[kind]; if (!k) return null;
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
export function stampDecor({ x, y, radius, grid, kinds, seed, existing = [], scale = 1, turn = null }) {
  const rng = seeded(seed), list = (kinds ?? []).map((k) => (typeof k === 'string' ? { id: k } : k)).filter((k) => KINDS[k.id] && (k.amount ?? 1) > 0);
  if (!list.length) return null;
  const total = list.reduce((s, k) => s + (k.amount ?? 1), 0); let roll = rng() * total, pickK = list[0];
  for (const k of list) { roll -= k.amount ?? 1; if (roll <= 0) { pickK = k; break; } }
  const k = KINDS[pickK.id], size = k.size * (pickK.size ?? 1) * scale * (0.7 + rng() * 0.6);
  for (let t = 0; t < 6; t++) {
    const a = rng() * 6.28, d = Math.sqrt(rng()) * radius, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    const free = k.flat || existing.every((e) => KINDS[e.kind]?.flat || (e.x - px) ** 2 + (e.y - py) ** 2 > ((e.size + size) * grid * 0.42) ** 2);
    if (free) { const d = { kind: pickK.id, x: Math.round(px), y: Math.round(py), size: +size.toFixed(3), turn: +(rng() * 6.283).toFixed(3), seed: (rng() * 2 ** 31) >>> 0, flip: rng() < 0.5 }; if (Number.isFinite(turn)) { d.turn = +turn.toFixed(3); d.fixed = true; d.flip = false; } return d; }
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
