// A map from nothing: a plan of what stands where, turned into the documents the module already paints (pure).
//
// The plan is a small description in scene pixels — the ground, the paths over it, the water, the buildings and the
// things standing about. Nothing here draws: each part becomes exactly what the Map painting brush would have written
// for it by hand (a floor region, painted walls, a roof, a decorations region, a fire light), so a built map is an
// ordinary painted map and every tool that edits one edits this.
//
// Everything made is marked as built (flags.animater.built, and a roof's id begins BUILT_ROOF), so building again or
// clearing takes away only what the builder put down and never a GM's own work.

import { DECOR_KINDS } from '../motion/decor-paint.mjs';
import { doorFor } from '../motion/door-paint.mjs';
import { roofFor, formFor } from '../motion/roof-paint.mjs';
import { windowFor } from '../motion/window-paint.mjs';
import { WALL_THICK } from '../motion/wall-paint.mjs';
import { floorColour } from '../regions/floor-detect.mjs';
import { pathPieces } from './path-lay.mjs';

/** A built roof's id begins with this: roofs are one list in a scene flag, with no flags of their own to mark. */
export const BUILT_ROOF = 'built-';
/** The most decorations one region holds (decor-regions.mjs keeps 600): more are laid in a second region. */
export const THINGS_A_REGION = 500;
/** How many sides a round building's wall is laid in. */
export const ROUND_SIDES = 16;

const SIDES = ['n', 'e', 's', 'w'];
const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);

/** A strip `width` wide along a line of [x, y] points, as a polygon's flat points (pure). */
export function ribbon(line = [], width = 100) {
  const left = [], right = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)], d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = (-(b[1] - a[1]) / d) * width / 2, ny = ((b[0] - a[0]) / d) * width / 2;
    left.push(line[i][0] + nx, line[i][1] + ny); right.unshift(line[i][0] - nx, line[i][1] - ny);
  }
  return line.length > 1 ? [...left, ...right].map((v) => Math.round(v)) : [];
}

const shapeOf = (s) => {
  if (!s) return null;
  if (Array.isArray(s.points) && s.points.length >= 6) return { type: 'polygon', points: s.points.map((v) => Math.round(v)), hole: false };
  if (s.radiusX > 0 && s.radiusY > 0) return { type: 'ellipse', x: Math.round(s.x), y: Math.round(s.y), radiusX: Math.round(s.radiusX), radiusY: Math.round(s.radiusY), rotation: 0, hole: false };
  if (s.width > 0 && s.height > 0) return { type: 'rectangle', x: Math.round(s.x), y: Math.round(s.y), width: Math.round(s.width), height: Math.round(s.height), rotation: 0, hole: false };
  return null;
};
// A painted floor's flags, as the brush writes them: its pattern, and a soft edge or a hard one.
const floorFlags = ({ floor, style = '', edge = 1 }) => ({ floor, texture: 'on', ...(style ? { textureStyles: { [floor]: style } } : {}), ...(edge > 0 ? { stepEdge: edge } : { stepEdgeOff: true }) });
/** The floor a building of some material usually has: [floor, pattern]. */
export const floorFor = (material) => ({ timber: ['wood', 'planks'], fieldstone: ['wood', 'old'], dressed: ['stone', 'flagstones'], brick: ['wood', 'planks'], adobe: ['stone', 'cobbles'], palisade: ['dirt', 'earth'], hewn: ['stone', 'dungeon'], natural: ['stone', 'cave'] }[material] ?? ['wood', 'planks']);

// One side of a box as walls, with its doors and windows let into it. Corners are whole pixels, so the runs join.
const sideWalls = (a, b, openings, wall) => {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]), at = (t) => [Math.round(a[0] + ((b[0] - a[0]) * t) / len), Math.round(a[1] + ((b[1] - a[1]) * t) / len)];
  const out = [];
  let t = 0;
  for (const o of [...openings].sort((p, q) => p.from - q.from)) {
    const from = Math.max(t, Math.min(len, num(o.from))), to = Math.max(from, Math.min(len, num(o.to)));
    if (!(to > from)) continue;
    if (from > t) out.push(wall([...at(t), ...at(from)]));
    out.push(wall([...at(from), ...at(to)], o));
    t = to;
  }
  if (t < len) out.push(wall([...at(t), ...at(len)]));
  return out;
};

