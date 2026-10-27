// The wounded view: what a player's own screen shows of their creature's state, for as long as it lasts (not per hit).
// From half its HP a soft dark-red vignette creeps in from the edges, deeper the lower it gets (pulsing with the
// lingering heartbeat at a quarter HP in combat; much fainter out of combat); each hit taken while hurt leaves a stain
// or two on the lens edges, dried and still, that stay while HP stays low and fade once healed past their threshold;
// the world's music and ambience close in (a lowpass and a duck) under a quarter HP in combat.
// Down (0 HP, dying, unconscious): near-black edges round a dim, blurred, greyed window, the world nearly silent and a
// slow, faint, uneven heartbeat while dying (weaker as death nears); waking gasps back to the light; death lets the
// heartbeat go, holds the dark a moment and clears.
// Pure: the host reads the system's state (lifeOf's facts), draws the looks (lens-blood-draw.mjs wound/stains/pulse/
// flash) and wires the muffle (engines/sound/world-muffle.mjs).

import { qualityRank } from '../../core/quality.mjs';
import { lensSplats, LENS_BLOOD } from './lens-blood.mjs';

export const WOUNDED = Object.freeze({
  // The vignette starts at this share of max HP; stains keep at or under it (and the deeper set at LENS_BLOOD.lowHp).
  from: 0.5,
  low: LENS_BLOOD.lowHp,
  // Out of combat the wounded view is this much of itself.
  calm: 0.35,
  // How long a stain takes to show (as the hit's wet splash dries over it) and to fade once healed.
  stainInMs: 1400,
  stainFadeMs: 2600,
  // Healing clears stains one after another, this far apart.
  stainStaggerMs: 450,
  stainAlpha: 0.78,
});
// Waking: the dark lifts fast behind a brief bright flash and the world comes back. Death: the dark holds, then clears.
export const WAKE = Object.freeze({ liftMs: 650, flashPeak: 0.32, flashMs: 700, releaseMs: 900 });
export const DEATH = Object.freeze({ closeMs: 500, holdMs: 2000, clearMs: 1600, beatFadeMs: 2400 });

const clamp01 = (v) => Math.min(1, Math.max(0, Number(v) || 0));
const lerp = (a, b, t) => a + (b - a) * t;
const r3 = (v) => Math.round(v * 1000) / 1000;
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// No look at all: what the wound layer eases to when there is nothing to show.
export const NO_WOUND = Object.freeze({ edge: 0, dark: 0, window: 1, blur: 0, saturate: 1, brightness: 1 });

/** The share of its HP a creature has left (hp-state.mjs state; a marked track counts its unmarked boxes), or null. */
export function hpLeft(state) {
  if (!state || !(Number(state.max) > 0)) return null;
  const v = Number(state.value);
  if (!Number.isFinite(v)) return null;
  return clamp01(state.marked ? (state.max - v) / state.max : v / state.max);
}

// The statuses that mean down, by name (any system), and the systems' own death markers.
const has = (list, id) => list.includes(id);
/**
 * Where a creature is between up and dead, from the facts the host reads off its actor:
 * { systemId, hp (hp-state.mjs state), statuses: [ids], dying: { value, max } (PF2e/SF2e), death: { success, failure }
 * (D&D 5e) }. Answers { phase: 'up'|'down'|'dying'|'stable'|'dead', weak 0..1 (how faint the heart is), left (HP share) }.
 */
