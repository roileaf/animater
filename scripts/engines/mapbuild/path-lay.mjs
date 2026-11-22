// Paths: a line drawn across the map, laid as what it is (pure). A road, a track or a stream is a painted floor as
// wide as it is asked to be, following the line. A fence, a hedge or a row of stepping stones is its decoration laid
// piece after piece along the line, each turned to it — a fence is one thing going somewhere, not a stamp.
//
// (Roi: "the fence decoration is only single part maybe we need a path tool of some sort".)

import { DECOR_KINDS, bakedLean, runSpan, runBlocks } from '../motion/decor-paint.mjs';
import { floorColour } from '../regions/floor-detect.mjs';
import { ribbon } from './map-plan.mjs';

/**
 * What a path can be. `type` 'floor' (a painted floor), 'water' (moving water) or 'pieces' (a decoration, laid in a
 * run). `wide` its usual width in squares (a floor or water) or how big each piece is, as times its usual (pieces).
 * `rigid` pieces fill each straight leg exactly, end on end, and turn only at the corners; the rest follow the line
 * wherever it bends.
 */
export const PATH_KINDS = Object.freeze({
  road: { label: 'Dirt road', group: 'Ground', type: 'floor', floor: 'dirt', style: 'road', wide: 1.8, edge: 0.6 },
  track: { label: 'Forest track', group: 'Ground', type: 'floor', floor: 'dirt', style: 'forest', wide: 1.1, edge: 0.7 },
  street: { label: 'Cobbled street', group: 'Ground', type: 'floor', floor: 'stone', style: 'cobbles', wide: 2, edge: 0.3 },
  gravel: { label: 'Gravel path', group: 'Ground', type: 'floor', floor: 'pebbles', style: 'gravel', wide: 1.2, edge: 0.5 },
  boardwalk: { label: 'Boardwalk or bridge', group: 'Ground', type: 'floor', floor: 'wood', style: 'deck', wide: 1.5, edge: 0, overWater: true },
  stream: { label: 'Stream', group: 'Water', type: 'water', waterKind: 'river', style: 'shallow', depth: 'shallow', wide: 2, edge: 1 },
  river: { label: 'River', group: 'Water', type: 'water', waterKind: 'river', style: 'deep', depth: '', wide: 4.5, edge: 1 },
  fence: { label: 'Fence', group: 'Laid', type: 'pieces', kind: 'fence', rigid: true, wide: 1 },
  stakeFence: { label: 'Stake fence', group: 'Laid', type: 'pieces', kind: 'stakeFence', rigid: true, wide: 1 },
  rails: { label: 'Cart rails', group: 'Laid', type: 'pieces', kind: 'rails', rigid: true, wide: 1 },
  dock: { label: 'Pier', group: 'Laid', type: 'pieces', kind: 'dock', rigid: true, wide: 1 },
  hedge: { label: 'Hedge', group: 'Laid', type: 'pieces', kind: 'bush', wide: 1, close: 0.7 },
  stones: { label: 'Stepping stones', group: 'Laid', type: 'pieces', kind: 'steppingStones', wide: 0.8, close: 0.8 },
  boulders: { label: 'Row of rocks', group: 'Laid', type: 'pieces', kind: 'boulder', wide: 0.8, close: 0.9 },
  paving: { label: 'Paving', group: 'Laid', type: 'pieces', kind: 'cobbles', wide: 1, close: 0.75 },
});
export const PATH_IDS = Object.freeze(Object.keys(PATH_KINDS).filter((id) => PATH_KINDS[id].type !== 'pieces' || DECOR_KINDS[PATH_KINDS[id].kind]));
/** How wide a floor path may be, in squares, and how big a laid piece, as times its usual. */
export const PATH_WIDE = Object.freeze({ min: 0.5, max: 8, step: 0.25 });
export const PATH_PIECE = Object.freeze({ min: 0.5, max: 2, step: 0.1 });
export const pathKind = (id) => PATH_KINDS[id] ?? PATH_KINDS.road;
export const pathWideOf = (id, wide) => { const k = pathKind(id), b = k.type === 'pieces' ? PATH_PIECE : PATH_WIDE, v = Number(wide); return Number.isFinite(v) && v > 0 ? Math.min(b.max, Math.max(b.min, v)) : k.wide; };

