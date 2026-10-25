// Map distortion, the pure part: which moments bend the scene (a shockwave ring
// from a big blast, a heat haze over lasting fire, a warp at a teleport), how
// strong each is over time, and which four get a shader slot. The starting
// client plans the distortions once and attaches each to a tier 0 effect;
// nothing here touches Foundry.
import { normalizeElement } from '../../catalogs/shared/element-choice.mjs';

// A blast's flash hides its middle for most of a second: the ring runs long and strong enough to still bend the
// map clearly once it has passed the flash's edge, and never weaker than at 0.75 zoom on a zoomed-out view.
const SHOCK_MS = 1400;
const WARM_MS = 500;
const SHOCK_PX = 24;
const SHOCK_FADE = 1.5;
const SHOCK_MIN_ZOOM = 0.75;
const HAZE_PX = 2.5;
const WARP_PX = 10;
const MIN_RING_SQUARES = 3;
const MAX_RING_SQUARES = 12;
const RING_PER_BLAST = 1.5;
const BAND_PER_RING = 0.16;
const BIG_BURST_SQUARES = 2;
const LASTING_AREA_MS = 2000;
const NOT_VISUAL = new Set(['sound', 'motion', 'tokenfx', 'scenefx']);
const FLIGHTS = new Set(['travel', 'projectile']);
const KINDS = { shock: 0, haze: 1, warp: 2 };

const BLAST = /explosion|thunderwave|shatter|ground_crack|impact\.earth|boulder|shockwave/;
const HEAVY = /great(axe|sword|club)|maul|glaive|halberd|earthbreaker|greatpick|lucern/;
const FIRE = /(?:^|[._])(?:fire\w*|flame\w*|flaming)(?=$|[._\d])/;
const ROUND_AREAS = new Set(['circle', 'emanation', 'burst', 'sphere', 'cylinder', 'radius']);

const assetsOf = stage => [stage?.asset, ...(stage?.assets ?? [])].filter(Boolean).map(a => String(a).toLowerCase());
const matches = (stage, pattern) => assetsOf(stage).some(a => pattern.test(a));
const startOf = stage => stage.delay ?? 0;
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// A play counts as critical on an attack or check roll, never on damage or a save.
export function isCritical(context) {
  if (!['attack', 'check'].includes(context?.type)) return false;
  if (context.outcome === 'criticalSuccess') return true;
  const outcomes = context.targetOutcomes;
  const values = outcomes instanceof Map ? [...outcomes.values()] : Object.values(outcomes ?? {});
  return values.includes('criticalSuccess');
}

// Lasting: loops until its anchor ends, or an aura or template that plays well past a burst.
function isLasting(stage) {
  return !!stage?.persist || (['aura', 'template'].includes(stage?.kind) && (stage.duration ?? 0) > LASTING_AREA_MS);
}

/**
 * What a stage does to the map: 'shock' for a big blast (a blast asset, a round
 * one-shot area of radius >= 2 squares, or a critical heavy-weapon hit) that does
 * not persist, whatever its clip's length; 'haze' for a lasting fire aura or area
 * (persisting, or a long one that is no blast), otherwise null. `radius` (pixels) and
 * `gridPx` size the area test; `element` is the play's element (fire); `harmful`
 * false (an item that deals no damage: a healing sphere, Detect Magic) keeps a
 * plain round area from shocking.
 */
export function distortionKind(stage, { context, heavyItem = false, harmful = true, element, radius, gridPx } = {}) {
  if (!stage || NOT_VISUAL.has(stage.kind) || FLIGHTS.has(stage.kind)) return null;
  const haze = () => (['aura', 'template'].includes(stage.kind) && (matches(stage, FIRE) || normalizeElement(element ?? context?.element) === 'fire') ? 'haze' : null);
  // Looping until its anchor ends: never a blast.
  if (stage.persist) return haze();
  // A one-shot blast shocks however long its clip runs (a D&D Fireball's explosion plays over four seconds).
  if (matches(stage, BLAST)) return 'shock';
  if (harmful !== false && stage.kind === 'template' && isRoundArea(context?.area) && gridPx > 0 && radius / gridPx >= BIG_BURST_SQUARES) return 'shock';
  if (stage.kind === 'impact' && isCritical(context) && (heavyItem || matches(stage, HEAVY))) return 'shock';
  return isLasting(stage) ? haze() : null;
}

