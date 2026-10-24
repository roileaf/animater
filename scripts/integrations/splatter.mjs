// Splatter (theripper93) paints blood where a creature is hurt. With "Splatter: blood follows the
// damage" on, Animater tells it how much: the damage type sets how hard a wound bleeds (a sword cut
// more than a burn, a mind blast not at all), critical hits and killing blows bleed more, and a kill's
// blood waits for its Finish Him! screen. Splatter keeps the creature's own blood color.
import { normalizeDamageType } from '../engines/playback/damage-moments.mjs';

export const SPLATTER_ID = 'splatter', SPLATTER_SYNC = 'splatterSync';
// How hard each damage type bleeds, against Splatter's own splat (1). Types not listed bleed as 1.
const BLEED = {
  slashing: 1.3, bleed: 1.3, piercing: 1.1, bludgeoning: 0.8, force: 0.8,
  sonic: 0.6, acid: 0.6, void: 0.5, cold: 0.5, poison: 0.4, electricity: 0.4,
  fire: 0.3, vitality: 0.2, mental: 0, spirit: 0,
};
export const CRIT_BLEED = 1.5, KILL_BLEED = 1.5;
export const bleedOf = (type) => BLEED[normalizeDamageType(type)] ?? 1;

// Splatter is on and answers its splat call.
export function splatterReady(game = globalThis.game, config = globalThis.CONFIG) {
  return Boolean(game?.modules?.get(SPLATTER_ID)?.active && typeof config?.Splatter?.splat === 'function');
}
// Splatter's own switches: its blood is on, and when it bleeds only in combat, a combat is running.
// get(key, fallback) reads a Splatter setting.
export function splatterOn(get, combat) {
  return get('enableBloodsplatter', true) !== false && !(get('onlyInCombat', false) && !combat?.started);
}
// Splatter's size for a token: texture scale × its larger side, in grid squares.
export const tokenSize = (doc) => ((Math.abs(doc?.texture?.scaleX ?? 1) + Math.abs(doc?.texture?.scaleY ?? 1)) / 2) * Math.max(doc?.width ?? 1, doc?.height ?? 1);
// The splat's scale for an HP change (hp-state.mjs states before and after), or 0 for none. Splatter's
// own measure (HP lost / max + 0.7, times the token's size) times the bleed. Like Splatter, it bleeds only
// once the creature is at or below threshold percent of its HP (a marked track counts what is unmarked).
export function splatScale({ before, after, type, crit = false, size = 1, threshold = 100 }) {
  if (!before || !after || !(after.max > 0)) return 0;
  const lost = Math.abs(after.value - before.value);
  const left = after.marked ? (after.max - after.value) / after.max : after.value / after.max;
  if (!(lost > 0) || 100 * left > threshold) return 0;
  const bleed = bleedOf(type) * (crit ? CRIT_BLEED : 1) * (after.down ? KILL_BLEED : 1);
  return bleed > 0 ? size * (lost / after.max + 0.7) * bleed : 0;
}
