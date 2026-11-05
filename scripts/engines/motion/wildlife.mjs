// Life on the open ground by day: a hawk circling high up that now and then stoops on a rabbit, crows passing over, songbirds
// pecking about that burst into the air, rabbits that sit, hop and bolt, fish drifting in the water. Drawn once, seen from above, then only moved, turned and swapped; a few dozen small
// shapes on the CPU at most, and nothing drawn where nobody looks. Every screen has its own: nothing here is saved or shared.

const TAU = Math.PI * 2;
const between = (random, a, b) => a + random() * (b - a);

// ---- What they sound like (assets/sounds/wildlife, each folder's License.txt) ---------------------------------------------
const SOUND_DIR = 'modules/animater/assets/sounds/wildlife';
export const WILD_SOUNDS = Object.freeze({
  hawkCry: ['575524-0', '575524-1', '575524-2', '616926-0', '683743-0', '683743-1'].map((n) => `${SOUND_DIR}/hawk/hawk-${n}.ogg`),
  crowCaw: ['536732-0', '536732-1', '741366-0'].map((n) => `${SOUND_DIR}/crow/crow-${n}.ogg`),
  songChirp: ['165527-0', '165527-1', '570198-0', '570198-1'].map((n) => `${SOUND_DIR}/songbird/songbird-${n}.ogg`),
  wingsUp: ['651753-0', '701283-0', '19295-0', '19295-1'].map((n) => `${SOUND_DIR}/wings/wings-${n}.ogg`),
  rabbitThump: ['431204-0', '386007-1'].map((n) => `${SOUND_DIR}/thump/thump-${n}.ogg`),
  fishSplash: ['398039-0', '364700-0', '398032-0'].map((n) => `${SOUND_DIR}/splash/splash-${n}.ogg`),
  // A frog going in: hardly any wait, so each one of a group is heard.
  frogPlop: ['272392-0', '692839-0', '692839-1', '692839-2'].map((n) => `${SOUND_DIR}/splash/plop-${n}.ogg`),
  duckQuack: ['456770-0', '456770-1', '456770-2'].map((n) => `${SOUND_DIR}/duck/duck-${n}.ogg`),
  frogCroak: ['467958-0', '573584-0', '573584-1', '745965-0'].map((n) => `${SOUND_DIR}/frog/frog-${n}.ogg`),
  gullCry: ['538015-0', '538015-1', '538015-2', '538016-0', '538016-1', '538016-2'].map((n) => `${SOUND_DIR}/gull/gull-${n}.ogg`),
  owlHoot: ['450214-0', '450214-1', '558396-0', '558396-1'].map((n) => `${SOUND_DIR}/owl/owl-${n}.ogg`),
  cricketChirp: ['521129-0', '521129-1', '521129-2', '353073-0'].map((n) => `${SOUND_DIR}/cricket/cricket-${n}.ogg`),
  foxBark: ['546948-0', '546948-1'].map((n) => `${SOUND_DIR}/fox/fox-${n}.ogg`),
  dragonBuzz: ['447319-0', '447319-1', '447319-2'].map((n) => `${SOUND_DIR}/dragonfly/dragonfly-${n}.ogg`),
  // Town life (town-life.mjs).
  henCluck: ['233097-0', '724216-0'].map((n) => `${SOUND_DIR}/town/hen-${n}.ogg`),
  catMeow: ['110011-0', '584895-0', '584895-1'].map((n) => `${SOUND_DIR}/town/cat-${n}.ogg`),
  dogBark: ['277058-0', '832435-1'].map((n) => `${SOUND_DIR}/town/dog-${n}.ogg`),
  pigeonCoo: ['517683-0'].map((n) => `${SOUND_DIR}/town/pigeon-${n}.ogg`),
});
// How long each kind waits [least, most seconds] after it sounds, whatever their number (underground-sounds.mjs critterVoices).
export const WILD_GAPS = Object.freeze({ hawkCry: [18, 45], crowCaw: [0.9, 2.8], songChirp: [4, 10], wingsUp: [1.5, 3], rabbitThump: [6, 14], fishSplash: [5, 12], frogPlop: [0.08, 0.2], duckQuack: [3, 8], frogCroak: [3, 9], gullCry: [5, 14], owlHoot: [14, 40], cricketChirp: [1.2, 3.5], foxBark: [10, 30], dragonBuzz: [5, 12], henCluck: [2.5, 8], catMeow: [25, 70], dogBark: [6, 20], pigeonCoo: [5, 14] });
// One of a kind's recordings (pure), never the one just played when there are others.
const lastSound = {};
export function wildSound(kind, random = Math.random) {
  const files = WILD_SOUNDS[kind]; if (!files?.length) return null;
  let i = Math.floor(random() * files.length) % files.length;
  if (files.length > 1 && i === lastSound[kind]) i = (i + 1) % files.length;
  lastSound[kind] = i;
  return files[i];
}

// ---- What they do ------------------------------------------------------------------------------------------------------
// A loud noise (a blast, a cave-in, a big spell) reaching a place (pure): it spreads out from { x, y } at a run of squares a
// second, `t` seconds in, as far as `r` px, startling each creature as its front passes. The noise there now, or null.
export const NOISE_SPEED = 14;
export function noiseReaching(noises, x, y, { grid = 100 } = {}) {
  for (const n of noises) { const d = Math.hypot(n.x - x, n.y - y), front = n.t * NOISE_SPEED * grid; if (d <= n.r && d <= front && d > front - grid * 3) return n; }
  return null;
}

// A creature's shadow, as the creatures' own (main.mjs wildCast, movement-feel.mjs shadowFalls), looked up a few at a time and kept
// a moment on the creature (`fall` { dx, dy, alpha }): sun, moon and lamps change slowly against a rabbit's hop.
export const shadowKeeper = (cast, now, budget = 6) => (o, x, y, opts) => {
  if (!o.fall || (now >= (o.fallAt ?? 0) && budget-- > 0)) { o.fall = cast(x, y, opts) ?? { dx: 0, dy: 0, alpha: 0 }; o.fallAt = now + 0.35 + Math.random() * 0.2; }
  return o.fall;
};

// How much of a high flier shows over a walled room with no region or roof (pure), easing in and out; `was` what it was. Rooms with a
// region are cut out of the fliers' layer (main.mjs), as the weather is.
export const overOpen = (was, closed, dt) => Math.max(0, Math.min(1, (was ?? 1) + (closed ? -dt : dt) * 8));

// Which way to the nearest good ground from where it stands, looking further and further round; null if none is near.
export function wayOut(from, grid, ok) {
  for (const reach of [0.5, 1, 2, 4, 8]) for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; if (ok(from.x + Math.sin(a) * grid * reach, from.y - Math.cos(a) * grid * reach)) return a; }
  return null;
}

