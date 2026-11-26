// A cold spell freezing open water. The part of a still pond a cold area covers becomes a sheet of thin ice: a region
// of its own, laid over the pond, the shape of the spell where it crosses the water and of the bank where it meets
// the land. The pond under it is never changed, so the rest of it is the water it always was, and taking the sheet
// away again (Repair) is deleting one region. The sheet is ordinary thin ice (thin-ice.mjs): it holds, cracks and
// breaks under weight, fire melts it and cold mends it. Pure: shapes only; the caller asks Foundry and writes.

import { SPELL_ICE } from "./thin-ice.mjs";

const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const asked = (test, p) => { try { return test(p) === true; } catch { return false; } };

/**
 * The edge of a spell's area, as a ring of points round it: [{ x, y }], or [] when it has no inside to find. `bounds`
 * is the box round the area ({ x, y, w, h }, pixels) and `testPoint({ x, y })` whether a place is in it. Found by
 * looking outward from a place inside, in `steps` directions, for how far the area goes: exact for any area with no
 * dents in it, which a burst, a cone, a line and an emanation all are. `seeds` are other places to start from when
 * the middle of the box is not inside (a cone's box holds more than the cone).
 */
export function areaOutline({ bounds, testPoint = () => false, seeds = [], steps = 48 } = {}) {
  if (!bounds || ![bounds.x, bounds.y, bounds.w, bounds.h].every(Number.isFinite) || !(bounds.w > 0) || !(bounds.h > 0)) return [];
  const mid = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
  const from = [mid, ...(seeds ?? []).filter(finite)].find((p) => asked(testPoint, p));
  if (!from) return [];
  const far = Math.hypot(bounds.w, bounds.h), n = Math.max(8, Math.floor(steps)), ring = [];
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2, dx = Math.cos(angle), dy = Math.sin(angle);
    let near = 0, out = far;
    for (let k = 0; k < 16; k++) { const r = (near + out) / 2; if (asked(testPoint, { x: from.x + dx * r, y: from.y + dy * r })) near = r; else out = r; }
    ring.push({ x: from.x + dx * near, y: from.y + dy * near });
  }
  return ring;
}

// Twice a flat polygon's area, signed by which way round it goes.
const turnOf = (flat) => { let sum = 0; for (let i = 0, n = flat.length; i + 1 < n; i += 2) { const j = (i + 2) % n; sum += flat[i] * flat[j + 1] - flat[j] * flat[i + 1]; } return sum; };
/** A flat polygon's area ([x, y, x, y, ...]), in square pixels. */
export const flatArea = (flat) => (Array.isArray(flat) && flat.length >= 6 ? Math.abs(turnOf(flat)) / 2 : 0);

/**
 * A flat polygon cut down to what lies inside a ring with no dents ([{ x, y }], either way round): a flat polygon
 * again, [] when nothing of it is inside. Edge by edge of the ring, keeping what is on its inner side.
 */
export function clipToRing(flat, ring) {
  if (!Array.isArray(flat) || flat.length < 6 || !Array.isArray(ring) || ring.length < 3 || !ring.every(finite)) return [];
  const way = turnOf(ring.flatMap((p) => [p.x, p.y])) >= 0 ? 1 : -1;
  let pts = [];
  for (let i = 0; i + 1 < flat.length; i += 2) pts.push({ x: flat[i], y: flat[i + 1] });
  for (let e = 0; e < ring.length && pts.length; e++) {
    const a = ring[e], b = ring[(e + 1) % ring.length], side = (p) => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) * way, next = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], sp = side(p), sq = side(q);
      if (sp >= 0) next.push(p);
      if ((sp >= 0) !== (sq >= 0)) { const t = sp / (sp - sq); next.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t }); }
    }
    pts = next;
  }
  const out = [];
  for (const p of pts) { const x = Math.round(p.x * 10) / 10, y = Math.round(p.y * 10) / 10; if (out.length < 2 || out[out.length - 2] !== x || out[out.length - 1] !== y) out.push(x, y); }
  if (out.length >= 4 && out[0] === out[out.length - 2] && out[1] === out[out.length - 1]) out.length -= 2;
  return out.length >= 6 ? out : [];
}

/**
 * The sheet of ice a spell lays on a pond, as region shapes: [{ type: "polygon", points, hole }]. `areas` are the pond's
 * own (flat polygons, each with its islands on `holes`); `outline` the spell's edge (areaOutline). Each part of the
 * pond is cut down to the spell, and so is each island in it, which stays a hole in the ice. A part smaller than
 * `least` square pixels is no sheet at all: a spell that only licks the bank freezes nothing. [] when nothing freezes.
 */
export function icePatchShapes({ areas = [], outline = [], least = 0 } = {}) {
  const shapes = [];
  for (const area of areas ?? []) {
    const points = clipToRing(area, outline);
    if (!points.length || !(flatArea(points) > 0) || flatArea(points) < least) continue;
    shapes.push({ type: "polygon", points, hole: false });
    for (const hole of area?.holes ?? []) { const cut = clipToRing(hole, outline); if (cut.length && flatArea(cut) >= 1) shapes.push({ type: "polygon", points: cut, hole: true }); }
  }
  return shapes;
}

