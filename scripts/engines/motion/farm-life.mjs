// Farm animals: cows, goats, sheep, pigs and horses, drawn from above in the town animals' manner (on a canvas, soft light,
// facing up). A herd grazes, walks a little and grazes again, keeping loosely together; a creature too close or a loud
// noise sends them off at a run, away from it, and they settle again after. Where they may be (`ok`) and what stops them
// (`blocked`) are the caller's: for a region's animals, its own ground and its edge.

import { orderAim, orderPrep, orderHandles, FARM_ORDER_KINDS } from './animal-orders.mjs';

const TAU = Math.PI * 2;
// Each kind: its length in squares, its picture's size, how far it keeps from a creature (squares), its walking and
// running pace (squares a second), how long it grazes and walks (seconds), how far it strays from the herd (squares).
export const FARM_KINDS = Object.freeze({
  cows: { squares: 1.7, w: 110, h: 170, fear: 1.2, pace: 0.45, run: 2.2, graze: 9, walk: 3, herd: 3.5 },
  goats: { squares: 0.85, w: 80, h: 110, fear: 1.2, pace: 0.7, run: 3, graze: 5, walk: 2.4, herd: 3 },
  sheep: { squares: 0.9, w: 84, h: 110, fear: 1.5, pace: 0.5, run: 2.6, graze: 7, walk: 2.4, herd: 2 },
  pigs: { squares: 0.9, w: 84, h: 110, fear: 1, pace: 0.55, run: 2.4, graze: 6, walk: 2.6, herd: 3 },
  horses: { squares: 1.9, w: 110, h: 190, fear: 1.4, pace: 0.6, run: 3.6, graze: 8, walk: 3, herd: 4 },
});

// What each kind's call is named, for the sounds.
export const FARM_CALLS = Object.freeze({ cows: 'cowCall', goats: 'goatCall', sheep: 'sheepCall', pigs: 'pigCall', horses: 'horseCall' });

// The middle of a herd (pure): { x, y } or null.
export const farmHerd = (list = []) => (list.length ? { x: list.reduce((s, o) => s + o.x, 0) / list.length, y: list.reduce((s, o) => s + o.y, 0) / list.length } : null);

