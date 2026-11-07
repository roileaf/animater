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
  const w = Object.create(Workspace.prototype), store = { spell: normalizeCatalogState(state), dnd: {}, recipes, kept: {} };
  w.page = page; w.renders = 0; w.render = () => w.renders++; w.drafts = new Map(); w.dirty = new Set();
  w.host = { isGM: () => isGM, environment: () => ({ systemId, ready: true }), reviewing: () => reviewing, sets: [], saves: [],
    recipes: () => structuredClone(store.recipes), save: async (list) => { w.host.saves.push(list); store.recipes = structuredClone(list); },
    catalogState: () => store.spell, setCatalogState: async (c) => { w.host.sets.push(c); store.spell = normalizeCatalogState({ ...store.spell, ...c }); },
    dndCatalogState: (kind) => normalizeDndCatalogState(store.dnd[kind]), setDndCatalogState: async (kind, c) => { w.host.sets.push([kind, c]); store.dnd[kind] = normalizeDndCatalogState({ ...store.dnd[kind], ...c }); },
    catalogResetBackup: (slot) => store.kept[slot] ?? null, setCatalogResetBackup: async (slot, backup) => { if (backup) store.kept[slot] = structuredClone(backup); else delete store.kept[slot]; } };
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

test("Reset catalog… sits in a catalog page's header for a GM only, with Restore last reset… once one is kept", async () => {
  assert.match(workspace().catalogResetHTML(), /data-action="catalog-state-reset"[^>]*>↺ Reset catalog…<\/button>/);
  assert.doesNotMatch(workspace().catalogResetHTML(), /catalog-state-restore/);
  const w = workspace();
  await w.host.setCatalogResetBackup("pf2e-spell", { recipes: [copy], catalogState: used });
  assert.match(w.catalogResetHTML(), /data-action="catalog-state-restore"[^>]*the 1 customised recipe it deleted[^>]*>↶ Restore last reset…<\/button><button data-action="catalog-state-reset"/);
  w.page = "feats";
  assert.doesNotMatch(w.catalogResetHTML(), /catalog-state-restore/, "another catalog's slot");
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
  assert.match(seen.saved[0].name, /^animater-pf2e-spell-catalog-backup-.+\.json$/);
  assert.deepEqual(seen.saved[0].data.catalogState, before);
  assert.deepEqual(seen.saved[0].data.recipes.map((r) => r.id), [copy.id]);
  assert.deepEqual(w.host.catalogResetBackup("pf2e-spell"), seen.saved[0].data, "the same backup is kept in the world");
  assert.doesNotMatch(seen.asked[0].content, /edited|is replaced/);
  assert.deepEqual(w.host.recipes().map((r) => r.id), [...starters.map((r) => r.id), feat.id]);
  assert.deepEqual(w.host.catalogState(), { ...normalizeCatalogState(), enabled: true, scope: "all", independent: true });
  assert.ok(!w.dirty.has(copy.id) && !w.drafts.has(copy.id));
  assert.equal(w.selected, starters[0].id);
  assert.equal(w.leftOutView, null);
  assert.equal(w.renders, 1);
  assert.match(seen.notes[0], /PF2e spell catalog reset to the stock catalog; 1 customised recipe deleted\. A backup is kept in this world/);
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
  assert.match(seen.saved[0].name, /^animater-dnd5e-weapon-catalog-backup-/);
});

test("the kept copy is written before anything is deleted, and a failure to keep it stops the reset", async () => {
  const w = workspace({ state: used, recipes: world }), seen = foundry(false), order = [];
  const keep = w.host.setCatalogResetBackup;
  w.host.setCatalogResetBackup = async (...a) => { order.push("kept"); return keep(...a); };
  globalThis.foundry.utils.saveDataToFile = () => order.push("downloaded");
  w.host.save = async () => order.push("deleted");
  await w.resetCatalog();
  assert.deepEqual(order, ["kept", "downloaded", "deleted"]);
  const w2 = workspace({ state: used, recipes: world }); foundry(false);
  w2.host.setCatalogResetBackup = async () => { throw Error("database down"); };
  await assert.rejects(w2.resetCatalog(), /database down/);
  assert.deepEqual([w2.host.saves, w2.host.sets], [[], []]);
  assert.equal(w2.host.recipes().length, world.length);
});

