// Splatter (theripper93) paints blood where a creature is hurt. With "Splatter: blood follows the
// damage" on, Animater tells it how much: the damage type sets how hard a wound bleeds (a sword cut
// more than a burn, a mind blast not at all), critical hits and killing blows bleed more, and a kill's
// blood waits for its Finish Him! screen. Splatter keeps the creature's own blood color.
import { normalizeDamageType } from '../engines/playback/damage-moments.mjs';
import { bloodFor } from '../engines/motion/blood-colors.mjs';

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

// Splatter's own idea of a creature's blood (read from Splatter 7.0.0, BloodSplatter.getBloodColor), so lens blood
// bleeds what Splatter bleeds, in its colour. Its order: the token's flags.splatter.bloodColor; then, with "Use Blood
// Sheet" on, the BloodSheetData colour for the creature type (an exact key, else the first key the type contains; for
// a list of types, such as PF2e traits, the last one listed on the sheet); then the world "bloodColor". Colours are
// '#rrggbb' or '#rrggbbaa'; an alpha of 0 is how a creature gets no blood.
export function splatterColorOf(text) {
  const m = /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(String(text ?? '').trim());
  return m ? { color: parseInt(m[1], 16), alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 } : null;
}
// { bleeds, color, alpha } from Splatter's data, or null when none of it gives a colour.
export function splatterBloodFrom({ flag, useBloodsheet = false, sheet = {}, creatureType, defaultColor } = {}) {
  const pick = () => {
    if (flag) return flag;
    if (useBloodsheet && sheet && creatureType) {
      if (Array.isArray(creatureType)) {
        let found;
        for (const type of creatureType) if (sheet[type]) found = sheet[type];
        if (found) return found;
      } else if (typeof creatureType === 'string') {
        const key = sheet[creatureType] ? creatureType : Object.keys(sheet).find((k) => creatureType.includes(k));
        if (key) return sheet[key];
      }
    }
    return defaultColor;
  };
  const c = splatterColorOf(pick());
  return c ? { bleeds: c.alpha > 0, color: c.color, alpha: c.alpha } : null;
}
// The creature type Splatter reads: its custom path when set there, else its type path, else the actor's type.
export function splatterCreatureType(actor, { typePath = '', customPath = '' } = {}, getProperty) {
  const at = (path) => (path ? getProperty(actor?.system ?? {}, path) : undefined);
  return at(customPath) || (at(typePath) ?? actor?.type);
}
// A token's blood by Splatter's rules, or null while Splatter is not active or its settings cannot be read
// (then Animater's own bleedsBlood and bloodColor decide). setting(key) reads a Splatter setting.
export function splatterBlood(token, { active, setting, getProperty }) {
  if (!active) return null;
  try {
    const actor = token?.actor ?? null;
    const useBloodsheet = setting('useBloodsheet') === true;
    return splatterBloodFrom({
      flag: token?.document?.flags?.splatter?.bloodColor,
      useBloodsheet, sheet: setting('BloodSheetData') ?? {},
      creatureType: useBloodsheet && actor ? splatterCreatureType(actor, { typePath: setting('creatureType'), customPath: setting('creatureTypeCustom') }, getProperty) : undefined,
      defaultColor: setting('bloodColor'),
    });
  } catch { return null; }
}
// A token's blood wherever Animater draws it (lens blood, blood drops, the damage showcase): Splatter's rules while it
// is active, else Animater's own (engines/motion/blood-colors.mjs bloodFor: the token's override, then the GM's Blood
// colours table by creature type). token: a placeable ({ actor, document }) or a TokenDocument; system: game.system.id;
// table: the world "bloodColors" setting.
export function creatureBlood(token, { active, setting, getProperty, system, table } = {}) {
  const doc = token?.document ?? token, actor = token?.actor ?? doc?.actor ?? null;
  const splat = splatterBlood({ actor, document: doc }, { active, setting, getProperty });
  if (splat) return splat;
  const own = bloodFor({ system, actor, name: doc?.name ?? token?.name, tokenFlags: doc?.flags, table });
  return { bleeds: own.bleeds, color: own.color, alpha: 1 };
}
