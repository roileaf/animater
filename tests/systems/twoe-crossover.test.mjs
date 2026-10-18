import test from "node:test";
import assert from "node:assert/strict";
import { crossoverSystem, crossoverState, crossoverResolve, twoeCatalogRecipe, twoeSettingKey, seedBorrowedState } from "../../scripts/systems/twoe-crossover.mjs";
import { borrowedNavigation, catalogPageAllowed, catalogPageTitle, catalogNavigation, pf2eCatalogPage, pf2eCatalogsLive } from "../../scripts/catalogs/shared/catalog-system.mjs";

const on = { enabled: true, scope: "all", motion: false, sound: true, soundVolume: 0.6 };
const stateFor = (state) => () => crossoverState(state);
const laserRifle = { type: "weapon", name: "Aeon Rifle", slug: "aeon-rifle", system: { slug: "aeon-rifle" } };
const toads = { type: "spell", name: "500 Toads", slug: "500-toads", system: { slug: "500-toads" } };

test("PF2e and SF2e cross over to each other only", () => {
  assert.equal(crossoverSystem("pf2e"), "sf2e");
  assert.equal(crossoverSystem("sf2e"), "pf2e");
  assert.equal(crossoverSystem("dnd5e"), null);
  assert.equal(twoeSettingKey("pf2e", "weapon"), "weaponCatalog");
  assert.equal(twoeSettingKey("sf2e", "weapon"), "sf2eWeaponCatalog");
});

test("a borrowed catalog follows this world's catalog of the same kind", () => {
  assert.deepEqual(crossoverState(on), { enabled: true, independent: true, scope: "all", selected: [], excluded: [], customized: [], preferCatalog: false, motion: false, sound: true, soundVolume: 0.6 });
  assert.equal(crossoverState({ enabled: true, scope: "selected" }).enabled, false);
  assert.equal(crossoverState(null).enabled, false);
});

test("an SF2e-only weapon resolves from the SF2e catalog with this world's motion choice", () => {
  const event = { type: "attack", systemId: "sf2e", weaponMode: "ranged", item: laserRifle };
  const recipe = twoeCatalogRecipe("sf2e", event, [], { stateFor: stateFor(on), customEnabled: false });
  assert.equal(recipe?.systemId, "sf2e");
  assert.equal(recipe.name, "Aeon Rifle");
  assert.equal(twoeCatalogRecipe("sf2e", event, [], { stateFor: stateFor({ ...on, enabled: false }), customEnabled: false }), null);
});

test("a PF2e-only spell resolves from the PF2e catalog in an SF2e world", () => {
  const recipe = ["use", "template", "attack"].map((type) => twoeCatalogRecipe("pf2e", { type, systemId: "pf2e", item: toads }, [], { stateFor: stateFor(on), customEnabled: false })).find(Boolean);
  assert.equal(recipe?.name, "500 Toads");
});

test("crossover runs only when on and only for items this world does not know", () => {
  const calls = [];
  const resolve = (sys, event) => (calls.push([sys, event.systemId]), sys === "sf2e" ? { id: "sf" } : null);
  const event = { type: "attack", systemId: "pf2e", item: laserRifle };
  assert.equal(crossoverResolve(event, { systemId: "pf2e", on: false, resolve, knows: () => false }), null);
  assert.deepEqual(calls, [["pf2e", "pf2e"]]);
  calls.length = 0;
  assert.deepEqual(crossoverResolve(event, { systemId: "pf2e", on: true, resolve, knows: () => false }), { id: "sf" });
  assert.deepEqual(calls, [["pf2e", "pf2e"], ["sf2e", "sf2e"]]);
  // Excluded or disabled in this world: stays silent, never swapped for the other system's look.
  assert.equal(crossoverResolve(event, { systemId: "pf2e", on: true, resolve, knows: () => true }), null);
  // This world's own recipe always wins.
  assert.deepEqual(crossoverResolve(event, { systemId: "sf2e", on: true, resolve, knows: () => false }), { id: "sf" });
  assert.equal(crossoverResolve(event, { systemId: "dnd5e", on: true, resolve: () => null, knows: () => false }), null);
});

