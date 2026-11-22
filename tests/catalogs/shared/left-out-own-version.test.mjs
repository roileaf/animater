// "Leave out of Plug & play" leaves out the catalog's own animation. A version the GM customized for that
// entry is the GM's: it keeps playing, with "Play my own recipes automatically" off, until it is paused.
import test from "node:test";
import assert from "node:assert/strict";
import { dndEntries, dndRecipe, findDndEntry, resolveDndAutomaticRecipe } from "../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";
import { sfEntries, sfRecipe, findSfEntry, resolveSfAutomaticRecipe } from "../../../scripts/catalogs/sf2e/sf2e-catalog.mjs";
import { dhEntries, dhRecipe, findDhEntry, resolveDaggerheartAutomaticRecipe } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { dsEntries, dsRecipe, findDsEntry, resolveDrawSteelAutomaticRecipe } from "../../../scripts/catalogs/draw-steel/draw-steel-catalog.mjs";
import { PF2E_SPELLS, spellRecipe, findCatalogSpell, resolveAutomaticRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe, findCatalogFeat, resolveAutomaticFeatRecipe } from "../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe, findCatalogWeapon, resolveAutomaticWeaponRecipe } from "../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_ACTIONS } from "../../../scripts/catalogs/pf2e/ability-catalog.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";

const on = { enabled: true, independent: true, preferCatalog: true, scope: "all", selected: [], excluded: [], customized: [] };
const mine = (recipe) => ({ ...validateRecipe(recipe), name: "Mine" });

// Each case: the catalog entry's id, the id its customization is kept under, an event that entry plays for,
// its recipe as Customize saves it, and how that system resolves an event.
function cases() {
  const guardians = dndEntries("spell").find((e) => e.name === "Spirit Guardians" && e.edition === "2024"), area = guardians.variants.find((v) => v.recipe.trigger === "template");
  const activity = { id: area.activityId, type: area.activityType, name: area.activityName };
  const supercharge = sfEntries("spell").find((e) => e.name === "Supercharge Weapon"), sfBase = sfRecipe(supercharge);
  const card = dhEntries("card").find((e) => e.uuid && e.variants.some((v) => v.recipe.trigger === "use")), cardVariant = card.variants.find((v) => v.recipe.trigger === "use");
  const ability = dsEntries("ability").find((e) => !e.generic && e.variants.some((v) => v.recipe.trigger === "use")), abilityVariant = ability.variants.find((v) => v.recipe.trigger === "use");
  const frost = PF2E_SPELLS.find((s) => s.name === "Frostbite" && s.edition === "remaster") ?? PF2E_SPELLS.find((s) => s.name === "Frostbite");
  const medicine = PF2E_FEATS.find((f) => f.name === "Battle Medicine");
  const dagger = PF2E_WEAPONS.find((w) => w.slug === "dagger");
  const rage = PF2E_ACTIONS.find((e) => e.name === "Rage");
  return [
    { system: "D&D 5e", id: guardians.id, find: findDndEntry, recipe: dndRecipe(guardians, area.id),
      event: { type: "template", systemId: "dnd5e", activity, activityId: activity.id, activityName: activity.name, item: { type: "spell", name: guardians.name, uuid: "Actor.a.Item.b", _stats: { compendiumSource: guardians.uuid }, system: { activities: new Map([[activity.id, activity]]) } } },
      resolve: (event, state, saved) => resolveDndAutomaticRecipe(event, () => state, saved, { customEnabled: false }) },
    { system: "SF2e", id: supercharge.id, find: findSfEntry, recipe: sfBase,
      event: { type: sfBase.trigger, systemId: "sf2e", item: { id: "owned", uuid: "Actor.a.Item.owned", type: supercharge.nativeType, name: supercharge.name, slug: supercharge.slug, sourceId: supercharge.uuid, system: {} } },
      resolve: (event, state, saved) => resolveSfAutomaticRecipe(event, () => state, saved, { customEnabled: false }) },
    { system: "Daggerheart", id: card.id, find: findDhEntry, recipe: dhRecipe(card, cardVariant.id),
      event: { type: "use", systemId: "daggerheart", item: { type: "domainCard", name: card.name, uuid: "Actor.a.Item.b", _stats: { compendiumSource: card.uuid } } },
      resolve: (event, state, saved) => resolveDaggerheartAutomaticRecipe(event, () => state, saved, { customEnabled: false }) },
    { system: "Draw Steel", id: ability.id, find: findDsEntry, recipe: dsRecipe(ability, abilityVariant.id),
      event: { type: "use", systemId: "draw-steel", item: { type: "ability", name: ability.name, uuid: "Actor.a.Item.b", _stats: { compendiumSource: ability.uuid }, system: {} } },
      resolve: (event, state, saved) => resolveDrawSteelAutomaticRecipe(event, () => state, saved, { customEnabled: false }) },
    { system: "PF2e spells", id: frost.id, find: findCatalogSpell, recipe: spellRecipe(frost),
      event: { type: frost.trigger, item: { type: "spell", name: frost.name, system: { slug: frost.slug }, _stats: { compendiumSource: `Compendium.pf2e.spells-srd.Item.${frost.id}` } } },
      resolve: (event, state, saved) => resolveAutomaticRecipe(event, state, saved, { customEnabled: false }) },
    { system: "PF2e feats", id: medicine.id, find: findCatalogFeat, recipe: featRecipe(medicine),
      event: { type: "use", item: { type: "feat", name: medicine.name, system: { slug: medicine.slug, actionType: { value: medicine.actionType } }, _stats: { compendiumSource: `Compendium.pf2e.feats-srd.Item.${medicine.id}` } } },
      resolve: (event, state, saved) => resolveAutomaticFeatRecipe(event, state, saved, { customEnabled: false }) },
    { system: "PF2e weapons", id: dagger.id, key: `${dagger.id}:melee`, find: findCatalogWeapon, recipe: weaponRecipe(dagger, "melee"),
      event: { type: "attack", weaponMode: "melee", item: { type: "weapon", name: dagger.name, system: { slug: dagger.slug }, _stats: { compendiumSource: `Compendium.pf2e.equipment-srd.Item.${dagger.id}` } } },
      resolve: (event, state, saved) => resolveAutomaticWeaponRecipe(event, state, saved, { customEnabled: false }) },
    { system: "PF2e actions", id: rage.id, find: PF2E_ACTION_CATALOG.find, recipe: PF2E_ACTION_CATALOG.recipe(rage),
      event: { type: "use", systemId: "pf2e", item: { type: "action", name: rage.name, system: { slug: rage.slug }, _stats: { compendiumSource: rage.uuid } } },
      resolve: (event, state, saved) => PF2E_ACTION_CATALOG.resolveAutomaticRecipe(event, state, saved, { customEnabled: false }) },
  ];
}

