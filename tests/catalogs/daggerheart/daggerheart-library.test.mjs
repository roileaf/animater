import test from "node:test";
import assert from "node:assert/strict";
import { catalogNavigation, catalogPageAllowed, catalogPageTitle, worldCatalogSystem } from "../../../scripts/catalogs/shared/catalog-system.mjs";
import { DndCatalogWorkspace } from "../../../scripts/ui/dnd5e-catalog-ui.mjs";
import { dhCatalogProfile, dhEntries, useDhEntry, normalizeDhCatalogState } from "../../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
import { dhActorStates, dhStateVisible, resolveDhStateRecipe, dhDefeatedStates, dhStateHost, DH_DEFEATED_STATUSES } from "../../../scripts/catalogs/daggerheart/daggerheart-states.mjs";
import { dualityAccentRecipe, dualityAccent, HOPE_ASSETS, FEAR_ASSETS } from "../../../scripts/systems/daggerheart.mjs";
import { catalogStoreFor } from "../../../scripts/ui/activity-actions.mjs";
import { validateRecipe } from "../../../scripts/core/model.mjs";
import { installDefeatedLook, DEFEATED_RECIPE } from "../../../scripts/engines/playback/defeated-look.mjs";
import { PersistentStates } from "../../../scripts/engines/playback/persistent-states.mjs";
import { rollMessage, dualityRoll, adversaryRoll } from "../../fixtures/daggerheart-messages.mjs";

test("the Daggerheart LIBRARY group: domain cards, weapons, conditions", () => {
  const env = { systemId: "daggerheart" };
  assert.equal(worldCatalogSystem(env), "daggerheart");
  assert.deepEqual(catalogNavigation(env), [["spells", "✧", "Domain cards"], ["weapons", "➶", "Weapons"], ["conditions", "◎", "Conditions"]]);
  for (const page of ["feats", "actions", "features", "items", "effects"]) assert.equal(catalogPageAllowed(page, env), false, page);
  assert.equal(catalogPageAllowed("recipes", env), true);
  assert.equal(catalogPageTitle("spells", env), "Daggerheart domain card catalog");
  assert.equal(catalogPageTitle("conditions", env), "Daggerheart condition catalog");
  assert.equal(catalogPageTitle("activity", env), "Playback activity");
  assert.equal(catalogNavigation({ systemId: "dnd5e" })[0][2], "D&D 5e spells", "other systems unchanged");
});

function workspace(page = "spells") {
  const states = {}, opened = [];
  const w = { page, stageIndex: 0, host: { environment: () => ({ systemId: "daggerheart", ready: true }), dhCatalogState: (k) => states[k], setDhCatalogState: async (k, v) => { states[k] = { ...states[k], ...v }; },
    recipes: () => [], soundCatalog: () => null, resolveItem: async (uuid) => ({ sheet: { render: async () => opened.push(uuid) } }) }, recipePreviewHTML: () => "", render() {}, recipe() { return ui.recipe(); } };
  const ui = new DndCatalogWorkspace(w, dhCatalogProfile);
  return { ui, w, states, opened };
}

test("the domain card page: Daggerheart labels, levels 1-10, domain chips that filter, Use and details", async () => {
  const { ui, states, opened } = workspace();
  const html = ui.html();
  assert.ok(html.includes("DAGGERHEART · NATIVE CATALOG"));
  assert.ok(html.includes("210 domain cards"));
  assert.ok(html.includes("Level 10"));
  for (const absent of ["Cantrip", "2014", "D&D", "SF2e", "PF2e"]) assert.ok(!html.includes(absent), absent);
  assert.ok(html.includes('data-action="dnd-chip" data-value="Midnight"'));
  await ui.action("dnd-chip", { dataset: { value: "Midnight" } });
  const midnight = ui.matches();
  assert.equal(midnight.length, 21);
  assert.ok(midnight.every((e) => e.theme === "Midnight"));
  assert.ok(ui.html().includes('aria-pressed="true">Midnight'));
  await ui.action("dnd-details", {});
  assert.equal(opened[0], ui.entry().uuid);
  await ui.action("dnd-use", {});
  assert.ok(states.card.selected.includes(ui.entry().id));
  await ui.action("dnd-chip", { dataset: { value: "all" } });
  assert.equal(ui.matches().length, 210);
});

test("the weapon and condition pages", () => {
  const weapons = workspace("weapons").ui.html();
  assert.ok(weapons.includes("Weapon family"));
  assert.ok(weapons.includes("362 weapons"), "324 compendium weapons, 5 attack, 17 weapon-family, 7 feature and 9 ability fallbacks");
  const conditions = workspace("conditions").ui.html();
  assert.ok(conditions.includes("Lasting animation"), "persistent controls");
  assert.ok(conditions.includes("Death move"));
});