// A round area: one named circle, emanation or burst, or a placed circle, which carries only its centre and
// diameter (canvas-preview-area.mjs templateArea: a D&D sphere, cylinder or radius, a PF2e burst).
function isRoundArea(area) {
  if (!area) return false;
  return area.type == null ? Number(area.diameter) > 0 && !!area.center : ROUND_AREAS.has(area.type);
}

/**
 * Decide the distortions of one animation. Stages of one kind whose places lie
 * within `spotSquares` of each other are one spot, described by its earliest stage
 * and riding on the spot's tier 0 stage. A haze rides on a lasting tier 0 stage (a
 * one-shot anchor would end it early). `tiers` maps stageId to tier (a missing one
 * cannot anchor); `radiusOf` gives pixels; `follows` (optional) says an anchor
 * moves with a token, so its haze follows it. At most `perAnimation` are kept,
 * earliest first. `shockReach` (the world's "Shockwave reach") is how far a ring
 * grows as a multiple of its blast's radius; its cap scales with it (1.5: 3..12
 * squares). `level` (the source token's level) goes on every tag.
 */
export function planDistortions(plan, { context, tiers, gridPx, pointOf, radiusOf, heavyItem, harmful, element, follows, level, shockReach, spotSquares = 2, perAnimation = 4 } = {}) {
  const tags = new Map();
  const ringPer = Number.isFinite(shockReach) && shockReach > 0 ? shockReach : RING_PER_BLAST;
  const maxRing = MAX_RING_SQUARES * ringPer / RING_PER_BLAST;
  const isTier0 = stage => tiers?.get(stage.stageId) === 0;
  const reach = spotSquares * gridPx;
  const placed = (plan ?? []).filter(s => !NOT_VISUAL.has(s.kind)).map(stage => ({ stage, at: pointOf(stage) })).filter(p => p.at);
  const byStart = (a, b) => startOf(a.stage) - startOf(b.stage);
  const taken = new Set();

  for (const kind of ['shock', 'haze']) {
    const entries = placed.filter(p => distortionKind(p.stage, { context, heavyItem, harmful, element, radius: radiusOf(p.stage), gridPx }) === kind).sort(byStart);
    const spots = [];
    for (const entry of entries) {
      const spot = spots.find(s => distance(s.at, entry.at) <= reach);
      if (spot) spot.members.push(entry);
      else spots.push({ at: entry.at, members: [entry] });
    }
    for (const spot of spots) {
      if (tags.size >= perAnimation) break;
      const lead = spot.members[0];
      const near = placed.filter(p => !FLIGHTS.has(p.stage.kind) && isTier0(p.stage) && !taken.has(p.stage) && distance(p.at, spot.at) <= reach).sort(byStart);
      const fits = p => kind === 'shock' || isLasting(p.stage);
      const anchor = near.find(p => p.stage === lead.stage && fits(p)) ?? near.find(p => spot.members.includes(p) && fits(p)) ?? near.find(fits);
      if (!anchor) continue;
      taken.add(anchor.stage);
      const tag = kind === 'shock' ? shockTag(lead, anchor.stage) : hazeTag(lead, anchor.stage);
      if (typeof level === 'string' && level) tag.level = level;
      tags.set(anchor.stage, tag);
    }
  }
  return tags;

  function shockTag({ stage, at }, anchor) {
    const blast = (radiusOf(stage) ?? 0) / gridPx;
    // A ring that stays inside its blast is hidden by it: a small reach still carries it a square past the edge.
    const squares = Math.max(clamp(ringPer * blast, MIN_RING_SQUARES, maxRing), Math.min(blast + 1, MAX_RING_SQUARES));
    // The band is the default ring's whatever the reach, so a long reach ripples instead of sliding the view.
    const band = BAND_PER_RING * clamp(RING_PER_BLAST * blast, MIN_RING_SQUARES, MAX_RING_SQUARES) * gridPx;
    // The ring starts at the blast's contact; the anchor's own start is the clock.
    const startMs = Math.max(0, startOf(stage) + (stage.contact > 0 ? stage.contact : 0) - startOf(anchor));
    return { kind: 'shock', at: { x: at.x, y: at.y }, radius: squares * gridPx, band, startMs, lengthMs: SHOCK_MS, strength: 1, follow: false };
  }

  function hazeTag({ stage, at }, anchor) {
    const tag = {
      kind: 'haze', at: { x: at.x, y: at.y }, radius: radiusOf(stage) || gridPx,
      startMs: Math.max(0, startOf(stage) - startOf(anchor)), lengthMs: null, strength: 1, follow: !!follows?.(anchor),
    };
    const area = context?.area;
    // A line or cone is covered by the capsule along its length, as wide as the line or the cone's far end.
    if (stage.kind === 'template' && !stage.areaTile && ['line', 'cone'].includes(area?.type) && area.center && area.endpoint) {
      const length = distance(area.center, area.endpoint);
      const coneWidth = area.type === 'cone' && area.angle > 0 && area.angle < 180 ? Math.min(2 * length, 2 * length * Math.tan(area.angle * Math.PI / 360)) : 0;
      const width = coneWidth > 0 ? coneWidth : area.width > 0 ? area.width : area.type === 'cone' ? length / 2 : gridPx;
      tag.area = { type: 'capsule', a: { x: area.center.x, y: area.center.y }, b: { x: area.endpoint.x, y: area.endpoint.y }, width };
      tag.at = { x: (area.center.x + area.endpoint.x) / 2, y: (area.center.y + area.endpoint.y) / 2 };
      tag.radius = length / 2 + width / 2;
    } else {
      tag.area = { type: 'circle' };
    }
    return tag;
  }
}

