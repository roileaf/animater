// Which prop tiles a cause hits: inside an area, beside a missed target, or along a forced path.
import { propMaterial, canBreak, MATERIALS } from "./prop-material.mjs";
import { propTraits } from "./prop-traits.mjs";

const live = t => !t.hidden && !t.flags?.animater?.prop?.broken;
const centre = t => ({ x: t.x + t.width / 2, y: t.y + t.height / 2 });
// A prop that tips over (a brazier) is knocked down by a slam of any size, as long as it is a prop at all (not
// "Won't break"); damage still follows its material. The GM's validBreakRequest agrees (tipsOver).
export function tipsOver(tile, grid, cause) {
  if (!cause?.slam) return false;
  const m = propMaterial(tile, grid);
  return MATERIALS.includes(m) && m !== "none" && propTraits(tile, grid).tips === true;
}
const eligible = (tiles, grid, cause) =>
  tiles.filter(t => { if (!live(t)) return false; if (tipsOver(t, grid, cause)) return true; const { cuttable, rule } = propTraits(t, grid); return canBreak(propMaterial(t, grid), cause, { cuttable, rule }); });

export function propsInArea(tiles, testPoint, grid, damageType) {
  return eligible(tiles, grid, { damageType }).filter(t => testPoint(centre(t)));
}

// Where a missed swing can land: the frame of the attacker's centre and the target's footprint {x, y, w, h}.
// ring: the footprint grown by one square; onTarget(p): p lies on the target itself; score(p): {across, toTarget} for a
// point past the target's near side (how far off the attacker->target line, and from the target's centre), or null for
// one on the attacker's side, which a missed swing never reaches. Props and windows beside the target share it.
export function missFrame(attacker, target, grid) {
  const ring = { x: target.x - grid, y: target.y - grid, w: target.w + 2 * grid, h: target.h + 2 * grid };
  const tc = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
  const dx = tc.x - attacker.x, dy = tc.y - attacker.y, len = Math.hypot(dx, dy);
  // how far the target's footprint reaches back toward the attacker along the line
  const near = len ? len - (target.w / 2 * Math.abs(dx) + target.h / 2 * Math.abs(dy)) / len : 0;
  // along: distance past the attacker; across: distance off the attacker→target line
  const measure = p => len
    ? { along: ((p.x - attacker.x) * dx + (p.y - attacker.y) * dy) / len, across: Math.abs((p.x - attacker.x) * dy - (p.y - attacker.y) * dx) / len }
    : { along: 0, across: 0 };
  return {
    ring,
    onTarget: (p) => p.x >= target.x && p.x <= target.x + target.w && p.y >= target.y && p.y <= target.y + target.h,
    inRing: (p) => p.x >= ring.x && p.x <= ring.x + ring.w && p.y >= ring.y && p.y <= ring.y + ring.h,
    score: (p) => { const m = measure(p); return m.along < near ? null : { across: m.across, toTarget: Math.hypot(p.x - tc.x, p.y - tc.y) }; },
  };
}
// Whether score a beats score b (nearer the line, then nearer the target).
export const missBetter = (a, b) => !!a && (!b || a.across < b.across || (a.across === b.across && a.toTarget < b.toTarget));

// tile bounds overlap (with area) the target footprint grown by one square, centre not on the target itself
export function propNextToMiss({ attacker, target }, tiles, grid, damageType) {
  const frame = missFrame(attacker, target, grid), { ring } = frame;
  let best = null, bestScore = null;
  for (const t of eligible(tiles, grid, { damageType })) {
    const c = centre(t);
    if (frame.onTarget(c)) continue;
    if (t.x >= ring.x + ring.w || t.x + t.width <= ring.x || t.y >= ring.y + ring.h || t.y + t.height <= ring.y) continue;
    const score = frame.score(c);
    if (!score) continue; // on the attacker's side of the target: a missed swing never reaches it
    if (missBetter(score, bestScore)) { best = t; bestScore = score; }
  }
  return best;
}