/**
 * The region to create for a sheet: thin ice that holds a Medium creature, painted as ice whatever the map under it
 * shows, marked as a spell's (SPELL_ICE) so Repair takes it away. It stands where its pond stands: the pond's levels,
 * its elevation, and the picture it is bound to when it is bound to one. null without shapes. `from` (where the spell
 * was cast from) and `area` (its area's id) are kept on it, so each screen can show the ice spreading from there for
 * as long as it sees the spell (iceGrown).
 */
export function icePatchData({ pond, shapes = [], from = null, area = null } = {}) {
  if (!Array.isArray(shapes) || !shapes.some((s) => s?.hole !== true)) return null;
  const own = pond?.flags?.animater ?? {};
  return {
    name: `${pond?.name ? `${pond.name} ` : ""}(frozen)`.trim(), color: "#bfe4f2", shapes,
    elevation: { bottom: pond?.elevation?.bottom ?? null, top: pond?.elevation?.top ?? null },
    levels: [...(pond?.levels ?? [])],
    flags: { animater: { floor: "water", iceThin: true, iceHolds: "med", texture: "on", [SPELL_ICE]: true, ...(own.imageRegion ? { imageRegion: own.imageRegion } : {}),
      ...(finite(from) ? { iceFrom: [Math.round(from.x), Math.round(from.y)] } : {}), ...(typeof area === "string" && area ? { iceArea: area } : {}) } },
  };
}

/** Whether a ring of points ([{ x, y }]) has no dents in it, which is what clipToRing asks of the ring it cuts to. */
export function ringHasNoDents(ring) {
  if (!Array.isArray(ring) || ring.length < 3 || !ring.every(finite)) return false;
  let way = 0;
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n], c = ring[(i + 2) % n], turn = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(turn) < 1e-6) continue;
    if (way && Math.sign(turn) !== way) return false;
    way = Math.sign(turn);
  }
  return way !== 0;
}

// How much of a sheet a fire must take for nothing worth keeping to be left of it.
const SHEET_GONE = 0.9;
/**
 * Fire on a spell's sheet of ice. The fire takes its own shape out of the sheet — a hole in the region, where the
 * pond under it shows again as the water it always was, with the fire's edge and not the grid's. `shapes` are the
 * sheet's own (region shapes), `outline` the fire's edge (areaOutline). Returns { shapes, gone }: the sheet's shapes
 * with the hole added, and whether so little is left that the sheet should be taken away whole. null when the fire
 * takes less than `least` square pixels of it.
 */
export function icePatchMelt({ shapes = [], outline = [], least = 0 } = {}) {
  const solids = (shapes ?? []).filter((s) => s?.type === "polygon" && s.hole !== true && Array.isArray(s.points));
  const cuts = solids.map((s) => clipToRing(s.points, outline)).filter((points) => points.length && flatArea(points) > 0 && flatArea(points) >= least);
  if (!cuts.length) return null;
  const whole = solids.reduce((sum, s) => sum + flatArea(s.points), 0), taken = cuts.reduce((sum, points) => sum + flatArea(points), 0);
  return { shapes: [...shapes, ...cuts.map((points) => ({ type: "polygon", points, hole: true }))], gone: taken >= whole * SHEET_GONE };
}

// Ice spreading. A sheet is written whole the moment the spell lands, and it is whole for everything that walks on it;
// but on each screen it is seen to spread out from where the spell came, for as long as the spell is still seen.
const GROW_START = 0.12, GROW_RING = 40;
/** How far a sheet's furthest corner is from a place: the reach it has grown to when it is whole. */
export function iceGrowFar(areas = [], from = null) {
  let far = 0;
  if (finite(from)) for (const flat of areas ?? []) for (let i = 0; i + 1 < (flat?.length ?? 0); i += 2) far = Math.max(far, Math.hypot(flat[i] - from.x, flat[i + 1] - from.y));
  return far;
}
/** How far it has spread, `k` (0-1) of the way through: quick at first, slowing as it nears its edge. */
export const iceGrowRadius = (far, k) => { const t = Math.min(1, Math.max(0, Number(k) || 0)); return (Number(far) || 0) * (GROW_START + (1 - GROW_START) * (1 - (1 - t) ** 2)); };
/**
 * A sheet's areas as far as it has spread: each cut down to a round reach of `radius` from `from`, its islands with it.
 * The areas as they are when there is nothing to cut to.
 */
export function iceGrown(areas = [], from = null, radius = 0) {
  if (!finite(from) || !(radius > 0)) return areas;
  const ring = Array.from({ length: GROW_RING }, (_, i) => { const a = (i / GROW_RING) * Math.PI * 2; return { x: from.x + Math.cos(a) * radius, y: from.y + Math.sin(a) * radius }; });
  const out = [];
  for (const area of areas ?? []) {
    const points = clipToRing(area, ring);
    if (!points.length) continue;
    points.holes = (area?.holes ?? []).map((hole) => clipToRing(hole, ring)).filter((hole) => hole.length);
    out.push(points);
  }
  return out;
}
