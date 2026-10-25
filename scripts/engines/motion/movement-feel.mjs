// Movement feel: each floor's own marks at a moving token's feet (grit, sawdust, dust, grass, sand spray, snow powder,
// ripples, ice glints, mud splatter, footprints), and a drop shadow under a flier. Pure logic: the
// floor under a point, where along a token's drawn path a stride falls, what each stride kicks up and how it ages.
// Foundry and PIXI come in as options; main.mjs and movement-feel-render.mjs supply them. Drawn on each client only.

// One puff every this many squares of travel.
export const STRIDE = 0.6;
export const FLOORS = Object.freeze(['stone', 'wood', 'dirt', 'grass', 'sand', 'snow', 'water', 'ice', 'mud']);
export const FLOOR_CHOICES = Object.freeze([
  ['', 'From the scene (auto)'], ['stone', 'Stone'], ['wood', 'Wood'], ['dirt', 'Dirt'], ['grass', 'Grass'],
  ['sand', 'Sand'], ['snow', 'Snow'], ['water', 'Water'], ['ice', 'Ice'], ['mud', 'Mud'],
]);
// The particle kinds movement-feel-render.mjs knows how to draw.
export const PARTICLE_KINDS = Object.freeze(['puff', 'ring', 'drop', 'scuff', 'chip', 'fleck', 'blade', 'tuft', 'streak', 'spark', 'crack', 'blob', 'print', 'groove', 'mound', 'wake', 'trample', 'hole']);
// What each floor kicks up per stride: a list of parts, each one particle kind thrown by one emitter.
//   emit 'burst': `count` bits thrown back from the foot in a cone (`cone` × π wide) at `speed` [min, max] squares/s,
//     jittered by `spread` squares; `align` turns each along its flight, else a random turn; `spin` (rad/s) tumbles
//     them; `hop` (squares) lifts them in an arc before they land. Low quality throws half.
//   emit 'foot': one mark at the foot (`back` squares behind it); `align` lays it along the heading; `sway` (rad)
//     bends it away and lets it spring back.
//   emit 'rings': `count` rings widening from the foot, `stagger` ms apart.
//   emit 'print': the creature's tracks (TRACKS, by its gait): footprints turned to the heading and sized by the
//     token's width, or a groove or smear along the path.
//   emit 'crack': a hairline crack on `chance` of strides.
//   emit 'trample': the floor pressed flat under the foot (left and right in turn, whatever the gait), laid along the
//     heading: `streaks` flattened blades in `color`, a couple in `light`; `spring` is how far it shrinks back as it
//     fades. Lasts like a print and shares the print budget.
// `size` is the radius in squares (prints and trample: in token widths), `life` ms, `grow` how much it swells (negative
// shrinks), `hold` the share of its life it stays at full strength before fading, `twinkle` flickers per life, `edge`
// a darker outline colour.
export const FLOOR_LOOK = Object.freeze({
  // Grey grit chips that hop out and settle, and a faint scuff.
  stone: { kind: 'grit', parts: [
    { kind: 'chip', emit: 'burst', colors: [0x7d7b76, 0x5f5d59, 0x9a9892], count: 5, alpha: 0.9, size: 0.03, life: 1000,
      speed: [0.12, 0.24], cone: 1.5, spread: 0.1, spin: 9, hop: 0.07, hold: 0.45, grow: 0 },
    { kind: 'scuff', emit: 'foot', color: 0x5a5a5a, alpha: 0.3, size: 0.1, life: 420, spread: 0.06, grow: 0.3 },
  ] },
  // Fine light sawdust drifting low, and a faint scuff.
  wood: { kind: 'sawdust', parts: [
    { kind: 'fleck', emit: 'burst', colors: [0xc9a877, 0xd8bc8e, 0xb08d5c], count: 6, alpha: 0.85, size: 0.035, life: 1300,
      speed: [0.05, 0.13], cone: 1.8, spread: 0.12, spin: 2, hold: 0.25, grow: 0 },
    { kind: 'scuff', emit: 'foot', color: 0x5a4630, alpha: 0.28, size: 0.1, life: 420, spread: 0.06, grow: 0.3 },
  ] },
  // A brown dust puff.
  dirt: { kind: 'dust', parts: [
    { kind: 'puff', emit: 'burst', color: 0x7a5c3a, count: 5, alpha: 0.55, size: 0.13, life: 750, speed: [0.18, 0.4], cone: 1.4, spread: 0.2, grow: [1.4, 2] },
  ] },
  // Bright yellow-green blades with a dark green edge (so they read on green map art) flicked up and back, a tuft at
  // the foot that bends and springs back, and the grass trampled flat under each foot: darker streaks along the
  // heading with a few lighter flattened blades, held about 2 s, then springing back up over about 4 s.
  grass: { kind: 'blades', parts: [
    { kind: 'blade', emit: 'burst', colors: [0xb4dc58, 0xc6e86c, 0xa2cf45], edge: 0x2a4a14, count: 7, alpha: 0.95, size: 0.05,
      life: 800, speed: [0.2, 0.36], cone: 1.2, spread: 0.14, spin: 10, hop: 0.12, hold: 0.3, grow: 0 },
    { kind: 'tuft', emit: 'foot', color: 0xa8d64e, edge: 0x2a4a14, alpha: 0.9, size: 0.13, life: 950, spread: 0.04, sway: 0.8, grow: 0 },
    { kind: 'trample', emit: 'trample', color: 0x3e5a24, light: 0xb8d47a, alpha: 0.55, size: 0.17, life: 6000, hold: 1 / 3,
      spring: 0.35, streaks: 7 },
  ] },
  // Low pale spray thrown backwards, and shallow footprints that fade over about 6 s.
  sand: { kind: 'spray', parts: [
    { kind: 'streak', emit: 'burst', color: 0xe3cc98, count: 6, alpha: 0.7, size: 0.07, life: 550, speed: [0.35, 0.55], cone: 0.7, spread: 0.08, align: true, grow: [0.4, 0.8] },
    { kind: 'print', emit: 'print', color: 0x9a7a45, alpha: 0.45, size: 0.11, life: 6000, hold: 0.35 },
  ] },
  // A white powder puff, and footprints that linger about 20 s.
  snow: { kind: 'powder', parts: [
    { kind: 'puff', emit: 'burst', color: 0xf3f6fa, count: 6, alpha: 0.7, size: 0.11, life: 850, speed: [0.12, 0.3], cone: 1.6, spread: 0.18, grow: [1.2, 1.8] },
    { kind: 'print', emit: 'print', color: 0xa9b8ca, alpha: 0.55, size: 0.11, life: 20000, hold: 0.6 },
  ] },
  // Ripples and droplets.
  water: { kind: 'ripple', parts: [
    { kind: 'ring', emit: 'rings', color: 0xd4e9f7, count: 2, alpha: 0.6, size: 0.28, life: 900, stagger: 160, grow: 1.6 },
    { kind: 'drop', emit: 'burst', color: 0xd4e9f7, count: 4, alpha: 0.65, size: 0.06, life: 900, speed: [0.18, 0.4], cone: 1.4, spread: 0.2, grow: 0.2 },
  ] },
  // Cold glints that twinkle out, a thin skid along the heading, and now and then a hairline crack.
  ice: { kind: 'glint', parts: [
    { kind: 'spark', emit: 'burst', colors: [0xffffff, 0xdff3ff, 0xc6e8ff], count: 4, alpha: 0.95, size: 0.05, life: 520, speed: [0.02, 0.06], cone: 2, spread: 0.22, twinkle: 2.5, grow: -0.7 },
    { kind: 'streak', emit: 'foot', color: 0xffffff, alpha: 0.55, size: 0.18, life: 700, back: 0.1, align: true, grow: 0.25 },
    { kind: 'crack', emit: 'crack', color: 0xe4f2ff, alpha: 0.8, size: 0.22, life: 2600, chance: 1 / 8, hold: 0.45, grow: 0 },
  ] },
  // Dark splatter flung short, and wet footprints that linger about 12 s.
  mud: { kind: 'splatter', parts: [
    { kind: 'blob', emit: 'burst', colors: [0x4a3420, 0x3b2a1a, 0x5a4128], count: 4, alpha: 0.8, size: 0.035, life: 850,
      speed: [0.1, 0.2], cone: 1.4, spread: 0.1, hop: 0.03, hold: 0.45, grow: 0.15 },
    { kind: 'print', emit: 'print', color: 0x2c1f13, alpha: 0.5, size: 0.11, life: 12000, hold: 0.55 },
  ] },
});
const isFloor = (value) => FLOORS.includes(value);

const OUTDOORS = /outdoor|outside|exterior|forest|woods|woodland|jungle|field|meadow|plain|prairie|road|path|trail|camp|village|town|city|street|market|square|farm|garden|desert|dune|beach|coast|shore|island|swamp|marsh|hill|mountain|cliff|valley|canyon|wilderness|grass|clearing|ruins|graveyard|cemetery|battlefield|bridge|river|lake|snow|tundra|winter/i;
// From the scene: global illumination, or a name or background path that sounds outdoors, is dirt; else stone.
export function autoFloor({ globalLight = false, name = '', background = '' } = {}) {
  if (globalLight) return 'dirt';
  return OUTDOORS.test(`${name ?? ''} ${background ?? ''}`) ? 'dirt' : 'stone';
}
export const sceneFloor = ({ flag, ...scene } = {}) => (isFloor(flag) ? flag : autoFloor(scene));

const WATERY = /water|river|lake|pond|sea|stream|swamp/i;
// A Region's own floor: its flag, else water when its name says so, else none (the scene floor shows through).
export function regionFloor({ name = '', flag } = {}) {
  if (isFloor(flag)) return flag;
  return WATERY.test(name ?? '') ? 'water' : null;
}
// The floor at a point: the last listed region that contains it and has a floor, else the scene's.
export function floorAt(point, { sceneFloor: base = 'stone', regions = [], testPoint }) {
  let found = null;
  for (const region of regions ?? []) {
    try {
      const floor = regionFloor(region);
      if (floor && testPoint(region, point)) found = floor;
    } catch { /* a broken region never breaks the floor */ }
  }
  return found ?? base;
}