for (const c of cases()) {
  test(`${c.system}: a customized entry left out of Plug & play still plays the GM's version`, () => {
    assert.equal(c.find(c.event)?.id, c.id, "the event is this entry's");
    const own = mine(c.recipe), leftOut = { ...on, excluded: [c.id] }, customized = { ...leftOut, customized: [c.key ?? c.id] };
    assert.ok(c.resolve({ ...c.event }, on, []), "the catalog plays it while it is in");
    assert.equal(c.resolve({ ...c.event }, customized, [own])?.name, "Mine", "left out: the GM's version plays");
    assert.equal(c.resolve({ ...c.event }, leftOut, [own]), null, "left out and never customized: nothing plays");
    assert.equal(c.resolve({ ...c.event }, customized, [{ ...own, enabled: false }]), null, "left out and paused: nothing plays");
    assert.equal(c.resolve({ ...c.event }, { ...customized, enabled: false }, [own]), null, "the catalog switched off: nothing plays");
  });
}

test("the catalog card of a left-out entry says the GM's customized version plays", async () => {
  const { DndCatalogWorkspace } = await import("../../../scripts/ui/dnd5e-catalog-ui.mjs");
  const entry = { id: "e" }, recipe = { trigger: "template" }, state = { ...on, excluded: ["e"], customized: ["e"] };
  const card = (extra) => DndCatalogWorkspace.prototype.statusHTML({ entry, recipe, state, using: false, persistent: false, automatic: true, canUse: true, ...extra });
  assert.match(card({ saved: { enabled: true } }), /Your version plays/);
  assert.match(card({ saved: { enabled: true } }), /Put back in Plug &amp; play|Put back in Plug & play/);
  assert.match(card({ saved: { enabled: false } }), /Your version is paused/);
  assert.match(card({ saved: null }), /Left out of Plug/);
  assert.match(card({ saved: { enabled: true }, state: { ...state, customized: [] } }), /Left out of Plug/);
});
