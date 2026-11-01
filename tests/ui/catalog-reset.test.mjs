import test from "node:test";
import assert from "node:assert/strict";
import { Workspace } from "../../scripts/ui/workspace.mjs";
import { DndCatalogWorkspace } from "../../scripts/ui/dnd5e-catalog-ui.mjs";
import { PF2E_SPELLS, normalizeCatalogState, spellRecipe } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe } from "../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { dndEntries, dndRecipe, normalizeDndCatalogState } from "../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";
import { starterRecipes, planRecipeImport } from "../../scripts/core/presets.mjs";

// A workspace on a catalog page. Its host keeps the catalogs' states as the real setters do (merge, normalize) and
// the world's recipes, saved through host.save as the pages save them.
function workspace({ page = "spells", isGM = true, systemId = "pf2e", state = {}, recipes = [], reviewing = null } = {}) {
  const w = Object.create(Workspace.prototype), store = { spell: normalizeCatalogState(state), dnd: {}, recipes };
  w.page = page; w.renders = 0; w.render = () => w.renders++; w.drafts = new Map(); w.dirty = new Set();
  w.host = { isGM: () => isGM, environment: () => ({ systemId, ready: true }), reviewing: () => reviewing, sets: [], saves: [],
    recipes: () => structuredClone(store.recipes), save: async (list) => { w.host.saves.push(list); store.recipes = structuredClone(list); },
    catalogState: () => store.spell, setCatalogState: async (c) => { w.host.sets.push(c); store.spell = normalizeCatalogState({ ...store.spell, ...c }); },
    dndCatalogState: (kind) => normalizeDndCatalogState(store.dnd[kind]), setDndCatalogState: async (kind, c) => { w.host.sets.push([kind, c]); store.dnd[kind] = normalizeDndCatalogState({ ...store.dnd[kind], ...c }); } };
  w.dndCatalog = systemId === "dnd5e" ? new DndCatalogWorkspace(w) : null;
  return w;
}
// Foundry's dialog, file download and notifications, recorded. `answer`: the box ticked, or undefined for No.
function foundry(answer) {
  const seen = { asked: [], saved: [], notes: [] };
  globalThis.foundry = { applications: { api: { DialogV2: { confirm: async (o) => { seen.asked.push(o); return answer === undefined ? false : o.yes.callback(null, { form: { elements: { full: { checked: answer } } } }); } } } },
    utils: { saveDataToFile: (text, type, name) => seen.saved.push({ data: JSON.parse(text), type, name }) } };
  globalThis.ui = { notifications: { info: (m) => seen.notes.push(m) } };
  return seen;
}
const [a, b, c] = PF2E_SPELLS;
const copy = spellRecipe(c), feat = featRecipe(PF2E_FEATS[0]), starters = starterRecipes().slice(0, 2), world = [...starters, copy, feat];
const used = { enabled: true, scope: "all", independent: true, preferCatalog: true, excluded: [a.id], selected: [b.id], customized: [c.id], motion: false, soundVolume: 0.9 };

test("Reset catalogue… sits in a catalog page's header for a GM only", () => {
  assert.match(workspace().catalogResetHTML(), /data-action="catalog-state-reset"[^>]*>↺ Reset catalogue…<\/button>/);
  assert.equal(workspace({ isGM: false }).catalogResetHTML(), "");
  assert.equal(workspace({ page: "recipes" }).catalogResetHTML(), "");
  assert.equal(workspace({ page: "npc-abilities" }).catalogResetHTML(), "");
  assert.match(workspace({ page: "weapons", systemId: "dnd5e" }).catalogResetHTML(), /catalog-state-reset/);
});

test("each page names its own catalog and its registered default", () => {
  const pf2e = workspace().catalogResetTarget();
  assert.equal(pf2e.name, "PF2e spell catalog");
  assert.deepEqual(pf2e.catalog, { system: "pf2e", kind: "spell" });
  assert.deepEqual(pf2e.defaults, normalizeCatalogState());
  const dnd = workspace({ page: "weapons", systemId: "dnd5e" }).catalogResetTarget();
  assert.equal(dnd.name, "D&D 5e weapon catalog");
  assert.deepEqual(dnd.catalog, { system: "dnd5e", kind: "weapon" });
  assert.deepEqual(dnd.defaults, normalizeDndCatalogState());
});