// One step of one animal (pure). Heading `a`: 0 up the map, turning clockwise. `herd` its herd's middle; `noise` { x, y, radius }.
export function farmStep(animal, { dt = 1 / 20, grid = 100, near = [], ok = () => true, blocked = () => false, herd = null, noise = null, random = Math.random } = {}) {
  const a = { ...animal }, k = FARM_KINDS[a.kind] ?? FARM_KINDS.cows, body = k.squares * grid;
  const away = (from) => Math.atan2(a.x - from.x, -(a.y - from.y));
  // Too close a creature, or a loud noise: off at a run, away from it.
  const close = near.find((n) => Math.hypot(n.x - a.x, n.y - a.y) < k.fear * grid + body * 0.3);
  const heard = noise && Math.hypot(noise.x - a.x, noise.y - a.y) < noise.radius;
  // (One already running keeps the rest of its run if that is longer; one grazing runs two to four seconds, not its graze's time.)
  if (close || heard) { const running = a.mode === 'flee'; a.mode = 'flee'; a.a = away(close ?? noise); a.wait = Math.max(running ? a.wait : 0, 2 + random() * 2); }
  a.wait -= dt;
  if (a.wait <= 1e-9) {
    if (a.mode === 'graze') {
      // A few steps somewhere: back toward the herd when strayed from it, else a little to one side.
      a.mode = 'walk'; a.wait = k.walk * (0.6 + random() * 0.8);
      if (herd && Math.hypot(herd.x - a.x, herd.y - a.y) > k.herd * grid) a.a = Math.atan2(herd.x - a.x, -(herd.y - a.y));
      else a.a += (random() - 0.5) * 2.2;
    } else if (a.mode === 'walk' || !close) { a.mode = 'graze'; a.wait = k.graze * (0.5 + random()); }
  }
  const want = a.mode === 'flee' ? k.run * grid : a.mode === 'walk' ? k.pace * grid : 0;
  a.v = (a.v ?? 0) + (want - (a.v ?? 0)) * Math.min(1, dt * 4);
  if (a.v > 0.5) {
    // Never where it may not go: the nearest way round that is open, a step and half a body ahead, turning no more than it must, so
    // it goes along an edge; with none, it stands. (Turned a random way each time it met one, it spun on the spot, every frame when
    // fleeing into an edge or standing just over one. Paulomat: "creatures often become stuck on edges ... and begin spinning".)
    // On ground it may not be on, any way that is not blocked is open: it walks off it.
    const here = ok(a.x, a.y), free = (h) => [Math.max(a.v * dt, grid * 0.05), body * 0.5].every((d) => { const nx = a.x + Math.sin(h) * d, ny = a.y - Math.cos(h) * d; return (ok(nx, ny) || !here) && !blocked({ x: a.x, y: a.y }, { x: nx, y: ny }); });
    // (A way round, once taken, kept a moment: fleeing into a corner, the nearest open way flipped from one side to the other as it
    // moved, and it shook back and forth.)
    a.detourT = Math.max(0, (a.detourT ?? 0) - dt);
    const aim = a.detourT > 0 ? a.detour : a.a;
    let way = free(aim) ? aim : null;
    for (let i = 1; i <= 8 && way === null; i++) for (const side of i < 8 ? [1, -1] : [1]) { const h = aim + (side * i * Math.PI) / 8; if (free(h)) { way = h; break; } }
    if (way === null) { a.v = 0; a.detourT = 0; if (a.mode === 'walk') { a.mode = 'graze'; a.wait = k.graze * (0.5 + random()); } }
    else {
      if (way !== aim || (a.detourT <= 0 && way !== a.a)) { a.detour = way; a.detourT = 1.2; } a.a = way;
      // (Its body comes round at a beast's pace, not at once, and it slows to turn: snapped to each new way, in a narrow passage or a
      // corner it flicked from heading to heading many times a second. Paulomat: "turning can repeat so often and so fast".)
      const face = Number.isFinite(a.face) ? a.face : way, off = Math.atan2(Math.sin(way - face), Math.cos(way - face)), most = (a.mode === 'flee' ? 5 : 2.5) * dt;
      a.face = face + Math.max(-most, Math.min(most, off)); const along = Math.max(0, Math.cos(way - a.face));
      a.x += Math.sin(way) * a.v * along * dt; a.y -= Math.cos(way) * a.v * along * dt;
    }
  }
  a.gait = ((a.gait ?? 0) + (a.v * dt) / (body * 0.5)) % 1;
  return a;
}

// ---- Their pictures: from above, facing up. `p` the stride (0-1); `graze` head down to the grass.
const rng = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const blob = (x, fill, cx, cy, rx, ry, rot = 0) => { x.fillStyle = fill; x.beginPath(); x.ellipse(cx, cy, rx, ry, rot, 0, TAU); x.fill(); };
const line = (x, colour, width, ...pts) => { x.strokeStyle = colour; x.lineWidth = width; x.beginPath(); pts.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.stroke(); };
const swing = (p, off) => Math.sin(TAU * (p + off));
const barrel = (x, c, w, h, y = 0) => { const g = x.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, c.dark); g.addColorStop(0.42, c.coat); g.addColorStop(0.6, c.coat); g.addColorStop(1, c.dark); x.fillStyle = g; x.beginPath(); x.ellipse(0, y, w, h, 0, 0, TAU); x.fill(); const s = x.createRadialGradient(-w * 0.3, y - h * 0.3, 1, 0, y, h); s.addColorStop(0, 'rgba(255,255,255,0.12)'); s.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = s; x.fill(); };
const legs = (x, c, spots, p, reach, width) => { for (const [sx, hip, off] of spots) line(x, c.legs ?? c.dark, width, [sx, hip], [sx * 1.08, hip - swing(p, off) * reach]); };
const patches = (x, colour, rx, ry, cy, n, size, seed) => { x.save(); x.beginPath(); x.ellipse(0, cy, rx, ry, 0, 0, TAU); x.clip(); const r = rng(seed); for (let i = 0; i < n; i++) blob(x, colour, (r() - 0.5) * rx * 1.8, cy + (r() - 0.5) * ry * 1.75, size[0] + r() * size[1], size[0] * 1.2 + r() * size[1] * 1.2, r() * 3); x.restore(); };

