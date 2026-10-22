// Effect lighting, the pure part: which effects glow, what colour and shape of
// light they get, which spots share a light, and how bright each light is over
// time. The starting client plans the lights once and attaches each one to a
// tier 0 effect; nothing here touches Foundry.
import { HEX, keyHue } from '../playback/color-parity.mjs';
import { ELEMENT_COLORS, normalizeElement } from '../../catalogs/shared/element-choice.mjs';

const WARM_WHITE = '#ffe8c0';
const MIN_SQUARES = 1;
const MAX_SQUARES = 12;
const LASTING_AREA_MS = 2000;
export const LASTING_MS = 86400000;
const MIN_FADE_MS = 300;
const GLOW_IN_MS = 100;
const FLASH_RISE_MS = 60;
// A burst settles to a held glow by SETTLE_MS, then dims slowly until its stage ends.
const SETTLE_MS = 700;
const HELD_LEVEL = 0.45;
const END_LEVEL = 0.35;
const STROBE_PEAKS_MS = 300;
const STROBE_PERIOD_MS = 100;
const STROBE_RISE_MS = 20;
const STROBE_TROUGH = 0.5;
const NOT_VISUAL = new Set(['sound', 'motion', 'tokenfx', 'scenefx']);

// Asset keys are dotted words ('jb2a.fire_bolt.orange'); words match whole, with a numeric suffix allowed.
const word = names => new RegExp(`(?:^|[._])(?:${names})(?=$|[._\\d])`);
const LUMINOUS = word('fire\\w*|flame\\w*|flaming|explosion|lightning|electric\\w*|energy|arcane|magic_missile|eldritch|ray|beam|laser|radiant|divine|holy|sun\\w*|light\\w*|plasma|spark\\w*|glow\\w*|healing\\w*');
const VETO = word('physical|smoke|blood|liquid|web|crack\\w*|darkness');
const LIGHTNING = word('lightning|electric\\w*');
const FIRE = word('fire\\w*|flame\\w*|flaming');