test("conditions as persistent states: Vulnerable, Hidden, Restrained; the defeated set follows the Defeated look", () => {
  const effect = (id, statuses, extra = {}) => ({ id, uuid: `Actor.a.ActiveEffect.${id}`, name: id, statuses: new Set(statuses), active: true, ...extra });
  const actor = { uuid: "Actor.a", appliedEffects: [effect("v", ["vulnerable"]), effect("d", ["dead"]), effect("buff", []), effect("off", ["hidden"], { disabled: true })], statuses: new Set(["vulnerable", "restrained", "dead"]) };
  const states = dhActorStates(actor);
  assert.deepEqual(states.map((s) => s.statusId ?? s.type), ["vulnerable", "effect", "restrained"]);
  assert.equal(states[0].document.id, "v");
  const on = { ...normalizeDhCatalogState(), enabled: true, scope: "all" };
  assert.equal(resolveDhStateRecipe(states[0], on).name, "Vulnerable");
  assert.equal(resolveDhStateRecipe(states[0], normalizeDhCatalogState()), null, "catalog off");
  assert.equal(dhStateHost.stateKind(states[0]), "condition");
  assert.equal(dhStateHost.documentKey(states[0]), "condition:vulnerable");
  assert.deepEqual([...DH_DEFEATED_STATUSES], ["defeated", "unconscious", "dead", "deathMove"]);
  const defeated = { id: "a", uuid: "Actor.a", effects: [effect("x", ["unconscious"]), effect("y", ["dead"])] };
  assert.equal(dhDefeatedStates(defeated, "effect").length, 1, "one layer per actor however many defeated statuses");
  assert.equal(dhDefeatedStates(defeated, "overlay").length, 0);
  assert.equal(dhDefeatedStates(defeated, "icon").length, 0);
  const hidden = { type: "condition", statusId: "hidden" }, token = { visible: true, document: { hidden: false } };
  assert.equal(dhStateVisible(hidden, token, { isGM: true }), true);
  assert.equal(dhStateVisible(hidden, token, { isGM: false }), false, "only owners and the GM see Hidden");
  assert.equal(dhStateVisible(hidden, { ...token, isOwner: true }, { isGM: false }), true);
  assert.equal(dhStateVisible({ type: "condition", statusId: "vulnerable" }, token), true);
});

test("Hope and Fear accents: gold or purple on the roller, none for a critical or a d20 roll", () => {
  const hope = validateRecipe(dualityAccentRecipe("hope")), fear = validateRecipe(dualityAccentRecipe("fear"));
  assert.deepEqual(hope.stages[0].assets, [...HOPE_ASSETS]);
  assert.deepEqual(fear.stages[0].assets, [...FEAR_ASSETS]);
  assert.ok(hope.stages[0].duration <= 700);
  assert.equal(dualityAccentRecipe("critical"), null);
  assert.equal(dualityAccent(rollMessage({ roll: dualityRoll({ hope: 9, fear: 2 }) }), "u").recipe.name, "Hope");
  assert.equal(dualityAccent(rollMessage({ roll: dualityRoll({ hope: 2, fear: 9 }) }), "u").tokenId, "t");
  assert.equal(dualityAccent(rollMessage({ roll: dualityRoll({ hope: 4, fear: 4 }) }), "u"), null);
  assert.equal(dualityAccent(rollMessage({ type: "adversaryRoll", roll: adversaryRoll() }), "u"), null);
  assert.equal(dualityAccent(rollMessage({ roll: dualityRoll({ hope: 9, fear: 2 }), whisper: ["gm"] }), "u"), null);
  assert.equal(dualityAccent(rollMessage({ roll: dualityRoll({ hope: 9, fear: 2 }), author: "other" }), "u"), null);
  assert.ok(dualityAccent(rollMessage({ roll: dualityRoll({ hope: 9, fear: 2, type: "trait" }) }), "u"), "any duality roll, not only attacks");
});

test("Activity Exclude reaches the Daggerheart catalog settings", async () => {
  const states = {}, host = { dhCatalogState: (k) => states[k] ?? {}, setDhCatalogState: async (k, c) => { states[k] = c; } };
  const store = catalogStoreFor(host, { type: "catalog", system: "daggerheart", kind: "card", id: dhEntries("card")[0].id });
  await store.set(useDhEntry(store.get(), dhEntries("card")[0].id));
  assert.ok(states.card.selected.includes(dhEntries("card")[0].id));
});

