// Life and wear underground, small things drawn on the CPU (a few dozen sprites at most, only near the view): eyes that
// glint back from the dark and slip away from the light; moths looping round the fires, their shadows flicking over the
// floor; beetles and a centipede running along the foot of the walls; pebbles a step kicks skittering across the floor;
// soot blackening the wall over a torch that has burned there for years; water seeping at the foot of wet walls,
// glistening; steam breathing from vents in the floor; and rubble brought down from the ceiling, with its dust.

const TAU = Math.PI * 2;
const rng = (seed) => { let h = 2166136261; for (const c of String(seed)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 100000) / 100000; }; };
const hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
const noise = (x, y) => { const ix = Math.floor(x), iy = Math.floor(y); let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; };
const fbm = (x, y, o = 4) => { let s = 0, a = 0.5; for (let i = 0; i < o; i++) { s += a * noise(x, y); x = x * 2.03 + 17; y = y * 2.03 + 9; a *= 0.5; } return s; };
const inside = ({ x, y }, p) => { let hit = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit; return hit; };
const boxOf = (p) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (let i = 0; i < p.length; i += 2) { x0 = Math.min(x0, p[i]); x1 = Math.max(x1, p[i]); y0 = Math.min(y0, p[i + 1]); y1 = Math.max(y1, p[i + 1]); } return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };

// ---- Layout (pure) --------------------------------------------------------------------------------------------------

// Where soot has gathered (pure): each fire light (`lights` [{ x, y, key }]) within reach of a wall that stops light
// (`walls` [{ c, light }]) has burned against it: the point on the wall nearest it, the wall's way along (angle) and the
// side the fire is on (unit normal toward it). [{ key, x, y, angle, nx, ny }].
export function sootSpots(lights = [], walls = [], { grid = 100 } = {}) {
  const out = [];
  for (const l of lights) {
    let best = null;
    for (const w of walls) {
      if (!(Number(w.light ?? w.move ?? 0) > 0)) continue;
      const [x1, y1, x2, y2] = w.c, dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy; if (L2 < 1) continue;
      const u = Math.max(0, Math.min(1, ((l.x - x1) * dx + (l.y - y1) * dy) / L2)), px = x1 + dx * u, py = y1 + dy * u, d = Math.hypot(l.x - px, l.y - py);
      if (d < grid * 0.75 && (!best || d < best.d)) best = { d, px, py, angle: Math.atan2(dy, dx), nx: (l.x - px) / (d || 1), ny: (l.y - py) / (d || 1) };
    }
    if (best) out.push({ key: l.key, x: best.px, y: best.py, angle: best.angle, nx: best.nx, ny: best.ny });
  }
  return out;
}

// Where the steam comes up in some areas (pure): about one vent every six squares, at least one an area, inside it. The
// same areas always give the same vents.
export function ventsIn(areas = [], { grid = 100, seed = 'steam' } = {}) {
  const r = rng(seed), out = [];
  for (const p of areas) {
    const b = boxOf(p), want = Math.max(1, Math.round((b.w * b.h) / (grid * grid) / 6));
    for (let n = 0, tries = 0; n < want && tries < want * 40; tries++) { const at = { x: b.x + r() * b.w, y: b.y + r() * b.h }; if (inside(at, p)) { out.push({ ...at, every: 5 + r() * 6, wait: r() * 6 }); n++; } }
  }
  return out;
}

// The wet foot of the walls in some areas (pure): each wall that stops movement running through an area, cut into
// pieces a square long; for each, its two ends and the side it is wet on (toward the floor: `floor({ x, y })`).
export function wetRuns(areas = [], walls = [], { grid = 100, floor = () => true } = {}) {
  const out = [];
  for (const w of walls) {
    if (!(Number(w.move) > 0) || Number(w.door) > 0) continue;
    const [x1, y1, x2, y2] = w.c, len = Math.hypot(x2 - x1, y2 - y1); if (len < grid * 0.3) continue;
    const nx = -(y2 - y1) / len, ny = (x2 - x1) / len, n = Math.max(1, Math.round(len / grid));
    for (let i = 0; i < n; i++) {
      const a = { x: x1 + ((x2 - x1) * i) / n, y: y1 + ((y2 - y1) * i) / n }, b = { x: x1 + ((x2 - x1) * (i + 1)) / n, y: y1 + ((y2 - y1) * (i + 1)) / n }, mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      for (const s of [1, -1]) { const probe = { x: mid.x + nx * s * grid * 0.3, y: mid.y + ny * s * grid * 0.3 }; if (areas.some((p) => inside(probe, p)) && floor(probe)) out.push({ a, b, nx: nx * s, ny: ny * s }); }
    }
  }
  return out;
}

