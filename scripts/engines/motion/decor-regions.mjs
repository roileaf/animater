// A region's decorations as its flags hold them (flags.animater.decor), and where each one stands (pure). Every screen works
// the same placements out of the same flags: the scatter is seeded by the region and its own seed, never random per client.
//
// decor: { on, where ('surface' | 'cave'), density, scale, seed, kinds: { [kind]: { size, amount } } (a kind listed is ticked),
//          brushed: [placement] (put down by hand), erased: [[x, y, r]] (rubbed out: the scatter leaves those spots bare) }

import { DECOR_KINDS, hashText, scatterDecor, trunkRadius } from './decor-paint.mjs';
import { cleanDecorProp } from '../props/decor-options.mjs';

export const DECOR_DEFAULT_KINDS = Object.freeze({
  surface: ['rock', 'boulder', 'bush', 'oak', 'birch', 'stump', 'log', 'mushrooms', 'fern', 'agave', 'grass', 'flowers', 'leaves'],
  cave: ['rock', 'boulder', 'pebbles', 'stalagmite', 'rubble', 'cavePool', 'glowShrooms', 'lichen', 'fissure', 'bones'],
});
// Most a region holds, by hand and by scatter together: past this a dense big region would cost more than it shows.
export const DECOR_MOST = 600;
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** A region's decoration settings, cleaned (pure): unknown kinds dropped, numbers kept in range. Null when it has none on. */
export function decorSettings(raw) {
  if (!raw || raw.on !== true) return null;
  const where = raw.where === 'cave' ? 'cave' : 'surface', kinds = {}, off = [];
  for (const [id, k] of Object.entries(raw.kinds ?? {})) {
    // (Unticked, a kind keeps its size and amount for when it is ticked again; what was painted of it by hand hides meanwhile.)
    if (DECOR_KINDS[id] && k?.off === true) off.push(id);
    if (!DECOR_KINDS[id] || k?.off === true) continue;
    kinds[id] = { size: clamp(k?.size, 0.3, 3, 1), amount: clamp(k?.amount, 0, 3, 1) };
  }
  const placed = (p) => p && DECOR_KINDS[p.kind] && Number.isFinite(p.x) && Number.isFinite(p.y) && p.size > 0;
  return {
    where, kinds, off, blocks: raw.blocks === true, canBreak: raw.canBreak === true,
    // How its decorations break where their own choice is Automatic (decor-options.mjs): never where they stand.
    prop: cleanDecorProp(raw.prop),
    density: clamp(raw.density, 0, 2, 0.6), scale: clamp(raw.scale, 0.3, 3, 1), seed: Math.floor(clamp(raw.seed, 0, 2 ** 31, 1)),
    brushed: (Array.isArray(raw.brushed) ? raw.brushed : []).filter(placed).slice(0, DECOR_MOST),
    erased: (Array.isArray(raw.erased) ? raw.erased : []).filter((e) => Array.isArray(e) && e.length === 3 && e.every(Number.isFinite)).slice(0, 400),
  };
}
/**
 * The walls round the trunks of a region's trees and stumps (pure), when it asks for them: a small ring at each trunk, its sides
 * `sides` (8), as wide as the trunk is drawn (never thinner than a tenth of a square). Each { c: [x0, y0, x1, y1] } in scene pixels.
 */