const clamp01 = v => Math.max(0, Math.min(1, v));
function ptSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy;
  const u = l2 ? clamp01(((p.x - a.x) * dx + (p.y - a.y) * dy) / l2) : 0;
  return { d: Math.hypot(p.x - (a.x + u * dx), p.y - (a.y + u * dy)), u };
}
const inRect = (p, t) => p.x >= t.x && p.x <= t.x + t.width && p.y >= t.y && p.y <= t.y + t.height;
function segsCross(a, b, c, d) {
  const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x));
  return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
}
// shortest distance from a point to a tile's rectangle (0 inside it)
function ptRectDist(p, t) {
  const dx = Math.max(t.x - p.x, 0, p.x - (t.x + t.width)), dy = Math.max(t.y - p.y, 0, p.y - (t.y + t.height));
  return Math.hypot(dx, dy);
}
// Whether a move from a toward b runs into the tile rather than away from or along it. A mover whose centre starts on
// the tile (standing on a table, a cart, a bridge) never does. One whose reach already touches the tile at the start
// (a prop overlapping its square) does only when the tile's centre lies ahead of its front: further along the move
// than its reach. Otherwise the tile starts out of reach, and coming within reach means heading into it.
export function headsInto(a, b, t, reach = 0) {
  if (inRect(a, t)) return false;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (!len) return false;
  if (ptRectDist(a, t) >= reach) return true;
  const c = centre(t);
  return ((c.x - a.x) * dx + (c.y - a.y) * dy) / len > reach;
}

// shortest distance between a segment and a tile's rectangle
export function segRectDist(a, b, t) {
  if (inRect(a, t) || inRect(b, t)) return 0;
  const k = [{ x: t.x, y: t.y }, { x: t.x + t.width, y: t.y }, { x: t.x + t.width, y: t.y + t.height }, { x: t.x, y: t.y + t.height }];
  let d = Infinity;
  for (let i = 0; i < 4; i++) {
    const c = k[i], e = k[(i + 1) % 4];
    if (segsCross(a, b, c, e)) return 0;
    d = Math.min(d, ptSeg(c, a, b).d);
  }
  const clampP = p => ({ x: Math.max(t.x, Math.min(t.x + t.width, p.x)), y: Math.max(t.y, Math.min(t.y + t.height, p.y)) });
  return Math.min(d, Math.hypot(a.x - clampP(a).x, a.y - clampP(a).y), Math.hypot(b.x - clampP(b).x, b.y - clampP(b).y));
}

// Props a mover of moverSize squares slams into along path [{x, y}] (its centre), in path order. Only what lies ahead
// of it counts (headsInto): a prop it stands on or moves away from stays whole.
export function propsOnPath(path, moverSize, tiles, grid) {
  const reach = moverSize * grid / 2, hits = [];
  for (const t of eligible(tiles, grid, { slam: { size: moverSize } })) {
    if (path.length < 2 || !headsInto(path[0], path[1], t, reach)) continue;
    for (let i = 0; i < path.length - 1; i++) {
      if (segRectDist(path[i], path[i + 1], t) < reach) {
        hits.push({ t, at: i + ptSeg(centre(t), path[i], path[i + 1]).u });
        break;
      }
    }
  }
  return hits.sort((p, q) => p.at - q.at).map(h => h.t);
}

// Props a mover's centre runs through along points [{x, y, p}] (p: share of its stage there), each with the share at
// which it gets there and the point on the travel nearest the prop's centre, in travel order. A prop the centre
// starts on is never run through (headsInto).
export function propsUnderTravel(points, moverSize, tiles, grid) {
  const hits = [];
  for (const t of eligible(tiles, grid, { slam: { size: moverSize } })) {
    if (points.length < 2 || inRect(points[0], t)) continue;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (segRectDist(a, b, t) > 0) continue;
      const { u } = ptSeg(centre(t), a, b);
      hits.push({ t, p: a.p + u * (b.p - a.p), at: { x: a.x + u * (b.x - a.x), y: a.y + u * (b.y - a.y) } });
      break;
    }
  }
  return hits.sort((p, q) => p.p - q.p);
}

// Level ids from a document field: a Set or array (a tile's or region's levels), one id (a token's level), or none.
const levelIds = (v) => (typeof v === "string" ? [v] : v && typeof v[Symbol.iterator] === "function" ? [...v].filter((id) => typeof id === "string") : []);
// Whether a tile is on any of the given levels, the way v14 includes a document in a level: a tile naming no level is
// on every level, and a cause with no level (a scene without levels, an old template) reaches every tile.
export function onLevel(tileLevels, levels) {
  const own = levelIds(tileLevels), want = levelIds(levels);
  if (!own.length || !want.length) return true;
  const set = new Set(own);
  return want.some((id) => set.has(id));
}
// The tiles (each with its levels) a cause on those levels can reach.
export const tilesOnLevel = (tiles, levels) => (tiles ?? []).filter((t) => onLevel(t.levels, levels));
