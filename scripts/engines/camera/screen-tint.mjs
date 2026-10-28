// Screen tint: an elemental spell washes the whole view in its element's colour for a moment as it lands (a
// Fireball's orange glare, Chain Lightning's blue-white strobe, a Cone of Cold's icy blink, Harm's dark pall).
// The starting client plans one tint per animation (planTint) and tags it on that stage's effect as `animaterTint`;
// every screen that receives the effect draws it (createScreenTint) by its own settings, so a player's private
// roll tints only the screens it plays on. The wash sits over the map and under Foundry's interface.
import { normalizeElement } from '../../catalogs/shared/element-choice.mjs';
import { qualityRank } from '../../core/quality.mjs';

// Each element's wash. `blend` is how it mixes with the map: light colours glow ('screen'), dark ones dim
// ('multiply'). `flicker`: lightning strobes instead of swelling and fading.
export const TINTS = Object.freeze({
  fire: { color: '#ff6a1f', blend: 'screen' },
  cold: { color: '#6fd0ff', blend: 'screen' },
  // A saturated electric blue: a near-white wash barely shows over a lit map.
  electricity: { color: '#4f9dff', blend: 'screen', flicker: true },
  acid: { color: '#8fe03a', blend: 'screen' },
  poison: { color: '#6cc85a', blend: 'screen' },
  sonic: { color: '#b9a6ff', blend: 'screen' },
  force: { color: '#a77cff', blend: 'screen' },
  vitality: { color: '#ffe98a', blend: 'screen' },
  spirit: { color: '#e6ecff', blend: 'screen' },
  mental: { color: '#e07cf0', blend: 'screen' },
  void: { color: '#4b2a6e', blend: 'multiply' },
});
// The wash at strength 1 on the blast: clearly seen over a bright explosion, gone within about a second.
export const MAX_ALPHA = 0.42;
const RISE_MS = 90, HOLD_MS = 260, FADE_MS = 900;
// Lightning's strobe: [start ms, length ms, strength] flashes over a glow that stays lit between them (a strobe
// with dark gaps hides under the lightning art's own flashes), then the usual fade from the last one.
const STROBE = [[0, 110, 1], [190, 90, 0.8], [350, 140, 1]], STROBE_GLOW = 0.4;
// Areas from a small burst to the largest that still grows the wash (squares of radius).
const SMALL_SQUARES = 1, BIG_SQUARES = 6;
// At most this many washes at once on one screen (a volley of Scorching Rays is one glare, not five).
const STACK = 2;
const KINDS = new Set(['impact', 'template', 'travel', 'projectile', 'aura']);

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * One tint for an animation, or an empty map. `element` is the play's element; a weapon Strike (`strike`), a play
 * that deals no damage (`harmful` false) or a lasting stage never tints. The wash rides on the earliest tier 0 stage
 * that lands it (a hit, an area, a bolt or ray), timed to its contact or arrival, as strong as the area is big;
 * `critical` hits a little harder and `surge` (momentum) multiplies it. Returns Map(anchor stage -> tag).
 */
export function planTint(plan, { element, strike = false, harmful = true, critical = false, surge = 1, tiers, gridPx = 100, pointOf, radiusOf } = {}) {
  const tags = new Map(), look = TINTS[normalizeElement(element)];
  if (!look || strike || harmful === false) return tags;
  const lands = (plan ?? []).filter((s) => KINDS.has(s.kind) && !s.persist && tiers?.get(s.stageId) === 0 && (s.kind !== 'aura' || s.subject === 'targets'))
    .sort((a, b) => contactOf(a) - contactOf(b));
  const anchor = lands[0];
  if (!anchor) return tags;
  const at = pointOf?.(anchor) ?? null;
  const squares = Math.max(0, ...lands.filter((s) => s.kind === 'template').map((s) => (radiusOf?.(s) ?? 0) / gridPx));
  const size = clamp((squares - SMALL_SQUARES) / (BIG_SQUARES - SMALL_SQUARES), 0, 1);
  const strength = clamp((0.7 + 0.3 * size + (critical ? 0.2 : 0)) * (surge > 1 ? surge : 1), 0, 1.3);
  const tag = (stage, extra) => {
    const p = pointOf?.(stage) ?? null;
    tags.set(stage, {
      color: look.color, blend: look.blend, startMs: Math.max(0, Math.round(contactOf(stage) - (stage.delay ?? 0))),
      ...(p && finite(p.x) && finite(p.y) ? { at: { x: p.x, y: p.y } } : {}), ...extra,
    });
  };
  tag(anchor, { ...(look.flicker ? { flicker: true } : {}), strength: Math.round(strength * 100) / 100 });
  // A chain (Chain Lightning) blinks again on each leap from one creature to the next, softer than the first strike.
  const hops = lands.filter((s) => s !== anchor && FLIGHTS.has(s.kind) && s.travelOrigin === 'previousTarget').slice(0, MAX_HOPS);
  for (const hop of hops) tag(hop, { blink: true, strength: Math.round(strength * HOP_STRENGTH * 100) / 100 });
  return tags;
}
const FLIGHTS = new Set(['travel', 'projectile']), MAX_HOPS = 8, HOP_STRENGTH = 0.65;
// When a stage lands: an impact's or area's contact, a bolt's arrival (most of its flight), a beam's start.
function contactOf(s) {
  const start = s.delay ?? 0;
  if (s.kind === 'projectile') return start + (s.duration ?? 0) * 0.8;
  return start + (s.contact > 0 ? s.contact : 0);
}

/** The tint tag on an effect's data, or null. */
export function tintTagOf(data) {
  const tag = data?.animaterTint;
  return tag && typeof tag.color === 'string' && /^#[0-9a-f]{6}$/i.test(tag.color) && finite(tag.strength) && tag.strength > 0 ? tag : null;
}

