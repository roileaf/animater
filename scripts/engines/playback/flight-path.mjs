// Where a shot really flies (stopping at walls, finding a clear line to a partly covered
// target) and how it gets there (straight, a low arc or a high lob). Pure: the walls come in
// through collides(a, b, type) -> { x, y, door? } | null, the first wall point on the line.
import { MISS, sideOf } from '../../systems/outcome.mjs';
import { centerOf } from './composition.mjs';
import { normalizeOptions } from '../../core/stage-options.mjs';

const FLIGHTS = ['travel', 'projectile'];
const LOB = /throwable\.(throw\.(bomb|flask|grenade|stick_grenade|dynamite)|launch)\./;
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

const rateOf = (s) => (Number(s.playbackRate) > 0 ? Number(s.playbackRate) : 1);
// When a flight reaches its end (the moment its impact is timed to), in elapsed time: its contact is clip time,
// which a slowed clip (slow motion) reaches later.
export const arrivalOf = (s) => Math.min(s.duration, Number(s.contact) > 0 ? Number(s.contact) / rateOf(s) : s.duration * 0.55);

// When a projectile's effect (and so its moveTowards) ends. An arcing one touches down at the flight's arrival
// (a wall-shortened contact included), as its impact does; any other keeps its whole duration.
export const moveEnd = (s) => (s.kind === 'projectile' && s.flightArc && s.flightArc.kind !== 'none' ? arrivalOf(s) : s.duration);

// When the flying object leaves and how long until it lands. A projectile (moveTowards) moves from its
// moveDelay to the end of its effect; a travel clip's object lands at the flight's arrival.
export function flightTiming(s) {
  if (s.kind !== 'projectile') return { start: 0, arrive: arrivalOf(s) };
  const start = Math.max(0, Number(s.moveDelay) || 0);
  return { start, arrive: Math.max(0, moveEnd(s) - start) };
}

// The ground line a flight follows: its planned path, else the points Sequencer flies it between
// (a travel clip stretches to the endpoint token, a projectile moves to its landing point).
export function flightLine(s) {
  const from = s.flightFrom ?? point(centerOf(s.origin));
  const to = s.flightTo ?? point(s.kind === 'projectile' && s.landing ? s.landing : centerOf(s.endpoint));
  return { from, to };
}

const round = (v) => Math.round(v * 1e4) / 1e4 + 0;
// A value that rises to its peak over the first half of the flight and comes back over the second.
const rise = (property, base, peak, half, start) => [
  { property, from: base, to: peak, duration: half, delay: start, ease: 'easeOutQuad' },
  { property, from: peak, to: base, duration: half, delay: start + half, ease: 'easeInQuad' },
];

// The arc of a flying object as tracks on its effect's spriteContainer (core/stage-options.mjs format;
// position in grid squares). The runtime sets them as absolute values: Sequencer never moves or scales that
// container itself (rest 0 and 1), and a relative track keeps its end value when it completes, so the fall
// from the apex would otherwise end an apex too high.
// angle: the turn of the effect's frame. Sequencer's stretchTo turns rotationContainer, the parent of
// spriteContainer, along the flight (canvas-effect.js _rotateTowards), so a lift on position.y would rise
// sideways to the throw; the screen-up lift is turned back into that frame instead (a projectile is not turned:
// angle 0). stretched: a travel clip runs from the thrower to the landing point, with spriteContainer's origin
// at the thrower, so growing its x would push the object along the line (to 67% of the way at a lob's apex); it
// only thickens (scale.y), which scales about the line itself.
export function arcTracks(arc, arriveMs, gridPx, { angle = 0, stretched = false, start = 0 } = {}) {
  if (!arc || arc.kind === 'none' || !(arriveMs > 0) || !(gridPx > 0)) return [];
  const half = arriveMs / 2, lift = arc.apexPx / gridPx;
  // Screen-up (0, -lift) seen from a frame turned by angle.
  const x = round(-lift * Math.sin(angle)), y = round(-lift * Math.cos(angle));
  return [
    ...(x ? rise('position.x', 0, x, half, start) : []),
    ...(y ? rise('position.y', 0, y, half, start) : []),
    ...(stretched ? [] : rise('scale.x', 1, arc.peakScale, half, start)),
    ...rise('scale.y', 1, arc.peakScale, half, start),
  ];
}

