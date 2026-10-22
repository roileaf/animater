// Ground marks, the pure part: which plays leave a mark on the floor, which mark,
// where each one lands, how its blotches are laid out from a seed, and how it fades.
// The starting client plans the marks once and attaches each one to a tier 0
// effect; every client paints the same blotches from the shared seed. Nothing here
// touches Foundry.
import { normalizeElement } from '../../catalogs/shared/element-choice.mjs';
import { seededRandom } from '../fragments/fragments.mjs';
import { arrivalOf } from '../playback/flight-path.mjs';
import { MISS } from '../../systems/outcome.mjs';

export const MARKS = { fire: 'scorch', cold: 'rime', acid: 'residue', electricity: 'streaks', poison: 'stain', sonic: 'cracks', force: 'cracks', void: 'withered' };

const ROLLS = new Set(['attack', 'damage', 'save']);
const USES = new Set(['spell', 'action', 'use', 'template']);
const NOT_VISUAL = new Set(['sound', 'motion', 'tokenfx', 'scenefx']);
const FLIGHTS = new Set(['travel', 'projectile']);
const MIN_SQUARES = 0.5;
const MAX_SQUARES = 2;
const MAX_BLOTCHES = 12;
const MAX_SATELLITES = 2;
const VARIANTS = 4;

const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const point = p => ({ x: p.x, y: p.y });
const startOf = stage => stage.delay ?? 0;

/**
 * A play that harms: started by Animater's own dispatch (`automatic`) as an attack, damage or save roll, or as a
 * spell, action or item use (D&D 5e activities, Daggerheart), or a placed area (a template event), whose item deals damage. Damage moments, finishers, deaths and integration plays are not
 * dispatched, so they never mark; nor do buffs that only pick an element (Resist Energy).
 */
export function isHarmful(context, { itemDamages } = {}) {
  if (context?.automatic !== true) return false;
  if (ROLLS.has(context.type)) return true;
  return USES.has(context.type) && !!itemDamages?.(context.item);
}

// The weapon's own mark element, then the event's element, then the recipe's chosen one; only elements with a mark.
export function markElement(recipe, context) {
  const element = [recipe?.markElement, context?.element, recipe?.chosenElement].map(normalizeElement).find(Boolean);
  return element && MARKS[element] ? element : null;
}

// Whether a point lies inside the play's area: circle {center, diameter}, line {center, endpoint, length?, width},
// cone {center, endpoint, length?, angle (degrees, full spread)}. All in pixels.
function insideArea(p, area) {
  const { center } = area;
  if (area.type === 'line' || area.type === 'cone') {
    const dx = area.endpoint.x - center.x, dy = area.endpoint.y - center.y;
    const length = area.length > 0 ? area.length : Math.hypot(dx, dy);
    const reach = Math.hypot(dx, dy) || 1;
    const ux = dx / reach, uy = dy / reach, px = p.x - center.x, py = p.y - center.y;
    const along = px * ux + py * uy, across = Math.abs(px * uy - py * ux);
    if (area.type === 'line') return along >= 0 && along <= length && across <= (area.width ?? 0) / 2;
    return Math.hypot(px, py) <= length && Math.atan2(across, along) <= (area.angle ?? 0) * Math.PI / 360;
  }
  return distance(p, center) <= (area.diameter ?? 0) / 2;
}

// The area's own geometry, carried on its tag.
function areaShape(area) {
  if (area.type === 'line' || area.type === 'cone') {
    const length = area.length > 0 ? area.length : distance(area.center, area.endpoint);
    return area.type === 'line'
      ? { shape: 'line', at: point(area.center), endpoint: point(area.endpoint), width: area.width, length }
      : { shape: 'cone', at: point(area.center), endpoint: point(area.endpoint), angle: area.angle, length };
  }
  return Number(area.diameter) > 0 ? { shape: 'circle', at: point(area.center), radius: area.diameter / 2 } : null;
}