// Where moths loop round a light (pure): its middle shifted out into the open (a torch on a wall: the room side), from
// the light's lit area `shape` (flat x, y pairs; walls cut it), sampled a square out all round; and the shape itself, so
// each moth is kept inside it. { x, y, shape }.
export function mothHome(light, { grid = 100 } = {}) {
  const shape = Array.isArray(light?.shape) && light.shape.length >= 6 ? light.shape : null;
  if (!shape) return { x: light.x, y: light.y, shape: null };
  let sx = 0, sy = 0, n = 0;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; for (const r of [0.45, 0.9]) { const p = { x: light.x + Math.cos(a) * grid * r, y: light.y + Math.sin(a) * grid * r }; if (inside(p, shape)) { sx += p.x - light.x; sy += p.y - light.y; n++; } } }
  const k = n ? 0.6 : 0;
  return { x: light.x + (n ? (sx / n) * k : 0), y: light.y + (n ? (sy / n) * k : 0), shape };
}
// A point pulled back toward `home` until it is inside `shape` (or at home).
export function keepInside(p, home, shape) {
  if (!shape || inside(p, shape)) return p;
  let lo = 0, hi = 1;
  for (let i = 0; i < 6; i++) { const m = (lo + hi) / 2, q = { x: home.x + (p.x - home.x) * m, y: home.y + (p.y - home.y) * m }; if (inside(q, shape)) lo = m; else hi = m; }
  return { x: home.x + (p.x - home.x) * lo * 0.95, y: home.y + (p.y - home.y) * lo * 0.95 };
}

// ---- Pictures ------------------------------------------------------------------------------------------------------

const canvasOf = (w, h, paint) => { const c = document.createElement('canvas'); c.width = w; c.height = h; paint(c.getContext('2d'), w, h); return c; };
// A torn, soft cloud (steam, dust), white.
const cloudCanvas = (seed = 0) => canvasOf(64, 64, (g, n) => { const im = g.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const dx = (x - n / 2) / (n / 2), dy = (y - n / 2) / (n / 2), r = Math.hypot(dx, dy), tear = fbm(x / 10 + seed * 7, y / 10 + seed * 3, 4), edge = 1 - Math.min(1, Math.max(0, (r - 0.15 - tear * 0.45) / 0.4)), k = (y * n + x) * 4;
    im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = Math.min(1, Math.max(0, edge * (0.3 + Math.max(0, tear * 2.2 - 0.45)))) * 255; }
  g.putImageData(im, 0, 0); });