// How the walls divide the ground (pure), a square `cell` at a time: only the biggest stretch is the open air. `cells` the squares
// walled off from it. A square speaks only for what its middle can reach, and a wall may cut across it: `cellAt(x, y)` is the square
// a point really goes with, the next one when a wall parts it from its own middle, -1 for a pocket with no square's middle in it.
// `walls` [{ x1, y1, x2, y2 }]; `roofed` the squares to leave out, already closed.
export function closedGround({ cols, rows, cell, area, walls: given = [], roofed }) {
  const own = (x, y) => Math.floor((y - area.y) / cell) * cols + Math.floor((x - area.x) / cell);
  if (!given.length) return { cells: [], cellAt: own };
  const walls = given.map((w) => ({ ...w, a: Math.min(w.x1, w.x2), b: Math.max(w.x1, w.x2), c: Math.min(w.y1, w.y2), d: Math.max(w.y1, w.y2) }));
  const across = (w, ax, ay, bx, by) => { const s1 = (bx - ax) * (w.y1 - ay) - (by - ay) * (w.x1 - ax), s2 = (bx - ax) * (w.y2 - ay) - (by - ay) * (w.x2 - ax), s3 = (w.x2 - w.x1) * (ay - w.y1) - (w.y2 - w.y1) * (ax - w.x1), s4 = (w.x2 - w.x1) * (by - w.y1) - (w.y2 - w.y1) * (bx - w.x1); return s1 * s2 <= 0 && s3 * s4 <= 0; };
  const crosses = (ax, ay, bx, by) => { const minx = Math.min(ax, bx), maxx = Math.max(ax, bx), miny = Math.min(ay, by), maxy = Math.max(ay, by); for (const w of walls) { if (w.b < minx || w.a > maxx || w.d < miny || w.c > maxy) continue; if (across(w, ax, ay, bx, by)) return true; } return false; };
  const group = new Int32Array(cols * rows).fill(-1), sizes = [];
  for (let start = 0; start < group.length; start++) {
    if (roofed[start] || group[start] >= 0) continue;
    const id = sizes.length, queue = [start]; group[start] = id; let size = 0;
    while (queue.length) {
      const c = queue.pop(), i = c % cols, j = (c - i) / cols, ax = area.x + (i + 0.5) * cell, ay = area.y + (j + 0.5) * cell; size++;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue; const n = nj * cols + ni; if (roofed[n] || group[n] >= 0 || crosses(ax, ay, ax + di * cell, ay + dj * cell)) continue; group[n] = id; queue.push(n); }
    }
    sizes.push(size);
  }
  const biggest = sizes.indexOf(Math.max(...sizes)), cells = [];
  for (let c = 0; c < group.length; c++) if (group[c] >= 0 && group[c] !== biggest) cells.push(c);
  // Which walls run through which square, so that all the ground no wall touches is answered at once: this is asked every frame.
  const through = new Map();
  for (const w of walls) {
    const i0 = Math.max(0, Math.floor((w.a - area.x) / cell)), i1 = Math.min(cols - 1, Math.floor((w.b - area.x) / cell)), j0 = Math.max(0, Math.floor((w.c - area.y) / cell)), j1 = Math.min(rows - 1, Math.floor((w.d - area.y) / cell));
    const side = (x, y) => (w.x2 - w.x1) * (y - w.y1) - (w.y2 - w.y1) * (x - w.x1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = area.x + i * cell, y = area.y + j * cell, s = [side(x, y), side(x + cell, y), side(x, y + cell), side(x + cell, y + cell)];
      if (s.every((v) => v > 0) || s.every((v) => v < 0)) continue;
      const c = j * cols + i; if (through.has(c)) through.get(c).push(w); else through.set(c, [w]);
    }
  }
  const cellAt = (x, y) => {
    const c = own(x, y), here = through.get(c);
    if (!here) return c;
    const i = Math.floor((x - area.x) / cell), j = Math.floor((y - area.y) / cell), middle = (ni, nj) => [area.x + (ni + 0.5) * cell, area.y + (nj + 0.5) * cell];
    const [mx, my] = middle(i, j);
    if (!here.some((w) => across(w, x, y, mx, my))) return c;
    const round = [];
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ni = i + di, nj = j + dj; if ((di || dj) && ni >= 0 && nj >= 0 && ni < cols && nj < rows) { const [nx, ny] = middle(ni, nj); round.push({ n: nj * cols + ni, nx, ny, far: Math.hypot(nx - x, ny - y) }); } }
    round.sort((p, q) => p.far - q.far);
    for (const { n, nx, ny } of round) if (!crosses(x, y, nx, ny)) return n;
    return -1;
  };
  return { cells, cellAt };
}

// Ones a wall has just shut in (pure) go to open ground, the same creature picked up and set down; walls stop them, so they could
// never walk out. The rest are not touched. No `spots`: nowhere to send them, they stay.
export const resettled = (list, { spots = [], closed = () => false, random = Math.random } = {}) => list.map((o) => (spots.length && closed(o.x, o.y) ? { ...o, ...spots[Math.floor(random() * spots.length)] } : o));

// One step of a rabbit (pure): sits a while and looks about, hops a few times on open ground, bolts in long bounds from anyone
// near. `ok(x, y)` ground it can be on, looked at a body's length ahead so it stops on the bank, fleeing or not; `blocked(a, b)` a
// wall between. One that finds itself on the wrong ground (a region drawn under it) hops off. It faces `a` (0 up the map, clockwise).
export function rabbitStep(rabbit, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, scare = false, noise = null, random = Math.random } = {}) {
  const r = { ...rabbit }; r.wait -= dt;
  const close = noise ?? near.find((t) => Math.hypot(t.x - r.x, t.y - r.y) < grid * 3.2);
  if ((close || scare) && r.mode !== 'bolt') { r.mode = 'bolt'; r.bolts = 5 + Math.floor(random() * 4); r.hop = 0; r.a = close ? Math.atan2(r.x - close.x, -(r.y - close.y)) + between(random, -0.5, 0.5) : random() * TAU; }
  const moving = r.mode === 'bolt' || r.mode === 'hop';
  if (moving) {
    r.hop += dt / (r.mode === 'bolt' ? 0.3 : 0.42);
    if (r.hop >= 1) {
      r.hop = 0;
      if (r.mode === 'bolt') { r.bolts--; r.a += between(random, -0.3, 0.3); if (r.bolts <= 0) { r.mode = 'sit'; r.wait = between(random, 1.5, 4); } }
      else { r.hops--; if (r.hops <= 0) { r.mode = 'sit'; r.wait = between(random, 1.2, 5); } }
    }
    const speed = grid * (r.mode === 'bolt' ? 5.7 : 1.65) * Math.sin(r.hop * Math.PI), nx = r.x + Math.sin(r.a) * speed * dt, ny = r.y - Math.cos(r.a) * speed * dt;
    // A wall or the wrong ground ahead: it turns and goes on.
    if (blocked({ x: r.x, y: r.y }, { x: nx, y: ny }) || (!ok(nx + Math.sin(r.a) * grid * 0.2, ny - Math.cos(r.a) * grid * 0.2) && ok(r.x, r.y))) { r.a += Math.PI * between(random, 0.6, 1.4); if (r.mode === 'hop') { r.mode = 'sit'; r.hop = 0; r.wait = between(random, 0.6, 2); } }
    else { r.x = nx; r.y = ny; }
  } else if (r.wait <= 0) {
    const out = ok(r.x, r.y) ? null : wayOut(r, grid, ok);
    if (out !== null) { r.mode = 'hop'; r.hops = 4; r.hop = 0; r.a = out; }
    else if (random() < 0.55 || !ok(r.x, r.y)) { r.mode = 'hop'; r.hops = 1 + Math.floor(random() * 3); r.hop = 0; r.a += between(random, -1, 1); }
    else { r.a += between(random, -0.6, 0.6); r.wait = between(random, 0.8, 3); }
  }
  return r;
}