const assetOf = stage => String(stage?.asset ?? stage?.assets?.[0] ?? '').toLowerCase();
const hex = value => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const digits = match[1].length === 3 ? [...match[1]].map(c => c + c).join('') : match[1];
  return '#' + digits.toLowerCase();
};
const clamp01 = n => Math.min(1, Math.max(0, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export function isLuminous(assetKey) {
  const key = String(assetKey ?? '').toLowerCase();
  return !!key && !VETO.test(key) && LUMINOUS.test(key);
}

// A light that stays for the effect's life instead of playing once.
function isLasting(stage) {
  return !!stage?.persist || (['aura', 'template'].includes(stage?.kind) && (stage.duration ?? 0) > LASTING_AREA_MS);
}

export function lightShape(stage) {
  if (['travel', 'projectile'].includes(stage?.kind)) return 'glow';
  const asset = assetOf(stage);
  // A lasting area keeps glowing; a strobe would go dark after its first second.
  if (isLasting(stage)) return FIRE.test(asset) ? 'flicker' : 'pulse';
  if (LIGHTNING.test(asset)) return 'strobe';
  if (stage?.kind === 'aura') return 'pulse';
  return 'flash';
}

// Stage tint, then the colour word in the asset key, then the element, then the recipe colour, else `fallback`.
export function lightColor(stage, { element, recipeColor, fallback = WARM_WHITE } = {}) {
  const tint = stage?.tintEnabled === false ? null : hex(stage?.tint);
  if (tint) return tint;
  const hue = keyHue(assetOf(stage));
  if (hue === 'neutral') return WARM_WHITE;
  if (hue) return HEX[hue];
  const named = normalizeElement(element);
  if (named) return ELEMENT_COLORS[named][0];
  return hex(recipeColor) ?? fallback;
}

const startOf = stage => stage.delay ?? 0;
// A persisting stage loops until it is ended, so its light lasts until its anchor ends (the host's onEnded).
// Any other light lasts as long as its stage plays (duration is elapsed ms), a burst included.
const lengthOf = stage => (stage.persist ? LASTING_MS : Math.max(stage.duration ?? 0, 0));
// When two stages start together the impact wins as the one that describes the spot.
const KIND_RANK = { impact: 0, template: 1, travel: 2, projectile: 2, cast: 3, aura: 4 };
const rank = stage => KIND_RANK[stage.kind] ?? 5;

// Radii come in as pixels (radiusOf) and go out in grid squares: dim 1.5x the
// footprint, bright half of that, both clamped so no light is tiny or map-wide.
export function lightRadius(pixels, grid) {
  const dim = Math.min(MAX_SQUARES, Math.max(MIN_SQUARES, 1.5 * (pixels ?? 0) / grid));
  return { dim, bright: dim / 2 };
}

/**
 * Lights along a line from `from` to `to`: at the middles of up to `max` equal
 * stretches of it, one per `spanSquares`, each sized to its stretch. Null when
 * the line is short enough for one light.
 */
export function spreadAlong(from, to, grid, { spanSquares = 4, max = 3 } = {}) {
  const length = from && to ? distance(from, to) : 0;
  const n = Math.min(3, max, Math.ceil(length / (spanSquares * grid)));
  if (!(n > 1)) return null;
  const points = Array.from({ length: n }, (_, i) => {
    const k = (i + 0.5) / n;
    return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
  });
  return { points, ...lightRadius(length / n / 2, grid) };
}

/**
 * Decide the lights of one animation. Flights (travel, projectile) never join a
 * spot: each luminous flight that is itself tier 0 gets its own travelling glow,
 * which fades out when it lands. The other luminous stages whose places lie
 * within `spotSquares` of each other share a light, described by the spot's
 * earliest luminous stage and riding on the spot's tier 0 stage; a lasting stage
 * at a spot gets a light of its own, so a burst before it does not take its
 * glow. All are keyed by the anchor stage; a spot with no free tier 0 stage gets
 * none, and at most `perAnimation` spot lights and, separately, `perAnimation`
 * flight glows are kept, earliest first. `tiers` maps stageId to tier (a stage
 * missing from it is not tier 0 and cannot anchor); `radiusOf` gives pixels;
 * `originOf` (optional) gives where a flight starts. A spot light sits at its
 * stage's place (`at`), except on an anchor that `follows` (optional) says moves
 * with a token, which it follows. `level` and `elevation` are the source token's.
 * A lasting stage that `spanOf` (optional) says stands along a line ({from, to},
 * a wall) is lit by up to three lights spaced along it, one per `spanSquares`;
 * each counts towards the spot lights' cap.
 */
export function planLights(plan, { tiers, grid, pointOf, radiusOf, originOf, follows, spanOf, element, recipeColor, level, elevation, spotSquares = 2, spanSquares = 4, perAnimation = 3 } = {}) {
  const lights = new Map();
  const isTier0 = stage => tiers?.get(stage.stageId) === 0;
  const isFlight = stage => ['travel', 'projectile'].includes(stage.kind);
  const placed = (plan ?? []).filter(s => !NOT_VISUAL.has(s.kind)).map(stage => ({ stage, at: pointOf(stage) })).filter(p => p.at);
  const byStart = (a, b) => startOf(a.stage) - startOf(b.stage);
  const reach = spotSquares * grid;

  placed.filter(p => isFlight(p.stage) && isLuminous(assetOf(p.stage)) && isTier0(p.stage)).sort(byStart)
    .slice(0, perAnimation).forEach(p => lights.set(p.stage, buildTag(p, p.stage)));

  const still = placed.filter(p => !isFlight(p.stage));
  const spots = [];
  for (const entry of still.filter(p => isLuminous(assetOf(p.stage))).sort(byStart)) {
    const spot = spots.find(s => distance(s.at, entry.at) <= reach);
    if (spot) spot.members.push(entry);
    else spots.push({ at: entry.at, members: [entry] });
  }

  const taken = new Set();
  // Spot lights placed so far (a wall's lights each count).
  let used = 0;
  const earliest = members => members.reduce((best, m) => (startOf(m.stage) < startOf(best.stage) || (startOf(m.stage) === startOf(best.stage) && rank(m.stage) < rank(best.stage)) ? m : best));
  for (const spot of spots) {
    // One-shot members share one light, lasting members another. When a spot has both, each rides on a
    // tier 0 stage of its own kind (a lasting light on a one-shot anchor would end with it).
    const both = spot.members.some(m => isLasting(m.stage)) && spot.members.some(m => !isLasting(m.stage));
    for (const lasting of [false, true]) {
      if (used >= perAnimation) break;
      const group = spot.members.filter(m => isLasting(m.stage) === lasting);
      if (!group.length) continue;
      const lead = earliest(group);
      const near = still.filter(p => distance(p.at, spot.at) <= reach && isTier0(p.stage) && !taken.has(p.stage)).sort(byStart);
      const anchor = near.find(p => p.stage === lead.stage) ?? near.find(p => group.includes(p))
        ?? near.find(p => isLasting(p.stage) === lasting) ?? (both || lasting ? null : near[0]);
      if (!anchor) continue;
      taken.add(anchor.stage);
      const tag = buildTag(lead, anchor.stage, perAnimation - used);
      used += tag.points?.length ?? 1;
      lights.set(anchor.stage, tag);
    }
  }
  return lights;

  function buildTag({ stage, at }, anchor, budget = 1) {
    const shape = lightShape(stage);
    // The light can only start once its anchor does; a stage that began earlier is cut short.
    const offset = startOf(stage) - startOf(anchor);
    const tag = {
      color: lightColor(stage, { element, recipeColor }), shape, ...lightRadius(radiusOf(stage), grid),
      startMs: Math.max(0, offset), lengthMs: Math.max(0, lengthOf(stage) + Math.min(0, offset)),
      fadeMs: Math.max(MIN_FADE_MS, stage.fadeOut ?? 0), lasting: isLasting(stage),
    };
    if (typeof level === 'string' && level) tag.level = level;
    if (Number.isFinite(elevation)) tag.elevation = elevation;
    if (shape === 'glow') {
      // A flight's glow lasts until it lands, then fades out.
      tag.arriveMs = stage.contact > 0 ? stage.contact : 0.55 * (stage.duration ?? 0);
      tag.lengthMs = tag.arriveMs;
      const from = originOf?.(stage);
      if (from) Object.assign(tag, { from: { x: from.x, y: from.y }, to: { x: at.x, y: at.y } });
    } else if (follows?.(anchor)) {
      tag.follow = true;
    } else {
      // A still light sits where its stage is: the anchor's own position can be elsewhere (a line starts at the caster).
      tag.at = { x: at.x, y: at.y };
      if (tag.lasting) spread(tag, stage, budget);
    }
    return tag;
  }

  // A lasting wall along a line: lights at the middles of equal stretches of it, each sized to its stretch.
  function spread(tag, stage, budget) {
    const span = spanOf?.(stage);
    const lights = span && spreadAlong(span.from, span.to, grid, { spanSquares, max: budget });
    if (lights) Object.assign(tag, lights);
  }
}

// The held glow after a burst settles: HELD_LEVEL, dimming to END_LEVEL by the light's end.
const held = (u, end) => {
  const span = end - SETTLE_MS;
  return span > 0 ? HELD_LEVEL - (HELD_LEVEL - END_LEVEL) * clamp01((u - SETTLE_MS) / span) : HELD_LEVEL;
};
const easeOut = x => 1 - (1 - x) ** 2;

// Brightness 0..1 of each light shape at u ms after its start; `end` is the light's length.
const SHAPES = {
  glow: u => clamp01(u / GLOW_IN_MS),
  flicker: () => 1,
  pulse: () => 1,
  flash: (u, end) => {
    if (u < FLASH_RISE_MS) return u / FLASH_RISE_MS;
    if (u < SETTLE_MS) return 1 - (1 - HELD_LEVEL) * easeOut((u - FLASH_RISE_MS) / (SETTLE_MS - FLASH_RISE_MS));
    return held(u, end);
  },
  strobe: (u, end) => {
    if (u >= SETTLE_MS) return held(u, end);
    if (u >= STROBE_PEAKS_MS) return STROBE_TROUGH - (STROBE_TROUGH - HELD_LEVEL) * (u - STROBE_PEAKS_MS) / (SETTLE_MS - STROBE_PEAKS_MS);
    const phase = u % STROBE_PERIOD_MS;
    return phase < STROBE_RISE_MS ? phase / STROBE_RISE_MS : 1 - (1 - STROBE_TROUGH) * (phase - STROBE_RISE_MS) / (STROBE_PERIOD_MS - STROBE_RISE_MS);
  },
};

/** Light level 0..1 at time `tMs` on the anchor's clock; `steady` swaps a strobe for one flash. */
export function envelope(tag, tMs, { steady = false } = {}) {
  const u = tMs - tag.startMs;
  if (u < 0) return 0;
  const end = tag.lengthMs;
  const fade = tag.fadeMs ?? 0;
  if (u >= end + fade) return 0;
  const shape = steady && tag.shape === 'strobe' ? 'flash' : tag.shape;
  const level = (SHAPES[shape] ?? SHAPES.glow)(u, end);
  return clamp01(u <= end || fade <= 0 ? level : level * (1 - (u - end) / fade));
}