const length = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
/** A drawn line with its doubled and too-close points taken out (pure): `least` apart, the ends always kept. */
export function tidyLine(points = [], least = 4) {
  const out = [];
  for (const p of points) { const q = [Number(p?.[0] ?? p?.x), Number(p?.[1] ?? p?.y)]; if (!Number.isFinite(q[0]) || !Number.isFinite(q[1])) continue; if (!out.length || length(out.at(-1), q) >= least) out.push(q); }
  return out;
}
/** The line with its corners rounded off (pure, Chaikin's corner cutting): it still starts and ends where it did. */
export function smoothLine(points = [], rounds = 3) {
  let line = points.map((p) => [p[0], p[1]]);
  for (let r = 0; r < rounds && line.length > 2; r++) {
    const next = [line[0]];
    for (let i = 0; i + 1 < line.length; i++) { const a = line[i], b = line[i + 1]; next.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    next.push(line.at(-1)); line = next;
  }
  return line;
}
// Which way water runs along its line, as the region panel names it.
const TOWARD = ['e', 'se', 's', 'sw', 'w', 'nw', 'n', 'ne'];
export const flowAlong = (points) => { const a = points[0], b = points.at(-1); return TOWARD[((Math.round(Math.atan2(b[1] - a[1], b[0] - a[0]) / (Math.PI / 4)) % 8) + 8) % 8]; };

/** The shapes of a strip `width` wide along a line: one ribbon when smooth, else a box a leg with a round at each corner. */
export function pathShapes(points, width, smooth = true) {
  if (points.length < 2 || !(width > 0)) return [];
  if (smooth) { const flat = ribbon(smoothLine(points), width); return flat.length >= 6 ? [{ type: 'polygon', points: flat, hole: false }] : []; }
  const shapes = [];
  for (let i = 0; i + 1 < points.length; i++) { const flat = ribbon([points[i], points[i + 1]], width); if (flat.length >= 6) shapes.push({ type: 'polygon', points: flat, hole: false }); }
  for (let i = 1; i + 1 < points.length; i++) shapes.push({ type: 'ellipse', x: Math.round(points[i][0]), y: Math.round(points[i][1]), radiusX: Math.round(width / 2), radiusY: Math.round(width / 2), rotation: 0, hole: false });
  return shapes;
}

/**
 * The pieces of a run along a line (pure): what a decorations region keeps as its hand-placed ones. `scale` how big
 * each is, as times the kind's usual. Rigid kinds fill every leg end to end, their size eased a little so a whole
 * number of them fits; the others are set evenly along the whole line. Every piece is turned along the line there,
 * less whatever lean its own picture was painted with, and stays so (`fixed`).
 */
export function pathPieces(id, points, { grid = 100, scale = 1, seed = 1, smooth = true } = {}) {
  const k = pathKind(id), decor = DECOR_KINDS[k.kind];
  if (k.type !== 'pieces' || !decor || points.length < 2) return [];
  const size = decor.size * scale, out = [];
  let n = 0;
  const piece = (x, y, turn, sized) => { const d = { kind: k.kind, x: Math.round(x), y: Math.round(y), size: Math.round(sized * 1000) / 1000, turn: 0, seed: (((Number(seed) >>> 0) + ++n * 7919) >>> 0), flip: false, fixed: true }; d.turn = turn - bakedLean(d); out.push(d); };
  if (k.rigid) {
    const step = size * runSpan(k.kind) * grid;
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i], b = points[i + 1], len = length(a, b); if (!(len > 1)) continue;
      const count = Math.max(1, Math.round(len / step)), each = len / count, turn = Math.atan2(b[1] - a[1], b[0] - a[0]);
      for (let j = 0; j < count; j++) { const t = (j + 0.5) / count; piece(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, turn, size * (each / step)); }
    }
    return out;
  }
  const line = smooth ? smoothLine(points) : points, legs = []; let total = 0;
  for (let i = 0; i + 1 < line.length; i++) { const len = length(line[i], line[i + 1]); legs.push(len); total += len; }
  const count = Math.max(1, Math.round(total / (size * (k.close ?? 0.9) * grid)));
  for (let j = 0, at = 0, i = 0; j < count; j++) {
    const want = ((j + 0.5) / count) * total;
    while (i < legs.length - 1 && at + legs[i] < want) { at += legs[i]; i++; }
    const a = line[i], b = line[i + 1], t = legs[i] ? (want - at) / legs[i] : 0;
    // (Each of these looks its own way a little: a hedge is bushes, not a wall.)
    piece(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0]), size);
  }
  return out;
}

