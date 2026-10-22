// Where a shot really flies (stopping at walls, finding a clear line to a partly covered
// target). Pure: the walls come in through collides(a, b, type) -> { x, y, door? } | null,
// the first wall point on the line.
import { MISS, sideOf } from '../../systems/outcome.mjs';
import { centerOf } from './composition.mjs';
import { rangeLanding } from './range-landing.mjs';

const FLIGHTS = ['travel', 'projectile'];
const INSET = 0.2;

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const point = (p) => ({ x: p.x, y: p.y });

// Where a shot may land on a footprint: its centre, then points inset 20% from its edges
// (edge midpoints, then corners), nearest to the centre first.
export function footprintPoints({ x, y, w, h }) {
  const cx = x + w / 2, cy = y + h / 2, l = x + w * INSET, r = x + w * (1 - INSET), t = y + h * INSET, b = y + h * (1 - INSET);
  const points = [{ x: cx, y: cy }, { x: l, y: cy }, { x: r, y: cy }, { x: cx, y: t }, { x: cx, y: b }, { x: l, y: t }, { x: r, y: t }, { x: l, y: b }, { x: r, y: b }];
  const near = (p) => distance(p, { x: cx, y: cy });
  return points.map((p, i) => ({ p, i })).sort((a, b) => near(a.p) - near(b.p) || a.i - b.i).map(({ p }) => p)
    .filter((p, i, all) => all.findIndex((q) => q.x === p.x && q.y === p.y) === i);
}

// A collision backend's first wall point (a PolygonVertex with its edges) as collides() returns it. Only a
// plain door counts as a door (it knocks on wood); a secret door sounds like the stone it hides in.
export function wallHit(vertex, doorType = 1) {
  if (!vertex) return null;
  const door = [...(vertex.edges ?? [])].some((edge) => Number((edge.object?.document ?? edge.object)?.door) === doorType);
  return { x: vertex.x, y: vertex.y, ...(door ? { door: true } : {}) };
}

// The first footprint point the shooter can see, or null.
export function clearPoint(from, rect, collides, first = null) {
  const candidates = first ? [first, ...footprintPoints(rect)] : footprintPoints(rect);
  return candidates.find((p) => collides(from, p, 'sight') === null) ?? null;
}

// A miss's free end: a small angle off the line to the target, on past it. The side follows
// the seed (the same hash as the dodge), so every client draws the same miss.
export function missLine(from, to, { seed, gridPx, angle = 12, overshoot = 2 }) {
  const theta = Math.atan2(to.y - from.y, to.x - from.x) + sideOf(seed) * angle * Math.PI / 180;
  const length = distance(from, to) + overshoot * gridPx;
  return { x: from.x + Math.cos(theta) * length, y: from.y + Math.sin(theta) * length };
}

// The path of one flight. role: 'attack-hit' | 'attack-miss' | 'other' | 'fixed'.
export function planFlight({ from, targetRect, to, role, seed, gridPx, collides, shieldBlock }) {
  const aim = to ?? footprintPoints(targetRect)[0];
  const straight = { from, to: aim, outcome: 'target' };
  if (role === 'fixed' || shieldBlock || !collides || distance(from, aim) === 0) return straight;
  const atWall = (hit) => ({ from, to: point(hit), outcome: 'wall', ...(hit.door ? { wallDoor: true } : {}) });
  if (role === 'attack-miss') {
    const end = missLine(from, aim, { seed, gridPx }), hit = collides(from, end, 'move');
    return hit ? atWall(hit) : { from, to: end, outcome: 'past' };
  }
  const seen = targetRect ? clearPoint(from, targetRect, collides, aim) : collides(from, aim, 'sight') === null ? aim : null;
  if (seen) return { from, to: seen, outcome: 'target' };
  if (role !== 'attack-hit') return straight;
  // Nothing in sight: the hit thunks into the first wall that stops movement.
  const hit = collides(from, aim, 'move');
  return hit ? atWall(hit) : straight;
}

export const tokenId = (t) => t?.id ?? t?.document?.id;
const isToken = (t) => !!tokenId(t);
// A token's footprint in scene pixels, around its centre.
function footprintOf(token, gridPx) {
  const c = centerOf(token);
  const w = Number(token?.w ?? (token?.document?.width ?? 0) * gridPx) || 0;
  const h = Number(token?.h ?? (token?.document?.height ?? 0) * gridPx) || 0;
  return { x: c.x - w / 2, y: c.y - h / 2, w, h };
}

