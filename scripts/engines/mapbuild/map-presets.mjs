// A map from nothing: the layouts (pure). A preset, a size and a seed give a plan (map-plan.mjs) — the same plan for
// the same seed on every computer, and another for another.
//
// A layout is worked out in squares and handed over in scene pixels. Whatever is put down keeps the ground it stands
// on to itself, so no tree grows through a wall, no house stands in the road and nothing but reeds stands in the pond.

import { DECOR_KINDS } from '../motion/decor-paint.mjs';
import { furnishRoom } from './furnish.mjs';

export const MAP_PRESETS = Object.freeze({
  village: Object.freeze({ label: 'Village', hint: 'A road through a few houses, a well, perhaps a pond.' }),
  inn: Object.freeze({ label: 'Roadside inn', hint: 'An inn with its stable and yard, on a road through the trees.' }),
  camp: Object.freeze({ label: 'Forest camp', hint: 'A clearing in thick woods: a fire, tents, perhaps a stream.' }),
  farm: Object.freeze({ label: 'Farm', hint: 'A farmhouse and barn, fenced fields, an orchard.' }),
  graveyard: Object.freeze({ label: 'Graveyard', hint: 'A fenced churchyard: a chapel, graves in rows, a gate.' }),
  harbour: Object.freeze({ label: 'Harbour', hint: 'A cobbled quay on the water: piers, boats, warehouses, an inn.' }),
  ruin: Object.freeze({ label: 'Ruin', hint: 'Roofless stone buildings round an old paved court, overgrown.' }),
  dungeon: Object.freeze({ label: 'Dungeon', hint: 'Rooms cut out of solid rock, a door in every wall between them, each room something.' }),
  cave: Object.freeze({ label: 'Cave', hint: 'A cavern with a ragged wall of rock round it, pillars, a pool, a way in.' }),
});
export const MAP_PRESET_IDS = Object.freeze(Object.keys(MAP_PRESETS));
/** How wooded: how many trees for the usual. */
export const TREE_AMOUNTS = Object.freeze({ none: 0, few: 0.45, usual: 1, thick: 1.9 });
/** The smallest map a layout is tried on, in squares a side: under it there is only ground and trees. */
export const SMALLEST_MAP = 12;

// Mulberry32: small, and the same everywhere.
const rngOf = (seed) => { let a = (Number(seed) >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const toSegment = (px, py, ax, ay, bx, by) => { const dx = bx - ax, dy = by - ay, l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / l)) : 0; return Math.hypot(px - ax - dx * t, py - ay - dy * t); };
const toLine = (line, x, y) => { let d = Infinity; for (let i = 0; i + 1 < line.length; i++) d = Math.min(d, toSegment(x, y, line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])); return d; };
// A point a fraction of the way along a line, and the way the line runs there.
const along = (line, t) => {
  const lengths = []; let total = 0;
  for (let i = 0; i + 1 < line.length; i++) { const l = Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]); lengths.push(l); total += l; }
  let left = Math.max(0, Math.min(1, t)) * total;
  for (let i = 0; i < lengths.length; i++) {
    if (left <= lengths[i] || i === lengths.length - 1) { const k = lengths[i] ? Math.min(1, left / lengths[i]) : 0, dx = (line[i + 1][0] - line[i][0]) / (lengths[i] || 1), dy = (line[i + 1][1] - line[i][1]) / (lengths[i] || 1); return { x: line[i][0] + (line[i + 1][0] - line[i][0]) * k, y: line[i][1] + (line[i + 1][1] - line[i][1]) * k, dx, dy, length: total }; }
    left -= lengths[i];
  }
  return { x: line[0][0], y: line[0][1], dx: 1, dy: 0, length: total };
};

const SIDE_TURN = { n: 0, e: Math.PI / 2, s: Math.PI, w: -Math.PI / 2 };
const TREES = { village: ['oak', 'oak', 'maple', 'birch', 'fruitTree', 'blossom'], inn: ['oak', 'maple', 'birch', 'pine', 'oak'], camp: ['pine', 'spruce', 'pine', 'spruce', 'oak', 'birch'], farm: ['oak', 'maple', 'fruitTree', 'oak'], graveyard: ['deadTree', 'oak', 'birch', 'deadTree', 'willow'], harbour: ['oak', 'maple', 'birch'], ruin: ['oak', 'deadTree', 'birch', 'maple', 'oak'] };
const UNDERGROWTH = { graveyard: ['bush', 'flowers', 'fern', 'moss', 'leaves'], harbour: ['bush', 'rock', 'flowers'], ruin: ['bush', 'bush', 'fern', 'moss', 'leaves', 'roots', 'rock'], village: ['bush', 'bush', 'flowers', 'rock', 'fern', 'flowers'], inn: ['bush', 'rock', 'fern', 'stump', 'flowers'], camp: ['fern', 'fern', 'bush', 'mushrooms', 'rock', 'stump', 'log', 'moss'], farm: ['bush', 'flowers', 'rock', 'flowers'] };

/**
 * A plan for a preset. `x, y, width, height` the map in scene pixels, `grid` its square, `seed` any whole number,
 * `trees` one of TREE_AMOUNTS. Returns what planDocuments (map-plan.mjs) takes.
 */
