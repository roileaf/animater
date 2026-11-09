// Which prop tiles a cause hits: inside an area, beside a missed target, or along a forced path.
import { propMaterial, canBreak } from "./prop-material.mjs";

const live = t => !t.hidden && !t.flags?.animater?.prop?.broken;
const centre = t => ({ x: t.x + t.width / 2, y: t.y + t.height / 2 });
const eligible = (tiles, grid, cause) =>
  tiles.filter(t => live(t) && canBreak(propMaterial(t, grid), cause));

export function propsInArea(tiles, testPoint, grid, damageType) {
  return eligible(tiles, grid, { damageType }).filter(t => testPoint(centre(t)));
}

// tile bounds overlap (with area) the target footprint grown by one square, centre not on the target itself
export function propNextToMiss({ attacker, target }, tiles, grid, damageType) {
  const ring = { x: target.x - grid, y: target.y - grid, w: target.w + 2 * grid, h: target.h + 2 * grid };
  const tc = { x: target.x + target.w / 2, y: target.y + target.h / 2 };
  const dx = tc.x - attacker.x, dy = tc.y - attacker.y, len = Math.hypot(dx, dy);
  // how far the target's footprint reaches back toward the attacker along the line
  const near = len ? len - (target.w / 2 * Math.abs(dx) + target.h / 2 * Math.abs(dy)) / len : 0;
  // along: distance past the attacker; across: distance off the attacker→target line
  const measure = p => len
    ? { along: ((p.x - attacker.x) * dx + (p.y - attacker.y) * dy) / len, across: Math.abs((p.x - attacker.x) * dy - (p.y - attacker.y) * dx) / len }
    : { along: 0, across: 0 };
  let best = null, bestD = Infinity, bestT = Infinity;
  for (const t of eligible(tiles, grid, { damageType })) {
    const c = centre(t);
    if (c.x >= target.x && c.x <= target.x + target.w && c.y >= target.y && c.y <= target.y + target.h) continue;
    if (t.x >= ring.x + ring.w || t.x + t.width <= ring.x || t.y >= ring.y + ring.h || t.y + t.height <= ring.y) continue;
    const m = measure(c);
    if (m.along < near) continue; // on the attacker's side of the target: a missed swing never reaches it
    const d = m.across, toTarget = Math.hypot(c.x - tc.x, c.y - tc.y);
    if (d < bestD || (d === bestD && toTarget < bestT)) { best = t; bestD = d; bestT = toTarget; }
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

export function propsOnPath(path, moverSize, tiles, grid) {
  const reach = moverSize * grid / 2, hits = [];
  for (const t of eligible(tiles, grid, { slam: { size: moverSize } })) {
    for (let i = 0; i < path.length - 1; i++) {
      if (segRectDist(path[i], path[i + 1], t) < reach) {
        hits.push({ t, at: i + ptSeg(centre(t), path[i], path[i + 1]).u });
        break;
      }
    }
  }
  return hits.sort((p, q) => p.at - q.at).map(h => h.t);
}
