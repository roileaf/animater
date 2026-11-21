// What counts as inside a building, and which of its walls are partitions.
//
// A room is what the walls close in (roof-looks.mjs roomAt), and that is the right answer for a roof over one room.
// It is the wrong answer for a house: an inside wall makes two rooms of one building, so a roof laid on a room
// stopped at the partition (Roi: "we need to know how to deal with inside walls"). The way to tell the inside of a
// building from the outside is to come at it from the outside: flood the map from its edge, blocked by every wall
// there is, and whatever the flood cannot reach is indoors. Then a building is the indoor squares joined to the one
// clicked on — walked without regard for walls, so it crosses its own partitions — and a partition is a wall with
// indoors on both sides.
//
// Pure: plain wall records in, plain answers out. Nothing here knows about Foundry.

import { crosses } from './roof-looks.mjs';

/** How many squares a flood may walk before it is called a map rather than a building. */
export const PLAN_MOST = 4000;

const key = (cx, cy) => `${cx},${cy}`;

/**
 * The squares the open air can reach, walked in from the edge of the map. `walls` are plain `{ c }` records: every
 * one of them blocks, doorways and windows included, since a building's outline is its stone whether or not a door
 * in it happens to be open.
 */
export function outsideSquares(walls, { grid = 100, bounds, most = PLAN_MOST } = {}) {
  const out = new Set();
  if (!bounds || !(grid > 0)) return out;
  const segs = (walls ?? []).filter((w) => Array.isArray(w?.c) && w.c.length >= 4).map((w) => [[w.c[0], w.c[1]], [w.c[2], w.c[3]]]);
  const x0 = Math.floor(bounds.x / grid), y0 = Math.floor(bounds.y / grid);
  const x1 = Math.ceil((bounds.x + bounds.w) / grid) - 1, y1 = Math.ceil((bounds.y + bounds.h) / grid) - 1;
  const middle = (cx, cy) => [cx * grid + grid / 2, cy * grid + grid / 2];
  const queue = [];
  for (let cx = x0; cx <= x1; cx++) { queue.push([cx, y0], [cx, y1]); }
  for (let cy = y0; cy <= y1; cy++) { queue.push([x0, cy], [x1, cy]); }
  for (const [cx, cy] of queue) out.add(key(cx, cy));
  let n = 0;
  while (queue.length) {
    if (++n > most) break;
    const [cx, cy] = queue.shift();
    const from = middle(cx, cy);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
      const k = key(nx, ny);
      if (out.has(k)) continue;
      const to = middle(nx, ny);
      if (segs.some(([a, b]) => crosses(from, to, a, b))) continue;
      out.add(k);
      queue.push([nx, ny]);
    }
  }
  return out;
}

/**
 * The whole building under a point: every indoor square joined to it, walked straight through its own partitions.
 * Returns `{ x, y, w, h, squares }` in map units, or null for a point that is not indoors at all.
 */
export function buildingAt(point, walls, { grid = 100, bounds, most = PLAN_MOST, outside = null } = {}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !(grid > 0) || !bounds) return null;
  const air = outside ?? outsideSquares(walls, { grid, bounds, most });
  const start = [Math.floor(point.x / grid), Math.floor(point.y / grid)];
  if (air.has(key(...start))) return null;
  const x0 = Math.floor(bounds.x / grid), y0 = Math.floor(bounds.y / grid);
  const x1 = Math.ceil((bounds.x + bounds.w) / grid) - 1, y1 = Math.ceil((bounds.y + bounds.h) / grid) - 1;
  const seen = new Set([key(...start)]);
  const queue = [start];
  let lx = start[0], hx = start[0], ly = start[1], hy = start[1], n = 0;
  while (queue.length) {
    if (++n > most) return null;
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || seen.has(k) || air.has(k)) continue;
      seen.add(k);
      queue.push([nx, ny]);
      if (nx < lx) lx = nx; if (nx > hx) hx = nx;
      if (ny < ly) ly = ny; if (ny > hy) hy = ny;
    }
  }
  return { x: lx * grid, y: ly * grid, w: (hx - lx + 1) * grid, h: (hy - ly + 1) * grid, squares: seen.size };
}