export function trunkWalls(placements = [], grid = 100, sides = 8) {
  const out = [];
  for (const d of placements) {
    const r = trunkRadius(d.kind, d.size); if (!r) continue;
    const rad = Math.max(0.1, r) * grid, turn = ((d.seed ?? 0) % 360) * (Math.PI / 180), pts = Array.from({ length: sides }, (_, i) => [Math.round(d.x + Math.cos(turn + (i / sides) * 2 * Math.PI) * rad), Math.round(d.y + Math.sin(turn + (i / sides) * 2 * Math.PI) * rad)]);
    for (let i = 0; i < sides; i++) out.push({ c: [...pts[i], ...pts[(i + 1) % sides]] });
  }
  return out;
}
/** The box round a region's shapes (pure): { x, y, w, h }, or null. Polygons, rectangles, ellipses and circles, as Foundry keeps them. */
export function shapesBox(shapes = []) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const take = (x, y) => { if (!Number.isFinite(x) || !Number.isFinite(y)) return; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const s of shapes ?? []) {
    if (!s || s.hole) continue;
    if (Array.isArray(s.points)) for (let i = 0; i + 1 < s.points.length; i += 2) take(s.points[i], s.points[i + 1]);
    else if (s.type === 'rectangle') { take(s.x, s.y); take(s.x + s.width, s.y + s.height); }
    else if (s.type === 'ellipse') { take(s.x - s.radiusX, s.y - s.radiusY); take(s.x + s.radiusX, s.y + s.radiusY); }
    else if (s.type === 'circle') { take(s.x - s.radius, s.y - s.radius); take(s.x + s.radius, s.y + s.radius); }
  }
  return x1 >= x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
}
/**
 * What a region's hand-placed decorations become when the region is dragged (pure): moved with it, and its rubbed-out spots too,
 * as { brushed, erased } and how far ({ dx, dy }); null when it was not simply moved (reshaped, resized) or holds nothing placed by hand.
 */
export function carryDecor(decor, beforeShapes, afterShapes) {
  const brushed = Array.isArray(decor?.brushed) ? decor.brushed : [], erased = Array.isArray(decor?.erased) ? decor.erased : [];
  if (!brushed.length && !erased.length) return null;
  const a = shapesBox(beforeShapes), b = shapesBox(afterShapes);
  if (!a || !b || Math.abs(a.w - b.w) > 1 || Math.abs(a.h - b.h) > 1) return null;
  const dx = Math.round(b.x - a.x), dy = Math.round(b.y - a.y);
  if (!dx && !dy) return null;
  return { brushed: brushed.map((d) => ({ ...d, x: d.x + dx, y: d.y + dy })), erased: erased.map(([x, y, r]) => [x + dx, y + dy, r]), dx, dy };
}
/** New settings for a region turned on: its place's usual kinds, each at its usual size and amount (pure). */
export function freshDecor(where = 'surface', seed = 1) {
  return { on: true, where, density: 0.6, scale: 1, seed, kinds: Object.fromEntries((DECOR_DEFAULT_KINDS[where] ?? DECOR_DEFAULT_KINDS.surface).map((id) => [id, { size: 1, amount: 1 }])), brushed: [], erased: [] };
}

// Whether a point is in a polygon of flat x, y pairs.
const inPolygon = (x, y, p) => { let hit = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit; return hit; };
/** Whether a point lies in a region's areas (flat x, y pairs, each with optional `holes`) (pure). */
export const inAreas = (x, y, areas) => areas.some((a) => inPolygon(x, y, a) && !(a.holes ?? []).some((h) => inPolygon(x, y, h)));
const boundsOf = (areas) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const a of areas) for (let i = 0; i < a.length; i += 2) { x0 = Math.min(x0, a[i]); x1 = Math.max(x1, a[i]); y0 = Math.min(y0, a[i + 1]); y1 = Math.max(y1, a[i + 1]); } return Number.isFinite(x0) ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null; };

/**
 * Every decoration a region shows (pure): its scatter (seeded by the region's id and its own seed, kept inside its areas and
 * out of what was rubbed out and of what was put down by hand), then what was put down by hand. Flat ones first, then by height,
 * so a crown lies over what stands beneath it.
 */
