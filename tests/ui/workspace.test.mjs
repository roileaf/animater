import test from "node:test";
import assert from "node:assert/strict";
import { Workspace } from "../../scripts/ui/workspace.mjs";
import { studioHTML } from "../../scripts/ui/studio.mjs";
import { PF2E_SPELLS, spellRecipe } from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { PF2E_FEATS, featRecipe } from "../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe } from "../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import {withUnconfiguredSpell} from '../helpers/catalog-fixtures.mjs';

test("large rectangular preview tokens retain footprint, mirrored texture and chain centers", () => {
  const w = Object.create(Workspace.prototype);
  const token = {
    width: 2,
    height: 1,
    spriteWidth: 3,
    spriteHeight: 1.5,
    textureScaleX: -1,
    rotation: 30,
    img: "token.webp",
  };
  const normal = w.previewActorHTML({
    subject: "source",
    token,
    name: "Source",
  });
  assert.match(
    normal,
    /width:110px;margin-left:-55px;top:calc\(45% \+ 27px - 27.5px\)/,
  );
  assert.match(normal, /width:165px;height:82.5px/);
  assert.match(normal, /rotate\(30deg\) scale\(-1,1\)/);
  const chain = w.previewActorHTML({
    subject: "targets",
    token,
    name: "Target",
    x: 70,
    y: 45,
    id: "t1",
    targetIndex: 0,
  });
  assert.match(chain, /top:calc\(45% - 27.5px\);left:70%/);
  assert.match(chain, /data-preview-actor="t1"/);
});

function workspace() {
  const w = Object.create(Workspace.prototype);
  Object.assign(w, {
    page: "recipes",
    selected: "frost",
    stageIndex: 0,
    previewMode: "recipe",
    category: "All",
    busy: false,
    message: "",
    drafts: new Map(),
    dirty: new Set(),
    root: { querySelectorAll: () => [], querySelector: () => null },
  });
  let renders = 0;
  w.render = () => {
    renders++;
  };
  const click = async (dataset) =>
    w.onClick({
      target: { closest: () => ({ dataset, disabled: false }) },
      preventDefault() {},
    });
  return { w, click, renders: () => renders };
}

test('strike scopes clear per-item constraints; switching trigger or dropping an item restores specific binding', async () => {
  const f = workspace();
  const r = { id: 'melee', name: 'Melee', trigger: 'attack', match: 'sword', itemUuid: 'Item.old', activityId: 'old-activity', catalogEntry: 'old-entry', stages: [{ kind: 'motion', motion: 'lunge' }] };
  f.w.edit = () => r;
  f.w.stopEditorPreview = () => {};
  const field = (key, value) => f.w.updateField({ dataset: { field: key }, type: 'select-one', value });
  field('matchScope', 'melee');
  assert.equal(r.itemUuid, '');
  assert.equal(r.weaponMode, 'melee');
  assert.equal(r.activityId, undefined);
  assert.equal(r.catalogEntry, undefined);
  f.w.host = { catalog: () => [], recipes: () => [] };
  const html = f.w.recipeSettingsHTML(r);
  assert.match(html, /All melee strikes/);
  assert.doesNotMatch(html, /data-field="match"/);
  assert.doesNotMatch(html, /data-field="weaponMode"/);
  field('matchScope', 'ranged');
  assert.equal(r.matchScope, 'ranged');
  assert.equal(r.weaponMode, 'ranged');
  assert.match(f.w.recipeSettingsHTML(r), /value="ranged" selected/);
  assert.match(f.w.recipeSettingsHTML(r), /every ranged weapon or NPC ranged strike/);
  field('trigger', 'use');
  assert.equal(r.matchScope, undefined);
  assert.equal(r.weaponMode, undefined);
  field('trigger', 'attack'); field('matchScope', 'ranged'); field('matchScope', '');
  assert.equal(r.matchScope, undefined);
  assert.equal(r.weaponMode, undefined);
  field('trigger', 'attack'); field('matchScope', 'melee');
  f.w.host.resolveItem = async () => ({ uuid: 'Item.new', name: 'Spear' });
  await f.w.onDrop({ target: { closest: selector => selector === '.an-binding' ? {} : null }, preventDefault() {}, dataTransfer: { getData: () => JSON.stringify({ type: 'Item', uuid: 'Item.new' }) } });
  assert.equal(r.matchScope, undefined);
  assert.equal(r.itemUuid, 'Item.new');
  assert.equal(r.match, 'Spear');
});

test('teleport settings show installed looks and persist selected departure and arrival art', () => {
  const f = workspace(), r = { match: 'Misty Step', stages: [] };
  f.w.host = { catalog: () => ['jb2a.misty_step.01.purple', 'jb2a.misty_step.02.purple'].map(key => ({ key })) };
  f.w.edit = () => r;
  f.w.stopEditorPreview = () => {};
  let html = f.w.teleportHTML(r);
  assert.match(html, /Teleport look/);
  assert.match(html, /value="purple"[^>]*>Purple mist/);
  assert.match(html, /value="green"[^>]*disabled/);
  f.w.updateField({ dataset: { field: 'teleportStyle' }, type: 'select-one', value: 'purple' });
  assert.equal(r.teleportOut, 'jb2a.misty_step.01.purple');
  assert.equal(r.teleportIn, 'jb2a.misty_step.02.purple');
  assert.equal(r.teleportStyle, undefined, 'style selector is derived, not persisted');
  html = f.w.teleportHTML(r);
  assert.match(html, /value="purple" selected/);
  f.w.updateField({ dataset: { field: 'teleportStyle' }, type: 'select-one', value: 'none' });
  assert.equal(r.teleportOut, 'none');
  assert.equal(r.teleportIn, 'none');
  r.teleport = 'none';
  assert.doesNotMatch(f.w.teleportHTML(r), /Teleport look/);
});

