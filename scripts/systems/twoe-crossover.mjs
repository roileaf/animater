// PF2e and SF2e share one rules engine, so a world of one can borrow the other's catalogs
// (Starfinder Anachronism guns and tech in a PF2e game, or PF2e magic in an SF2e game).
import { resolveAutomaticRecipe } from "../catalogs/pf2e/spells/spell-catalog.mjs";
import { resolveAutomaticFeatRecipe } from "../catalogs/pf2e/feats/feat-catalog.mjs";
import { resolveAutomaticWeaponRecipe } from "../catalogs/pf2e/weapons/weapon-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG, isFeatureItem } from "../catalogs/pf2e/ability-catalog.mjs";
import { resolveSfAutomaticRecipe } from "../catalogs/sf2e/sf2e-catalog.mjs";
import { sfSettingKey } from "../catalogs/shared/catalog-system.mjs";

export const CROSSOVER_CATALOG = "crossoverCatalog";
export const TWOE_KINDS = ["spell", "feat", "action", "feature", "weapon"];
const PF2E_KEYS = { spell: "spellCatalog", feat: "featCatalog", action: "actionCatalog", feature: "featureCatalog", weapon: "weaponCatalog" };
const PF2E_ABILITY = { action: PF2E_ACTION_CATALOG, feature: PF2E_FEATURE_CATALOG };
const LABELS = { pf2e: "PF2e", sf2e: "SF2e" };

export const crossoverSystem = (systemId) => ({ pf2e: "sf2e", sf2e: "pf2e" })[systemId] ?? null;
// The world setting holding `kind`'s catalog state in a 2e world.
export const twoeSettingKey = (systemId, kind) => (systemId === "sf2e" ? sfSettingKey(kind) : PF2E_KEYS[kind] ?? null);
export function crossoverSettingText(systemId) {
  const other = LABELS[crossoverSystem(systemId)] ?? "other 2e";
  return {
    name: `Also use the ${other} catalogs`,
    hint: `Items none of this world's recipes or catalogs know, such as ${systemId === "pf2e" ? "Starfinder Anachronism guns and tech" : "Pathfinder spells, feats and weapons"}, play their ${other} catalog animation. The ${other} spell, feat, action, feature and weapon catalogs appear in Animater under Borrowed from ${other}, where you can turn them on, exclude entries or customize them.`,
  };
}
// Turning crossover on: a borrowed catalog nobody has set up yet starts like this world's catalog
// of the same kind (on for every entry, same motion and sound), or null to leave it.
export function seedBorrowedState(own, borrowed) {
  borrowed ??= {};
  const untouched = borrowed.enabled !== true && ![borrowed.selected, borrowed.excluded, borrowed.customized].some((ids) => ids?.length);
  const start = crossoverState(own);
  if (!untouched || !start.enabled) return null;
  return { ...borrowed, enabled: true, independent: true, scope: "all", preferCatalog: own?.preferCatalog === true, motion: start.motion, sound: start.sound, soundVolume: start.soundVolume };
}
// This world's catalog as a starting point for a borrowed one. Its picks and exclusions name this
// system's entries, so the borrowed one starts on for all of its entries or none.
export function crossoverState(own) {
  own ??= {};
  return { enabled: own.enabled === true && own.scope !== "selected", independent: true, scope: "all", selected: [], excluded: [], customized: [],
    preferCatalog: false, motion: own.motion !== false, sound: own.sound !== false, soundVolume: Number.isFinite(Number(own.soundVolume)) ? Number(own.soundVolume) : 0.35 };
}
// The PF2e or SF2e catalog recipe for an event (saved recipes first, as each catalog decides).
export function twoeCatalogRecipe(systemId, event, saved = [], { stateFor, customEnabled = true, sounds } = {}) {
  if (systemId === "sf2e") return resolveSfAutomaticRecipe(event, stateFor, saved, { customEnabled, sounds }) ?? null;
  if (systemId !== "pf2e") return null;
  const item = event.item, ability = item?.type === "action" ? "action" : isFeatureItem(item) ? "feature" : null;
  const options = { customEnabled, soundCatalog: sounds };
  if (ability) return PF2E_ABILITY[ability].resolveAutomaticRecipe(event, stateFor(ability), saved, options) ?? null;
  if (item?.type === "weapon") return resolveAutomaticWeaponRecipe(event, stateFor("weapon"), saved, options) ?? null;
  // An NPC Strike the weapon catalog knows plays like that weapon; other NPC attacks keep their saved recipes.
  if (item?.type === "melee") { const strike = resolveAutomaticWeaponRecipe(event, stateFor("weapon"), saved, options); if (strike) return strike; }
  if (item?.type === "feat") return resolveAutomaticFeatRecipe(event, stateFor("feat"), saved, options) ?? null;
  return resolveAutomaticRecipe(event, stateFor("spell"), saved, options) ?? null;
}
// This world's recipe for the event; with crossover on, an item this world knows nothing about
// (no saved recipe, even a disabled one, and no catalog entry) falls back to the other 2e catalog.
export function crossoverResolve(event, { systemId, on, resolve, knows }) {
  const own = resolve(systemId, event);
  if (own || !on) return own ?? null;
  const other = crossoverSystem(systemId);
  if (!other || knows(event)) return null;
  return resolve(other, { ...event, systemId: other }) ?? null;
}
