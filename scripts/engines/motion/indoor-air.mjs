// The air indoors: where it can move, which way and how fast. The map is cut into cells (half a square by default); two
// cells side by side share air unless a wall that stops movement stands between them (an open door lets it through).
// The air reaches what is connected to an opening to the outside (a door on the scene's edge standing open, a region
// that leads elsewhere or is marked as open to the outside) and is drawn out through it: every cell's air drains
// downhill toward the nearest way out, the flow of all it drains gathering as it goes, as water runs off a hillside.
// So the air streams fast through the doorways and corridors that carry the whole of what lies behind them, slows in
// open rooms and barely stirs in their corners; it curves round walls. A sealed room's air stands still. Opening a door
// sends a gust that sweeps out from the door. Worked out once when doors or walls change, and handed to the GPU as a
// small picture.

const SQRT2 = Math.SQRT2;
// The eight ways out of a cell: [di, dj, length].
const STEPS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQRT2], [1, -1, SQRT2], [-1, 1, SQRT2], [-1, -1, SQRT2]];
// A gust sweeps out from the door this fast (squares a second).
export const GUST_SPEED = 7;

// A tiny binary heap of [cost, index] for the walk outward.
const heap = () => {
  const a = [];
  return {
    push(c, k) { a.push([c, k]); let i = a.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; } },
    pop() { const top = a[0], last = a.pop(); if (a.length) { a[0] = last; let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; [a[m], a[i]] = [a[i], a[m]]; i = m; } } return top; },
    get size() { return a.length; },
  };
};

// The cells and which of them share air (pure): `walls` [{ c: [x1, y1, x2, y2], move, door, ds }], `bounds`
// { x, y, width, height }, `grid` px a square, `res` cells a square. Returns { cols, rows, cell, x, y, at(i, j),
// open(k, step) (whether air passes from cell k one step that way) }.
function cellsOf({ walls = [], bounds, grid = 100, res = 2 }) {
  const cell = grid / res, cols = Math.max(1, Math.ceil(bounds.width / cell)), rows = Math.max(1, Math.ceil(bounds.height / cell));
  const at = (i, j) => ({ x: bounds.x + (i + 0.5) * cell, y: bounds.y + (j + 0.5) * cell });
  // The walls that stop the air (not open doors), filed by the cells they touch, for quick tests.
  const solid = walls.filter((w) => Number(w.move) > 0 && !(Number(w.door) > 0 && Number(w.ds) === 1));
  const buckets = new Map();
  for (const w of solid) {
    const [x1, y1, x2, y2] = w.c;
    const i0 = Math.floor((Math.min(x1, x2) - bounds.x) / cell) - 1, i1 = Math.floor((Math.max(x1, x2) - bounds.x) / cell) + 1;
    const j0 = Math.floor((Math.min(y1, y2) - bounds.y) / cell) - 1, j1 = Math.floor((Math.max(y1, y2) - bounds.y) / cell) + 1;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k = `${i},${j}`; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(w.c); }
  }
  const cross = (a, b, [x1, y1, x2, y2]) => {
    const d = (b.x - a.x) * (y2 - y1) - (b.y - a.y) * (x2 - x1);
    if (Math.abs(d) < 1e-9) return false;
    const t = ((x1 - a.x) * (y2 - y1) - (y1 - a.y) * (x2 - x1)) / d, u = ((x1 - a.x) * (b.y - a.y) - (y1 - a.y) * (b.x - a.x)) / d;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  const pass = (i, j, ni, nj) => {
    const a = at(i, j), b = at(ni, nj);
    for (const c of buckets.get(`${i},${j}`) ?? []) if (cross(a, b, c)) return false;
    return true;
  };
  // Whether air passes each way out of each cell, worked out once (a diagonal only where both its sides are open too).
  const passes = new Uint8Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    let bits = 0;
    STEPS.forEach(([di, dj], s) => {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) return;
      if (s < 4 ? pass(i, j, ni, nj) : pass(i, j, ni, nj) && pass(i, j, ni, j) && pass(i, j, i, nj) && pass(ni, j, ni, nj) && pass(i, nj, ni, nj)) bits |= 1 << s;
    });
    passes[j * cols + i] = bits;
  }
  return { cols, rows, cell, x: bounds.x, y: bounds.y, at, open: (k, s) => (passes[k] & (1 << s)) !== 0 };
}

