// The kinds of tree a tree tile can be, and the shade each throws seen from above: a broadleaf's heavy clumps with its
// branches in the gaps, a pine's whorls of needles, a palm's combed fronds, a birch's lace, a bare tree's branches, a
// willow's trailing strands, the sun's round spots coming through the gaps. Each pattern is a picture drawn once (white,
// its alpha the shade), laid over the tree's own picture when the shade is baked (canopy-light.mjs).

// [key, name in Tile configuration]; '' picks by the tile's name.
export const TREE_KINDS = Object.freeze([['', 'Auto (by its name)'], ['broadleaf', 'Broadleaf (oak, maple, elm)'], ['pine', 'Pine or fir'], ['palm', 'Palm'], ['birch', 'Birch, aspen or olive'], ['bare', 'Bare or winter tree'], ['willow', 'Willow']]);
// How dark each one's shade is at its thickest, as the mock had them.
export const TREE_DARK = Object.freeze({ broadleaf: 0.74, pine: 0.8, palm: 0.7, birch: 0.55, bare: 0.6, willow: 0.62 });
const NAMES = [
  ['palm', /(?:^|[^a-z])(palms?|coconut|date_?palm)(?=$|[^a-z])/i],
  ['pine', /(?:^|[^a-z])(pines?|firs?|spruces?|cedars?|conifers?|evergreens?|yews?|larch|hemlock|redwood|sequoia|cypress)(?=$|[^a-z])/i],
  ['willow', /(?:^|[^a-z])(willows?)(?=$|[^a-z])/i],
  ['bare', /(?:^|[^a-z])(dead|bare|leafless|winter|withered|snag|skeleton)(?=$|[^a-z])/i],
  ['birch', /(?:^|[^a-z])(birch(?:es)?|aspens?|olives?|acacias?|jacarandas?|poplars?)(?=$|[^a-z])/i],
];
const nameOf = (src) => decodeURIComponent(String(src ?? '').split(/[?#]/)[0].split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '');
/** A tree tile's kind (pure): its own choice (`own`, flags.animater.sunTree), else by its file name, else a broadleaf. */
/** Whether a tree tile is one tree (pure): about square and no wider than this many squares; else a stand of them, given a repeating pattern. */
export const ONE_TREE_SQUARES = 5;
export const isOneTree = ({ width = 0, height = 0, grid = 100 } = {}) => { const w = Math.abs(width), h = Math.abs(height), aspect = w / Math.max(1, h); return w > 0 && Math.max(w, h) <= ONE_TREE_SQUARES * grid && aspect >= 0.65 && aspect <= 1.5; };
export function treeKindOf({ src, own = '' } = {}) {
  if (Object.hasOwn(TREE_DARK, own)) return own;
  const name = nameOf(src);
  for (const [kind, words] of NAMES) if (words.test(name)) return kind;
  return 'broadleaf';
}

// Value noise and a seeded random, the patterns' own.
const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
const noise = (x, y, s) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbm = (x, y, s, octaves = 4) => { let v = 0, amp = 0.5, f = 1; for (let i = 0; i < octaves; i++) { v += amp * noise(x * f, y * f, s + i * 13); f *= 2; amp *= 0.5; } return v; };
// The same noise wrapping every `p` lattice cells, so a pattern repeats without a seam.
const noiseP = (x, y, s, p) => { const ix = Math.floor(x), iy = Math.floor(y), w = (v) => ((v % p) + p) % p; let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hash(w(ix), w(iy), s), b = hash(w(ix + 1), w(iy), s), c = hash(w(ix), w(iy + 1), s), d = hash(w(ix + 1), w(iy + 1), s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbmP = (x, y, s, p, octaves = 3) => { let v = 0, amp = 0.5, f = 1; for (let i = 0; i < octaves; i++) { v += amp * noiseP(x * f, y * f, s + i * 13, p * f); f *= 2; amp *= 0.5; } return v; };
const rng = (seed) => { let s = Math.max(1, Math.floor(seed) % 2147483646); return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A pattern is SIZE square, the crown filling most of it (R of the half-width), so it lies over the tile's picture.
export const PATTERN_SIZE = 256;
const LOOKS_PER_KIND = 2;
const S = PATTERN_SIZE, C = S / 2, R = S * 0.46;
const edgeOf = (a, s, rag) => R * (1 + rag * (fbm(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, s, 3) - 0.5) * 2);

// A repeating pattern stands for this many squares of ground; the tree's own picture gives its outline.
export const TILE_SQUARES = 2;
/** A kind's shade as a repeating field at (x, y) in a PATTERN_SIZE square, 0–1 (pure), wrapping at its edges; null for the ones drawn as stamps. */
export function treeFieldAt(kind, x, y, seed = 1) {
  if (kind === 'broadleaf') return smooth(0.36, 0.5, fbmP(x / 32, y / 32, seed, 8) * 0.65 + fbmP(x / 8, y / 8, seed + 7, 32) * 0.35);
  if (kind === 'birch') return smooth(0.45, 0.6, fbmP(x / 8, y / 8, seed, 32) * 0.6 + fbmP(x / 16, y / 16, seed + 5, 16) * 0.5);
  if (kind === 'willow') return smooth(0.3, 0.7, (0.5 + 0.5 * Math.sin((y / S) * Math.PI * 2 * 12 + fbmP(x / 32, y / 32, seed, 8) * 5)) * 0.7 + fbmP(x / 16, y / 16, seed + 2, 16) * 0.5 - 0.05);
  if (kind === 'pine') return smooth(0.3, 0.62, fbmP(x / 8, y / 8, seed + 3, 32) * 0.8 + 0.12) * 0.85;
  return null;
}
/** The shade inside one kind's crown at (x, y) from its middle, 0–1 (pure): the field kinds; null for the ones made of lines. */
export function treeShadeAt(kind, x, y, seed = 1) {
  const a = Math.atan2(y, x), r = Math.hypot(x, y);
  if (kind === 'broadleaf') { const e = edgeOf(a, seed, 0.1); return smooth(e + 6, e - 10, r) * smooth(0.36, 0.5, fbm(x / 22 + 3, y / 22, seed) * 0.65 + fbm(x / 8, y / 8, seed + 7) * 0.35); }
  if (kind === 'pine') { const e = edgeOf(a, seed, 0.06); return smooth(e + 4, e - 8, r) * smooth(0.25, 0.55, Math.abs(Math.sin(a * 7 + fbm(r / 26, 1, seed) * 2.4)) * 0.55 + fbm(x / 5, y / 5, seed + 3) * 0.6 - (r / e) * 0.18 + 0.12); }
  if (kind === 'birch') { const e = edgeOf(a, seed, 0.16); return smooth(e + 6, e - 12, r) * smooth(0.45, 0.6, fbm(x / 6, y / 6, seed) * 0.6 + fbm(x / 19, y / 19, seed + 5) * 0.5); }
  if (kind === 'willow') { const e = edgeOf(a, seed, 0.08); return smooth(e + 8, e - 14, r) * smooth(0.3, 0.7, (0.5 + 0.5 * Math.sin(a * 46 + fbm(r / 16, a * 2, seed) * 5)) * 0.7 + fbm(x / 10, y / 10, seed + 2) * 0.5 - 0.05); }
  return null;
}
// A tree's branches seen from above (pure): segments [x1, y1, x2, y2, width] out from the trunk, forking as they go.
export function branchesOf(seed, { arms = 6, length = 30, width = 7, depth = 3 } = {}) {
  const r = rng(seed * 97 + 11), out = [];
  const grow = (x, y, a, len, w, d) => { const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; out.push([x, y, x2, y2, w]); if (d <= 0) return; const n = 2 + (r() < 0.3 ? 1 : 0); for (let i = 0; i < n; i++) grow(x2, y2, a + (r() - 0.5) * 1.3, len * (0.62 + r() * 0.15), w * 0.66, d - 1); };
  for (let i = 0; i < arms; i++) grow(0, 0, (i / arms) * Math.PI * 2 + r() * 0.5, length, width, depth);
  return out;
}
// A palm's fronds (pure): each a midrib with leaflets combed off both sides, as segments.
export function frondsOf(seed, count = 11) {
  const r = rng(seed * 31 + 7), out = [];
  for (let f = 0; f < count; f++) {
    const a0 = (f / count) * Math.PI * 2 + r() * 0.3, bend = (r() - 0.5) * 0.6, len = R * (0.85 + r() * 0.15);
    let px = 0, py = 0;
    for (let t = 1; t <= 24; t++) {
      const a = a0 + (bend * t) / 24, x = (Math.cos(a) * len * t) / 24, y = (Math.sin(a) * len * t) / 24, side = a + Math.PI / 2, leaf = 14 * Math.sin((Math.PI * t) / 24) + 3;
      out.push([px, py, x, y, 3 - t * 0.08]);
      for (const s of [1, -1]) out.push([x, y, x + Math.cos(side) * leaf * s + Math.cos(a) * leaf * 0.5, y + Math.sin(side) * leaf * s + Math.sin(a) * leaf * 0.5, 2]);
      px = x; py = y;
    }
  }
  return out;
}
// How many of the sun's round spots come through each kind's gaps, how big (px in the pattern), and how dark its branches.
const SPOTS = { broadleaf: [70, 6], pine: [22, 4], birch: [120, 5], willow: [50, 4.5], palm: [0, 0], bare: [0, 0] };
const BRANCHES = { broadleaf: { arms: 6, length: 30, width: 7, depth: 3, alpha: 1 }, birch: { arms: 5, length: 26, width: 4, depth: 3, alpha: 0.8 }, bare: { arms: 6, length: 28, width: 8, depth: 5, alpha: 1 } };

/**
 * The pattern's picture, made once a kind, look and layout and kept: `tiled` a repeating field (TILE_SQUARES of ground),
 * else one crown filling the picture. Kept as what to cut away (alpha 1 - shade, white): erasing a tree's picture by it
 * leaves its shade. Null without a document to draw on (tests). `doc` the document.
 */
export function createTreePatterns({ doc = globalThis.document } = {}) {
  const made = new Map();
  const canvas = () => { const c = doc.createElement('canvas'); c.width = c.height = S; return c; };
  const draw = (kind, seed, tiled) => {
    const c = canvas(), g = c.getContext('2d');
    // Drawn where it is wanted, and again across each edge it crosses, so a repeating pattern meets itself.
    const wraps = tiled ? [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S], [S, S], [-S, -S], [S, -S], [-S, S]] : [[0, 0]];
    const field = tiled ? (x, y) => treeFieldAt(kind, x, y, seed) : (x, y) => treeShadeAt(kind, x - C, y - C, seed);
    if (field(1, 1) !== null) {
      const im = g.createImageData(S, S);
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) { const k = (y * S + x) * 4; im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = Math.round(Math.min(1, Math.max(0, field(x, y))) * 255); }
      g.putImageData(im, 0, 0);
    }
    const stroke = (segs, alpha, at = [C, C]) => { g.strokeStyle = `rgba(255,255,255,${alpha})`; g.lineCap = 'round'; for (const [ox, oy] of wraps) for (const [x1, y1, x2, y2, w] of segs) { g.lineWidth = w; g.beginPath(); g.moveTo(at[0] + ox + x1, at[1] + oy + y1); g.lineTo(at[0] + ox + x2, at[1] + oy + y2); g.stroke(); } };
    const r = rng(seed * 7 + 3), small = (segs, k) => segs.map(([a, b, c2, d, w]) => [a * k, b * k, c2 * k, d * k, Math.max(1, w * k)]);
    if (!tiled) {
      if (BRANCHES[kind]) stroke(branchesOf(seed, BRANCHES[kind]), BRANCHES[kind].alpha);
      if (kind === 'palm') { stroke(frondsOf(seed), 1); g.fillStyle = '#fff'; g.beginPath(); g.arc(C, C, 12, 0, Math.PI * 2); g.fill(); }
    } else if (kind === 'palm') for (let i = 0; i < 4; i++) stroke(small(frondsOf(seed + i), 0.42), 1, [r() * S, r() * S]);
    else if (kind === 'bare') for (let i = 0; i < 5; i++) stroke(small(branchesOf(seed + i, BRANCHES.bare), 0.4), 1, [r() * S, r() * S]);
    else if (kind === 'pine') for (let i = 0; i < 6; i++) { const at = [r() * S, r() * S], arms = []; for (let a = 0; a < 7; a++) { const t = (a / 7) * Math.PI * 2 + r() * 0.4; arms.push([0, 0, Math.cos(t) * 34, Math.sin(t) * 34, 4]); } stroke(arms, 0.9, at); }
    // The sun's spots: each a little image of the sun through a gap, cut out of the shade.
    const [count, size] = SPOTS[kind] ?? [0, 0];
    if (count) {
      const sr = rng(seed * 13 + 5); g.globalCompositeOperation = 'destination-out';
      for (let i = 0, n = 0; i < count * 30 && n < count; i++) {
        const x = (sr() - 0.5) * S, y = (sr() - 0.5) * S; if (!tiled && Math.hypot(x, y) > R * 0.92) continue; n++;
        const rad = size * (0.6 + sr() * 0.8);
        for (const [ox, oy] of wraps) { const cx = C + x + ox, cy = C + y + oy, grad = g.createRadialGradient(cx, cy, 0, cx, cy, rad); grad.addColorStop(0, 'rgba(0,0,0,0.95)'); grad.addColorStop(0.7, 'rgba(0,0,0,0.8)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = grad; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.fill(); }
      }
    }
    // Turned into what to cut away: white where there is no shade.
    const cut = canvas(), k = cut.getContext('2d');
    k.fillStyle = '#fff'; k.fillRect(0, 0, S, S); k.globalCompositeOperation = 'destination-out'; k.drawImage(c, 0, 0);
    return cut;
  };
  return {
    // Two looks a kind (by the tile's own seed), so a wood of the same trees is not one stamp. (Each is drawn pixel by
    // pixel once, about ten milliseconds: two keep a map with every kind under a tenth of a second the first time.)
    get(kind, seed = 1, tiled = false) {
      if (!doc?.createElement || !Object.hasOwn(TREE_DARK, kind)) return null;
      const variant = Math.abs(Math.floor(seed)) % LOOKS_PER_KIND, key = `${kind}:${variant}:${tiled ? 'tiled' : 'one'}`;
      if (!made.has(key)) { try { made.set(key, draw(kind, 1 + variant * 17 + kind.length, tiled)); } catch { made.set(key, null); } }
      return made.get(key);
    },
    get size() { return made.size; },
  };
}
