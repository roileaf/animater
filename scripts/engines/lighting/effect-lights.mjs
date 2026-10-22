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
const LASTING_MS = 86400000;
const MIN_FADE_MS = 300;
const GLOW_IN_MS = 100;
const FLASH_RISE_MS = 60;
const FLASH_DECAY_MS = 650;
const STROBE_PEAKS_MS = 300;
const STROBE_PERIOD_MS = 100;
const STROBE_RISE_MS = 20;
const STROBE_TROUGH = 0.5;
const STROBE_DECAY_MS = 400;
const NOT_VISUAL = new Set(['sound', 'motion', 'tokenfx', 'scenefx']);

// Asset keys are dotted words ('jb2a.fire_bolt.orange'); words match whole, with a numeric suffix allowed.
const word = names => new RegExp(`(?:^|[._])(?:${names})(?=$|[._\\d])`);
const LUMINOUS = word('fire\\w*|flame\\w*|explosion|lightning|electric\\w*|energy|arcane|magic_missile|eldritch|ray|beam|laser|radiant|divine|holy|sun\\w*|light\\w*|plasma|spark\\w*|glow\\w*|healing\\w*');
const VETO = word('physical|smoke|blood|liquid|web|crack\\w*|darkness');
const LIGHTNING = word('lightning|electric\\w*');
const FIRE = word('fire\\w*|flame\\w*');

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
  return !!stage?.persist || ['aura', 'template'].includes(stage?.kind) && (stage.duration ?? 0) > LASTING_AREA_MS;
}

export function lightShape(stage) {
  if (['travel', 'projectile'].includes(stage?.kind)) return 'glow';
  const asset = assetOf(stage);
  if (LIGHTNING.test(asset)) return 'strobe';
  if (isLasting(stage)) return FIRE.test(asset) ? 'flicker' : 'pulse';
  if (stage?.kind === 'aura') return 'pulse';
  return 'flash';
}

// Stage tint, then the colour word in the asset key, then the element, then the recipe colour.
export function lightColor(stage, { element, recipeColor } = {}) {
  const tint = stage?.tintEnabled === false ? null : hex(stage?.tint);
  if (tint) return tint;
  const hue = keyHue(assetOf(stage));
  if (hue === 'neutral') return WARM_WHITE;
  if (hue) return HEX[hue];
  const named = normalizeElement(element);
  if (named) return ELEMENT_COLORS[named][0];
  return hex(recipeColor) ?? WARM_WHITE;
}

const startOf = stage => stage.delay ?? 0;
const lengthOf = (stage, shape) => {
  if (isLasting(stage)) return stage.persist && !(stage.duration > 0) ? LASTING_MS : Math.max(stage.duration ?? 0, 0);
  if (shape === 'flash') return FLASH_RISE_MS + FLASH_DECAY_MS;
  if (shape === 'strobe') return STROBE_PEAKS_MS + STROBE_DECAY_MS;
  return Math.max(stage.duration ?? 0, 0);
};
// When two stages start together the impact wins as the one that describes the spot.
const KIND_RANK = { impact: 0, template: 1, travel: 2, projectile: 2, cast: 3, aura: 4 };
const rank = stage => KIND_RANK[stage.kind] ?? 5;

// Radii come in as pixels (radiusOf) and go out in grid squares: dim 1.5x the
// footprint, bright half of that, both clamped so no light is tiny or map-wide.
function lightRadius(pixels, grid) {
  const dim = Math.min(MAX_SQUARES, Math.max(MIN_SQUARES, 1.5 * (pixels ?? 0) / grid));
  return { dim, bright: dim / 2 };
}

/**
 * Decide the lights of one animation. Luminous stages whose places lie within
 * `spotSquares` of each other share a light; each light is described by the
 * spot's earliest luminous stage and rides on the spot's tier 0 stage (the
 * returned map's keys). A spot with no tier 0 stage gets none, and at most
 * `perAnimation` lights are kept, earliest spots first. `tiers` maps stageId to
 * tier (a stage missing from it counts as tier 0); `radiusOf` gives pixels;
 * `originOf` (optional) gives where a travelling stage starts.
 */
export function planLights(plan, { tiers, grid, pointOf, radiusOf, originOf, element, recipeColor, spotSquares = 2, perAnimation = 3 } = {}) {
  const lights = new Map();
  const tierOf = stage => tiers?.get(stage.stageId) ?? 0;
  const placed = (plan ?? []).filter(s => !NOT_VISUAL.has(s.kind)).map(stage => ({ stage, at: pointOf(stage) })).filter(p => p.at);
  const reach = spotSquares * grid;

  const spots = [];
  const luminous = placed.filter(p => isLuminous(assetOf(p.stage))).sort((a, b) => startOf(a.stage) - startOf(b.stage));
  for (const entry of luminous) {
    const spot = spots.find(s => distance(s.at, entry.at) <= reach);
    if (spot) spot.members.push(entry);
    else spots.push({ at: entry.at, members: [entry] });
  }

  const taken = new Set();
  for (const spot of spots) {
    if (lights.size >= perAnimation) break;
    const lead = spot.members.reduce((best, m) => (startOf(m.stage) < startOf(best.stage) || startOf(m.stage) === startOf(best.stage) && rank(m.stage) < rank(best.stage) ? m : best));
    const near = placed.filter(p => distance(p.at, spot.at) <= reach && tierOf(p.stage) === 0 && !taken.has(p.stage));
    const anchor = near.find(p => p.stage === lead.stage) ?? near.find(p => spot.members.includes(p)) ?? near.sort((a, b) => startOf(a.stage) - startOf(b.stage))[0];
    if (!anchor) continue;
    taken.add(anchor.stage);
    lights.set(anchor.stage, buildTag(lead, anchor.stage));
  }
  return lights;

  function buildTag({ stage, at }, anchor) {
    const shape = lightShape(stage);
    // The light can only start once its anchor does; a stage that began earlier is cut short.
    const offset = startOf(stage) - startOf(anchor);
    const startMs = Math.max(0, offset);
    const tag = {
      color: lightColor(stage, { element, recipeColor }), shape, ...lightRadius(radiusOf(stage), grid),
      startMs, lengthMs: Math.max(0, lengthOf(stage, shape) + Math.min(0, offset)),
      fadeMs: Math.max(MIN_FADE_MS, stage.fadeOut ?? 0), lasting: isLasting(stage),
    };
    const from = shape === 'glow' ? originOf?.(stage) : null;
    if (from) {
      const contact = stage.contact > 0 ? stage.contact : 0.55 * (stage.duration ?? 0);
      Object.assign(tag, { from: { x: from.x, y: from.y }, to: { x: at.x, y: at.y }, arriveMs: contact });
    }
    return tag;
  }
}

// Brightness 0..1 of each light shape at u ms after its start.
const SHAPES = {
  glow: u => clamp01(u / GLOW_IN_MS),
  flicker: () => 1,
  pulse: () => 1,
  flash: u => u < FLASH_RISE_MS ? u / FLASH_RISE_MS : clamp01(1 - (u - FLASH_RISE_MS) / FLASH_DECAY_MS),
  strobe: u => {
    if (u >= STROBE_PEAKS_MS) return STROBE_TROUGH * clamp01(1 - (u - STROBE_PEAKS_MS) / STROBE_DECAY_MS);
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
  const level = (SHAPES[shape] ?? SHAPES.glow)(u);
  return clamp01(u <= end || fade <= 0 ? level : level * (1 - (u - end) / fade));
}