test('teleport asset cards preview default, custom and missing art; none/default controls edit each cue separately', async () => {
  const f = workspace();
  const r = {id:'teleport', match:'Misty Step', stages:[{kind:'motion', motion:'lunge'}], teleportIn:'worlds/demo/arrival.png'};
  const originalStages = structuredClone(r.stages);
  f.w.edit = () => r;
  f.w.recipe = () => r;
  f.w.stopEditorPreview = () => {};
  f.w.host = {catalog:()=>[{key:'jb2a.misty_step.01.blue',file:'modules/jb2a/departure.webm'}]};
  let html = f.w.teleportHTML(r);
  assert.match(html, /data-action="browse-teleport" data-field="teleportOut"/);
  assert.match(html, /<video[^>]+src="modules\/jb2a\/departure.webm"[^>]+data-asset-thumb/);
  assert.match(html, /<img[^>]+src="worlds\/demo\/arrival.png"/);
  assert.doesNotMatch(html, /datalist|list="an-teleport-art"|<input data-field="teleport(?:Out|In)"/);
  await f.click({action:'teleport-asset-none',field:'teleportOut'});
  assert.equal(r.teleportOut, 'none');
  assert.equal(r.teleportIn, 'worlds/demo/arrival.png');
  assert.match(f.w.teleportAssetHTML(r,'teleportOut','Departure effect'), /No effect/);
  await f.click({action:'teleport-asset-default',field:'teleportOut'});
  assert.equal(r.teleportOut, undefined);
  assert.match(f.w.teleportAssetHTML(r,'teleportOut','Departure effect'), /departure.webm/);
  r.teleportOut = 'missing.asset.key';
  assert.match(f.w.teleportAssetHTML(r,'teleportOut','Departure effect'), /Preview unavailable/);
  assert.deepEqual(r.stages, originalStages);
  let opened;
  f.w.mediaLibrary = {action:async()=>false,open:(...args)=>{opened=args;}};
  await f.click({action:'browse-teleport',field:'teleportIn'});
  assert.deepEqual(opened, ['animation','teleportIn']);
});

test('unconfigured spell opens a local blank draft and never saves generic placeholder art',async()=>{
 await withUnconfiguredSpell('500 Toads',async spell=>{
 const f=workspace();
 let state={enabled:true,selected:[spell.id]},saves=0;
 Object.assign(f.w,{page:'spells',selectedSpell:spell.id});
 f.w.host={recipes:()=>[],save:async()=>{saves++;},catalogState:()=>state,setCatalogState:async c=>{state={...state,...c};}};
 await f.click({action:'copy-spell'});
 assert.equal(saves,0);
 assert.equal(f.w.page,'recipes');
 assert.equal(f.w.selected,`pf2e-${spell.id}`);
 assert.ok(f.w.dirty.has(f.w.selected));
 const draft=f.w.drafts.get(f.w.selected);
 assert.deepEqual(draft.stages[0].assets,[]);
 assert.equal(draft.stages[0].kind,'template');
 assert.equal(draft.enabled,false);
 assert.equal(draft.itemUuid,`Compendium.pf2e.spells-srd.Item.${spell.id}`);
 assert.ok(state.customized.includes(spell.id));
 });
});

test("catalog names open the correct native item sheet without rerendering or changing selection", async () => {
  const f = workspace(), calls = [];
  f.w.host = { resolveItem: async uuid => {
    calls.push(uuid);
    return { sheet: { render: async options => calls.push(options) } };
  } };
  const entries = [
    ["spell", "spells-srd", PF2E_SPELLS.find(s => s.name === "Fireball")],
    ["feat", "feats-srd", PF2E_FEATS.find(f => f.slug === "twin-takedown")],
    ["weapon", "equipment-srd", PF2E_WEAPONS.find(w => w.slug === "acid-flask-lesser")],
  ];
  for (const [kind, pack, item] of entries) {
    await f.click({ action: "item-details", kind, id: item.id });
    assert.equal(calls.at(-2), `Compendium.pf2e.${pack}.Item.${item.id}`);
    assert.deepEqual(calls.at(-1), { force: true });
  }
  assert.equal(f.renders(), 0);
  assert.equal(f.w.selected, "frost");
  assert.equal(f.w.page, "recipes");
});

test("weapon mode buttons update preview; use and customize retain separate modes", async () => {
 const f=workspace(),weapon=PF2E_WEAPONS.find(w=>w.slug==='dagger');
 let state={enabled:false},saved=[];
 Object.assign(f.w,{page:'weapons',selectedWeapon:weapon.id,weaponMode:'melee',weaponFilters:{search:'',group:'all',mode:'all',category:'all',edition:'all'}});
 f.w.host={weaponCatalogState:()=>state,setWeaponCatalogState:async c=>{state={...state,...c};},recipes:()=>saved,save:async r=>{saved=r;},environment:()=>({systemId:'pf2e',ready:true}),enabled:()=>false};
 await f.click({action:'weapon-mode',mode:'thrown'});assert.equal(f.w.recipe().weaponMode,'thrown');assert.equal(f.w.weaponMode,'thrown');
 await f.click({action:'use-weapon'});assert.ok(state.selected.includes(weapon.id));assert.equal(saved.length,0);
 await f.click({action:'copy-weapon'});assert.equal(saved.length,1);assert.equal(saved[0].weaponMode,'thrown');assert.ok(state.customized.includes(`${weapon.id}:thrown`));assert.equal(f.w.page,'recipes');
 f.w.page='weapons';f.w.weaponMode='thrown';await f.click({action:'copy-weapon'});assert.equal(saved.length,1);
 f.w.page='weapons';f.w.weaponMode='melee';await f.click({action:'copy-weapon'});assert.equal(saved.length,2);assert.equal(saved[1].weaponMode,'melee');
});

test("feat sound toggle and volume affect preview recipes without modifying saved stages", async () => {
 const f=workspace(),feat=PF2E_FEATS.find(f=>f.slug==='double-slice');let state={sound:true,soundVolume:.35};
 Object.assign(f.w,{page:'feats',selectedFeat:feat.id});
 f.w.host={featCatalogState:()=>state,setFeatCatalogState:async c=>{state={...state,...c};},soundCatalog:()=>({resolve:c=>c})};
 assert.ok(f.w.recipe().stages.some(s=>s.kind==='sound'));
 await f.click({action:'feat-sound'});assert.ok(!f.w.recipe().stages.some(s=>s.kind==='sound'));
 await f.click({action:'feat-sound'});state.soundVolume=.15;assert.ok(f.w.recipe().stages.filter(s=>s.kind==='sound').every(s=>Math.abs(s.volume-.15*(s.optionalSound?.gain??1))<1e-10));
});