// A stone (rubble, a pebble): rough, earthy, lit from the upper left, speckled, a facet edge and maybe a crack; the
// light's way drawn into it, so it keeps its light whichever way it lies (it never turns once it has settled).
const stoneCanvas = (seed, size = 48) => canvasOf(size, size, (g, n) => {
  const r = rng(`stone:${seed}`), nv = 9 + Math.floor(r() * 4), s = n * 0.4, tone = 0.75 + r() * 0.35, hue = r() * 14, c = (k, o = 0) => Math.round(k * tone + o);
  const pts = Array.from({ length: nv }, (_, j) => { const a = (j / nv) * TAU + (r() - 0.5) * 0.4, rr = 0.6 + r() * 0.45; return [n / 2 + Math.cos(a) * rr * s * (1.1 + r() * 0.2), n / 2 + Math.sin(a) * rr * s * 0.85]; });
  const path = new Path2D(); pts.forEach(([x, y], j) => (j ? path.lineTo(x, y) : path.moveTo(x, y))); path.closePath();
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.save(); g.translate(n * 0.05, n * 0.07); g.fill(path); g.restore();
  const grad = g.createLinearGradient(n * 0.2, n * 0.15, n * 0.8, n * 0.85);
  grad.addColorStop(0, `rgb(${c(146, hue)},${c(132, hue * 0.6)},${c(112)})`); grad.addColorStop(0.5, `rgb(${c(104, hue)},${c(92, hue * 0.5)},${c(78)})`); grad.addColorStop(1, `rgb(${c(50)},${c(44)},${c(38)})`);
  g.fillStyle = grad; g.fill(path);
  g.save(); g.clip(path);
  for (let i = 0; i < 8; i++) { g.fillStyle = r() < 0.5 ? 'rgba(200,190,170,0.35)' : 'rgba(20,16,12,0.4)'; g.fillRect(n * (0.2 + r() * 0.6), n * (0.2 + r() * 0.6), Math.max(1, n * 0.03), Math.max(1, n * 0.03)); }
  g.strokeStyle = 'rgba(210,200,180,0.25)'; g.lineWidth = Math.max(0.6, n * 0.03); g.beginPath(); g.moveTo(n * 0.25, n * 0.45); g.lineTo(n * 0.42, n * 0.32); g.lineTo(n * 0.6, n * 0.24); g.stroke();
  if (r() < 0.5) { g.strokeStyle = 'rgba(15,12,10,0.55)'; g.lineWidth = Math.max(0.6, n * 0.025); g.beginPath(); g.moveTo(n * 0.3, n * 0.55); g.lineTo(n * 0.48, n * 0.62); g.lineTo(n * 0.66, n * 0.5); g.stroke(); }
  g.restore(); g.strokeStyle = 'rgba(25,20,16,0.55)'; g.lineWidth = 0.7; g.stroke(path);
});
// A moth seen from above, its wings at `open` (0 closed – 1 spread), facing up.
const mothCanvas = (open) => canvasOf(32, 32, (g, n) => { g.translate(n / 2, n / 2);
  // Dull, dusty grey-brown wings (a fore and a hind wing each side), a darker band across them, a furry body.
  for (const s of [-1, 1]) { const gr = g.createLinearGradient(0, 0, s * 12 * open, 0); gr.addColorStop(0, 'rgba(84,72,58,0.95)'); gr.addColorStop(0.6, 'rgba(120,106,88,0.92)'); gr.addColorStop(1, 'rgba(98,86,70,0.85)');
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(s * 9 * open, -9, s * 13 * open, -3); g.quadraticCurveTo(s * 9 * open, 1, 0, 1); g.closePath(); g.fill();
    g.fillStyle = 'rgba(92,80,66,0.9)'; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(s * 8 * open, 0, s * 8 * open, 4); g.quadraticCurveTo(s * 4 * open, 7, 0, 4); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(50,42,34,0.55)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(s * 3 * open, -4); g.quadraticCurveTo(s * 7 * open, -3, s * 10 * open, -5); g.stroke(); }
  g.fillStyle = '#3a3027'; g.beginPath(); g.ellipse(0, 1, 1.3, 4.5, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(80,66,52,0.8)'; g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -3); g.lineTo(s * 3, -7); g.stroke(); } });
// A beetle or a centipede from above, legs at `step`, facing +x.
const crawlerCanvas = (kind, step) => canvasOf(kind === 'centipede' ? 64 : 24, 16, (g, w, h) => { g.translate(w / 2, h / 2);
  const len = kind === 'centipede' ? 26 : 7, pairs = kind === 'centipede' ? 14 : 3, swing = Math.sin(step * TAU);
  g.strokeStyle = 'rgba(28,20,14,0.9)'; g.lineWidth = 0.7;
  for (let i = 0; i < pairs; i++) { const x = -len + (i + 0.5) * ((len * 2) / pairs), ph = (i % 2 ? 1 : -1) * swing * 1.4; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + ph * s, s * (kind === 'centipede' ? 3.6 : 4.2)); g.stroke(); } }
  const gr = g.createLinearGradient(0, -3, 0, 3); gr.addColorStop(0, kind === 'centipede' ? '#7a4a2a' : '#4a3a28'); gr.addColorStop(1, '#1a120b');
  g.fillStyle = gr;
  if (kind === 'centipede') { for (let i = 0; i < pairs; i++) { const x = -len + (i + 0.5) * ((len * 2) / pairs); g.beginPath(); g.ellipse(x, 0, 2.2, 1.6, 0, 0, TAU); g.fill(); } }
  else { g.beginPath(); g.ellipse(-1, 0, 6, 3.4, 0, 0, TAU); g.fill(); g.beginPath(); g.ellipse(6, 0, 2, 1.8, 0, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.moveTo(-6, 0); g.lineTo(4, 0); g.stroke(); }
  g.fillStyle = 'rgba(255,235,200,0.4)'; g.fillRect(-len * 0.4, -1.4, len * 0.5, 0.6); });
// Soot: a dark, uneven fan along a wall, densest at its middle, faint farther out (facing +x along the wall, the fire
// below +y).
const sootCanvas = (seed) => canvasOf(128, 48, (g, w, h) => { const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const ax = Math.abs(x - w / 2) / (w / 2), ay = y / h, n = fbm(x / 9 + seed, y / 9, 4), k = (y * w + x) * 4;
    const a = Math.max(0, (1 - ax * (1.1 - 0.4 * n)) * (0.45 + 0.55 * ay) * (0.55 + 0.6 * n) - 0.1);
    im.data[k] = 12; im.data[k + 1] = 10; im.data[k + 2] = 9; im.data[k + 3] = Math.min(1, a) * 255; }
  g.putImageData(im, 0, 0); });
// A wet stain at the foot of a wall (facing +y away from the wall).
const wetCanvas = (seed) => canvasOf(64, 32, (g, w, h) => { const im = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const runs = fbm(x / 6 + seed, 0.5, 3), reach = 0.25 + runs * 0.9, a = Math.max(0, 1 - (y / h) / reach) * (0.7 + 0.3 * fbm(x / 4, y / 4 + seed, 2)), k = (y * w + x) * 4;
    im.data[k] = 6; im.data[k + 1] = 8; im.data[k + 2] = 12; im.data[k + 3] = Math.min(1, a * 0.75) * 255; }
  g.putImageData(im, 0, 0); });
