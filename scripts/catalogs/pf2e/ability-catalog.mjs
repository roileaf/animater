import {catalogDataNeeded} from '../shared/catalog-data.mjs';
// PF2e ability catalogs that are not feats: basic/skill/class actions (packs/actions)
// and class/ancestry features. Same entry shape and choreography as PF2e feats
// (featRecipe), with their own native packs, settings and enable/exclude state.
const {PF2E_ACTIONS, PF2E_ACTION_SOURCE} = catalogDataNeeded('pf2e') ? await import('../../../data/pf2e-actions.mjs') : {PF2E_ACTIONS: [], PF2E_ACTION_SOURCE: {}};
const {PF2E_CLASS_FEATURES, PF2E_CLASS_FEATURE_SOURCE} = catalogDataNeeded('pf2e') ? await import('../../../data/pf2e-class-features.mjs') : {PF2E_CLASS_FEATURES: [], PF2E_CLASS_FEATURE_SOURCE: {}};
import { normalize, matchRecipe, ownRecipe } from "../../core/model.mjs";
import { featRecipe } from "./feats/feat-choreography.mjs";
import { withElementChoice } from "../shared/element-choice.mjs";
export { PF2E_ACTIONS, PF2E_ACTION_SOURCE, PF2E_CLASS_FEATURES, PF2E_CLASS_FEATURE_SOURCE };

// A melee use of a ranged-looking action (a melee Elemental Blast): the thrower lunges instead, and
// the projectile becomes an elemental strike reaching from the kineticist to the target.
const MELEE_STRIKE = ["jb2a.unarmed_strike.magical.01.blue", "jb2a.unarmed_strike.magical.02.blue"];
function meleeLook(recipe) {
  return { ...recipe, id: `${recipe.id}-melee`, stages: recipe.stages.map((s) =>
    s.kind === "motion" && s.subject === "source" && s.motion === "throw" ? { ...s, motion: "lunge", label: "Lunge into the strike" }
      // Its per-element projectiles would replace the strike; the strike takes the element's tint instead.
      : s.kind === "travel" ? { ...s, assets: [...MELEE_STRIKE], elementAssets: undefined, label: "Elemental strike" } : s) };
}
export function createAbilityCatalog({ entries, source, recipeKind, label, packs, matchesItem }) {
  const byId = new Map(entries.map(entry => [entry.id, entry])), byName = new Map();
  for (const entry of [...entries].sort((a,b) => Number(a.edition === "legacy") - Number(b.edition === "legacy")))
    for (const name of [entry.name, entry.slug]) if (!byName.has(normalize(name))) byName.set(normalize(name), entry);
  const prefix = new RegExp(`^(?:pf2e|sf2e)-${recipeKind}-`);
  const entry = id => byId.get(String(id).replace(prefix, "")) ?? null;
  function normalizeState(state = {}) {
    state ??= {};
    const ids = values => [...new Set((Array.isArray(values) ? values : []).map(id => entry(id)?.id).filter(Boolean))];
    return { enabled: state.enabled === true, independent: state.independent === true,
      scope: state.scope === "selected" ? "selected" : "all", selected: ids(state.selected), excluded: ids(state.excluded), customized: ids(state.customized),
      preferCatalog: state.preferCatalog === true, motion: state.motion !== false, sound: state.sound !== false,
      soundVolume: Number.isFinite(Number(state.soundVolume)) ? Math.max(0,Math.min(1,Number(state.soundVolume))) : 0.35 };
  }
  const enabled = (id, state) => state?.enabled === true && !state.excluded?.includes(id) && (state.scope !== "selected" || state.selected?.includes(id) === true);
  function use(state, id) {
    state = normalizeState(state); id = entry(id)?.id;
    if (!id) throw Error(`Choose a catalog ${label} first.`);
    return normalizeState({ ...state, enabled: true, independent: true, scope: state.enabled ? state.scope : "selected",
      selected: state.enabled ? [...state.selected,id] : [id], excluded: state.excluded.filter(value => value !== id), customized: state.customized.filter(value => value !== id) });
  }
  function find(event) {
    const item = event?.item;
    if (!item || !matchesItem(item)) return null;
    for (const uuid of [item.uuid, item.original?.uuid, item.sourceId, item._stats?.compendiumSource, item.flags?.core?.sourceId, event.itemUuid]) {
      if (!packs.some(pack => uuid?.startsWith(`Compendium.pf2e.${pack}.`))) continue;
      const found = byId.get(uuid.split(".").at(-1)); if (found) return found;
    }
    return byName.get(normalize(item.system?.slug ?? item.slug)) ?? byName.get(normalize(item.name)) ?? null;
  }
  const recipe = (found, state = {}, soundCatalog, event = null) => {
    let built = featRecipe(found, { motion: state.motion !== false, soundCatalog: state.sound === false ? null : soundCatalog, soundVolume: state.soundVolume });
    if (found.meleeLook && event?.weaponMode === "melee") built = meleeLook(built);
    return found.elementChoice ? withElementChoice(built) : built;
  };
  function automaticRecipe(event, state, customRecipes = [], soundCatalog) {
    const found = find(event);
    if (!found || found.rider || !enabled(found.id,state) || found.trigger !== event.type) return null;
    if (customRecipes.some(saved => !saved.enabled && matchRecipe([{...saved, enabled:true}],event))) return null;
    return recipe(found, state, soundCatalog, event);
  }
  function resolveAutomaticRecipe(event, state, customRecipes = [], { customEnabled = true, soundCatalog } = {}) {
    state = normalizeState(state);
    const found = find(event);
    if (found && enabled(found.id,state) && (state.selected.includes(found.id) || (state.preferCatalog && !state.customized.includes(found.id) && !ownRecipe(customEnabled ? customRecipes : [], found?.uuid && !event.itemUuid ? { ...event, itemUuid: found.uuid } : event))))
      return automaticRecipe(event,state,[],soundCatalog);
    const configured = customEnabled || (found && state.enabled && !state.excluded.includes(found.id) && state.customized.includes(found.id)) ? customRecipes : [];
    // An action rolled as a skill check (Demoralize, Shove) has a stand-in item with no uuid: your
    // copy, bound to the entry's uuid, still matches (and, paused, still silences the default).
    const keyed = found?.uuid && !event.itemUuid ? { ...event, itemUuid: found.uuid } : event;
    return matchRecipe(configured,keyed) ?? automaticRecipe(keyed,state,configured,soundCatalog);
  }
  function filter({search="",level="all",activity="all",actionType=activity,activation=actionType,category="all",classTrait="all",theme="all",quality="all",edition="all"} = {}) {
    const query = normalize(search);
    return entries.filter(e => (level === "all" || e.level === Number(level)) && (activation === "all" || e.actionType === activation) &&
      (category === "all" || e.category === category) && (classTrait === "all" || e.classTraits.includes(classTrait)) && (theme === "all" || e.theme === theme) &&
      (quality === "all" || e.quality === quality) && (edition === "all" || e.edition === edition) &&
      (!query || normalize(`${e.name} ${e.slug} ${e.traits.join(" ")} ${e.publication} ${e.rationale}`).includes(query)));
  }
  return { entries, source, recipeKind, label, entry, normalizeState, enabled, use, find, recipe, automaticRecipe, resolveAutomaticRecipe, filter };
}