/**
 * Decide the marks of one harmful play (the caller checks isHarmful). A stage lands where it strikes: an impact,
 * a flight's end (its wall point, its scattered landing, its target), or the area of a template. A flight that flew
 * on past (flightOutcome 'past') or a missed shot with no planned end never lands. The area, when a template
 * stage shows it, gets one mark anchored on that stage, and landings inside it get none; the other landings
 * within a square of each other share one spot mark, sized to their largest footprint (clamped to half a square
 * .. 2 squares). Each mark rides on a tier 0 stage at its place (`tiers` maps stageId to tier; a stage missing
 * from it cannot anchor): a spot with none gets no mark. `pointOf(stage)` gives where a stage lands, `sizeOf`
 * its footprint in pixels, `area` the play's area geometry; `seed` makes the blotches the same on every client.
 */
export function planMarks(plan, { context = {}, recipe, tiers, gridPx = 100, pointOf, sizeOf, area, seed = 0 } = {}) {
  const marks = new Map();
  const element = markElement(recipe, context);
  if (!element) return marks;
  const isTier0 = stage => tiers?.get(stage.stageId) === 0;
  const missed = MISS.has(context.outcome);
  // A hidden roll (a GM's private attack) must not mark under its target: only a wall it strikes.
  const hiddenRoll = context.outcome === 'hidden';
  const lands = stage => {
    if (stage.kind === 'impact' || stage.kind === 'template') return true;
    if (!FLIGHTS.has(stage.kind) || stage.flightOutcome === 'past') return false;
    if (hiddenRoll) return stage.flightOutcome === 'wall';
    // A miss whose end was never planned (Sequencer bends it wide) lands nowhere known.
    return !missed || !!stage.flightTo || !!stage.landing;
  };
  const landingAt = stage => FLIGHTS.has(stage.kind) ? startOf(stage) + arrivalOf(stage) : startOf(stage);
  const placed = (plan ?? []).filter(s => !NOT_VISUAL.has(s.kind)).map(stage => ({ stage, at: pointOf(stage) })).filter(p => p.at);
  const token = context.source?.document ?? context.source;
  const base = {
    mark: MARKS[element],
    ...(typeof token?.level === 'string' && token.level ? { level: token.level } : {}),
    ...(Number.isFinite(token?.elevation) ? { elevation: token.elevation } : {}),
    sceneId: context.sceneId ?? token?.parent?.id ?? null,
  };
  const taken = new Set();
  const add = (anchor, landedAt, fields) => {
    taken.add(anchor);
    // Each mark gets its own seed, so two spots in one play differ.
    const own = (Number(seed) ^ Math.imul(marks.size + 1, 0x9e3779b1)) >>> 0;
    marks.set(anchor, { ...base, ...fields, seed: own, delayMs: Math.max(0, Math.round(landedAt - startOf(anchor))), lasting: !!anchor.persist });
  };
  const byLanding = (a, b) => landingAt(a.stage) - landingAt(b.stage);

  const landings = placed.filter(p => lands(p.stage)).sort(byLanding);
  const shape = area?.center ? areaShape(area) : null;
  const areaStages = shape ? landings.filter(p => p.stage.kind === 'template') : [];
  let covered = () => false;
  if (areaStages.length) {
    const anchor = areaStages.find(p => isTier0(p.stage))
      ?? placed.filter(p => isTier0(p.stage) && !FLIGHTS.has(p.stage.kind) && insideArea(p.at, area)).sort(byLanding)[0];
    if (anchor) {
      add(anchor.stage, landingAt(areaStages[0].stage), shape);
      covered = p => insideArea(p, area);
    }
  }

  const spots = [];
  for (const entry of landings.filter(p => !areaStages.includes(p) && !covered(p.at))) {
    const spot = spots.find(s => distance(s.at, entry.at) <= gridPx);
    if (spot) spot.members.push(entry);
    else spots.push({ at: entry.at, members: [entry] });
  }
  for (const spot of spots) {
    // Its own landing stages first (a still one before a flight), then any tier 0 stage at the spot.
    const rank = p => (spot.members.includes(p) ? 0 : 2) + (FLIGHTS.has(p.stage.kind) ? 1 : 0);
    const anchor = placed.filter(p => isTier0(p.stage) && !taken.has(p.stage) && distance(p.at, spot.at) <= gridPx)
      .sort((a, b) => rank(a) - rank(b) || startOf(a.stage) - startOf(b.stage))[0];
    if (!anchor) continue;
    const squares = Math.max(...spot.members.map(m => (Number(sizeOf?.(m.stage)) || gridPx) / gridPx));
    const radius = Math.min(MAX_SQUARES, Math.max(MIN_SQUARES, squares)) * gridPx / 2;
    add(anchor.stage, landingAt(spot.members[0].stage), { shape: 'spot', at: point(spot.at), radius });
  }
  return marks;
}