/**
 * The documents a plan makes: { regions, walls, lights, roofs }. `grid` the scene's square in pixels.
 *
 * plan = {
 *   x, y, width, height            the map, scene pixels
 *   ground: { floor, style }       what lies under everything
 *   patches: [{ name, floor, style, edge, shape | shapes }]            a yard, a field, a clearing
 *   paths:   [{ name, floor, style, edge, width, line: [[x, y]…] }]    a road, a track
 *   water:   [{ name, kind, flowTo, depth, style, shapes | (line, width), animals }]
 *   buildings: [{ id, name, x, y, w, h, round, material, age, floor: { floor, style }, open: ['e'],
 *                 doors: [{ side, from, to, kind, angle }], windows: [{ side, from, to, kind }],
 *                 inner: [{ c: [x1, y1, x2, y2], door: { from, to } }], roof: { kind, form, high, chimney } | false }]
 *   things: [{ kind, x, y, size, turn, flip }]      decorations, by their kind (decor-paint.mjs)
 *   runs:   [{ kind, line: [[x, y]…] }]             a fence or hedge along a line, by its path kind (path-lay.mjs)
 *   lights: [{ x, y, kind, dim, bright, color }]    fires
 * }
 * A shape is { x, y, width, height }, { x, y, radiusX, radiusY } or { points }. An opening's from/to are pixels along
 * its side, clockwise from the side's first corner (n: west to east, e: north to south, s: east to west, w: south to north).
 */