/** What the Paths tab draws: a line laid as a path, or ground filled in — an outline clicked round, a box dragged, the whole map. */
export const DRAW_SHAPES = Object.freeze([['line', 'Line'], ['area', 'Area'], ['box', 'Box'], ['all', 'Whole map'], ['edit', 'Edit a path']]);
/**
 * The region a filled piece of ground is saved as (pure), or null when there is no shape to it. `floor` any floor the
 * module paints; `points` an outline (three or more), or `box` { x, y, width, height }; `edge` how soft its edge is in
 * squares (0: hard); `whole` marks the ground under a whole map, which is replaced when another is laid. Water is a
 * still pool. Nothing here reads a map picture: this is how ground is laid on a scene that has none.
 */
export function areaRegion(floor, { points = null, box = null, style = '', edge = 1, whole = false, name = '', levelId = null, image = '' } = {}) {
  const outline = points ? tidyLine(points, 2) : null;
  const shape = outline?.length >= 3 ? { type: 'polygon', points: outline.flat().map((v) => Math.round(v)), hole: false }
    : box && box.width > 0 && box.height > 0 ? { type: 'rectangle', x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), rotation: 0, hole: false } : null;
  if (!shape || !floor) return null;
  const soft = edge > 0 && !whole ? { stepEdge: Math.min(3, edge) } : { stepEdgeOff: true };
  const own = floor === 'water'
    ? { floor, waterKind: 'still', flowTo: '', current: '', waterDepth: 'shallow', texture: 'on', textureStyles: { water: style || 'shallow' }, ...soft }
    : { floor, texture: 'on', ...(style ? { textureStyles: { [floor]: style } } : {}), ...soft };
  // (A picture of ground the GM owns, laid in place of our own painted one: where it is kept. Never over water.)
  const pictured = floor !== 'water' && typeof image === 'string' && image ? { textureImage: image.slice(0, 400) } : {};
  return { name: name || (whole ? 'Ground' : floor === 'water' ? 'Pond' : 'Ground patch'), color: floorColour(floor), levels: levelId ? [levelId] : [], shapes: [shape], flags: { animater: { ...own, ...pictured, ...(whole ? { wholeMap: true } : {}) } } };
}

/**
 * The region a drawn path is saved as (pure), or null when the line is too short to be one. `wide` squares for a
 * floor or water, times-usual for pieces; `levelId` the level being painted on.
 */