const FLY = new Set(['fly', 'flying', 'hover', 'hovering', 'levitating']);
// Off the ground: moving by the fly movement action, or with a flying status. Height alone is not flight: a creature
// on a ledge, balcony or raised platform stands there.
export function isFlying({ action, statuses } = {}) {
  if (String(action ?? '').toLowerCase() === 'fly') return true;
  for (const status of statuses ?? []) if (FLY.has(String(status).toLowerCase())) return true;
  return false;
}

// A flier's shadow: an ellipse under its feet, pushed down-right (light from the top left) and shrunk and faded by
// height. `lift` is height above the floor in scene distance units; `width` the token's width in pixels.
export function shadowGeometry({ x, y, width, lift = 0, distance = 5, grid = 100 }) {
  // At its feet: a flat ellipse straight below the creature (centred left to right), mostly under its token with its
  // lower half showing past the bottom edge, so even opaque full-frame art shows it. The higher it flies, the further
  // down it falls and the smaller and fainter it gets.
  const h = Math.min(12, Math.max(0, Number(lift) || 0) / (distance || 5));
  const w = Number(width) || grid;
  const rx = w * Math.max(0.3, 0.42 - 0.01 * h);
  return { x, y: y + w * Math.min(0.6, 0.45 + 0.015 * h), rx, ry: rx * 0.4, alpha: Math.max(0.25, 0.55 - 0.025 * h) };
}

// Where along each token's drawn path a stride falls. The first stride after a stop or a jump is half long, so a short
// step still shows. A frame's move longer than `maxJump` (a teleport or instant move) resets without a stride.
export function createStrideTracker({ stride, maxJump }) {
  const states = new Map();
  const reset = (id, point) => { states.set(id, { x: point.x, y: point.y, left: stride / 2, index: states.get(id)?.index ?? 0 }); };
  const step = (id, point) => {
    const state = states.get(id);
    if (!state) { reset(id, point); return []; }
    const dx = point.x - state.x, dy = point.y - state.y, length = Math.hypot(dx, dy);
    if (length > maxJump) { reset(id, point); return []; }
    const out = [];
    if (length > 0) {
      const heading = Math.atan2(dy, dx);
      let travelled = 0;
      while (length - travelled >= state.left) {
        travelled += state.left;
        state.left = stride;
        const t = travelled / length;
        out.push({ x: state.x + dx * t, y: state.y + dy * t, heading, index: ++state.index });
      }
      state.left -= length - travelled;
      state.x = point.x; state.y = point.y;
    }
    return out;
  };
  return { step, reset, forget: (id) => states.delete(id), clear: () => states.clear(), has: (id) => states.has(id) };
}