export function planDocuments(plan = {}, { grid = 100, mark = true } = {}) {
  // (`mark` false: nothing is marked as built. For what a GM lays by hand out of the same parts — a whole building in
  // one drag — which is their own work, and not the builder's to clear away.)
  const regions = [], walls = [], lights = [], roofs = [], tag = mark ? { built: true } : {};
  const region = (name, floor, shapes, own) => ({ name, color: floorColour(floor), shapes, flags: { animater: { ...own, ...tag } } });
  const mapX = num(plan.x), mapY = num(plan.y), mapW = num(plan.width), mapH = num(plan.height);

  if (plan.ground?.floor && mapW > 0 && mapH > 0) regions.push(region('Ground', plan.ground.floor, [shapeOf({ x: mapX, y: mapY, width: mapW, height: mapH })], { ...floorFlags({ ...plan.ground, edge: 0 }), wholeMap: true }));
  for (const p of plan.patches ?? []) {
    const shapes = (p.shapes ?? [p.shape]).map(shapeOf).filter(Boolean);
    if (p.floor && shapes.length) regions.push(region(p.name ?? 'Ground patch', p.floor, shapes, floorFlags(p)));
  }
  for (const p of plan.paths ?? []) {
    const points = ribbon(p.line, num(p.width, grid));
    if (p.floor && points.length >= 6) regions.push(region(p.name ?? 'Path', p.floor, [{ type: 'polygon', points, hole: false }], floorFlags({ edge: 0.6, ...p })));
  }
  for (const w of plan.water ?? []) {
    const shapes = w.line ? [shapeOf({ points: ribbon(w.line, num(w.width, grid * 2)) })].filter(Boolean) : (w.shapes ?? [w.shape]).map(shapeOf).filter(Boolean);
    if (!shapes.length) continue;
    const kind = w.kind ?? 'still';
    regions.push(region(w.name ?? (kind === 'still' ? 'Pond' : 'Stream'), 'water', shapes, { floor: 'water', waterKind: kind, flowTo: kind === 'still' ? '' : (w.flowTo ?? 's'), current: '', waterDepth: w.depth ?? 'shallow', texture: 'on', textureStyles: { water: w.style ?? 'shallow' }, ...(w.animals ? { regionAnimals: w.animals } : {}) }));
  }

  for (const [i, b] of (plan.buildings ?? []).entries()) {
    const x = Math.round(num(b.x)), y = Math.round(num(b.y)), w = Math.round(num(b.w)), h = Math.round(num(b.h));
    if (!(w > 0) || !(h > 0)) continue;
    const material = b.material ?? 'timber', age = num(b.age, 0.25), id = `${mark ? BUILT_ROOF : ''}${b.id ?? i}`;
    const wall = (c, opening = null) => {
      const own = { material, age, thick: num(b.thick, WALL_THICK), ...(b.tint ? { tint: b.tint } : {}), ...tag };
      if (opening?.door) return { c, door: 1, ds: 0, flags: { animater: { ...own, door: opening.kind ?? doorFor(material), hinge: 'near', swing: 'in' } } };
      if (opening) return { c, flags: { animater: { ...own, window: opening.kind ?? windowFor(material), windowOpen: false, windowSlats: false, windowWalk: false, swing: 'in' } } };
      return { c, flags: { animater: own } };
    };
    if (b.floor?.floor) regions.push(region(`${b.name ?? 'Building'} floor`, b.floor.floor, [b.round ? shapeOf({ x: x + w / 2, y: y + h / 2, radiusX: w / 2, radiusY: h / 2 }) : shapeOf({ x, y, width: w, height: h })], floorFlags({ ...b.floor, edge: 0 })));
    if (b.round) {
      // A ring of straight walls; the door is the one that faces the way it is asked to (radians, 0 east, π/2 south).
      const cx = x + w / 2, cy = y + h / 2, ring = Array.from({ length: ROUND_SIDES }, (_, k) => { const a = ((k + 0.5) / ROUND_SIDES) * Math.PI * 2; return [Math.round(cx + (Math.cos(a) * w) / 2), Math.round(cy + (Math.sin(a) * h) / 2)]; });
      const door = (b.doors ?? [])[0], want = door ? num(door.angle, Math.PI / 2) : null;
      const turn = (a) => Math.abs(Math.atan2(Math.sin(a - want), Math.cos(a - want)));
      const doorAt = want === null ? -1 : Array.from({ length: ROUND_SIDES }, (_, k) => k).sort((p, q) => turn(((p + 1) / ROUND_SIDES) * Math.PI * 2) - turn(((q + 1) / ROUND_SIDES) * Math.PI * 2))[0];
      for (let k = 0; k < ROUND_SIDES; k++) walls.push(wall([...ring[k], ...ring[(k + 1) % ROUND_SIDES]], k === doorAt ? { door: true, kind: door.kind } : null));
    } else {
      const corners = { n: [[x, y], [x + w, y]], e: [[x + w, y], [x + w, y + h]], s: [[x + w, y + h], [x, y + h]], w: [[x, y + h], [x, y]] };
      for (const side of SIDES) {
        if ((b.open ?? []).includes(side)) continue;
        const openings = [...(b.doors ?? []).filter((d) => d.side === side).map((d) => ({ ...d, door: true })), ...(b.windows ?? []).filter((d) => d.side === side)];
        walls.push(...sideWalls(corners[side][0], corners[side][1], openings, wall));
      }
    }
    for (const part of b.inner ?? []) {
      if (!Array.isArray(part.c) || part.c.length !== 4) continue;
      walls.push(...sideWalls([part.c[0], part.c[1]], [part.c[2], part.c[3]], part.door ? [{ ...part.door, door: true }] : [], wall));
    }
    if (b.roof !== false) {
      const room = { x, y, w, h }, form = b.round ? 'cone' : (b.roof?.form ?? formFor(room, { grid }));
      roofs.push({ id, x, y, w, h, kind: b.roof?.kind ?? roofFor(material), form, round: !!b.round, ...(form === 'shed' ? { high: b.roof?.high ?? 'north' } : {}), age, chimney: b.roof?.chimney ?? null, material, ...(b.roof?.tint ? { tint: b.roof.tint } : {}), ...(b.roof?.dressed ? { dressed: true } : {}) });
    }
  }

  // Free walls: a line of rock round a cavern, a pillar left standing. One wall a leg; `closed` joins the last point
  // to the first, `gap` leaves the legs out that start at those points (a way in).
  for (const w of plan.walls ?? []) {
    const line = Array.isArray(w.line) ? w.line : [], last = w.closed ? line.length : line.length - 1, skip = new Set(w.gap ?? []);
    for (let i = 0; i < last; i++) {
      if (skip.has(i)) continue;
      const a = line[i], b = line[(i + 1) % line.length], c = [Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1])];
      if (c[0] === c[2] && c[1] === c[3]) continue;
      walls.push({ c, flags: { animater: { material: w.material ?? 'natural', age: num(w.age, 0.5), thick: num(w.thick, WALL_THICK), ...tag } } });
    }
  }

  // Decorations: the kinds the module knows, standing on the map, a region's worth at a time.
  const things = (plan.things ?? []).filter((t) => DECOR_KINDS[t.kind] && num(t.x, NaN) >= mapX && num(t.x, NaN) <= mapX + mapW && num(t.y, NaN) >= mapY && num(t.y, NaN) <= mapY + mapH)
    .map((t, i) => ({ kind: t.kind, x: Math.round(t.x), y: Math.round(t.y), size: num(t.size, DECOR_KINDS[t.kind].size ?? 1), turn: num(t.turn), seed: ((i + 1) * 7919 + Math.round(t.x) * 31 + Math.round(t.y) * 17) >>> 0, flip: !!t.flip, ...(t.fixed ? { fixed: true } : {}) }));
  // Runs: a fence or a hedge along a line, laid piece on piece as the Paths tab lays one (path-lay.mjs).
  for (const [i, r] of (plan.runs ?? []).entries()) things.push(...pathPieces(r.kind, r.line ?? [], { grid, seed: 1000 + i * 131, smooth: false }));
  for (let i = 0; i < things.length; i += THINGS_A_REGION) {
    regions.push({ name: i ? `Things on the map ${i / THINGS_A_REGION + 1}` : 'Things on the map', color: '#c0a060', shapes: [shapeOf({ x: mapX, y: mapY, width: mapW, height: mapH })],
      flags: { animater: { ...tag, decor: { on: true, where: plan.where === 'cave' ? 'cave' : 'surface', density: 0, scale: 1, height: 1, seed: i + 7, kinds: {}, brushed: things.slice(i, i + THINGS_A_REGION), erased: [] } } } });
  }

  for (const l of plan.lights ?? []) {
    if (!Number.isFinite(Number(l.x)) || !Number.isFinite(Number(l.y))) continue;
    lights.push({ x: Math.round(l.x), y: Math.round(l.y), config: { dim: num(l.dim, 30), bright: num(l.bright, 12), color: l.color ?? '#ff9a48', alpha: 0.45, animation: { type: 'torch', speed: 4, intensity: 4 } }, flags: { animater: { ...tag, fireKind: l.kind ?? 'bonfire', flame: true } } });
  }
  return { regions, walls, lights, roofs };
}