export const FARM_COATS = Object.freeze({
  cows: [{ coat: '#f1eee8', dark: '#b9b3aa', patch: '#1d1b1a', head: '#efebe4', muzzle: '#e6b3a6', legs: '#6d6760' }, { coat: '#8a4b28', dark: '#4f2914', head: '#7c4222', muzzle: '#c99a84', legs: '#3b1f10' }, { coat: '#c9ab7e', dark: '#8c734e', head: '#bf9f72', muzzle: '#ddc0a4', legs: '#6e5a3d' }],
  goats: [{ coat: '#ebe6dc', dark: '#b4ad9f', head: '#e8e2d6', horn: '#a99a7c', legs: '#9c9484' }, { coat: '#8d6640', dark: '#57391f', head: '#7d5735', horn: '#3b3128', stripe: '#2e2219', legs: '#2e2219' }, { coat: '#2a2724', dark: '#131210', head: '#e9e4da', horn: '#6a6153', legs: '#1a1816' }],
  sheep: [{ coat: '#e9e4d6', dark: '#bdb6a3', face: '#2a2522', legs: '#2a2522' }, { coat: '#d8d0bd', dark: '#a69d87', face: '#e3dccc', legs: '#7d7462' }, { coat: '#4a4440', dark: '#2b2724', face: '#1d1a18', legs: '#1d1a18' }],
  pigs: [{ coat: '#e9b4a2', dark: '#c4837a', snout: '#d98f86' }, { coat: '#ecc3b0', dark: '#c99683', snout: '#d99c8a', spot: '#4a3a33' }, { coat: '#3c3532', dark: '#211d1b', snout: '#5a4b46' }],
  horses: [{ coat: '#6e3d1f', dark: '#3c1f0e', mane: '#16110d', legs: '#16110d' }, { coat: '#a65a2a', dark: '#6b3414', mane: '#7a3b14', legs: '#6b3414', blaze: true }, { coat: '#bdb8ae', dark: '#857f74', mane: '#d9d4ca', legs: '#6f695f' }],
});
const DRAW = {
  cows: (x, c, { p, graze, seed }) => {
    legs(x, c, [[-13, -22, 0], [13, -22, 0.5], [-13, 26, 0.5], [13, 26, 0]], p, 7, 5);
    line(x, c.dark, 3, [0, 36], [swing(p, 0.2) * 3, 50]); blob(x, '#2a2420', swing(p, 0.2) * 3, 52, 2.4, 3.4);
    barrel(x, c, 17, 38, 2); if (c.patch) patches(x, c.patch, 17, 38, 2, 6, [5, 8], seed);
    const hy = graze ? -52 : -44;
    line(x, c.coat, 13, [0, -30], [0, hy + 6]);
    for (const s of [-1, 1]) { blob(x, c.head, s * 9, hy + 2, 4.5, 2.6, s * 0.5); line(x, '#d9cfb8', 2.4, [s * 5, hy - 2], [s * 10, hy - 5]); }
    blob(x, c.head, 0, hy - 2, 7.5, 10); blob(x, c.muzzle, 0, hy - 10, 5.6, 3.6); if (c.patch) blob(x, c.patch, 2, hy, 4, 5);
  },
  goats: (x, c, { p, graze }) => {
    legs(x, c, [[-6.5, -11, 0], [6.5, -11, 0.5], [-6.5, 12, 0.5], [6.5, 12, 0]], p, 5, 2.6);
    line(x, c.dark, 2.6, [0, 17], [0, 21]);
    barrel(x, c, 8.5, 19, 1); if (c.stripe) line(x, c.stripe, 2.4, [0, -14], [0, 17]);
    const hy = graze ? -27 : -22;
    line(x, c.coat, 6.5, [0, -14], [0, hy + 4]);
    for (const s of [-1, 1]) { x.strokeStyle = c.horn; x.lineWidth = 2.2; x.beginPath(); x.moveTo(s * 2, hy - 1); x.quadraticCurveTo(s * 5, hy + 2, s * 4.6, hy + 7); x.stroke(); blob(x, c.head, s * 5.5, hy + 0.5, 3.4, 1.5, s * 0.6); }
    blob(x, c.head, 0, hy - 1, 3.8, 6); blob(x, '#c8b7a6', 0, hy - 6, 2.3, 1.6);
  },
  sheep: (x, c, { p, graze, seed }) => {
    legs(x, c, [[-6, -10, 0], [6, -10, 0.5], [-6, 11, 0.5], [6, 11, 0]], p, 4, 2.6);
    barrel(x, c, 12, 18, 1);
    const r = rng(seed); for (let i = 0; i < 46; i++) { const a = r() * TAU, d = Math.sqrt(r()), cx = Math.cos(a) * d * 10, cy = 1 + Math.sin(a) * d * 16; const g = x.createRadialGradient(cx - 1, cy - 1, 0.5, cx, cy, 3.6); g.addColorStop(0, c.coat); g.addColorStop(1, c.dark); x.fillStyle = g; x.beginPath(); x.arc(cx, cy, 3.4, 0, TAU); x.fill(); }
    const hy = graze ? -24 : -19;
    for (const s of [-1, 1]) blob(x, c.face, s * 4.6, hy + 1, 3, 1.6, s * 0.4);
    blob(x, c.face, 0, hy - 1, 3.8, 5.4); blob(x, c.coat, 0, hy + 3, 4.4, 2.6);
  },
  pigs: (x, c, { p, graze, seed }) => {
    legs(x, c, [[-7, -10, 0], [7, -10, 0.5], [-7, 12, 0.5], [7, 12, 0]], p, 3.5, 3);
    x.strokeStyle = c.dark; x.lineWidth = 1.6; x.beginPath(); x.arc(1.5, 21, 2.2, Math.PI * 0.8, Math.PI * 2.4); x.stroke();
    barrel(x, c, 11.5, 19, 1); if (c.spot) patches(x, c.spot, 11.5, 19, 1, 4, [3, 3], seed);
    const hy = graze ? -22 : -19;
    blob(x, c.coat, 0, hy + 1, 7.5, 6.5);
    for (const s of [-1, 1]) { x.fillStyle = c.dark; x.beginPath(); x.moveTo(s * 2.5, hy - 1); x.lineTo(s * 7.5, hy - 5); x.lineTo(s * 7, hy + 2); x.closePath(); x.fill(); }
    blob(x, c.snout, 0, hy - 5.5, 3.6, 2.6); for (const s of [-1, 1]) blob(x, '#6e4740', s * 1.3, hy - 5.7, 0.7, 0.9);
  },
  horses: (x, c, { p, graze }) => {
    legs(x, c, [[-11, -24, 0], [11, -24, 0.5], [-11, 28, 0.5], [11, 28, 0]], p, 9, 4.2);
    x.strokeStyle = c.mane; x.lineWidth = 6; x.beginPath(); x.moveTo(0, 38); x.quadraticCurveTo(swing(p, 0.1) * 4, 52, swing(p, 0.3) * 6, 66); x.stroke();
    barrel(x, c, 14, 40, 2);
    const hy = graze ? -66 : -58;
    line(x, c.coat, 12, [0, -32], [0, hy + 10]); line(x, c.mane, 3.6, [0, -34], [0, hy + 10]);
    for (const s of [-1, 1]) { x.fillStyle = c.coat; x.beginPath(); x.moveTo(s * 2, hy + 6); x.lineTo(s * 5, hy + 12); x.lineTo(s * 5.5, hy + 5); x.closePath(); x.fill(); }
    blob(x, c.coat, 0, hy - 1, 6, 13); if (c.blaze) line(x, '#efe7da', 2.4, [0, hy + 5], [0, hy - 10]);
    blob(x, c.dark, 0, hy - 12, 4.6, 3);
  },
};

