// Breakable walls: where a breach opens in a plain wall, the split the GM writes for it, and the Repair that puts the
// wall back. Pure: no Foundry globals. A breach is a gap in the wall's segment: the original wall becomes the part before
// the gap (part A, carrying the note with everything Repair needs) and a copy of it is made for the part after (part B).
import { wallTraits, readWallNote, wallRestoreUpdate } from "./wall-break.mjs";
import { onLevel } from "./prop-pick.mjs";

export const BREACH_SQUARES = 1, BLAST_BREACH_SQUARES = 2; // the gap's length
const WHOLE_BELOW = 1.5; // squares: a shorter segment opens whole
const SLIVER = 0.25; // squares: a piece shorter than this left at an end opens with the gap
const PICK_REACH = 0.5; // squares: the GM's click picks a wall this close
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const segment = (c) => Array.isArray(c) && c.length === 4 && c.every(Number.isFinite);
const intact = (w) => !w?.flags?.animater?.breakWall?.broken;

// The point of the wall segment c nearest p: {x, y, along (px from its first end), len}.
export function projectOnWall(c, p) {
  const [x1, y1, x2, y2] = c, dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
  if (!len) return { x: x1, y: y1, along: 0, len: 0 };
  const along = Math.max(0, Math.min(len, ((p.x - x1) * dx + (p.y - y1) * dy) / len));
  return { x: x1 + (dx * along) / len, y: y1 + (dy * along) / len, along, len };
}

// Where the line a-b crosses the wall segment c, or null when it does not (touching an end does not count).
export function crossingPoint(a, b, c) {
  const [x1, y1, x2, y2] = c, rx = b.x - a.x, ry = b.y - a.y, sx = x2 - x1, sy = y2 - y1, den = rx * sy - ry * sx;
  if (!den) return null;
  const u = ((x1 - a.x) * sy - (y1 - a.y) * sx) / den, v = ((x1 - a.x) * ry - (y1 - a.y) * rx) / den;
  if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return null;
  return { x: a.x + rx * u, y: a.y + ry * u };
}

// The gap a breach of `squares` opens at the hit point (projected onto the segment, the gap clamped inside it) and the
// wall pieces left either side ([] when the whole segment opens: it is shorter than 1.5 squares, or than the gap).
// Coordinates are whole numbers, as Foundry keeps a wall's.
export function breachSplit(c, hit, { grid = 100, squares = BREACH_SQUARES } = {}) {
  const [x1, y1, x2, y2] = c, p = projectOnWall(c, finite(hit) ? hit : { x: (x1 + x2) / 2, y: (y1 + y2) / 2 }), L = p.len, g = squares * grid;
  if (L < WHOLE_BELOW * grid || g >= L) return { gap: [...c], parts: [] };
  const mid = Math.max(g / 2, Math.min(L - g / 2, p.along));
  let t0 = mid - g / 2, t1 = mid + g / 2;
  if (t0 < SLIVER * grid) t0 = 0;
  if (L - t1 < SLIVER * grid) t1 = L;
  const at = (t) => [Math.round(x1 + ((x2 - x1) * t) / L), Math.round(y1 + ((y2 - y1) * t) / L)];
  const a = at(t0), b = at(t1), parts = [];
  if (t0 > 0) parts.push([x1, y1, ...a]);
  if (t1 < L) parts.push([...b, x2, y2]);
  return { gap: [...a, ...b], parts };
}

// The write that breaches part A (the original wall): its first piece's c (or, with no piece left, its passage open),
// and the note with what the wall was (restore: c and its restrictions) and the part B made for the second piece.
export function wallBreachUpdate(wall, note, split, partId = null) {
  const restore = { c: [...wall.c], move: wall.move, sight: wall.sight, light: wall.light, sound: wall.sound };
  const broken = { ...note, partId: split.parts.length > 1 && typeof partId === "string" ? partId : null, restore };
  const open = split.parts.length ? { c: [...split.parts[0]] } : { move: 0, sight: 0, light: 0, sound: 0 };
  return { _id: wall.id, ...open, "flags.animater.breakWall.broken": broken };
}

// Part B's creation data: a copy of the original wall (source: its toObject()) on the second piece, keeping its fields
// and flags but not its note, naming the wall it was split from (breachOf).
export function breachPartData(source, c, ofId) {
  const data = structuredClone(source ?? {});
  delete data._id; delete data._stats;
  data.c = [...c];
  data.flags ??= {}; data.flags.animater ??= {};
  const { broken, hp, hits, ...own } = data.flags.animater.breakWall ?? {};
  data.flags.animater.breakWall = { ...own, breachOf: ofId };
  return data;
}

// The wall a part B was split from, or null.
export function breachPartOf(wall) {
  const id = wall?.flags?.animater?.breakWall?.breachOf;
  return typeof id === "string" && id ? id : null;
}