// One step of a songbird (pure): on the ground it pecks and takes small hops; anyone near sends it up, off and down again
// somewhere it can stand (`ok`; the flight goes on till it finds one, a while at most).
export function songStep(bird, { dt = 1 / 60, grid = 100, near = [], ok = () => true, blocked = () => false, barred = () => false, scare = false, noise = null, random = Math.random } = {}) {
  const s = { ...bird };
  if (s.mode === 'ground') {
    const close = noise ?? near.find((t) => Math.hypot(t.x - s.x, t.y - s.y) < grid * 2.4);
    if (close || scare) {
      const away = close ? Math.atan2(s.y - close.y, s.x - close.x) + between(random, -0.8, 0.8) : random() * TAU;
      return { ...s, mode: 'up', vx: Math.cos(away) * grid * 4, vy: Math.sin(away) * grid * 4, t: 0, flight: between(random, 1.6, 2.6), tries: 0, a: away + Math.PI / 2 };
    }
    s.wait -= dt; s.peck = Math.max(0, s.peck - dt);
    if (s.wait <= 0) {
      // On the wrong ground (the flock lands loosely round one spot): up and off to stand somewhere else.
      if (!ok(s.x, s.y)) { const away = random() * TAU; return { ...s, mode: 'up', vx: Math.cos(away) * grid * 4, vy: Math.sin(away) * grid * 4, t: 0, flight: between(random, 1.6, 2.6), tries: 0, a: away + Math.PI / 2 }; }
      if (random() < 0.6) s.peck = 0.18;
      else { s.a += between(random, -1, 1); const hop = between(random, grid * 0.04, grid * 0.13), nx = s.x + Math.sin(s.a) * hop, ny = s.y - Math.cos(s.a) * hop; if (ok(nx, ny) && !blocked({ x: s.x, y: s.y }, { x: nx, y: ny })) { s.x = nx; s.y = ny; } }
      s.wait = between(random, 0.25, 1.1);
    }
    return s;
  }
  s.t += dt;
  // Low enough that walls stop it, and it will not fly into a closed place (`barred`), though it may fly out of one.
  const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
  if (blocked({ x: s.x, y: s.y }, { x: nx, y: ny }) || (barred(nx, ny) && !barred(s.x, s.y))) { const turn = between(random, 2, 4.2), c = Math.cos(turn), n = Math.sin(turn), vx = s.vx * c - s.vy * n; s.vy = s.vx * n + s.vy * c; s.vx = vx; s.a = Math.atan2(s.vy, s.vx) + Math.PI / 2; }
  else { s.x = nx; s.y = ny; }
  const u = s.t / s.flight; s.h = Math.sin(Math.min(1, u) * Math.PI) * 0.6;
  if (u >= 1) {
    if (ok(s.x, s.y) || s.tries >= 3) { s.mode = 'ground'; s.h = 0; s.a = Math.atan2(s.vy, s.vx) + Math.PI / 2; s.wait = between(random, 0.6, 2); s.gone = !ok(s.x, s.y); }
    else { const turn = between(random, 1.5, 3.5), c = Math.cos(turn), n = Math.sin(turn), vx = s.vx * c - s.vy * n; s.vy = s.vx * n + s.vy * c; s.vx = vx; s.a = Math.atan2(s.vy, s.vx) + Math.PI / 2; s.t = s.flight * 0.5; s.tries++; }
  }
  return s;
}

// One step of a fish (pure): drifts, turning slowly, keeping to the water (`ok`); darts off from anyone close. It heads `a`
// (0 up the map, clockwise), and `dart` is the seconds of its dash left.
export function fishStep(fish, { dt = 1 / 60, grid = 100, near = [], ok = () => true, noise = null, random = Math.random } = {}) {
  const f = { ...fish }; f.wait -= dt; f.dart = Math.max(0, (f.dart ?? 0) - dt);
  const close = noise ?? near.find((t) => Math.hypot(t.x - f.x, t.y - f.y) < grid * 1.7);
  if (close && f.dart <= 0) { f.dart = 0.55; f.a = Math.atan2(f.x - close.x, -(f.y - close.y)) + between(random, -0.5, 0.5); f.turn = 0; }
  if (f.wait <= 0) { f.wait = between(random, 0.8, 3); f.turn = between(random, -0.9, 0.9); if (random() < 0.12) f.dart = 0.3; const out = ok(f.x, f.y) ? null : wayOut(f, grid, ok); if (out !== null) { f.a = out; f.turn = 0; f.dart = 0.3; } }
  f.a += (f.turn ?? 0) * dt;
  const speed = grid * (f.dart > 0 ? 2.6 : 0.28), nx = f.x + Math.sin(f.a) * speed * dt, ny = f.y - Math.cos(f.a) * speed * dt;
  if (ok(nx + Math.sin(f.a) * grid * 0.12, ny - Math.cos(f.a) * grid * 0.12) || !ok(f.x, f.y)) { f.x = nx; f.y = ny; } else { f.a += Math.PI * between(random, 0.7, 1.3); f.dart = 0; f.turn = 0; }
  return f;
}

// Which rabbit a hawk stoops on (pure): one on the ground that this screen can see, the nearest. null: none.
export function preyFor(from, rabbits = [], { seen = () => true } = {}) {
  let best = null, near = Infinity;
  for (const r of rabbits) { if (r.mode === 'bolt' || !seen(r.x, r.y)) continue; const d = Math.hypot(r.x - from.x, r.y - from.y); if (d < near) { near = d; best = r; } }
  return best;
}
// Whether the stoop takes it (pure): it must be under the talons as they arrive, and even then one in five gets away.
export const preyCaught = (at, rabbit, { grid = 100, luck = Math.random() } = {}) => Math.hypot(at.x - rabbit.x, at.y - rabbit.y) < grid * 0.55 && luck < 0.8;
// Whether a rabbit bolting now thumps (pure): a warning as it is first startled, not every run while it is being chased. `calm`
// the seconds since it last bolted.
export const thumpsNow = (calm) => calm > 8;