test("a PF2e world with crossover on lists the borrowed SF2e catalogs on their own pages", () => {
  const off = { systemId: "pf2e" }, on = { systemId: "pf2e", crossover: true };
  assert.deepEqual(borrowedNavigation(off), []);
  assert.deepEqual(borrowedNavigation({ systemId: "dnd5e", crossover: true }), []);
  assert.deepEqual(borrowedNavigation(on).map(([page]) => page), ["sf2e-spells", "sf2e-feats", "sf2e-actions", "sf2e-features", "sf2e-weapons"]);
  assert.equal(catalogPageAllowed("sf2e-weapons", off), false);
  assert.equal(catalogPageAllowed("sf2e-weapons", on), true);
  assert.equal(catalogPageTitle("sf2e-weapons", on), "SF2e weapon catalog");
  // PF2e's own pages are untouched.
  assert.deepEqual(catalogNavigation(on), catalogNavigation(off));
});

test("turning crossover on starts untouched SF2e catalogs like this world's own", () => {
  assert.deepEqual(seedBorrowedState({ enabled: true, scope: "all", motion: false, soundVolume: 0.5 }, {}),
    { enabled: true, independent: true, scope: "all", preferCatalog: false, motion: false, sound: true, soundVolume: 0.5 });
  // Off or limited to picks in this world: leave the SF2e catalog off.
  assert.equal(seedBorrowedState({ enabled: false }, {}), null);
  assert.equal(seedBorrowedState({ enabled: true, scope: "selected" }, {}), null);
  // A GM's own SF2e choices are never overwritten.
  assert.equal(seedBorrowedState(on, { enabled: false, excluded: ["x"] }), null);
  assert.equal(seedBorrowedState(on, { enabled: true, motion: true }), null);
});

test("a PF2e world configures its borrowed SF2e weapons from the sf2e-weapons page", async () => {
  const { DndCatalogWorkspace } = await import("../../scripts/ui/dnd5e-catalog-ui.mjs");
  const { sfCatalogProfile } = await import("../../scripts/catalogs/sf2e/sf2e-catalog.mjs");
  const { BORROWED_PAGES } = await import("../../scripts/catalogs/shared/catalog-system.mjs");
  const states = {};
  const w = { page: "sf2e-weapons", stageIndex: 0, render() {}, recipePreviewHTML: () => "", recipe() { return ui.recipe(); },
    host: { environment: () => ({ systemId: "pf2e", crossover: true, ready: true }), sfCatalogState: (k) => states[k], setSfCatalogState: async (k, v) => { states[k] = { ...states[k], ...v }; }, recipes: () => [], soundCatalog: () => null } };
  const ui = new DndCatalogWorkspace(w, { ...sfCatalogProfile, kinds: BORROWED_PAGES, borrowed: true });
  assert.equal(ui.kind, "weapon");
  assert.ok(ui.html().includes("SF2E"));
  await ui.action("dnd-auto", {});
  assert.equal(states.weapon.enabled, true);
  // PF2e's own pages are not this catalog's.
  w.page = "weapons";
  assert.equal(ui.isCatalogPage(), false);
});

test("an SF2e world with crossover on shows the PF2e catalogs on pf2e-* pages", () => {
  const off = { systemId: "sf2e" }, on = { systemId: "sf2e", crossover: true };
  assert.deepEqual(borrowedNavigation(on).map(([page, , label]) => [page, label]), [["pf2e-spells", "PF2e spells"], ["pf2e-feats", "PF2e feats"], ["pf2e-actions", "PF2e actions"], ["pf2e-features", "PF2e features"], ["pf2e-weapons", "PF2e weapons"]]);
  assert.equal(catalogPageAllowed("pf2e-spells", off), false);
  assert.equal(catalogPageAllowed("pf2e-spells", on), true);
  assert.equal(catalogPageAllowed("pf2e-spells", { systemId: "pf2e", crossover: true }), false);
  assert.equal(catalogPageTitle("pf2e-feats", on), "PF2e active feat catalog");
  // Which PF2e page renders: the borrowed one here, SF2e's own pages never.
  assert.equal(pf2eCatalogPage("pf2e-weapons", on), "weapons");
  assert.equal(pf2eCatalogPage("pf2e-weapons", off), null);
  assert.equal(pf2eCatalogPage("weapons", on), null);
  assert.equal(pf2eCatalogPage("weapons", { systemId: "pf2e" }), "weapons");
  assert.equal(pf2eCatalogsLive(on), true);
  assert.equal(pf2eCatalogsLive(off), false);
  assert.equal(pf2eCatalogsLive({ systemId: "pf2e" }), true);
});