// Same seed and stride index, same dust on every screen.
function rng(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const between = (range, r) => (Array.isArray(range) ? range[0] + (range[1] - range[0]) * r : (range ?? 0));
const round3 = (v) => Math.round(Math.max(-1, Math.min(1, v)) * 1000) / 1000;
// A hairline crack in unit space (-1..1): a jagged main line and one branch off it, as flat [x, y, ...] polylines.
function crackLines(random) {
  const main = [];
  for (let i = 0; i <= 5; i++) main.push(round3(-1 + i * 0.4), round3((random() - 0.5) * 0.6));
  const from = 2 + Math.floor(random() * 2), bx = main[from * 2], by = main[from * 2 + 1], dir = random() < 0.5 ? -1 : 1;
  const branch = [bx, by, round3(bx + 0.2 + random() * 0.2), round3(by + dir * (0.3 + random() * 0.2)),
    round3(bx + 0.35 + random() * 0.25), round3(by + dir * (0.55 + random() * 0.3))];
  return [main, branch];
}
// How each gait (creature-gait.mjs) marks soft floors. `feet`: 'biped' one print per stride, left and right in turn;
// 'quad' a front and a hind print per stride on one side, then the other (four prints per two strides, staggered);
// 'cluster' one cluster of tiny leg dots per stride; 'groove' a continuous wavy furrow, 'smear' a continuous wide
// smear (one segment per stride, no prints). `size` scales the print against the token's width; `tail` also drags
// a thin line between the prints. The renderer picks each print's shape by its `gait`.
export const TRACKS = Object.freeze({
  boots: { feet: 'biped', size: 1 },
  talons: { feet: 'biped', size: 1.05 },
  dragon: { feet: 'quad', size: 0.95, tail: true },
  paws: { feet: 'quad', size: 0.62 },
  padded: { feet: 'quad', size: 0.8 },
  webbed: { feet: 'quad', size: 0.7 },
  hooves: { feet: 'quad', size: 0.55 },
  claws: { feet: 'quad', size: 0.75, tail: true },
  legs: { feet: 'cluster', size: 1.5 },
  slither: { feet: 'groove' },
  ooze: { feet: 'smear' },
});
const mod = (n, m) => ((n % m) + m) % m;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// One stride's tracks for `gait` from a floor's print part. Big creatures print less often (a Huge one every other
// stride, a Gargantuan or bigger every third) with bigger prints; grooves and smears never break.
export function tracksFor(gait, part, base, at, { grid, width }) {
  // 'unknown' (a creature Animater cannot place, or a wheeled thing) and any other unlisted gait: no tracks at all.
  const track = TRACKS[gait], heading = at.heading ?? 0, index = at.index ?? 0;
  if (!track) return [];
  const across = heading + Math.PI / 2;
  const place = (d, a) => ({ x: at.x + Math.cos(heading) * d + Math.cos(across) * a, y: at.y + Math.sin(heading) * d + Math.sin(across) * a });
  // A furrow segment spanning the stride just walked, centred half a stride back; `amp` and `thick` in segment radii.
  const half = (grid * STRIDE) / 2;
  const segment = (shape, extra) => ({ ...base, kind: 'groove', gait: shape, color: part.color, ...place(-half, 0),
    radius: half * 1.08, rotation: heading, grow: 0, flip: mod(index, 2) ? 1 : -1, ...extra });
  if (track.feet === 'groove') return [segment('slither', { amp: clamp((0.1 * width) / half, 0.04, 0.5), thick: clamp((0.05 * width) / half, 0.02, 0.25) })];
  if (track.feet === 'smear') return [segment('ooze', { ry: clamp((0.32 * width) / half, 0.15, 1), alpha: part.alpha * 0.8 })];
  const out = [];
  if (track.tail) out.push(segment('claws', { amp: clamp((0.03 * width) / half, 0.01, 0.2), thick: clamp((0.025 * width) / half, 0.01, 0.12), alpha: part.alpha * 0.6 }));
  const squares = width / (grid || 100), every = squares >= 5 ? 3 : squares >= 3 ? 2 : 1;
  if (mod(index - 1, every)) return out;
  const step = Math.floor((index - 1) / every), side = mod(step, 2) ? 1 : -1;
  const print = (d, a, extra) => ({ ...base, color: part.color, ...place(d * width, a * width), radius: width * part.size * track.size,
    rotation: heading, grow: 0, gait, ...extra });
  if (track.feet === 'quad') out.push(print(0.16, 0.1 * side), print(-0.16, 0.13 * side, { hind: true }));
  else if (track.feet === 'cluster') out.push(print(0, 0.05 * side));
  else out.push(print(0, 0.12 * side));
  return out;
}

// What one stride kicks up at `at` ({x, y, heading, index}): particle specs in canvas pixels, ages in milliseconds,
// turns in radians. `width` is the token's width in pixels (prints are sized and spaced by it).
// `gait` (creature-gait.mjs) shapes the tracks: boots by default; 'unknown' raises the floor's dust (and tramples
// grass) but leaves no tracks; 'none' (incorporeal) leaves nothing at all, not even dust.
export function puffsFor(floor, at, { seed = '', grid = 100, density = 1, width = grid, gait = 'boots' } = {}) {
  const look = FLOOR_LOOK[floor] ?? FLOOR_LOOK.stone;
  if (!(density > 0) || gait === 'none') return [];
  const index = at.index ?? 0, heading = at.heading ?? 0, back = heading + Math.PI, out = [];
  // The creature's size: its floor marks grow with it (a Huge splash, a Tiny one's little puff) and its spray flies a
  // little further; a big creature covers several strides per step, so it bursts every other stride (Large and Huge)
  // or every third (Gargantuan), as its prints and footsteps do. Prints and trampled grass are sized by their own rules.
  const body = clamp((Number(width) || grid) / (grid || 100), 0.4, 8);
  const grow = Math.pow(body, 0.85), reach = Math.sqrt(body);
  const every = body >= 5 ? 3 : body >= 2 ? 2 : 1, bursts = !mod(index - 1, every);
  const unit = grid * grow;
  look.parts.forEach((part, n) => {
    if (!bursts && part.emit !== 'print' && part.emit !== 'trample') return;
    // Each part draws from its own seeded stream, so one part's chance never shifts another's dust.
    const random = rng(`${seed}:${index}:${floor}:${n}`);
    const pick = () => (part.colors ? part.colors[Math.floor(random() * part.colors.length) % part.colors.length] : part.color);
    const base = { kind: part.kind, vx: 0, vy: 0, alpha: part.alpha, delay: 0, life: part.life, rotation: 0, spin: 0, grow: between(part.grow, 0.5) };
    if (part.hold) base.hold = part.hold;
    const jitter = () => (random() - 0.5) * unit * (part.spread ?? 0);
    if (part.emit === 'rings') {
      for (let i = 0; i < (part.count ?? 1); i++) out.push({ ...base, color: part.color, x: at.x, y: at.y,
        radius: unit * (part.size + 0.08 * i), alpha: part.alpha * (1 - 0.35 * i), delay: i * (part.stagger ?? 0) });
    } else if (part.emit === 'foot') {
      const x = at.x + Math.cos(back) * unit * (part.back ?? 0) + jitter(), y = at.y + Math.sin(back) * unit * (part.back ?? 0) + jitter();
      const spec = { ...base, color: pick(), x, y, radius: unit * part.size, rotation: part.align ? heading : 0 };
      if (part.sway) spec.sway = part.sway * (index % 2 ? 1 : -1);
      if (part.edge) spec.edge = part.edge;
      out.push(spec);
    } else if (part.emit === 'trample') {
      // Under the foot that just landed, left and right in turn; every walker presses the floor, whatever its gait.
      const across = heading + Math.PI / 2, off = width * 0.12 * (index % 2 ? 1 : -1);
      // Each streak [x, y, length, tilt, light] in unit space: a flattened blade along +x (the heading).
      const blades = Array.from({ length: part.streaks ?? 7 }, (_, i) => [round3((random() - 0.5) * 1.2), round3((random() - 0.5) * 0.9),
        round3(0.45 + random() * 0.4), round3((random() - 0.5) * 0.5), i % 3 === 1 ? 1 : 0]);
      out.push({ ...base, color: part.color, light: part.light, x: at.x + Math.cos(across) * off, y: at.y + Math.sin(across) * off,
        radius: width * part.size, rotation: heading, grow: 0, spring: part.spring ?? 0, lasting: true, blades });
    } else if (part.emit === 'print') {
      out.push(...tracksFor(gait, part, base, at, { grid, width }));
    } else if (part.emit === 'crack') {
      if (random() >= (part.chance ?? 1)) return;
      out.push({ ...base, color: part.color, x: at.x, y: at.y, radius: unit * part.size * (0.8 + random() * 0.4),
        rotation: heading + (random() - 0.5) * 1.2, points: crackLines(random) });
    } else {
      const count = Math.max(1, Math.round((part.count ?? 1) * Math.min(1, density)));
      for (let i = 0; i < count; i++) {
        const angle = back + (random() - 0.5) * Math.PI * (part.cone ?? 1.4), speed = grid * reach * between(part.speed ?? [0.18, 0.4], random());
        const spec = {
          ...base, color: pick(), x: at.x + jitter(), y: at.y + jitter(),
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          radius: unit * part.size * (0.7 + random() * 0.6), alpha: part.alpha * (0.75 + random() * 0.25),
          grow: between(part.grow, random()), delay: Math.round(random() * 60),
          life: Math.round(part.life * (0.8 + random() * 0.4)),
          rotation: part.align ? angle : random() * Math.PI * 2, spin: (random() - 0.5) * 2 * (part.spin ?? 0),
        };
        if (part.hop) spec.hop = unit * part.hop * (0.6 + random() * 0.8);
        if (part.twinkle) spec.twinkle = part.twinkle * (0.8 + random() * 0.4);
        if (part.edge) spec.edge = part.edge;
        out.push(spec);
      }
    }
  });
  return out;
}

// A hopping bit lands this far through its life, then lies still and fades.
const LAND = 0.35;
// One particle `age` ms after it was kicked up: where it is, how big, how faint and how turned; null once it is gone.
export function particleState(p, age) {
  if (age > p.delay + p.life) return null;
  const turn = p.rotation ?? 0;
  if (age < p.delay) return { x: p.x, y: p.y, scale: 1, alpha: 0, rotation: turn };
  const t = (age - p.delay) / p.life, ease = 1 - (1 - t) * (1 - t);
  // A hopper travels (and tumbles) only until it lands; everything else slows to a stop over its life.
    const motionLife=p.motionLife??p.life,motionT=Math.min(1,(age-p.delay)/motionLife);
    const u = p.hop ? Math.min(1, motionT / LAND) : motionT, travel = 1 - (1 - u) * (1 - u), seconds = (motionLife * travel) / 1000;
  const lift = p.hop ? p.hop * 4 * u * (1 - u) : 0;
  const fade = p.hold ? Math.max(0, (t - p.hold) / (1 - p.hold)) : t;
  let alpha = p.alpha * Math.pow(1 - fade, 1.5);
  if (p.twinkle) alpha *= 0.6 + 0.4 * Math.cos(2 * Math.PI * p.twinkle * t);
  let rotation = turn + (p.spin ?? 0) * seconds;
  // A bent tuft springs back: a damped swing back to upright.
  if (p.sway) rotation += p.sway * Math.exp(-4 * t) * Math.cos(3 * Math.PI * t);
  // Trampled grass springs back up as it fades: the flattened patch shrinks by `spring` of its size.
  const scale = (1 + p.grow * ease) * (p.spring ? 1 - p.spring * fade : 1);
  return { x: p.x + p.vx * seconds, y: p.y + p.vy * seconds - lift, scale, alpha, rotation };
}

// Balanced and above draw every puff; Low draws half; Off none.
export const movementDensity = (rank) => (rank >= 2 ? 1 : rank >= 1 ? 0.5 : 0);

// Footsteps: every floor has its own bundled CC0 steps (Freesound recordings and Kenney's snow steps, credited in
// assets/sounds/surfaces/*/License.txt), no two floors sharing a recording. PSFX's outdoor steps are earth steps, so
// they replace the bundled dirt steps whenever PSFX is active; every other floor keeps its own family.
const PSFX_FLOORS = new Set(['dirt']);
const SURFACES = 'modules/animater/assets/sounds/surfaces';
const freesound = (names) => names.map((name) => `${SURFACES}/freesound/${name}.ogg`);
// Each one a single footfall on that very floor (docs/footstep-audit.md has the sources and the measurements).
export const FOOTSTEP_FILES = Object.freeze({
  stone: freesound(['stone-step-197778-0', 'stone-step-197779-0', 'stone-step-197780-0', 'stone-step-637555-0', 'stone-step-637555-1']),
  wood: freesound(['wood-step-485421-0', 'wood-step-485421-1', 'wood-step-485421-2', 'wood-step-405115-0', 'wood-step-405115-1']),
  grass: freesound(['grass-step-852212-0', 'grass-step-852212-1', 'grass-step-488074-0', 'grass-step-390760-0']),
  dirt: freesound(['dirt-step-487862-0', 'dirt-step-487864-0', 'dirt-step-487869-0', 'dirt-step-353799-1', 'dirt-step-353799-2']),
  snow: [0, 1, 2, 3, 4].map((i) => `${SURFACES}/kenney/snowstep_00${i}.ogg`),
  sand: freesound(['sand-step-164459-1', 'sand-step-164459-2', 'sand-step-164459-3', 'sand-step-164459-4']),
  water: freesound(['water-step-861369-0', 'water-step-861369-1', 'water-step-861369-2', 'water-step-861369-3']),
  mud: freesound(['mud-step-488068-0', 'mud-step-349082-0', 'mud-step-349082-1', 'mud-step-349082-2']),
  ice: freesound(['ice-step-732880-0', 'ice-step-732880-1', 'ice-step-732880-2', 'ice-step-732880-3', 'ice-step-416939-0']),
});
// Which of `count` recordings the `n`th step plays: a seeded shuffle that never repeats the step before it, so a walk
// does not cycle 1-2-3-4-5 and two tokens walking side by side do not step in unison. Same on every screen.
function stepIndex(count, n, seed) {
  if (count <= 1) return 0;
  if (count === 2) return n % 2;
  // Every `count` steps play each recording once, in a seeded order (a shuffled deck per block); a block never
  // starts with the recording the block before it ended on.
  const deck = (b) => {
    const random = rng(`${seed}:deck:${b}`), order = Array.from({ length: count }, (_, i) => i);
    for (let i = count - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return order;
  };
  const block = Math.floor(n / count), at = n % count, order = deck(block);
  if (block > 0 && order[0] === deck(block - 1)[count - 1]) [order[0], order[1]] = [order[1], order[0]];
  return order[at];
}
// The `n`th step on `floor` by the token `seed`; unknown floors step like stone.
export function footstepFile(floor, n, { psfx = false, seed = '' } = {}) {
  const i = Math.abs(Math.trunc(Number(n) || 0));
  if (psfx && PSFX_FLOORS.has(floor)) {
    const pick = stepIndex(16, i, `${seed}:psfx`), set = `00${(pick % 2) + 1}`, step = Math.floor(pick / 2) % 8;
    return `modules/psfx/library/creature/movement/footsteps/outdoors/${set}/footsteps-single-outdoors-${set}-0${step}.ogg`;
  }
  const key = FOOTSTEP_FILES[floor] ? floor : 'stone', files = FOOTSTEP_FILES[key];
  return files[stepIndex(files.length, i, `${seed}:${key}`)];
}
// Creature steps: each kind of creature (creature-gait.mjs creatureGait) steps with its own feet, not a person's shoes.
// Bundled Freesound recordings, one contact each. Credits and licenses accompany the surface and reviewed-creature
// asset folders. Where the floor changes the foot's sound there are variants:
// Exact floor variants (such as wooden hoof contacts) take priority; otherwise 'hard' for stone, wood and ice,
// 'soft' for dirt, grass, sand and snow, 'wet' for mud and water (else soft), or 'any'. Shared contacts on wood get
// their own material response instead of sounding identical to stone.
//   dragon  a monster's heavy padded tread on soft ground.
//   talons  a pigeon's claws on parquet; a small bird's feet in sand; a duck's wet steps in mud and water.
//   ooze    a slime's squelch (a gelatinous cube, slime slaps, a slime monster's footfall).
//   legs    a spider's or an insect's quick tapping legs.
// A family needs at least three distinct cuts. Paws use direct dog contacts; hooves distinguish stone contacts from
// muted soft-pad foley. Reptile claws use the lighter paw contacts rather than a dragon's heavy tread. Forest-soil
// slithers use soil on dirt/grass and separate hard, wet, sand and snow textures, never a shoe layer.
const reviewed = (names) => names.map((name) => `modules/animater/assets/sounds/creatures/reviewed/${name}.ogg`);
const completed = (family, variant, id) => [0, 1, 2].map((n) => `modules/animater/assets/sounds/creatures/completed/${family}-${variant}-${id}-${n}.ogg`);
export const GAIT_STEP_FILES = Object.freeze({
  paws: { hard: reviewed(['paws-hard-672734-0', 'paws-hard-672734-1', 'paws-hard-689178-0', 'paws-hard-689178-1', 'paws-hard-689178-2', 'paws-hard-689178-3']) },
  padded: { any: completed('padded', 'any', 427973) },
  webbed: { any: completed('webbed', 'any', 262588) },
  hooves: {
    hard: reviewed(['hooves-hard-843303-0', 'hooves-hard-843303-1', 'hooves-hard-843303-2', 'hooves-hard-843303-3']),
    wood: [0, 1, 2, 3].map((n) => `modules/animater/assets/sounds/creatures/wood/hooves-wood-187610-${n}.ogg`),
    soft: reviewed(['hooves-soft-581833-0', 'hooves-soft-581833-1', 'hooves-soft-581833-2', 'hooves-soft-581833-3']),
  },
  dragon: {
    hard: reviewed(['dragon-hard-192365-0', 'dragon-hard-192365-1', 'dragon-hard-192365-2', 'dragon-hard-192365-3']),
    soft: freesound(['dragon-step-712066-0', 'dragon-step-712066-1', 'dragon-step-712066-2', 'dragon-step-712066-3']),
  },
  slither: {
    forest: reviewed(['slither-forest-774143-0', 'slither-forest-774143-1', 'slither-forest-774143-2']),
    hard: completed('slither', 'hard', 82723),
    wet: completed('slither', 'wet', 677289),
    sand: completed('slither', 'sand', 389611),
    snow: completed('slither', 'snow', 420634),
  },
  talons: {
    hard: freesound(['talons-step-611105-0', 'talons-step-611105-1', 'talons-step-611105-2', 'talons-step-611105-3', 'talons-step-611105-4']),
    soft: freesound(['talons-step-851733-0', 'talons-step-851733-1', 'talons-step-851733-2', 'talons-step-851733-3', 'talons-step-851733-4']),
    wet: freesound(['talons-step-409371-0', 'talons-step-409371-1', 'talons-step-409371-2', 'talons-step-409371-3']),
  },
  ooze: { any: freesound(['ooze-step-837146-0', 'ooze-step-837146-1', 'ooze-step-528263-0', 'ooze-step-794272-0', 'ooze-step-794272-1']) },
  legs: { any: freesound(['legs-step-828623-0', 'legs-step-828623-1', 'legs-step-828623-2']) },
});
// The fewest recordings a family (or variant) needs to be used: fewer would repeat audibly.
export const MIN_FAMILY_FILES = 3;
const GAIT_FAMILY = { dragon: 'dragon', claws: 'paws', paws: 'paws', padded: 'padded', webbed: 'webbed', hooves: 'hooves', talons: 'talons', ooze: 'ooze', legs: 'legs', slither: 'slither' };
const SILENT_GAITS = new Set(['none']);
const FOREST_FLOORS = new Set(['dirt', 'grass']);
const HARD_FLOORS = new Set(['stone', 'wood', 'ice']);
const WET_FLOORS = new Set(['mud', 'water']);
// Floors whose own sound is part of any footfall on them: a hoof in mud squelches, a paw in snow crunches. That floor's
// step plays under the creature's, at this share of its level and the same pitch.
const UNDER_GAIN = { mud: 0.5, water: 0.55, snow: 0.4, sand: 0.35 };
// A hard-floor family stepping on soft or wet ground (paws have no soft recordings): its click muffled into the ground.
const MUFFLED_LOWPASS = 1400;
const floorVariant = (floor) => (HARD_FLOORS.has(floor) ? 'hard' : WET_FLOORS.has(floor) ? 'wet' : 'soft');
// The `n`th step of a creature with `gait` on `floor` by the token `seed`: { file, under?, underGain?, lowpass? }, or
// null for a creature that makes no step sound. Boots and unknown feet step as people do (footstepFile); every other
// gait plays its own family (the floor's variant, the same seeded no-repeat order), with the floor's own step `under`
// it on mud, water, snow and sand.
export function gaitStep(gait, floor, n, { seed = '', psfx = false } = {}) {
  if (SILENT_GAITS.has(gait)) return null;
  const family = GAIT_STEP_FILES[GAIT_FAMILY[gait]] ?? {};
  const usable = (v) => (family[v]?.length ?? 0) >= MIN_FAMILY_FILES;
  const i = Math.abs(Math.trunc(Number(n) || 0)), want = gait === 'slither'
    ? FOREST_FLOORS.has(floor) ? 'forest' : ['sand', 'snow'].includes(floor) ? floor : floorVariant(floor)
    : floorVariant(floor);
  // The floor's own variant; wet floors fall back to soft, soft floors to the hard recordings muffled; anything else
  // (no family, or too few recordings) steps as people do.
  const variant = usable(floor) ? floor : usable('any') ? 'any' : usable(want) ? want : want === 'wet' && usable('soft') ? 'soft' : want !== 'hard' && usable('hard') ? 'hard' : null;
  if (!variant) return gait === 'slither' ? null : { file: footstepFile(floor, n, { psfx, seed }) };
  const files = family[variant];
  const out = { file: files[stepIndex(files.length, i, `${seed}:${GAIT_FAMILY[gait]}:${variant}`)] };
  if (variant === 'hard' && want !== 'hard') out.lowpass = MUFFLED_LOWPASS;
  // Exact material recordings win. Shared creature contacts still need a wooden floor's warmer, duller response;
  // otherwise paws, claws and padded feet would sound byte-for-byte identical on wood and stone.
  if (floor === 'wood' && variant !== 'wood') Object.assign(out, { lowpass: 2800, bass: 2.5, gain: 0.85 });
  // The creature supplies its foot contact; soft ground supplies its own physical texture, never a shoe sample.
  // Shared soft contacts alone made grass and dirt identical. Vegetation cushions and rustles; soil scrapes.
  if (floor === 'grass' && variant !== 'grass') {
    const brush = bodyStep('foliage', i, { seed: `${seed}:ground` });
    out.texture = { file: brush.file, gain: 0.4, peakMs: brush.peakMs };
    out.lowpass = Math.min(out.lowpass ?? Infinity, 1100);
  } else if (floor === 'dirt' && variant !== 'dirt' && gait !== 'slither') {
    const soil = GAIT_STEP_FILES.slither.forest, index = stepIndex(soil.length, i, `${seed}:ground:dirt`);
    out.texture = { file: soil[index], gain: 0.3, peakMs: [85, 146, 93][index] };
  }
  // A sliding texture already includes the ground; adding a shoe step would turn a snake into a walker.
  const underGain = gait === 'slither' ? null : UNDER_GAIN[floor];
  if (underGain) Object.assign(out, { under: footstepFile(floor, i, { psfx, seed }), underGain });
  return out;
}
export const gaitStepFile = (gait, floor, n, opts) => gaitStep(gait, floor, n, opts)?.file ?? null;
// Body sounds (creature-gait.mjs creatureBody): what a creature's body adds to each stride. Bone, metal, stone and plant
// bodies layer a quieter sound on the step; water, fire and air bodies do not step at all, so their slosh, flame or gust
// replaces the step. Bundled CC0 Freesound recordings, one event each, measured like the steps (docs/footstep-audit.md),
// credited in freesound/License.txt.
//   bone   dry bones clattering (claves and a hollow wooden flute, recorded as desiccated bones collapsing).
//   metal  an armour helmet's clanks and metal clanks.
//   stone  a cinder block dragged over another, a rock sliding on concrete.
//   plant  wood creaking for woody bodies.   foliage  short bush brushes for leafy bodies.
//   water  water sloshing in a studio tank and a watering can.
//   fire   a flame flaring, a burst of flame, a spray-can fire burst.
//   air    a gust (a thin board flapped through the air) and a light air whoosh.
const bodyFiles = (body, names) => freesound(names.map((n) => `body-${body}-${n}`));
export const BODY_STEP_FILES = Object.freeze({
  bone: bodyFiles('bone', ['837032-0', '837032-1', '837032-2', '837032-3', '837032-4']),
  metal: bodyFiles('metal', ['675817-0', '675817-1', '675817-2', '675817-3', '545547-0', '545547-1']),
  stone: bodyFiles('stone', ['530990-0', '530990-1', '530990-2', '530990-3', '799521-0']),
  plant: bodyFiles('plant', ['572645-0', '618085-0', '802576-0']),
  foliage: reviewed(['foliage-any-106114-0', 'foliage-any-106114-1', 'foliage-any-106114-2']),
  water: bodyFiles('water', ['166313-0', '166313-1', '166313-2', '166313-3', '841151-0', '841151-1']),
  fire: bodyFiles('fire', ['530355-0', '539972-0', '166553-0']),
  air: bodyFiles('air', ['792292-0', '792292-1', '792292-2', '792292-3', '792292-4', '701104-0']),
});
// Each body's share of the step's level, and whether it replaces the step.
const BODY_LAYER = Object.freeze({
  bone: { gain: 0.6 }, metal: { gain: 0.55 }, stone: { gain: 0.55 }, plant: { gain: 0.5 }, foliage: { gain: 0.32 },
  water: { gain: 1, replaces: true }, fire: { gain: 1, replaces: true }, air: { gain: 0.9, replaces: true },
});
// Where each layered recording hits hardest (ms, measured): a layer lands its peak on the step's peak, as the thud does
// (thudDelayMs with this as its peak). Unlisted files count as BODY_PEAK_MS.
export const BODY_PEAK_MS = 60;
const BODY_PEAKS = Object.freeze({
  'bone-837032-0': 38, 'bone-837032-1': 125, 'bone-837032-2': 33, 'bone-837032-3': 22, 'bone-837032-4': 24, 'metal-545547-0': 19,
  'metal-545547-1': 22, 'metal-675817-0': 106, 'metal-675817-1': 64, 'metal-675817-2': 19, 'metal-675817-3': 78, 'plant-572645-0': 175,
  'plant-618085-0': 237, 'plant-802576-0': 82, 'stone-530990-0': 184, 'stone-530990-1': 71, 'stone-530990-2': 96, 'stone-530990-3': 169,
  'stone-799521-0': 118,
  'foliage-any-106114-0': 240, 'foliage-any-106114-1': 182, 'foliage-any-106114-2': 213,
});
// The `n`th body sound of a creature with `body` by the token `seed`: { file, gain, replaces, peakMs }, or null for no body (or a
// family with fewer than three recordings). The same seeded no-repeat order as the steps, in its own deck.
export function bodyStep(body, n, { seed = '' } = {}) {
  const spec = BODY_LAYER[body], files = BODY_STEP_FILES[body];
  if (!spec || !files || files.length < MIN_FAMILY_FILES) return null;
  const i = Math.abs(Math.trunc(Number(n) || 0));
  const file = files[stepIndex(files.length, i, `${seed}:body:${body}`)];
  const peakMs = BODY_PEAKS[file.split('/').pop().replace(/^body-|\.ogg$/g, '')] ?? BODY_PEAK_MS;
  return { file, gain: spec.gain, replaces: spec.replaces === true, peakMs };
}
// Every bundled body sound, for preloading.
export const bodyStepFiles = () => Object.values(BODY_STEP_FILES).flat();
// Every bundled creature step, for preloading.
export const gaitStepFiles = () => Object.values(GAIT_STEP_FILES).flatMap((family) => Object.values(family).flat());
// Each step's own pitch and loudness, so even the same recording never sounds twice alike: the pitch wanders a few
// percent around the creature's size (a Huge stride lower and heavier, a Tiny one lighter), the level a little.
// How heavy a creature's steps are: 0 Tiny, 1 Small, 2 Medium, 3 Large, 4 Huge, 5 Gargantuan, from its size category
// (PF2e/SF2e/D&D size slugs or names), else its token width in squares. A heavy body (stone, metal, a giant's or a
// dragon's bulk) weighs three quarters of a size more.
const SIZE_WEIGHT = { tiny: 0, sm: 1, small: 1, med: 2, medium: 2, lg: 3, large: 3, huge: 4, grg: 5, gargantuan: 5 };
export function stepWeight({ size, squares = 1, heavy = false } = {}) {
  let weight = SIZE_WEIGHT[String(size ?? '').toLowerCase()];
  if (weight === undefined) {
    const s = Number(squares) || 1;
    weight = s < 1 ? 0 : s < 2 ? 2 : s < 3 ? 3 : s < 4 ? 4 : 5;
  }
  return weight + (heavy ? 0.75 : 0);
}
// Pitch by weight: a Tiny scurry about 1.3×, a Medium step as recorded, a Gargantuan tread about 0.6× (deeper and
// longer, which also darkens it).
const WEIGHT_RATE = [1.3, 1.12, 1, 0.84, 0.7, 0.6];
const weightRate = (weight) => {
  const w = Math.min(5.75, Math.max(0, Number(weight) || 0)), i = Math.min(4, Math.floor(w)), f = w - i;
  const base = WEIGHT_RATE[i] + (WEIGHT_RATE[i + 1] - WEIGHT_RATE[i]) * Math.min(1, f);
  return w > 5 ? base * (1 - 0.12 * (w - 5)) : base;
};
// Each step's own pitch and loudness, so even the same recording never sounds twice alike: the pitch wanders a few
// percent around the creature's weight (stepWeight; `squares` alone still works), the level a little.
export function footstepVariation({ seed = '', n = 0, squares = 1, weight } = {}) {
  const random = rng(`${seed}:vary:${n}`);
  const w = weight ?? stepWeight({ squares });
  const rate = Math.min(1.4, Math.max(0.5, weightRate(w) * (1 + (random() - 0.5) * 0.1)));
  const gain = 0.82 + random() * 0.3;
  return { rate: +rate.toFixed(3), gain: +gain.toFixed(3) };
}
// How loud a step is (0-1, before the user's surface volume): quiet, wet floors a little louder; a Tiny creature
// barely heard, a Gargantuan one shaking the floor. `weight` from stepWeight (else `squares`, the token's width).
const STEP_VOLUME = { water: 0.24, mud: 0.21, ice: 0.15 };
const WEIGHT_GAIN = [0.45, 0.75, 1, 1.35, 1.75, 2.2];
export function footstepVolume(floor, { squares = 1, weight } = {}) {
  const w = Math.min(5, Math.max(0, weight ?? stepWeight({ squares }))), i = Math.floor(w);
  const size = WEIGHT_GAIN[i] + ((WEIGHT_GAIN[Math.min(5, i + 1)] - WEIGHT_GAIN[i]) * (w - i));
  return Math.min(1, +((STEP_VOLUME[floor] ?? 0.17) * size).toFixed(3));
}
// A big creature's long legs cover several strides per step: Large and Huge step every other stride, Gargantuan
// every third, so a giant's tread is slow and heavy rather than a patter.
// Steps are paced in time, not distance: Foundry slides every token at the same speed, so counting strides would make
// a giant patter like a halfling. Each weight has its own beat (ms between steps): a Tiny scurry, a Medium walk, a
// Huge THUMP ... THUMP, a Gargantuan slower still; a heavy body a little slower than its size.
const STEP_GAP = [120, 170, 260, 450, 750, 1100];
export function stepGap(weight) {
  const w = Math.min(5.75, Math.max(0, Number(weight) || 0)), i = Math.min(4, Math.floor(w)), f = Math.min(1, w - i);
  const base = STEP_GAP[i] + (STEP_GAP[i + 1] - STEP_GAP[i]) * f;
  return Math.round(w > 5 ? base * (1 + 0.3 * (w - 5)) : base);
}
// Per token: whether this stride makes a step now (its beat has passed) and that step's number, else null. The first
// stride of a move steps at once.
export function createStepPacer() {
  const tokens = new Map();
  return {
    // `gap` (ms) overrides the walking beat: a wing beat, a stroke or a churn has its own (moveSoundGap).
    take(id, weight, now, gap = stepGap(weight)) {
      const last = tokens.get(id);
      if (last && now - last.at < gap) return null;
      const n = last ? last.n + 1 : 0;
      tokens.set(id, { at: now, n });
      return n;
    },
    clear() { tokens.clear(); },
  };
}
// Large and heavier steps land with a low thud under the footstep (Kenney's soft heavy impacts, bundled): a light one
// for Large, deeper, louder and longer for Huge and Gargantuan (played slower, which also lengthens its ring).
export const THUD_FILES = [0, 1, 2, 3, 4].map((i) => `${SURFACES}/kenney/impactSoft_heavy_00${i}.ogg`);
export function thudFile(weight, n, seed = '') {
  if (!(weight >= 3)) return null;
  return THUD_FILES[stepIndex(THUD_FILES.length, Math.abs(Math.trunc(Number(n) || 0)), `${seed}:thud`)];
}
// The thuds hit hardest about 8 ms in (measured); footstep recordings much later (PSFX's outdoor steps 90–410 ms, some
// Freesound ones ~280 ms), and later still when a heavy creature's step is played slowed. So the thud waits for the
// footfall: the step's peak (read from its decoded audio, `audioPeakMs`) over its rate, less the thud's own.
export const THUD_PEAK_MS = 8;
const peaks = new WeakMap();
export function audioPeakMs(buffer) {
  if (!buffer || typeof buffer.getChannelData !== 'function') return 0;
  if (peaks.has(buffer)) return peaks.get(buffer);
  let at = 0;
  try {
    const rate = buffer.sampleRate || 44100, end = Math.min(buffer.length ?? Infinity, rate);
    let peak = 0;
    for (let c = 0; c < (buffer.numberOfChannels || 1); c++) {
      const data = buffer.getChannelData(c), n = Math.min(end, data.length);
      for (let i = 0; i < n; i++) { const v = Math.abs(data[i]); if (v > peak) { peak = v; at = i; } }
    }
    at = Math.round((at / rate) * 1000);
  } catch { at = 0; }
  peaks.set(buffer, at);
  return at;
}
export function thudDelayMs({ stepPeakMs = 0, stepRate = 1, thudPeakMs = THUD_PEAK_MS, thudRate = 1, elapsedMs = 0 } = {}) {
  const land = stepPeakMs / (stepRate || 1) - thudPeakMs / (thudRate || 1);
  return Math.max(0, Math.round(land - elapsedMs));
}
// How a footfall thud sounds for a weight: Large ~0.65×, Huge an octave down (0.5×), Gargantuan ~0.4× (a heavy body
// lower still); its slap filtered off (`lowpass` Hz) and its low end lifted (`bass` dB), more the bigger it is; Huge and
// up add a quieter `sub` rumble an octave below the thud, felt more than heard.
export function thudLevel(weight) {
  if (!(weight >= 3)) return null;
  const w = Math.min(5.75, weight), over = w - 3;
  const rate = +Math.max(0.3, w <= 4 ? 0.65 - 0.15 * over : w <= 5 ? 0.5 - 0.1 * (w - 4) : 0.4 - 0.12 * (w - 5)).toFixed(3);
  const bass = +Math.min(12, 4 + 2.5 * over).toFixed(1);
  return {
    gain: +(0.35 + 0.3 * over).toFixed(3),
    rate,
    lowpass: Math.round(Math.max(350, 1400 - 400 * over)),
    bass,
    // A thud is nearly all bass, so the shelf raises its peak by about the boost: the level gives that back.
    headroom: +Math.pow(10, -bass / 20).toFixed(3),
    sub: w >= 4 ? { rate: +(rate / 2).toFixed(3), gain: +Math.min(0.9, 0.45 + 0.2 * (w - 4)).toFixed(3) } : null,
  };
}

// Movement sounds: how a token moves picks what it sounds like. Foundry's movement actions (CONFIG.Token.movement.actions:
// walk, fly, swim, burrow, crawl, climb, jump, blink, displace; a system may add more, which step like a walk):
//   'step'   walk and anything else: the floor's footsteps (walking through water splashes with the water steps).
//   'wing'   positive wing anatomy: a wing beat. 'flight': wingless or unknown flight, a quiet air pass.
//   'burrow' burrow: earth churned and thrown.   'swim' swim: a stroke through water.
//   'climb'  climb: a hand or foot gripping rock. 'crawl' crawl: a body and clothes shuffling over the ground.
//   'jump'   jump: one whoosh as it leaves the ground, then a heavier footstep where it lands.
//   null     blink and displace (a teleport: silent here), and anything incorporeal (gait 'none').
const ACTION_SOUND = { burrow: 'burrow', swim: 'swim', climb: 'climb', crawl: 'crawl', jump: 'jump', blink: null, displace: null };
export const MOVE_SOUND_KINDS = Object.freeze(['step', 'wing', 'flight', 'burrow', 'swim', 'climb', 'crawl', 'jump']);
export function movementSound(action, { floor, gait, statuses, flight } = {}) {
  if (gait === 'none') return null;
  const key = String(action ?? '').toLowerCase();
  if (key === 'fly') return flight === 'wing' ? 'wing' : 'flight';
  if (key in ACTION_SOUND) return ACTION_SOUND[key];
  return isFlying({ statuses }) ? flight === 'wing' ? 'wing' : 'flight' : 'step';
}
// Each kind's own bundled CC0 family (Freesound, credited beside the assets in License.txt), cut to one
// event and loudness-matched like the footsteps. PSFX's wing, landing and burrow recordings are long loops (5–8 s), not
// single beats, so they are not used here.
export const MOVE_SOUND_FILES = Object.freeze({
  wing: freesound(['wing-389634-0', 'wing-362405-0', 'wing-561364-0', 'wing-362405-1']),
  flight: completed('flight', 'any', 862337),
  burrow: freesound(['burrow-849840-0', 'burrow-353907-0', 'burrow-353907-1']),
  swim: freesound(['swim-316598-0', 'swim-637957-0', 'swim-488507-0']),
  climb: freesound(['climb-816743-0', 'climb-816743-1', 'climb-816743-3', 'climb-816743-4']),
  crawl: freesound(['crawl-872226-0', 'crawl-19291-0', 'crawl-389794-0', 'crawl-389794-1', 'crawl-389794-2']),
  jump: freesound(['jump-496188-0', 'jump-494797-0', 'jump-391448-1', 'jump-495390-1']),
});
// The `n`th sound of `kind` by the token `seed` (never the same recording twice running); null for 'step' and unknown kinds.
export function moveSoundFile(kind, n, { seed = '' } = {}) {
  const files = MOVE_SOUND_FILES[kind];
  if (!files) return null;
  return files[stepIndex(files.length, Math.abs(Math.trunc(Number(n) || 0)), `${seed}:${kind}`)];
}
const lerpWeight = (table, weight, heavy = 0) => {
  const w = Math.min(5.75, Math.max(0, Number(weight) || 0)), i = Math.min(4, Math.floor(w)), f = Math.min(1, w - i);
  const base = table[i] + (table[i + 1] - table[i]) * f;
  return w > 5 ? base * (1 + heavy * (w - 5)) : base;
};
// Wing beats by weight (ms between beats): a Tiny flutter, a Medium bird's steady beat, a Huge or Gargantuan dragon's
// slow WHOOMP ... WHOOMP.
const WING_GAP = [140, 260, 420, 650, 900, 1300];
// Slower than walking, as each kind is: a burrower's churn, a swimmer's stroke, a climber's reach, a crawl.
const GAP_SCALE = { flight: 2, burrow: 1.5, swim: 1.3, climb: 1.4, crawl: 1.6 };
// Milliseconds between two sounds of `kind` for a creature of `weight` (stepWeight). A jump's whoosh and landing
// always play (0).
export function moveSoundGap(kind, weight, { gait } = {}) {
  if (kind === 'wing') return Math.round(lerpWeight(WING_GAP, weight, 0.3));
  if (kind === 'jump' || kind === 'land') return 0;
  if (kind === 'flight') return Math.max(700, Math.round(stepGap(weight) * GAP_SCALE.flight));
  // Hard hoof clips preserve a paired clop. Even small hooved creatures leave room for that phrase to finish.
  if (kind === 'step' && gait === 'hooves') return Math.max(stepGap(weight), Math.ceil(340 / weightRate(Math.max(0, weight - 1))));
  // A sliding body makes one sweep, not a rapid series of overlapping 0.4s scrapes. Tiny creatures play faster;
  // heavier ones pitch the recording down, so leave correspondingly more time for its decay.
  if (kind === 'step' && gait === 'slither') return Math.max(stepGap(weight), Math.ceil(440 / weightRate(weight)));
  return Math.round(stepGap(weight) * (GAP_SCALE[kind] ?? 1));
}
// Wings by weight: a Tiny one's flutter high and light, a Medium bird's as recorded, a Gargantuan dragon's about an
// octave down.
const WING_RATE = [1.45, 1.2, 1, 0.82, 0.66, 0.52];
// How loud each kind is (0-1, before the creature's size and the user's surface volume); a crawl is quiet.
const MOVE_VOLUME = { wing: 0.17, flight: 0.08, burrow: 0.2, swim: 0.2, climb: 0.13, crawl: 0.09, jump: 0.15 };
const weightGain = (weight) => {
  const w = Math.min(5, Math.max(0, Number(weight) || 0)), i = Math.floor(w);
  return WEIGHT_GAIN[i] + (WEIGHT_GAIN[Math.min(5, i + 1)] - WEIGHT_GAIN[i]) * (w - i);
};
// One movement sound's shaping for a creature of `weight`: its pitch (`rate`, lower for heavier, a few percent of seeded
// wander), loudness (`volume`), and for big wings and every burrow a darker, fuller tone (`lowpass` Hz, `bass` dB, as
// the thuds; the boost's peak is given back in level). Same on every screen.
export function moveSoundShape(kind, { weight = 2, seed = '', n = 0 } = {}) {
  const random = rng(`${seed}:move:${kind}:${n}`);
  const w = Math.min(5.75, Math.max(0, Number(weight) || 0));
  const base = kind === 'wing' ? lerpWeight(WING_RATE, w, -0.1) : weightRate(w) * (kind === 'burrow' ? 0.85 : 1);
  const rate = Math.min(1.6, Math.max(0.35, base * (1 + (random() - 0.5) * 0.1)));
  let volume = (MOVE_VOLUME[kind] ?? 0.15) * weightGain(w) * (0.85 + random() * 0.25);
  const out = { rate: +rate.toFixed(3) };
  let lowpass, bass;
  if (kind === 'burrow') { lowpass = Math.max(500, 1600 - 300 * Math.max(0, w - 2)); bass = Math.min(10, 4 + 1.5 * Math.max(0, w - 2)); }
  else if (kind === 'wing' && w >= 3) { lowpass = Math.max(600, 2400 - 550 * (w - 3)); bass = Math.min(10, 3 + 2.5 * (w - 3)); }
  else if (w >= 4) { lowpass = Math.max(900, 1800 - 400 * (w - 4)); bass = Math.min(8, 2 + 2 * (w - 4)); }
  if (lowpass) { out.lowpass = Math.round(lowpass); out.bass = +bass.toFixed(1); volume *= Math.pow(10, -out.bass / 40); }
  out.volume = +Math.min(1, volume).toFixed(3);
  return out;
}

// A burrower's trail: a low ridge of dark, crumbly churned earth along the stride just dug (seeded lumps), with a few
// loose clods beside it, fading over about 8 s. Sized by the token's width. Particles in canvas pixels, like puffsFor.
export const BURROW_LOOK = Object.freeze({ colors: [0x3b2a1a, 0x4a3522, 0x2e2014], crumb: [0x5a4128, 0x6b4f33, 0x3b2a1a], alpha: 0.7, life: 8000, hold: 0.5 });
export function burrowTrail(at, { seed = '', grid = 100, width = grid } = {}) {
  const index = at.index ?? 0, heading = at.heading ?? 0, random = rng(`${seed}:${index}:burrow`);
  const half = (grid * STRIDE) / 2, across = heading + Math.PI / 2, L = BURROW_LOOK;
  const place = (d, a) => ({ x: at.x + Math.cos(heading) * d + Math.cos(across) * a, y: at.y + Math.sin(heading) * d + Math.sin(across) * a });
  const base = { vx: 0, vy: 0, delay: 0, spin: 0, grow: 0, life: L.life, hold: L.hold, lasting: true };
  // Lumps in unit space along the segment: x -1..1, y across, r their radius.
  const lumps = [];
  for (let i = 0; i < 6; i++) lumps.push([round3(-1 + (i + random() * 0.6) / 3), round3((random() - 0.5) * 0.5), round3(0.3 + random() * 0.25)]);
  const out = [{ ...base, kind: 'mound', color: L.colors[Math.floor(random() * L.colors.length) % L.colors.length], ...place(-half, 0), radius: half * 1.1,
    rotation: heading, alpha: L.alpha, ry: clamp((0.22 * width) / half, 0.15, 0.9), lumps }];
  for (let i = 0; i < 3; i++) {
    const side = random() < 0.5 ? -1 : 1;
    out.push({ ...base, kind: 'chip', color: L.crumb[Math.floor(random() * L.crumb.length) % L.crumb.length],
      ...place(-half * 2 * random(), side * width * (0.16 + random() * 0.14)), radius: grid * Math.pow(Math.max(0.4, width / grid), 0.85) * (0.018 + random() * 0.016),
      rotation: random() * Math.PI * 2, alpha: L.alpha * 0.9 });
  }
  return out;
}
// Where a burrower goes under or comes up: a dark hole with a rim of loose earth, lingering ~20 s, and gravel and clods
// thrown out. Digging in throws the earth back behind it; breaking out throws more of it all around and leaves a wider
// hole. Sized by the token's width; seeded, so every screen matches.
export const HOLE_LOOK = Object.freeze({ color: 0x140d07, rim: [0x4a3522, 0x5a4128, 0x3b2a1a], alpha: 0.85, life: 20000, hold: 0.6 });
const round2 = (v) => Math.round(v * 100) / 100;
export function burrowHole(at, { seed = '', grid = 100, width = grid, exit = false } = {}) {
  const heading = at.heading ?? 0, L = HOLE_LOOK, random = rng(`${seed}:${Math.round(at.x)}:${Math.round(at.y)}:${exit ? 'exit' : 'in'}:hole`);
  const radius = round2(clamp(width * (exit ? 0.36 : 0.3), grid * 0.2, grid * 1.6));
  const rim = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + (random() - 0.5) * 0.4;
    rim.push([round3(Math.cos(a) * (1.05 + random() * 0.15)), round3(Math.sin(a) * (1.05 + random() * 0.15)), round3(0.22 + random() * 0.18)]);
  }
  const out = [{ kind: 'hole', color: L.color, rimColor: L.rim[Math.floor(random() * L.rim.length) % L.rim.length], rim, x: at.x, y: at.y,
    vx: 0, vy: 0, radius, rotation: heading, alpha: L.alpha, life: L.life, hold: L.hold, grow: 0, delay: 0, spin: 0, lasting: true }];
  // Gravel and clods: thrown out from the hole's edge, hopping and settling within about a second.
  const count = exit ? 12 : 7;
  for (let i = 0; i < count; i++) {
    const a = exit ? (i / count) * Math.PI * 2 + (random() - 0.5) * 0.5 : heading + Math.PI + (random() - 0.5) * Math.PI * 0.9;
    const speed = grid * (exit ? 0.5 + random() * 0.5 : 0.3 + random() * 0.3), from = radius * (0.6 + random() * 0.4);
    out.push({ kind: 'chip', color: L.rim[Math.floor(random() * L.rim.length) % L.rim.length],
      x: round2(at.x + Math.cos(a) * from), y: round2(at.y + Math.sin(a) * from), vx: round2(Math.cos(a) * speed), vy: round2(Math.sin(a) * speed),
      radius: round2(grid * (0.02 + random() * 0.025)), rotation: random() * Math.PI * 2, spin: (random() - 0.5) * 8, hop: grid * (exit ? 0.25 : 0.12),
      alpha: 0.9, life: Math.round(700 + random() * 500), grow: 0, delay: Math.round(random() * 80) });
  }
  return out;
}
// A swimmer's wake on water: two ripple lines from behind it, opening into a V and drifting apart as they fade (~1.6 s).
export const WAKE_LOOK = Object.freeze({ color: 0xd4e9f7, alpha: 0.5, life: 1600, spread: 0.42 });
export function swimWake(at, { grid = 100, width = grid } = {}) {
  const heading = at.heading ?? 0, back = heading + Math.PI, L = WAKE_LOOK;
  const tail = { x: at.x + Math.cos(back) * width * 0.3, y: at.y + Math.sin(back) * width * 0.3 };
  return [-1, 1].map((side) => {
    const arm = back + side * L.spread, out = arm + side * Math.PI / 2, drift = grid * 0.12;
    return { kind: 'wake', color: L.color, x: tail.x, y: tail.y, vx: Math.cos(out) * drift, vy: Math.sin(out) * drift,
      radius: Math.max(grid * 0.25, width * 0.35), rotation: arm, alpha: L.alpha, delay: 0, life: L.life, spin: 0, grow: 0.6, side };
  });
}
// Depth is relative to the viewed level, not absolute world elevation. Swimming
// below water (or explicit Swim on an underwater map) is never burrowing.
export function movementEnvironment(token, floor) {
  const relative = Number(token.elevation ?? 0) - Number(token.base ?? 0);
  const below = Number.isFinite(relative) && relative < 0;
  const action = String(token.action ?? '').toLowerCase();
  const swimming = action === 'swim' || (below && floor === 'water' && action !== 'burrow');
  return { relative, swimming, submerged: swimming && below, underground: below && !swimming };
}
export function surfaceSplash(at, {seed='',grid=100,width=grid}={}) {
  const random=rng(`${seed}:surface`),size=grid*Math.sqrt(clamp(width/grid,.5,6));
  const common={x:at.x,y:at.y,rotation:0,spin:0,surfaceSplash:true};
  const rings=Array.from({length:3},(_,i)=>({...common,kind:'ring',color:0xe1f8ff,vx:0,vy:0,radius:width*.45+size*.1,alpha:.85-i*.12,life:1400,delay:i*100,grow:1.8+i*.35}));
  const drops=Array.from({length:24},(_,i)=>{const angle=i*Math.PI*2/24+random()*.12,speed=size*(.4+random()*.5);return {...common,kind:'drop',color:0xe1f8ff,x:at.x+Math.cos(angle)*width*.4,y:at.y+Math.sin(angle)*width*.3,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed*.65,radius:size*(.035+random()*.035),alpha:.9,life:850+random()*350,delay:random()*70,grow:-.4,hop:size*(.25+random()*.3)};});
  return [...rings,...drops];
}

export function underwaterBubbles(at, { seed = '', grid = 100, width = grid } = {}) {
  const random = rng(`${seed}:${at.index ?? 0}:bubbles`), heading = at.heading ?? 0;
  const size=grid*Math.sqrt(clamp(width/grid,.5,6));
  return Array.from({length:5},()=>({kind:'ring',color:0xe1f8ff,
    x:at.x+(random()-.5)*width*.3,y:at.y+(random()-.5)*width*.3,
    vx:-Math.cos(heading)*grid*.05,vy:-Math.sin(heading)*grid*.05-grid*.07,
    radius:size*(.065+random()*.045),alpha:.8,life:1800,delay:Math.round(random()*160),
    rotation:0,spin:0,grow:.8,underwater:true}));
}

// A token that has not moved for this long has stopped (a jump lands).
export const STOP_MS = 150;
// The per-frame controller. `tokens()` lists plain views of the scene's tokens: {id, x, y (drawn centre), width (px),
// elevation, base (viewed level floor), action, statuses, visible (seen by this viewer on the viewed level), skip
// (moved by Animater itself), gait (creature-gait.mjs; boots when missing)}. `layer` draws: addParticle/updateParticle/removeParticle, addShadow/updateShadow/
// removeShadow, clear. `footstep(floor, at, token, kind)` is called once per stride with how the token moves
// (movementSound: 'step', 'wing' for a flier, 'burrow', 'swim', 'climb', 'crawl'), once as a jump leaves the ground
// ('jump') and once where it lands ('land'); never while it stands or hovers still. `cap` (a number or a
// function) bounds the particles alive at once, not counting footprints; `printCap` (likewise) bounds the footprints,
// which last long, so a full trail drops its oldest print instead of starving the dust.
// What one screen may perceive of a moving creature: `see` (dust, prints, trails, a flier's shadow) and `hear` (its
// footsteps, wings, digging). A token the GM hid in Foundry gives nothing away to anyone. The GM knows everything
// else. A player goes by PF2e Visioner's `states` from each of their own tokens (the most aware counts): observed or
// concealed it is seen (when it is drawn here) and heard; hidden, only heard (its square is known, usually by sound);
// undetected or unnoticed, nothing. Without Visioner, the creature's own conditions: undetected or unnoticed gives
// nothing, hidden or invisible is heard but not seen; otherwise what this screen draws is what it perceives.
const AWARENESS = { unnoticed: 0, undetected: 1, hidden: 2, concealed: 3, observed: 4 };
export function perceive({ isGM = false, docHidden = false, tokenVisible = false, states = [], conditions = [] } = {}) {
  if (docHidden) return { see: false, hear: false };
  if (isGM) return { see: true, hear: true };
  const known = (states ?? []).filter((s) => s in AWARENESS);
  if (known.length) {
    const best = Math.max(...known.map((s) => AWARENESS[s]));
    if (best <= AWARENESS.undetected) return { see: false, hear: false };
    if (best === AWARENESS.hidden) return { see: false, hear: true };
    return { see: tokenVisible === true, hear: true };
  }
  const has = (slug) => (conditions ?? []).includes(slug);
  if (has('undetected') || has('unnoticed')) return { see: false, hear: false };
  if (has('hidden') || has('invisible')) return { see: false, hear: true };
  return tokenVisible ? { see: true, hear: true } : { see: false, hear: false };
}

export function createMovementFeel({ tokens, floorAt: floorOf, enabled, density, grid, distance, now, layer, footstep, cap = 120, printCap = 80, printLifetime = 0, trailLifetime = () => 0, burrowDepth = () => -10, holes = () => true, trails = null }) {
  // `trails` (ground-trails.mjs createGroundTrails): what each stride also leaves (carried prints, blood, weather).
  const capOf = typeof cap === 'function' ? cap : () => cap;
  const printCapOf = typeof printCap === 'function' ? printCap : () => printCap;
  // Milliseconds until fully faded, by the ground the track was left on.
  // Zero keeps its native lifetime. Cache each ground once per rendered frame.
  const printLifetimeOf = typeof printLifetime === 'function' ? printLifetime : () => printLifetime;
  const footprintLives = new Map();
  const trailLives = new Map();
  const trailLife = kind => {
    if (!trailLives.has(kind)) {
      const n = Number(trailLifetime(kind));
      trailLives.set(kind,Number.isFinite(n)&&n>0?clamp(n,100,3600000):0);
    }
    return trailLives.get(kind);
  };
  const footprintLife = floor => {
    if (!footprintLives.has(floor)) {
      const requested = Number(printLifetimeOf(floor));
      footprintLives.set(floor, Number.isFinite(requested) && requested > 0 ? clamp(requested, 1000, 3600000) : 0);
    }
    return footprintLives.get(floor);
  };
  let tracker = null, trackerGrid = 0, known = new Set();
  const particles = new Set(), prints = new Set(), shadows = new Map();
  const drop = (particle) => {
    particles.delete(particle);
    prints.delete(particle);
    try { layer.removeParticle(particle.handle); } catch { /* keep going */ }
  };
  const clear = () => {
    particles.clear();
    prints.clear();
    shadows.clear();
    tracker?.clear();
    moves.clear();
    try { trails?.clear?.(); } catch { /* optional */ }
    known = new Set();
    try { layer.clear(); } catch { /* canvas gone */ }
  };
  const dropShadow = (id) => {
    const handle = shadows.get(id);
    if (!handle) return;
    shadows.delete(id);
    try { layer.removeShadow(handle); } catch { /* keep going */ }
  };
  // Each token's movement: where it was, when it last moved, whether it is moving and how (a jump whooshes once as it
  // leaves the ground and lands when it stops).
  const moves = new Map();
  // Whose marks are being laid (the token being stepped), so each mark can follow whether this view perceives its maker.
  let layOwner = null, lastUnseen = new Set();
  // Marks each creature has laid since the scene loaded (a live check compares before and after a walk).
  const laidTotals = new Map();
  const lay = (specs, time, floor, trailKind = null) => {
    const limit = capOf(), printLimit = printCapOf();
    for (let spec of specs) {
      // Grooves, smears and a burrower's churned earth last as long as prints and share their budget.
      const print = spec.kind === 'print' || spec.kind === 'groove' || spec.lasting === true;
      if (print) {
        if (!(printLimit > 0)) continue;
        while (prints.size >= printLimit) drop(prints.values().next().value);
      } else if (particles.size - prints.size >= limit) continue;
      const footprint = ['print','groove','trample'].includes(spec.kind);
      const nativeLife = footprint || trailKind ? spec.life : null;
      const life = trailKind ? trailLife(trailKind) : footprint ? footprintLife(floor) : 0;
      if (life) spec = { ...spec, life, motionLife:nativeLife };
      const handle = layer.addParticle(spec);
      const particle = { spec, handle, born: time, nativeLife, floor, trailKind, owner: layOwner };
      if (layOwner) laidTotals.set(layOwner, (laidTotals.get(layOwner) ?? 0) + 1);
      particles.add(particle);
      if (print) prints.add(particle);
    }
  };
  const hears = (token) => token.audible ?? token.visible === true;
  const sound = (floor, at, token, kind) => { if (!hears(token)) return; try { footstep?.(floor, at, token, kind); } catch { /* sound is optional */ } };
  // Seen from above a creature stands on its whole token: its marks and its steps come from under its middle.
  const feetOf = (token, at) => ({ ...at });
  // One stride of a token moving by `kind` (movementSound; never null here): its floor marks and its sound.
  const emit = (token, at, time, size, rate, kind, move) => {
    const feet = feetOf(token, at);
    const floor = floorOf(feet, token);
    const opts = { seed: token.id, grid: size, density: rate, width: token.width || size, gait: token.gait ?? 'boots' };
    // A burrower churns the earth instead of stepping on it; a swimmer leaves a wake on water; a jumper marks nothing
    // until it lands; everything else (walk, climb, crawl) marks its floor as a walker does.
    let specs;
    const medium=movementEnvironment(token,floor);
    let trailKind=null;
    if (kind === 'burrow') {
      const raw = Number(burrowDepth()), cutoff=Number.isFinite(raw)?Math.min(0,raw):-10;
      specs = medium.underground && medium.relative <= cutoff ? [] : burrowTrail(feet, opts);
      trailKind='burrow';
    }
    else if (kind === 'swim') { trailKind=medium.submerged?'underwater':'swim';specs=medium.submerged?underwaterBubbles(at,opts):swimWake(at,opts); }
    else if (kind === 'jump') specs = [];
    else specs = puffsFor(floor, feet, opts);
    if (trails) { try {
      if(trailKind)trails.forget?.(token.id);
      else specs = [...specs, ...(trails.marks(token, feet, floor, opts, kind) ?? [])];
    } catch { /* optional */ } }
    if (token.visible) lay(specs, time, floor, trailKind);
    move.index = at.index ?? 0; move.heading = at.heading ?? 0;
    if (kind !== 'jump') sound(floor, feet, token, kind);
    else if (!move.whoosh) { move.whoosh = true; sound(floor, feet, token, 'jump'); }
  };
  // A jump comes down where the token stopped: the floor's marks and a heavier step ('land').
  const land = (token, point, time, size, rate, move) => {
    const at = { x: point.x, y: point.y, heading: move.heading ?? 0, index: (move.index ?? 0) + 1 }, feet = feetOf(token, at);
    const floor = floorOf(feet, token);
    if (token.visible) lay(puffsFor(floor, feet, { seed: token.id, grid: size, density: rate, width: token.width || size, gait: token.gait ?? 'boots' }), time, floor);
    sound(floor, feet, token, 'land');
  };
  const tick = () => {
    const rate = enabled() ? density() : 0;
    if (!(rate > 0)) { if (particles.size || shadows.size || known.size) clear(); return; }
    const size = grid() || 100, time = now();
    footprintLives.clear();
    trailLives.clear();
    if (!tracker || trackerGrid !== size) { tracker = createStrideTracker({ stride: STRIDE * size, maxJump: 3 * size }); trackerGrid = size; }
    const seen = new Set(), unseen = new Set();
    lastUnseen = unseen;
    for (const token of tokens() ?? []) {
      let id;
      try {
        id = token.id;
        layOwner = id;
        // Not seen from this view now (another token's eyes, PF2e Visioner): its marks hide until it is seen again.
        if (!token.visible) unseen.add(id);
        const point = { x: token.x, y: token.y };
        seen.add(id);
        const below=Number(token.elevation)<Number(token.base??0);
        const medium=movementEnvironment(token,token.floor??(below?floorOf(point,token):null));
        const under = medium.underground;
        const flying = !under && !medium.swimming && isFlying(token);
        const kind = token.gait === 'none' ? null : under ? 'burrow' : medium.swimming ? 'swim' : movementSound(token.action, { gait: token.gait, statuses: token.statuses, flight: token.flight });
        // Seen or heard here (perceive): a creature only heard still steps, but leaves nothing to see.
        const present = token.visible || hears(token);
        if (!present || token.skip || kind === null) tracker.reset(id, point);
        if (!present || token.skip) { dropShadow(id); moves.delete(id); continue; }
        let move = moves.get(id);
        if (!move) moves.set(id, move = { x: point.x, y: point.y, last: time, moving: false });
        // Where its elevation crosses its level's floor: going under leaves an entrance hole (earth thrown back), coming
        // back up an exit hole (earth thrown all around), each where it happened.
        if (move.under !== undefined && move.under !== under && token.visible && holes() !== false) {
          const heading = move.heading ?? Math.atan2(point.y - move.y, point.x - move.x);
          lay(burrowHole({ x: point.x, y: point.y, heading }, { seed: token.id, grid: size, width: token.width || size, exit: !under }), time);
        }
        if(move.submerged===true&&!medium.submerged&&medium.relative>=0&&token.visible) {
          lay(surfaceSplash(point,{seed:id,grid:size,width:token.width||size}),time,'water');
        }
        move.submerged=medium.submerged;
        move.under = under;
        if (Math.hypot(point.x - move.x, point.y - move.y) > 0.5) { move.last = time; move.moving = true; move.kind = kind; }
        else if (move.moving && time - move.last >= STOP_MS) {
          move.moving = false;
          if (move.kind === 'jump' && move.whoosh && !flying) land(token, point, time, size, rate, move);
          move.whoosh = false;
        }
        move.x = point.x; move.y = point.y;
        if (flying) {
          let handle = shadows.get(id);
          if (!token.visible) dropShadow(id);
          else {
          if (!handle) shadows.set(id, handle = layer.addShadow());
          layer.updateShadow(handle, shadowGeometry({ x: point.x, y: point.y, width: token.width, lift: token.elevation - (token.base ?? 0), distance: distance() || 5, grid: size }));
          }
          // Off the ground: no marks. Keep the chosen winged/wingless sound; stationary hovering stays silent.
          if (kind !== null) for (const at of tracker.step(id, point)) { const feet = feetOf(token, at); sound(floorOf(feet, token), feet, token, kind); }
          continue;
        }
        dropShadow(id);
        for (const at of tracker.step(id, point)) emit(token, at, time, size, rate, kind, move);
      } catch (error) {
        if (id !== undefined) { tracker.forget(id); dropShadow(id); moves.delete(id); }
      }
    }
    for (const id of known) if (!seen.has(id)) { tracker.forget(id); dropShadow(id); moves.delete(id); trails?.forget?.(id); }
    layOwner = null;
    known = seen;
    for (const particle of [...particles]) {
      let state = null;
      if (particle.nativeLife !== null) {
        const life = (particle.trailKind ? trailLife(particle.trailKind) : footprintLife(particle.floor)) || particle.nativeLife;
        if (particle.spec.life !== life) particle.spec = { ...particle.spec, life, motionLife:particle.nativeLife };
      }
      try { state = particleState(particle.spec, time - particle.born); } catch { /* drop it */ }
      try {
        if (state && particle.owner && unseen.has(particle.owner)) state = { ...state, alpha: 0 };
        if (state) layer.updateParticle(particle.handle, state);
        else drop(particle);
      } catch { particles.delete(particle); prints.delete(particle); }
    }
  };
  // How many marks a creature has on the floor, and how many this view shows now (a live check reads this).
  const marksOf = (id) => {
    let laid = 0;
    for (const particle of particles) if (particle.owner === id) laid++;
    return { laid, shown: lastUnseen.has(id) ? 0 : laid, total: laidTotals.get(id) ?? 0 };
  };
  return { tick, clear, marksOf, previewStep: (floor, at, token, kind) => footstep?.(floor, at, token, kind), get size() { return particles.size; }, get prints() { return prints.size; } };
}