export function buildPlan(preset = 'village', { x = 0, y = 0, width = 3000, height = 2000, grid = 100, seed = 1, trees = 'usual' } = {}) {
  const id = MAP_PRESETS[preset] ? preset : 'village', W = Math.floor(width / grid), H = Math.floor(height / grid);
  const rnd = rngOf((Number(seed) >>> 0) * 2654435761 + MAP_PRESET_IDS.indexOf(id) + 1), rand = (a, b) => a + (b - a) * rnd(), int = (a, b) => Math.floor(rand(a, b + 1)), pick = (list) => list[Math.floor(rnd() * list.length)], chance = (p) => rnd() < p;
  const wooded = TREE_AMOUNTS[trees] ?? TREE_AMOUNTS.usual;
  // The plan in squares, and the ground already spoken for: boxes, rounds and the lines of roads and streams.
  const out = { ground: id === 'dungeon' || id === 'cave' ? { floor: 'glass', style: 'obsidian' } : { floor: 'grass', style: { camp: 'forest', graveyard: 'long', ruin: 'dry', harbour: 'turf' }[id] ?? 'meadow' }, patches: [], paths: [], water: [], buildings: [], things: [], runs: [], lights: [], walls: [], where: id === 'dungeon' || id === 'cave' ? 'cave' : 'surface' };
  const boxes = [], rounds = [], lines = [];
  const clear = (px, py, r = 0.5) => px >= r && py >= r && px <= W - r && py <= H - r
    && !boxes.some((b) => px > b[0] - r && px < b[2] + r && py > b[1] - r && py < b[3] + r)
    && !rounds.some((c) => ((px - c.x) / (c.rx + r)) ** 2 + ((py - c.y) / (c.ry + r)) ** 2 < 1)
    && lines.every((l) => toLine(l.line, px, py) > l.half + r);
  // A box is clear when its edges and its middle are: walked a half square at a time.
  const boxClear = (x0, y0, x1, y1, room = 1) => {
    if (x0 < 1 || y0 < 1 || x1 > W - 1 || y1 > H - 1) return false;
    for (let px = x0; px <= x1; px += 0.5) for (let py = y0; py <= y1; py += 0.5) if (!clear(px, py, room)) return false;
    return true;
  };
  const thing = (kind, px, py, { size = null, turn = 0, keep = 0 } = {}) => { out.things.push({ kind, x: px, y: py, size: size ?? DECOR_KINDS[kind]?.size ?? 1, turn, flip: chance(0.5) }); if (keep > 0) rounds.push({ x: px, y: py, rx: keep, ry: keep }); };
  // The same, only where the ground is free.
  const put = (kind, px, py, opts = {}) => { const r = (opts.size ?? DECOR_KINDS[kind]?.size ?? 1) * 0.45; if (!clear(px, py, r)) return false; thing(kind, px, py, { keep: r, ...opts }); return true; };
  // A run of one thing along a line, piece after piece: a fence is laid, not stamped.
  const run = (kind, from, to) => { out.runs.push({ kind, line: [from, to] }); lines.push({ line: [from, to], half: 0.3 }); };
  // A way across the map that wanders a little and arrives where it was going.
  const wander = (from, to, sway) => {
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]), n = Math.max(2, Math.ceil(length / 3)), nx = -(to[1] - from[1]) / (length || 1), ny = (to[0] - from[0]) / (length || 1), p1 = rand(0, 6.28), p2 = rand(0, 6.28), a2 = rand(0.2, 0.5);
    return Array.from({ length: n + 1 }, (_, i) => { const t = i / n, off = sway * Math.sin(Math.PI * t) * (Math.sin(t * 5 + p1) * (1 - a2) + Math.sin(t * 11 + p2) * a2); return [from[0] + (to[0] - from[0]) * t + nx * off, from[1] + (to[1] - from[1]) * t + ny * off]; });
  };
  const road = (from, to, { wide = 1.8, sway = H * 0.07, floor = 'dirt', style = 'road', name = 'Road', edge = 0.6 } = {}) => { const line = wander(from, to, sway); lines.push({ line, half: wide / 2 }); out.paths.push({ name, floor, style, width: wide, line, edge }); return line; };

  // Where a building's door is, by the side it faces.
  const doorOf = (b) => { const L = b.face === 'n' || b.face === 's' ? b.w : b.h, wide = Math.min(b.doorWide ?? 1, L - 2), from = Math.floor((L - wide) / 2), mid = from + wide / 2; return { from, to: from + wide, at: b.face === 'n' ? [b.x + mid, b.y] : b.face === 's' ? [b.x + b.w - mid, b.y + b.h] : b.face === 'e' ? [b.x + b.w, b.y + mid] : [b.x, b.y + b.h - mid] }; };
  // Furniture in a room: along the walls, in the corners and out in the middle, never in the doorway.
  // (In squares: the layout's own unit. The seed is drawn from the layout's, so the same map furnishes the same way.)
  const furnish = (box, kind, doors = []) => {
    const { things, hearth } = furnishRoom(box, kind, { grid: 1, seed: Math.floor(rnd() * 2 ** 31) + 1, doors });
    for (const t of things) out.things.push({ ...t, flip: false });
    return hearth;
  };
  const MATERIALS = ['timber', 'timber', 'fieldstone', 'dressed', 'brick', 'adobe'];
  const FLOORS = { timber: ['wood', 'planks'], fieldstone: ['wood', 'old'], dressed: ['stone', 'flagstones'], brick: ['wood', 'planks'], adobe: ['stone', 'cobbles'], palisade: ['dirt', 'earth'] };
  // A building where it is asked for, if the ground is free: its floor, door, windows and what stands in it.
  const building = (b) => {
    if (!boxClear(b.x, b.y, b.x + b.w, b.y + b.h, b.room ?? 0.6)) return null;
    boxes.push([b.x, b.y, b.x + b.w, b.y + b.h]);
    const material = b.material ?? pick(MATERIALS), [floor, style] = b.floorOf ?? FLOORS[material] ?? FLOORS.timber, door = doorOf(b), made = { ...b, material, floor: { floor, style }, door, id: `b${out.buildings.length}`, windows: [], inner: [] };
    if (!b.round) for (const side of ['n', 'e', 's', 'w']) {
      if (side === b.face || (b.open ?? []).includes(side)) continue;
      const L = side === 'n' || side === 's' ? b.w : b.h;
      for (const t of L >= 6 ? [0.25, 0.75] : L >= 3 ? [0.5] : []) if (chance(0.85)) { const from = Math.round(L * t - 0.5); made.windows.push({ side, from, to: from + 1 }); }
    }
    // A long house has a room walled off at one end, with its own door.
    let main = { x: b.x, y: b.y, w: b.w, h: b.h }; const doors = [door.at];
    if (b.split && b.w >= 8 && (b.face === 'n' || b.face === 's')) {
      const wx = b.x + b.w - 3, dy = b.y + Math.floor((b.h - 1) / 2);
      made.inner.push({ c: [wx, b.y, wx, b.y + b.h], door: { from: dy - b.y, to: dy - b.y + 1 } });
      doors.push([wx, dy + 0.5]);
      furnish({ x: wx, y: b.y, w: 3, h: b.h }, 'room', doors);
      main = { x: b.x, y: b.y, w: b.w - 3, h: b.h };
    }
    const hearth = b.round ? (furnish({ x: b.x + 0.5, y: b.y + 0.5, w: b.w - 1, h: b.h - 1 }, b.kind, doors), false) : furnish(main, b.kind, doors);
    made.roof = b.roof === false ? false : { ...(b.roof ?? {}), chimney: hearth ? (material === 'brick' || material === 'adobe' ? 'brick' : 'stone') : null };
    out.buildings.push(made);
    return made;
  };
  // A building beside a road: on one side of it, its door to the road.
  const beside = (line, t, side, b, gap = 1) => {
    const p = along(line, t), half = (lines.find((l) => l.line === line)?.half ?? 1), nx = -p.dy * side, ny = p.dx * side;
    if (Math.abs(ny) >= Math.abs(nx)) { const down = ny > 0; return building({ ...b, x: Math.round(p.x - b.w / 2), y: down ? Math.ceil(p.y + half + gap) : Math.floor(p.y - half - gap - b.h), face: down ? 'n' : 's' }); }
    const right = nx > 0;
    return building({ ...b, x: right ? Math.ceil(p.x + half + gap) : Math.floor(p.x - half - gap - b.w), y: Math.round(p.y - b.h / 2), face: right ? 'w' : 'e' });
  };
  // Outside a door: a planter either side of it, and something left against a wall.
  const doorstep = (b) => {
    const [dx, dy] = b.door.at, out1 = b.face === 'n' ? [0, -0.6] : b.face === 's' ? [0, 0.6] : b.face === 'e' ? [0.6, 0] : [-0.6, 0], alongWall = b.face === 'n' || b.face === 's' ? [1.2, 0] : [0, 1.2];
    if (chance(0.7)) for (const s of [-1, 1]) put(pick(['planter', 'pottedPlant', 'pottedPlant']), dx + out1[0] + alongWall[0] * s, dy + out1[1] + alongWall[1] * s, { size: 0.8 });
    if (chance(0.6)) put(pick(['barrel', 'crate', 'sacks']), b.face === 'e' ? b.x - 0.6 : b.x + b.w + 0.6, b.y + rand(0.8, b.h - 0.8), { size: 0.8 });
  };
  const pond = ({ tries = 30, big = 1 } = {}) => {
    for (let i = 0; i < tries; i++) {
      const rx = rand(2.4, 4.2) * big, ry = rand(1.8, 3) * big, cx = rand(rx + 1.5, W - rx - 1.5), cy = rand(ry + 1.5, H - ry - 1.5);
      if (!(cx > rx + 1.5) || !(cy > ry + 1.5) || !boxClear(cx - rx, cy - ry, cx + rx, cy + ry, 1.2)) continue;
      const a = rand(0, 6.28), lobe = { x: cx + Math.cos(a) * rx * 0.7, y: cy + Math.sin(a) * ry * 0.7, rx: rx * 0.55, ry: ry * 0.6 };
      out.water.push({ name: 'Pond', kind: 'still', depth: 'shallow', style: 'shallow', shapes: [{ x: cx, y: cy, radiusX: rx, radiusY: ry }, { x: lobe.x, y: lobe.y, radiusX: lobe.rx, radiusY: lobe.ry }], animals: { fish: 'usual' } });
      for (let k = 0; k < 3; k++) { const t = rand(0, 6.28), r = rand(0.15, 0.6); thing('lilyPads', cx + Math.cos(t) * rx * r, cy + Math.sin(t) * ry * r, { turn: t }); }
      for (let k = 0; k < 6; k++) { const t = rand(0, 6.28); thing(pick(['cattails', 'reeds', 'cattails']), cx + Math.cos(t) * rx * 0.93, cy + Math.sin(t) * ry * 0.93, { turn: t }); }
      if (chance(0.6)) thing('streamRock', cx + rand(-0.4, 0.4) * rx, cy + rand(-0.4, 0.4) * ry, { size: 1 });
      if (rx >= 3 && chance(0.7)) { thing('dock', cx - rx * 0.88, cy, { size: 2.4 }); thing('rowboat', cx - rx * 0.3, cy + ry * 0.3, { size: 1.8, turn: rand(0, 6.28) }); }
      rounds.push({ x: cx, y: cy, rx: rx + 0.4, ry: ry + 0.4 }, { x: lobe.x, y: lobe.y, rx: lobe.rx + 0.4, ry: lobe.ry + 0.4 });
      return { x: cx, y: cy, rx, ry };
    }
    return null;
  };
  // Trees wherever the ground is free; toward the map's edges when `edges`, so the middle stays open.
  const woods = (amount, { edges = true } = {}) => {
    const want = Math.round(W * H * 0.045 * amount);
    for (let i = 0, made = 0; i < want * 6 && made < want; i++) {
      const px = rand(0.6, W - 0.6), py = rand(0.6, H - 0.6), near = Math.min(px, py, W - px, H - py) / (Math.min(W, H) / 2);
      if (edges && rnd() > 0.25 + 0.75 * (1 - near) ** 1.5) continue;
      const kind = pick(TREES[id]), size = (DECOR_KINDS[kind]?.size ?? 2) * rand(1.15, 1.6);
      if (!clear(px, py, Math.max(1, size * 0.3))) continue;
      thing(kind, px, py, { size, turn: rand(0, 6.28), keep: size * 0.3 }); made++;
    }
  };
  const undergrowth = (amount) => { for (let i = 0, n = Math.round(W * H * 0.03 * amount); i < n; i++) put(pick(UNDERGROWTH[id]), rand(0.6, W - 0.6), rand(0.6, H - 0.6), { turn: rand(0, 6.28) }); };
  const lamps = (line, every = 7) => { const total = along(line, 0).length; for (let d = every / 2, side = 1; d < total; d += every, side = -side) { const p = along(line, d / total), half = lines.find((l) => l.line === line)?.half ?? 1; put('lampPost', p.x - p.dy * side * (half + 0.6), p.y + p.dx * side * (half + 0.6), { size: 1 }); } };

  if (W >= SMALLEST_MAP && H >= SMALLEST_MAP * 0.7) {
    if (id === 'village') {
      const main = road([0, H * rand(0.38, 0.62)], [W, H * rand(0.38, 0.62)]);
      // The middle of it: open ground round a well, a stall or two.
      const mid = along(main, rand(0.42, 0.58));
      out.patches.push({ name: 'Village green', floor: 'dirt', style: 'road', edge: 0.8, shape: { x: mid.x, y: mid.y, radiusX: 2.4, radiusY: 2 } });
      thing('well', mid.x, mid.y, { size: 1.5, keep: 1 });
      rounds.push({ x: mid.x, y: mid.y, rx: 2.6, ry: 2.2 });
      // (The pond before the houses: it needs the most room, and the houses find their places round it.)
      if (chance(0.7)) pond();
      const want = Math.max(2, Math.min(8, Math.round((W * H) / 100))), once = new Set();
      for (let i = 0, tries = 0; i < want && tries < 80; tries++) {
        const kind = out.buildings.length === 1 && !once.has('tavern') ? 'tavern' : pick(['home', 'home', 'home', 'home', 'smithy', 'store', 'tower']);
        if (kind !== 'home' && once.has(kind)) continue;
        const size = kind === 'tavern' ? { w: int(7, 9), h: 5, split: true } : kind === 'tower' ? { w: 4, h: 4, round: true, material: 'fieldstone', floorOf: ['stone', 'flagstones'] } : kind === 'smithy' ? { w: 5, h: 4, material: pick(['fieldstone', 'dressed']) } : { w: int(4, 6), h: int(3, 5) };
        const made = beside(main, rand(0.06, 0.94), chance(0.5) ? 1 : -1, { kind, ...size }, int(1, 2));
        if (!made) continue;
        once.add(kind); doorstep(made); i++;
      }
      for (const s of [-1, 1]) if (chance(0.75)) put('marketStall', mid.x + s * rand(2.6, 3.4), mid.y + (chance(0.5) ? 1 : -1) * rand(1.6, 2.2), { size: 2.2, turn: rand(-0.2, 0.2) });
      put('bench', mid.x + rand(-1.5, 1.5), mid.y - 2.6, { turn: 0 });
      lamps(main);
    } else if (id === 'inn') {
      const main = road([0, H * rand(0.4, 0.6)], [W, H * rand(0.4, 0.6)], { wide: 2 });
      if (chance(0.5)) road([W * rand(0.15, 0.3), 0], [W * rand(0.15, 0.3), H], { wide: 1.6, sway: W * 0.04, name: 'Crossroad' });
      const side = chance(0.5) ? 1 : -1;
      let inn = null;
      // (Tried smaller and on either side of the road as the tries run out: a map always has room for some inn.)
      for (let i = 0; i < 80 && !inn; i++) inn = beside(main, rand(0.3, 0.8), i < 40 ? side : -side, { kind: 'tavern', w: i < 20 ? int(8, 10) : 8, h: i < 20 ? int(5, 6) : 5, split: true, material: pick(['timber', 'fieldstone', 'brick']) }, i < 20 ? 2 : 1);
      if (inn) {
        const [dx, dy] = inn.door.at, away = inn.face === 'n' ? -1 : 1;
        out.patches.push({ name: 'Inn yard', floor: 'dirt', style: 'earth', edge: 0.9, shape: { x: dx, y: dy + away * 1.4, radiusX: inn.w * 0.55, radiusY: 2.2 } });
        doorstep(inn);
        // The stable beside it, open to the yard.
        for (const s of [-1, 1]) {
          const stable = building({ kind: 'stable', x: s < 0 ? inn.x - 7 : inn.x + inn.w + 2, y: inn.face === 'n' ? inn.y : inn.y + inn.h - 3, w: 5, h: 3, face: inn.face, open: [inn.face], material: 'palisade', roof: { kind: 'plank', form: 'shed', high: inn.face === 'n' ? 'south' : 'north' } });
          if (stable) { put('trough', stable.x + 2.5, inn.face === 'n' ? stable.y - 0.9 : stable.y + stable.h + 0.9, { turn: 0 }); put('haystack', stable.x + (s < 0 ? -0.9 : stable.w + 0.9), stable.y + 1.5); break; }
        }
        put('well', dx + (chance(0.5) ? 3 : -3), dy + away * 2.4, { size: 1.5 });
        for (let i = 0; i < 3; i++) put(pick(['crate', 'barrel', 'sacks']), inn.x + rand(0.5, inn.w - 0.5), inn.face === 'n' ? inn.y + inn.h + 0.6 : inn.y - 0.6, { size: 0.8 });
      }
      lamps(main, 9);
      if (chance(0.4)) pond({ big: 0.8 });
    } else if (id === 'camp') {
      const cx = W * rand(0.4, 0.6), cy = H * rand(0.4, 0.6), rx = Math.min(W * 0.2, rand(3.6, 5)), ry = Math.min(H * 0.22, rand(3, 4.2));
      // A stream down one side, away from the camp.
      if (W >= 20 && chance(0.65)) {
        const sx = cx < W / 2 ? W * rand(0.78, 0.9) : W * rand(0.1, 0.22), line = wander([sx + rand(-2, 2), 0], [sx + rand(-2, 2), H], W * 0.05);
        lines.push({ line, half: 1.3 });
        out.water.push({ name: 'Stream', kind: 'river', flowTo: 's', depth: 'shallow', style: 'shallow', line, width: 2.2 });
        for (let i = 0; i < 4; i++) { const p = along(line, rand(0.08, 0.92)); thing('streamRock', p.x + rand(-0.4, 0.4), p.y, { size: rand(0.8, 1.2), turn: rand(0, 6.28) }); }
        for (let i = 0; i < 8; i++) { const p = along(line, rand(0.04, 0.96)), s = chance(0.5) ? 1 : -1; thing(pick(['reeds', 'cattails', 'fern']), p.x - p.dy * s * 1.25, p.y + p.dx * s * 1.25, { turn: rand(0, 6.28) }); }
      }
      out.patches.push({ name: 'Clearing', floor: 'dirt', style: 'earth', edge: 1.2, shape: { x: cx, y: cy, radiusX: rx, radiusY: ry } });
      thing('campfire', cx, cy, { size: 1.3 });
      out.lights.push({ x: cx, y: cy, kind: 'bonfire', dim: 30, bright: 12 });
      const turnBy = rand(0, 6.28), tents = int(2, 4);
      for (let i = 0; i < 3; i++) { const a = turnBy + (i / 3) * 6.28 + 0.5; thing('log', cx + Math.cos(a) * 1.7, cy + Math.sin(a) * 1.7, { size: 1.6, turn: a + Math.PI / 2 }); }
      for (let i = 0; i < tents; i++) { const a = turnBy + (i / tents) * 6.28; thing('tent', cx + Math.cos(a) * rx * 0.72, cy + Math.sin(a) * ry * 0.72, { size: 2.2, turn: a + Math.PI }); thing('bedroll', cx + Math.cos(a + 0.5) * rx * 0.45, cy + Math.sin(a + 0.5) * ry * 0.45, { size: 1.2, turn: a }); }
      for (const what of ['crate', 'barrel', 'sacks']) { const a = rand(0, 6.28); thing(what, cx + Math.cos(a) * rx * 0.88, cy + Math.sin(a) * ry * 0.88, { size: 0.8 }); }
      rounds.push({ x: cx, y: cy, rx: rx + 0.3, ry: ry + 0.3 });
      // The way in: a track from the nearest edge of the map on the side the stream is not.
      const to = chance(0.5) ? [cx < W / 2 ? 0 : W, cy + rand(-3, 3)] : [cx + rand(-3, 3), cy < H / 2 ? 0 : H], a = Math.atan2(to[1] - cy, to[0] - cx);
      road([cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9], to, { wide: 1.2, sway: 1.2, style: 'forest', name: 'Track' });
    } else if (id === 'farm') {
      const ty = H * rand(0.42, 0.58), end = [W * rand(0.5, 0.62), ty + rand(-1, 1)], track = road([0, ty], end, { wide: 1.6, sway: H * 0.04, style: 'road', name: 'Farm track' });
      out.patches.push({ name: 'Farmyard', floor: 'dirt', style: 'earth', edge: 0.9, shape: { x: end[0] + 1, y: end[1], radiusX: 4, radiusY: 3 } });
      const house = building({ kind: 'home', x: Math.round(end[0] - 3), y: Math.round(end[1] - 3 - 4), w: 6, h: 4, face: 's', material: pick(['timber', 'fieldstone']) });
      if (house) doorstep(house);
      // The barn across the yard from the track, or wherever beside the yard there is room for it.
      for (const [bx, by, face] of [[5, -2, 'w'], [5, -5, 'w'], [5, 1, 'w'], [-3, 4, 'n'], [1, 4, 'n'], [-11, -8, 's']]) if (building({ kind: 'barn', x: Math.round(end[0] + bx), y: Math.round(end[1] + by), w: 7, h: 5, face, doorWide: 2, material: 'timber', roof: { kind: 'shingle', form: 'gable' } })) break;
      put('well', end[0] + 1, end[1] + 0.4, { size: 1.5 }); put('trough', end[0] - 1.5, end[1] + 2.2); put('haystack', end[0] + 3.4, end[1] + 2.6); put('washtub', end[0] - 2.4, end[1] - 2.2);
      rounds.push({ x: end[0] + 1, y: end[1], rx: 4.2, ry: 3.2 });
      // Fields: turned earth, fenced, with a gap left for the gate.
      for (let i = 0, made = 0; i < 120 && made < 3; i++) {
        const w = int(5, 8), h = int(3, 5), fx = int(1, W - w - 1), fy = int(1, H - h - 1);
        if (!boxClear(fx, fy, fx + w, fy + h, 0.7)) continue;
        out.patches.push({ name: 'Field', floor: 'dirt', style: made === 1 ? 'cracked' : 'earth', edge: 0.3, shape: { x: fx, y: fy, width: w, height: h } });
        if (made === 0) for (let r = 1; r < h; r += 1.5) for (let c = 1; c < w; c += 1.6) thing('produce', fx + c, fy + r, { size: 0.9, turn: 0 });
        else for (let k = 0; k < 3; k++) thing('haystack', fx + rand(1, w - 1), fy + rand(1, h - 1));
        const gate = rand(0.3, 0.6) * w;
        run('stakeFence', [fx, fy], [fx + w, fy]); run('stakeFence', [fx + w, fy], [fx + w, fy + h]); run('stakeFence', [fx, fy + h], [fx, fy]);
        run('stakeFence', [fx + w, fy + h], [fx + gate + 1.5, fy + h]); run('stakeFence', [fx + gate, fy + h], [fx, fy + h]);
        boxes.push([fx, fy, fx + w, fy + h]); made++;
      }
      // An orchard in rows.
      for (let i = 0; i < 30; i++) {
        const ox = int(2, W - 9), oy = int(2, H - 6);
        if (!boxClear(ox, oy, ox + 7, oy + 4.5, 0.8)) continue;
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) thing('fruitTree', ox + 1 + c * 2.6, oy + 1 + r * 2.6, { size: 2.3, turn: rand(0, 6.28), keep: 0.9 });
        boxes.push([ox, oy, ox + 7, oy + 4.5]); break;
      }
      if (chance(0.6)) pond({ big: 0.75 });
      void track;
    } else if (id === 'graveyard') {
      // A fenced yard with its gate to the south, a chapel at the far end, and the graves in their rows between.
      const x0 = 2, y0 = 2, x1 = W - 2, y1 = H - 2, gate = Math.round(W * rand(0.4, 0.6));
      const chapel = building({ kind: 'shrine', x: Math.round(W / 2 - 2.5), y: y0 + 1, w: 5, h: Math.min(7, Math.max(4, Math.round(H * 0.3))), face: 's', material: pick(['dressed', 'fieldstone']), floorOf: ['stone', 'flagstones'], roof: { kind: 'slate', form: 'gable' }, age: 0.5 });
      const to = chapel ? [chapel.door.at[0], chapel.door.at[1] + 0.6] : [W / 2, H / 2];
      road([gate, H], to, { wide: 1.3, sway: 1, style: 'forest', name: 'Churchyard path' });
      run('fence', [x0, y0], [x1, y0]); run('fence', [x1, y0], [x1, y1]); run('fence', [x0, y1], [x0, y0]);
      run('fence', [x1, y1], [gate + 1.2, y1]); run('fence', [gate - 1.2, y1], [x0, y1]);
      for (const s of [-1, 1]) put('lampPost', gate + s * 1.6, y1 - 0.8, { size: 1 });
      // (Rows across the yard, a grave skipped here and there; a tomb now and then among the stones.)
      for (let gy = y0 + 1.6; gy < y1 - 1.2; gy += 2.4) for (let gx = x0 + 1.4; gx < x1 - 1; gx += 1.9) {
        if (chance(0.22) || !clear(gx, gy, 0.7)) continue;
        const what = chance(0.08) ? 'sarcophagus' : chance(0.05) ? 'statue' : 'tombstone';
        thing(what, gx + rand(-0.15, 0.15), gy + rand(-0.15, 0.15), { turn: rand(-0.12, 0.12), keep: 0.6 });
        if (chance(0.25)) thing('flowers', gx + rand(-0.2, 0.2), gy + 0.8, { size: 0.7, turn: rand(0, 6.28) });
        else if (chance(0.12)) thing('bones', gx + 0.5, gy + 0.7, { size: 0.5, turn: rand(0, 6.28) });
      }
    } else if (id === 'harbour') {
      // The water along the south of the map, a cobbled quay above it, piers out from the quay and warehouses behind it.
      const shore = Math.round(H * rand(0.56, 0.66)), quayY = shore - 1.3;
      out.water.push({ name: 'Harbour', kind: 'still', depth: '', style: 'deep', shapes: [{ x: 0, y: shore, width: W, height: H - shore }], animals: { fish: 'usual' } });
      boxes.push([0, shore, W, H]);
      const quay = road([0, quayY], [W, quayY], { wide: 2.6, sway: 0, floor: 'stone', style: 'cobbles', name: 'Quay', edge: 0.3 });
      for (let i = 0, n = Math.max(1, Math.min(4, Math.round(W / 9))); i < n; i++) {
        const px = Math.round(W * ((i + 0.5) / n) + rand(-1.5, 1.5)), long = Math.min(H - shore - 1, rand(3.5, 6));
        out.runs.push({ kind: 'dock', line: [[px, shore - 0.2], [px, shore + long]] });
        thing('mooringPost', px + 0.9, shore + long - 0.5, { size: 0.6 }); thing('mooringPost', px - 0.9, shore + long * 0.5, { size: 0.6 });
        if (chance(0.8)) thing('rowboat', px + (chance(0.5) ? 1.9 : -1.9), shore + rand(1.2, long - 0.6), { size: 2, turn: Math.PI / 2 + rand(-0.3, 0.3) });
      }
      const once = new Set();
      for (let i = 0, tries = 0, want = Math.max(2, Math.min(6, Math.round(W / 7))); i < want && tries < 80; tries++) {
        const kind = !once.has('tavern') && i === 1 ? 'tavern' : 'storeroom';
        const made = beside(quay, rand(0.06, 0.94), -1, kind === 'tavern' ? { kind, w: int(7, 8), h: 5, split: true } : { kind, w: int(5, 8), h: int(4, 5), material: pick(['brick', 'timber', 'fieldstone']), doorWide: 2 }, 1);
        if (!made) continue;
        once.add(kind); if (kind === 'tavern') doorstep(made); i++;
      }
      // What is landed on a quay and not yet carried off.
      for (let i = 0, n = Math.round(W / 3); i < n; i++) put(pick(['crate', 'crate', 'barrel', 'barrel', 'sacks']), rand(1, W - 1), quayY + rand(-0.9, 0.9), { size: rand(0.7, 0.95), turn: rand(0, 6.28) });
      lamps(quay, 8);
    } else if (id === 'ruin') {
      // What is left of a few stone buildings: no roofs, a wall down on one side, rubble where the rooms were, an old
      // paved court in the middle with its pillars, and the green coming back over all of it.
      const cx = W * rand(0.42, 0.58), cy = H * rand(0.42, 0.58);
      out.patches.push({ name: 'Old court', floor: 'stone', style: 'crazy', edge: 1.4, shape: { x: cx, y: cy, radiusX: Math.min(W * 0.2, 5), radiusY: Math.min(H * 0.2, 4) } });
      for (let i = 0, n = int(5, 8); i < n; i++) { const a = (i / n) * 6.28 + rand(-0.1, 0.1); thing(chance(0.5) ? 'brokenPillar' : 'column', cx + Math.cos(a) * Math.min(W * 0.2, 5) * 0.8, cy + Math.sin(a) * Math.min(H * 0.2, 4) * 0.8, { turn: rand(0, 6.28), keep: 0.7 }); }
      thing('statue', cx, cy, { keep: 0.8 });
      rounds.push({ x: cx, y: cy, rx: Math.min(W * 0.2, 5) + 0.4, ry: Math.min(H * 0.2, 4) + 0.4 });
      for (let i = 0, tries = 0, want = Math.max(2, Math.min(5, Math.round((W * H) / 150))); i < want && tries < 120; tries++) {
        const w = int(4, 7), h = int(3, 6), bx = int(2, W - w - 2), by = int(2, H - h - 2), face = pick(['n', 'e', 's', 'w']);
        const made = building({ kind: 'ruin', x: bx, y: by, w, h, face, material: pick(['fieldstone', 'dressed']), floorOf: ['stone', 'crazy'], roof: false, age: rand(0.8, 1), open: chance(0.6) ? [pick(['n', 'e', 's', 'w'].filter((s) => s !== face))] : [] });
        if (made) i++;
      }
      road([chance(0.5) ? 0 : W, cy + rand(-3, 3)], [cx, cy], { wide: 1.2, sway: 1.5, style: 'forest', name: 'Overgrown track' });
      for (let i = 0, n = Math.round((W * H) / 40); i < n; i++) put(pick(['rubble', 'rubble', 'boulder', 'rock', 'bush']), rand(1, W - 1), rand(1, H - 1), { turn: rand(0, 6.28) });
    } else if (id === 'dungeon') {
      // One walled block cut out of solid rock and divided again and again into rooms, a door in every dividing wall:
      // so every room can be reached, and there is always more than one way of getting lost. Each room is something.
      out.ground = { floor: 'glass', style: 'obsidian' }; out.where = 'cave';
      const bx = 2, by = 2, bw = W - 4, bh = H - 4, face = pick(['s', 's', 'n', 'e', 'w']), shell = { x: bx, y: by, w: bw, h: bh, face };
      const front = doorOf(shell), doors = [front.at], inner = [], rooms = [], least = 4;
      const nearDoor = (px, py) => doors.some((d) => Math.hypot(d[0] - px, d[1] - py) < 1.3);
      const divide = (r, depth) => {
        // (Across its longer side, where there is room for a room either side of the new wall.)
        const wide = r.w >= least * 2, tall = r.h >= least * 2, across = wide && (!tall || r.w >= r.h);
        if (!(wide || tall) || depth >= 5 || (depth >= 2 && r.w * r.h <= 40 && chance(0.5))) { rooms.push(r); return; }
        for (let tries = 0; tries < 10; tries++) {
          const at = across ? int(r.x + least, r.x + r.w - least) : int(r.y + least, r.y + r.h - least);
          // (A wall never ends in a doorway of the wall it runs into.)
          const a = across ? [at, r.y] : [r.x, at], b = across ? [at, r.y + r.h] : [r.x + r.w, at];
          if (nearDoor(a[0], a[1]) || nearDoor(b[0], b[1])) continue;
          const long = across ? r.h : r.w, d = int(1, Math.max(1, long - 2));
          inner.push({ c: [a[0], a[1], b[0], b[1]], door: { from: d, to: d + 1 } });
          doors.push(across ? [at, r.y + d + 0.5] : [r.x + d + 0.5, at]);
          if (across) { divide({ x: r.x, y: r.y, w: at - r.x, h: r.h }, depth + 1); divide({ x: at, y: r.y, w: r.x + r.w - at, h: r.h }, depth + 1); }
          else { divide({ x: r.x, y: r.y, w: r.w, h: at - r.y }, depth + 1); divide({ x: r.x, y: at, w: r.w, h: r.y + r.h - at }, depth + 1); }
          return;
        }
        rooms.push(r);
      };
      divide({ x: bx, y: by, w: bw, h: bh }, 0);
      const kinds = ['guardroom', 'storeroom', 'prison', 'crypt', 'shrine', 'library', 'hall', 'lair', 'treasury', 'lair', 'storeroom'];
      for (const [i, r] of rooms.entries()) {
        const beside = doors.filter((d) => d[0] >= r.x - 0.2 && d[0] <= r.x + r.w + 0.2 && d[1] >= r.y - 0.2 && d[1] <= r.y + r.h + 0.2);
        furnish(r, i === 0 ? 'guardroom' : r.w * r.h >= 60 ? 'hall' : pick(kinds), beside);
      }
      boxes.push([bx, by, bx + bw, by + bh]);
      out.buildings.push({ kind: 'dungeon', x: bx, y: by, w: bw, h: bh, face, door: front, material: pick(['dressed', 'hewn', 'brick']), floor: { floor: 'stone', style: 'dungeon' }, windows: [], inner, roof: false, age: rand(0.35, 0.7), id: 'b0', rooms: rooms.length });
      const outTo = face === 's' ? [front.at[0], H] : face === 'n' ? [front.at[0], 0] : face === 'e' ? [W, front.at[1]] : [0, front.at[1]];
      out.paths.push({ name: 'Way in', floor: 'stone', style: 'flagstones', width: 1.4, line: [front.at, outTo], edge: 0.2 });
      for (const s of [-1, 1]) out.lights.push({ x: front.at[0] + (face === 'n' || face === 's' ? s * 1.3 : 0), y: front.at[1] + (face === 'e' || face === 'w' ? s * 1.3 : 0), kind: 'torch', dim: 20, bright: 8 });
    } else if (id === 'cave') {
      // A cavern in solid rock: a ragged wall round it with a way in, pillars of rock left standing, a pool, and what
      // grows and lies in the dark. Its wall is real walls, so sight stops at the rock.
      out.ground = { floor: 'glass', style: 'obsidian' }; out.where = 'cave';
      const cx = W / 2, cy = H / 2, rx = W / 2 - 2, ry = H / 2 - 2, n = Math.max(18, Math.round((W + H) / 2.2)), p1 = rand(0, 6.28), p2 = rand(0, 6.28), p3 = rand(0, 6.28);
      const ring = Array.from({ length: n }, (_, i) => { const a = (i / n) * 6.28318, r = 0.7 + 0.16 * Math.sin(a * 2 + p1) + 0.09 * Math.sin(a * 5 + p2) + 0.05 * Math.sin(a * 9 + p3); return [cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r]; });
      const mouth = int(0, n - 1), gap = [mouth, (mouth + 1) % n];
      out.walls.push({ line: ring, closed: true, material: 'natural', thick: 0.34, age: 0.6, gap });
      out.patches.push({ name: 'Cavern floor', floor: 'stone', style: 'cave', edge: 0.4, points: ring });
      const inRing = (px, py) => { let hit = false; for (let i = 0, j = n - 1; i < n; j = i++) if ((ring[i][1] > py) !== (ring[j][1] > py) && px < ((ring[j][0] - ring[i][0]) * (py - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]) hit = !hit; return hit; };
      const closedRing = [...ring, ring[0]], deep = (px, py, r = 1) => inRing(px, py) && toLine(closedRing, px, py) > r && clear(px, py, 0.4);
      const spot = (r = 1, tries = 40) => { for (let i = 0; i < tries; i++) { const px = rand(cx - rx, cx + rx), py = rand(cy - ry, cy + ry); if (deep(px, py, r)) return [px, py]; } return null; };
      // The way in: from the mouth out to the nearest edge of the map.
      const m0 = ring[gap[0]], m1 = ring[(gap[1] + 1) % n], mid = [(m0[0] + m1[0]) / 2, (m0[1] + m1[1]) / 2], a = Math.atan2(mid[1] - cy, mid[0] - cx);
      out.paths.push({ name: 'Cave mouth', floor: 'stone', style: 'cave', width: 2, line: [[cx + Math.cos(a) * rx * 0.45, cy + Math.sin(a) * ry * 0.45], [mid[0] + Math.cos(a) * (W + H), mid[1] + Math.sin(a) * (W + H)]], edge: 0.5 });
      // Pillars of rock: a small ring of wall each, with what has fallen from them round their feet.
      for (let i = 0, want = Math.max(1, Math.round((W * H) / 180)); i < want; i++) {
        const at = spot(2.6) ?? spot(1.9, 80); if (!at) break;
        const r = rand(0.8, 1.5), sides = 7, turn = rand(0, 6.28);
        out.walls.push({ line: Array.from({ length: sides }, (_, k) => [at[0] + Math.cos(turn + (k / sides) * 6.283) * r * rand(0.8, 1.15), at[1] + Math.sin(turn + (k / sides) * 6.283) * r * rand(0.8, 1.15)]), closed: true, material: 'natural', thick: 0.34, age: 0.6 });
        rounds.push({ x: at[0], y: at[1], rx: r + 0.5, ry: r + 0.5 });
        for (let k = 0; k < 3; k++) { const t = rand(0, 6.28); thing(pick(['rubble', 'rock', 'stalagmite']), at[0] + Math.cos(t) * (r + 0.7), at[1] + Math.sin(t) * (r + 0.7), { turn: t }); }
      }
      // A pool where the floor is lowest.
      const pool = spot(3);
      if (pool) { const pr = rand(1.4, 2.4); out.water.push({ name: 'Cave pool', kind: 'still', depth: 'deep', style: 'dark', shapes: [{ x: pool[0], y: pool[1], radiusX: pr, radiusY: pr * rand(0.6, 0.9) }] }); rounds.push({ x: pool[0], y: pool[1], rx: pr + 0.3, ry: pr + 0.3 }); for (let k = 0; k < 3; k++) { const t = rand(0, 6.28); thing(pick(['glowShrooms', 'rock', 'lichen']), pool[0] + Math.cos(t) * (pr + 0.5), pool[1] + Math.sin(t) * (pr * 0.8 + 0.5), { turn: t }); } }
      // Whoever was here last: a dead fire and what they left by it.
      const camp = spot(2);
      if (camp && chance(0.7)) { thing('campfire', camp[0], camp[1], { keep: 1 }); thing('bedroll', camp[0] + 1.3, camp[1] + 0.4, { turn: rand(0, 6.28) }); if (chance(0.5)) thing('bones', camp[0] - 1, camp[1] + 0.8); if (chance(0.4)) thing('treasure', camp[0] - 0.4, camp[1] - 1.2, { size: 0.9 }); }
      for (let i = 0, want = Math.round((W * H) / 14); i < want; i++) { const at = spot(0.9, 8); if (!at) continue; const what = pick(['stalagmite', 'stalagmite', 'stalagmite', 'rock', 'boulder', 'glowShrooms', 'crystals', 'bones', 'fissure', 'lichen', 'rubble', 'column']), size = DECOR_KINDS[what]?.size ?? 1; thing(what, at[0], at[1], { turn: rand(0, 6.28), keep: DECOR_KINDS[what]?.flat ? 0 : size * 0.4 }); }
      // Cobwebs where the wall turns in.
      for (let i = 0; i < n; i += 3) if (chance(0.5) && !gap.includes(i)) { const p = ring[i]; thing('cobweb', p[0] + (cx - p[0]) * 0.08, p[1] + (cy - p[1]) * 0.08, { turn: rand(0, 6.28) }); }
    }
  }
  // (Nothing grows in solid rock: a dungeon and a cave have neither woods nor undergrowth.)
  if (out.where !== 'cave') {
    woods(wooded * (id === 'camp' ? 3 : id === 'farm' ? 0.5 : 1), { edges: id !== 'camp' });
    undergrowth(id === 'camp' ? 1.6 : 1);
  }

  // Out of squares, into the scene's pixels.
  const X = (v) => x + v * grid, Y = (v) => y + v * grid, G = (v) => v * grid;
  const shape = (s) => (s.width ? { x: X(s.x), y: Y(s.y), width: G(s.width), height: G(s.height) } : { x: X(s.x), y: Y(s.y), radiusX: G(s.radiusX), radiusY: G(s.radiusY) });
  return {
    preset: id, seed: Number(seed) >>> 0, x, y, width, height, ground: out.ground,
    where: out.where,
    walls: out.walls.map((w) => ({ ...w, line: w.line.map(([px, py]) => [X(px), Y(py)]) })),
    patches: out.patches.map((p) => (p.points ? { ...p, points: undefined, shape: { points: p.points.flatMap(([px, py]) => [X(px), Y(py)]) } } : { ...p, shape: shape(p.shape) })),
    paths: out.paths.map((p) => ({ ...p, width: G(p.width), line: p.line.map(([px, py]) => [X(px), Y(py)]) })),
    water: out.water.map((w) => (w.line ? { ...w, width: G(w.width), line: w.line.map(([px, py]) => [X(px), Y(py)]) } : { ...w, shapes: w.shapes.map(shape) })),
    buildings: out.buildings.map((b) => ({ id: b.id, name: b.kind, kind: b.kind, x: X(b.x), y: Y(b.y), w: G(b.w), h: G(b.h), round: !!b.round, material: b.material, ...(b.age != null ? { age: b.age } : {}), floor: b.floor, open: b.open ?? [], roof: b.roof,
      doors: (b.open ?? []).includes(b.face) ? [] : [{ side: b.face, from: G(b.door.from), to: G(b.door.to), angle: SIDE_TURN[b.face] - Math.PI / 2 }],
      windows: b.windows.map((o) => ({ side: o.side, from: G(o.from), to: G(o.to) })),
      inner: b.inner.map((part) => ({ c: [X(part.c[0]), Y(part.c[1]), X(part.c[2]), Y(part.c[3])], door: part.door ? { from: G(part.door.from), to: G(part.door.to) } : null })) })),
    things: out.things.map((t) => ({ ...t, x: X(t.x), y: Y(t.y) })),
    runs: out.runs.map((r) => ({ kind: r.kind, line: r.line.map(([px, py]) => [X(px), Y(py)]) })),
    lights: out.lights.map((l) => ({ ...l, x: X(l.x), y: Y(l.y) })),
  };
}
