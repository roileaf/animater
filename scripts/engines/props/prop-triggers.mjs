// What sets a prop breaking: an area's spell rolling its damage, a missed melee strike, a forced path. Pure.
import { arrivalOf } from "../playback/flight-path.mjs";
import { normalizeDamageType } from "../playback/damage-moments.mjs";
import { motionPose, pathSpan } from "../motion/motion.mjs";
import { motionPhases } from "../motion/motion-path.mjs";
import { propsUnderTravel } from "./prop-pick.mjs";
import { slamPlausible } from "./prop-requests.mjs";
import { AREA_TTL_MS } from "./prop-areas.mjs";

const FLIGHTS = new Set(["travel", "projectile"]);

// Placed areas waiting for their spell's damage roll: the same item and caster, the newest still on the scene.
// played: when the area's own recipe lands (now() clock); claim: each prop is asked for once per area.
// An area still on the scene is kept for ttl (10 minutes); a damage roll that only an expired area would have matched
// is reported through trace(message), so a late roll breaking nothing leaves a reason.
export { AREA_TTL_MS };
export function createAreaWaits({ now = () => Date.now(), ttl = AREA_TTL_MS, trace = () => {} } = {}) {
  const areas = new Map(), expired = [];
  const drop = () => {
    for (const [id, a] of areas) if (now() - a.rememberedAt > ttl) {
      areas.delete(id);
      expired.push({ templateId: id, itemUuid: a.itemUuid, actorUuid: a.actorUuid });
      if (expired.length > 20) expired.shift();
    }
  };
  return {
    remember(area) {
      if (!area?.templateId) return;
      drop();
      areas.delete(area.templateId);
      // an area remembered after a reload (rememberedAt: when it was placed) keeps that time, never later than now
      const at = Number.isFinite(area.rememberedAt) ? Math.min(area.rememberedAt, now()) : now();
      areas.set(area.templateId, { ...area, rememberedAt: at, impactAt: null, claimed: new Set() });
    },
    matchDamage({ itemUuid, actorUuid } = {}) {
      drop();
      if (!itemUuid || !actorUuid) return null;
      let best = null;
      for (const a of areas.values()) if (a.itemUuid === itemUuid && a.actorUuid === actorUuid && (!best || a.rememberedAt >= best.rememberedAt)) best = a;
      const late = !best && expired.findLast((e) => e.itemUuid === itemUuid && e.actorUuid === actorUuid);
      if (late) { try { trace(`area ${late.templateId} expired before its damage roll: nothing breaks`); } catch { /* only a report */ } }
      return best;
    },
    forget(templateId) { areas.delete(templateId); const i = expired.findIndex((e) => e.templateId === templateId); if (i >= 0) expired.splice(i, 1); },
    // The GM's own record of one area by its id (authorId: who placed it; rememberedAt: when), or null.
    get(templateId) { return areas.get(templateId) ?? null; },
    size() { return areas.size; },
    played(templateId, at) { const a = areas.get(templateId); if (a && Number.isFinite(at)) a.impactAt = at; },
    delayFor(area) { return Number.isFinite(area?.impactAt) ? Math.max(0, area.impactAt - now()) : 0; },
    claim(templateId, tileId) {
      const a = areas.get(templateId);
      if (!a || a.claimed.has(tileId)) return false;
      a.claimed.add(tileId);
      return true;
    },
    // A claim given back (askClaimed: the GM refused it or never wrote it), so the area's next trigger asks again.
    release(templateId, tileId) { areas.get(templateId)?.claimed.delete(tileId); },
  };
}

// A claimed thing asked of the GM, its claim held only while the request is out: released at once when it could not be
// sent (ask() false or throwing: no GM, this screen's own check refused it), else after wait ms unless written() (the
// GM wrote the break). A refusal from the GM is its silence (the relay only answers with the write), so an animation's
// refused ask leaves the thing to the damage roll's. Resolves whether it was written.
export async function askClaimed({ ask, written, release, later = (fn, ms) => setTimeout(fn, ms), wait = 3500 }) {
  let sent = false;
  try { sent = (await ask()) === true; } catch { sent = false; }
  if (!sent) { release(); return false; }
  return new Promise((resolve) => later(() => {
    let done = false;
    try { done = written() === true; } catch { done = false; }
    if (!done) release();
    resolve(done);
  }, wait));
}

// ms into a play when its area lands: the first area or impact stage, else the first flight's arrival, else 0.
export function impactDelay(plan) {
  const stages = Array.isArray(plan) ? plan : [];
  const at = (s) => (s.delay ?? 0) + (FLIGHTS.has(s.kind) ? arrivalOf(s) : 0);
  const lands = stages.filter((s) => s.kind === "template" || s.kind === "impact");
  const pick = lands.length ? lands : stages.filter((s) => FLIGHTS.has(s.kind));
  return pick.length ? Math.max(0, Math.min(...pick.map(at))) : 0;
}

// A strike's degree of success as the miss rule reads it.
export function missOutcome(outcome) {
  if (outcome === "criticalFailure") return "criticalFailure";
  return outcome === "failure" ? "miss" : null;
}