// Where the crows cross (pure): a loose group in from beyond one side of `area` { x, y, width, height } and out past the
// other, wherever its `way` (radians) takes it. Each { x, y, vx, vy, a, phase, size }.
export function crowFlock(area, way, { grid = 100, count = 6, random = Math.random } = {}) {
  const cx = area.x + area.width / 2, cy = area.y + area.height / 2, far = Math.hypot(area.width, area.height) / 2 + grid * 2, off = between(random, -0.3, 0.3) * Math.min(area.width, area.height);
  const ux = Math.cos(way), uy = Math.sin(way), sx = -uy, sy = ux, speed = grid * 3.4;
  return Array.from({ length: count }, (_, i) => {
    const rank = i - (count - 1) / 2, back = far + Math.abs(rank) * grid * 0.85 + between(random, 0, grid * 0.35), side = off + rank * grid * 0.55 + between(random, -0.15, 0.15) * grid;
    return { x: cx - ux * back + sx * side, y: cy - uy * back + sy * side, vx: ux * speed, vy: uy * speed, a: way + Math.PI / 2, phase: random() * 6, size: between(random, 0.85, 1) };
  });
}

// ---- How they look ------------------------------------------------------------------------------------------------------
const picture = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.translate(w / 2, h / 2); draw(x); return c; };
const speckle = (x, w, h, n, dark, light) => { x.save(); x.globalCompositeOperation = 'source-atop'; for (let i = 0; i < n; i++) { x.fillStyle = Math.random() < 0.5 ? dark : light; x.beginPath(); const a = Math.random() * TAU, r = Math.random(); x.ellipse(Math.cos(a) * r * w, Math.sin(a) * r * h, 0.4 + Math.random() * 0.8, 0.8 + Math.random() * 1.4, a, 0, TAU); x.fill(); } x.restore(); };
const HAWK = { top: '#8a6a48', wing: '#6d4f33', feather: '#7d5c3c', tip: '#2f2118', edge: 'rgba(30,20,12,0.45)', head: '#9c7d58', beak: '#35302a' };
const CROW = { top: '#2b2c33', wing: '#191a1f', feather: '#22232a', tip: '#0d0d10', edge: 'rgba(90,100,130,0.3)', head: '#1d1e23', beak: '#0b0b0c' };
const SONG = { top: '#a07d55', wing: '#6e5136', feather: '#7c5c3d', tip: '#392a1b', edge: 'rgba(30,20,12,0.4)', head: '#6b4c2e', beak: '#2b241c' };
const COATS = [['#8d7354', '#5e4a34', '#b89c78'], ['#7b7468', '#4c483f', '#a69f92'], ['#9a7d58', '#67503a', '#c4a881']];
const SPANS = [1, 0.9, 0.68, 0.42, 0.68, 0.9], SWINGS = [0, 0.6, 1, 0.6, 0, -0.6, -1, -0.6];
const SCALES = [['#2c3a36', '#59695c'], ['#3b3a2c', '#6b6a4d'], ['#34302e', '#65605a']];
// A flying bird from above, facing up: span 1 wings flat out, 0 pulled in on the downstroke.
function flyingBird(span, c) {
  return picture(160, 120, (x) => {
    for (const s of [-1, 1]) {
      const reach = 22 + 48 * span, lift = 6 * (1 - span), feathers = 8;
      for (let i = 0; i < feathers; i++) {
        const f = i / (feathers - 1), bx = s * (6 + (reach - 6) * (0.15 + 0.85 * f)), by = -6 + lift * f + 6 * f * f, len = 15 + 15 * Math.sin(f * 2.4) + 6 * f, ang = Math.PI / 2 + s * (-0.1 - 0.75 * f * f);
        x.save(); x.translate(bx, by); x.rotate(ang);
        const fg = x.createLinearGradient(0, 0, len, 0); fg.addColorStop(0, c.wing); fg.addColorStop(0.65, c.feather); fg.addColorStop(1, c.tip);
        x.fillStyle = fg; x.beginPath(); x.moveTo(0, -3.2); x.quadraticCurveTo(len * 0.7, -3.6, len, 0); x.quadraticCurveTo(len * 0.7, 3.2, 0, 3); x.closePath(); x.fill();
        x.strokeStyle = c.edge; x.lineWidth = 0.5; x.stroke(); x.restore();
      }
      const arm = new Path2D(); arm.moveTo(s * 3, -10); arm.quadraticCurveTo(s * (10 + reach * 0.5), -15 + lift, s * reach, -5 + lift); arm.quadraticCurveTo(s * (reach * 0.55), 3 + lift, s * 3, 5); arm.closePath();
      const ag = x.createLinearGradient(0, -14, 0, 6); ag.addColorStop(0, c.top); ag.addColorStop(1, c.wing); x.fillStyle = ag; x.fill(arm);
    }
    for (let i = -3; i <= 3; i++) { x.save(); x.translate(0, 10); x.rotate(i * 0.11); x.fillStyle = i % 2 ? c.feather : c.wing; x.beginPath(); x.ellipse(0, 12, 3, 13, 0, 0, TAU); x.fill(); x.fillStyle = c.tip; x.beginPath(); x.ellipse(0, 23, 2.6, 2.4, 0, 0, TAU); x.fill(); x.restore(); }
    const bg = x.createRadialGradient(-2, -6, 1, 0, 0, 15); bg.addColorStop(0, c.top); bg.addColorStop(1, c.wing); x.fillStyle = bg; x.beginPath(); x.ellipse(0, 1, 6.5, 14, 0, 0, TAU); x.fill();
    x.fillStyle = c.head; x.beginPath(); x.ellipse(0, -14, 4.6, 5.4, 0, 0, TAU); x.fill();
    x.fillStyle = c.beak; x.beginPath(); x.moveTo(-1.6, -18.6); x.lineTo(0, -22.6); x.lineTo(1.6, -18.6); x.closePath(); x.fill();
  });
}
// A songbird on the ground, wings folded, facing up (peck: head down).
function songbird(peck) {
  return picture(48, 48, (x) => {
    x.fillStyle = '#4a3a2a'; x.beginPath(); x.moveTo(-2.4, 7); x.lineTo(0, 17); x.lineTo(2.4, 7); x.closePath(); x.fill();
    const b = x.createRadialGradient(-1.5, -2, 1, 0, 1, 10); b.addColorStop(0, '#b08a5c'); b.addColorStop(1, '#7b5b3a'); x.fillStyle = b; x.beginPath(); x.ellipse(0, 1, 5.2, 8.6, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = '#5b4229'; x.beginPath(); x.moveTo(s * 1.5, -3); x.quadraticCurveTo(s * 6.5, 1, s * 2.2, 10); x.quadraticCurveTo(s * 1.2, 3, s * 1.5, -3); x.fill(); x.strokeStyle = 'rgba(225,200,160,0.5)'; x.lineWidth = 0.6; x.stroke(); }
    const hy = peck ? -11 : -8;
    x.fillStyle = '#6b4c2e'; x.beginPath(); x.ellipse(0, hy, 3.5, 3.9, 0, 0, TAU); x.fill();
    x.fillStyle = '#d9c8a5'; x.beginPath(); x.ellipse(0, hy - 0.6, 1.6, 2, 0, 0, TAU); x.fill();
    x.fillStyle = '#2b241c'; x.beginPath(); x.moveTo(-1, hy - 3.2); x.lineTo(0, hy - 6); x.lineTo(1, hy - 3.2); x.closePath(); x.fill();
  });
}
// A fish from above, heading up, its tail swinging with `swing` (-1 to 1): dark along the back, as it shows through water.
function fishPicture(swing, back, flank) {
  return picture(40, 72, (x) => {
    const tail = swing * 7;
    x.fillStyle = back; x.beginPath(); x.moveTo(-1.8, 18); x.quadraticCurveTo(tail * 0.5, 24, tail - 5.5, 32); x.lineTo(tail, 28); x.lineTo(tail + 5.5, 32); x.quadraticCurveTo(tail * 0.5, 24, 1.8, 18); x.closePath(); x.fill();
    for (const s of [-1, 1]) { x.fillStyle = flank; x.beginPath(); x.ellipse(s * 5.2, -4, 2, 5, s * -0.9, 0, TAU); x.fill(); }
    const body = new Path2D(); body.moveTo(0, -20); body.bezierCurveTo(5.5, -15, 5.2, 5, swing * 1.5, 20); body.bezierCurveTo(-5.2, 5, -5.5, -15, 0, -20);
    const g = x.createLinearGradient(-5, 0, 5, 0); g.addColorStop(0, flank); g.addColorStop(0.5, back); g.addColorStop(1, flank); x.fillStyle = g; x.fill(body);
  });
}