/** Whether this screen tints: any animation quality but Off, and its own setting on. */
export const canTint = (quality, localOn) => localOn !== false && qualityRank(quality) > 0;

/**
 * How strong the wash is `t` ms after the effect arrived (0..1 of its peak), 0 before it and after it ends.
 * A strobe (`flicker`, unless `calm`) flashes three times, then fades from the last flash.
 */
export function tintLevel(tag, t, { calm = false } = {}) {
  const local = t - (tag.startMs ?? 0);
  if (!(local >= 0)) return 0;
  // A chain's leap: one quick flash.
  if (tag.blink) return local < BLINK_RISE_MS ? local / BLINK_RISE_MS : local < BLINK_RISE_MS + BLINK_HOLD_MS ? 1
    : Math.max(0, 1 - (local - BLINK_RISE_MS - BLINK_HOLD_MS) / BLINK_FADE_MS) ** 2;
  if (tag.flicker && !calm) {
    for (const [from, length, k] of STROBE) if (local >= from && local < from + length) return k;
    const [from, length, k] = STROBE.at(-1), after = local - (from + length);
    if (after < 0) return STROBE_GLOW;
    return after < FADE_MS ? k * (1 - after / FADE_MS) ** 2 : 0;
  }
  if (local < RISE_MS) return local / RISE_MS;
  if (local < RISE_MS + HOLD_MS) return 1;
  const after = local - RISE_MS - HOLD_MS;
  return after < FADE_MS ? (1 - after / FADE_MS) ** 2 : 0;
}
const BLINK_RISE_MS = 40, BLINK_HOLD_MS = 80, BLINK_FADE_MS = 320;
export const tintLength = (tag) => (tag.startMs ?? 0) + (tag.blink ? BLINK_RISE_MS + BLINK_HOLD_MS + BLINK_FADE_MS
  : (tag.flicker ? STROBE.at(-1)[0] + STROBE.at(-1)[1] : RISE_MS + HOLD_MS) + FADE_MS);

/** The wash's peak opacity on this view: full while the blast is on screen, fading out a view's width beyond it. */
export function tintAlpha(tag, { view, strength = 1 } = {}) {
  let falloff = 1;
  if (tag.at && view && view.w > 0 && view.h > 0) {
    const dx = Math.max(view.x - tag.at.x, 0, tag.at.x - (view.x + view.w)), dy = Math.max(view.y - tag.at.y, 0, tag.at.y - (view.y + view.h));
    falloff = clamp(1 - Math.hypot(dx, dy) / Math.max(view.w, view.h), 0, 1);
  }
  return clamp(MAX_ALPHA * tag.strength * falloff * strength, 0, 0.75);
}

/**
 * The host: `onEffect(effect)` from createSequencerEffect, `tick()` on the PIXI ticker, `clear()` on canvasTearDown.
 * Options: `mount()` (a fresh overlay element over the map, or null), `view()` (the screen's world rectangle),
 * `screenPoint(at)` (a scene point in the overlay's percent, or null), `now()`, `enabled()`, `strength()`, `calm()`
 * (no strobe: reduced motion), `sceneId()`, `viewedLevel()`, `seen(point)` (false: this screen cannot see it).
 */
export function createScreenTint({ mount, view, screenPoint = () => null, now, enabled, strength = () => 1, calm = () => false, sceneId, viewedLevel = () => null, seen = () => true }) {
  const washes = new Map();
  const drop = (key) => { try { washes.get(key)?.el?.remove(); } catch { /* gone */ } washes.delete(key); };
  const host = {
    get size() { return washes.size; },
    onEffect(effect) {
      try {
        const data = effect?.data, tag = tintTagOf(data);
        if (!tag || data.moduleName !== 'animater' || washes.has(effect)) return;
        if (data.sceneId !== sceneId() || !enabled()) return;
        const level = typeof tag.level === 'string' && tag.level ? tag.level : null, viewed = viewedLevel();
        if (level && viewed && level !== viewed) return;
        if (tag.at && seen(tag.at) === false) return;
        const peak = tintAlpha(tag, { view: view(), strength: Number(strength()) || 1 });
        if (peak < 0.01) return;
        // Past the cap the oldest blink gives way first, so a chain's leaps never cut its first strike short.
        while (washes.size >= STACK) drop([...washes].find(([, w]) => w.tag.blink)?.[0] ?? washes.keys().next().value);
        const el = mount();
        if (!el) return;
        const p = tag.at ? screenPoint(tag.at) : null, c = tag.color;
        // Strongest around the blast, still clearly tinted at the screen's far edge.
        el.style.background = p ? `radial-gradient(circle at ${p.x}% ${p.y}%, ${c} 0%, ${c}cc 45%, ${c}88 100%)` : c;
        el.style.mixBlendMode = tag.blend === 'multiply' ? 'multiply' : 'screen';
        el.style.opacity = '0';
        washes.set(effect, { el, tag, peak, at: now() });
      } catch (err) {
        console.warn('Animater | screen tint skipped an effect', err);
      }
    },
    // Runs on the PIXI ticker, where a throw would stop the canvas: it never throws.
    tick() {
      if (!washes.size) return;
      try {
        if (!enabled()) return host.clear();
        const t = now(), still = calm();
        for (const [key, w] of [...washes]) {
          if (t - w.at >= tintLength(w.tag)) { drop(key); continue; }
          w.el.style.opacity = String(Math.round(w.peak * tintLevel(w.tag, t - w.at, { calm: still }) * 1000) / 1000);
        }
      } catch (err) {
        console.warn('Animater | screen tint stopped', err);
        host.clear();
      }
    },
    clear() { for (const key of [...washes.keys()]) drop(key); },
  };
  return host;
}
