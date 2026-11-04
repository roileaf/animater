// What a step kicks up, and what comes down in a cave-in: small pictures painted once and shared (every bit a sprite of one
// of them, so hundreds batch into a single draw), lit from the top left. Stone with faces, rounded pebbles, splinters with
// grain, curved blades of grass, soft clouds with an uneven edge, clods of wet mud, glints.

const TAU = Math.PI * 2;
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rngOf = (seed) => { let a = hash(seed); return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
const paint = (n, fn) => { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'); g.translate(n / 2, n / 2); fn(g, n / 2); return c; };
const poly = (g, pts) => { g.beginPath(); for (let i = 0; i < pts.length; i += 2) g[i ? 'lineTo' : 'moveTo'](pts[i], pts[i + 1]); g.closePath(); };
const blobPath = (g, r, n, rough, rnd, sx = 1, sy = 1) => { g.beginPath(); for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, d = r * (1 - rough + rough * 2 * rnd()), x = Math.cos(a) * d * sx, y = Math.sin(a) * d * sy; g[i ? 'lineTo' : 'moveTo'](x, y); } g.closePath(); };

// A broken bit of stone or ice: an angular shard with a lit face and a shaded one.
const shard = (light, mid, dark, seed, alpha = 1) => paint(48, (g, r) => { const rnd = rngOf(seed), n = 5 + Math.floor(rnd() * 3), pts = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * TAU + rnd() * 0.5, d = r * (0.55 + rnd() * 0.4); pts.push(Math.cos(a) * d, Math.sin(a) * d); }
  g.globalAlpha = alpha; poly(g, pts); g.fillStyle = hex(mid); g.fill(); g.save(); poly(g, pts); g.clip();
  g.fillStyle = hex(light); g.beginPath(); g.moveTo(-r, -r); g.lineTo(r * 0.5, -r); g.lineTo(-r * 0.05, r * 0.05); g.lineTo(-r, r * 0.45); g.closePath(); g.fill();
  g.fillStyle = hex(dark); g.beginPath(); g.moveTo(r, r); g.lineTo(-r * 0.3, r); g.lineTo(r * 0.1, r * 0.1); g.lineTo(r, -r * 0.2); g.closePath(); g.fill(); g.restore(); });
// A rounded pebble: lit on top, dark beneath.
const pebble = (light, mid, dark, seed) => paint(48, (g, r) => { const rnd = rngOf(seed), sy = 0.68 + rnd() * 0.28; blobPath(g, r * 0.92, 14, 0.07, rnd, 1, sy);
  const gr = g.createRadialGradient(-r * 0.32, -r * 0.34 * sy, r * 0.05, 0, 0, r); gr.addColorStop(0, hex(light)); gr.addColorStop(0.55, hex(mid)); gr.addColorStop(1, hex(dark)); g.fillStyle = gr; g.fill(); });
// A splinter of wood: long, tapered, grain along it.
const splinter = (light, dark, seed) => paint(64, (g, r) => { const rnd = rngOf(seed), w = r * (0.12 + rnd() * 0.1), j = (rnd() - 0.5) * w;
  poly(g, [-r * 0.95, j, -r * 0.2, -w, r * 0.45, -w * 0.7, r * 0.95, j * 0.5, r * 0.35, w * 0.8, -r * 0.4, w]);
  const gr = g.createLinearGradient(0, -w, 0, w); gr.addColorStop(0, hex(light)); gr.addColorStop(1, hex(dark)); g.fillStyle = gr; g.fill();
  g.strokeStyle = hex(dark); g.globalAlpha = 0.6; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-r * 0.6, w * 0.2); g.lineTo(r * 0.5, -w * 0.1); g.stroke(); });