// Bad air over an area: a sickly haze filling the polygon (box `b`), thickest well inside it, torn by noise; drawn at
// most 192 pixels across and stretched over the area.
const foulCanvas = (poly, b, seed) => { const s = Math.min(1, 192 / Math.max(b.w, b.h, 1)), w = Math.max(8, Math.ceil(b.w * s)), h = Math.max(8, Math.ceil(b.h * s));
  return canvasOf(w, h, (g) => {
    g.filter = `blur(${Math.max(2, Math.round(Math.min(w, h) * 0.08))}px)`; g.fillStyle = '#fff'; g.beginPath();
    for (let i = 0; i < poly.length; i += 2) { const x = (poly[i] - b.x) * s, y = (poly[i + 1] - b.y) * s; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); g.fill(); g.filter = 'none';
    const im = g.getImageData(0, 0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const k = (y * w + x) * 4, n = fbm(x / 14 + seed * 5, y / 14 + seed * 3, 4);
      im.data[k] = im.data[k + 1] = im.data[k + 2] = 255; im.data[k + 3] = (im.data[k + 3] / 255) * Math.min(1, Math.max(0, n * 1.6 - 0.25)) * 255; }
    g.putImageData(im, 0, 0); }); };
// A small round glint (additive).
const glintCanvas = () => canvasOf(16, 16, (g, n) => { const gr = g.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2); gr.addColorStop(0, 'rgba(255,245,225,1)'); gr.addColorStop(0.25, 'rgba(255,225,190,0.5)'); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, n, n); });

// ---- The layer -----------------------------------------------------------------------------------------------------

/**
 * The underground's small life and wear. `floor()` a container on the floor (under the creatures), `above()` one over
 * the creatures, `glow()` one over the darkness (added light).
 * build({ soot: [{ key, x, y, angle, nx, ny }], wet: wetRuns, vents: ventsIn, rubble: [{ x, y, radius, seed }], grid })
 * lays the lasting things; tick(seconds, { view, now, eyes, moths, crawl, lit, fires, creatures, air, flicker }) moves
 * the living; kick(at, heading) sends a pebble; caveIn({ x, y, radius, seed }) brings the ceiling down here (falling
 * rubble and its dust); clear().
 */
