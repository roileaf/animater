import test from "node:test";
import assert from "node:assert/strict";
import { twoeCatalogRecipe } from "../../scripts/systems/twoe-crossover.mjs";
import { NPC_ABILITIES, NPC_ABILITY_IDS, NPC_ACTIONS, npcAbilityPreview } from "../../scripts/catalogs/pf2e/npc-abilities.mjs";
import { npcAbilityCatalogHTML, npcAbilityAction, npcAbilitySearch, NPC_PAGE } from "../../scripts/ui/npc-ability-ui.mjs";
import { catalogNavigation, catalogPageAllowed, catalogPageTitle, catalogListText } from "../../scripts/catalogs/shared/catalog-system.mjs";
import {SF_NPC_ACTIONS} from '../../scripts/catalogs/sf2e/sf2e-npc-actions.mjs';
import {DND_NPC_ACTIONS} from '../../scripts/catalogs/dnd5e/dnd5e-npc-actions.mjs';

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

test("the NPC abilities page follows the native supported system", () => {
  assert.ok(catalogNavigation({ systemId: "pf2e" }).some(([page]) => page === NPC_PAGE));
  assert.ok(catalogPageAllowed(NPC_PAGE, { systemId: "pf2e" }));
  for (const systemId of ["sf2e", "dnd5e"]) assert.equal(catalogPageAllowed(NPC_PAGE, { systemId }), true, systemId);
  assert.equal(catalogPageAllowed(NPC_PAGE, { systemId:'daggerheart' }), false);
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

for(const [systemId,actions,count] of [['sf2e',SF_NPC_ACTIONS,660],['dnd5e',DND_NPC_ACTIONS,481]])test(`${systemId} NPC page uses native data, preview and catalog controls`,async()=>{
 const w=workspace();w.host.environment=()=>({systemId,ready:true});
 w.host.sfCatalogState=w.host.dndCatalogState=()=>({enabled:true,scope:'all'});
 const a=actions.find(a=>a.native);w.selectedNpcAbility=a.id;
 let html=npcAbilityCatalogHTML(w);assert.match(html,new RegExp(`${count} NPC actions`));assert.match(html,/Open native catalog/);assert.match(html,/data-preview/);
 assert.equal(html.includes('data-setting="guess"'),systemId!=='dnd5e');
 const routes=[];w.reveal=r=>routes.push(r);await npcAbilityAction(w,'npc-native',{dataset:{}});
 assert.equal(routes[0].id,a.native.entryId);assert.equal(routes[0].page,systemId==='dnd5e'?'feats':'actions');
 w.host.sfCatalogState=w.host.dndCatalogState=()=>({enabled:false});html=npcAbilityCatalogHTML(w);assert.match(html,/Native catalog is off/);
});

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
test('actual actions search by creature; pagination bounds DOM and native attack handoffs are explicit',async()=>{
 const w=workspace(),initial=npcAbilityCatalogHTML(w);
 assert.equal((initial.match(/data-action="select-npc-ability"/g)??[]).length,40);
 assert.match(initial,/NPC actions, plus 26 shared designs/);
 await npcAbilityAction(w,'npc-page',{dataset:{offset:'40'}});
 assert.equal(w.npcFilters.offset,40);assert.ok(w.selectedNpcAbility.startsWith('action-'));
 npcAbilitySearch(w,'Magnetic Skink');const result=npcAbilityCatalogHTML(w);
 assert.equal(w.npcFilters.offset,0);assert.match(result,/Unsteadying Magnetism/);
 await npcAbilityAction(w,'select-npc-ability',{dataset:{id:NPC_ACTIONS.find(a=>a.name==='Unsteadying Magnetism').id}});
 assert.match(npcAbilityCatalogHTML(w),/Metal pulled inward/);
 const reviewed=NPC_ACTIONS.find(a=>a.coverage==='reviewed'&&a.form.delivery==='strike');
 npcAbilitySearch(w,reviewed.name);w.selectedNpcAbility=reviewed.id;w.state.guess=false;
 const handoff=npcAbilityCatalogHTML(w);assert.match(handoff,/Strike preparation/);assert.match(handoff,/Each actual Strike keeps its own attack animation/);assert.match(handoff,/Plays automatically/);
});
