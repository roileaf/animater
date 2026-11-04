// Blood on the floor, painted once per colour and shared: dark and matte, soaked into the floor with torn edges and a darker
// dried rim, never bright or glossy. Stains are worked out pixel by pixel at a small size (quick enough to paint on first
// use), the fine spray over them drawn at full size.

const TAU = Math.PI * 2;
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = (seed) => { let a = hash(seed); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbm = (x, y, o = 3) => { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * noise(x, y); x = x * 2.03 + 17; y = y * 2.03 + 9; a *= 0.5; } return s; };
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// A creature's blood colour (0xrrggbb) as what it looks like on a floor (pure): its body, darker where thick, darkest at the
// dried rim.
export function bloodTones(color = 0x7a0d0d) {
  const base = [(color >> 16) & 255, (color >> 8) & 255, color & 255], scaled = (k) => base.map((v) => Math.round(v * k));
  return { wet: scaled(0.72), deep: scaled(0.46), rim: scaled(0.26) };
}

// A stain soaked into the floor: `shape(u, v)` says how far inside a point is (above 0; u, v run -1..1); the edge torn by
// noise, a thin darker rim where it dried first, its body uneven.
const stain = (b, n, seed, shape, opacity = 0.9) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), im = g.createImageData(n, n), off = hash(seed) % 977;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const u = (x / n) * 2 - 1, v = (y / n) * 2 - 1, inner = shape(u, v) + (fbm(x / (n / 7) + off, y / (n / 7)) - 0.5) * 0.55 + (noise(x / (n / 26) + off, y / (n / 26)) - 0.5) * 0.1, k = (y * n + x) * 4; if (inner <= 0) continue;
    const edge = smooth(0, 0.035, inner), rim = 1 - smooth(0.03, 0.14, inner), body = noise(x / (n / 8) + off * 2, y / (n / 8));
    for (let i = 0; i < 3; i++) { const v2 = b.deep[i] + (b.wet[i] - b.deep[i]) * smooth(0.3, 0.7, body); im.data[k + i] = v2 + (b.rim[i] - v2) * rim * 0.75; }
    im.data[k + 3] = 255 * edge * opacity * (0.78 + 0.22 * body); }
  g.putImageData(im, 0, 0); return c; };
// A stain worked out small, on a bigger canvas ready for the fine spray.
const stainOn = (b, n, small, seed, shape, opacity) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(stain(b, small, seed, shape, opacity), 0, 0, n, n); return { c, g }; };
// A mist of droplets: mostly tiny, a few bigger; thick near the wound, thinning out; stretched along the way they flew.
const mist = (g, b, r, rnd, { count, fan, from = 0.1, far = 1 }) => { for (let i = 0; i < count; i++) { const a = (rnd() - 0.5) * 2 * fan * (rnd() < 0.8 ? 0.75 : 1), d = r * (from + (far - from) * Math.pow(rnd(), 1.7)), big = Math.pow(rnd(), 5), s = r * (0.0035 + big * 0.015), stretch = 1 + (d / r) * 1.1 * rnd(); g.fillStyle = rgb(rnd() < 0.5 ? b.deep : b.rim, 0.55 + rnd() * 0.4); g.beginPath(); g.ellipse(Math.cos(a) * d, Math.sin(a) * d, s * stretch, s, a, 0, TAU); g.fill(); } };
// A wound's spray along +x: a stain at its root, broken runs of fine drops, then the mist.
const spray = (b, seed, { count = 420, fan = 0.8, at = -0.42, size = 0.3, far = 1 } = {}) => { const n = 256, r = n / 2, rnd = rngOf(seed), { c, g } = stainOn(b, n, 96, seed, (u, v) => size - Math.hypot((u - at) * 0.8, v * 1.1)); g.translate(r, r); g.translate(at * r * 0.9, 0);
  for (let k = 0; k < 7; k++) { const a = (rnd() - 0.5) * 2 * fan * 0.8, reach = r * (0.5 + rnd() * 0.75); for (let i = 0; i < 22; i++) { const t = Math.pow(i / 22, 0.8), d = r * size * 0.8 + reach * t, side = (rnd() - 0.5) * r * 0.03 * (1 + t * 2), s = r * (0.006 * (1 - t) + 0.002) * (0.6 + rnd()); if (rnd() < 0.35) continue; g.fillStyle = rgb(b.deep, 0.5 + rnd() * 0.45); g.beginPath(); g.ellipse(Math.cos(a) * d - Math.sin(a) * side, Math.sin(a) * d + Math.cos(a) * side, s * (1.2 + t * 1.1), s, a, 0, TAU); g.fill(); } }
  mist(g, b, r, rnd, { count, fan, from: size * 0.7, far: far * 1.25 }); return c; };
