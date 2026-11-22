// Select: picking up what was put on the map by hand (pure). A decoration laid by the brush, a path or the map
// builder is an entry in its region's hand-placed list; this finds the one under the pointer, or those in a box, and
// says what each becomes when it is moved, turned, made bigger or smaller, or copied. The shell writes the answers.
//
// (Nothing placed could be picked up again: a bed set down a square out meant rubbing it out and laying another.)

import { DECOR_KINDS } from '../motion/decor-paint.mjs';
import { turnOf } from '../motion/decorations.mjs';

/** One step of the wheel: a twelfth of a half turn, as the Decorations brush turns. */
export const SELECT_TURN = Math.PI / 12;
/** One step of the wheel bigger or smaller. */
export const SELECT_GROW = 1.1;
/** How small and how big a decoration may be made, as times its kind's usual. */
export const SELECT_SIZE = Object.freeze({ min: 0.25, max: 5 });

/** How far from its middle a decoration can be picked up, in pixels: most of its drawn half, never less than a quarter square. */
export const reachOf = (d, grid = 100) => Math.max(grid * 0.25, (Number(d?.size) || 0) * grid * 0.45);

/**
 * Every hand-placed decoration of some regions, as things to pick (pure): [{ id (its region's), i (where in that
 * region's list), d }]. `regions` [{ id, brushed }].
 */
export const pickable = (regions = []) => regions.flatMap((r) => (Array.isArray(r?.brushed) ? r.brushed : []).map((d, i) => ({ id: r.id, i, d })).filter((it) => DECOR_KINDS[it.d?.kind]));

/**
 * The one under a point, or null (pure). Of several, what stands is picked before what lies flat under it, then the
 * smaller (a barrel on a rug, a rug on a floor of paving), then the one laid last.
 */
export function pickAt(items = [], x, y, grid = 100) {
  let best = null, rank = null;
  for (const [n, it] of items.entries()) {
    const reach = reachOf(it.d, grid), far = Math.hypot(it.d.x - x, it.d.y - y);
    if (far > reach) continue;
    const mine = [DECOR_KINDS[it.d.kind].flat ? 1 : 0, reach, -n];
    if (!rank || mine[0] < rank[0] || (mine[0] === rank[0] && (mine[1] < rank[1] || (mine[1] === rank[1] && mine[2] < rank[2])))) { best = it; rank = mine; }
  }
  return best;
}
/** Those whose middles lie in the box between two corners (pure). */
export function pickBox(items = [], a, b) {
  const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
  return items.filter((it) => it.d.x >= x0 && it.d.x <= x1 && it.d.y >= y0 && it.d.y <= y1);
}
/** The middle of some decorations (pure). */
export const centreOf = (ds = []) => (ds.length ? { x: ds.reduce((s, d) => s + d.x, 0) / ds.length, y: ds.reduce((s, d) => s + d.y, 0) / ds.length } : { x: 0, y: 0 });

/** Moved (pure). */
export const movedBy = (d, dx, dy) => ({ ...d, x: Math.round(d.x + dx), y: Math.round(d.y + dy) });
/**
 * Turned by `by` radians (pure): one alone about its own middle, several together about the middle of them all, as
 * one thing. Each is turned from where it is seen to stand, and stays exactly so afterwards (`fixed`) — a crate laid
 * by the brush is drawn at less than its own turn, and would jump otherwise.
 */
export function turnedBy(ds = [], by = 0) {
  const c = centreOf(ds), cos = Math.cos(by), sin = Math.sin(by);
  return ds.map((d) => { const dx = d.x - c.x, dy = d.y - c.y; return { ...d, x: Math.round(c.x + dx * cos - dy * sin), y: Math.round(c.y + dx * sin + dy * cos), turn: turnOf(d) + by, fixed: true }; });
}
/**
 * Mirrored left for right (pure): one alone where it stands, several together about the middle of them all, so a
 * furnished room becomes its mirror image. (`mirror` is the Select tab's own; `flip` is the brush's and shows only on
 * what lies flat, so nothing already on a map changes.)
 */
export function mirroredOver(ds = []) {
  const c = centreOf(ds);
  return ds.map((d) => { const out = { ...d, x: Math.round(2 * c.x - d.x), turn: -turnOf(d), fixed: true }; if (d.mirror) delete out.mirror; else out.mirror = true; return out; });
}
/** How far a drag is taken when it is kept to the grid (pure): so the first one picked lands on a half square. */
export function snappedDrag(d, dx, dy, grid = 100) {
  const half = grid / 2, to = (v) => Math.round(v / half) * half;
  return d ? { dx: to(d.x + dx) - d.x, dy: to(d.y + dy) - d.y } : { dx, dy };
}

