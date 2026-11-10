// What sets a door breaking: an area's damage over its middle, a mover forced (or charging) through it, a PF2e
// Force Open, the GM's smash. Pure: no Foundry globals. Each picks only walls that are breakable, intact and on the
// cause's own level; the GM checks each again (wall-break-requests.mjs).
import { wallTraits, canBreakWall, wallMid, crossesWall } from "./wall-break.mjs";
import { onLevel, segRectDist } from "./prop-pick.mjs";

const intact = (w) => !w?.flags?.animater?.breakWall?.broken;
const finite = (p) => Number.isFinite(p?.x) && Number.isFinite(p?.y);
const reachable = (w, scene, levels) => intact(w) && Array.isArray(w?.c) && onLevel(w.levels, levels) && wallTraits(w, scene).kind !== null;

// The intact breakable walls whose middle the area covers (testPoint) and whose material its damage breaks.
export function doorsInArea(walls, testPoint, scene, damageType, levels) {
  return (walls ?? []).filter((w) => reachable(w, scene, levels) && canBreakWall(wallTraits(w, scene), { damageType }) && testPoint(wallMid(w)) === true);
}

// How far along a-b (0..1) it meets the wall's line.
function shareAlong(a, b, wall) {
  const [x1, y1, x2, y2] = wall.c, rx = b.x - a.x, ry = b.y - a.y, sx = x2 - x1, sy = y2 - y1;
  const den = rx * sy - ry * sx;
  return den ? ((x1 - a.x) * sy - (y1 - a.y) * sx) / den : 0;
}

// The intact breakable walls a path (centres) crosses that a slam of size squares breaks, in path order.
export function wallsCrossed(path, size, walls, scene, levels) {
  const { from, to } = path ?? {};
  if (!finite(from) || !finite(to) || (from.x === to.x && from.y === to.y)) return [];
  const slam = { slam: { size } };
  return (walls ?? [])
    .filter((w) => reachable(w, scene, levels) && crossesWall(from, to, w) && canBreakWall(wallTraits(w, scene), slam))
    .map((w) => ({ w, u: shareAlong(from, to, w) }))
    .sort((p, q) => p.u - q.u)
    .map(({ w }) => w);
}

// A cosmetic ground motion's travel [{x, y, p}] (the mover at rest at its first point): each wall it runs through that a
// slam of size breaks, with its share of the stage and a path the GM accepts: from rest to the furthest point when
// that line goes through the wall, else to the first later point whose line from rest does. None when none does.
export function wallsUnderTravel(points, size, walls, scene, levels) {
  if (!Array.isArray(points) || points.length < 2 || !points.every(finite)) return [];
  const from = { x: points[0].x, y: points[0].y };
  const far = points.reduce((f, q) => (Math.hypot(q.x - from.x, q.y - from.y) > Math.hypot(f.x - from.x, f.y - from.y) ? q : f), points[0]);
  const hits = [];
  for (const w of walls ?? []) {
    if (!reachable(w, scene, levels) || !canBreakWall(wallTraits(w, scene), { slam: { size } })) continue;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      if (!crossesWall(a, b, w)) continue;
      const u = Math.max(0, Math.min(1, shareAlong(a, b, w))), pa = Number(a.p) || 0, pb = Number(b.p) || 0;
      const ends = [far, ...points.slice(i + 1)], to = ends.find((q) => crossesWall(from, q, w));
      if (to) hits.push({ wall: w, p: pa + u * (pb - pa), path: { from, to: { x: to.x, y: to.y } } });
      break;
    }
  }
  return hits.sort((p, q) => p.p - q.p);
}

// The first intact window the line a-b crosses, nearest a, on the given levels; null when none. A ranged miss that flies
// through glass breaks only that one. Any window counts here, whatever its material (the GM's glass rule is applied after).
export function windowOnLine(a, b, walls, scene, levels) {
  if (!finite(a) || !finite(b) || (a.x === b.x && a.y === b.y)) return null;
  let best = null, bestU = Infinity;
  for (const w of walls ?? []) {
    if (!reachable(w, scene, levels) || wallTraits(w, scene).kind !== "window" || !crossesWall(a, b, w)) continue;
    const u = shareAlong(a, b, w);
    if (u < bestU) { best = w; bestU = u; }
  }
  return best;
}

const FORCE_OPEN_OUTCOMES = ["success", "criticalSuccess"];
// A PF2e Force Open check that succeeded: PF2e's macro and its force-open action both add the roll option. Null otherwise.
export function forceOpenOf(message) {
  const ctx = message?.flags?.pf2e?.context, options = ctx?.options;
  if (!Array.isArray(options) || !options.includes("action:force-open") || !FORCE_OPEN_OUTCOMES.includes(ctx.outcome)) return null;
  const tokenId = message.speaker?.token;
  if (typeof tokenId !== "string" || !tokenId) return null;
  const sceneId = typeof message.speaker?.scene === "string" ? message.speaker.scene : null;
  return { outcome: ctx.outcome, tokenId, sceneId, authorId: (message.author ?? message.user)?.id ?? null };
}

// The door that Force Open breaks: the closest intact door, not open, that allows Force Open, within one square of the
// token's footprint {x, y, w, h, level} and on its level. A critical success breaks any material; a success only wood.
export function forceOpenDoor(token, walls, scene, grid = 100, outcome) {
  if (!FORCE_OPEN_OUTCOMES.includes(outcome) || ![token?.x, token?.y, token?.w, token?.h].every(Number.isFinite)) return null;
  const rect = { x: token.x, y: token.y, width: token.w, height: token.h };
  let best = null, bestD = Infinity;
  for (const w of walls ?? []) {
    if (!reachable(w, scene, token.level) || w.ds === 1) continue;
    const t = wallTraits(w, scene);
    if (t.kind !== "door" || !t.forceOpen || (outcome !== "criticalSuccess" && t.material !== "wood")) continue;
    const [x1, y1, x2, y2] = w.c, d = segRectDist({ x: x1, y: y1 }, { x: x2, y: y2 }, rect);
    if (d <= grid && d < bestD) { best = w; bestD = d; }
  }
  return best;
}

// Where a smash comes from: the GM's one controlled token's centre (footprint {x, y, w, h}), else half a square off the
// door's left-hand side (seen walking from its first end to its second).
export function smashFrom(wall, token, grid = 100) {
  if ([token?.x, token?.y, token?.w, token?.h].every(Number.isFinite)) return { x: token.x + token.w / 2, y: token.y + token.h / 2 };
  const [x1, y1, x2, y2] = wall.c, mid = wallMid(wall), len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (y2 - y1) / len, ny = -(x2 - x1) / len;
  return { x: mid.x + nx * grid / 2, y: mid.y + ny * grid / 2 };
}
