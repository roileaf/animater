// What sets a door breaking: an area's damage over its middle, a mover forced (or charging) through it, a Force
// Open roll (force-open.mjs judges it), the GM's smash. Pure: no Foundry globals. Each picks only walls that are breakable, intact and on the
// cause's own level; the GM checks each again (wall-break-requests.mjs).
import { wallTraits, canBreakWall, wallMid, crossesWall } from "./wall-break.mjs";
import { onLevel, missFrame, missBetter, propNextToMiss } from "./prop-pick.mjs";

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

// A missed swing (melee) and the windows beside its target: attacker {x, y} centre, target {x, y, w, h} footprint.
// A window counts by its middle: inside the target's footprint grown by a square, not on the target, and past the
// target's near side (prop-pick missFrame: never on the attacker's side). The GM checks the same (windowBesideMiss).
// A window the swing goes through also counts: one the line from the attacker to the target's middle crosses, between
// them (a sword swung through the glass at a creature behind it).
const targetMid = (t) => ({ x: t.x + t.w / 2, y: t.y + t.h / 2 });
const inSwing = (wall, attacker, target) => crossesWall(attacker, targetMid(target), wall);
export function windowBesideMiss(wall, attacker, target, grid = 100) {
  if (!finite(attacker) || ![target?.x, target?.y, target?.w, target?.h].every(Number.isFinite) || !Array.isArray(wall?.c)) return false;
  if (inSwing(wall, attacker, target)) return true;
  const frame = missFrame(attacker, target, grid), mid = wallMid(wall);
  return frame.inRing(mid) && !frame.onTarget(mid) && !!frame.score(mid);
}
// The intact breakable window beside a missed target nearest the swing's line, that the weapon's damage breaks, on the
// given levels: {wall, score}, or null.
export function windowNextToMiss({ attacker, target }, walls, scene, grid, damageType, levels) {
  if (!finite(attacker) || ![target?.x, target?.y, target?.w, target?.h].every(Number.isFinite)) return null;
  const frame = missFrame(attacker, target, grid);
  let best = null, through = null;
  for (const w of walls ?? []) {
    if (!reachable(w, scene, levels)) continue;
    const traits = wallTraits(w, scene);
    if (traits.kind !== "window" || !canBreakWall(traits, { damageType })) continue;
    const mid = wallMid(w);
    // A window the swing goes through is hit before anything beside the target: the nearest to the attacker.
    if (inSwing(w, attacker, target)) {
      const d = Math.hypot(mid.x - attacker.x, mid.y - attacker.y);
      if (!through || d < through.d) through = { wall: w, d };
      continue;
    }
    if (!frame.inRing(mid) || frame.onTarget(mid)) continue;
    const score = frame.score(mid);
    if (score && missBetter(score, best?.score)) best = { wall: w, score };
  }
  // Scored as on the line at the target, so it also beats any prop beside the target (nextToMiss).
  return through ? { wall: through.wall, score: { across: 0, toTarget: 0 } } : best;
}
// What a missed swing hits: the prop (propNextToMiss) or window (windowNextToMiss) beside the target nearest its line, a
// prop on a tie. tiles and walls on the target's level already, or levels to pick them by. {type: "tile", tile},
// {type: "wall", wall} or null.
export function nextToMiss({ attacker, target }, { tiles = [], walls = [], scene, levels } = {}, grid = 100, damageType) {
  const tile = propNextToMiss({ attacker, target }, (tiles ?? []).filter((t) => onLevel(t.levels, levels)), grid, damageType);
  const win = windowNextToMiss({ attacker, target }, walls, scene, grid, damageType, levels);
  if (!tile) return win ? { type: "wall", wall: win.wall } : null;
  const tileScore = missFrame(attacker, target, grid).score({ x: tile.x + tile.width / 2, y: tile.y + tile.height / 2 });
  return win && missBetter(win.score, tileScore) ? { type: "wall", wall: win.wall } : { type: "tile", tile };
}

// A Force Open roll, whatever its outcome (the GM compares it with the door's DC): one rolled from a door carries
// flags.animater.forceOpen {wallId, dc, tokenId?} in any system; one from a PF2e or SF2e sheet has the action's roll
// option. Null otherwise, or when no token is named. wallId is null for a sheet roll (the closest door is meant).
export function forceOpenOf(message) {
  const flag = message?.flags?.animater?.forceOpen;
  const wallId = flag && typeof flag === "object" && typeof flag.wallId === "string" && flag.wallId ? flag.wallId.slice(0, 64) : null;
  const ctx = message?.flags?.pf2e?.context ?? message?.flags?.sf2e?.context, options = ctx?.options;
  const action = Array.isArray(options) && options.includes("action:force-open");
  if (!wallId && !action) return null;
  const named = wallId && typeof flag.tokenId === "string" && flag.tokenId ? flag.tokenId.slice(0, 64) : null;
  const tokenId = named ?? message.speaker?.token;
  if (typeof tokenId !== "string" || !tokenId) return null;
  const sceneId = typeof message.speaker?.scene === "string" ? message.speaker.scene : null;
  return { wallId, tokenId, sceneId, authorId: (message.author ?? message.user)?.id ?? null, outcome: typeof ctx?.outcome === "string" ? ctx.outcome : null };
}

// Where a smash comes from: the GM's one controlled token's centre (footprint {x, y, w, h}), else half a square off the
// door's left-hand side (seen walking from its first end to its second).
export function smashFrom(wall, token, grid = 100) {
  if ([token?.x, token?.y, token?.w, token?.h].every(Number.isFinite)) return { x: token.x + token.w / 2, y: token.y + token.h / 2 };
  const [x1, y1, x2, y2] = wall.c, mid = wallMid(wall), len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (y2 - y1) / len, ny = -(x2 - x1) / len;
  return { x: mid.x + nx * grid / 2, y: mid.y + ny * grid / 2 };
}