// Actions that play as attack rolls and look like the element rolled: Elemental Blast is a Strike
// in an element (its roll carries element:fire, element:water…). The built entry only knows a use.
const ROLLED_ELEMENTAL = new Set(["elemental-blast"]);
for (const entry of PF2E_ACTIONS) if (ROLLED_ELEMENTAL.has(entry.slug)) Object.assign(entry, { trigger: "attack", elementChoice: true, meleeLook: true });
export const PF2E_ACTION_CATALOG = createAbilityCatalog({ entries: PF2E_ACTIONS, source: PF2E_ACTION_SOURCE, recipeKind: "action", label: "action",
  packs: ["actionspf2e"], matchesItem: item => item.type === "action" });
const FEATURE_CATEGORIES = new Set(["classfeature", "ancestryfeature"]);
export const PF2E_FEATURE_CATALOG = createAbilityCatalog({ entries: PF2E_CLASS_FEATURES, source: PF2E_CLASS_FEATURE_SOURCE, recipeKind: "feature", label: "feature",
  packs: ["classfeatures", "ancestryfeatures"], matchesItem: item => item.type === "feat" && FEATURE_CATEGORIES.has(item.system?.category ?? item.category) });
export const isFeatureItem = item => item?.type === "feat" && FEATURE_CATEGORIES.has(item.system?.category ?? item.category);

// Damage riders: passive features that add dice/modifiers to a Strike's damage roll.
// PF2e writes every damage roll's dice and modifiers (with their enabled state) to
// message.flags.pf2e.dice / .modifiers (src/module/system/damage/damage.ts); a
// DamageDice rule element without a slug takes its item's slug (Sneak Attack →
// "sneak-attack"). The adapter turns them into event.damageSlugs ("dice:<slug>",
// "modifier:<slug>").
export const RIDER_SIGNALS = {
  "sneak-attack": ["dice:sneak-attack"],
  "precise-strike": ["modifier:precise-strike", "dice:finisher"],
  precision: ["dice:precision"],
};
export function findRiders(event) {
  if (event?.type !== "damage" || !event.damageSlugs?.length) return [];
  const slugs = new Set(event.damageSlugs);
  return PF2E_CLASS_FEATURES.filter(entry => entry.rider && RIDER_SIGNALS[entry.rider]?.some(signal => slugs.has(signal)));
}
// Rider recipes for one damage event, played alongside the weapon's own recipe.
export function riderRecipes(event, state, customRecipes = [], { customEnabled = true, soundCatalog } = {}) {
  state = PF2E_FEATURE_CATALOG.normalizeState(state);
  return findRiders(event).flatMap(rider => {
    const riderEvent = { ...event, item: { type: "feat", name: rider.name, slug: rider.slug, uuid: rider.uuid, system: { slug: rider.slug, category: rider.category } }, itemUuid: rider.uuid };
    const custom = customEnabled || (state.enabled && state.customized.includes(rider.id)) ? matchRecipe(customRecipes, riderEvent) : null;
    const preferCatalog = PF2E_FEATURE_CATALOG.enabled(rider.id, state) && (state.selected.includes(rider.id) || state.preferCatalog && !state.customized.includes(rider.id));
    if (custom && !preferCatalog) return [custom];
    return PF2E_FEATURE_CATALOG.enabled(rider.id, state) ? [PF2E_FEATURE_CATALOG.recipe(rider, state, soundCatalog)] : [];
  });
}