/**
 * The blotches of one mark, the same on every client for the same seed: a spot is one blotch on its place with
 * up to 2 smaller satellites; a circle up to 12, denser to the centre and smaller towards the edge; a line spaced
 * along its length; a cone spread over its widening fan. Each has a random rotation (radians), a ±20% scale and a
 * texture variant. Pixels throughout.
 */
export function layoutBlotches(tag, gridPx = 100) {
  const random = seededRandom(tag.seed);
  const at = tag.at;
  const blotch = (x, y, r) => ({ x, y, r: r * (0.8 + 0.4 * random()), rotation: random() * 2 * Math.PI, variant: Math.floor(random() * VARIANTS) });
  if (tag.shape === 'circle') {
    const R = tag.radius;
    const count = Math.min(MAX_BLOTCHES, Math.max(1, Math.round((R / gridPx) ** 2)));
    const size = R * Math.min(1, 1.3 / Math.sqrt(count));
    return Array.from({ length: count }, (_, i) => {
      // The first sits on the centre; the others cluster towards it (squared distance) and shrink at the edge.
      const d = i === 0 ? 0 : 0.85 * R * random() ** 2, a = random() * 2 * Math.PI;
      return blotch(at.x + d * Math.cos(a), at.y + d * Math.sin(a), size * (1 - 0.4 * d / R));
    });
  }
  if (tag.shape === 'line' || tag.shape === 'cone') {
    const dx = tag.endpoint.x - at.x, dy = tag.endpoint.y - at.y, reach = Math.hypot(dx, dy) || 1;
    const ux = dx / reach, uy = dy / reach, length = tag.length > 0 ? tag.length : reach;
    const place = (along, across, r) => blotch(at.x + ux * along - uy * across, at.y + uy * along + ux * across, r);
    if (tag.shape === 'line') {
      const width = tag.width > 0 ? tag.width : gridPx;
      const count = Math.min(MAX_BLOTCHES, Math.max(1, Math.round(length / Math.max(width, gridPx / 2))));
      return Array.from({ length: count }, (_, i) => place(length * (i + 0.5 + 0.3 * (random() - 0.5)) / count, width * 0.2 * (2 * random() - 1), width / 2));
    }
    const spread = Math.tan((tag.angle ?? 0) * Math.PI / 360);
    const count = Math.min(MAX_BLOTCHES, Math.max(1, Math.round(length * length * spread / gridPx ** 2)));
    return Array.from({ length: count }, () => {
      // More towards the wide end, where there is more ground to cover.
      const along = length * (0.15 + 0.85 * Math.sqrt(random())), half = along * spread;
      return place(along, 0.7 * half * (2 * random() - 1), Math.max(0.4 * gridPx, 0.6 * half));
    });
  }
  const R = tag.radius ?? gridPx / 2;
  const blotches = [blotch(at.x, at.y, R)];
  const satellites = Math.floor(random() * (MAX_SATELLITES + 1));
  for (let i = 0; i < satellites; i++) {
    const d = R * (0.7 + 0.4 * random()), a = random() * 2 * Math.PI;
    blotches.push(blotch(at.x + d * Math.cos(a), at.y + d * Math.sin(a), R * (0.25 + 0.15 * random())));
  }
  return blotches;
}

// How long a mark lives, from the setting's minutes: full for the first 40%, then fading over the rest.
// 0 never fades (holdMs Infinity).
export function markTiming(minutes) {
  const total = Math.max(0, Number(minutes) || 0) * 60000;
  return total > 0 ? { holdMs: total * 0.4, fadeMs: total * 0.6 } : { holdMs: Infinity, fadeMs: 0 };
}

// Opacity 0..1 of a mark `ageMs` after it landed: fades in, stays full until `holdMs`, then fades out linearly.
export function markAlpha(ageMs, { holdMs = 120000, fadeMs = 180000, inMs = 300 } = {}) {
  if (!(ageMs >= 0)) return 0;
  if (ageMs < inMs) return ageMs / inMs;
  if (ageMs < holdMs) return 1;
  return Math.max(0, 1 - (ageMs - holdMs) / fadeMs);
}
