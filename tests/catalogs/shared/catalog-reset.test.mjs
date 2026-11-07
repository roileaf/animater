import test from "node:test";
import assert from "node:assert/strict";
import { resetCatalogState, isCatalogCustomisation, catalogCustomisations, catalogResetPlan, catalogBackup, catalogBackupFileName, catalogBackupOf, catalogRestorePlan, recipeEdited, catalogResetDialogHTML, catalogRestoreDialogHTML, CATALOG_SWITCH_FIELDS } from "../../../scripts/catalogs/shared/catalog-reset.mjs";
import { PF2E_SPELLS, normalizeCatalogState, spellRecipe } from "../../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, normalizeFeatCatalogState, featRecipe } from "../../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG } from "../../../scripts/catalogs/pf2e/ability-catalog.mjs";
import { PF2E_WEAPONS, normalizeWeaponCatalogState, weaponCustomizationKey, weaponRecipe } from "../../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { PF2E_CONDITIONS, PF2E_EFFECTS, normalizeStateCatalogState, stateRecipe } from "../../../scripts/catalogs/pf2e/state-catalog.mjs";
import { SF_KINDS, sfEntries, sfRecipe, normalizeSfCatalogState } from "../../../scripts/catalogs/sf2e/sf2e-catalog.mjs";
import { DND_KINDS, dndEntries, dndRecipe, normalizeDndCatalogState } from "../../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs";
import { DH_KINDS, dhEntries, dhRecipe, normalizeDhCatalogState } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { DS_KINDS, dsEntries, dsRecipe, normalizeDsCatalogState } from "../../../scripts/catalogs/draw-steel/draw-steel-catalog.mjs";
import { starterRecipes, planRecipeImport } from "../../../scripts/core/presets.mjs";

// Every catalog: its { system, kind }, normalize, entries, and the recipe its Customize saves for an entry.
const some = (list) => [list[0], list[Math.floor(list.length / 2)], list.at(-1)];
const CATALOGS = [
  ["pf2e", "spell", normalizeCatalogState, PF2E_SPELLS, (e) => spellRecipe(e)],
  ["pf2e", "feat", normalizeFeatCatalogState, PF2E_FEATS, (e) => featRecipe(e)],
  ["pf2e", "action", PF2E_ACTION_CATALOG.normalizeState, PF2E_ACTION_CATALOG.entries, (e) => PF2E_ACTION_CATALOG.recipe(e)],
  ["pf2e", "feature", PF2E_FEATURE_CATALOG.normalizeState, PF2E_FEATURE_CATALOG.entries, (e) => PF2E_FEATURE_CATALOG.recipe(e)],
  ["pf2e", "weapon", normalizeWeaponCatalogState, PF2E_WEAPONS, (e) => weaponRecipe(e, e.modes.at(-1).mode)],
  ["pf2e", "condition", normalizeStateCatalogState, PF2E_CONDITIONS, (e) => stateRecipe(e)],
  ["pf2e", "effect", normalizeStateCatalogState, PF2E_EFFECTS, (e) => stateRecipe(e)],
  ...SF_KINDS.map((kind) => ["sf2e", kind, normalizeSfCatalogState, sfEntries(kind), (e) => sfRecipe(e, e.variants.at(-1).id)]),
  ...DND_KINDS.map((kind) => ["dnd5e", kind, normalizeDndCatalogState, dndEntries(kind), (e) => dndRecipe(e, e.variants.at(-1).id)]),
  ...DH_KINDS.map((kind) => ["daggerheart", kind, normalizeDhCatalogState, dhEntries(kind), (e) => dhRecipe(e, e.variants.at(-1).id)]),
  ...DS_KINDS.map((kind) => ["draw-steel", kind, normalizeDsCatalogState, dsEntries(kind), (e) => dsRecipe(e, e.variants.at(-1).id)]),
];
// A catalog a GM has used: on for picked entries, some left out, one customised, every look and sound choice moved.
const used = (normalize, [a, b, c], weapon) => normalize({ enabled: true, scope: "selected", independent: true, preferCatalog: true, selected: [a.id], excluded: [b.id],
  customized: [weapon ? weaponCustomizationKey(c.id, c.modes[0].mode) : c.id], motion: false, sound: false, soundVolume: 0.8, surfaceSound: false, fade: true, turn: true, opacity: 0.5 });