/**
 * The layer: populate({ spots, cows, goats, sheep, pigs, horses, grid, size, random }) places herds on the spots given
 * ({ x, y }); tick(seconds, { near, ok(kind, x, y), blocked(from, to), seen(x, y) }); noise({ x, y, radius }); clear().
 * `picture(w, h, draw)` makes a texture (a canvas drawn at twice the size, by default).
 */
export function createFarmLife({ PIXI, floor, picture = null, restyle = null }) {
  const paint = picture ?? ((w, h, draw) => { const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2; const x = c.getContext('2d'); x.scale(2, 2); x.translate(w / 2, h / 2); x.lineCap = 'round'; x.lineJoin = 'round'; draw(x); return PIXI.Texture.from(c); });
  const art = new Map();
  // Each kind and coat drawn once, when first wanted: four strides and grazing.
  const artOf = (kind, coat, seed) => {
    const key = `${kind}:${coat}:${seed}`;
    if (!art.has(key)) { const k = FARM_KINDS[kind], c = FARM_COATS[kind][coat], draw = (o) => paint(k.w, k.h, (x) => DRAW[kind](x, c, { p: 0, graze: false, seed, ...o })); const drawn = { walk: [0, 0.25, 0.5, 0.75].map((p) => draw({ p })), graze: draw({ graze: true }) };
      // in the painted look where it has been baked (animal-art.mjs `restyle`, given by main), else as drawn here
      art.set(key, restyle ? restyle('farm', drawn, `${kind}/${coat}`) : drawn); }
    return art.get(key);
  };
  let animals = [], grid = 100, size = 1, noises = [], calls = {}, time = 0;
  const drop = () => { for (const o of animals) { try { o.body.destroy(); o.shadow.destroy(); } catch { /* gone */ } } animals = []; };
  // One animal of a kind, its own size and shade, at a place.
  const newAnimal = (kind, at, random) => {
    const coat = Math.floor(random() * FARM_COATS[kind].length), seed = 3 + Math.floor(random() * 50), look = artOf(kind, coat, seed);
    const shadow = new PIXI.Sprite(look.graze), body = new PIXI.Sprite(look.graze);
    for (const sp of [shadow, body]) { sp.anchor.set(0.5); sp.eventMode = 'none'; }
    shadow.tint = 0x000000; shadow.alpha = 0.28;
    floor().addChild(shadow); floor().addChild(body);
    // (Each its own: a little bigger or smaller, a little lighter or darker than its coat.)
    const big = 0.9 + random() * 0.2, shade = Math.round(232 + random() * 23); body.tint = (shade << 16) | (shade << 8) | shade;
    return { kind, x: at.x, y: at.y, a: random() * TAU, mode: 'graze', wait: random() * FARM_KINDS[kind].graze, v: 0, gait: random(), big, look, body, shadow };
  };
  // The animal HUD's handles (animal-orders.mjs): each by its order kind ('cow' for the engine's 'cows').
  const orderKind = Object.fromEntries(Object.entries(FARM_ORDER_KINDS).map(([k, v]) => [v, k]));
  const handles = orderHandles(() => [['farm', animals]], { kindOf: (o) => orderKind[o.kind], remove: (o) => { try { o.body.destroy(); o.shadow.destroy(); } catch { /* gone */ } } });
  return {
    ...handles.api,
    // One put down by hand: `kind` 'cow', 'goat', 'sheep', 'pig' or 'horse', `id` to take it away by. False for any other kind.
    add(kind, { x, y, id }, random = Math.random) { const k = FARM_ORDER_KINDS[kind]; if (!k) return false; animals.push({ ...newAnimal(k, { x, y }, random), placed: id }); return true; },
    removeAdded(id) { animals = animals.filter((o) => { if (o.placed !== id) return true; try { o.body.destroy(); o.shadow.destroy(); } catch { /* gone */ } return false; }); },
    populate({ spots = [], grid: g = 100, size: s = 1, random = Math.random, ...wanted } = {}) {
      drop(); grid = g; size = Number(s) > 0 ? Number(s) : 1;
      if (!spots.length) return;
      for (const kind of Object.keys(FARM_KINDS)) {
        const n = Math.max(0, Math.round(Number(wanted[kind]) || 0)); if (!n) continue;
        // One herd round one place.
        const home = spots[Math.floor(random() * spots.length)];
        for (let i = 0; i < n; i++) {
          const near = spots.filter((p) => Math.hypot(p.x - home.x, p.y - home.y) < grid * 3), at = near.length ? near[Math.floor(random() * near.length)] : home;
          animals.push(newAnimal(kind, { x: at.x + (random() - 0.5) * grid * 0.6, y: at.y + (random() - 0.5) * grid * 0.6 }, random));
        }
      }
    },
    // `sound(kind, at, urgent)`: a herd's call now and then (kind 'cowCall', 'goatCall', 'sheepCall', 'pigCall', 'horseCall'), and one when startled.
    tick(seconds, { near = [], ok = () => true, blocked = () => false, seen = () => true, sound = null, random = Math.random, tokenAt = () => null } = {}) {
      if (!animals.length) return;
      const dt = Math.min(0.1, seconds), noise = noises.shift() ?? null, herds = {}; time += dt;
      for (const kind of Object.keys(FARM_KINDS)) herds[kind] = farmHerd(animals.filter((o) => o.kind === kind && !o.order));
      animals = animals.map((q) => {
        // Its HUD open: it stays put. Ordered (animal-orders.mjs): set on its way, away from its herd, not put off by people.
        if (handles.held(q)) return { ...q };
        const o = q.order ? orderPrep(orderKind[q.kind], q, orderAim(q.order, { tokenAt, grid, time, phase: q.orderPhase ?? 0, from: q }), { grid }) : q;
        const next = farmStep(o, { dt, grid, near: o.order ? [] : near, ok: (x, y) => ok(o.kind, x, y), blocked, herd: o.order ? null : herds[o.kind], noise: o.order ? null : noise });
        const k = FARM_KINDS[o.kind], scale = (k.squares * grid * 1.25 * size * (o.big ?? 1)) / k.h, moving = next.v > 2;
        const tex = moving ? next.look.walk[Math.floor(next.gait * 4) % 4] : next.look.graze;
        next.body.texture = tex; next.shadow.texture = tex;
        next.body.scale.set(scale); next.shadow.scale.set(scale * 1.02);
        next.body.position.set(next.x, next.y); next.shadow.position.set(next.x + grid * 0.06, next.y + grid * 0.08);
        const face = Number.isFinite(next.face) ? next.face : next.a; next.body.rotation = face; next.shadow.rotation = face;
        const shown = seen(next.x, next.y); next.body.visible = shown; next.shadow.visible = shown;
        if (sound && next.mode === 'flee' && o.mode !== 'flee') sound(FARM_CALLS[o.kind], { x: next.x, y: next.y }, true);
        return next;
      });
      // Now and then one of a herd calls: every half a minute to two minutes, a herd.
      if (sound) for (const kind of Object.keys(FARM_KINDS)) { const herd = animals.filter((o) => o.kind === kind); if (!herd.length) continue; calls[kind] = (calls[kind] ?? 30 + random() * 60) - dt; if (calls[kind] <= 0) { calls[kind] = 30 + random() * 90; const who = herd[Math.floor(random() * herd.length)]; sound(FARM_CALLS[kind], { x: who.x, y: who.y }, false); } }
    },
    noise({ x, y, radius }) { noises.push({ x, y, radius }); if (noises.length > 4) noises.shift(); },
    scare() { /* farm animals stay out in the rain */ },
    clear() { drop(); noises = []; },
    get busy() { return animals.length > 0; },
    get counts() { const out = {}; for (const kind of Object.keys(FARM_KINDS)) out[kind] = animals.filter((o) => o.kind === kind).length; return out; },
  };
}