// A rabbit from above, facing up. pose 0 sitting, bunched; 1 gathered; 2 stretched out in a hop.
function rabbitPicture(pose, base, dark, light) {
  const long = [0, -3, 9][pose], w = [15, 15.5, 12][pose];
  return picture(96, 96, (x) => {
    x.fillStyle = dark; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(s * (w - 2), 15 + long, 4, pose === 2 ? 11 : 8, s * 0.2, 0, TAU); x.fill(); if (pose === 2) { x.beginPath(); x.ellipse(s * 5, -26 - long * 0.6, 2.2, 5, 0, 0, TAU); x.fill(); } }
    const body = new Path2D(); body.moveTo(0, -18 - long * 0.5); body.bezierCurveTo(w * 0.8, -18 - long * 0.5, w * 0.95, -2, w, 10 + long * 0.5); body.bezierCurveTo(w, 24 + long * 0.6, -w, 24 + long * 0.6, -w, 10 + long * 0.5); body.bezierCurveTo(-w * 0.95, -2, -w * 0.8, -18 - long * 0.5, 0, -18 - long * 0.5);
    const bg = x.createRadialGradient(-3, 2, 2, 0, 6, w * 1.7); bg.addColorStop(0, light); bg.addColorStop(0.55, base); bg.addColorStop(1, dark); x.fillStyle = bg; x.fill(body);
    x.save(); x.clip(body); speckle(x, w, 26 + long, 420, 'rgba(50,36,24,0.34)', 'rgba(230,210,180,0.26)'); x.restore();
    const tail = x.createRadialGradient(0, 24 + long * 0.7, 0.5, 0, 24 + long * 0.7, 6); tail.addColorStop(0, '#f6f1e6'); tail.addColorStop(1, 'rgba(220,210,190,0.75)'); x.fillStyle = tail; x.beginPath(); x.arc(0, 24 + long * 0.7, 5.6, 0, TAU); x.fill();
    const hy = -22 - long * 0.7, hg = x.createRadialGradient(-1.5, hy - 1, 1, 0, hy, 9); hg.addColorStop(0, light); hg.addColorStop(1, base); x.fillStyle = hg; x.beginPath(); x.ellipse(0, hy, 7, 8.6, 0, 0, TAU); x.fill();
    for (const s of [-1, 1]) {
      x.save(); x.translate(s * 3.2, hy + 2); x.rotate(s * (pose === 2 ? 0.1 : 0.32));
      x.fillStyle = dark; x.beginPath(); x.ellipse(0, 11, 3.3, 11.5, 0, 0, TAU); x.fill();
      x.fillStyle = '#c6a48c'; x.beginPath(); x.ellipse(0, 11, 1.7, 8.6, 0, 0, TAU); x.fill(); x.restore();
    }
    x.fillStyle = 'rgba(20,14,10,0.85)'; for (const s of [-1, 1]) { x.beginPath(); x.arc(s * 5.6, hy - 2, 1.1, 0, TAU); x.fill(); }
    x.fillStyle = '#d3b7a2'; x.beginPath(); x.ellipse(0, hy - 7.2, 1.5, 1.1, 0, 0, TAU); x.fill();
  });
}

// How much of the open-air life stays out in this weather (pure): all of it in a light shower, none in a downpour or a heavy snowfall. `rain`, `snow` 0-1.
export const weatherShelter = ({ rain = 0, snow = 0 } = {}) => { const k = Math.max(0, Math.min(1, (Math.max(rain, snow) - 0.35) / 0.35)); return 1 - k * k * (3 - 2 * k); };

/**
 * The layer: populate({ spots, rabbits, songbirds, hawk, crows, grid, area, rabbitSize, birdSize }) places them (`spots` open
 * ground { x, y }); tick(seconds, { near, ok(kind, x, y), blocked, seen(x, y), day (0–1, they come and go with it), sun
 * ({ x, y } the way shadows fall), wind (radians), view }); scare(); clear(). `floor()` under the creatures, `sky()` over all.
 */