const SHADOW = { width: 0.5, height: 0.3, alpha: 0.35, apexScale: 0.6, apexAlpha: 0.15 };
// The arcing flight's shadow on the floor: a soft dark ellipse moving straight from the thrower to the landing
// point as the object flies, smallest and faintest at the apex. Decoration (tier 2); tagged animaterShadow so
// each client can drop it (main.mjs, setting projectileShadows). Its tracks (flightTracks) are set like arcTracks:
// absolute on spriteContainer, alpha times the shape's own. The stage's opacity stays 1: Sequencer draws a shape
// at its own alpha (canvas-lib.js createShape), not at the effect's opacity.
export function shadowStage(flight) {
  const { start, arrive } = flightTiming(flight), { from, to } = flightLine(flight), half = arrive / 2;
  return {
    ...normalizeOptions({ kind: 'projectile', duration: start + arrive }),
    stageId: `${flight.stageId}-shadow`, kind: 'projectile', label: 'Shadow', assets: [], asset: null,
    delay: flight.delay ?? 0, duration: start + arrive, scale: 1, opacity: 1, below: true,
    origin: flight.origin, endpoint: flight.endpoint, destination: flight.destination,
    flightFrom: from, flightTo: to, moveDelay: start,
    ...(flight.kind === 'projectile' && flight.moveEase ? { moveEase: flight.moveEase } : {}),
    // Sequencer draws an ellipse from its half width and half height.
    shape: { type: 'ellipse', width: SHADOW.width / 2, height: SHADOW.height / 2, gridUnits: true, fillColor: '#000000', fillAlpha: 1, alpha: SHADOW.alpha },
    flightTracks: [
      ...rise('scale.x', 1, SHADOW.apexScale, half, start),
      ...rise('scale.y', 1, SHADOW.apexScale, half, start),
      ...rise('alpha', 1, round(SHADOW.apexAlpha / SHADOW.alpha), half, start),
    ],
    tier: 2, animaterShadow: true,
  };
}

// Plans every flight stage: flightFrom/flightTo/flightOutcome (when walls apply), flightArc,
// and an earlier contact for a projectile cut short by a wall (flightArrivalCut: how much earlier). A projectile
// moves at its own pace over the line, so a shorter line arrives sooner. A travel clip keeps its arrival: Sequencer
// picks the clip's range variant (05/15/30/60/90 ft) by the shorter line, and its object reaches the far end at
// about the same clip time in every one.
// blocked: target ids whose attack hit ended at a wall; missed: target ids whose own shot was planned to miss
// (flying past or into a wall). The target effects of both must not play.
export function withFlightPaths(plan, { context = {}, gridPx = 100, collides = null, walls = true, arcs = true, preview = false } = {}) {
  const blocked = new Set(), missed = new Set();
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
    if (path.outcome === 'wall' && s.kind === 'projectile' && reached < full && s.duration > 0) {
      const arrival = arrivalOf(s), at = Math.max(1, Math.round(arrival * reached / full));
      // contact is clip time; the cut is elapsed time, as delays are.
      Object.assign(next, { contact: Math.max(1, Math.round(at * rateOf(s))), flightArrivalCut: Math.round(arrival) - at });
    }
    if (path.outcome === 'wall' && role === 'attack-hit') blocked.add(tokenId(s.endpoint));
    if (role === 'attack-miss' && path.outcome !== 'target') missed.add(tokenId(s.endpoint));
    return next;
  });
  return { plan: out, blocked, missed };
}