test("each catalog's real default: a reset clears picks, exclusions, customised links and looks, and keeps its switch unless asked", () => {
  for (const [system, kind, normalize, entries] of CATALOGS) {
    const name = `${system} ${kind}`, defaults = normalize(), current = used(normalize, some(entries), system === "pf2e" && kind === "weapon");
    assert.ok(current.selected.length && current.excluded.length && current.customized.length, `${name} keeps its ids`);
    const kept = resetCatalogState(current, defaults);
    assert.deepEqual(kept, normalize(kept), `${name}: the reset state is already normal`);
    const expected = { ...defaults };
    for (const key of CATALOG_SWITCH_FIELDS) if (key in defaults) expected[key] = current[key];
    assert.deepEqual(kept, expected, name);
    assert.equal(kept.enabled, true, name);
    assert.equal(kept.scope, "selected", name);
    // Kept on, it plays on with Play my own recipes automatically off; the fresh-install state is not independent.
    if ("independent" in defaults) {
      assert.equal(kept.independent, true, name);
      assert.equal(resetCatalogState(current, defaults, { keepEnabled: false }).independent, false, name);
    }
    if ("preferCatalog" in defaults) assert.equal(kept.preferCatalog, false, `${name}: preferCatalog goes back to its default`);
    assert.deepEqual([kept.selected, kept.excluded, kept.customized], [[], [], []], name);
    assert.deepEqual(resetCatalogState(current, defaults, { keepEnabled: false }), defaults, `${name}: fresh install`);
  }
});

test("a catalog already at its default is not reset; a switched-on one changes only when asked to switch off", () => {
  for (const [system, kind, normalize] of CATALOGS) {
    const name = `${system} ${kind}`;
    assert.equal(resetCatalogState(normalize(), normalize()), null, name);
    assert.equal(resetCatalogState(normalize(), normalize(), { keepEnabled: false }), null, name);
    const on = normalize({ ...normalize(), enabled: true, independent: true });
    assert.equal(resetCatalogState(on, normalize()), null, `${name}: only its switch differs`);
    assert.equal(resetCatalogState(on, normalize(), { keepEnabled: false }).enabled, false, name);
    const plan = catalogResetPlan({ state: normalize(), defaults: normalize(), recipes: starterRecipes(), catalog: { system, kind } });
    assert.equal(plan.changed, false, `${name}: stock, nothing customised`);
    assert.deepEqual(plan.deleted, []);
  }
});

test("every list is cleared, unknown fields dropped, and a field the state lacks reads as its default", () => {
  const defaults = { enabled: false, scope: "all", selected: [], excluded: [], customized: [], motion: true, soundVolume: 0.35 };
  const current = { enabled: true, scope: "all", selected: ["a"], excluded: ["b", "c"], customized: ["d"], motion: true, legacy: 1 };
  assert.deepEqual(resetCatalogState(current, defaults), { ...defaults, enabled: true });
  assert.deepEqual(resetCatalogState(current, defaults, { keepEnabled: false }), defaults);
  assert.equal(resetCatalogState({ enabled: false, legacy: 1 }, defaults), null, "an unknown field alone is not a change");
  assert.equal(resetCatalogState({}, defaults), null);
  assert.equal(resetCatalogState(null, defaults), null);
  // The result is a copy: changing it never changes the default it came from.
  resetCatalogState(current, defaults).selected.push("f");
  assert.deepEqual(defaults.selected, []);
});