export function createWildlife({ PIXI, floor, sky, skyShadow = floor }) {
  let fishWaters = [], fishScale = 1, fishLost = 0, fishIn = 0, noises = [], fish = [], spare = [], spareIn = 0, rabbits = [], songs = [], crows = [], hawk = null, grid = 100, area = null, rabbitSize = 1, birdSize = 1, wantCrows = 0, nextCrows = 8, time = 0, scared = 0, shown = 1, look = 0, textures = null;
  const art = () => {
    if (textures && !textures.hawk[0].baseTexture?.destroyed) return textures;
    const tex = (c) => PIXI.Texture.from(c);
    return (textures = { hawk: SPANS.map((s) => tex(flyingBird(s, HAWK))), crow: SPANS.map((s) => tex(flyingBird(s, CROW))), song: [false, true].map((p) => tex(songbird(p))), songFly: SPANS.map((s) => tex(flyingBird(s, SONG))), rabbit: COATS.map((c) => [0, 1, 2].map((p) => tex(rabbitPicture(p, ...c)))), fish: SCALES.map((c) => SWINGS.map((s) => tex(fishPicture(s, ...c)))) });
  };
  const sprite = (parent, tex, dark = false) => { const s = new PIXI.Sprite(tex); s.anchor.set(0.5); s.eventMode = 'none'; s.visible = false; if (dark) s.tint = 0x000000; parent.addChild(s); return s; };
  const pair = (bodyRoot, tex) => ({ shadow: sprite(floor(), tex, true), body: sprite(bodyRoot, tex) });
  // The high fliers' pair: on the layers kept out of a room seen into.
  const high = (tex) => ({ shadow: sprite(skyShadow(), tex, true), body: sprite(sky(), tex) });
  const dropPair = (o) => { try { o.view.body.destroy(); o.view.shadow.destroy(); } catch { /* gone */ } };
  const newFish = (t, i, random = Math.random) => { const w = fishWaters[Math.floor(random() * fishWaters.length)]; return { x: w.x + between(random, -0.3, 0.3) * grid, y: w.y + between(random, -0.3, 0.3) * grid, a: random() * TAU, wait: random() * 2, turn: 0, dart: 0, kind: i % SCALES.length, phase: random() * 8, beat: between(random, 3, 5), size: between(random, 0.75, 1.1) * fishScale, view: pair(floor(), t.fish[0][0]) }; };
  const drop = () => { for (const o of [...fish, ...rabbits, ...songs, ...crows, ...(hawk ? [hawk] : [])]) dropPair(o); try { hawk?.carry?.destroy(); } catch { /* gone */ } fish = []; spare = []; rabbits = []; songs = []; crows = []; hawk = null; };
  const put = (view, tex, x, y, angle, size, alpha, sx, sy, shadowAlpha, shadowSize = size) => {
    view.body.visible = view.shadow.visible = true;
    view.body.texture = tex; view.body.position.set(x, y); view.body.rotation = angle; view.body.scale.set(size); view.body.alpha = alpha;
    view.shadow.texture = tex; view.shadow.position.set(sx, sy); view.shadow.rotation = angle; view.shadow.scale.set(shadowSize); view.shadow.alpha = shadowAlpha * alpha;
  };
  const hide = (view) => { view.body.visible = view.shadow.visible = false; };
  return {
    populate({ waters = [], fish: nFish = 0, fishSize = 1, spots = [], rabbits: nRabbits = 0, songbirds = 0, hawk: hasHawk = false, crows: nCrows = 0, grid: g = 100, area: a = null, rabbitSize: rs = 1, birdSize: bs = 1, blocked = () => false, random = Math.random } = {}) {
      drop(); grid = g; area = a; rabbitSize = rs; birdSize = bs; wantCrows = nCrows; nextCrows = between(random, 5, 12); shown = 0;
      if (!spots.length && !hasHawk && !nCrows && !(waters.length && nFish)) return;
      const t = art(), at = () => spots[Math.floor(random() * spots.length)];
      spare = spots;
      fishWaters = waters; fishScale = fishSize; fishLost = 0;
      if (waters.length) fish = Array.from({ length: nFish }, (_, i) => newFish(t, i, random));
      if (spots.length) {
        rabbits = Array.from({ length: nRabbits }, (_, i) => ({ ...at(), a: random() * TAU, coat: i % COATS.length, wait: random() * 3, mode: 'sit', hop: 0, size: between(random, 0.9, 1.05), view: pair(floor(), t.rabbit[0][0]) }));
        // Songbirds keep together: a flock pecking about one place.
        const home = at(); songs = Array.from({ length: songbirds }, () => { const x = home.x + between(random, -1, 1) * grid * 0.85, y = home.y + between(random, -1, 1) * grid * 0.6, clear = !blocked(home, { x, y }); return { x: clear ? x : home.x, y: clear ? y : home.y }; }).map((p) => ({ ...p, a: random() * TAU, wait: random() * 2, peck: 0, mode: 'ground', vx: 0, vy: 0, h: 0, phase: random() * 6, view: pair(floor(), t.song[0]) }));
      }
      if (hasHawk && area) hawk = { cx: area.x + area.width * between(random, 0.3, 0.7), cy: area.y + area.height * between(random, 0.3, 0.7), r: Math.min(area.width, area.height) * 0.2, a: random() * TAU, mode: 'soar', huntIn: between(random, 40, 110), view: high(t.hawk[0]) };
    },
    // The walls changed: new places to come back to, and any shut in go there, the flock together.
    resettle({ spots = [], closed = () => false, random = Math.random } = {}) {
      spare = spots; rabbits = resettled(rabbits, { spots, closed, random });
      if (spots.length) songs = resettled(songs, { spots: [spots[Math.floor(random() * spots.length)]], closed, random });
    },
    // The rabbits to a fox: where they are; one startled by it (`from` where it springs); one taken, its picture given back.
    get list() { return rabbits; },
    spook(at, from) { const i = rabbits.findIndex((r) => Math.hypot(r.x - at.x, r.y - at.y) < grid * 0.3); if (i >= 0) rabbits[i] = { ...rabbits[i], mode: 'bolt', bolts: 5, hop: 0, a: Math.atan2(rabbits[i].x - from.x, -(rabbits[i].y - from.y)) + between(Math.random, -0.7, 0.7) }; },
    take(rabbit) { const r = rabbits.find((o) => o.view === rabbit.view); if (!r) return null; const tex = textures?.rabbit[r.coat][0]; rabbits = rabbits.filter((o) => o !== r); dropPair(r); spareIn = between(Math.random, 45, 120); return tex; },
    // The fish to whatever fishes (pond-life.mjs): where they are; one caught, its picture and size given back, and another swims up in a while.
    get fishList() { return fish; },
    takeFish(caught) { const f = fish.find((o) => o.view === caught.view); if (!f) return null; fish = fish.filter((o) => o !== f); dropPair(f); fishLost += 1; fishIn = between(Math.random, 45, 120); return { texture: textures?.fish[f.kind][0], size: f.size }; },
    scare() { scared = 0.3; },
    noise({ x, y, radius }) { noises.push({ x, y, r: radius, t: 0 }); },
    // Sends the hawk after a rabbit now, if there is one to see.
    hunt() { if (hawk?.mode === 'soar') hawk.huntIn = 0; return !!hawk; },
    tick(seconds, { near = [], ok = () => true, blocked = () => false, seen = () => true, day = 1, sun = { x: 0.62, y: 0.78 }, wind = 0.6, view = null, sound = () => {}, barred = () => false, indoors = () => false, cast = null } = {}) {
      if (!this.busy && !wantCrows) return;
      const dt = Math.min(0.05, seconds); time += dt; scared = Math.max(0, scared - dt);
      if (noises.length) { for (const n of noises) n.t += dt; noises = noises.filter((n) => n.t * NOISE_SPEED * grid < n.r + grid * 3); }
      const heard = (o) => (noises.length ? noiseReaching(noises, o.x, o.y, { grid }) : null);
      // They come out and go in with the daylight, never popping.
      shown += Math.max(-dt, Math.min(dt, (day - shown) * 2)); const alpha = Math.max(0, Math.min(1, shown));
      const t = art(), k = grid / 100, scare = scared > 0, fall = shadowKeeper(cast ?? (() => ({ dx: sun.x * grid * 0.03, dy: sun.y * grid * 0.03, alpha: 0.5 })), time);
      look -= dt; const looking = look <= 0; if (looking) look = 0.2;
      const inView = (x, y, m = grid) => !view || (x > view.x - m && y > view.y - m && x < view.x + view.w + m && y < view.y + view.h + m);
      const can = (o, x, y) => { if (looking) { try { o.seen = seen(x, y) !== false; } catch { o.seen = true; } } return o.seen !== false && inView(x, y) && alpha > 0.01; };
      if (alpha > 0.01) rabbits = rabbits.map((r0) => {
        const r = rabbitStep(r0, { dt, grid, near, blocked, scare, noise: heard(r0), ok: (x, y) => ok('rabbits', x, y) }); r.view = r0.view; r.seen = r0.seen;
        if (r.mode === 'bolt' && r0.mode !== 'bolt') { if (thumpsNow(time - (r0.boltAt ?? -Infinity))) sound('rabbitThump', r, false); r.boltAt = time; }
        if (!can(r, r.x, r.y)) { hide(r.view); return r; }
        const air = r.mode === 'sit' ? 0 : Math.sin(Math.min(1, r.hop) * Math.PI), frame = r.mode === 'sit' ? 0 : air > 0.45 ? 2 : 1, size = 0.58 * k * r.size * rabbitSize, off = grid * air * 0.06, c = fall(r, r.x, r.y, { width: grid * 0.4, body: 0.3, grounded: true });
        r.face = r0.face === undefined ? r.a : r0.face + Math.max(-dt * 10, Math.min(dt * 10, ((r.a - r0.face + Math.PI) % TAU + TAU) % TAU - Math.PI));
        put(r.view, t.rabbit[r.coat][frame], r.x, r.y - air * grid * 0.045, r.face, size * (1 + air * 0.05), alpha, r.x + c.dx + off * sun.x, r.y + c.dy + off * sun.y, Math.min(0.55, c.alpha * 0.6) * (1 - air * 0.3));
        return r;
      });
      if (alpha > 0.01) songs = songs.map((s0) => {
        const s = songStep(s0, { dt, grid, near, blocked, scare, noise: heard(s0), barred: (x, y) => barred('songbirds', x, y), ok: (x, y) => ok('songbirds', x, y) }); s.view = s0.view; s.seen = s0.seen;
        if (s.mode === 'up' && s0.mode === 'ground') sound('wingsUp', s, true); else if (s.mode === 'ground' && !s.gone && Math.random() < dt * 0.04) sound('songChirp', s, false);
        if (s.gone || !can(s, s.x, s.y)) { hide(s.view); return s; }
        if (s.mode === 'ground') { const size = 0.42 * k * birdSize, c = fall(s, s.x, s.y, { width: grid * 0.2, body: 0.12, grounded: true }); put(s.view, t.song[s.peck > 0 ? 1 : 0], s.x, s.y, s.a, size, alpha, s.x + c.dx, s.y + c.dy, Math.min(0.5, c.alpha * 0.55)); }
        else { const size = 0.2 * k * birdSize * (1 + s.h * 0.4), c = fall(s, s.x, s.y, { width: grid * 0.2, lift: 0.8 }), g = s.h / 0.6; put(s.view, t.songFly[Math.floor(time * 26 + s.phase) % SPANS.length], s.x, s.y, s.a, size, alpha, s.x + c.dx * g, s.y + c.dy * g, Math.min(0.35, c.alpha * 0.4), size * 0.95); s.shade = overOpen(s.shade, indoors(s.x + c.dx * g, s.y + c.dy * g), dt); s.view.shadow.alpha *= s.shade; }
        return s;
      });
      if (fish.length) {
        // Seen through the water, a little dim, and fainter still by night; they stay out when the rest go in.
        const fishAlpha = 0.28 + 0.4 * alpha;
        fish = fish.map((f0) => {
          const f = fishStep(f0, { dt, grid, near, noise: heard(f0), ok: (x, y) => ok('fish', x, y) }); f.view = f0.view; f.seen = f0.seen;
          // Only the dash from someone close breaks the surface.
          if (f.dart >= 0.5 && f0.dart <= 0) sound('fishSplash', f, false);
          if (looking) { try { f.seen = seen(f.x, f.y) !== false; } catch { f.seen = true; } }
          f.view.shadow.visible = false;
          if (f.seen === false || !inView(f.x, f.y)) { f.view.body.visible = false; return f; }
          const frames = t.fish[f.kind], beat = f.beat * (f.dart > 0 ? 4 : 1);
          f.view.body.visible = true; f.view.body.texture = frames[Math.floor(time * beat + f.phase) % frames.length]; f.view.body.position.set(f.x, f.y); f.view.body.rotation = f.a; f.view.body.scale.set(0.42 * k * f.size); f.view.body.alpha = fishAlpha;
          return f;
        });
      }
      if (fishLost > 0 && fishWaters.length && (fishIn -= dt) <= 0) { fish.push(newFish(t, fish.length)); fishLost -= 1; fishIn = between(Math.random, 45, 120); }
      // A rabbit taken: another comes along in a while.
      if (spareIn > 0 && (spareIn -= dt) <= 0 && spare.length) { const p = spare[Math.floor(Math.random() * spare.length)]; rabbits.push({ ...p, a: Math.random() * TAU, coat: Math.floor(Math.random() * COATS.length), wait: 2, mode: 'sit', hop: 0, size: between(Math.random, 0.9, 1.05), view: pair(floor(), t.rabbit[0][0]) }); }
      if (hawk) {
        const h = hawk, base = 0.62 * k * birdSize;
        let x = h.cx + Math.cos(h.a) * h.r, y = h.cy + Math.sin(h.a) * h.r * 0.8, angle = h.a + Math.PI, height = 1, frame = Math.floor(time * 1.4) % 7 === 0 ? Math.floor(time * 12) % SPANS.length : 0;
        if (h.mode === 'soar') {
          h.a += dt * 0.26; h.huntIn -= dt;
          if (day > 0.3 && Math.random() < dt * 0.06) sound('hawkCry', { x, y }, false);
          if (h.huntIn <= 0 && day > 0.5) {
            const prey = preyFor({ x, y }, rabbits, { seen: (a, b) => { try { return inView(a, b, 0) && seen(a, b) !== false; } catch { return false; } } });
            if (prey) { sound('hawkCry', { x, y }, true); h.mode = 'stoop'; h.t = 0; h.prey = prey; h.from = { x, y }; h.len = Math.min(2.2, 0.9 + Math.hypot(prey.x - x, prey.y - y) / (grid * 9)); h.warned = false; } else h.huntIn = between(Math.random, 8, 20);
          }
        } else if (h.mode === 'stoop') {
          h.t += dt / h.len; const prey = rabbits.find((r) => r === h.prey) ?? rabbits.find((r) => r.view === h.prey.view);
          if (prey) h.prey = prey;
          // Falling faster and faster, wings pulled in; the rabbit only sees it at the last moment.
          const u = Math.min(1, h.t), e = u * u, to = h.prey;
          x = h.from.x + (to.x - h.from.x) * e; y = h.from.y + (to.y - h.from.y) * e; height = 1 - e; angle = Math.atan2(to.y - h.from.y, to.x - h.from.x) + Math.PI / 2; frame = 3;
          if (u > 0.72 && !h.warned && prey) { h.warned = true; const r = rabbits.indexOf(prey); rabbits[r] = { ...prey, mode: 'bolt', bolts: 5, hop: 0, a: Math.random() * TAU }; h.prey = rabbits[r]; }
          if (u >= 1) {
            h.at = { x, y }; h.t = 0; h.mode = 'lift'; h.way = Math.random() * TAU; h.from = { x, y };
            if (prey && preyCaught({ x, y }, prey, { grid })) { rabbits = rabbits.filter((r) => r !== prey); dropPair(prey); h.carry = sprite(sky(), t.rabbit[prey.coat][0]); spareIn = between(Math.random, 45, 120); }
          }
        } else if (h.mode === 'lift') {
          // Up and away, beating hard; with a rabbit it carries it right off the map and comes back later.
          h.t += dt / (h.carry ? 5 : 2.4); const u = Math.min(1, h.t);
          if (h.carry) { const far = grid * 26; x = h.from.x + Math.cos(h.way) * far * u; y = h.from.y + Math.sin(h.way) * far * u; angle = h.way + Math.PI / 2; }
          else { const sx = h.cx + Math.cos(h.a) * h.r, sy = h.cy + Math.sin(h.a) * h.r * 0.8; x = h.from.x + (sx - h.from.x) * u; y = h.from.y + (sy - h.from.y) * u; angle = Math.atan2(sy - h.from.y, sx - h.from.x) + Math.PI / 2; }
          height = Math.min(1, u * 1.4); frame = Math.floor(time * 11) % SPANS.length;
          if (h.carry) { h.carry.visible = can(h, x, y); h.carry.position.set(x - Math.sin(angle) * base * 14, y + Math.cos(angle) * base * 14); h.carry.rotation = angle + Math.PI; h.carry.scale.set(0.42 * k * rabbitSize); h.carry.alpha = alpha; }
          if (u >= 1) { try { h.carry?.destroy(); } catch { /* gone */ } const went = !!h.carry; h.carry = null; h.mode = went ? 'away' : 'soar'; h.t = 0; h.huntIn = between(Math.random, 60, 180); }
        } else { h.t += dt; if (h.t > 25) h.mode = 'soar'; }
        // Lower is bigger, its shadow closing in beneath it until they meet.
        if (h.mode === 'away') hide(h.view);
        else if (can(h, x, y)) { const c = fall(h, x, y, { width: grid * 0.9, lift: 2.2 }); h.open = overOpen(h.open, indoors(x, y), dt); put(h.view, t.hawk[frame], x, y, angle, base * (1 + (1 - height) * 0.4), alpha * h.open, x + c.dx * height, y + c.dy * height, Math.min(0.45, c.alpha * (0.3 + (1 - height) * 0.25)), 0.72 * k * birdSize * (0.85 + 0.15 * height)); h.shade = overOpen(h.shade, indoors(x + c.dx * height, y + c.dy * height), dt); h.view.shadow.alpha *= h.shade; } else hide(h.view);
      }
      nextCrows -= dt;
      if (wantCrows > 0 && !crows.length && nextCrows <= 0 && area && day > 0.3) crows = crowFlock(area, wind, { grid, count: wantCrows }).map((c) => ({ ...c, view: high(t.crow[0]) }));
      if (crows.length) {
        // A flock going over: caws from one or another of them, and their wings when it is close overhead (the wings carry only a
        // little way, so they are heard as it passes, the caws swelling and fading with it).
        if (day > 0.3 && Math.random() < dt * 1.4) sound('crowCaw', crows[Math.floor(Math.random() * crows.length)], false);
        if (day > 0.3 && Math.random() < dt * 0.5) sound('wingsUp', crows[Math.floor(Math.random() * crows.length)], false);
        const far = area ? Math.hypot(area.width, area.height) / 2 + grid * 6 : Infinity, cx = area ? area.x + area.width / 2 : 0, cy = area ? area.y + area.height / 2 : 0;
        crows = crows.filter((c) => {
          c.x += c.vx * dt; c.y += c.vy * dt;
          if (Math.hypot(c.x - cx, c.y - cy) > far && (c.x - cx) * c.vx + (c.y - cy) * c.vy > 0) { dropPair(c); return false; }
          if (can(c, c.x, c.y)) { const f = fall(c, c.x, c.y, { width: grid * 0.6, lift: 1.1 }); c.open = overOpen(c.open, indoors(c.x, c.y), dt); put(c.view, t.crow[Math.floor(time * 9 + c.phase) % SPANS.length], c.x, c.y, c.a, 0.42 * k * birdSize * c.size, alpha * c.open, c.x + f.dx, c.y + f.dy, Math.min(0.32, f.alpha * 0.34), 0.46 * k * birdSize * c.size); c.shade = overOpen(c.shade, indoors(c.x + f.dx, c.y + f.dy), dt); c.view.shadow.alpha *= c.shade; } else hide(c.view);
          return true;
        });
        if (!crows.length) nextCrows = 9 + Math.random() * 12;
      }
    },
    clear() { drop(); wantCrows = 0; noises = []; },
    get busy() { return fish.length + rabbits.length + songs.length + crows.length + (hawk ? 1 : 0) > 0; },
    get counts() { return { fish: fish.length, rabbits: rabbits.length, songbirds: songs.length, crows: crows.length, hawk: hawk?.mode ?? null }; },
  };
}
