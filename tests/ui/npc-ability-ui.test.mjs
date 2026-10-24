import test from "node:test";
import assert from "node:assert/strict";
import { twoeCatalogRecipe } from "../../scripts/systems/twoe-crossover.mjs";
import { NPC_ABILITIES, NPC_ABILITY_IDS, npcAbilityPreview } from "../../scripts/catalogs/pf2e/npc-abilities.mjs";
import { npcAbilityCatalogHTML, npcAbilityAction, NPC_PAGE } from "../../scripts/ui/npc-ability-ui.mjs";
import { catalogNavigation, catalogPageAllowed, catalogPageTitle, catalogListText } from "../../scripts/catalogs/shared/catalog-system.mjs";

const npc = { type: "npc" };
const grab = { type: "use", systemId: "pf2e", item: { type: "action", name: "Grab", actor: npc, system: { traits: { value: [] }, description: { value: "" } } }, actor: npc };
const resolve = (states) => twoeCatalogRecipe("pf2e", grab, [], { customEnabled: false, stateFor: (kind) => (kind in states ? states[kind] : { enabled: true, scope: "all", independent: true }) });

test("every named NPC ability has a Studio preview", () => {
  assert.deepEqual(NPC_ABILITIES.map((a) => a.id), NPC_ABILITY_IDS);
  for (const a of NPC_ABILITIES) assert.ok(npcAbilityPreview(a.id)?.bespoke, a.id);
});

test("an ability left out on the NPC abilities page plays nothing at the table", () => {
  assert.ok(resolve({ npcAbilityExcluded: [] }));
  assert.equal(resolve({ npcAbilityExcluded: ["grab"] }), null);
  assert.ok(resolve({ npcAbilityExcluded: ["constrict"] }));
});

test("the NPC abilities page is a PF2e catalog page only", () => {
  assert.ok(catalogNavigation({ systemId: "pf2e" }).some(([page]) => page === NPC_PAGE));
  assert.ok(catalogPageAllowed(NPC_PAGE, { systemId: "pf2e" }));
  for (const systemId of ["sf2e", "dnd5e", "daggerheart"]) assert.equal(catalogPageAllowed(NPC_PAGE, { systemId }), false, systemId);
  assert.equal(catalogPageTitle(NPC_PAGE, { systemId: "pf2e" }), "PF2e NPC ability catalog");
  assert.doesNotMatch(catalogListText({ systemId: "pf2e" }), /npc/i);
});

function workspace(initial = {}) {
  let s = { abilities: true, guess: true, strikes: true, excluded: [], ...initial };
  const w = {
    busy: false, renders: 0, render() { this.renders++; },
    recipePreviewHTML: () => "<i data-preview></i>", previewDuration: () => 1200,
    host: { environment: () => ({ systemId: "pf2e", ready: true }), npcAbilityState: () => s, setNpcAbilityState: async (change) => { s = { ...s, ...change }; }, actionCatalogState: () => ({}) },
    get state() { return s; },
  };
  return w;
}

test("the page lists the abilities, its switches change the settings and Leave out toggles", async () => {
  const w = workspace();
  const html = npcAbilityCatalogHTML(w);
  for (const name of ["Grab", "Breath Weapon", "Swallow Whole"]) assert.match(html, new RegExp(name));
  assert.match(html, /data-setting="abilities"[^>]*>On</);
  assert.match(html, /data-preview/);
  await npcAbilityAction(w, "npc-setting", { dataset: { setting: "guess" } });
  assert.equal(w.state.guess, false);
  await npcAbilityAction(w, "select-npc-ability", { dataset: { id: "breath" } });
  assert.equal(w.selectedNpcAbility, "breath");
  await npcAbilityAction(w, "npc-exclude", { dataset: {} });
  assert.deepEqual(w.state.excluded, ["breath"]);
  assert.match(npcAbilityCatalogHTML(w), /Put back/);
  await npcAbilityAction(w, "npc-exclude", { dataset: {} });
  assert.deepEqual(w.state.excluded, []);
  assert.equal(await npcAbilityAction(w, "select-spell", { dataset: {} }), false);
  w.npcFilters.search = "swallow";
  assert.doesNotMatch(npcAbilityCatalogHTML(w), /data-id="grab"/);
});