/**
 * The squares of the building under a point, as a set of `cx,cy` keys — the walk buildingAt measures, handed over
 * rather than counted. Empty for a point that is not indoors at all.
 */
export function roomCells(point, walls, { grid = 100, bounds, most = PLAN_MOST, outside = null, through = true } = {}) {
  const seen = new Set();
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !(grid > 0) || !bounds) return seen;
  const air = outside ?? outsideSquares(walls, { grid, bounds, most });
  const start = [Math.floor(point.x / grid), Math.floor(point.y / grid)];
  if (air.has(key(...start))) return seen;
  const x0 = Math.floor(bounds.x / grid), y0 = Math.floor(bounds.y / grid);
  const x1 = Math.ceil((bounds.x + bounds.w) / grid) - 1, y1 = Math.ceil((bounds.y + bounds.h) / grid) - 1;
  // `through`: a building is walked straight through its own partitions, a room is not — one room is what the walls
  // close in, which is the whole of what some callers mean by an area.
  const segs = through ? [] : (walls ?? []).filter((w) => Array.isArray(w?.c) && w.c.length >= 4).map((w) => [[w.c[0], w.c[1]], [w.c[2], w.c[3]]]);
  const middle = (cx, cy) => [cx * grid + grid / 2, cy * grid + grid / 2];
  seen.add(key(...start));
  const queue = [start];
  let n = 0;
  while (queue.length) {
    if (++n > most) break;
    const [cx, cy] = queue.shift();
    const at = through ? null : middle(cx, cy);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy, k = key(nx, ny);
      if (nx < x0 || ny < y0 || nx > x1 || ny > y1 || seen.has(k) || air.has(k)) continue;
      if (at) { const to = middle(nx, ny); if (segs.some(([a, b]) => crosses(at, to, a, b))) continue; }
      seen.add(k);
      queue.push([nx, ny]);
    }
  }
  return seen;
}

/**
 * The outline of a set of squares, as closed loops of map points: `[[x, y, x, y, ...], ...]`.
 *
 * Every side of a square whose neighbour is not in the set is a piece of the border, emitted the same way round the
 * square each time, so the pieces chain head to tail into loops by themselves — an outer wall one way round and a
 * hole in the middle the other, which is what a region wants of a shape with a courtyard in it. Runs of points along
 * one straight line are merged, so a room ten squares across is four corners and not forty.
 */
export function roomOutline(cells, { grid = 100 } = {}) {
  if (!cells || !cells.size || !(grid > 0)) return [];
  const has = (cx, cy) => cells.has(key(cx, cy));
  // Clockwise round each square (y runs down the screen), so an outer border comes out clockwise and a hole the
  // other way, and every corner has one edge arriving and one leaving.
  const from = new Map();
  const edge = (ax, ay, bx, by) => {
    const at = `${ax},${ay}`;
    if (!from.has(at)) from.set(at, []);
    from.get(at).push([bx, by]);
  };
  for (const k of cells) {
    const [cx, cy] = k.split(',').map(Number);
    const x = cx * grid, y = cy * grid, r = x + grid, b = y + grid;
    if (!has(cx, cy - 1)) edge(x, y, r, y);
    if (!has(cx + 1, cy)) edge(r, y, r, b);
    if (!has(cx, cy + 1)) edge(r, b, x, b);
    if (!has(cx - 1, cy)) edge(x, b, x, y);
  }
  const loops = [];
  for (const [at, outs] of from) {
    while (outs.length) {
      const loop = [];
      let [x, y] = at.split(',').map(Number);
      let next = outs.pop();
      const first = `${x},${y}`;
      loop.push(x, y);
      // Walk the border until it comes back; a corner where two rooms pinch has two ways on, and either closes.
      while (next) {
        [x, y] = next;
        if (`${x},${y}` === first) break;
        loop.push(x, y);
        const ways = from.get(`${x},${y}`);
        next = ways?.length ? ways.pop() : null;
      }
      if (loop.length >= 6) loops.push(straighten(loop));
    }
  }
  return loops;
}