/**
 * A prefab of some decorations (pure): each as it stands from the middle of them all, turned as it is seen, with what
 * it is made of — and nothing of where on which map it was. `name` what the GM calls it.
 */
export function prefabOf(ds = [], name = '') {
  const c = centreOf(ds);
  return { name: String(name).trim().slice(0, 60) || 'Prefab', items: ds.filter((d) => DECOR_KINDS[d.kind]).slice(0, PREFAB_MOST).map((d) => ({ kind: d.kind, dx: Math.round(d.x - c.x), dy: Math.round(d.y - c.y), size: d.size, turn: turnOf(d), ...(d.mirror ? { mirror: true } : {}), ...(d.flip ? { flip: true } : {}), ...(d.tall ? { tall: d.tall } : {}), ...(d.prop ? { prop: d.prop } : {}), ...(d.art ? { art: d.art, ...(Number.isFinite(d.high) ? { high: d.high } : {}) } : {}) })) };
}
/** The most one prefab holds. */
export const PREFAB_MOST = 200;
/**
 * A prefab set down with its middle at a point (pure): the region it is saved as, a round each piece, its pieces laid
 * by hand in it. `grid` the scene's square now over `was` the square it was saved at, so it fits a map of another scale.
 */
export function prefabRegion(prefab, x, y, { grid = 100, was = 100, seed = 1, levelId = null } = {}) {
  const k = was > 0 ? grid / was : 1, items = (prefab?.items ?? []).filter((it) => DECOR_KINDS[it.kind]);
  if (!items.length) return null;
  const brushed = items.map((it, n) => { const { dx, dy, ...rest } = it; return { ...rest, x: Math.round(x + dx * k), y: Math.round(y + dy * k), seed: (((Number(seed) >>> 0) + (n + 1) * 7919) >>> 0), flip: !!it.flip, fixed: true }; });
  const round = (d) => { const r = Math.round(Math.max(grid * 0.5, d.size * grid * 0.6)); return { type: 'ellipse', x: d.x, y: d.y, radiusX: r, radiusY: r, rotation: 0, hole: false }; };
  return { name: prefab.name || 'Prefab', color: '#c0a060', levels: levelId ? [levelId] : [], shapes: brushed.map(round),
    flags: { animater: { decor: { on: true, where: 'surface', density: 0, scale: 1, height: 1, seed: Number(seed) >>> 0, kinds: {}, brushed, erased: [] } } } };
}
/** The saved prefabs, cleaned (pure): a list of { name, items, grid }, the unreadable ones dropped. */
export const prefabsOf = (raw) => (Array.isArray(raw) ? raw : []).filter((p) => p && typeof p.name === 'string' && Array.isArray(p.items) && p.items.length).slice(0, 60);

/**
 * The parts of a map (pure): the regions the map-making tools laid, as a list to pick from — [{ id, name, sort, count }].
 * `regions` [{ id, name, own (its flags.animater) }]. `sort` what it is: 'ground' (under the whole map), 'water',
 * 'path' (a road or a stream laid as a line), 'run' (a fence or hedge laid as a line), 'room' (a room's furnishings),
 * 'things' (decorations placed by hand), 'floor' (any other painted floor). `count` how many decorations it holds.
 * Regions with nothing of the module's on them are left out. Parts of one name are numbered, so the third fence is
 * "Fence 3" wherever it is asked about; the ground comes first, then the rest as the scene keeps them.
 */
export function mapParts(regions = [], map = null) {
  const out = [];
  for (const r of regions) {
    const own = r?.own ?? {}, placed = own.decor?.on === true && Array.isArray(own.decor.brushed) ? own.decor.brushed.length : 0;
    const sort = own.wholeMap ? 'ground' : own.furnishOf ? 'room' : own.path && placed ? 'run' : own.floor === 'water' ? 'water' : own.path ? 'path' : placed ? 'things' : own.floor ? 'floor' : null;
    // (`box` the region's own, `map` the map's: where it lies is said after its name, so "Fence" is "Fence, north-west".)
    const where = sort && sort !== 'ground' && r.box ? whereOnMap(r.box.x + r.box.w / 2, r.box.y + r.box.h / 2, map) : '';
    if (sort) out.push({ id: r.id, name: String(r.name ?? '').trim() || 'Region', sort, count: placed, where });
  }
  const total = new Map(), seen = new Map();
  for (const p of out) total.set(p.name, (total.get(p.name) ?? 0) + 1);
  for (const p of out) if (total.get(p.name) > 1) { const n = (seen.get(p.name) ?? 0) + 1; seen.set(p.name, n); p.name = `${p.name} ${n}`; }
  return [...out.filter((p) => p.sort === 'ground'), ...out.filter((p) => p.sort !== 'ground')];
}

/**
 * Made `times` as big as one thing (pure): each bigger or smaller, and standing that much further from or nearer to
 * the middle of them all — what dragging the corner of a selection does. One alone only changes size.
 */
