import test from "node:test";
import assert from "node:assert/strict";
import { PF2E_ACTION_CATALOG, PF2E_FEATURE_CATALOG, PF2E_ACTIONS, PF2E_CLASS_FEATURES, findRiders, riderRecipes } from "../../scripts/catalogs/pf2e/ability-catalog.mjs";
import { PF2E_FEATS, featRecipe, resolveAutomaticFeatRecipe, useCatalogFeat } from "../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { pf2eEvent } from "../../scripts/systems/adapters.mjs";
import { AnimaterRuntime } from "../../scripts/engines/playback/runtime.mjs";
import { catalogNavigation, catalogPageAllowed, catalogPageTitle } from "../../scripts/catalogs/shared/catalog-system.mjs";
import { SF_KINDS, sfEntries, normalizeSfCatalogState, findSfEntry } from "../../scripts/catalogs/sf2e/sf2e-catalog.mjs";
import { featCatalogHTML, ABILITY_PAGE_PROFILES } from "../../scripts/ui/feat-catalog-ui.mjs";

const action = (name) => PF2E_ACTIONS.find((e) => e.name === name);
const sneak = PF2E_CLASS_FEATURES.find((e) => e.slug === "sneak-attack");

test("Actions catalog carries native actions with native uuids and non-colliding recipe ids", () => {
  for (const name of ["Glimpse of Redemption", "Rage", "Demoralize", "Raise a Shield"]) {
    const entry = action(name);
    assert.ok(entry, name);
    assert.equal(entry.itemType, "action");
    assert.equal(entry.uuid, `Compendium.pf2e.actionspf2e.Item.${entry.id}`);
    const recipe = PF2E_ACTION_CATALOG.recipe(entry);
    assert.equal(recipe.id, `pf2e-action-${entry.id}`);
    assert.equal(recipe.itemUuid, entry.uuid);
    assert.equal(recipe.trigger, "use");
    assert.ok(recipe.stages.length > 0);
    assert.equal(PF2E_ACTION_CATALOG.entry(recipe.id), entry);
  }
  // Feats keep their ids and feats-srd uuids.
  const feat = PF2E_FEATS.find((f) => f.slug === "sudden-charge");
  assert.equal(featRecipe(feat).id, `pf2e-feat-${feat.id}`);
  assert.equal(featRecipe(feat).itemUuid, `Compendium.pf2e.feats-srd.Item.${feat.id}`);
  assert.ok(PF2E_ACTIONS.every((e) => e.uuid?.startsWith("Compendium.pf2e.actionspf2e.Item.")));
  assert.ok(PF2E_CLASS_FEATURES.every((e) => /^Compendium\.pf2e\.(classfeatures|ancestryfeatures)\.Item\./.test(e.uuid)));
});

test("Sneak Attack is a Features damage rider with its own recipe", () => {
  assert.ok(sneak);
  assert.equal(sneak.rider, "sneak-attack");
  assert.equal(sneak.trigger, "damage");
  assert.equal(sneak.uuid, `Compendium.pf2e.classfeatures.Item.${sneak.id}`);
  const recipe = PF2E_FEATURE_CATALOG.recipe(sneak);
  assert.equal(recipe.id, `pf2e-feature-${sneak.id}`);
  assert.equal(recipe.trigger, "damage");
  assert.ok(PF2E_CLASS_FEATURES.some((e) => e.slug === "flurry-of-blows" && !e.rider));
});