export function lifeOf({ systemId = '', hp = null, statuses = [], dying = null, death = null } = {}) {
  const st = (Array.isArray(statuses) ? statuses : [...(statuses ?? [])]).map((s) => String(s).toLowerCase());
  const left = hpLeft(hp), out = (phase, weak = 0) => ({ phase, weak: r3(clamp01(weak)), left });
  if (has(st, 'dead')) return out('dead', 1);
  const zero = hp?.down === true || left === 0;
  if (systemId === 'pf2e' || systemId === 'sf2e') {
    const value = Math.max(0, Number(dying?.value) || 0), max = Math.max(1, Number(dying?.max) || 4);
    if (value >= max) return out('dead', 1);
    if (value > 0 || has(st, 'dying')) return out('dying', Math.max(1, value) / max);
    if (zero || has(st, 'unconscious')) return out(has(st, 'stable') ? 'stable' : 'down', 0.3);
    return out('up');
  }
  if (systemId === 'dnd5e') {
    const fail = Math.min(3, Math.max(0, Number(death?.failure) || 0)), ok = Math.min(3, Math.max(0, Number(death?.success) || 0));
    if (fail >= 3) return out('dead', 1);
    if (zero) {
      if (has(st, 'stable') || ok >= 3) return out('stable', 0.2);
      // Weaker with each failed save, steadier with each success.
      return out('dying', 0.3 + 0.25 * fail - 0.08 * ok);
    }
    if (has(st, 'unconscious')) return out('down', 0.3);
    return out('up');
  }
  if (systemId === 'daggerheart') {
    // The last Hit Point marked: the death move (Blaze of Glory, Avoid Death, Risk It All), then out cold.
    if (has(st, 'deathmove')) return out('dying', 0.6);
    if (zero) return out(has(st, 'unconscious') ? 'down' : 'dying', has(st, 'unconscious') ? 0.35 : 0.5);
    if (has(st, 'unconscious')) return out('down', 0.35);
    return out('up');
  }
  if (has(st, 'dying')) return out('dying', 0.5);
  if (zero || has(st, 'unconscious')) return out(has(st, 'stable') ? 'stable' : 'down', 0.3);
  return out('up');
}
export const isDown = (life) => ['down', 'dying', 'stable', 'dead'].includes(life?.phase);

/** Whether this screen shows the wounded view at all: a player, the world's Damage lens and both own switches on, quality not Off. */
export const woundedWanted = ({ isGM = false, worldOn = true, localOn = true, on = true, quality = 'full' } = {}) =>
  !isGM && worldOn !== false && localOn !== false && on !== false && qualityRank(quality) > 0;

/** The red edges by HP left (0..1): none above half, creeping in below it, full at 0; fainter out of combat; Subtle halves. */
export function woundedEdge(left, { inCombat = true, amount = 'heavy' } = {}) {
  if (left == null || left >= WOUNDED.from) return 0;
  const t = 1 - clamp01(left) / WOUNDED.from;
  return r3(Math.pow(t, 0.9) * (inCombat ? 1 : WOUNDED.calm) * (amount === 'subtle' ? 0.5 : 1));
}
/** The vignette's beat at a quarter HP or under, in combat (0: no pulse): stronger the lower. */
export function woundedPulse(left, { inCombat = true, amount = 'heavy' } = {}) {
  if (!inCombat || left == null || left > WOUNDED.low || left <= 0) return 0;
  return r3((0.45 + 0.55 * (1 - left / WOUNDED.low)) * (amount === 'subtle' ? 0.5 : 1));
}

/** The down look by phase and weakness: { edge, dark, window, blur, saturate, brightness } (NO_WOUND for 'up'). */
export function downLook(life, { amount = 'heavy', quality = 'full' } = {}) {
  if (!isDown(life) || qualityRank(quality) === 0) return { ...NO_WOUND };
  const w = clamp01(life.weak), subtle = amount === 'subtle', board = qualityRank(quality) >= 2;
  const k = life.phase === 'stable' ? 0.82 : life.phase === 'down' ? 0.9 : 1;
  const look = { edge: 0, dark: r3(lerp(0.86, 0.97, w) * k), window: r3(lerp(0.4, 0.24, w) / k),
    blur: board ? r3(lerp(1.2, 2.2, w)) : 0, saturate: board ? r3(lerp(0.45, 0.25, w)) : 1, brightness: board ? r3(lerp(0.72, 0.55, w)) : 1 };
  if (life.phase === 'dead') Object.assign(look, { dark: 0.98, window: 0.14, blur: board ? 2.4 : 0, saturate: board ? 0.15 : 1, brightness: board ? 0.45 : 1 });
  // Subtle: half as far from no look.
  return subtle ? halve(look) : look;
}
const halve = (l) => ({ edge: r3(l.edge / 2), dark: r3(l.dark / 2), window: r3(lerp(l.window, 1, 0.5)), blur: r3(l.blur / 2), saturate: r3(lerp(l.saturate, 1, 0.5)), brightness: r3(lerp(l.brightness, 1, 0.5)) });