// A drop that landed flying toward +x: dark, uneven, a fine tail.
const drop = (b, seed) => stain(b, 40, seed, (u, v) => Math.max(0.42 - Math.hypot((u + 0.3) * 1.05, v * 1.75), 0.1 - Math.hypot((u - 0.42) * 0.42, v * 3.6)), 0.92);
// A round drip: soaked in, its edge scalloped by where it hit, specks round it.
const drip = (b, seed) => { const n = 96, { c, g } = stainOn(b, n, 56, seed, (u, v) => 0.4 - Math.hypot(u, v)), rnd = rngOf(seed); g.translate(n / 2, n / 2); mist(g, b, n / 2, rnd, { count: 34, fan: Math.PI, from: 0.45, far: 1 }); return c; };
// What a creature dragging itself leaves, along +x: heavy at the front where it was pressed, narrowing and breaking up
// behind it, ragged edges, a few fine drag lines.
const patch = (b, seed) => { const n = 160, r = n / 2, rnd = rngOf(seed), { c, g } = stainOn(b, n, 80, seed, (u, v) => 0.46 * smooth(-0.95, 0.35, u) * (1 - smooth(0.55, 0.9, u)) - Math.abs(v) - 0.015, 0.88); g.translate(r, r);
  for (let i = 0; i < 12; i++) { const y = (rnd() - 0.5) * r * 0.42, x1 = -r * (0.25 + rnd() * 0.7), x2 = x1 + r * (0.2 + rnd() * 0.5); g.strokeStyle = rgb(b.deep, 0.25 + rnd() * 0.35); g.lineWidth = 0.5 + rnd() * 1.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y); g.lineTo(x2, y + (rnd() - 0.5) * 3); g.stroke(); }
  mist(g, b, r, rnd, { count: 24, fan: Math.PI, from: 0.4, far: 0.95 }); return c; };
const pool = (b, seed) => stainOn(b, 192, 96, seed, (u, v) => 0.74 - Math.hypot(u, v * 1.14) + Math.sin(Math.atan2(v, u) * 3 + 2) * 0.05, 0.95).c;

const FAMILIES = {
  slash: [3, (b, s) => spray(b, s, { count: 520, fan: 0.72 })], pierce: [2, (b, s) => spray(b, s, { count: 300, fan: 0.2, size: 0.2 })], blunt: [2, (b, s) => spray(b, s, { count: 460, fan: Math.PI, at: 0, size: 0.34, far: 0.72 })],
  drop: [4, drop], drip: [3, drip], patch: [4, patch], pool: [2, pool],
};
export const BLOOD_ART = Object.freeze(Object.keys(FAMILIES));
export const artCount = (family) => FAMILIES[family]?.[0] ?? 0;
// The nth picture of a family (any n: it wraps) in a colour, painted the first time it is asked for; null for no such family.
const painted = new Map();
export function bloodArt(family, n = 0, color = 0x7a0d0d) {
  const entry = FAMILIES[family]; if (!entry) return null;
  const i = Math.abs(Math.trunc(Number(n) || 0)) % entry[0], key = `${family}:${i}:${color}`;
  if (!painted.has(key)) painted.set(key, entry[1](bloodTones(color), `${family}${i}`));
  return painted.get(key);
}