test("action and feature items route through their own catalogs, not Feats", () => {
  const rage = action("Rage");
  const event = { type: "use", systemId: "pf2e", item: { type: "action", name: "Rage", system: { slug: "rage", actionType: { value: "action" } }, _stats: { compendiumSource: rage.uuid } } };
  assert.equal(PF2E_ACTION_CATALOG.find(event), rage);
  assert.equal(PF2E_ACTION_CATALOG.resolveAutomaticRecipe(event, {}), null, "disabled catalog plays nothing");
  const recipe = PF2E_ACTION_CATALOG.resolveAutomaticRecipe(event, PF2E_ACTION_CATALOG.use({}, rage.id));
  assert.equal(recipe.id, `pf2e-action-${rage.id}`);
  // An enabled feat catalog does not claim the action.
  assert.equal(resolveAutomaticFeatRecipe(event, useCatalogFeat({}, PF2E_FEATS[0].id)), null);
  // Excluded entries do not play.
  const all = PF2E_ACTION_CATALOG.normalizeState({ enabled: true, scope: "all", independent: true, excluded: [rage.id] });
  assert.equal(PF2E_ACTION_CATALOG.resolveAutomaticRecipe(event, all), null);
  // Features match feat items in the class/ancestry feature categories only.
  const flurry = PF2E_CLASS_FEATURES.find((e) => e.slug === "flurry-of-blows");
  const featureEvent = { type: "use", item: { type: "feat", name: "Flurry of Blows", system: { category: "classfeature" }, flags: { core: { sourceId: flurry.uuid } } } };
  assert.equal(PF2E_FEATURE_CATALOG.find(featureEvent), flurry);
  assert.equal(PF2E_FEATURE_CATALOG.find({ ...featureEvent, item: { ...featureEvent.item, system: { category: "class" } } }), null);
  assert.equal(PF2E_FEATURE_CATALOG.resolveAutomaticRecipe(featureEvent, PF2E_FEATURE_CATALOG.use({}, flurry.id)).id, `pf2e-feature-${flurry.id}`);
});

test("damage roll with Sneak Attack dice plays the rider beside the weapon recipe", async () => {
  const message = { id: "dmg", author: { id: "u" }, isDamageRoll: true, isRoll: true, item: { type: "weapon", name: "Dagger", system: {} }, speaker: { token: "t", scene: "s" },
    flags: { pf2e: { context: { type: "damage-roll", options: [] }, origin: { uuid: "Actor.a.Item.w" },
      dice: [{ slug: "sneak-attack", enabled: true, ignored: false, category: "precision" }, { slug: "deadly-d8", enabled: false, ignored: true }],
      modifiers: [{ slug: "str", enabled: true }] } } };
  const event = pf2eEvent(message, "u");
  assert.equal(event.type, "damage");
  assert.deepEqual(event.damageSlugs, ["dice:sneak-attack", "modifier:str"]);
  assert.deepEqual(findRiders(event).map((e) => e.slug), ["sneak-attack"]);
  // Disabled (predicate failed) dice are not a signal.
  const off = pf2eEvent({ ...message, flags: { pf2e: { ...message.flags.pf2e, dice: [{ slug: "sneak-attack", enabled: false, ignored: true }] } } }, "u");
  assert.deepEqual(findRiders(off), []);
  // Precise Strike: flat modifier or finisher dice; Precision: hunter's edge dice.
  assert.deepEqual(findRiders({ type: "damage", damageSlugs: ["modifier:precise-strike"] }).map((e) => e.slug), ["precise-strike"]);
  assert.deepEqual(findRiders({ type: "damage", damageSlugs: ["dice:precision"] }).map((e) => e.slug), ["precision"]);
  assert.deepEqual(findRiders({ type: "attack", damageSlugs: ["dice:sneak-attack"] }), []);
  // Strategic Strike (the investigator's stratagem damage) plays with GGG's own Strategic Strike sound.
  const strategic = findRiders({ type: "damage", damageSlugs: ["dice:strategic-strike"] });
  assert.deepEqual(strategic.map((e) => e.slug), ["strategic-strike"]);
  const sounds = { resolve: (c) => ({ ...c, duration: c.duration ?? 1000 }) };
  const cue = PF2E_FEATURE_CATALOG.recipe(strategic[0], {}, sounds).stages.find((s) => s.kind === "sound");
  assert.match(cue?.soundFile ?? "", /^modules\/ggg\/.*strategic-strike-[ab]\.ogg$/);
  assert.deepEqual(riderRecipes(event, {}), [], "rider needs its catalog enabled");
  const state = PF2E_FEATURE_CATALOG.use({}, sneak.id);
  assert.deepEqual(riderRecipes(event, state).map((r) => r.id), [`pf2e-feature-${sneak.id}`]);
  // A saved customization for the rider wins unless the catalog entry was chosen.
  const custom = { ...PF2E_FEATURE_CATALOG.recipe(sneak), id: "my-sneak" };
  assert.deepEqual(riderRecipes(event, { ...state, selected: [], customized: [sneak.id] }, [custom]).map((r) => r.id), ["my-sneak"]);

  const played = [], traces = [];
  const weapon = { id: "weapon-recipe", name: "Dagger", stages: [] };
  const runtime = new AnimaterRuntime({ enabled: () => true, recipes: () => [], resolveRecipe: () => weapon, riderRecipes: (e) => riderRecipes(e, state), onTrace() {} });
  runtime.play = async (recipe) => { played.push(recipe.id); };
  runtime.trace = (status, detail) => traces.push(status);
  await runtime.dispatch(event);
  assert.deepEqual(played, ["weapon-recipe", `pf2e-feature-${sneak.id}`]);
  // The rider still plays when the weapon has no recipe; no rider and no recipe is skipped.
  played.length = 0;
  runtime.host.resolveRecipe = () => null;
  await runtime.dispatch({ ...event, id: "dmg2" });
  assert.deepEqual(played, [`pf2e-feature-${sneak.id}`]);
  await runtime.dispatch({ ...event, id: "dmg3", damageSlugs: [] });
  assert.deepEqual(played, [`pf2e-feature-${sneak.id}`]);
  assert.equal(traces.at(-1), "Skipped");
});