test("active feats use catalog data without saved slots and do not change spell settings", async () => {
  const f = workspace(), feat = PF2E_FEATS.find((v) => v.slug === "sudden-charge");
  let state = { enabled: false, excluded: [feat.id], motion: false };
  const spellState = { enabled: true, selected: ["spell-choice"] };
  f.w.page = "feats";
  f.w.selectedFeat = feat.id;
  f.w.host = {
    recipes: () => Array.from({ length: 200 }, (_, i) => ({ id: `custom-${i}` })),
    featCatalogState: () => state,
    setFeatCatalogState: async (change) => { state = { ...state, ...change }; },
    catalogState: () => spellState,
    setCatalogState: () => assert.fail("Feat controls must not alter spells"),
    save: () => assert.fail("Catalog use consumes no saved slots"),
    enabled: () => false,
    environment: () => ({ systemId: "pf2e", ready: true }),
  };
  await f.click({ action: "use-feat" });
  assert.equal(state.independent, true);
  assert.equal(state.scope, "selected");
  assert.deepEqual(state.selected, [feat.id]);
  assert.deepEqual(state.excluded, []);
  assert.equal(state.motion, false);
  await f.click({ action: "feat-auto" });
  assert.equal(state.scope, "all");
  assert.equal(state.preferCatalog, true);
  await f.click({ action: "feat-auto" });
  assert.equal(state.enabled, false);
  assert.deepEqual(spellState, { enabled: true, selected: ["spell-choice"] });
});

test("feat customization reuses saved edits and retained catalog state; current selection does not rerender", async () => {
  const f = workspace(), feat = PF2E_FEATS.find((v) => v.slug === "sudden-charge");
  let state = { enabled: true, scope: "all", selected: [feat.id], customized: [] };
  const recipe = { ...featRecipe(feat), name: "Edited charge", enabled: false };
  f.w.page = "feats";
  f.w.selectedFeat = feat.id;
  f.w.host = {
    recipes: () => [recipe], featCatalogState: () => state,
    setFeatCatalogState: async (change) => { state = { ...state, ...change }; },
    save: () => assert.fail("Do not duplicate existing feat edits"),
  };
  await f.click({ action: "select-feat", id: feat.id });
  assert.equal(f.renders(), 0);
  await f.click({ action: "copy-feat" });
  assert.equal(f.w.page, "recipes");
  assert.equal(f.w.selected, recipe.id);
  assert.deepEqual(state.selected, []);
  assert.deepEqual(state.customized, [feat.id]);
  assert.equal(recipe.name, "Edited charge");
  assert.equal(recipe.enabled, false);
});
test("Use animation activates only its catalog choice even when custom recipe storage is full", async () => {
  const f = workspace(),
    spell = PF2E_SPELLS.find((s) => s.name === "Frostbite");
  let state = { enabled: false, excluded: [spell.id], motion: false },
    saves = 0,
    customAutomation = 0;
  const saved = Array.from({ length: 200 }, (_, i) => ({ id: `custom-${i}` }));
  f.w.page = "spells";
  f.w.selectedSpell = spell.id;
  f.w.host = {
    recipes: () => saved,
    catalogState: () => state,
    setCatalogState: async (change) => {
      state = { ...state, ...change };
    },
    enabled: () => false,
    setEnabled: async () => {
      customAutomation++;
    },
    save: async () => {
      saves++;
    },
    environment: () => ({ systemId: "pf2e", ready: true }),
  };
  await f.click({ action: "use-spell" });
  assert.equal(state.enabled, true);
  assert.equal(state.independent, true);
  assert.equal(state.scope, "selected");
  assert.deepEqual(state.selected, [spell.id]);
  assert.deepEqual(state.excluded, []);
  assert.equal(state.motion, false);
  assert.equal(saves, 0);
  assert.equal(customAutomation, 0);
  assert.equal(saved.length, 200);
  assert.equal(f.w.page, "spells");
});
test("Use entire catalog enables defaults in one action without activating unrelated saved recipes", async () => {
  const f = workspace();
  let state = { enabled: false, excluded: [], motion: false };
  f.w.host = {
    catalogState: () => state,
    setCatalogState: async (change) => {
      state = { ...state, ...change };
    },
    enabled: () => false,
    setEnabled: async () => assert.fail("Must not activate custom automation"),
  };
  await f.click({ action: "catalog-auto" });
  assert.equal(state.enabled, true);
  assert.equal(state.scope, "all");
  assert.equal(state.independent, true);
  assert.equal(state.preferCatalog, true);
  await f.click({ action: "catalog-auto" });
  assert.equal(state.enabled, false);
});
test("Customize switches to saved edits without deleting a prior catalog choice or duplicating recipes", async () => {
  const f = workspace(),
    spell = PF2E_SPELLS.find((s) => s.name === "Shield");
  let state = {
    enabled: true,
    independent: true,
    scope: "all",
    preferCatalog: true,
    selected: [spell.id],
    customized: [],
  };
  const recipe = {
    ...spellRecipe(spell),
    name: "Custom Shield",
    enabled: false,
  };
  f.w.page = "spells";
  f.w.selectedSpell = spell.id;
  f.w.host = {
    recipes: () => [recipe],
    save: async () => assert.fail("Must reuse existing edits"),
    catalogState: () => state,
    setCatalogState: async (change) => {
      state = { ...state, ...change };
    },
  };
  await f.click({ action: "copy-spell" });
  assert.equal(f.w.page, "recipes");
  assert.equal(f.w.selected, recipe.id);
  assert.deepEqual(state.selected, []);
  assert.deepEqual(state.customized, [spell.id]);
  assert.equal(recipe.name, "Custom Shield");
  assert.equal(recipe.enabled, false);
});
test("clicking current recipe, stage or preview tab does not redraw", async () => {
  const f = workspace();
  f.w.studio = true;
  await f.click({ action: "stage", index: "0" });
  await f.click({ action: "select", id: "frost" });
  await f.click({ action: "preview-mode", mode: "recipe" });
  assert.equal(f.renders(), 0);
  f.w.studio = false;
  await f.click({ action: "select", id: "frost" });
  assert.equal(f.w.studio, true, "picking a recipe opens it in the studio");
});