export function pathRegion(id, drawn, { grid = 100, wide = null, smooth = true, seed = 1, levelId = null, blocks = false, image = '' } = {}) {
  const k = pathKind(id), points = tidyLine(drawn, grid * 0.1), w = pathWideOf(id, wide);
  if (points.length < 2 || length(points[0], points.at(-1)) + points.length < 3) return null;
  const levels = levelId ? [levelId] : [];
  // How it was drawn, kept with it: its points can be moved afterwards and the path laid again along them.
  const drawnAs = { path: id, pathLine: points.map((p) => [Math.round(p[0]), Math.round(p[1])]), pathWide: w, pathSmooth: smooth !== false, pathSeed: Number(seed) >>> 0 };
  if (k.type === 'pieces') {
    const brushed = pathPieces(id, points, { grid, scale: w, seed, smooth });
    if (!brushed.length) return null;
    const reach = DECOR_KINDS[k.kind].size * w * grid + grid * 0.5;
    return { name: k.label, color: '#c0a060', levels, shapes: pathShapes(points, reach, smooth && !k.rigid),
      flags: { animater: { ...drawnAs, decor: { on: true, where: 'surface', density: 0, scale: 1, height: 1, seed: Number(seed) >>> 0, kinds: {}, brushed: brushed.slice(0, 600), erased: [],
        // A fence that stops movement: the walls along it are the region's own (decor-regions.mjs trunkWalls), kept in step with it.
        ...(blocks && runBlocks(k.kind) ? { blocks: true } : {}) } } } };
  }
  const shapes = pathShapes(points, w * grid, smooth);
  if (!shapes.length) return null;
  const floor = k.type === 'water' ? 'water' : k.floor, edge = k.edge > 0 ? { stepEdge: k.edge } : { stepEdgeOff: true };
  const own = k.type === 'water'
    ? { floor, waterKind: k.waterKind, flowTo: flowAlong(points), current: '', waterDepth: k.depth, texture: 'on', textureStyles: { water: k.style }, ...edge }
    : { floor, texture: 'on', textureStyles: { [floor]: k.style }, ...edge, ...(k.overWater ? { overWater: true } : {}), ...(typeof image === 'string' && image ? { textureImage: image.slice(0, 400) } : {}) };
  return { name: k.label, color: floorColour(floor), levels, shapes, flags: { animater: { ...own, ...drawnAs } } };
}

// How far a point is from the stretch between two others.
const toLeg = (x, y, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = dx * dx + dy * dy, t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l)) : 0; return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); };
/**
 * The path under a point (pure), of those that remember how they were drawn: { id, kind, line, wide, smooth, seed,
 * blocks }, or null. `regions` [{ id, own (its flags.animater) }]; `reach` how near its drawn line counts, in pixels
 * (half a floor path's own width is added, so anywhere on a road finds it). The nearest wins.
 */
export function pathUnder(regions = [], x, y, { grid = 100, reach = 40 } = {}) {
  let best = null, least = Infinity;
  for (const r of regions) {
    const own = r?.own, line = own?.pathLine;
    if (!own?.path || !Array.isArray(line) || line.length < 2) continue;
    const k = pathKind(own.path), half = k.type === 'pieces' ? 0 : (pathWideOf(own.path, own.pathWide) * grid) / 2;
    let far = Infinity; for (let i = 0; i + 1 < line.length; i++) far = Math.min(far, toLeg(x, y, line[i], line[i + 1]));
    if (far <= reach + half && far < least) { least = far; best = { id: r.id, kind: own.path, line: line.map((p) => [p[0], p[1]]), wide: own.pathWide, smooth: own.pathSmooth !== false, seed: own.pathSeed ?? 1, blocks: own.decor?.blocks === true }; }
  }
  return best;
}
/** Which of a line's points is under a point (pure): its place in the line, or -1. */
export function pointAt(line = [], x, y, reach = 30) { let best = -1, least = reach; line.forEach((p, i) => { const far = Math.hypot(p[0] - x, p[1] - y); if (far <= least) { least = far; best = i; } }); return best; }
/** Which stretch of a line is under a point (pure): the place of the point it starts from, or -1. A new point there goes in after it. */
export function legAt(line = [], x, y, reach = 30) { let best = -1, least = reach; for (let i = 0; i + 1 < line.length; i++) { const far = toLeg(x, y, line[i], line[i + 1]); if (far <= least) { least = far; best = i; } } return best; }