// A blade of grass: curved, deep at its root and bright at its tip.
const blade = (root, tip, seed) => paint(64, (g, r) => { const rnd = rngOf(seed), bend = (rnd() - 0.5) * r * 1.1, w = r * (0.09 + rnd() * 0.06);
  g.beginPath(); g.moveTo(-r * 0.92, -w); g.quadraticCurveTo(0, bend - w, r * 0.92, bend * 0.25); g.quadraticCurveTo(0, bend + w, -r * 0.92, w); g.closePath();
  const gr = g.createLinearGradient(-r, 0, r, 0); gr.addColorStop(0, hex(root)); gr.addColorStop(1, hex(tip)); g.fillStyle = gr; g.fill(); g.strokeStyle = 'rgba(20,40,10,0.55)'; g.lineWidth = 1; g.stroke(); });
// A soft cloud with an uneven edge: never the visible rings of stacked circles.
const cloud = (color, seed) => paint(96, (g, r) => { const rnd = rngOf(seed), c = hex(color), withAlpha = (a) => c + Math.round(a * 255).toString(16).padStart(2, '0');
  for (let i = 0; i < 22; i++) { const a = rnd() * TAU, d = r * 0.48 * Math.sqrt(rnd()), x = Math.cos(a) * d, y = Math.sin(a) * d, s = r * (0.2 + rnd() * 0.3), gr = g.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, withAlpha(0.2)); gr.addColorStop(1, withAlpha(0)); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); } });
// A wet clod of mud: lumpy, a wet highlight.
const splat = (light, mid, dark, seed) => paint(48, (g, r) => { const rnd = rngOf(seed); blobPath(g, r * 0.72, 16, 0.2, rnd);
  const gr = g.createRadialGradient(-r * 0.2, -r * 0.25, r * 0.05, 0, 0, r * 0.9); gr.addColorStop(0, hex(light)); gr.addColorStop(0.5, hex(mid)); gr.addColorStop(1, hex(dark)); g.fillStyle = gr; g.fill();
  g.fillStyle = 'rgba(255,240,215,0.5)'; g.beginPath(); g.ellipse(-r * 0.24, -r * 0.3, r * 0.14, r * 0.08, -0.5, 0, TAU); g.fill(); });
// A glint: a soft glow and thin arms.
const glint = (color) => paint(64, (g, r) => { const c = hex(color), gr = g.createRadialGradient(0, 0, 0, 0, 0, r * 0.55); gr.addColorStop(0, `${c}cc`); gr.addColorStop(1, `${c}00`); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
  g.fillStyle = '#fff'; const k = r * 0.05; poly(g, [0, -r, k, -k, r, 0, k, k, 0, r, -k, k, -r, 0, -k, -k]); g.fill(); });
const PEBBLE_TONES = [[0xb4aca0, 0x7f776c, 0x45403a], [0x9c8f7c, 0x6e6252, 0x3b342b], [0xa8a8a4, 0x72726e, 0x3f3f3c]];

// Each family: how many of it there are, and how to paint the nth.
const FAMILIES = {
  stone: [6, (i) => shard(0xa8a59f, 0x77756f, 0x45443f, `s${i}`)], stoneDust: [3, (i) => cloud(0xb2afa8, `sd${i}`)],
  pebble: [6, (i) => pebble(...PEBBLE_TONES[i % 3], `p${i}`)],
  splinter: [5, (i) => splinter(0xe0c292, 0x8a6638, `w${i}`)], sawdust: [4, (i) => pebble(0xe8d0a4, 0xc6a673, 0x8f7144, `wd${i}`)],
  dirtDust: [3, (i) => cloud(0x9a7f5c, `dd${i}`)], clod: [5, (i) => shard(0x7c6245, 0x584431, 0x33271b, `c${i}`)],
  blade: [6, (i) => blade(0x3f6a22, i % 2 ? 0xc5e370 : 0xa4d052, `g${i}`)], seed: [2, (i) => pebble(0xd6d28a, 0xa7a35c, 0x6c6a38, `se${i}`)],
  sandDust: [3, (i) => cloud(0xe6d3a4, `sn${i}`)], grain: [3, (i) => pebble(0xf2e2b8, 0xcfb988, 0x96825a, `gr${i}`)],
  snowDust: [3, (i) => cloud(0xffffff, `sw${i}`)], snowClod: [4, (i) => pebble(0xffffff, 0xeaf0f6, 0xb5c4d6, `sc${i}`)],
  ice: [5, (i) => shard(0xffffff, 0xcbe6f4, 0x86b6d0, `ib${i}`, 0.9)], glint: [1, () => glint(0xdff3ff)],
  mud: [4, (i) => splat(0x7a5c3a, 0x4d3822, 0x271b10, `m${i}`)],
  smear: [2, (i) => cloud(0xdcecf5, `gl${i}`)], metal: [4, (i) => shard(0x9ea3a9, 0x63676d, 0x303337, `mt${i}`)], metalSpark: [1, () => glint(0xffd9a0)],
};
export const KICK_ART = Object.freeze(Object.keys(FAMILIES));
// The nth picture of a family (any n: it wraps), painted the first time it is asked for; null for no such family.
const painted = new Map();
export function kickArt(family, n = 0) {
  const entry = FAMILIES[family]; if (!entry) return null;
  const i = Math.abs(Math.trunc(Number(n) || 0)) % entry[0], key = `${family}:${i}`;
  if (!painted.has(key)) painted.set(key, entry[1](i));
  return painted.get(key);
}

