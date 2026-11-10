// Walls a prop tile owns (non-door, not a breakable window, not a broken door or window, both ends inside its rotated bounds) and the updates that open and restore them.
const KEYS = ["move", "sight", "light", "sound"];
const saved = w => w.flags?.animater?.prop?.restore;

export function ownWalls(tile, walls, grid) {
  const cx = tile.x + tile.width / 2, cy = tile.y + tile.height / 2;
  const a = -(tile.rotation || 0) * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a);
  const hw = tile.width / 2 + grid / 4, hh = tile.height / 2 + grid / 4;
  // undo the tile's rotation about its centre, then test against the grown axis-aligned rectangle
  const inside = (x, y) => {
    const dx = x - cx, dy = y - cy;
    return Math.abs(dx * cos - dy * sin) <= hw && Math.abs(dx * sin + dy * cos) <= hh;
  };
  // a broken door has door 0 now: its note says it is a door still, which Repair puts back (M1)
  return walls.filter(w => !w.door && w.flags?.animater?.breakWall?.window !== true && !w.flags?.animater?.breakWall?.broken && inside(w.c[0], w.c[1]) && inside(w.c[2], w.c[3]));
}

export function openUpdates(walls) {
  // a wall already opened keeps its saved originals (overlapping props)
  return walls.filter(w => !saved(w)).map(w => ({
    _id: w.id, move: 0, sight: 0, light: 0, sound: 0,
    "flags.animater.prop.restore": Object.fromEntries(KEYS.map(k => [k, w[k]])),
  }));
}

export function restoreUpdates(walls) {
  return walls.filter(saved).map(w => ({ _id: w.id, ...Object.fromEntries(KEYS.map(k => [k, saved(w)[k]])), "flags.animater.prop.-=restore": null }));
}

// Wreckage stops at walls (Task 21): a thrown piece, a spill or burning oil never lands past the first wall between the
// prop's centre and where it would land. A wall blocks when it stops movement or sight; an open door does not, nor the
// prop's own walls (excludeIds: ids, an array or a Set).
export function blockingWalls(walls, excludeIds = []) {
  const skip = excludeIds instanceof Set ? excludeIds : new Set(excludeIds ?? []);
  return (walls ?? []).filter((w) => Array.isArray(w?.c) && w.c.length === 4 && w.c.every(Number.isFinite) && !skip.has(w.id)
    && (w.move > 0 || w.sight > 0) && !(w.door > 0 && w.ds === 1));
}

// The share (0-1) of the throw from `from` to `to` before it meets the first wall, or 1 when nothing is in the way.
// A wall met within ON_LINE px of the start is one the prop's centre sits on (a torch on a wall line): it does not stop
// the throw, or every piece would land on the centre (M3).
const ON_LINE = 1;
function firstHit(from, to, walls) {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
  let best = 1;
  for (const w of walls) {
    const [x1, y1, x2, y2] = w.c, ex = x2 - x1, ey = y2 - y1, den = dx * ey - dy * ex;
    if (!den) continue; // parallel
    const t = ((x1 - from.x) * ey - (y1 - from.y) * ex) / den, u = ((x1 - from.x) * dy - (y1 - from.y) * dx) / den;
    if (t * len >= ON_LINE && t <= best && u >= 0 && u <= 1) best = t;
  }
  return best;
}

// Where something thrown from `from` toward `to` comes to rest: `to` itself, or `margin` px short of the first wall
// on the way (never behind the start). Other fields of `to` are kept.
export function stopShort(from, to, walls, margin = 0) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (!len) return to;
  const t = firstHit(from, to, walls);
  if (t >= 1) return to;
  const k = Math.max(0, t - margin / len);
  return { ...to, x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}

// stopShort from one origin, as a function of the landing point; share(p): how much of the throw to p is kept.
export function wallStop(from, walls, margin = 0) {
  const list = walls ?? [];
  const stop = list.length ? (p) => stopShort(from, p, list, margin) : (p) => p;
  stop.share = (p) => {
    const len = Math.hypot(p.x - from.x, p.y - from.y);
    if (!len || !list.length) return 1;
    const t = firstHit(from, p, list);
    return t >= 1 ? 1 : Math.max(0, t - margin / len);
  };
  return stop;
}