// The shortest way through the air from `seeds` (cell indices) to every cell (in cells; −1 where the air cannot go).
function walkOut(cells, seeds) {
  // Full precision: a distance stored rounded would look stale when taken back off the heap, and its cell never walked on.
  const { cols, rows, open } = cells, dist = new Float64Array(cols * rows).fill(-1), h = heap();
  for (const k of seeds) { if (dist[k] === 0) continue; dist[k] = 0; h.push(0, k); }
  while (h.size) {
    const [d, k] = h.pop(); if (d > dist[k] && dist[k] >= 0) continue;
    const i = k % cols, j = (k - i) / cols;
    STEPS.forEach(([di, dj, len], s) => {
      if (!open(k, s)) return;
      const nk = (j + dj) * cols + (i + di), nd = d + len;
      if (dist[nk] < 0 || nd < dist[nk] - 1e-6) { dist[nk] = nd; h.push(nd, nk); }
    });
  }
  return dist;
}

// Which way and how fast the air moves in each cell (pure). `openings`: polygons (flat x, y pairs) or points
// ({ x, y }) where the outside comes in. Returns { cols, rows, x, y, cell, dist (Float32Array, cells to the way out, −1
// sealed, 0 the opening), dir (Float32Array, x, y per cell: toward the outside), speed (Float32Array, 0 still – 1 the
// fastest streams) }.
export function draftField({ walls = [], bounds, grid = 100, openings = [], res = 2 } = {}) {
  const cells = cellsOf({ walls, bounds, grid, res }), { cols, rows, cell, at, open } = cells, n = cols * rows;
  const inside = ({ x, y }, p) => { let hit = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) if ((p[i + 1] > y) !== (p[j + 1] > y) && x < ((p[j] - p[i]) * (y - p[i + 1])) / (p[j + 1] - p[i + 1]) + p[i]) hit = !hit; return hit; };
  const seeds = [];
  for (const o of openings) {
    if (Array.isArray(o)) { for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) if (inside(at(i, j), o)) seeds.push(j * cols + i); }
    else if (o && Number.isFinite(o.x)) { const i = Math.floor((o.x - bounds.x) / cell), j = Math.floor((o.y - bounds.y) / cell); if (i >= 0 && j >= 0 && i < cols && j < rows) seeds.push(j * cols + i); }
  }
  const dist = walkOut(cells, seeds), dir = new Float32Array(n * 2), flow = new Float32Array(n), speed = new Float32Array(n);
  // Each cell's own air, drained downhill (toward the way out), split among its lower neighbours by how steeply each falls;
  // farthest first, so every cell has all it gathers before it passes it on.
  const order = []; for (let k = 0; k < n; k++) if (dist[k] > 0) order.push(k);
  order.sort((a, b) => dist[b] - dist[a]);
  for (const k of order) {
    const i = k % cols, j = (k - i) / cols, d = dist[k];
    flow[k] += 1;
    let total = 0, fx = 0, fy = 0; const outs = [];
    STEPS.forEach(([di, dj, len], s) => {
      if (!open(k, s)) return;
      const nk = (j + dj) * cols + (i + di), nd = dist[nk];
      if (nd < 0 || nd >= d) return;
      const fall = (d - nd) / len; outs.push([nk, fall]); total += fall; fx += (di / len) * fall; fy += (dj / len) * fall;
    });
    for (const [nk, fall] of outs) flow[nk] += (flow[k] * fall) / total;
    const m = Math.hypot(fx, fy) || 1; dir[k * 2] = fx / m; dir[k * 2 + 1] = fy / m;
  }
  // The streams curve: each cell's way blended with its open neighbours' (weighted by how much air they carry), twice.
  for (let pass = 0; pass < 2; pass++) {
    const next = new Float32Array(dir);
    for (const k of order) {
      const i = k % cols, j = (k - i) / cols; let sx = dir[k * 2] * flow[k] * 2, sy = dir[k * 2 + 1] * flow[k] * 2;
      STEPS.forEach(([di, dj], s) => { if (s > 3 || !open(k, s)) return; const nk = (j + dj) * cols + (i + di); if (dist[nk] > 0) { sx += dir[nk * 2] * flow[nk]; sy += dir[nk * 2 + 1] * flow[nk]; } });
      const m = Math.hypot(sx, sy); if (m > 0) { next[k * 2] = sx / m; next[k * 2 + 1] = sy / m; }
    }
    dir.set(next);
  }
  // How fast: the air a cell carries, eased (the square root) and scaled so the busiest streams run at 1; a cell at the
  // opening runs as its neighbours do.
  const carried = order.map((k) => Math.sqrt(flow[k])).sort((a, b) => a - b), top = carried[Math.floor(carried.length * 0.95)] || 1;
  for (const k of order) speed[k] = Math.min(1, Math.sqrt(flow[k]) / top);
  return { cols, rows, x: bounds.x, y: bounds.y, cell, grid, dist, dir, speed, cells };
}