/**
 * The whole wounded view for this screen now: { look (edge, dark, window, blur, saturate, brightness), pulse, muffle
 * ({ cutoff, gain } or null), stains (whether hits leave stains and they stay) }. view: { life, inCombat, shown }; switches as
 * woundedWanted; look: { amount, quality } (lensAmount's amount, null: gore off or quality Off).
 */
export function woundedView(view, { amount = 'heavy', quality = 'full' } = {}) {
  // null: no creature of this screen's own (the GM's).
  const { life = null, inCombat = false, shown = true, ...gate } = view ?? {};
  const none = { look: { ...NO_WOUND }, pulse: 0, muffle: null, stains: false };
  // Dead: nothing lasting (the death itself plays as a transition: transitionSteps).
  if (!life || life.phase === 'dead' || !shown || !amount || !woundedWanted({ ...gate, quality })) return none;
  const low = qualityRank(quality) <= 1;
  if (isDown(life)) return { look: downLook(life, { amount, quality }), pulse: 0, muffle: low ? null : muffleFor(life, { inCombat, amount }), stains: !low };
  const edge = woundedEdge(life.left, { inCombat, amount });
  return { look: { ...NO_WOUND, edge }, pulse: woundedPulse(life.left, { inCombat, amount }), muffle: low ? null : muffleFor(life, { inCombat, amount }), stains: !low && edge > 0 };
}

/**
 * The muffle on music and ambience: { cutoff (Hz), gain } or null. Under a quarter HP in combat a gentle lowpass and
 * duck, deeper lower; down, nearly silent; Subtle half as deep.
 */
export function muffleFor(life, { inCombat = true, amount = 'heavy' } = {}) {
  if (!life) return null;
  let m = null;
  if (life.phase === 'dead') m = { cutoff: 260, gain: 0.12 };
  else if (isDown(life)) { const w = clamp01(life.weak); m = { cutoff: Math.round(lerp(560, 320, w)), gain: r3(lerp(0.3, 0.16, w)) }; }
  else if (inCombat && life.left != null && life.left <= WOUNDED.low) {
    const t = 1 - clamp01(life.left) / WOUNDED.low;
    m = { cutoff: Math.round(9000 * Math.pow(1500 / 9000, t)), gain: r3(lerp(0.92, 0.72, t)) };
  }
  if (!m) return null;
  return amount === 'subtle' ? { cutoff: Math.round(Math.sqrt(m.cutoff * 20000)), gain: r3(1 - (1 - m.gain) / 2) } : m;
}

/**
 * The heartbeat while down, or null: dead, heartless, its switch off, or the screen unwanted. { intervalMs, gain,
 * dubAt, dubGain, jitter }: slow and faint, more uneven and fainter as the creature weakens; steadier when stable.
 */
export function heartbeatDown(life, { heart = true, on = true, amount = 'heavy' } = {}) {
  if (!isDown(life) || life.phase === 'dead' || heart === false || on === false) return null;
  const w = clamp01(life.weak), k = amount === 'subtle' ? 0.6 : 1;
  if (life.phase === 'stable') return { intervalMs: 1350, gain: r3(0.13 * k), dubAt: 330, dubGain: r3(0.07 * k), jitter: 0.03 };
  const gain = lerp(0.16, 0.06, w) * (life.phase === 'down' ? 0.85 : 1) * k;
  return { intervalMs: Math.round(lerp(1500, 2500, w)), gain: r3(gain), dubAt: Math.round(lerp(360, 460, w)), dubGain: r3(gain * lerp(0.5, 0.2, w)),
    jitter: r3(life.phase === 'down' ? 0.08 : lerp(0.12, 0.38, w)) };
}
/** The wait before the next beat of a plan: uneven by its jitter, a dropped beat now and then when very weak. */
export function nextBeatMs(plan, random = Math.random) {
  const j = clamp01(plan?.jitter), base = Math.max(250, Number(plan?.intervalMs) || 1000);
  if (!j) return base;
  const skip = j > 0.2 && random() < (j - 0.2) * 0.6;
  return Math.round(base * (1 + j * (random() * 2 - 1)) * (skip ? 1.8 : 1));
}
/** The last beats as death comes: two or three fainter, slower ones, then none ([{ at, gain, dubAt, dubGain }]). */
export function heartbeatDeath(prev, { heart = true, on = true } = {}) {
  if (heart === false || on === false) return [];
  const g = Math.max(0.05, Number(prev?.gain) || 0.1);
  return [{ at: 0, gain: r3(g * 0.8), dubAt: 440, dubGain: r3(g * 0.25) }, { at: 1500, gain: r3(g * 0.45), dubAt: 520, dubGain: r3(g * 0.1) },
    { at: DEATH.beatFadeMs + 800, gain: r3(g * 0.2), dubAt: 0, dubGain: 0 }].filter((b) => b.at < DEATH.closeMs + DEATH.holdMs + DEATH.clearMs);
}