/** A teleport's warp at `at`, `radius` pixels: starts as its effect arrives, ~500 ms. `level`: the token's level. */
export function warpTag(at, radius, level) {
  return { kind: 'warp', at: { x: at.x, y: at.y }, radius, startMs: 0, lengthMs: WARM_MS, strength: 1, follow: false, ...(typeof level === 'string' && level ? { level } : {}) };
}

const easeOutCubic = x => 1 - (1 - x) ** 3;

/**
 * What the shader slot gets at `tMs` on the anchor's clock: kind (0 shock, 1 haze,
 * 2 warp), centre, radius, ring (shock only: the ring's current radius) and amp
 * (peak pixels, times zoom). Null outside the tag's time.
 */
export function slotParams(tag, tMs, { zoom = 1 } = {}) {
  const t = tMs - tag.startMs;
  if (!(t >= 0)) return null;
  const centre = { x: tag.at.x, y: tag.at.y };
  const gain = (tag.strength ?? 1) * zoom;
  if (tag.kind === 'haze') {
    if (tag.lengthMs != null && t >= tag.lengthMs) return null;
    return { kind: KINDS.haze, centre, radius: tag.radius, ring: 0, amp: HAZE_PX * gain };
  }
  const length = tag.lengthMs ?? (tag.kind === 'shock' ? SHOCK_MS : WARM_MS);
  if (t >= length) return null;
  const u = t / length;
  if (tag.kind === 'shock') {
    const amp = SHOCK_PX * (1 - u) ** SHOCK_FADE * (tag.strength ?? 1) * Math.max(zoom, SHOCK_MIN_ZOOM);
    return { kind: KINDS.shock, centre, radius: tag.radius, ring: tag.radius * easeOutCubic(u), amp, ...(tag.band > 0 ? { band: tag.band } : {}) };
  }
  return { kind: KINDS.warp, centre, radius: tag.radius, ring: 0, amp: WARP_PX * Math.sin(Math.PI * u) * gain };
}

/**
 * The distortions that get a slot: those whose circle (centre +- radius) touches
 * `view` ({x, y, w, h}), at most `max`. Over that, one-shots go first, then the
 * farthest from the view's centre. Kept in their given order.
 */
export function chooseSlots(active, view, max = 4) {
  const seen = (active ?? []).filter(a => {
    const { centre, radius } = a.params;
    return centre.x + radius >= view.x && centre.x - radius <= view.x + view.w && centre.y + radius >= view.y && centre.y - radius <= view.y + view.h;
  });
  if (seen.length <= max) return seen;
  const middle = { x: view.x + view.w / 2, y: view.y + view.h / 2 };
  const keep = new Set([...seen].sort((a, b) => (b.lasting - a.lasting) || (distance(a.params.centre, middle) - distance(b.params.centre, middle))).slice(0, max));
  return seen.filter(a => keep.has(a));
}
