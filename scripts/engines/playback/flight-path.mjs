// Where a shot really flies (stopping at walls, finding a clear line to a partly covered
// target) and how it gets there (straight, a low arc or a high lob). Pure: the walls come in
// through collides(a, b, type) -> { x, y, door? } | null, the first wall point on the line.
import { MISS, sideOf } from '../../systems/outcome.mjs';
import { centerOf } from './composition.mjs';

const FLIGHTS = ['travel', 'projectile'];
const LOB = /throwable\.(throw\.(bomb|flask)|launch)\./;
const LOW = /\.throw(\.|$)|shuriken|chakram|kunai|boomerang/;
const OVERRIDE = { straight: 'none', low: 'low', lob: 'lob' };
const INSET = 0.2;

const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const point = (p) => ({ x: p.x, y: p.y });

// The arc a flight takes: the stage's Flight option, else what its asset is.
export function arcOf(stage) {
  const forced = OVERRIDE[stage?.flight];
  if (forced) return { kind: forced };
  const key = String(stage?.asset ?? stage?.assets?.[0] ?? '');
  return { kind: LOB.test(key) ? 'lob' : LOW.test(key) ? 'low' : 'none' };
}

// How high the arc peaks and how large the object grows there.
export function arcShape(kind, distancePx, gridPx) {
  if (kind === 'lob') return { apexPx: Math.min(3 * gridPx, Math.max(0.75 * gridPx, 0.25 * distancePx)), peakScale: 1.35 };
  if (kind === 'low') return { apexPx: Math.min(gridPx, 0.08 * distancePx), peakScale: 1.1 };
  return { apexPx: 0, peakScale: 1 };
}

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

// Plans every flight stage: flightFrom/flightTo/flightOutcome (when walls apply), flightArc,
// and an earlier contact for a flight cut short by a wall (flightArrivalCut: how much earlier).
// blocked: target ids whose attack hit ended at a wall (their target effects must not play).
export function withFlightPaths(plan, { context = {}, gridPx = 100, collides = null, walls = true, arcs = true, preview = false } = {}) {
  const blocked = new Set();
  const seed = context.messageId ?? context.id;
  const out = plan.map((s) => {
    if (!FLIGHTS.includes(s.kind)) return s;
    const from = point(centerOf(s.origin)), aim = point(s.landing ?? centerOf(s.endpoint));
    const role = walls && collides ? roleOf(s, context, preview) : 'fixed';
    const path = role === 'fixed'
      ? { from, to: aim, outcome: 'target' }
      : planFlight({ from, targetRect: footprintOf(s.endpoint, gridPx), to: aim, role, seed, gridPx, collides, shieldBlock: s.shieldBlock });
    const kind = arcs ? arcOf(s).kind : 'none';
    const next = { ...s, flightArc: { kind, ...arcShape(kind, distance(path.from, path.to), gridPx) } };
    if (role === 'fixed') return next;
    Object.assign(next, { flightFrom: path.from, flightTo: path.to, flightOutcome: path.outcome, ...(path.wallDoor ? { wallDoor: true } : {}) });
    const full = distance(from, aim), reached = distance(path.from, path.to);
    if (path.outcome === 'wall' && reached < full && s.duration > 0) {
      const arrival = arrivalOf(s), contact = Math.max(1, Math.round(arrival * reached / full));
      Object.assign(next, { contact, flightArrivalCut: Math.round(arrival) - contact });
    }
    if (path.outcome === 'wall' && role === 'attack-hit') blocked.add(tokenId(s.endpoint));
    return next;
  });
  return { plan: out, blocked };
}
