// Quiet sneaking: a creature moving stealthily steps softer, slower and duller, and only a huge one still thuds.
// Pure: main.mjs reads the token and actor (PF2e/SF2e exploration activities and effects, PF2e Visioner's sneak flag,
// D&D 5e's Hiding status) and asks here.

// PF2e/SF2e: the Avoid Notice exploration activity (an action item whose id is in actor.system.exploration, slug
// 'avoid-notice'), or an effect for Sneak or Avoid Notice.
const SNEAK_SLUGS = new Set(['avoid-notice', 'effect-avoid-notice', 'sneak', 'effect-sneak', 'effect-sneaking', 'sneaking']);
// D&D 5e's Hiding status (CONFIG.statusEffects 'hiding'); other systems that mark a mover 'hidden'. PF2e's Hidden is
// how an observer perceives it, not how it moves, so it does not count there.
const HIDING_STATUSES = ['hiding', 'hidden'];
const PF2E = new Set(['pf2e', 'sf2e']);

const has = (list, value) => {
  if (!list) return false;
  if (typeof list.has === 'function') return list.has(value);
  return Array.isArray(list) && list.includes(value);
};

/**
 * Whether a creature moves stealthily. `system` the game system id; `statuses` its actor's statuses (Set or array);
 * `slugs` its effects' and actions' slugs; `exploration` the slugs of its chosen exploration activities;
 * `visionerSneak` PF2e Visioner's token flag 'sneak-active'; `inCombat` (exploration activities end at initiative).
 */
export function isSneaking({ system = '', statuses = [], slugs = [], exploration = [], visionerSneak = false, inCombat = false } = {}) {
  if (visionerSneak) return true;
  if (PF2E.has(system)) {
    for (const slug of slugs ?? []) if (SNEAK_SLUGS.has(String(slug))) return true;
    if (!inCombat) for (const slug of exploration ?? []) if (String(slug) === 'avoid-notice') return true;
    return false;
  }
  return HIDING_STATUSES.some((s) => has(statuses, s));
}

// How much softer, slower and duller a sneaking step is; below Huge (weight 4) there is no thud under it.
export const SNEAK_STEP = Object.freeze({ gain: 0.45, gap: 1.3, lowpass: 2500, thudFrom: 4 });

/** A sneaking step's shaping for a creature of `weight` (stepWeight): its gain, beat scale, low-pass and whether it still thuds. */
export function sneakStep(weight) {
  return { gain: SNEAK_STEP.gain, gap: SNEAK_STEP.gap, lowpass: SNEAK_STEP.lowpass, thud: Number(weight) >= SNEAK_STEP.thudFrom };
}

/** Joins a sneaking low-pass with one a sound already has: the darker of the two. */
export const darker = (a, b) => (a > 0 && b > 0 ? Math.min(a, b) : a > 0 ? a : b > 0 ? b : null);