/** A loop with its in-line points dropped: three points on one straight run are two. */
function straighten(loop) {
  const n = loop.length / 2;
  if (n < 3) return loop;
  const out = [];
  for (let i = 0; i < n; i++) {
    const px = loop[((i + n - 1) % n) * 2], py = loop[((i + n - 1) % n) * 2 + 1];
    const x = loop[i * 2], y = loop[i * 2 + 1];
    const nx = loop[((i + 1) % n) * 2], ny = loop[((i + 1) % n) * 2 + 1];
    // The turn at this point: zero when it carries straight on.
    if ((x - px) * (ny - y) - (y - py) * (nx - x) !== 0) out.push(x, y);
  }
  return out.length >= 6 ? out : loop;
}

/**
 * Every square the open air cannot reach, gathered into as few rectangles as will hold them.
 *
 * This is the whole indoors of a map in one answer, for a scene whose buildings are roofed: where the sun does not
 * fall and the weather does not land. It is rectangles rather than one outline per room because what asks is a
 * point-in-polygon test run on every decoration and creature, and a box is the cheapest shape there is; a room of
 * any ordinary shape comes back as a handful of them.
 *
 * Greedy: take the widest run left on a row, carry it down as far as the whole run holds, and cut that block out.
 * `most` caps how many rectangles are cut, so a map that is nearly all indoors cannot stall a frame.
 */
export function indoorRects(outside, { grid = 100, bounds, most = PLAN_MOST } = {}) {
  if (!outside || !bounds || !(grid > 0)) return [];
  const x0 = Math.floor(bounds.x / grid), y0 = Math.floor(bounds.y / grid);
  const x1 = Math.ceil((bounds.x + bounds.w) / grid) - 1, y1 = Math.ceil((bounds.y + bounds.h) / grid) - 1;
  const left = new Set();
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) { if (!outside.has(key(cx, cy))) left.add(key(cx, cy)); }
  const out = [];
  for (let cy = y0; cy <= y1 && out.length < most; cy++) {
    for (let cx = x0; cx <= x1 && out.length < most; cx++) {
      if (!left.has(key(cx, cy))) continue;
      let w = 1;
      while (cx + w <= x1 && left.has(key(cx + w, cy))) w++;
      let h = 1;
      while (cy + h <= y1) {
        let whole = true;
        for (let i = 0; i < w; i++) if (!left.has(key(cx + i, cy + h))) { whole = false; break; }
        if (!whole) break;
        h++;
      }
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) left.delete(key(cx + i, cy + j));
      out.push({ x: cx * grid, y: cy * grid, w: w * grid, h: h * grid });
      cx += w - 1;
    }
  }
  return out;
}

/**
 * Is this stretch of wall a partition — indoors on both sides? Asked of the middle of the run and of a step either
 * way along it, so a wall that runs along the outside of a building for part of its length is not called one.
 */
export function partition(points, { grid = 100, outside, bounds } = {}) {
  if (!Array.isArray(points) || points.length < 2 || !outside || !bounds) return false;
  const at = (t) => {
    // A point a fraction along the run, and the way it faces there.
    const spans = [];
    let total = 0;
    for (let i = 0; i + 1 < points.length; i++) { const d = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]); spans.push(d); total += d; }
    if (!(total > 0)) return null;
    let want = total * t;
    for (let i = 0; i < spans.length; i++) {
      if (want > spans[i] && i < spans.length - 1) { want -= spans[i]; continue; }
      const a = points[i], b = points[i + 1], k = spans[i] > 0 ? want / spans[i] : 0;
      const dx = (b[0] - a[0]) / (spans[i] || 1), dy = (b[1] - a[1]) / (spans[i] || 1);
      return { at: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], side: [-dy, dx] };
    }
    return null;
  };
  const indoors = (p) => !outside.has(key(Math.floor(p[0] / grid), Math.floor(p[1] / grid)));
  const reach = grid * 0.75;
  let both = 0, asked = 0;
  for (const t of [0.3, 0.5, 0.7]) {
    const spot = at(t);
    if (!spot) continue;
    asked++;
    const one = [spot.at[0] + spot.side[0] * reach, spot.at[1] + spot.side[1] * reach];
    const two = [spot.at[0] - spot.side[0] * reach, spot.at[1] - spot.side[1] * reach];
    if (indoors(one) && indoors(two)) both++;
  }
  return asked > 0 && both === asked;
}