// Repair: every broken wall back as it was (wallRestoreUpdate), and every part B a breach made deleted (those still
// there). A wall being deleted is not also updated.
export function wallRepairPlan(walls) {
  const ids = new Set((walls ?? []).map((w) => w?.id)), deletes = [];
  for (const w of walls ?? []) {
    const part = readWallNote(w?.flags?.animater?.breakWall?.broken)?.partId;
    if (typeof part === "string" && ids.has(part) && !deletes.includes(part)) deletes.push(part);
  }
  const updates = (walls ?? []).filter((w) => !deletes.includes(w?.id)).map(wallRestoreUpdate).filter(Boolean);
  return { updates, deletes };
}

// The GM tool's pick: the nearest intact breakable plain wall within half a square of the click p, on the levels (a tie
// goes to the first). A click in a breach's own gap picks nothing.
export function breachWallAt(p, walls, scene, grid = 100, levels) {
  if (!finite(p)) return null;
  const reach = PICK_REACH * grid, dist = (c) => { const q = projectOnWall(c, p); return Math.hypot(q.x - p.x, q.y - p.y); };
  for (const w of walls ?? []) {
    const gap = readWallNote(w?.flags?.animater?.breakWall?.broken)?.gap;
    if (gap && onLevel(w.levels, levels) && dist(gap) < reach) return null;
  }
  let best = null, bestD = reach;
  for (const w of walls ?? []) {
    if (!segment(w?.c) || !intact(w) || !onLevel(w.levels, levels) || wallTraits(w, scene).kind !== "wall") continue;
    const d = dist(w.c);
    if (d < bestD || (d === bestD && !best)) { best = w; bestD = d; }
  }
  return best;
}

// The centre of a placed area's shape, where it breaches a wall (projected onto it): a circle's, ellipse's, ring's or
// emanation's own point; a rectangle's middle (anchored and turned about its x, y); a polygon's vertex mean; a line's
// half-way point; a cone's centroid (along its axis, 4r sin(a/2) / 3a out). Angles in degrees, Foundry's (0 east,
// clockwise). Null for a shape it cannot place (a token or grid shape).
export function areaShapeCentre(s) {
  const fin = (...v) => v.every(Number.isFinite), rad = (d) => ((Number(d) || 0) * Math.PI) / 180;
  if (!s || typeof s !== "object") return null;
  if (["circle", "ellipse", "ring", "emanation"].includes(s.type) && fin(s.x, s.y)) return { x: s.x, y: s.y };
  if (s.type === "rectangle" && fin(s.x, s.y, s.width, s.height)) {
    const u = (0.5 - (Number(s.anchorX) || 0)) * s.width, v = (0.5 - (Number(s.anchorY) || 0)) * s.height, r = rad(s.rotation);
    return { x: s.x + u * Math.cos(r) - v * Math.sin(r), y: s.y + u * Math.sin(r) + v * Math.cos(r) };
  }
  if (s.type === "polygon" && s.points?.length >= 2) {
    const pts = Array.from(s.points), n = Math.floor(pts.length / 2);
    let x = 0, y = 0;
    for (let i = 0; i < n; i++) { x += pts[2 * i]; y += pts[2 * i + 1]; }
    return n ? { x: x / n, y: y / n } : null;
  }
  if (s.type === "line" && fin(s.x, s.y, s.length)) { const r = rad(s.rotation); return { x: s.x + (Math.cos(r) * s.length) / 2, y: s.y + (Math.sin(r) * s.length) / 2 }; }
  if (s.type === "cone" && fin(s.x, s.y, s.radius)) {
    const a = Math.max(1e-6, rad(s.angle)), r = rad(s.rotation), d = (4 * s.radius * Math.sin(a / 2)) / (3 * a);
    return { x: s.x + Math.cos(r) * d, y: s.y + Math.sin(r) * d };
  }
  return null;
}

// An old MeasuredTemplate as a shape areaShapeCentre reads (t: circle, cone, ray or rect; distance in scene units, px
// per unit given; direction and angle in degrees). A rect template's distance is its diagonal along direction.
export function templateShape(t, pxPerUnit = 20) {
  if (!t || ![t.x, t.y].every(Number.isFinite)) return null;
  const len = (Number(t.distance) || 0) * pxPerUnit;
  if (t.t === "cone") return { type: "cone", x: t.x, y: t.y, radius: len, angle: Number(t.angle) || 53.13, rotation: Number(t.direction) || 0 };
  if (t.t === "ray") return { type: "line", x: t.x, y: t.y, length: len, width: (Number(t.width) || 0) * pxPerUnit, rotation: Number(t.direction) || 0 };
  if (t.t === "rect") { const r = ((Number(t.direction) || 0) * Math.PI) / 180; return { type: "circle", x: t.x + (Math.cos(r) * len) / 2, y: t.y + (Math.sin(r) * len) / 2 }; }
  return { type: "circle", x: t.x, y: t.y, radius: len };
}