test("New recipe opens an unconfigured manual draft and saves only after choosing an asset", async () => {
  const f = workspace();
  let saved = [spellRecipe(PF2E_SPELLS.find((s) => s.name === "Shield"))],
    saves = 0;
  const original = saved[0];
  f.w.host = {
    recipes: () => saved,
    save: async (recipes) => {
      saved = recipes;
      saves++;
    },
    catalog: () => [],
  };
  f.w.search = "shield";
  f.w.previewMode = "stage";
  await f.click({ action: "new" });
  assert.ok(f.w.newChooser, "New recipe always offers blank or a template");
  await f.click({ action: "new-action" });
  assert.equal(f.w.page, "recipes");
  assert.equal(saves, 0);
  const draft = f.w.recipe();
  assert.equal(draft.name, "Untitled recipe");
  assert.equal(draft.description, "");
  assert.equal(draft.trigger, "manual");
  assert.equal(draft.category, "Custom");
  assert.equal(draft.stages.length, 1);
  assert.deepEqual(draft.stages[0].assets, []);
  assert.equal(draft.match, "");
  assert.equal(draft.itemUuid, "");
  await f.click({ action: "save" });
  assert.equal(saves, 0);
  assert.ok(f.w.dirty.has(draft.id));
  assert.ok(f.w.dirty.has(draft.id));
  assert.equal(f.w.previewMode, "recipe");
  assert.equal(f.w.search, "");
  assert.ok(f.w.listedRecipes().some((r) => r.id === draft.id));
  await f.click({ action: "select", id: original.id });
  await f.click({ action: "select", id: draft.id });
  assert.equal(f.w.recipe(), draft);
  await f.click({ action: "choose-asset", key: "jb2a.impact.001.blue" });
  await f.click({ action: "save" });
  assert.equal(saved.length, 2);
  assert.equal(saved[0], original);
  assert.deepEqual(saved[1].stages[0].assets, ["jb2a.impact.001.blue"]);
  assert.equal(saves, 1);
  assert.equal(f.w.dirty.has(draft.id), false);
});

test("new draft deletion never writes saved recipes or asks to delete world data", async () => {
  const f = workspace();
  f.w.host = {
    recipes: () => [],
    save: () => assert.fail("Unsaved draft must not write world settings"),
    confirm: () => assert.fail("Draft discard needs no deletion prompt"),
  };
  await f.click({ action: "new" });
  await f.click({ action: "delete" });
  assert.equal(f.w.listedRecipes().length, 0);
  assert.equal(f.w.dirty.size, 0);
});

test("Chromatic Orb starter requires explicit selection; reverting a new draft discards it", async () => {
  const f = workspace();
  f.w.host = { recipes: () => [], catalog: () => [] };
  await f.click({ action: "orb-builder" });
  assert.equal(f.w.page, "builder");
  assert.equal(f.w.builder.element, "fire");
  await f.click({ action: "new-basic" });
  assert.equal(f.w.page, "recipes");
  assert.equal(f.w.builder, null);
  assert.equal(f.w.recipe().stages.length, 1);
  await f.click({ action: "revert" });
  assert.equal(f.w.listedRecipes().length, 0);
  assert.equal(f.w.recipe(), undefined);
});
test("stage navigation updates selected stage without replacing library", async () => {
  const f = workspace();
  let updates = 0;
  f.w.updateInspector = () => {
    updates++;
  };
  await f.click({ action: "stage", index: "1" });
  assert.equal(f.w.stageIndex, 1);
  assert.equal(f.renders(), 0);
  assert.equal(updates, 1);
});

test("motion recipes expose unavailable channel before automatic playback", () => {
  const { w } = workspace();
  w.host = { environment: () => ({ motionReady: false }), catalog: () => [] };
  const recipe = { stages: [{ kind: "motion" }] };
  assert.equal(w.status(recipe), "Token motion channel unavailable");
  w.host.environment = () => ({ motionReady: true });
  assert.equal(w.status(recipe), "Ready to play");
  w.host.environment = () => ({ motionReady: false });
  w.host.environment = () => ({ motionReady: false, demo: true });
  assert.equal(w.status(recipe), "Ready to play");
});

test("recipe editor shows loaded server version and keeps table playback blocked until manifest reload", () => {
  const { w } = workspace();
  const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.name === "Frostbite"));
  w.host = {
    environment: () => ({ motionReady: false, motionServerVersion: "0.1.0" }),
    catalog: () => [],
  };
  w.recipePreviewHTML = () => "<div data-recipe-scene></div>";
  const blocked = studioHTML(w, recipe);
  assert.match(blocked, /Server loaded Animater 0\.1\.0/);
  assert.match(blocked, /data-action="play"[^>]*disabled/);
  assert.doesNotMatch(blocked, /Server restart required/);
  w.host.environment = () => ({
    motionReady: true,
    motionServerVersion: "0.2.0",
  });
  assert.doesNotMatch(w.inspectorHTML(recipe), /an-sync-notice/);
});

test("catalog customization preserves saved recipes and reopens bound overrides without duplicating", async () => {
  const f = workspace();
  const spell = PF2E_SPELLS.find((s) => s.name === "Shield");
  const untouched = { id: "mine", name: "User recipe", stages: [] };
  let saved = [untouched];
  let saves = 0;
  f.w.host = {
    recipes: () => saved,
    save: async (recipes) => {
      saves++;
      saved = recipes;
    },
  };
  f.w.page = "spells";
  f.w.selectedSpell = spell.id;
  await f.click({ action: "copy-spell" });
  assert.equal(f.w.page, "recipes");
  assert.equal(saved.length, 2);
  assert.equal(saved[0], untouched);
  assert.equal(
    saved[1].itemUuid,
    `Compendium.pf2e.spells-srd.Item.${spell.id}`,
  );
  saved[1] = {
    ...saved[1],
    id: "renamed-id",
    name: "Customized shield",
    enabled: false,
  };
  f.w.page = "spells";
  await f.click({ action: "copy-spell" });
  assert.equal(f.w.selected, "renamed-id");
  assert.equal(saved[1].name, "Customized shield");
  assert.equal(saved[1].enabled, false);
  assert.equal(saved.length, 2);
  assert.equal(saves, 1);
});

test("full catalog stays browsable when editable recipe storage is full", async () => {
  const f = workspace();
  const spell = PF2E_SPELLS.find((s) => s.name === "Shield");
  const saved = Array.from({ length: 200 }, (_, i) => ({ id: `custom-${i}` }));
  f.w.page = "spells";
  f.w.selectedSpell = spell.id;
  f.w.host = {
    recipes: () => saved,
    save: async (recipes) => {
      assert.equal(recipes.length, 201);
      throw Error("Maximum 200 saved recipes.");
    },
  };
  await f.click({ action: "copy-spell" });
  assert.equal(saved.length, 200);
  assert.equal(f.w.page, "spells");
  assert.equal(f.w.message, "Maximum 200 saved recipes.");
  assert.deepEqual(f.w.recipe(), spellRecipe(spell));
});
test("catalog motion switch changes built-in preview and customization without saving over existing recipes", async () => {
  const f = workspace(),
    s = PF2E_SPELLS.find((s) => s.name === "Frostbite");
  let state = { enabled: false, excluded: [] };
  f.w.page = "spells";
  f.w.selectedSpell = s.id;
  f.w.host = {
    catalogState: () => state,
    setCatalogState: async (change) => {
      state = { ...state, ...change };
    },
    recipes: () => [],
  };
  assert.ok(f.w.recipe().stages.some((s) => s.kind === "motion"));
  await f.click({ action: "catalog-motion" });
  assert.equal(state.motion, false);
  assert.ok(f.w.recipe().stages.every((s) => s.kind !== "motion"));
  await f.click({ action: "catalog-motion" });
  assert.equal(state.motion, true);
  assert.ok(f.w.recipe().stages.some((s) => s.kind === "motion"));
});