// How long after a door opens the gust reaches each cell (pure, seconds; −1 where the air from that door cannot go):
// sweeping out from the door at `GUST_SPEED` squares a second, round walls as the air goes.
export function gustDelays(field, from, { grid = 100 } = {}) {
  const i = Math.floor((from.x - field.x) / field.cell), j = Math.floor((from.y - field.y) / field.cell), n = field.cols * field.rows;
  if (!field.cells || i < 0 || j < 0 || i >= field.cols || j >= field.rows) return new Float32Array(n).fill(-1);
  // The door itself sits on a wall: start from the cells either side of it.
  const seeds = [j * field.cols + i]; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ni = i + di, nj = j + dj; if (ni >= 0 && nj >= 0 && ni < field.cols && nj < field.rows) seeds.push(nj * field.cols + ni); }
  const steps = walkOut(field.cells, seeds), out = new Float32Array(n), perCell = field.cell / grid / GUST_SPEED;
  for (let k = 0; k < n; k++) out[k] = steps[k] < 0 ? -1 : steps[k] * perCell;
  return out;
}

// The openings a scene has without being told (pure): its doors on the scene's edge standing open (or a gap there), as
// points just inside; `regions` [{ polygons, leads (a teleport or a level change), outside (marked so) }] those that lead
// out or are marked. `edge` how near the scene's edge a door counts (px).
export function sceneOpenings({ walls = [], regions = [], bounds, grid = 100 } = {}) {
  const out = [], edge = grid * 0.75;
  for (const w of walls) {
    if (!(Number(w.door) > 0) || Number(w.ds) !== 1) continue;
    const [x1, y1, x2, y2] = w.c, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const near = Math.min(mx - bounds.x, bounds.x + bounds.width - mx, my - bounds.y, bounds.y + bounds.height - my);
    if (near < edge) out.push({ x: mx, y: my });
  }
  for (const r of regions) if (r.leads || r.outside) out.push(...(r.polygons ?? []));
  return out;
}

// How the air moves now (pure, 0–1): a steady draft where there is a way out, and a gust for a few seconds after a door
// on that way opens (`since` seconds ago), as the still air rushes for it. Before the gust reaches a place
// (`since` < 0), the steady draft.
// The gust swells in over a second as it reaches a place and dies away over a few: no sharp front sweeping the rooms.
const swell = (s) => { const k = Math.min(1, Math.max(0, s / 1.2)); return k * k * (3 - 2 * k); };
export const draftStrength = (since = Infinity) => (since < 0 ? 0.3 : 0.3 + 0.3 * swell(since) * Math.exp(-Math.max(0, since - 1.2) / 3));