export function createUndergroundLife({ PIXI, floor, above, glow }) {
  const tex = {};
  const T = (key, make) => (tex[key] ??= PIXI.Texture.from(make()));
  const sprite = (texture, parent, anchor = 0.5) => { const s = new PIXI.Sprite(texture); s.anchor.set(anchor); s.eventMode = 'none'; parent.addChild(s); return s; };
  let grid = 100, time = 0, lasting = [], glints = [], vents = [], puffs = [], stones = [], eyes = [], moths = [], crawlers = [], dust = [], falling = [], haze = [];
  // The stones of each cave-in seen falling here, once they have settled (by its seed): laid again by build() only when
  // this screen did not see it come down.
  const fallen = new Map();
  // Each light's moth loop (mothHome), worked out once a light.
  const homes = new WeakMap();
  // Seconds until the next eyes may show.
  let eyeWait = null;
  const kill = (list) => { for (const s of list) { try { (s.sprite ?? s.s ?? s).destroy?.(); s.shadow?.destroy?.(); s.a?.destroy?.(); s.b?.destroy?.(); } catch { /* gone */ } } };
  const clearLasting = () => { kill(lasting); kill(glints); kill(vents.map((v) => v.glow).filter(Boolean)); kill(puffs); kill(haze); for (const k of Object.keys(tex)) if (k.startsWith('foul:')) { tex[k].destroy(true); delete tex[k]; } lasting = []; glints = []; vents = []; puffs = []; haze = []; };
  const clearLiving = () => { kill(eyes); kill(moths); kill(crawlers); kill(stones); kill(dust); kill(falling); eyes = []; moths = []; crawlers = []; stones = []; dust = []; falling = []; };
  const rubbleSprite = (r, parent) => { const s = sprite(T(`stone:${r.seed % 12}`, () => stoneCanvas(r.seed % 12)), parent); s.width = s.height = r.size * 2; s.rotation = 0; return s; };
  return {
    build({ soot = [], wet = [], vents: ventList = [], rubble = [], foul = [], grid: g = 100, soothe = 1 } = {}) {
      clearLasting(); grid = g;
      // Bad air: two layers of haze over each area, turning slowly through each other.
      foul.forEach((p, i) => { const b = boxOf(p);
        for (const layer of [0, 1]) { const s = sprite(T(`foul:${i}:${layer}`, () => foulCanvas(p, b, i * 2 + layer)), above(), 0); s.tint = layer ? 0xb4c050 : 0x86a03c; s.position.set(b.x, b.y); s.width = b.w; s.height = b.h; s.alpha = 0;
          haze.push({ s, x: b.x, y: b.y, w: b.w, h: b.h, p: i * 1.7 + layer * 2.3, layer }); } });
      for (const s of soot) {
        const look = String(s.key ?? '').length % 4;
        const sp = sprite(T(`soot:${look}`, () => sootCanvas(look)), floor(), 0.5);
        // On the wall's stone behind the fire: its dense edge at the wall's foot by the flame, fanning back over the wall
        // away from it.
        sp.anchor.set(0.5, 1); sp.position.set(s.x + s.nx * grid * 0.03, s.y + s.ny * grid * 0.03);
        sp.rotation = Math.atan2(-s.nx, s.ny); sp.width = grid * (1.2 + 0.6 * soothe); sp.height = grid * 0.5; sp.alpha = 1;
        lasting.push(sp);
        // And a faint smudge on the floor just in front, where the ash falls.
        const smudge = sprite(T(`soot:${look}`, () => sootCanvas(look)), floor(), 0.5);
        smudge.anchor.set(0.5, 1); smudge.position.set(s.x + s.nx * grid * 0.03, s.y + s.ny * grid * 0.03);
        smudge.rotation = Math.atan2(s.nx, -s.ny); smudge.width = grid * 0.8; smudge.height = grid * 0.18; smudge.alpha = 0.35;
        lasting.push(smudge);
      }
      for (const w of wet) {
        const sp = sprite(T(`wet:${Math.floor((w.a.x + w.a.y) % 3)}`, () => wetCanvas(Math.floor((w.a.x + w.a.y) % 3))), floor(), 0.5);
        const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
        sp.anchor.set(0.5, 0); sp.position.set((w.a.x + w.b.x) / 2, (w.a.y + w.b.y) / 2); sp.rotation = Math.atan2(w.ny, w.nx) - Math.PI / 2; sp.width = len * 1.05; sp.height = grid * 0.35;
        lasting.push(sp);
        // Its glistening: a few highlights that catch the light.
        const r = rng(`${w.a.x},${w.a.y}`);
        for (let i = 0; i < 4; i++) { const f = r(), d = grid * (0.02 + r() * 0.12); const gs = sprite(T('glint', glintCanvas), glow()); gs.blendMode = PIXI.BLEND_MODES.ADD; gs.position.set(w.a.x + (w.b.x - w.a.x) * f + w.nx * d, w.a.y + (w.b.y - w.a.y) * f + w.ny * d); gs.width = gs.height = grid * 0.07; gs.alpha = 0; glints.push({ s: gs, p: r() * TAU }); }
      }
      for (const v of ventList) {
        const gl = sprite(T('glint', glintCanvas), glow()); gl.blendMode = PIXI.BLEND_MODES.ADD; gl.tint = 0xff7a32; gl.position.set(v.x, v.y); gl.width = gl.height = grid * 0.5; gl.alpha = 0.25;
        const crack = sprite(T('wet:0', () => wetCanvas(0)), floor(), 0.5); crack.position.set(v.x, v.y); crack.width = grid * 0.7; crack.height = grid * 0.45; crack.rotation = (v.x % 3); lasting.push(crack);
        vents.push({ ...v, glow: gl, burst: 0 });
      }
      const keep = new Set(rubble.map((r) => r.seed));
      for (const [seed, list] of fallen) if (!keep.has(seed)) { kill(list); fallen.delete(seed); }
      for (const r of rubble) if (!fallen.has(r.seed)) for (const st of rubbleStones(r)) lasting.push(rubbleSprite(st, floor()));
    },
    // A cave-in here: the stones fall and bounce before they settle (then the lasting rubble takes over), dust billows.
    caveIn(r) {
      const list = rubbleStones(r), cloud = (i) => T(`cloud:${i % 4}`, () => cloudCanvas(i % 4));
      kill(fallen.get(r.seed) ?? []); fallen.set(r.seed, []);
      list.forEach((st, i) => { const s = rubbleSprite(st, above()); const a = Math.atan2(st.y - r.y, st.x - r.x); falling.push({ s, st, seed: r.seed, h: 1 + (i % 7) * 0.12, vh: 0, vx: Math.cos(a) * grid * 0.5, vy: Math.sin(a) * grid * 0.4, x: st.x - Math.cos(a) * grid * 0.4, y: st.y - Math.sin(a) * grid * 0.3 }); });
      for (let i = 0; i < 22; i++) { const a = (i / 22) * TAU, s = sprite(cloud(i), above()); s.tint = 0xb2a591; s.alpha = 0; dust.push({ s, x: r.x + Math.cos(a) * r.radius * 0.3, y: r.y + Math.sin(a) * r.radius * 0.3, vx: Math.cos(a) * grid * 0.7, vy: Math.sin(a) * grid * 0.6, age: -i * 0.03, life: 6 + (i % 5), rot: a }); }
    },
    kick(at, heading = 0) {
      if (stones.length > 40) { kill([stones.shift()]); }
      const seed = Math.floor(Math.random() * 1000), a = heading + (Math.random() - 0.5) * 1.4, sp = grid * (0.9 + Math.random() * 0.9);
      const s = sprite(T(`stone:${seed % 12}`, () => stoneCanvas(seed % 12)), floor()); const size = grid * (0.025 + Math.random() * 0.03); s.width = s.height = size * 2;
      stones.push({ s, x: at.x, y: at.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, h: 0, vh: 1.2 + Math.random(), spin: (Math.random() - 0.5) * 20, rot: Math.random() * TAU, age: 0 });
    },
    tick(seconds, { view = null, eyes: eyeSpots = null, eyeRate = '', moths: mothLights = null, crawl = null, lit = () => 0, creatures = [], air = () => ({ x: 0, y: 0 }) } = {}) {
      time += seconds;
      const dt = Math.min(0.05, seconds), seen = (x, y, pad = grid) => !view || (x > view.x - pad && y > view.y - pad && x < view.x + view.w + pad && y < view.y + view.h + pad);
      // Bad air swells and thins, leaning a little down the draft.
      for (const h of haze) { const w = air(h.x + h.w / 2, h.y + h.h / 2), k = 0.5 + 0.5 * Math.sin(time * 0.35 + h.p);
        h.s.position.set(h.x + Math.sin(time * 0.11 + h.p) * grid * 0.25 + w.x * grid * 0.4, h.y + Math.cos(time * 0.09 + h.p) * grid * 0.2 + w.y * grid * 0.4);
        h.s.alpha = (h.layer ? 0.32 + 0.2 * k : 0.42 + 0.16 * (1 - k)); }
      // Glistening wet stone: its highlights wink with the flicker of the light on them.
      for (const g of glints) { const k = Math.max(0, Math.sin(time * 1.7 + g.p * 5 + noise(time * 2, g.p) * 2)); g.s.alpha = Math.min(1, lit(g.s.x, g.s.y) * 1.2) * k * k * 0.9; }
      // Steam: a steady wisp from each vent, and now and then a burst; carried off on the air.
      const cloud = (i) => T(`cloud:${i % 4}`, () => cloudCanvas(i % 4));
      for (const v of vents) {
        v.glow.alpha = 0.18 + 0.06 * Math.sin(time * 2 + v.x);
        if (!seen(v.x, v.y, grid * 3)) continue;
        v.wait -= dt; if (v.wait < 0) { v.wait = v.every; v.burst = 1.2; }
        v.burst = Math.max(0, v.burst - dt);
        if (puffs.length < 90 && Math.random() < dt * (v.burst > 0 ? 40 : 7)) { const hard = v.burst > 0, s = sprite(cloud(puffs.length), above()); s.tint = 0xebeef2; s.alpha = 0;
          puffs.push({ s, x: v.x + (Math.random() - 0.5) * grid * 0.08, y: v.y, vx: (Math.random() - 0.5) * grid * (hard ? 0.4 : 0.1), vy: -grid * (hard ? 0.7 + Math.random() * 0.5 : 0.18 + Math.random() * 0.14), age: 0, life: hard ? 3 + Math.random() * 1.5 : 2.5 + Math.random(), big: hard ? 1.3 : 0.7, rot: Math.random() * TAU }); }
      }
      puffs = puffs.filter((p) => { p.age += dt; const k = p.age / p.life; if (k > 1) { p.s.destroy(); return false; }
        const w = air(p.x, p.y); p.vx = p.vx * Math.pow(0.6, dt) + w.x * grid * 0.9 * dt; p.vy = p.vy * Math.pow(0.55, dt) + w.y * grid * 0.9 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const r = grid * (0.1 + 0.55 * Math.sqrt(k)) * p.big; p.s.position.set(p.x, p.y); p.s.width = p.s.height = r * 2; p.s.rotation = p.rot + k * 0.8; p.s.alpha = Math.min(1, 0.26 * p.big * Math.sin(Math.min(1, k * 4) * 1.5708) * (1 - k)); return true; });
      // Pebbles: skittering, bouncing, rolling to a stop; fading after a while.
      stones = stones.filter((s) => { s.age += dt; if (s.age > 25) { s.s.destroy(); return false; }
        if (s.h > 0 || s.vh) { s.vh -= dt * 9; s.h += s.vh * dt; if (s.h <= 0) { s.h = 0; s.vh = s.vh < -1 ? -s.vh * 0.35 : 0; s.vx *= 0.6; s.vy *= 0.6; } }
        s.x += s.vx * dt; s.y += s.vy * dt; const drag = s.h > 0 ? 0.6 : 0.03; s.vx *= Math.pow(drag, dt); s.vy *= Math.pow(drag, dt); s.rot += s.spin * dt * Math.min(1, Math.hypot(s.vx, s.vy) / (grid * 0.3));
        s.s.position.set(s.x, s.y - s.h * grid * 0.1); s.s.rotation = s.rot; s.s.alpha = Math.min(1, (25 - s.age) / 3); return true; });
      // Rubble falling, bouncing, settling (then it lies with the lasting rubble).
      falling = falling.filter((f) => { if (f.h > 0 || f.vh) { f.vh -= dt * 6; f.h = Math.max(0, f.h + f.vh * dt); if (f.h === 0 && f.vh < -0.5) f.vh = -f.vh * 0.3; else if (f.h === 0) f.vh = 0; }
        if (f.h === 0) { f.x += (f.st.x - f.x) * Math.min(1, dt * 4); f.y += (f.st.y - f.y) * Math.min(1, dt * 4); }
        f.s.position.set(f.x, f.y - f.h * grid * 0.4); const k = 1 + f.h * 0.6; f.s.width = f.s.height = f.st.size * 2 * k;
        if (f.h === 0 && Math.hypot(f.st.x - f.x, f.st.y - f.y) < 1) { const heap = fallen.get(f.seed); if (heap) { floor().addChild(f.s); heap.push(f.s); } else f.s.destroy(); return false; } return true; });
      dust = dust.filter((p) => { p.age += dt; if (p.age < 0) return true; const k = p.age / p.life; if (k > 1) { p.s.destroy(); return false; }
        const w = air(p.x, p.y); p.vx = p.vx * Math.pow(0.3, dt) + w.x * grid * 0.6 * dt; p.vy = p.vy * Math.pow(0.3, dt) + w.y * grid * 0.6 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        const r = grid * (0.4 + 1.6 * Math.sqrt(k)); p.s.position.set(p.x, p.y); p.s.width = p.s.height = r * 2; p.s.rotation = p.rot + k; p.s.alpha = 0.3 * Math.sin(Math.min(1, k * 6) * 1.5708) * (1 - k); return true; });
      // Eyes in the dark: a few pairs at dark spots near the view, showing a while, blinking, gone when light or a
      // creature comes near (and somewhere else later).
      if (eyeSpots) {
        // Now and then a single pair, long quiet between ("often": up to two, shorter waits).
        const often = eyeRate === 'often', most = often ? 2 : 1;
        if (eyeWait === null) eyeWait = (often ? 4 : 12) + Math.random() * (often ? 10 : 25);
        if (eyes.length < most) eyeWait -= dt;
        const free = eyeWait <= 0 ? eyeSpots.filter((p) => !eyes.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < grid * 3)) : [];
        if (free.length) eyeWait = (often ? 6 : 25) + Math.random() * (often ? 14 : 45);
        while (free.length && eyes.length < most) { const spot = free.splice(Math.floor(Math.random() * free.length), 1)[0], col = [0xc8f096, 0xffd278, 0xd2e6ff][Math.floor(Math.random() * 3)];
          const pair = [sprite(T('glint', glintCanvas), glow()), sprite(T('glint', glintCanvas), glow())]; for (const s of pair) { s.blendMode = PIXI.BLEND_MODES.ADD; s.tint = col; s.alpha = 0; }
          eyes.push({ a: pair[0], b: pair[1], x: spot.x, y: spot.y, p: Math.random() * TAU, show: 3 + Math.random() * 5, age: 0 }); break; }
        eyes = eyes.filter((e) => { e.age += dt;
          const near = lit(e.x, e.y) > 0.3 || creatures.some((c) => Math.hypot(c.x - e.x, c.y - e.y) < grid * 3.5);
          if (e.age > e.show || near && e.age > 0) { e.a.destroy(); e.b.destroy(); return false; }
          const k = e.age < 0 ? 0 : Math.min(1, e.age * 1.5) * Math.min(1, (e.show - e.age) * 2), blink = Math.max(0, Math.sin(time * 0.9 + e.p * 4) - 0.96) * 25, open = Math.max(0.1, 1 - blink);
          const x = e.x + Math.sin(time * 0.25 + e.p) * grid * 0.03, y = e.y + Math.cos(time * 0.2 + e.p) * grid * 0.015;
          for (const [s, side] of [[e.a, -1], [e.b, 1]]) { s.position.set(x + side * grid * 0.05, y); s.width = grid * 0.085; s.height = grid * 0.085 * open; s.alpha = 0.7 * k; }
          return true; });
      } else if (eyes.length) { kill(eyes); eyes = []; }
      // Moths round the fires near the view: loops, flutter, their shadows thrown away from the flame.
      if (mothLights) {
        const want = mothLights.slice(0, 5).flatMap((l) => [0, 1, 2].map((i) => ({ l, i })));
        while (moths.length > want.length) { const m = moths.pop(); m.s.destroy(); m.shadow.destroy(); }
        while (moths.length < want.length) { const s = sprite(T('moth:3', () => mothCanvas(1)), above()), shadow = sprite(T('moth:3', () => mothCanvas(1)), floor()); shadow.tint = 0x000000; moths.push({ s, shadow, a: Math.random() * TAU, rad: 0.5 + Math.random() * 0.45, sp: 2.5 + Math.random() * 3, p: Math.random() * TAU, z: 0.3 + Math.random() * 0.7 }); }
        moths.forEach((m, n) => {
          const { l } = want[n]; m.a += dt * m.sp * (0.7 + 0.6 * Math.sin(time * 1.3 + m.p)); const rr = grid * m.rad * (0.7 + 0.5 * Math.sin(time * 0.9 + m.p * 2));
          // Round the light's open side, never through a wall (kept inside where the light reaches).
          const home = homes.get(l) ?? homes.set(l, mothHome(l, { grid })).get(l);
          const { x, y } = keepInside({ x: home.x + Math.cos(m.a) * rr + Math.sin(time * 7 + m.p) * grid * 0.03, y: home.y + Math.sin(m.a) * rr * 0.8 + Math.cos(time * 6 + m.p) * grid * 0.03 }, home, home.shape);
          const open = 0.35 + 0.65 * Math.abs(Math.sin(time * 38 + m.p)), frame = T(`moth:${Math.round(open * 3)}`, () => mothCanvas(Math.round(open * 3) / 3));
          m.s.texture = frame; m.s.position.set(x, y); m.s.rotation = m.a + Math.PI; m.s.width = m.s.height = grid * 0.15;
          const dx = x - l.x, dy = y - l.y, d = Math.hypot(dx, dy) + 1, far = grid * 0.6 + (grid * grid * 0.24) / d;
          const fall = keepInside({ x: l.x + (dx / d) * (d + far * m.z), y: l.y + (dy / d) * (d + far * m.z) }, { x, y }, home.shape);
          m.shadow.texture = frame; m.shadow.position.set(fall.x, fall.y); m.shadow.rotation = m.s.rotation; m.shadow.width = m.shadow.height = grid * (0.15 + (8 * grid) / (d * 100)); m.shadow.alpha = Math.min(0.35, (grid * 0.12) / d);
        });
      } else if (moths.length) { kill(moths.map((m) => m.s)); kill(moths.map((m) => m.shadow)); moths = []; }
      // Crawlers along the foot of the walls, in the dark: run, freeze, run.
      if (crawl) {
        while (crawlers.length < Math.min(4, crawl.length)) { const path = crawl[Math.floor(Math.random() * crawl.length)], kind = crawlers.length === 0 ? 'centipede' : 'beetle';
          crawlers.push({ s: sprite(T(`${kind}:0`, () => crawlerCanvas(kind, 0)), floor()), kind, path, k: Math.random(), v: 0, wait: Math.random() * 2, step: 0 }); }
        for (const c of crawlers) {
          // Gone from the view: it turns up again by a wall in sight.
          if (!c.s.visible && !crawl.includes(c.path)) { c.path = crawl[Math.floor(Math.random() * crawl.length)]; c.k = Math.random(); }
          c.wait -= dt; if (c.wait < 0) { c.v = c.v ? 0 : (Math.random() < 0.5 ? -1 : 1) * (0.25 + Math.random() * 0.3); c.wait = c.v ? 0.5 + Math.random() * 1.4 : 0.8 + Math.random() * 2.5; }
          const len = Math.hypot(c.path.b.x - c.path.a.x, c.path.b.y - c.path.a.y) || 1;
          c.k += (c.v * grid * dt) / len; if (c.k < 0 || c.k > 1) { c.k = Math.max(0, Math.min(1, c.k)); c.v = -c.v; }
          const x = c.path.a.x + (c.path.b.x - c.path.a.x) * c.k, y = c.path.a.y + (c.path.b.y - c.path.a.y) * c.k;
          if (lit(x, y) > 0.45 && c.v) c.v = -c.v;
          c.step = (c.step + Math.abs(c.v) * dt * 6) % 1;
          c.s.texture = T(`${c.kind}:${Math.floor(c.step * 4)}`, () => crawlerCanvas(c.kind, Math.floor(c.step * 4) / 4));
          c.s.position.set(x, y); c.s.rotation = Math.atan2(c.path.b.y - c.path.a.y, c.path.b.x - c.path.a.x) + (c.v < 0 ? Math.PI : 0); c.s.scale.set(grid / 160); c.s.visible = seen(x, y);
        }
      } else if (crawlers.length) { kill(crawlers.map((c) => c.s)); crawlers = []; }
    },
    clear() { clearLasting(); clearLiving(); for (const list of fallen.values()) kill(list); fallen.clear(); },
    get busy() { return fallen.size + haze.length + lasting.length + glints.length + vents.length + puffs.length + stones.length + eyes.length + moths.length + crawlers.length + dust.length + falling.length > 0; },
  };
}

// A cave-in's stones (pure): a heap round its middle, mostly gravel, a few big blocks; the same seed always gives the
// same heap. Each { x, y, size, seed }.
export function rubbleStones({ x, y, radius = 150, seed = 1 } = {}) {
  const r = rng(`rubble:${seed}`), n = Math.round(30 + radius / 4), out = [];
  for (let i = 0; i < n; i++) { const a = r() * TAU, d = Math.pow(r(), 0.7) * radius, big = Math.pow(r(), 3.2); out.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d * 0.85, size: radius * (0.02 + big * 0.16) * (1 - 0.4 * (d / radius)), seed: Math.floor(r() * 1000) }); }
  return out.sort((a, b) => a.size - b.size);
}