test("workspace warns when neither JB2A module is active", async () => {
  const { JB2A_MISSING } = await import("../../scripts/ui/workspace.mjs");
  const w = Object.create(Workspace.prototype);
  assert.match(w.envBannerHTML({ ready: true, jb2a: false }), /Neither JB2A module is active/);
  assert.ok(w.envBannerHTML({ ready: true, jb2a: false }).includes('data-page="setup"'));
  assert.equal(w.envBannerHTML({ ready: true, jb2a: true }), "");
  assert.match(w.envBannerHTML({ ready: false, jb2a: false, problem: "Activate Sequencer, then reload Foundry." }), /Activate Sequencer/, "Sequencer problems come first");
  assert.equal(w.envBannerHTML({ ready: true, demo: true }), "", "design preview without the flag shows nothing");
  assert.match(JB2A_MISSING, /JB2A Free.*JB2A Patreon/);
});

test("the GM opens a player's animation in the Studio, edits it for them and approves that version", async () => {
  const f = workspace();
  const mine = [{ id: "frost", name: "Frost", trigger: "manual", stages: [{ kind: "impact", assets: ["jb2a.impact.001.orange"] }] }];
  let theirs = [{ id: "p1", name: "Untitled recipe", trigger: "attack", stages: [{ kind: "impact", assets: ["jb2a.impact.001.orange"] }] }];
  let reviewing = null;
  const decisions = [];
  f.w.host = {
    recipes: () => (reviewing ? theirs : mine),
    review: (id) => { reviewing = id; },
    reviewing: () => (reviewing ? { userId: reviewing, userName: "Oded" } : null),
    approvalState: (r) => (reviewing ? (decisions.some((d) => d.recipe.name === r.name) ? "approved" : "pending") : null),
    decidePlayerRecipe: async (userId, recipe, status) => decisions.push({ userId, recipe, status }),
    save: async (data) => { if (reviewing) theirs = data; else throw Error("saved the GM's recipes"); },
  };
  await f.click({ action: "player-open", user: "oded", id: "p1" });
  assert.equal(f.w.selected, "p1");
  assert.ok(f.w.studio);
  assert.match(f.w.reviewBannerHTML(), /Reviewing Oded's animations[\s\S]*review-approve/);
  assert.equal(f.w.playerReviewHTML(), "", "no review list while reviewing");
  f.w.edit().name = "Oded's strike";
  assert.match(f.w.reviewBannerHTML(), /save your edits before approving/);
  await f.click({ action: "review-approve" });
  assert.equal(decisions.length, 0, "unsaved edits are never approved");
  await f.click({ action: "review-done" });
  assert.equal(reviewing, "oded", "unsaved edits keep the review open");
  await f.w.host.save([f.w.recipe()]);
  f.w.drafts.clear(); f.w.dirty.clear();
  await f.click({ action: "review-approve" });
  assert.deepEqual(decisions.map((d) => [d.userId, d.recipe.name, d.status]), [["oded", "Oded's strike", "approved"]]);
  await f.click({ action: "review-done" });
  assert.equal(reviewing, null);
  assert.equal(f.w.selected, "frost");
  assert.equal(f.w.studio, false);
});

test("a template makes an unlinked, already-timed copy", async () => {
  const f = workspace();
  f.w.host = { recipes: () => [], save: async () => {}, catalog: () => [], environment: () => ({ systemId: "pf2e", ready: true }) };
  await f.click({ action: "new" });
  await f.click({ action: "new-template", template: "ember" });
  const copy = f.w.recipe();
  assert.equal(copy.name, "Ember shot (copy)");
  assert.equal(copy.match, "", "not linked to anything yet");
  assert.notEqual(copy.id, "ember");
  assert.equal(copy.stages.length, 3);
  const ids = new Set(copy.stages.map((s) => s.stageId));
  assert.ok(copy.stages.every((s) => !s.afterStage || ids.has(s.afterStage)), "links point inside the copy");
  assert.ok(f.w.studio && f.w.dirty.has(copy.id));
});
test("New recipe asks for the kind; a lasting animation follows conditions and effects", async () => {
  const f = workspace();
  f.w.host = { recipes: () => [], save: async () => {}, catalog: () => [], environment: () => ({ systemId: "pf2e", ready: true }) };
  await f.click({ action: "new" });
  assert.ok(f.w.newChooser);
  assert.match(f.w.newChooserHTML(), /Blank action animation[\s\S]*Plays once[\s\S]*Blank lasting animation[\s\S]*Stays on a token/);
  assert.match(f.w.newChooserHTML(), /Or start from a template[\s\S]*data-action="new-template" data-template="ember"/);
  await f.click({ action: "new-lasting" });
  assert.ok(!f.w.newChooser);
  const lasting = f.w.recipe();
  assert.equal(lasting.lifecycle, "document");
  assert.equal(lasting.trigger, "effect");
  assert.equal(lasting.systemId, "pf2e");
  assert.deepEqual([lasting.stages[0].kind, lasting.stages[0].persist], ["aura", true]);
  assert.ok(f.w.studioSettings, "settings open to name the condition");
  await f.click({ action: "new" });
  await f.click({ action: "new-action" });
  assert.equal(f.w.recipe().trigger, "manual");
  assert.equal(f.w.recipe().lifecycle, undefined);
  f.w.host.playerMode = true;
  await f.click({ action: "new" });
  assert.ok(f.w.newChooser, "players get blank action or a template");
  assert.doesNotMatch(f.w.newChooserHTML(), /new-lasting/, "players only make action animations");
  await f.click({ action: "new-action" });
});

test('reveal opens a catalog page searched to an item, or a saved recipe in the Studio',()=>{
 const w=Object.assign(Object.create(Workspace.prototype),{spellFilters:{search:'',rank:'3'},actionFilters:{search:'',level:'2'},weaponFilters:{search:''},stateFilters:{condition:{search:'',group:'x'},effect:{search:''}},selectedState:{},statePages:{},dndCatalog:null});const f={w}; assert.equal(f.w.reveal({page:'spells',name:'Fireball'}),true);
 assert.equal(f.w.page,'spells');assert.equal(f.w.spellFilters.search,'Fireball');assert.equal(f.w.spellFilters.rank,'all');
 assert.equal(f.w.reveal({page:'conditions',name:'Frightened'}),true);
 assert.equal(f.w.stateFilters.condition.search,'Frightened');assert.equal(f.w.page,'conditions');
 assert.equal(f.w.reveal({page:'actions',name:'Demoralize'}),true);assert.equal(f.w.actionFilters.search,'Demoralize');
 assert.equal(f.w.reveal({page:'npc-abilities',name:'Unsteadying Magnetism',id:'native-npc-action'}),true);
 assert.equal(f.w.page,'npc-abilities');assert.equal(f.w.selectedNpcAbility,'native-npc-action');assert.deepEqual(f.w.npcFilters,{search:'Unsteadying Magnetism',offset:0});
 assert.equal(f.w.reveal({page:'nowhere',name:'x'}),false);
 const id='r1';
 assert.equal(f.w.reveal({recipeId:id}),true);assert.equal(f.w.page,'recipes');assert.equal(f.w.studio,true);assert.equal(f.w.selected,id);
});

test('Setup offers to turn every catalog on, and says when all are on', () => {
 const w = Object.create(Workspace.prototype);
 const env = { ready: true, demo: false };
 w.host = { catalogsOn: () => ({ on: 2, total: 7 }) };
 assert.match(w.everyCatalogHTML(env), /2 of 7 catalogs are on/);
 assert.match(w.everyCatalogHTML(env), /data-action="use-every-catalog" class="an-primary" >Turn every catalog on/);
 w.host = { catalogsOn: () => ({ on: 7, total: 7 }) };
 assert.match(w.everyCatalogHTML(env), /All 7 catalogs are on/);
 assert.match(w.everyCatalogHTML(env), /disabled>All on ✓/);
 w.host = {};
 assert.equal(w.everyCatalogHTML(env), '');
});

test('the Activity page follows new entries while open, and stops watching elsewhere', (t) => {
 t.mock.timers.enable({ apis: ['setInterval'] });
 const log = [];
 const w = Object.create(Workspace.prototype);
 let renders = 0;
 Object.assign(w, { page: 'activity', root: { isConnected: true }, host: { logs: () => log }, render() { renders++; this.watchActivity(); } });
 w.watchActivity();
 t.mock.timers.tick(1000);
 assert.equal(renders, 0, 'nothing new, no redraw');
 log.unshift({ time: '10:00:01', detail: 'Fireball played' });
 t.mock.timers.tick(1000);
 assert.equal(renders, 1, 'a new entry shows within a second');
 t.mock.timers.tick(3000);
 assert.equal(renders, 1);
 w.page = 'recipes'; w.watchActivity();
 log.unshift({ time: '10:00:05', detail: 'Shield played' });
 t.mock.timers.tick(3000);
 assert.equal(renders, 1, 'no polling off the Activity page');
});

test("the inspector has no pinned Finisher section: finisher settings live in the settings dialog", () => {
  const { w } = workspace();
  const recipe = { ...spellRecipe(PF2E_SPELLS.find((s) => s.name === "Frostbite")), finisher: { on: "kill", mover: "targets", knockback: 0, ending: "stay", success: "any", wall: "fit" } };
  w.host = { environment: () => ({ motionReady: true }), catalog: () => [] };
  for (const open of [false, true]) {
    w.studioSettings = open;
    const html = w.inspectorHTML(recipe);
    assert.doesNotMatch(html, /an-finisher-pin/);
    assert.doesNotMatch(html, /data-field="finisher\./);
  }
});

test("a finisher's Applies to takes dropped items, typed names and chip removal, all into the draft", async () => {
  const f = workspace();
  const r = { id: 'fin', name: 'Fin', trigger: 'manual', match: 'Shove', finisher: { on: 'kill' }, stages: [] };
  f.w.edit = () => r;
  f.w.recipe = () => r;
  f.w.stopEditorPreview = () => {};
  f.w.host = { resolveItem: async (uuid) => ({ uuid, name: uuid === 'Item.axe' ? 'Greataxe' : 'shove' }) };
  const drop = (uuid) => f.w.onDrop({ target: { closest: (sel) => (sel === '.an-binding' ? {} : null) }, preventDefault() {}, dataTransfer: { getData: () => JSON.stringify({ type: 'Item', uuid }) } });
  await drop('Item.axe');
  assert.equal(r.match, 'Shove, Greataxe');
  assert.ok(!r.itemUuid, 'a finisher drop never binds a single item');
  assert.deepEqual(r.finisher.links, { greataxe: 'Item.axe' }, 'the drop remembers its item for the card');
  let edits = 0;
  f.w.edit = () => { edits++; return r; };
  await drop('Item.axe');
  assert.equal(r.match, 'Shove, Greataxe', 'no duplicate');
  assert.equal(edits, 0, 'the same item again leaves the recipe unedited');
  await drop('Item.shove');
  assert.equal(r.match, 'Shove, Greataxe', 'no duplicate, whatever the case');
  assert.equal(r.finisher.links.shove, 'Item.shove', 'dropping an item onto a typed name links it');
  assert.equal(r.finisher.on, 'kill', 'the rest of the finisher stays');
  const input = { value: '  Fireball ', dataset: {}, hasAttribute: (name) => name === 'data-finisher-add' };
  f.w.onChange({ target: input });
  assert.equal(r.match, 'Shove, Greataxe, Fireball');
  assert.equal(input.value, '');
  assert.equal(r.finisher.links.fireball, undefined, 'a typed name has no link');
  await f.click({ action: 'finisher-unlink', name: 'greataxe' });
  assert.equal(r.match, 'Shove, Fireball');
  assert.deepEqual(r.finisher.links, { shove: 'Item.shove' }, 'removing a name removes its link');
});

test("a linked Applies-to card opens its own item, not the recipe's", async () => {
  const f = workspace();
  const r = { id: 'fin', name: 'Fin', trigger: 'manual', match: 'Greataxe', itemUuid: 'Item.legacy', finisher: { on: 'kill', links: { greataxe: 'Item.axe' } }, stages: [] };
  f.w.recipe = () => r;
  const opened = [];
  f.w.host = { resolveItem: async (uuid) => ({ uuid, sheet: { render: async () => opened.push(uuid) } }) };
  await f.click({ action: 'open-bound', uuid: 'Item.axe' });
  assert.deepEqual(opened, ['Item.axe']);
  await f.click({ action: 'open-bound' });
  assert.deepEqual(opened, ['Item.axe', 'Item.legacy'], 'a recipe card still opens its bound item');
});

test("removing a linked name with no other change still drops the link; the catalog dropdown passes its uuid", async () => {
  const f = workspace();
  const r = { id: 'fin', name: 'Fin', trigger: 'manual', match: '', finisher: { on: 'kill', links: { shove: 'Item.s' } }, stages: [] };
  let edits = 0;
  f.w.edit = () => { edits++; return r; };
  f.w.recipe = () => r;
  await f.click({ action: 'finisher-unlink', name: 'Shove' });
  assert.equal(edits, 1, 'a stale link is a change');
  assert.deepEqual(r.finisher.links, {});
  edits = 0;
  await f.click({ action: 'finisher-unlink', name: 'Shove' });
  assert.equal(edits, 0, 'nothing left to remove: undirtied');
  const calls = [];
  f.w.linkFinisherTo = async (...args) => calls.push(args);
  f.w.onChange({ target: { value: 'fin', dataset: { finisherLink: 'Greataxe', finisherUuid: 'Compendium.x.Item.axe' }, hasAttribute: (name) => name === 'data-finisher-link' } });
  f.w.onChange({ target: { value: '', dataset: { finisherLink: 'Shove' }, hasAttribute: (name) => name === 'data-finisher-link' } });
  assert.deepEqual(calls, [['Greataxe', 'fin', 'Compendium.x.Item.axe'], ['Shove', '', undefined]]);
  const saved = [];
  f.w.host = { recipes: () => [{ id: 'fin', name: 'Fin', match: '', finisher: { on: 'kill' }, stages: [] }], save: async (list) => saved.push(list) };
  delete f.w.linkFinisherTo;
  await f.w.linkFinisherTo('Greataxe', 'fin', 'Compendium.x.Item.axe');
  assert.deepEqual(saved[0][0].finisher.links, { greataxe: 'Compendium.x.Item.axe' });
});

test("removing a finisher chip also drops a hidden item binding; an absent name changes nothing", async () => {
  const { matchFinishers } = await import("../../scripts/engines/finishers/finisher-model.mjs");
  const f = workspace();
  const r = { id: 'fin', name: 'Fin', trigger: 'manual', enabled: true, match: 'Longsword', itemUuid: 'Actor.a.Item.sword', finisher: { on: 'kill' }, stages: [] };
  let edits = 0;
  f.w.edit = () => { edits++; return r; };
  f.w.recipe = () => r;
  await f.click({ action: 'finisher-unlink', name: 'Longsword' });
  assert.equal(r.match, '');
  assert.equal(r.itemUuid, '');
  assert.deepEqual(matchFinishers([r], { itemName: 'Longsword', itemUuid: 'Actor.a.Item.sword' }, 'kill'), []);
  edits = 0;
  await f.click({ action: 'finisher-unlink', name: 'Shove' });
  assert.equal(edits, 0, 'an absent name with no binding leaves the recipe undirtied');
  r.match = 'Shove'; r.itemUuid = 'Actor.a.Item.sword';
  f.w.host = { resolveItem: async (uuid) => ({ uuid, name: 'Greataxe' }) };
  await f.w.onDrop({ target: { closest: (sel) => (sel === '.an-binding' ? {} : null) }, preventDefault() {}, dataTransfer: { getData: () => JSON.stringify({ type: 'Item', uuid: 'Item.axe' }) } });
  assert.equal(r.match, 'Shove, Greataxe');
  assert.equal(r.itemUuid, '', 'any Applies-to edit drops the legacy binding');
});

function navWorkspace(host, page = "recipes") {
  const w = Object.create(Workspace.prototype);
  w.page = page;
  w.host = host;
  w.listedRecipes = () => [{ id: "a" }, { id: "b" }, { id: "f1", finisher: true }];
  return w;
}
const navEnv = { system: "pf2e", systemId: "pf2e", ready: true };

test("the GM nav groups pages under CREATE, LIBRARY and TOOLS captions in order", () => {
  const w = navWorkspace({ flashScreens: () => [{}, {}, {}], playerMode: false });
  const html = w.navItemsHTML(navEnv);
  const captions = [...html.matchAll(/an-nav-caption">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(captions, ["CREATE", "LIBRARY · PF2E", "TOOLS"]);
  assert.match(html, /data-page="spells"><span>[^<]*<\/span><b>Spells<\/b>/, "no system prefix: the caption names it");
  assert.doesNotMatch(html, /WORKSPACE/);
  const order = [...html.matchAll(/an-nav-caption">([^<]+)<|data-page="([^"]+)"/g)].map((m) => m[1] || m[2]);
  assert.deepEqual(order.slice(0, 5), ["CREATE", "recipes", "finishers", "flash", "LIBRARY · PF2E"]);
  assert.ok(order.indexOf("assets") > order.indexOf("spells"), "Assets follows the system catalogs");
  assert.deepEqual(order.slice(order.indexOf("assets") - 0), ["assets", "TOOLS", "activity", "setup"]);
});

test("Flash screens is listed only when the host has it", () => {
  const html = navWorkspace({}).navItemsHTML(navEnv);
  assert.doesNotMatch(html, /data-page="flash"/);
});

test("nav counts show for recipes, finishers and flash screens, and hide at zero", () => {
  const html = navWorkspace({ flashScreens: () => [{}, {}, {}] }).navItemsHTML(navEnv);
  assert.match(html, /data-page="recipes"[^>]*>.*?<small>2<\/small>/);
  assert.match(html, /data-page="finishers"[^>]*>.*?<small>1<\/small>/);
  assert.match(html, /data-page="flash"[^>]*>.*?<small>3<\/small>/);
  const w = navWorkspace({ flashScreens: () => [] });
  w.listedRecipes = () => [];
  const none = w.navItemsHTML(navEnv);
  assert.doesNotMatch(none, /<small>/);
});

test("the player nav has their animations, assets and their own Activity, with no captions", () => {
  const html = navWorkspace({ playerMode: true }).navItemsHTML(navEnv);
  assert.doesNotMatch(html, /an-nav-caption/);
  assert.deepEqual([...html.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]), ["recipes", "assets", "activity"]);
  assert.match(html, /My animations/);
});

test("the active nav page keeps is-active", () => {
  const html = navWorkspace({}, "finishers").navItemsHTML(navEnv);
  assert.match(html, /an-nav-item is-active" data-action="page" data-page="finishers"/);
});

test("a finisher's Applies to takes a PF2e strike dragged from a sheet's Attacks: its name, unlinked", async () => {
  const f = workspace();
  const r = { id: 'fin', name: 'Fin', trigger: 'manual', match: 'Shove', finisher: { on: 'kill' }, stages: [] };
  f.w.edit = () => r;
  f.w.recipe = () => r;
  f.w.stopEditorPreview = () => {};
  const actor = { system: { actions: [{ slug: 'basic-unarmed', label: 'Unarmed Attack', item: { id: 'xxPF2ExUNARMEDxx', name: 'Unarmed Attack', slug: 'basic-unarmed' } }] } };
  f.w.host = { resolveActor: (uuid) => (uuid === 'Actor.a' ? actor : null), resolveItem: async (uuid) => (uuid === 'Item.axe' ? { uuid, name: 'Greataxe' } : null) };
  const drop = (data) => f.w.onDrop({ target: { closest: (sel) => (sel === '.an-binding' ? {} : null) }, preventDefault() {}, dataTransfer: { getData: () => JSON.stringify(data) } });
  await drop({ type: 'Action', index: 0, actorId: 'a', actorUUID: 'Actor.a' });
  assert.equal(r.match, 'Shove, Unarmed Attack');
  assert.equal(r.finisher.links?.['unarmed attack'], undefined, 'a strike has no item to link');
  await drop({ type: 'Item', uuid: 'Item.axe' });
  assert.equal(r.match, 'Shove, Unarmed Attack, Greataxe', 'ordinary item drops still work');
  assert.equal(r.finisher.links.greataxe, 'Item.axe');
});

// Issue #3: Local preview tucks the window away; it must come back even when playback never settles.
test("a tucked window comes back once: when playback ends, on Stop, or after the limit", async () => {
  const tucked = () => {
    const calls = { restores: 0 };
    const w = Object.assign(Object.create(Workspace.prototype), { host: { tuckWindow: async () => async () => { calls.restores++; } } });
    return { w, calls };
  };
  const ended = tucked();
  const restore = await ended.w.tuckForPlayback(1000);
  await restore(); await restore();
  assert.equal(ended.calls.restores, 1, "restored once when playback ends");
  const stopped = tucked();
  await stopped.w.tuckForPlayback(1000);
  await stopped.w.untuck();
  assert.equal(stopped.calls.restores, 1, "Stop restores it");
  const hung = tucked();
  await hung.w.tuckForPlayback(20);
  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(hung.calls.restores, 1, "a playback that never settles still gives the window back");
  const off = Object.assign(Object.create(Workspace.prototype), { host: { tuckWindow: async () => null } });
  assert.equal(await off.tuckForPlayback(20), null, "nothing to restore when the window was not tucked");
});

// Issue #3: an inspector width saved in a big window must not push the inspector out of a smaller one.
test("the studio inspector is never wider than the window leaves room for, without forgetting the saved width", () => {
  const w = Object.assign(Object.create(Workspace.prototype), { panelWidth: 700 });
  w.root = { getBoundingClientRect: () => ({ width: 760 }) };
  assert.equal(w.inspectorWidth(), 370, "760 window: 62 nav + 8 splitter + 320 timeline area leaves 370");
  w.root = { getBoundingClientRect: () => ({ width: 1600 }) };
  assert.equal(w.inspectorWidth(), 700, "a big window shows the saved width");
  w.root = { getBoundingClientRect: () => ({ width: 500 }) };
  assert.equal(w.inspectorWidth(), 300, "never below the 300px minimum");
  w.root = null;
  assert.equal(w.inspectorWidth(), 700);
});

test("a GM whose table plays nothing yet starts on Setup; the guide starts with the catalogs", async () => {
  const host = (accepts) => ({ environment: () => ({ systemId: "pf2e", ready: true, dependencies: [], conflicts: [] }), recipes: () => [], acceptsEvents: () => accepts, enabled: () => false, catalogsOn: () => ({ on: 0, total: 7 }) });
  const { firstPage } = await import("../../scripts/ui/workspace.mjs");
  assert.equal(firstPage(host(false)), "setup");
  assert.equal(firstPage(host(true)), "recipes");
  assert.equal(firstPage({ ...host(false), playerMode: true }), "recipes", "players start on their animations");
  const idle = Object.create(Workspace.prototype); idle.host = host(false);
  const html = idle.setupHTML(host(false).environment());
  assert.ok(html.indexOf("Turn every catalog on") < html.indexOf("Get started"), "turning the catalogs on comes first");
  assert.match(html, /<li><b>Turn on the catalogs\.<\/b>/);
  assert.ok(html.indexOf("Fine-tuning") < html.indexOf("Play my own recipes automatically"));
});

test("a persistent damage customization picks its damage type in the editor", async () => {
  const { PF2E_CONDITIONS, stateRecipe } = await import("../../scripts/catalogs/pf2e/state-catalog.mjs");
  const f = workspace(), r = stateRecipe(PF2E_CONDITIONS.find((e) => e.damageVariants), { damageType: "bleed" });
  f.w.edit = () => r;
  f.w.stopEditorPreview = () => {};
  assert.match(f.w.lastingChoiceHTML(r), /data-field="stateDamageType"[\s\S]*value="bleed" selected/);
  f.w.updateField({ dataset: { field: "stateDamageType" }, type: "select-one", value: "fire" });
  assert.equal(r.stateDamageType, "fire");
  assert.match(f.w.lastingChoiceHTML(r), /Plays only for persistent fire damage/);
  // Lasting conditions with no damage types offer no such choice.
  assert.doesNotMatch(f.w.lastingChoiceHTML({ ...r, stateEntry: PF2E_CONDITIONS.find((e) => !e.damageVariants).id }), /stateDamageType/);
});

test("a teleport stage hides its mover in the monitor instead of showing a missing asset", () => {
  const recipe = spellRecipe(PF2E_SPELLS.find((s) => s.name === "Translocate"));
  assert.ok(recipe.stages.some((s) => s.kind === "teleport"));
  const catalog = recipe.stages.flatMap((s) => s.assets ?? []).map((key) => ({ key, file: `${key}.webm` }));
  const w = Object.create(Workspace.prototype);
  w.host = { catalog: () => catalog, soundCatalog: () => [], previewTokens: () => ({}) };
  w.stageIndex = 0;
  const html = w.recipePreviewHTML(recipe);
  assert.doesNotMatch(html, /is-unavailable/);
  assert.match(html, /class="an-recipe-layer an-teleport-layer"[^>]*data-teleport="source"/);
});