export function decorPlacements({ settings, areas = [], grid = 100, id = '' } = {}) {
  if (!settings || !areas.length || !(grid > 0)) return [];
  const bounds = boundsOf(areas); if (!bounds) return [];
  const kinds = Object.entries(settings.kinds).filter(([kind]) => DECOR_KINDS[kind].set === 'both' || DECOR_KINDS[kind].set === settings.where).map(([kind, k]) => ({ id: kind, size: k.size, amount: k.amount }));
  const rubbed = (x, y) => settings.erased.some(([ex, ey, r]) => (ex - x) ** 2 + (ey - y) ** 2 < r * r);
  const scattered = scatterDecor({ bounds, inside: (x, y) => inAreas(x, y, areas) && !rubbed(x, y), grid, kinds, density: settings.density, scale: settings.scale, seed: (hashText(id) ^ Math.imul(settings.seed + 1, 2654435761)) >>> 0, limit: DECOR_MOST - settings.brushed.length });
  // What was painted by hand answers the panel too: a kind unticked hides, and the region's Size and each kind's own scale it.
  const hidden = new Set(settings.off ?? []), grow = (d) => (settings.scale ?? 1) * (settings.kinds[d.kind]?.size ?? 1);
  const byHand = settings.brushed.filter((d) => !hidden.has(d.kind)).map((d) => (grow(d) === 1 ? d : { ...d, size: +(d.size * grow(d)).toFixed(3) }));
  const clear = (d) => DECOR_KINDS[d.kind].flat || byHand.every((b) => DECOR_KINDS[b.kind].flat || (b.x - d.x) ** 2 + (b.y - d.y) ** 2 > ((b.size + d.size) * grid * 0.42) ** 2);
  return [...scattered.filter(clear), ...byHand].sort((a, b) => (DECOR_KINDS[b.kind].flat - DECOR_KINDS[a.kind].flat) || (DECOR_KINDS[a.kind].height - DECOR_KINDS[b.kind].height));
}

/**
 * The shape of a new region drawn by the brush round a stroke (pure): one circle each dab ([x, y, r]), but none closer to the last
 * one kept than half its size, as Foundry region shapes (ellipses). Together they make the region's area.
 */
export function strokeShapes(dabs = []) {
  const kept = [];
  for (const [x, y, r] of dabs) { const last = kept[kept.length - 1]; if (!last || Math.hypot(x - last[0], y - last[1]) >= Math.min(r, last[2]) * 0.5) kept.push([x, y, r]); }
  return kept.map(([x, y, r]) => ({ type: 'ellipse', x: Math.round(x), y: Math.round(y), radiusX: Math.round(r), radiusY: Math.round(r), rotation: 0, hole: false }));
}
/** A circle as a polygon of flat x, y pairs (pure), for the area of a stroke still being drawn. */
export const circleArea = (x, y, r, n = 16) => Array.from({ length: n }, (_, i) => [x + Math.cos((i / n) * 6.283) * r, y + Math.sin((i / n) * 6.283) * r]).flat();

// Which engine shows a kind underground instead of its painting: the cavern's own fungus, crystals and lava, the webs' cobwebs.
export const CAVERN_KINDS = Object.freeze({ glowShrooms: 'fungus', crystals: 'crystals', lavaCrack: 'lava', cobweb: 'webs' });
/** Where a decoration is drawn (pure): 'water' (the water engine's, its rim painted), 'cavern' (that engine's, underground only),
 * 'tree' (trunk under the creatures, crown over them), 'flat' (on the ground), else 'standing'. */
export function decorRole(d, where = 'surface') {
  const k = DECOR_KINDS[d?.kind]; if (!k) return null;
  if (where === 'cave' && CAVERN_KINDS[d.kind]) return 'cavern';
  if (k.tree) return 'tree';
  if (k.flat) return 'flat';
  return 'standing';
}
// A tree decoration's kind as the canopy engine knows it (tree-kinds.mjs); leafless in winter.
const CANOPY_OF = { oak: 'broadleaf', maple: 'broadleaf', fruitTree: 'blossom', blossom: 'blossom', birch: 'birch', willow: 'willow', pine: 'pine', spruce: 'spruce', palm: 'palm', deadTree: 'bare' };
const EVERGREEN = new Set(['pine', 'spruce', 'palm']);
/** The canopy kind and how thick its leaves are for a tree decoration in a season (pure). */
export function canopyKindOf(kind, season = 'summer') {
  const canopy = CANOPY_OF[kind]; if (!canopy) return null;
  if (season === 'winter' && !EVERGREEN.has(kind)) return { kind: 'bare', leaves: 0.55 };
  // A fruit or blossom tree is in blossom only in spring (then its shade drops petals); the rest of the year its leaves are a broadleaf's.
  if (canopy === 'blossom' && season !== 'spring') return { kind: 'broadleaf', leaves: 1 };
  return { kind: canopy, leaves: canopy === 'birch' || canopy === 'palm' || canopy === 'bare' ? 0.55 : canopy === 'blossom' || canopy === 'willow' ? 0.8 : 1 };
}
