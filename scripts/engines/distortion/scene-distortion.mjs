// Map distortion, the pure part: which moments bend the scene (a shockwave ring
// from a big blast, a heat haze over lasting fire, a warp at a teleport), how
// strong each is over time, and which four get a shader slot. The starting
// client plans the distortions once and attaches each to a tier 0 effect;
// nothing here touches Foundry.
import { normalizeElement } from '../../catalogs/shared/element-choice.mjs';

const SHOCK_MS = 700;
const WARM_MS = 500;
const SHOCK_PX = 12;
const HAZE_PX = 2.5;
const WARP_PX = 10;
const MIN_RING_SQUARES = 3;
const MAX_RING_SQUARES = 12;
const RING_PER_BLAST = 1.5;
const BIG_BURST_SQUARES = 2;
const LASTING_AREA_MS = 2000;
const NOT_VISUAL = new Set(['sound', 'motion', 'tokenfx', 'scenefx']);
const FLIGHTS = new Set(['travel', 'projectile']);
const KINDS = { shock: 0, haze: 1, warp: 2 };

const BLAST = /explosion|thunderwave|shatter|ground_crack|impact\.earth|boulder|shockwave/;
const HEAVY = /great(axe|sword|club)|maul|warhammer|glaive|halberd|earthbreaker|greatpick|lucern/;
const FIRE = /(?:^|[._])(?:fire\w*|flame\w*|flaming)(?=$|[._\d])/;
const ROUND_AREAS = new Set(['circle', 'emanation', 'burst']);

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
 * What a stage does to the map: 'shock' for a big blast (a blast asset, a circle
 * or emanation one-shot of radius >= 2 squares, or a critical heavy-weapon hit),
 * 'haze' for a lasting fire aura or area, otherwise null. `radius` (pixels) and
 * `gridPx` size the area test; `element` is the play's element (fire).
 */
export function distortionKind(stage, { context, heavyItem = false, element, radius, gridPx } = {}) {
  if (!stage || NOT_VISUAL.has(stage.kind) || FLIGHTS.has(stage.kind)) return null;
  if (isLasting(stage)) {
    if (!['aura', 'template'].includes(stage.kind)) return null;
    return matches(stage, FIRE) || normalizeElement(element ?? context?.element) === 'fire' ? 'haze' : null;
  }
  if (matches(stage, BLAST)) return 'shock';
  if (stage.kind === 'template' && ROUND_AREAS.has(context?.area?.type) && gridPx > 0 && radius / gridPx >= BIG_BURST_SQUARES) return 'shock';
  if (stage.kind === 'impact' && isCritical(context) && (heavyItem || matches(stage, HEAVY))) return 'shock';
  return null;
}

/**
 * Decide the distortions of one animation. Stages of one kind whose places lie
 * within `spotSquares` of each other are one spot, described by its earliest stage
 * and riding on the spot's tier 0 stage. A haze rides on a lasting tier 0 stage (a
 * one-shot anchor would end it early). `tiers` maps stageId to tier (a missing one
 * cannot anchor); `radiusOf` gives pixels; `follows` (optional) says an anchor
 * moves with a token, so its haze follows it. At most `perAnimation` are kept,
 * earliest first.
 */
export function planDistortions(plan, { context, tiers, gridPx, pointOf, radiusOf, heavyItem, element, follows, spotSquares = 2, perAnimation = 4 } = {}) {
  const tags = new Map();
  const isTier0 = stage => tiers?.get(stage.stageId) === 0;
  const reach = spotSquares * gridPx;
  const placed = (plan ?? []).filter(s => !NOT_VISUAL.has(s.kind)).map(stage => ({ stage, at: pointOf(stage) })).filter(p => p.at);
  const byStart = (a, b) => startOf(a.stage) - startOf(b.stage);
  const taken = new Set();

  for (const kind of ['shock', 'haze']) {
    const entries = placed.filter(p => distortionKind(p.stage, { context, heavyItem, element, radius: radiusOf(p.stage), gridPx }) === kind).sort(byStart);
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
      tags.set(anchor.stage, kind === 'shock' ? shockTag(lead, anchor.stage) : hazeTag(lead, anchor.stage));
    }
  }
  return tags;

  function shockTag({ stage, at }, anchor) {
    const squares = clamp(RING_PER_BLAST * (radiusOf(stage) ?? 0) / gridPx, MIN_RING_SQUARES, MAX_RING_SQUARES);
    // The ring starts at the blast's contact; the anchor's own start is the clock.
    const startMs = Math.max(0, startOf(stage) + (stage.contact > 0 ? stage.contact : 0) - startOf(anchor));
    return { kind: 'shock', at: { x: at.x, y: at.y }, radius: squares * gridPx, startMs, lengthMs: SHOCK_MS, strength: 1, follow: false };
  }

  function hazeTag({ stage, at }, anchor) {
    const tag = {
      kind: 'haze', at: { x: at.x, y: at.y }, radius: radiusOf(stage) || gridPx,
      startMs: Math.max(0, startOf(stage) - startOf(anchor)), lengthMs: null, strength: 1, follow: !!follows?.(anchor),
    };
    const area = context?.area;
    // A line or cone is covered by the capsule along its length.
    if (stage.kind === 'template' && !stage.areaTile && ['line', 'cone'].includes(area?.type) && area.center && area.endpoint) {
      const length = distance(area.center, area.endpoint);
      const width = area.width > 0 ? area.width : area.type === 'cone' ? length / 2 : gridPx;
      tag.area = { type: 'capsule', a: { x: area.center.x, y: area.center.y }, b: { x: area.endpoint.x, y: area.endpoint.y }, width };
      tag.at = { x: (area.center.x + area.endpoint.x) / 2, y: (area.center.y + area.endpoint.y) / 2 };
      tag.radius = length / 2 + width / 2;
    } else {
      tag.area = { type: 'circle' };
    }
    return tag;
  }
}

/** A teleport's warp at `at`, `radius` pixels: starts as its effect arrives, ~500 ms. */
export function warpTag(at, radius) {
  return { kind: 'warp', at: { x: at.x, y: at.y }, radius, startMs: 0, lengthMs: WARM_MS, strength: 1, follow: false };
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
  if (tag.kind === 'shock') return { kind: KINDS.shock, centre, radius: tag.radius, ring: tag.radius * easeOutCubic(u), amp: SHOCK_PX * (1 - u) ** 2 * gain };
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