test("each catalog owns the recipes its Customize saves, edited or not, and no other catalog's", () => {
  for (const [system, kind, , entries, recipeOf] of CATALOGS) {
    const name = `${system} ${kind}`;
    for (const entry of some(entries)) {
      const copy = recipeOf(entry);
      assert.ok(isCatalogCustomisation(copy, { system, kind }), `${name}: ${copy.id}`);
      assert.ok(isCatalogCustomisation({ ...copy, name: "Mine now", stages: [], description: "edited" }, { system, kind }), `${name}: edited ${copy.id}`);
      for (const [s, k] of CATALOGS) if (s !== system || k !== kind) assert.equal(isCatalogCustomisation(copy, { system: s, kind: k }), false, `${copy.id} is not ${s} ${k}'s`);
    }
  }
});

test("a reset never deletes the GM's own recipes, the starters, duplicates or unbound copies", () => {
  const spell = PF2E_SPELLS[0], copy = spellRecipe(spell), state = stateRecipe(PF2E_EFFECTS[0]), dnd = dndRecipe(dndEntries("spell")[0]);
  const own = [
    ...starterRecipes(),
    { ...copy, id: "c0ffee00-0000-4000-8000-000000000000", name: `${copy.name} copy`, trigger: "manual", itemUuid: "" }, // Duplicate
    { ...copy, id: "hand-made", name: "My fireball" }, // bound to the same spell, made by hand
    { ...state, id: "c0ffee00-0000-4000-8000-000000000001", stateEntry: "" }, // a duplicated lasting look
    { ...state, stateEntry: "" }, // Unbind: the catalog's id, but no longer tied to its entry
    { ...dnd, id: "c0ffee00-0000-4000-8000-000000000002" }, // a D&D duplicate keeps its catalogEntry, not the id
    { ...copy, id: spell.id }, // a bare entry id is not Customize's
  ];
  for (const [system, kind] of CATALOGS) assert.deepEqual(catalogCustomisations(own, { system, kind }).map((r) => r.id), [], `${system} ${kind}`);
  const pf2eSpells = catalogCustomisations([...own, copy], { system: "pf2e", kind: "spell" });
  assert.deepEqual(pf2eSpells.map((r) => r.id), [copy.id]);
});

test("the plan deletes only this catalog's copies and keeps every other recipe in order", () => {
  const feat = featRecipe(PF2E_FEATS[0]), spell = spellRecipe(PF2E_SPELLS[0]), effect = stateRecipe(PF2E_EFFECTS[0]), starters = starterRecipes();
  const recipes = [starters[0], feat, spell, effect, starters[1]], state = normalizeFeatCatalogState({ enabled: true, customized: [PF2E_FEATS[0].id] });
  const plan = catalogResetPlan({ state, defaults: normalizeFeatCatalogState(), recipes, catalog: { system: "pf2e", kind: "feat" } });
  assert.deepEqual(plan.deleted.map((r) => r.id), [feat.id]);
  assert.deepEqual(plan.recipes.map((r) => r.id), [starters[0].id, spell.id, effect.id, starters[1].id]);
  assert.deepEqual(plan.state, { ...normalizeFeatCatalogState(), enabled: true });
  assert.equal(plan.changed, true);
  // A catalog already stock still deletes its copies; one with nothing to delete changes only its state.
  const stock = catalogResetPlan({ state: normalizeFeatCatalogState(), defaults: normalizeFeatCatalogState(), recipes, catalog: { system: "pf2e", kind: "feat" } });
  assert.equal(stock.state, null);
  assert.deepEqual(stock.deleted.map((r) => r.id), [feat.id]);
  const effects = catalogResetPlan({ state: normalizeStateCatalogState({ excluded: [PF2E_EFFECTS[1].id] }), defaults: normalizeStateCatalogState(), recipes: [starters[0], feat], catalog: { system: "pf2e", kind: "effect" } });
  assert.deepEqual(effects.deleted, []);
  assert.deepEqual(effects.recipes.map((r) => r.id), [starters[0].id, feat.id]);
});