/**
 * The steps of a change between phases, or null when there is none to play: each { at (ms from now), look, ms (to ease
 * there), flash? ({ peak, ms }), muffle? ('release'|'hold') }. Waking (down to up): the dark lifts fast behind a bright
 * flash, the world released; death: closes to the dark, holds it ~2 s, then clears. to: the look to end on.
 */
export function transitionSteps(from, to, { look = NO_WOUND, quality = 'full' } = {}) {
  if (!from || !to || from === to || qualityRank(quality) === 0) return null;
  if (to === 'dead') {
    const dark = { ...NO_WOUND, dark: 0.98, window: 0.12, ...(qualityRank(quality) >= 2 ? { blur: 2.4, saturate: 0.15, brightness: 0.45 } : {}) };
    return [{ at: 0, look: dark, ms: DEATH.closeMs, muffle: 'hold' }, { at: DEATH.closeMs + DEATH.holdMs, look: { ...NO_WOUND }, ms: DEATH.clearMs, muffle: 'release' }];
  }
  if (to === 'up' && ['down', 'dying', 'stable'].includes(from)) return [{ at: 0, look: { ...look }, ms: WAKE.liftMs, flash: { peak: WAKE.flashPeak, ms: WAKE.flashMs }, muffle: 'release' }];
  return null;
}

/** The CSS background of the wound layer: a black closing-in window (down) over the red edges (hurt). '' when clear. */
export function woundGradient({ edge = 0, dark = 0, window: win = 1 } = {}) {
  const layers = [];
  if (dark > 0.004) {
    const inner = Math.round(clamp01(win) * 62), mid = Math.round(inner + (100 - inner) * 0.45);
    layers.push(`radial-gradient(ellipse at center, rgba(0,0,0,${r3(dark * 0.12)}) ${inner}%, rgba(2,0,0,${r3(dark * 0.78)}) ${mid}%, rgba(0,0,0,${r3(dark)}) 100%)`);
  }
  if (edge > 0.004) {
    const e = clamp01(edge), inner = Math.round(lerp(70, 34, e)), mid = Math.round(inner + (100 - inner) * 0.5);
    layers.push(`radial-gradient(ellipse at center, transparent ${inner}%, rgba(120,6,8,${r3(0.4 * e)}) ${mid}%, rgba(58,0,2,${r3(0.92 * Math.sqrt(e))}) 100%)`);
  }
  return layers.join(', ');
}
/** The board's look for the wound layer (lens-effects.mjs mergeBoard terms), or null when neutral. */
export function woundBoard(look) {
  if (!look) return null;
  const b = { blur: Number(look.blur) || 0, saturate: Number.isFinite(look.saturate) ? look.saturate : 1, brightness: Number.isFinite(look.brightness) ? look.brightness : 1 };
  return b.blur < 0.05 && Math.abs(b.saturate - 1) < 0.005 && Math.abs(b.brightness - 1) < 0.005 ? null : b;
}
/** A look between two (t 0..1, eased by the caller). */
export function mixWound(a, b, t) {
  const k = clamp01(t), out = {};
  for (const key of Object.keys(NO_WOUND)) out[key] = r3(lerp(a?.[key] ?? NO_WOUND[key], b?.[key] ?? NO_WOUND[key], k));
  return out;
}