function roleOf(s, context, preview) {
  if (['target', 'previousTarget'].includes(s.travelOrigin) || s.areaFan || s.travelDestination === 'area' || !isToken(s.endpoint)) return 'fixed';
  const outcome = context.targetOutcomes?.[tokenId(s.endpoint)] ?? context.outcome;
  const attack = outcome && (!context.type || context.type === 'attack') && s.origin === context.source;
  if (!attack) return 'other';
  if (MISS.has(outcome)) return 'attack-miss';
  // A preview never drops target effects, so its hit never ends at a wall.
  return preview ? 'other' : 'attack-hit';
}

// When a flight reaches its end (the moment its impact is timed to).
export const arrivalOf = (s) => Math.min(s.duration, Number(s.contact) > 0 ? Number(s.contact) : s.duration * 0.55);

// When a flight stopped by a wall (s.flightFrom -> s.flightTo) reaches it, in elapsed ms into the stage (as its
// duration and contact are). A projectile: Sequencer's moveTowards (no move speed) runs from its launch pause to
// the end of the effect, so it touches the wall as the stage ends, however short the line. A travel clip:
// Sequencer picks its range variant (05/15/30/60/90 ft) by the line to the wall, and the object in each variant
// lands at a time of its own (range-landing.mjs, measured: a JB2A arrow 500 ms at 05 ft to 1150 ms at 90 ft),
// played from the skipped opening at the stage's media speed. An unmeasured clip is struck at the end of its
// travel, 200 ms before the stage ends (as the PF2e weapon recipes time an unmeasured contact; every measured
// JB2A ranged weapon clip lands at least 267 ms before its own end), never before the recipe's own arrival.
export function wallArrivalOf(s, { gridPx = 100, landings } = {}) {
  if (s.kind === 'projectile') return s.duration;
  const reach = s.flightFrom && s.flightTo ? distance(s.flightFrom, s.flightTo) : null;
  const landing = reach === null ? null : rangeLanding(s.asset, reach, gridPx, landings);
  if (landing === null) return Math.min(s.duration, Math.max(arrivalOf(s), 400, s.duration - 200));
  const elapsed = Math.max(0, landing - (Number(s.clipStart) || 0)) / (Number(s.playbackRate) || 1);
  return Math.min(s.duration, elapsed);
}

// Plans every flight stage: flightFrom/flightTo/flightOutcome (when walls apply). A flight stopped by a wall
// gets its wall arrival as its contact (wallArrivalOf) and flightArrivalShift: how much later (earlier when
// negative) that is than the recipe's own arrival, which what followed its target's impacts moves with.
// blocked: target ids whose attack hit ended at a wall; missed: target ids whose own shot was planned to miss
// (flying past or into a wall). The target effects of both must not play.
export function withFlightPaths(plan, { context = {}, gridPx = 100, collides = null, walls = true, preview = false } = {}) {
  const blocked = new Set(), missed = new Set();
  const seed = context.messageId ?? context.id;
  const out = plan.map((s) => {
    if (!FLIGHTS.includes(s.kind)) return s;
    const from = point(centerOf(s.origin)), aim = point(s.landing ?? centerOf(s.endpoint));
    const role = walls && collides ? roleOf(s, context, preview) : 'fixed';
    if (role === 'fixed') return s;
    const path = planFlight({ from, targetRect: footprintOf(s.endpoint, gridPx), to: aim, role, seed, gridPx, collides, shieldBlock: s.shieldBlock });
    const next = { ...s, flightFrom: path.from, flightTo: path.to, flightOutcome: path.outcome, ...(path.wallDoor ? { wallDoor: true } : {}) };
    if (path.outcome === 'wall' && s.duration > 0) {
      const contact = Math.max(1, Math.round(wallArrivalOf(next, { gridPx }))), shift = contact - Math.round(arrivalOf(s));
      Object.assign(next, { contact, ...(shift ? { flightArrivalShift: shift } : {}) });
    }
    if (path.outcome === 'wall' && role === 'attack-hit') blocked.add(tokenId(s.endpoint));
    if (role === 'attack-miss' && path.outcome !== 'target') missed.add(tokenId(s.endpoint));
    return next;
  });
  return { plan: out, blocked, missed };
}