test("the backup imports straight back: the deleted recipes return, the rest stay, the state rides beside them", () => {
  const date = new Date("2026-11-01T10:20:30.400Z"), feat = featRecipe(PF2E_FEATS[0]), starters = starterRecipes().slice(0, 2);
  const state = normalizeFeatCatalogState({ enabled: true, customized: [PF2E_FEATS[0].id] });
  const plan = catalogResetPlan({ state, defaults: normalizeFeatCatalogState(), recipes: [...starters, feat], catalog: { system: "pf2e", kind: "feat" } });
  const backup = catalogBackup(state, plan.deleted, { catalog: "pf2e-feat", date });
  assert.deepEqual(backup, { schema: 1, recipes: [feat], module: "animater", catalog: "pf2e-feat", saved: "2026-11-01T10:20:30.400Z", catalogState: state });
  const restored = planRecipeImport(JSON.stringify(backup), plan.recipes);
  assert.deepEqual(restored.incoming.map((r) => r.id), [feat.id]);
  assert.deepEqual(restored.recipes.map((r) => r.id), [...starters.map((r) => r.id), feat.id]);
  assert.equal(restored.added, 1);
  assert.equal(catalogBackupFileName("pf2e-feat", { date }), "animater-pf2e-feat-catalog-backup-2026-11-01T10-20-30-400Z.json");
});