// Stains: how many may stay at this HP, and how many one hit leaves.
/** How many stains stay on the lens at most at this HP share: none above half, more the lower; Subtle about half. */
export function stainCap(left, { amount = 'heavy' } = {}) {
  if (left == null || left > WOUNDED.from) return 0;
  const n = Math.round(lerp(3, 10, 1 - clamp01(left) / WOUNDED.from));
  return amount === 'subtle' ? Math.ceil(n / 2) : n;
}
/** How many stains one hit leaves: one while hurt, two at a quarter HP or under (Subtle one); none healthy. */
export function stainsPerHit(left, { amount = 'heavy' } = {}) {
  if (left == null || left > WOUNDED.from) return 0;
  return left <= WOUNDED.low && amount !== 'subtle' ? 2 : 1;
}

// A seeded random source (mulberry32 over a string hash), as lens-blood.mjs.
function rng(text) {
  let h = 1779033703 ^ String(text).length;
  for (let i = 0; i < String(text).length; i++) { h = Math.imul(h ^ String(text).charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const EDGES = ['left', 'right', 'top', 'bottom'];
/**
 * One small stain on the lens edge: a lens-blood.mjs splat (its shape and grain), placed just inside an edge (the
 * given one, else seeded), small, without drips or a reaction, to be drawn dried and still.
 */
export function stainSplat(seed, { width = 1, height = 1, edge = null, color } = {}) {
  const random = rng(`${seed}:stain`), short = Math.min(width, height);
  const pool = lensSplats(`${seed}:stain`, { amount: 'heavy', width, height, strength: 0.2, kind: 'dealt', color });
  const base = pool.find((s) => s.shape === 'blob' || s.shape === 'crown' || s.shape === 'spray') ?? pool[0];
  if (!base) return null;
  const side = EDGES.includes(edge) ? edge : EDGES[Math.floor(random() * 4)];
  const along = 0.06 + random() * 0.88, depth = (0.012 + Math.pow(random(), 1.6) * 0.06) * (side === 'left' || side === 'right' ? width : height);
  const x = side === 'left' ? depth : side === 'right' ? width - depth : along * width;
  const y = side === 'top' ? depth : side === 'bottom' ? height - depth : along * height;
  const r = Math.round(short * (0.011 + random() * 0.016) * 10) / 10;
  const { react: _react, ...rest } = base;
  return { ...rest, x: Math.round(x), y: Math.round(y), r, drips: [], delayMs: 0, lifeMs: Infinity, tone: r3(0.82 + random() * 0.18), edge: side };
}
/**
 * The stains after a hit taken at this HP: perHit new ones (seeded), each kept while HP stays at or under the
 * threshold it was made under (half, or a quarter); the oldest fade first past the cap. Answers a new list.
 */
export function stainsAfterHit(stains, { left, seed, now, width, height, edge = null, color, amount = 'heavy' } = {}) {
  const n = stainsPerHit(left, { amount });
  if (!n) return stains;
  const keepBelow = left <= WOUNDED.low ? WOUNDED.low : WOUNDED.from;
  const fresh = [];
  for (let i = 0; i < n; i++) {
    const splat = stainSplat(`${seed}:${i}`, { width, height, edge: i === 0 ? edge : null, color });
    if (splat) fresh.push({ id: `${seed}:${i}`, splat, bornAt: now, keepBelow, fadeAt: null });
  }
  return settleStains([...stains, ...fresh], { left, now, amount });
}
/**
 * The stains at this HP: each past its threshold (healed) or over the cap (oldest first) starts fading, one after
 * another; faded ones are gone. Answers the same list when nothing changes.
 */
export function settleStains(stains, { left, now, amount = 'heavy' } = {}) {
  let changed = false, stagger = 0;
  const cap = stainCap(left, { amount });
  const keeping = stains.filter((s) => s.fadeAt == null);
  const over = Math.max(0, keeping.length - cap), drop = new Set(keeping.slice(0, over));
  const out = [];
  for (const s of stains) {
    if (s.fadeAt != null && now - s.fadeAt >= WOUNDED.stainFadeMs) { changed = true; continue; }
    if (s.fadeAt == null && (drop.has(s) || left == null || left > s.keepBelow)) {
      out.push({ ...s, fadeAt: now + stagger });
      stagger += WOUNDED.stainStaggerMs;
      changed = true;
    } else out.push(s);
  }
  return changed ? out : stains;
}
/** A stain's alpha now: showing in as the hit dries, fading out once let go. */
export function stainAlpha(stain, now) {
  const born = smooth(0, WOUNDED.stainInMs, now - stain.bornAt);
  const gone = stain.fadeAt == null ? 0 : smooth(0, WOUNDED.stainFadeMs, now - stain.fadeAt);
  return r3(WOUNDED.stainAlpha * born * (1 - gone));
}
/** Whether a stain still changes (showing in or fading): the stain layer draws frames only then. */
export const stainMoving = (stain, now) => now - stain.bornAt < WOUNDED.stainInMs || (stain.fadeAt != null && now - stain.fadeAt < WOUNDED.stainFadeMs);
/** The still state a stain is drawn at (lens-blood.mjs splatState's shape): dried, no glint, no drips. */
export const stainState = (alpha) => ({ scale: 1, alpha, dry: 0.82, highlight: 0, drips: [], done: false, sx: 1, sy: 1, spin: 0, ox: 0, oy: 0, ghost: null, aura: 0, t: 1e6, age: 1e6 });

/**
 * The states the showcase can preview, by system, with its own labels: [{ id, label, facts }] (lifeOf's facts at 0
 * HP). PF2e/SF2e: Dying 1-3; D&D 5e: death saves; Daggerheart: the last Hit Point, the death move.
 */
export function downPreviews(systemId) {
  const hp = { value: 0, max: 100, down: true, marked: false };
  const at = (facts) => ({ systemId, hp, statuses: [], ...facts });
  if (systemId === 'pf2e' || systemId === 'sf2e') return [
    { id: 'dying1', label: 'Dying 1', facts: at({ dying: { value: 1, max: 4 }, statuses: ['dying', 'unconscious'] }) },
    { id: 'dying2', label: 'Dying 2', facts: at({ dying: { value: 2, max: 4 }, statuses: ['dying', 'unconscious'] }) },
    { id: 'dying3', label: 'Dying 3', facts: at({ dying: { value: 3, max: 4 }, statuses: ['dying', 'unconscious'] }) },
    { id: 'unconscious', label: 'Unconscious', facts: at({ statuses: ['unconscious'] }) },
    { id: 'stable', label: 'Stable', facts: at({ statuses: ['unconscious', 'stable'] }) },
    { id: 'dead', label: 'Dead', facts: at({ dying: { value: 4, max: 4 }, statuses: ['dead'] }) }];
  if (systemId === 'dnd5e') return [
    { id: 'dying1', label: 'Dying, no failures', facts: at({ death: { success: 0, failure: 0 } }) },
    { id: 'dying2', label: '1 failure', facts: at({ death: { success: 0, failure: 1 } }) },
    { id: 'dying3', label: '2 failures', facts: at({ death: { success: 0, failure: 2 } }) },
    { id: 'unconscious', label: 'Unconscious', facts: at({ hp: { value: 5, max: 100, down: false, marked: false }, statuses: ['unconscious'] }) },
    { id: 'stable', label: 'Stable', facts: at({ statuses: ['stable'], death: { success: 3, failure: 0 } }) },
    { id: 'dead', label: '3 failures (dead)', facts: at({ death: { success: 0, failure: 3 } }) }];
  if (systemId === 'daggerheart') {
    const marked = { value: 6, max: 6, down: true, marked: true };
    return [
      { id: 'dying1', label: 'Last Hit Point marked', facts: { systemId, hp: marked, statuses: [] } },
      { id: 'dying2', label: 'Death move', facts: { systemId, hp: marked, statuses: ['deathMove'] } },
      { id: 'unconscious', label: 'Unconscious (Avoid Death)', facts: { systemId, hp: marked, statuses: ['unconscious'] } },
      { id: 'dead', label: 'Dead', facts: { systemId, hp: marked, statuses: ['dead'] } }];
  }
  return [
    { id: 'dying1', label: 'Dying', facts: at({ statuses: ['dying'] }) },
    { id: 'unconscious', label: 'Unconscious', facts: at({ statuses: ['unconscious'] }) },
    { id: 'stable', label: 'Stable', facts: at({ statuses: ['unconscious', 'stable'] }) },
    { id: 'dead', label: 'Dead', facts: at({ statuses: ['dead'] }) }];
}