/**
 * A whole building for a box dragged on the map (pure): what planDocuments takes as one of its `buildings`. Its door
 * is in the middle of the side it faces (`face`: n, e, s or w), a square wide; a window in each other side long enough
 * for one, two in a long side. Its floor is the usual one for what it is built of.
 */
export function houseFrom(box, { grid = 100, face = 's', material = 'timber', age = 0, thick = null, tint = null, doorKind = null, windowKind = null, roof = {}, id = null } = {}) {
  const x = Math.round(box.x), y = Math.round(box.y), w = Math.round(box.w), h = Math.round(box.h);
  if (!(w >= grid) || !(h >= grid)) return null;
  const long = (side) => (side === 'n' || side === 's' ? w : h) / grid, [floor, style] = floorFor(material);
  const at = (side, t) => { const from = Math.max(0, Math.round(long(side) * t - 0.5)) * grid; return { side, from, to: Math.min(long(side) * grid, from + grid) }; };
  const windows = SIDES.filter((side) => side !== face).flatMap((side) => (long(side) >= 6 ? [at(side, 0.25), at(side, 0.75)] : long(side) >= 3 ? [at(side, 0.5)] : [])).map((o) => ({ ...o, ...(windowKind ? { kind: windowKind } : {}) }));
  return { id: id ?? `h${x}_${y}`, name: 'Building', x, y, w, h, material, age, ...(thick ? { thick } : {}), ...(tint ? { tint } : {}), floor: { floor, style },
    doors: [{ ...at(face, 0.5), ...(doorKind ? { kind: doorKind } : {}) }], windows, roof };
}

/** What of a scene the builder made: the ids to take away, and the roofs that stay (pure). */
export function builtOf({ regions = [], walls = [], lights = [], roofs = [] } = {}) {
  const mine = (doc) => doc?.flags?.animater?.built === true;
  return { regions: regions.filter(mine).map((d) => d.id), walls: walls.filter(mine).map((d) => d.id), lights: lights.filter(mine).map((d) => d.id), roofsKept: (Array.isArray(roofs) ? roofs : []).filter((r) => !String(r?.id ?? '').startsWith(BUILT_ROOF)) };
}
