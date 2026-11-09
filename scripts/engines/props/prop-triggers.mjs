// What sets a prop breaking: an area's spell rolling its damage, a missed melee strike, a forced path. Pure.
import { arrivalOf } from "../playback/flight-path.mjs";
import { normalizeDamageType } from "../playback/damage-moments.mjs";

const FLIGHTS = new Set(["travel", "projectile"]);

// Placed areas waiting for their spell's damage roll: the same item and caster, the newest still on the scene.
// played: when the area's own recipe lands (now() clock); claim: each prop is asked for once per area.
export function createAreaWaits({ now = () => Date.now(), ttl = 120000 } = {}) {
  const areas = new Map();
  const drop = () => { for (const [id, a] of areas) if (now() - a.rememberedAt > ttl) areas.delete(id); };
  return {
    remember(area) {
      if (!area?.templateId) return;
      drop();
      areas.delete(area.templateId);
      areas.set(area.templateId, { ...area, rememberedAt: now(), impactAt: null, claimed: new Set() });
    },
    matchDamage({ itemUuid, actorUuid } = {}) {
      drop();
      if (!itemUuid || !actorUuid) return null;
      let best = null;
      for (const a of areas.values()) if (a.itemUuid === itemUuid && a.actorUuid === actorUuid && (!best || a.rememberedAt >= best.rememberedAt)) best = a;
      return best;
    },
    forget(templateId) { areas.delete(templateId); },
    size() { return areas.size; },
    played(templateId, at) { const a = areas.get(templateId); if (a && Number.isFinite(at)) a.impactAt = at; },
    delayFor(area) { return Number.isFinite(area?.impactAt) ? Math.max(0, area.impactAt - now()) : 0; },
    claim(templateId, tileId) {
      const a = areas.get(templateId);
      if (!a || a.claimed.has(tileId)) return false;
      a.claimed.add(tileId);
      return true;
    },
  };
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