export function scaledAbout(ds = [], times = 1) {
  const c = centreOf(ds), k = Number(times) > 0 ? Number(times) : 1;
  return sizedBy(ds, k).map((d, n) => ({ ...d, x: Math.round(c.x + (ds[n].x - c.x) * k), y: Math.round(c.y + (ds[n].y - c.y) * k) }));
}
/**
 * The box round what is picked, and its two handles (pure): { x0, y0, x1, y1, cx, cy, turn: [x, y], size: [x, y] }
 * in scene pixels, or null with nothing picked. The turn handle stands above the middle of its top edge, `stalk`
 * away; the size handle is its bottom right corner.
 */
export function selectionBox(ds = [], grid = 100, stalk = 30) {
  if (!ds.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const d of ds) { const r = reachOf(d, grid); x0 = Math.min(x0, d.x - r); y0 = Math.min(y0, d.y - r); x1 = Math.max(x1, d.x + r); y1 = Math.max(y1, d.y + r); }
  const c = centreOf(ds);
  return { x0, y0, x1, y1, cx: c.x, cy: c.y, turn: [(x0 + x1) / 2, y0 - stalk], size: [x1, y1] };
}
/** How far a selection is turned by dragging its turn handle to a point (pure), radians: in steps of `step` unless `free`. */
export function turnTo(box, from, to, { step = SELECT_TURN, free = false } = {}) {
  const a = Math.atan2(to.y - box.cy, to.x - box.cx) - Math.atan2(from.y - box.cy, from.x - box.cx), by = Math.atan2(Math.sin(a), Math.cos(a));
  return free || !(step > 0) ? by : Math.round(by / step) * step;
}
/** How many times as big a selection is made by dragging its size handle to a point (pure), within a quarter and four times. */
export function sizeTo(box, from, to) {
  const was = Math.hypot(from.x - box.cx, from.y - box.cy), now = Math.hypot(to.x - box.cx, to.y - box.cy);
  return was > 1 ? Math.min(4, Math.max(0.25, now / was)) : 1;
}
/** Where on the map something stands, in a word or two (pure): "north-west", "centre", "south". `rect` the map { x, y, width, height }. */
export function whereOnMap(x, y, rect) {
  if (!rect || !(rect.width > 0) || !(rect.height > 0)) return '';
  const u = (x - rect.x) / rect.width, v = (y - rect.y) / rect.height, ns = v < 0.36 ? 'north' : v > 0.64 ? 'south' : '', ew = u < 0.36 ? 'west' : u > 0.64 ? 'east' : '';
  return ns && ew ? `${ns}-${ew}` : ns || ew || 'centre';
}

/** Made `times` as big (pure), each where it stands, within what its kind allows. */
export const sizedBy = (ds = [], times = 1) => ds.map((d) => { const usual = DECOR_KINDS[d.kind]?.size ?? 1; return { ...d, size: Math.round(Math.min(usual * SELECT_SIZE.max, Math.max(usual * SELECT_SIZE.min, d.size * times)) * 1000) / 1000 }; });
/** Copies, set off a little (pure): each its own decoration, with a seed of its own. */
export const copiesOf = (ds = [], dx = 0, dy = 0, seed = 1) => ds.map((d, n) => ({ ...d, x: Math.round(d.x + dx), y: Math.round(d.y + dy), seed: (((Number(seed) >>> 0) + (n + 1) * 7919) ^ (d.seed >>> 0)) >>> 0 }));

/**
 * A region's hand-placed list after an edit (pure). `changes` a Map of place in the list → what stands there now
 * (null: taken away), `added` put on the end. Never more than `most`: the oldest go first, as the brush drops them.
 */
export function listAfter(brushed = [], changes = new Map(), added = [], most = 600) {
  const out = [];
  for (const [i, d] of brushed.entries()) { if (!changes.has(i)) out.push(d); else if (changes.get(i)) out.push(changes.get(i)); }
  return [...out, ...added].slice(-most);
}
/**
 * The round shapes a decorations region must grow by to still hold what was moved (pure): one round each decoration
 * now outside the box of its shapes. A region that paints a floor, or is raised ground, is never grown: its shape is
 * its floor's.
 */
export function growFor(ds = [], box = null, grid = 100) {
  if (!box) return [];
  return ds.filter((d) => d.x < box.x || d.x > box.x + box.w || d.y < box.y || d.y > box.y + box.h)
    .map((d) => ({ type: 'ellipse', x: Math.round(d.x), y: Math.round(d.y), radiusX: Math.round(Math.max(grid * 0.5, d.size * grid * 0.6)), radiusY: Math.round(Math.max(grid * 0.5, d.size * grid * 0.6)), rotation: 0, hole: false }));
}