// A boulder with faces: a flat top catching the light, sides shaded by which way they face, speckled, a crack.
export const boulderArt = (seed, n = 96) => paint(n, (g, r) => { const rnd = rngOf(`b${seed}`), nv = 7 + Math.floor(rnd() * 3), tone = 0.8 + rnd() * 0.35, warm = rnd() * 12, sy = 0.72 + rnd() * 0.22, outer = [], top = [];
  const dx = -r * (0.1 + rnd() * 0.08), dy = -r * (0.12 + rnd() * 0.08);
  for (let i = 0; i < nv; i++) { const a = (i / nv) * TAU + (rnd() - 0.5) * 0.45, d = r * (0.72 + rnd() * 0.24), x = Math.cos(a) * d, y = Math.sin(a) * d * sy, k = 0.48 + rnd() * 0.16; outer.push([x, y]); top.push([x * k + dx, y * k + dy]); }
  const shadeOf = (l) => `rgb(${Math.round(l * 150 * tone + warm)},${Math.round(l * 136 * tone + warm * 0.6)},${Math.round(l * 118 * tone)})`;
  for (let i = 0; i < nv; i++) { const j = (i + 1) % nv, [ax, ay] = outer[i], [bx, by] = outer[j], mx = (ax + bx) / 2, my = (ay + by) / 2, facing = (-mx - my) / (Math.hypot(mx, my) * Math.SQRT2 || 1);
    poly(g, [ax, ay, bx, by, top[j][0], top[j][1], top[i][0], top[i][1]]); g.fillStyle = shadeOf(0.5 + 0.42 * facing + (rnd() - 0.5) * 0.08); g.fill(); g.strokeStyle = g.fillStyle; g.lineWidth = 0.6; g.stroke(); }
  poly(g, top.flat()); const tg = g.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.3, r * 0.3); tg.addColorStop(0, shadeOf(1.18)); tg.addColorStop(1, shadeOf(0.86)); g.fillStyle = tg; g.fill();
  g.save(); poly(g, outer.flat()); g.clip();
  for (let i = 0; i < 60; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(230,220,200,0.16)' : 'rgba(15,12,9,0.2)'; const s = 0.5 + rnd() * 1.6; g.fillRect((rnd() - 0.5) * r * 1.9, (rnd() - 0.5) * r * 1.9, s, s); }
  g.strokeStyle = 'rgba(15,11,8,0.6)'; g.lineWidth = 1.3; g.beginPath(); let x = top[0][0] * 0.7, y = top[0][1] * 0.7; g.moveTo(x, y); for (let i = 0; i < 4; i++) { x += (rnd() - 0.3) * r * 0.34; y += (rnd() - 0.2) * r * 0.26; g.lineTo(x, y); } g.stroke(); g.restore();
  poly(g, outer.flat()); g.strokeStyle = 'rgba(18,14,10,0.7)'; g.lineWidth = 1; g.stroke(); });