test("the question says what a reset does, names the recipes it deletes, and offers the fresh-install state unticked", () => {
  const html = catalogResetDialogHTML("PF2e effect catalog", { deleted: [{ id: "a", name: "Stance: Inspiring Marshal Stance" }] });
  assert.match(html, /Put the PF2e effect catalog back to the stock catalog\?/);
  assert.match(html, /Deletes 1 customised recipe: Stance: Inspiring Marshal Stance\./);
  assert.match(html, /A copy of what it deletes stays in this world until this catalog's next reset: <b>Restore last reset…<\/b>/);
  assert.match(html, /downloads as a file .* Import on the Recipes page takes back\. For a backup of every recipe first, use Export on the Recipes page\./);
  assert.match(html, /<input type="checkbox" name="full"> Also switch this catalog back to its fresh-install state \(off\)/);
  assert.doesNotMatch(html, /checked|none play until|edited|is replaced/);
  // Edited copies are marked, and a kept reset this one replaces is dated.
  const kept = { saved: "2026-11-01T10:20:30.400Z", catalogState: {}, recipes: [{ id: "k1" }, { id: "k2" }] }, at = new Date(kept.saved).toLocaleString().replace(/[/.]/g, "\\$&");
  const edited = catalogResetDialogHTML("x", { deleted: [{ id: "a", name: "A" }, { id: "b", name: "B" }], edited: new Set(["b"]), replaces: kept });
  assert.match(edited, /Deletes 2 customised recipes \(1 edited since\): A, B \(edited\)\./);
  assert.match(edited, new RegExp(`The copy kept from the reset on ${at}, with the 2 recipes it holds, is replaced\\.`));
  assert.match(catalogResetDialogHTML("x", { replaces: { ...kept, recipes: [] } }), new RegExp(`The copy kept from the reset on ${at} is replaced\\.`), "no recipes kept: only the date");
  assert.match(catalogResetDialogHTML("x"), /No customised recipes to delete\./);
  assert.match(catalogResetDialogHTML("x", { pickedOnly: true }), /none play until you pick them again/);
  const many = Array.from({ length: 12 }, (_, i) => ({ id: `r${i}`, name: `R${i}` }));
  assert.match(catalogResetDialogHTML("x", { deleted: many }), /Deletes 12 customised recipes: R0, .*, R9 and 2 more\./);
  assert.match(catalogResetDialogHTML("<b>", { deleted: [{ id: "a", name: "<i>" }] }), /the &lt;b&gt; back.*: &lt;i&gt;\./s);
});

test("a copy counts as edited when its name or its stages (sounds aside) differ from the catalog's own recipe", () => {
  const stock = spellRecipe(PF2E_SPELLS[0]), sound = { kind: "sound", file: "x.ogg", volume: 0.5 };
  assert.equal(recipeEdited(stock, stock), false);
  assert.equal(recipeEdited({ ...stock, stages: [...stock.stages, sound] }, stock), false, "a sound stage the catalog's sound choice added");
  assert.equal(recipeEdited(stock, { ...stock, stages: [...stock.stages.filter((s) => s.kind !== "sound"), sound] }), false);
  assert.equal(recipeEdited({ ...stock, name: `${stock.name} (mine)` }, stock), true);
  assert.equal(recipeEdited({ ...stock, stages: stock.stages.map((s, i) => (i ? s : { ...s, scale: 3 })) }, stock), true);
  assert.equal(recipeEdited({ ...stock, stages: stock.stages.slice(1) }, stock), true);
  assert.equal(recipeEdited(stock, null), false, "unknown without the stock recipe");
});

test("the kept reset restores its recipes and state; a recipe made again since gives way to the kept copy", () => {
  const [, , c] = PF2E_SPELLS, copy = { ...spellRecipe(c), name: "Mine" }, starters = starterRecipes().slice(0, 2);
  const state = normalizeCatalogState({ enabled: true, scope: "selected", selected: [c.id], motion: false });
  const backup = catalogBackup(state, [copy], { catalog: "pf2e-spell", date: new Date("2026-11-01T10:20:30.400Z") });
  assert.equal(catalogBackupOf(backup), backup);
  for (const bad of [null, {}, { recipes: [] }, { recipes: {}, catalogState: {} }, "x"]) assert.equal(catalogBackupOf(bad), null);
  let plan = catalogRestorePlan(backup, starters);
  assert.deepEqual(plan.recipes.map((r) => r.id), [...starters.map((r) => r.id), copy.id]);
  assert.equal(plan.recipes.at(-1).name, "Mine");
  assert.deepEqual([plan.restored.map((r) => r.id), plan.replaced, plan.state], [[copy.id], 0, state]);
  // Customized again since: the saved recipe with that id is replaced by the kept one, as Import replaces it.
  plan = catalogRestorePlan(backup, [...starters, spellRecipe(c)]);
  assert.deepEqual([plan.recipes.map((r) => r.name).at(-1), plan.replaced], ["Mine", 1]);
  // Nothing deleted: only the state comes back.
  plan = catalogRestorePlan(catalogBackup(state, []), starters);
  assert.deepEqual([plan.recipes, plan.restored, plan.state], [starters, [], state]);
  assert.throws(() => catalogRestorePlan({ nope: true }, starters), /No catalog reset to restore/);
  // A kept copy far past Import's 1 MB text cap still restores: only the world's 200 recipes bound it.
  const heavy = Array.from({ length: 150 }, (_, i) => ({ ...copy, id: `heavy-${i}`, description: "x".repeat(10_000) }));
  assert.ok(JSON.stringify(heavy).length > 1_000_000);
  assert.equal(catalogRestorePlan(catalogBackup(state, heavy), starters).recipes.length, starters.length + 150);
  assert.throws(() => catalogRestorePlan(catalogBackup(state, Array.from({ length: 199 }, (_, i) => ({ ...copy, id: `h${i}` }))), starters), /Maximum 200 recipes/);
  const html = catalogRestoreDialogHTML("PF2e spell catalog", backup, { replaced: 1 });
  assert.match(html, /Put the PF2e spell catalog back as it was before its reset on .+\?/);
  assert.match(html, /Brings back 1 customised recipe: Mine\. 1 of them has been made again since and is replaced by the kept copy\./);
  assert.match(html, /including whether it was on/);
  assert.match(catalogRestoreDialogHTML("x", catalogBackup(state, [])), /No recipes were deleted\./);
});