test("a reset asks first naming what it deletes, backs up, deletes this catalog's copies only, keeps its switch", async () => {
  const w = workspace({ state: used, recipes: world }), seen = foundry(false), before = w.host.catalogState();
  w.leftOutView = "spells"; w.selected = copy.id; w.dirty.add(copy.id); w.drafts.set(copy.id, copy);
  await w.resetCatalog();
  assert.equal(seen.asked.length, 1);
  assert.equal(seen.asked[0].no.default, true);
  assert.match(seen.asked[0].content, new RegExp(`Deletes 1 customised recipe: ${c.name}\\.`));
  assert.equal(seen.saved.length, 1);
  assert.match(seen.saved[0].name, /^animater-pf2e-spell-catalogue-backup-.+\.json$/);
  assert.deepEqual(seen.saved[0].data.catalogState, before);
  assert.deepEqual(seen.saved[0].data.recipes.map((r) => r.id), [copy.id]);
  assert.deepEqual(w.host.recipes().map((r) => r.id), [...starters.map((r) => r.id), feat.id]);
  assert.deepEqual(w.host.catalogState(), { ...normalizeCatalogState(), enabled: true, scope: "all" });
  assert.ok(!w.dirty.has(copy.id) && !w.drafts.has(copy.id));
  assert.equal(w.selected, starters[0].id);
  assert.equal(w.leftOutView, null);
  assert.equal(w.renders, 1);
  assert.match(seen.notes[0], /PF2e spell catalog reset to the stock catalog; 1 customised recipe deleted/);
  // One import of the backup brings the recipe back.
  assert.deepEqual(planRecipeImport(JSON.stringify(seen.saved[0].data), w.host.recipes()).recipes.map((r) => r.id), [...starters.map((r) => r.id), feat.id, copy.id]);
});

test("the fresh-install option also switches the catalog off", async () => {
  const w = workspace({ state: used, recipes: world }), seen = foundry(true);
  await w.resetCatalog();
  assert.deepEqual(w.host.catalogState(), normalizeCatalogState());
  assert.equal(w.host.recipes().length, world.length - 1);
  assert.equal(seen.saved.length, 1);
});

test("no reset when cancelled, when already stock, or for a GM reviewing a player's animations", async () => {
  let w = workspace({ state: used, recipes: world }), seen = foundry();
  await w.resetCatalog();
  assert.deepEqual([w.host.sets, w.host.saves, seen.saved], [[], [], []]);
  w = workspace({ recipes: [...starters, feat] }); seen = foundry(false);
  await w.resetCatalog();
  assert.deepEqual([seen.asked, w.host.sets, w.host.saves, seen.saved], [[], [], [], []]);
  assert.match(seen.notes[0], /already the stock catalog/);
  // Switched on and nothing else: asked, since the fresh-install option would change it; left alone without it.
  w = workspace({ state: { enabled: true }, recipes: starters }); seen = foundry(false);
  await w.resetCatalog();
  assert.equal(seen.asked.length, 1);
  assert.deepEqual([w.host.sets, seen.saved], [[], []]);
  // Reviewing a player, the host's recipes are that player's: never touched.
  w = workspace({ state: used, recipes: world, reviewing: { userId: "p1", userName: "Pat" } }); seen = foundry(true);
  await assert.rejects(w.resetCatalog(), /Close Pat's animations first/);
  assert.deepEqual([seen.asked, w.host.sets, w.host.saves], [[], [], []]);
  // A player is never asked.
  w = workspace({ isGM: false, state: used, recipes: world }); seen = foundry(true);
  await w.resetCatalog();
  assert.equal(seen.asked.length, 0);
});

test("a D&D catalog resets through its own setter and deletes only its own kind's copies", async () => {
  const [x, y] = dndEntries("weapon"), weapon = dndRecipe(y, y.variants[0].id), spell = dndRecipe(dndEntries("spell")[0]);
  const w = workspace({ page: "weapons", systemId: "dnd5e", recipes: [...starters, weapon, spell] });
  await w.host.setDndCatalogState("weapon", { enabled: true, excluded: [x.id], customized: [y.id], opacity: 0.4 }); w.host.sets.length = 0;
  const seen = foundry(false);
  await w.resetCatalog();
  assert.deepEqual(w.host.sets.map(([kind]) => kind), ["weapon"]);
  assert.deepEqual(w.host.dndCatalogState("weapon"), { ...normalizeDndCatalogState(), enabled: true });
  assert.deepEqual(w.host.recipes().map((r) => r.id), [...starters.map((r) => r.id), spell.id]);
  assert.match(seen.saved[0].name, /^animater-dnd5e-weapon-catalogue-backup-/);
});