// The fires' smoke as it builds up (its own state, no Foundry): each fire keeps adding to the air round it, the smoke spreads
// to the cells it shares air with (never through a wall or a shut door), and the draft carries it downhill, through the
// doorways and out at the way out, where it is gone. So a room fills as time passes, a sealed one furthest and thickest,
// and one with a way out streams it away. setup(field, fires) keeps what is in the air when a door changes; step(seconds)
// moves it on and writes `pixels` (alpha per cell, for the GPU). Only cells holding smoke are looked at.
const SMOKE_STEP = 0.125;
const SMOKE_AIR = { spread: 1.5, run: 2.6, fade: 0.012, made: 0.25, gain: 1.6, wide: 1 };
// Mist the same way: a region keeps it full while the air stands still, and open a door and the draft draws it out through
// the doorway, thinning the room, fading as it goes. Every cell of its region is a source (`wide` 0). Slowly: a door's
// new air takes hold over `ease` seconds and a room drains over half a minute. With no draft, an open door still lets it
// spread some squares into the next room, and the door's swing pushes it through (push()).
export const MIST_AIR = { spread: 1, run: 0.9, fade: 0.012, made: 0.04, gain: 1, wide: 0, ease: 6, shove: 2 };
// How hard a door just opened pushes the air (pure, 0–1), `t` seconds after: easing in, holding, easing off.
export const doorPushAt = (t) => (t < 0 ? 0 : t < 2 ? t / 2 : t < 6 ? 1 : t < 12 ? (12 - t) / 6 : 0);
const PUSH_REACH = 6;
export function createSmokeAir({ spread: SMOKE_SPREAD, run: SMOKE_RUN, fade: SMOKE_FADE, made: SMOKE_MADE, gain: SMOKE_GAIN, wide: SMOKE_WIDE, ease: SMOKE_EASE = 0, shove: SMOKE_SHOVE = 0 } = SMOKE_AIR) {
  // A door's swing, for the seconds it lasts: how far each cell is from the door, which side holds what it pushes, its age.
  let pushed = null;
  // How much of the draft has taken hold since the air last changed.
  let flowing = 1;
  let field = null, value = null, delta = null, seen = null, making = null, active = [], sources = [], pixels = null;
  const wake = (k) => { if (!seen[k]) { seen[k] = 1; active.push(k); } };
  const once = (dt) => {
    const { cols, dist, speed, cells } = field, open = cells.open;
    if (flowing < 1) flowing = Math.min(1, flowing + dt / SMOKE_EASE);
    if (pushed && (pushed.age += dt) > 12) pushed = null;
    for (const k of sources) { delta[k] += SMOKE_MADE * dt * (1 - value[k]); wake(k); }
    const count = active.length;
    for (let n = 0; n < count; n++) {
      const k = active[n], v = value[k]; if (v <= 0) continue;
      const i = k % cols, j = (k - i) / cols;
      // Spreading: from each cell to its neighbours holding less.
      for (let s = 0; s < 4; s++) {
        if (!open(k, s)) continue;
        const nk = (j + STEPS[s][1]) * cols + (i + STEPS[s][0]), move = SMOKE_SPREAD * dt * (v - value[nk]);
        if (move > 0) { delta[k] -= move; delta[nk] += move; wake(nk); }
      }
      // It fades away from where it is made, not where it is being made.
      if (!making[k]) delta[k] -= v * SMOKE_FADE * dt;
      // A door just opened: toward it on the side it holds, on away from it beyond.
      if (pushed && pushed.dist[k] >= 0 && pushed.dist[k] < pushed.reach) {
        const c = cells.at(i, j), mine = (c.x - pushed.door.x) * pushed.door.nx + (c.y - pushed.door.y) * pushed.door.ny, toward = mine * pushed.side > 0;
        let total = 0;
        const fall = (nk, len) => {
          const d = pushed.dist[nk]; if (d < 0) return 0;
          // In the doorway itself: straight across it.
          if (toward && pushed.dist[k] === 0) { const o = cells.at(nk % cols, (nk - (nk % cols)) / cols); return ((o.x - pushed.door.x) * pushed.door.nx + (o.y - pushed.door.y) * pushed.door.ny) * pushed.side < 0 ? 1 / len : 0; }
          const step = toward ? pushed.dist[k] - d : d - pushed.dist[k]; return step > 0 ? step / len : 0;
        };
        for (let s = 0; s < 8; s++) { if (open(k, s)) total += fall((j + STEPS[s][1]) * cols + (i + STEPS[s][0]), STEPS[s][2]); }
        if (total > 0) {
          const moved = v * Math.min(0.3, SMOKE_SHOVE * doorPushAt(pushed.age) * (1 - pushed.dist[k] / pushed.reach) * dt);
          delta[k] -= moved;
          for (let s = 0; s < 8; s++) { if (!open(k, s)) continue; const nk = (j + STEPS[s][1]) * cols + (i + STEPS[s][0]), w = fall(nk, STEPS[s][2]); if (w > 0) { delta[nk] += (moved * w) / total; wake(nk); } }
        }
      }
      // The draft: a share of it carried to the cells lower toward the way out, by how fast the air runs here.
      if (dist[k] === 0) { delta[k] -= v * Math.min(1, 2 * dt); continue; }
      if (!(dist[k] > 0)) continue;
      let total = 0;
      for (let s = 0; s < 8; s++) { if (!open(k, s)) continue; const nk = (j + STEPS[s][1]) * cols + (i + STEPS[s][0]); if (dist[nk] >= 0 && dist[nk] < dist[k]) total += (dist[k] - dist[nk]) / STEPS[s][2]; }
      if (!total) continue;
      const carried = v * Math.min(0.45, speed[k] * SMOKE_RUN * flowing * dt);
      delta[k] -= carried;
      for (let s = 0; s < 8; s++) { if (!open(k, s)) continue; const nk = (j + STEPS[s][1]) * cols + (i + STEPS[s][0]); if (dist[nk] >= 0 && dist[nk] < dist[k]) { delta[nk] += (carried * (dist[k] - dist[nk])) / STEPS[s][2] / total; wake(nk); } }
    }
    const kept = [];
    for (const k of active) {
      const v = Math.min(1, Math.max(0, value[k] + delta[k])); delta[k] = 0;
      value[k] = v < 0.002 ? 0 : v;
      if (value[k] > 0) kept.push(k); else seen[k] = 0;
    }
    active = kept;
  };
  return {
    setup(next, fires = []) {
      const size = next.cols * next.rows;
      if (!value || value.length !== size || field?.cols !== next.cols) { value = new Float32Array(size); delta = new Float32Array(size); seen = new Uint8Array(size); making = new Uint8Array(size); pixels = new Uint8Array(size * 4); active = []; }
      if (field && next !== field && SMOKE_EASE > 0) flowing = 0;
      field = next; for (const k of sources) making[k] = 0; sources = [];
      for (const f of fires) {
        const fi = Math.floor((f.x - next.x) / next.cell), fj = Math.floor((f.y - next.y) / next.cell);
        for (let dj = -SMOKE_WIDE; dj <= SMOKE_WIDE; dj++) for (let di = -SMOKE_WIDE; di <= SMOKE_WIDE; di++) {
          const i = fi + di, j = fj + dj; if (i < 0 || j < 0 || i >= next.cols || j >= next.rows) continue;
          sources.push(j * next.cols + i); making[j * next.cols + i] = 1;
        }
      }
    },
    step(seconds) {
      if (!field) return false;
      for (let left = seconds; left > 1e-6; left -= SMOKE_STEP) once(Math.min(left, SMOKE_STEP));
      for (let k = 0; k < value.length; k++) pixels[k * 4 + 3] = Math.round(Math.min(1, value[k] * SMOKE_GAIN) * 255);
      return true;
    },
    // A door just opened (doorPlace's: x, y, nx, ny) pushes what it holds through. Returns the way it pushes ({ x, y }), or
    // null when neither side holds any.
    push(door) {
      if (!field || !SMOKE_SHOVE) return null;
      const { x, y, cols, rows, cell, cells } = field, res = (field.grid ?? cell * 2) / cell;
      const here = (sign) => { let sum = 0; for (let a = -1; a <= 1; a++) for (const reach of [1, 2]) { const i = Math.floor((door.x + door.nx * sign * cell * reach + (door.ax ?? 0) * cell * a - x) / cell), j = Math.floor((door.y + door.ny * sign * cell * reach + (door.ay ?? 0) * cell * a - y) / cell); if (i >= 0 && j >= 0 && i < cols && j < rows) sum += value[j * cols + i]; } return sum; };
      const a = here(1), b = here(-1); if (a < 0.01 && b < 0.01) return null;
      // The doorway: the cells along it, on both sides.
      const side = a >= b ? 1 : -1, seeds = [], half = Number(door.half) || cell;
      for (const over of [-0.5, 0.5]) for (let along = -half; along <= half; along += cell / 2) { const i = Math.floor((door.x + door.nx * cell * over + (door.ax ?? 0) * along - x) / cell), j = Math.floor((door.y + door.ny * cell * over + (door.ay ?? 0) * along - y) / cell); if (i >= 0 && j >= 0 && i < cols && j < rows && !seeds.includes(j * cols + i)) seeds.push(j * cols + i); }
      if (!seeds.length) return null;
      pushed = { door, side, age: 0, reach: res * PUSH_REACH, dist: walkOut(cells, seeds) };
      return { x: -door.nx * side, y: -door.ny * side };
    },
    // Its sources full at once (mist already lying there when the scene loads).
    fill() { for (const k of sources) { value[k] = 1; wake(k); } this.step(0); },
    at(k) { return value?.[k] ?? 0; },
    get pixels() { return pixels; },
    get busy() { return sources.length > 0 || active.length > 0; },
    get held() { let sum = 0; for (const k of active) sum += value[k]; return sum; },
  };
}

// The field as a picture for the GPU (rgba per cell): red and green the way the air flows (0.5 still), blue how fast
// (0 sealed), alpha how long the last gust takes to reach it (0–255 for 0–6 s; 255 too where it never comes).
export function draftPixels(field, delays = null) {
  const { cols, rows, dist, dir, speed } = field, px = new Uint8Array(cols * rows * 4);
  for (let k = 0; k < cols * rows; k++) {
    px[k * 4] = Math.round((dir[k * 2] * 0.5 + 0.5) * 255); px[k * 4 + 1] = Math.round((dir[k * 2 + 1] * 0.5 + 0.5) * 255);
    px[k * 4 + 2] = dist[k] > 0 ? Math.max(1, Math.round(speed[k] * 255)) : 0;
    px[k * 4 + 3] = delays && delays[k] >= 0 ? Math.min(254, Math.round((delays[k] / 6) * 255)) : 255;
  }
  return px;
}