test("the question marks a copy edited since Customize made it, and dates the kept reset it replaces", async () => {
  const edited = { ...copy, name: "My fireball" }, w = workspace({ state: used, recipes: [...starters, edited, feat] }), seen = foundry(false);
  await w.host.setCatalogResetBackup("pf2e-spell", { recipes: [], catalogState: used, saved: "2026-11-01T10:20:30.400Z" });
  await w.resetCatalog();
  assert.match(seen.asked[0].content, /Deletes 1 customised recipe \(1 edited since\): My fireball \(edited\)\./);
  assert.match(seen.asked[0].content, /is replaced\./);
  assert.equal(w.host.catalogResetBackup("pf2e-spell").recipes[0].name, "My fireball", "the slot now holds this reset");
});

test("Restore last reset… asks, brings the recipes and the catalog's state back, and clears the kept copy", async () => {
  const w = workspace({ state: used, recipes: world }); let seen = foundry(false);
  w.selected = copy.id;
  await w.resetCatalog();
  assert.equal(w.host.recipes().length, world.length - 1);
  await w.host.setCatalogState({ enabled: false, motion: true });
  w.host.sets.length = 0; w.host.saves.length = 0; w.renders = 0;
  // Cancelled: nothing changes and the copy stays.
  seen = foundry();
  await w.restoreCatalog();
  assert.deepEqual([w.host.sets, w.host.saves], [[], []]);
  assert.ok(w.host.catalogResetBackup("pf2e-spell"));
  // Restored.
  seen = foundry(false);
  await w.restoreCatalog();
  assert.equal(seen.asked.length, 1);
  assert.equal(seen.asked[0].no.default, true);
  assert.match(seen.asked[0].content, new RegExp(`Brings back 1 customised recipe: ${c.name}\\.`));
  assert.deepEqual(w.host.recipes().map((r) => r.id), [...world.filter((r) => r.id !== copy.id).map((r) => r.id), copy.id]);
  assert.deepEqual(w.host.catalogState(), normalizeCatalogState(used));
  assert.equal(w.host.catalogResetBackup("pf2e-spell"), null);
  assert.doesNotMatch(w.catalogResetHTML(), /catalog-state-restore/);
  assert.match(seen.notes.at(-1), /PF2e spell catalog restored as it was before its last reset; 1 customised recipe back\./);
  assert.equal(w.renders, 1);
  // Nothing kept, or reviewing a player: no question.
  seen = foundry(false);
  await w.restoreCatalog();
  assert.equal(seen.asked.length, 0);
  const r = workspace({ reviewing: { userId: "p1", userName: "Pat" } });
  await r.host.setCatalogResetBackup("pf2e-spell", { recipes: [copy], catalogState: used });
  await assert.rejects(r.restoreCatalog(), /Close Pat's animations first/);
});

test("a Draw Steel catalog's copies are its own: a reset on its page deletes only that kind's", async () => {
  const { dsEntries, dsRecipe, normalizeDsCatalogState } = await import("../../scripts/catalogs/draw-steel/draw-steel-catalog.mjs");
  const { dsCatalogProfile } = await import("../../scripts/catalogs/draw-steel/draw-steel-catalog.mjs");
  const [x, y] = dsEntries("fallback"), fallback = dsRecipe(y, y.variants[0].id), ability = dsRecipe(dsEntries("ability")[0]);
  const w = workspace({ page: "weapons", systemId: "draw-steel", recipes: [...starters, fallback, ability] }), store = {};
  w.host.dsCatalogState = (kind) => normalizeDsCatalogState(store[kind]);
  w.host.setDsCatalogState = async (kind, c) => { w.host.sets.push([kind, c]); store[kind] = normalizeDsCatalogState({ ...store[kind], ...c }); };
  w.dndCatalog = new DndCatalogWorkspace(w, dsCatalogProfile);
  await w.host.setDsCatalogState("fallback", { enabled: true, excluded: [x.id], customized: [y.id], opacity: 0.4 }); w.host.sets.length = 0;
  const seen = foundry(false);
  await w.resetCatalog();
  assert.deepEqual(w.host.sets.map(([kind]) => kind), ["fallback"]);
  assert.deepEqual(w.host.dsCatalogState("fallback"), { ...normalizeDsCatalogState(), enabled: true });
  assert.deepEqual(w.host.recipes().map((r) => r.id), [...starters.map((r) => r.id), ability.id]);
  assert.match(seen.saved[0].name, /^animater-draw-steel-fallback-catalog-backup-/);
  assert.deepEqual(w.host.catalogResetBackup("draw-steel-fallback").recipes.map((r) => r.id), [fallback.id]);
});