test("navigation shows Actions and Features for PF2e and SF2e but not D&D; settings normalize", () => {
  for (const systemId of ["pf2e", "sf2e"]) {
    const pages = catalogNavigation({ systemId }).map(([page]) => page);
    assert.ok(pages.includes("actions") && pages.includes("features"), systemId);
    assert.ok(catalogPageAllowed("actions", { systemId }) && catalogPageAllowed("features", { systemId }));
    assert.match(catalogPageTitle("actions", { systemId }), /action catalog$/);
  }
  const dnd = catalogNavigation({ systemId: "dnd5e" }).map(([page]) => page);
  assert.ok(!dnd.includes("actions") && !dnd.includes("features"));
  assert.equal(catalogPageAllowed("actions", { systemId: "dnd5e" }), false);
  assert.deepEqual(PF2E_ACTION_CATALOG.normalizeState(null), { enabled: false, independent: false, scope: "all", selected: [], excluded: [], customized: [], preferCatalog: false, motion: true, sound: true, soundVolume: 0.35 });
  const rage = action("Rage");
  const state = PF2E_ACTION_CATALOG.normalizeState({ enabled: true, selected: [`pf2e-action-${rage.id}`, "bogus", rage.id], soundVolume: 9 });
  assert.deepEqual(state.selected, [rage.id]);
  assert.equal(state.soundVolume, 1);
  // SF2e gets its own action/feature kinds.
  assert.ok(SF_KINDS.includes("action") && SF_KINDS.includes("feature"));
  assert.ok(sfEntries("action").length > 0 && sfEntries("feature").length > 0);
  assert.ok(sfEntries("action").every((e) => e.pack === "actions" && e.variants[0].recipe.id.startsWith("sf2e-action-")));
  assert.ok(sfEntries("feature").every((e) => ["class-features", "ancestry-features"].includes(e.pack)));
  assert.ok(sfEntries("feat").every((e) => !["actions", "class-features", "ancestry-features"].includes(e.pack)));
  const sfAction = sfEntries("action")[0];
  assert.equal(findSfEntry({ type: "use", systemId: "sf2e", item: { type: "action", name: sfAction.name, slug: sfAction.slug } })?.kind, "action");
  assert.deepEqual(normalizeSfCatalogState({ selected: [sfAction.id, "bogus"] }).selected, [sfAction.id]);
});

test("Actions and Features pages render through the shared feat page profile", () => {
  for (const [page, name] of [["actions", "Demoralize"], ["features", "Sneak Attack"]]) {
    const profile = ABILITY_PAGE_PROFILES[page];
    let state = {};
    const w = { busy: false, [profile.selectedKey]: profile.catalog.entries.find((e) => e.name === name).id,
      host: { environment: () => ({ systemId: "pf2e", ready: true }), [profile.stateKey]: () => state, recipes: () => [], enabled: () => false, soundCatalog: () => null },
      previewDuration: () => 1000, recipePreviewHTML: () => "" };
    const html = featCatalogHTML(w, profile);
    assert.match(html, new RegExp(`data-action="${profile.key}-auto"`));
    assert.match(html, new RegExp(`data-action="select-${profile.key}"`));
    assert.match(html, new RegExp(`data-search="${page}"`));
    assert.match(html, new RegExp(name));
    assert.doesNotMatch(html, /data-action="feat-auto"/);
  }
  assert.match(ABILITY_PAGE_PROFILES.actions.intro, /Demoralize, Grapple, Raise a Shield, Rage, Glimpse of Redemption/);
  assert.match(ABILITY_PAGE_PROFILES.features.intro, /Flurry of Blows and Sneak Attack/);
});