const first = (v) => (v instanceof Set ? [...v][0] : Array.isArray(v) ? v[0] : undefined);
// A weapon's main damage type, from the item (a miss has no damage roll): PF2e weapons and NPC attacks, D&D 5e.
export function weaponDamageType(item) {
  const sys = item?.system ?? {};
  const type = sys.damage?.damageType ?? Object.values(sys.damageRolls ?? {})[0]?.damageType
    ?? first(sys.damage?.base?.types) ?? sys.damage?.parts?.[0]?.[1];
  return type ? normalizeDamageType(type) : null;
}

// The item and the actor owning it, read from a uuid (an activity's, an item's or a token actor's item).
export function uuidOwners(uuid) {
  const s = typeof uuid === "string" ? uuid : "";
  return { itemUuid: s.match(/^(.*?Item\.[^.]+)/)?.[1] ?? null, actorUuid: s.match(/^(.*?Actor\.[^.]+)/)?.[1] ?? null };
}

// A forced path's wall test: each crossing names the walls it meets; it blocks unless every one is the own wall
// of a breakable prop on the path (that prop breaks and its walls open). A crossing naming no wall blocks.
export function ownWallsBeforeCollision(crossings, ignored) {
  return (crossings ?? []).some((ids) => !ids?.length || ids.some((id) => !ignored?.has(id)));
}

// The walls each crossing of a move collision report meets (its vertices' edges). A v14 wall edge is built by the
// WallDocument (id "wall.<id>", object the document); an older one by the Wall placeable. Other edges keep their id.
const wallIdOf = (e) => {
  const o = e?.object;
  if (o?.documentName === "Wall" && o.id) return o.id;
  if (o?.document?.id) return o.document.id;
  return typeof e?.id === "string" ? e.id.replace(/^wall\./, "") : null;
};
export function crossedWalls(crossings) {
  return Array.from(crossings ?? [], (v) => Array.from(v?.edges ?? [], wallIdOf).filter(Boolean));
}

// When a play's travel moves its mover: from the first to the last end of its moving motions (finisher-play travelEnd).
export function travelSpan(plan) {
  const moving = (Array.isArray(plan) ? plan : []).filter((s) => s.kind === "motion" && (s.motionOffset || s.motionFrame));
  if (!moving.length) return { start: 0, end: 0 };
  return { start: Math.min(...moving.map((s) => s.delay ?? 0)), end: Math.max(...moving.map((s) => (s.delay ?? 0) + (s.duration ?? 0))) };
}

// When a mover travelling from → to (centres) over {start, end} (ms) reaches each tile: its share along the line, nearest first.
export function slamTimes(from, to, tiles, { start = 0, end = 0 } = {}) {
  const dx = to.x - from.x, dy = to.y - from.y, l2 = dx * dx + dy * dy, t0 = Math.max(0, start || 0), ms = Math.max(0, (end || 0) - t0);
  return (tiles ?? []).map((tile) => {
    const cx = tile.x + tile.width / 2, cy = tile.y + tile.height / 2;
    const u = l2 ? Math.max(0, Math.min(1, ((cx - from.x) * dx + (cy - from.y) * dy) / l2)) : 0;
    return { tile, ms: Math.round(t0 + u * ms) };
  }).sort((a, b) => a.ms - b.ms);
}

// Cosmetic motions that carry the token along the ground (a leap flies over; the rest play in place).
export const GROUND_MOTIONS = new Set(["rush", "roll", "dodge", "lunge", "path"]);
const PATH_STEPS = 24;
// Where a ground motion carries its token's centre out from rest: [{x, y, p}] (p: share of the stage), [] for any other.
// A finisher's travel (motionOffset / motionFrame) really moves the token: its forced path (slamAlong) asks for those.
export function groundTravel(stage, centre, direction, grid = 100) {
  if (!GROUND_MOTIONS.has(stage?.motion) || stage.motionOffset || stage.motionFrame || !Number.isFinite(centre?.x) || !Number.isFinite(centre?.y)) return [];
  const at = (p) => { const o = motionPose(stage, p, direction, grid); return { x: centre.x + o.x, y: centre.y + o.y, p }; };
  if (stage.motion === "path") { const end = pathSpan(stage); return Array.from({ length: PATH_STEPS + 1 }, (_, i) => at((end * i) / PATH_STEPS)); }
  // a lunge peaks halfway; the others are out by their arrival
  return [{ x: centre.x, y: centre.y, p: 0 }, at(stage.motion === "lunge" ? 0.5 : motionPhases(stage).arrival)];
}
// The props that travel smashes (mover of size squares, standing at its first point): each with its share of the stage
// and the path the GM checks, rest to the furthest point, or to where it crosses the prop when that line misses it.
// Only those the GM will accept on that path are asked for, so the two never disagree.
export function groundSlams(points, size, tiles, grid = 100) {
  if (points.length < 2) return [];
  const from = { x: points[0].x, y: points[0].y }, mover = { ...from, size };
  const far = points.reduce((f, q) => (Math.hypot(q.x - from.x, q.y - from.y) > Math.hypot(f.x - from.x, f.y - from.y) ? q : f), points[0]);
  const to = { x: far.x, y: far.y };
  return propsUnderTravel(points, size, tiles, grid)
    .map(({ t, p, at }) => ({ tile: t, p, path: { from, to: slamPlausible(t, { from, to }, mover, grid) ? to : at } }))
    .filter(({ tile, path }) => slamPlausible(tile, path, mover, grid));
}