test("the Defeated look clears the overlay on every status in Daggerheart's defeated set", () => {
  for (const mode of ["overlay", "icon", "effect"]) {
    const on = new Map();
    installDefeatedLook({ on: (name, fn) => on.set(name, fn) }, { mode: () => mode, config: () => ({ specialStatusEffects: { DEFEATED: "dead" } }), statuses: () => DH_DEFEATED_STATUSES });
    for (const statusId of [...DH_DEFEATED_STATUSES, "vulnerable"]) {
      const doc = { statuses: new Set([statusId]), flags: { core: { overlay: true } }, updateSource(changes) { this.flags.core.overlay = changes["flags.core.overlay"]; } };
      on.get("preCreateActiveEffect")(doc, { statuses: [statusId], flags: { core: { overlay: true } } }, {}, "u");
      const cleared = mode !== "overlay" && statusId !== "vulnerable";
      assert.equal(doc.flags.core.overlay, !cleared, `${mode} ${statusId} create`);
      const changes = { "flags.core.overlay": true };
      on.get("preUpdateActiveEffect")({ statuses: new Set([statusId]), flags: { core: {} } }, changes, {}, "u");
      assert.equal(changes["flags.core.overlay"], !cleared, `${mode} ${statusId} update`);
    }
  }
});

test("Daggerheart's defeated layer: one per actor, kept until the last defeated status is removed", async () => {
  const calls = [], effect = (id, statuses) => ({ id, uuid: `Scene.s.Token.t.Actor.a.ActiveEffect.${id}`, statuses: new Set(statuses), active: true });
  const actor = { id: "a", uuid: "Scene.s.Token.t.Actor.a", items: [], effects: [], appliedEffects: [], statuses: new Set(), hasPlayerOwner: false };
  const token = { id: "t", name: "Orc", document: { uuid: "Scene.s.Token.t" }, actor, visible: true, w: 100, h: 100 };
  const proxy = new Proxy({}, { get: (_, method) => (...args) => { calls.push([method, ...args]); return proxy; } });
  const manager = new PersistentStates({ ...dhStateHost, clientId: "c", ready: () => true, sceneId: () => "s", tokens: () => [token], recipes: () => [],
    state: () => ({ enabled: false }), visibility: () => ({ isGM: true }), gridSize: () => 100,
    catalog: () => [{ key: "jb2a.toll_the_dead.grey.skull_smoke.01", file: "skull.webm", width: 400, height: 400 }],
    sequence: () => ({ effect: () => proxy, play: async (o) => calls.push(["play", o]) }), end: async (name) => calls.push(["end", name]),
    body: { add: () => {}, remove: () => {} },
    builtinStates: (t) => dhDefeatedStates(t.actor, "effect") });
  const plays = () => calls.filter((c) => c[0] === "play").length, ends = () => calls.filter((c) => c[0] === "end").length;
  const unconscious = effect("u", ["unconscious"]), dead = effect("d", ["dead"]);
  actor.effects = [unconscious]; await manager.reconcile();
  assert.equal(manager.active.size, 1); assert.equal(plays(), 1);
  assert.equal([...manager.active.values()][0].recipe, DEFEATED_RECIPE);
  actor.effects = [unconscious, dead]; await manager.reconcile();
  assert.equal(manager.active.size, 1, "a finisher's Dead on top: still one layer"); assert.equal(plays(), 1, "not restarted");
  actor.effects = [dead]; await manager.reconcile();
  assert.equal(manager.active.size, 1, "one status left: the layer stays"); assert.equal(plays(), 1); assert.equal(ends(), 0);
  actor.effects = []; await manager.reconcile();
  assert.equal(manager.active.size, 0, "the last one removed: it ends"); assert.equal(ends(), 1);
  await manager.destroy();
});

test("the defeated set's entries offer no Use, Customize or Exclude: they follow the Defeated look setting", () => {
  const { ui } = workspace("conditions");
  for (const status of ["defeated", "unconscious", "dead"]) {
    ui.selected.condition = `daggerheart-condition-${status}`;
    const html = ui.html();
    assert.equal(ui.entry().statusId, status);
    for (const action of ["dnd-use", "dnd-copy", "dnd-exclude"]) assert.ok(!html.includes(`data-action="${action}"`), `${status} ${action}`);
    assert.ok(html.includes("Defeated look setting"), status);
    assert.ok(html.includes('data-action="recipe-preview"'), "preview still works");
  }
  ui.selected.condition = "daggerheart-condition-vulnerable";
  const vulnerable = ui.html();
  // With the catalog off, an ordinary condition offers Use and Customize (Leave out only applies once the whole catalog is on).
  for (const action of ["dnd-use", "dnd-copy"]) assert.ok(vulnerable.includes(`data-action="${action}"`), `vulnerable ${action}`);
});