// A soft round shadow, dense at its heart.
export const shadowArt = () => paint(64, (g, r) => { const gr = g.createRadialGradient(0, 0, r * 0.25, 0, 0, r); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2); });
// The floor stained and cracked where a cave-in hit it.
export const scarArt = (seed, n = 320) => paint(n, (g, r) => { const rnd = rngOf(`scar${seed}`), radius = r / 1.4, gr = g.createRadialGradient(0, 0, radius * 0.2, 0, 0, r); gr.addColorStop(0, 'rgba(18,14,12,0.6)'); gr.addColorStop(0.55, 'rgba(30,25,22,0.32)'); gr.addColorStop(1, 'rgba(90,80,70,0)'); g.fillStyle = gr; g.fillRect(-r, -r, r * 2, r * 2);
  g.strokeStyle = 'rgba(14,10,8,0.65)'; for (let i = 0; i < 9; i++) { let a = rnd() * TAU, d = radius * 0.5; g.lineWidth = 1 + rnd(); g.beginPath(); g.moveTo(Math.cos(a) * d, Math.sin(a) * d); for (let k = 0; k < 5; k++) { a += (rnd() - 0.5) * 0.5; d += radius * 0.16; g.lineTo(Math.cos(a) * d, Math.sin(a) * d); } g.stroke(); } });
// A spider seen from above in one of three poses: jointed tapered legs, a shaded body with a pale mark and a rim of light,
// so it reads on a dark floor.
export const spiderArt = (pose) => paint(128, (g, r) => { const u = r / 16, pale = 'rgba(214,190,160,0.75)';
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) { const spread = (-1.05 + i * 0.68) + Math.sin(pose * 2.1 + i * 1.7 + side) * 0.07, kx = side * (5 + Math.cos(spread) * 3.5) * u, ky = (Math.sin(spread) * 6.5 - 2.5) * u, fx = side * (9.2 + Math.cos(spread) * 4.5) * u, fy = (Math.sin(spread) * 11 + 1.5 + i * 0.5) * u, bx = side * 1.6 * u, by = (-2.6 + i * 0.85) * u;
    g.lineCap = 'round'; for (const [c, w] of [['#0d0806', 1.25], ['#4a3225', 0.65]]) { g.strokeStyle = c; g.lineWidth = w * u; g.beginPath(); g.moveTo(bx, by); g.lineTo(kx, ky); g.stroke(); g.lineWidth = w * u * 0.7; g.beginPath(); g.moveTo(kx, ky); g.lineTo(fx, fy); g.stroke(); } }
  const ag = g.createRadialGradient(-1.2 * u, 2 * u, 0.3 * u, 0, 3.6 * u, 5.4 * u); ag.addColorStop(0, '#7a4f35'); ag.addColorStop(0.55, '#3c2317'); ag.addColorStop(1, '#120a07'); g.fillStyle = ag; g.beginPath(); g.ellipse(0, 3.6 * u, 3.9 * u, 5.1 * u, 0, 0, TAU); g.fill();
  g.strokeStyle = pale; g.lineWidth = 0.55 * u; g.lineCap = 'round'; for (const [yy, w] of [[1.7, 1.5], [3.4, 1.9], [5.2, 1.4]]) { g.beginPath(); g.moveTo(-w * u, yy * u); g.lineTo(0, (yy + 0.9) * u); g.lineTo(w * u, yy * u); g.stroke(); }
  g.strokeStyle = 'rgba(232,214,190,0.55)'; g.lineWidth = 0.4 * u; g.beginPath(); g.ellipse(0, 3.6 * u, 3.9 * u, 5.1 * u, 0, Math.PI * 0.95, Math.PI * 1.6); g.stroke();
  const cg = g.createRadialGradient(-0.7 * u, -2.8 * u, 0.2 * u, 0, -2 * u, 2.9 * u); cg.addColorStop(0, '#8a6146'); cg.addColorStop(1, '#23140d'); g.fillStyle = cg; g.beginPath(); g.ellipse(0, -2 * u, 2.5 * u, 2.9 * u, 0, 0, TAU); g.fill();
  g.fillStyle = '#e7d9c0'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 0.8 * u, -4.2 * u, 0.28 * u, 0, TAU); g.fill(); } });
