// Map painting's Heights tab: raised ground and ramps, each kept on a region of its own so it reaches every screen.
// A raised part is a region with `flags.animater.height` (how high its top stands over the level's floor, in the scene's
// units); a ramp is a strip with `flags.animater.ramp` ({ ax, ay, bx, by, w }: from its low end a to its high end b, w wide).
// From them: the ground's height at any point, a walking token's elevation as it moves, the cliff edges (where the ground
// steps by more than a little and no ramp meets it) and the shadow a raised part throws away from the sun. Pure.

import { sunReach } from '../motion/sun.mjs';

// A height's step on the wheel, when the scene says none (its grid's distance).
export const HEIGHT_STEP = 5;
export const HEIGHT_MAX = 500;

/** A region's height (its Animater flags), or null when it is not raised. */
export const readHeight = (own) => { const h = Number(own?.height); return Number.isFinite(h) && h > 0 ? Math.min(HEIGHT_MAX, h) : null; };

// A raised part's open edges (`openEdges`, circles [x, y, r] on the map, painted along its rim): where its edge runs through
// one it has no cliff and no walls, the ground there rising as a slope does. So a part can be a cliff on one side only.
export const OPEN_EDGES_MOST = 400;
/** A region's open edges (its Animater flags) as [{ x, y, r }]. */
export const readOpenEdges = (own) => (Array.isArray(own?.openEdges) ? own.openEdges : []).map((c) => (Array.isArray(c) ? { x: Number(c[0]), y: Number(c[1]), r: Number(c[2]) } : null)).filter((c) => c && [c.x, c.y, c.r].every(Number.isFinite) && c.r > 0);
/** Whether a point lies in one of a part's open edges. */
export const openAt = (part, p) => (part?.open ?? []).some((c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= c.r * c.r);
/** Whether a part's outline passes through a circle ({ x, y, r }): sampled every `step` px along it. */
export function edgeTouches(part, circle, step = 4) {
  for (const a of part.areas ?? []) for (const pts of [a, ...(a.holes ?? [])]) {
    const n = pts.length / 2;
    for (let i = 0; i < n; i++) {
      const x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[((i + 1) % n) * 2], y2 = pts[((i + 1) % n) * 2 + 1], len = Math.hypot(x2 - x1, y2 - y1), k = Math.max(1, Math.ceil(len / step));
      for (let s = 0; s <= k; s++) { const x = x1 + ((x2 - x1) * s) / k, y = y1 + ((y2 - y1) * s) / k; if ((x - circle.x) ** 2 + (y - circle.y) ** 2 <= circle.r * circle.r) return true; }
    }
  }
  return false;
}

// What a crossing is: a ramp (a slope on the ground), a ladder or a rope (straight up a cliff face), or a bridge (spanning over
// lower ground between two raised parts, walked only by those already at its height).
export const CROSSING_KINDS = Object.freeze([['ramp', 'Ramp'], ['ladder', 'Ladder'], ['rope', 'Rope'], ['bridge', 'Bridge']]);
const KIND_NAMES = Object.fromEntries(CROSSING_KINDS);
/** A region's crossing (its Animater flags, `ramp`) as { a, b, w, kind, lo, hi } (lo and hi: its ends' heights when set by
 *  hand, else null: they follow the ground), or null when it is not one. */
export const readRamp = (own) => {
  const r = own?.ramp; if (!r || typeof r !== 'object') return null;
  const [ax, ay, bx, by, w] = [r.ax, r.ay, r.bx, r.by, r.w].map(Number);
  if (![ax, ay, bx, by, w].every(Number.isFinite) || !(w > 0) || (ax === bx && ay === by)) return null;
  const given = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return { a: { x: ax, y: ay }, b: { x: bx, y: by }, w, kind: KIND_NAMES[r.kind] ? r.kind : 'ramp', lo: given(r.lo), hi: given(r.hi) };
};

const inLoop = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) { const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
/** Whether a point is in a region's areas (flat [x, y, …] outlines, each with its `holes`). */
export const inAreas = (p, areas) => (areas ?? []).some((a) => inLoop(p.x, p.y, a) && !(a.holes ?? []).some((h) => inLoop(p.x, p.y, h)));

/** The ground's height from raised parts ({ id, height, areas }) and crossings ({ id, a, b, w, kind, lo, hi }):
 *  groundAt(p) the highest raised part under p (0 on the floor), rampAt(p, from) the crossing under p and how far along it
 *  ({ ramp, t }), heightAt(p, from) the two together (on a crossing, its first end's height to its second's, by how far
 *  along), partAt(p) the part. `from`, when given, is the height a walker comes from: a bridge counts only for one already
 *  about at its height there (one walking under it stays on the ground). */
export const BRIDGE_REACH = 2.5;
export function heightField({ parts = [], ramps = [] } = {}) {
  const partAt = (p) => { let best = null; for (const part of parts) if ((!best || part.height > best.height) && inAreas(p, part.areas)) best = part; return best; };
  const groundAt = (p) => partAt(p)?.height ?? 0;
  const rampEnds = (ramp) => [ramp.lo ?? groundAt(ramp.a), ramp.hi ?? groundAt(ramp.b)];
  const rampAt = (p, from) => {
    for (const ramp of ramps) {
      const vx = ramp.b.x - ramp.a.x, vy = ramp.b.y - ramp.a.y, len2 = vx * vx + vy * vy; if (!len2) continue;
      const t = ((p.x - ramp.a.x) * vx + (p.y - ramp.a.y) * vy) / len2, off = Math.abs((p.x - ramp.a.x) * vy - (p.y - ramp.a.y) * vx) / Math.sqrt(len2);
      if (!(t >= 0 && t <= 1 && off <= ramp.w / 2)) continue;
      if (ramp.kind === 'bridge' && from !== undefined && from !== null) { const [lo, hi] = rampEnds(ramp); if (Math.abs(lo + (hi - lo) * t - from) > BRIDGE_REACH) continue; }
      return { ramp, t };
    }
    return null;
  };
  const heightAt = (p, from) => { const hit = rampAt(p, from); if (!hit) return groundAt(p); const [lo, hi] = rampEnds(hit.ramp); return lo + (hi - lo) * hit.t; };
  return { parts, ramps, partAt, groundAt, rampAt, rampEnds, heightAt };
}

const half = (v) => Math.round(v * 2) / 2;

/** Where a token's elevation goes as it moves from `from` to `to` (points on the map): a walker (standing on the ground,
 *  or under it) takes the ground's height where it arrives, over the level's `base`; one above the ground (flying) keeps
 *  its own. Null when it stays as it is. */
export function walkerElevation({ elevation, from, to, field, base = 0, tolerance = 0.5 }) {
  const now = Number(elevation) || 0, before = base + field.heightAt(from);
  if (now > before + tolerance) return null;
  const after = half(base + field.heightAt(to));
  return Math.abs(after - now) < 1e-6 ? null : after;
}

/** The same along a move's waypoints (`path`, points on the map): a walker's elevation at each, so it climbs a ramp as it
 *  goes; null for one above the ground. */
export function walkerPath({ elevation, from, path, field, base = 0, tolerance = 0.5 }) {
  const now = Number(elevation) || 0;
  if (now > base + field.heightAt(from, now - base) + tolerance) return null;
  // (Step by step: a bridge is walked onto from its own height, and stays under one walking beneath it.)
  let at = now - base;
  return path.map((p) => { at = field.heightAt(p, at); return half(base + at); });
}

/** The next height on the wheel: a step up or down, never under one step nor over HEIGHT_MAX. */
export const nextHeight = (height, up, step = HEIGHT_STEP) => { const s = Number(step) > 0 ? Number(step) : HEIGHT_STEP; const h = Math.round((Number(height) || 0) / s) * s + (up ? s : -s); return Math.min(HEIGHT_MAX, Math.max(s, h)); };

/** A ramp from a drag (scene points `a` to `b`), turned so it climbs from a to b; null when it is too short or its two ends
 *  stand at the same height (it would climb nothing). */
export function rampFromDrag({ a, b, w, field, min = 20, kind = 'ramp' }) {
  if (!a || !b || Math.hypot(b.x - a.x, b.y - a.y) < min) return null;
  const lo = field.groundAt(a), hi = field.groundAt(b);
  // (A bridge spans between raised ground, at one height or two; the rest climb from one height to another.)
  if (kind === 'bridge') return lo > 0 || hi > 0 ? { a: { ...a }, b: { ...b }, w, kind } : null;
  if (lo === hi) return null;
  return lo < hi ? { a: { ...a }, b: { ...b }, w, kind } : { a: { ...b }, b: { ...a }, w, kind };
}

/** A ramp's strip, its four corners as a flat [x, y, …] outline. */
export function rampOutline({ a, b, w }) {
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1, nx = (-(b.y - a.y) / len) * (w / 2), ny = ((b.x - a.x) / len) * (w / 2);
  return [a.x + nx, a.y + ny, b.x + nx, b.y + ny, b.x - nx, b.y - ny, a.x - nx, a.y - ny];
}

/** A raised part's region (shapes already in scene units), named after its height. */
export const heightRegionData = ({ shapes, height, levelId = null, units = 'ft' }) => ({ name: heightName(height, units), color: '#8a7a5c', shapes, levels: levelId ? [levelId] : [], flags: { animater: { height } } });
export const heightName = (height, units = 'ft') => `Raised ${height} ${units}`.trim();

/** A crossing's region: its strip, and the crossing in its flags (named after its kind). */
export const rampRegionData = ({ a, b, w, kind = 'ramp', levelId = null }) => ({ name: KIND_NAMES[kind] ?? 'Ramp', color: '#b08c5a', shapes: [{ type: 'polygon', points: rampOutline({ a, b, w }).map((v) => Math.round(v)), hole: false }], levels: levelId ? [levelId] : [], flags: { animater: { ramp: { ax: Math.round(a.x), ay: Math.round(a.y), bx: Math.round(b.x), by: Math.round(b.y), w: Math.round(w), ...(kind && kind !== 'ramp' ? { kind } : {}) } } } });

/** A closed outline (flat [x, y, …]) with its small wiggles taken out (Douglas–Peucker, within `eps`): a traced outline steps
 *  pixel by pixel, and a wall per step would be hundreds. Never fewer than three corners. */
export function simplifyLoop(pts, eps) {
  const n = pts.length / 2; if (!(eps > 0) || n <= 4) return pts;
  // (Split at the corner furthest from the first, so the closed loop is two open runs.)
  let far = 0, best = -1; for (let i = 1; i < n; i++) { const d = (pts[i * 2] - pts[0]) ** 2 + (pts[i * 2 + 1] - pts[1]) ** 2; if (d > best) { best = d; far = i; } }
  const keep = new Uint8Array(n); keep[0] = keep[far] = 1;
  const run = (a, b) => {
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[(b % n) * 2], by = pts[(b % n) * 2 + 1], len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1, at = -1;
    for (let i = a + 1; i < b; i++) { const x = pts[(i % n) * 2], y = pts[(i % n) * 2 + 1], d = Math.abs((bx - ax) * (ay - y) - (ax - x) * (by - ay)) / len; if (d > worst) { worst = d; at = i; } }
    if (worst > eps) { keep[at % n] = 1; run(a, at); run(at, b); }
  };
  run(0, far); run(far, n);
  const out = []; for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out.length >= 6 ? out : pts;
}

/** The cliff edges (pieces of each raised part's outline where the ground steps by `gap` or more, and no ramp meets it),
 *  for walls: [{ of: the part's id, c: [x1, y1, x2, y2] }]. Each edge is its higher side's: a rock on a shelf owns its own
 *  edge, the shelf the one down to the floor. Outlines are cut into pieces at most `piece` long, so a ramp meeting part of
 *  a long edge opens only that part; neighbouring pieces kept are joined again. Each outline is first smoothed within `smooth`.
 *  `bounds` ({ x, y, width, height }, the map): past its edge the ground counts as level, so a part painted off the map has no
 *  cliff there. */
const offMap = (p, bounds) => !!bounds && (p.x < bounds.x || p.y < bounds.y || p.x > bounds.x + bounds.width || p.y > bounds.y + bounds.height);
export function cliffEdges({ field, gap = 2.5, probe = 4, piece = 25, smooth = 0, bounds = null }) {
  const out = [];
  for (const part of field.parts) {
    const loops = []; for (const a of part.areas ?? []) { loops.push(simplifyLoop(a, smooth)); for (const h of a.holes ?? []) loops.push(simplifyLoop(h, smooth)); }
    for (const pts of loops) {
      const n = pts.length / 2;
      for (let i = 0; i < n; i++) {
        const x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[((i + 1) % n) * 2], y2 = pts[((i + 1) % n) * 2 + 1], len = Math.hypot(x2 - x1, y2 - y1);
        if (!(len > 0)) continue;
        const nx = -(y2 - y1) / len, ny = (x2 - x1) / len, k = Math.max(1, Math.ceil(len / piece));
        let run = null;
        const close = () => { if (run) { out.push({ of: part.id, c: run.map(Math.round) }); run = null; } };
        for (let s = 0; s < k; s++) {
          const ax = x1 + ((x2 - x1) * s) / k, ay = y1 + ((y2 - y1) * s) / k, bx = x1 + ((x2 - x1) * (s + 1)) / k, by = y1 + ((y2 - y1) * (s + 1)) / k, mx = (ax + bx) / 2, my = (ay + by) / 2;
          const q1 = { x: mx + nx * probe, y: my + ny * probe }, q2 = { x: mx - nx * probe, y: my - ny * probe };
          if (offMap(q1, bounds) || offMap(q2, bounds)) { close(); continue; }
          const h1 = field.heightAt(q1), h2 = field.heightAt(q2);
          const cliff = Math.abs(h1 - h2) >= gap && Math.max(h1, h2) === part.height && !field.rampAt({ x: mx, y: my }) && !openAt(part, { x: mx, y: my });
          if (!cliff) { close(); continue; }
          if (run) { run[2] = bx; run[3] = by; } else run = [ax, ay, bx, by];
        }
        close();
      }
    }
  }
  return out;
}

/** Where each raised part shows a cliff (pure): along its outline, sampled every `step` px, only where the ground just outside
 *  is lower by `gap` or more (and no ramp meets it, and the map goes on); where it meets ground as high, a ramp or the map's
 *  edge, nothing. Returns [{ of, height, closed, points: [{ x, y, nx, ny (outward), s (along the outline), drop }] }]: a run
 *  per stretch of cliff (`closed` when it goes the whole way round), each point owned by the part as cliffEdges's edges are.
 *  `want` 'slope': the stretches where the ground drops but the edge is open instead (painted open along the rim), the
 *  slopes a raised part runs down on those sides. */
export function cliffRuns({ field, gap = 2.5, probe = 4, step = 4, bounds = null, want = 'cliff', climbs = false }) {
  // (`climbs`: a ladder or a rope goes up the face, so the face is drawn whole behind it; only its walls open there. Roi, of
  // a ladder cut through a cliff: "why the hell ladder breaks the cliff?")
  const climb = (hit) => climbs && (hit?.ramp?.kind === 'ladder' || hit?.ramp?.kind === 'rope');
  const crossing = (q) => { const hit = field.rampAt(q); return !!hit && !climb(hit); };
  const heightAt = (q) => (climb(field.rampAt(q)) ? field.groundAt(q) : field.heightAt(q));
  const out = [];
  for (const part of field.parts) {
    const loops = []; for (const a of part.areas ?? []) { loops.push(a); for (const h of a.holes ?? []) loops.push(h); }
    for (const pts of loops) {
      const n = pts.length / 2; if (n < 3) continue;
      const samples = []; let along = 0;
      for (let i = 0; i < n; i++) {
        const x1 = pts[i * 2], y1 = pts[i * 2 + 1], x2 = pts[((i + 1) % n) * 2], y2 = pts[((i + 1) % n) * 2 + 1], len = Math.hypot(x2 - x1, y2 - y1);
        if (!(len > 0)) continue;
        for (let t = (step - (along % step)) % step; t < len; t += step) samples.push({ x: x1 + ((x2 - x1) * t) / len, y: y1 + ((y2 - y1) * t) / len, s: along + t });
        along += len;
      }
      const m = samples.length; if (m < 3) continue;
      for (let i = 0; i < m; i++) {
        const a = samples[(i - 1 + m) % m], b = samples[(i + 1) % m], p = samples[i], dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        let nx = dy / len, ny = -dx / len;
        // (Outward: off the part. A hole's outward is into the hole.)
        if (inAreas({ x: p.x + nx * 2, y: p.y + ny * 2 }, part.areas)) { nx = -nx; ny = -ny; }
        p.nx = nx; p.ny = ny;
        const qo = { x: p.x + nx * probe, y: p.y + ny * probe }, qi = { x: p.x - nx * probe, y: p.y - ny * probe };
        const hi = heightAt(qi), ho = offMap(qo, bounds) ? hi : heightAt(qo);
        p.drop = hi - ho;
        const drops = p.drop >= gap && hi === part.height && !crossing(p) && !crossing(qo);
        p.cliff = drops && (want === 'slope' ? openAt(part, p) : !openAt(part, p));
      }
      if (samples.every((p) => p.cliff)) { out.push({ of: part.id, height: part.height, closed: true, points: samples.map(({ cliff, ...p }) => p) }); continue; }
      const startAt = samples.findIndex((p) => !p.cliff);
      let run = null;
      for (let k = 1; k <= m; k++) {
        const p = samples[(startAt + k) % m];
        if (p.cliff) { const { cliff, ...q } = p; (run ??= []).push(q); }
        else if (run) { if (run.length >= 2) out.push({ of: part.id, height: part.height, closed: false, points: run }); run = null; }
      }
      if (run?.length >= 2) out.push({ of: part.id, height: part.height, closed: false, points: run });
    }
  }
  return out;
}

/** Which way and how far a raised part's shadow reaches on the map: away from the sun ({ angle: where it shines from, in
 *  degrees, height: how high, in degrees }), longer the higher the part and the lower the sun, never past `most` pixels.
 *  `pxPerUnit`: the map's pixels for one of the scene's units. Null with no sun. */
export function shadowOffset({ height, sun, pxPerUnit, most = Infinity }) {
  if (!sun || !(height > 0) || !(pxPerUnit > 0)) return null;
  const len = Math.min(most, sunReach(height * pxPerUnit, Number(sun.height) || 45)), turn = (((Number(sun.angle) || 0) + 180) * Math.PI) / 180;
  return len > 0 ? { x: Math.cos(turn) * len, y: Math.sin(turn) * len } : null;
}

/** The bar's line while hovering on Heights. `mode` 'raise' or 'ramp'; `units` the scene's. */
export function heightsHoverLine({ field, at, mode = 'raise', units = 'ft' }) {
  const fmt = (v) => `${half(v)} ${units}`;
  const hit = field.rampAt(at);
  if (hit) { const [lo, hi] = field.rampEnds(hit.ramp); return `Over: ${hit.ramp.kind ?? 'ramp'} ${fmt(lo)} → ${fmt(hi)} · here ${fmt(lo + (hi - lo) * hit.t)} · Shift-click removes it`; }
  const part = field.partAt(at);
  if (mode === 'ramp') return part ? `Over: raised ${fmt(part.height)} · drag from lower ground up across its edge for a ramp` : 'Over: the floor · drag up across a raised edge to make a ramp';
  return part ? `Over: raised ${fmt(part.height)} · a stroke grows it, the wheel raises or lowers it, Shift-drag rubs it out, Alt-drag along its edge opens it` : 'Over: the floor · drag to raise it a step · Alt-drag along a raised edge opens it';
}

/** What a crossing's ends and a raised part's open edges become when its region is dragged `dx`, `dy` px (pure): moved with
 *  it, as the flag changes to write in the same update ({} when it holds neither). (Roi, dragging a bridge's region: the bridge
 *  stayed where it was.) */
export function carryHeights(own, dx, dy) {
  const out = {}; if (!(dx || dy)) return out;
  const r = own?.ramp;
  if (r && typeof r === 'object' && ['ax', 'ay', 'bx', 'by'].every((k) => Number.isFinite(Number(r[k])))) out.ramp = { ...r, ax: Number(r.ax) + dx, ay: Number(r.ay) + dy, bx: Number(r.bx) + dx, by: Number(r.by) + dy };
  if (Array.isArray(own?.openEdges) && own.openEdges.length) out.openEdges = readOpenEdges(own).map((c) => [c.x + dx, c.y + dy, c.r]);
  return out;
}

/** What a crossing and a raised part's open edges become when its region is reshaped from box `a` to box `b` ({x, y, w, h})
 *  (pure): stretched with it, so a bridge made longer or wider in its region grows to fill it; a plain drag only moves them.
 *  The flag changes to write ({} when it holds neither or nothing changed). (Roi, enlarging a bridge's region: "doesnt
 *  increase the bridge size?") */
export function refitHeights(own, a, b) {
  if (!a || !b || !(a.w > 0) || !(a.h > 0)) return {};
  const sx = b.w / a.w, sy = b.h / a.h, X = (x) => b.x + (x - a.x) * sx, Y = (y) => b.y + (y - a.y) * sy;
  if (Math.abs(sx - 1) < 1e-3 && Math.abs(sy - 1) < 1e-3) return carryHeights(own, Math.round(b.x - a.x), Math.round(b.y - a.y));
  const out = {}, r = own?.ramp;
  if (r && typeof r === 'object' && ['ax', 'ay', 'bx', 'by'].every((k) => Number.isFinite(Number(r[k])))) {
    const ax = Number(r.ax), ay = Number(r.ay), bx = Number(r.bx), by = Number(r.by), len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
    const across = Math.hypot(sx * uy, sy * ux), w = Number(r.w);
    out.ramp = { ...r, ax: Math.round(X(ax)), ay: Math.round(Y(ay)), bx: Math.round(X(bx)), by: Math.round(Y(by)), ...(Number.isFinite(w) ? { w: Math.round(w * across) } : {}) };
  }
  if (Array.isArray(own?.openEdges) && own.openEdges.length) out.openEdges = readOpenEdges(own).map((c) => [Math.round(X(c.x)), Math.round(Y(c.y)), Math.round(c.r * Math.sqrt(sx * sy))]);
  return out;
}
