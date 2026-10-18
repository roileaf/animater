import test from "node:test";
import assert from "node:assert/strict";
import { AnimaterRuntime } from "../../scripts/engines/playback/runtime.mjs";
import { PF2E_FEATS, featRecipe, useCatalogFeat } from "../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { aaCustomized, aaEvent } from "../../scripts/integrations/automated-animations.mjs";
import { spellArsenalClaims } from "../../scripts/integrations/spell-arsenal.mjs";
import { createAnimaterPlayNode } from "../../scripts/integrations/trigger-engine.mjs";
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
function stubHooks() {
  const hooks = new Map();
  const on = (name, fn) => hooks.set(name, [...(hooks.get(name) ?? []), fn]);
  return {
    hooks,
    Hooks: {
      on, once: on,
      call: (name, ...args) => (hooks.get(name) ?? []).every((fn) => fn(...args) !== false),
      callAll: (name, ...args) => { for (const fn of hooks.get(name) ?? []) fn(...args); return true; },
    },
  };
}
const feat = PF2E_FEATS.find((f) => f.slug === "sudden-charge");
const recipe = featRecipe(feat, { motion: false });
async function boot() {
  const { hooks, Hooks } = stubHooks();
  const settings = new Map(), calls = [];
  globalThis.Hooks = Hooks;
  globalThis.foundry = {
    applications: { api: { ApplicationV2: class {}, HandlebarsApplicationMixin: (base) => class extends base {}, DialogV2: {} } },
    utils: { randomID: () => "id" },
  };
  const actor = { id: "a", documentName: "Actor" };
  const source = { id: "t", actor, isOwner: true, controlled: true, center: { x: 100, y: 100 } };
  globalThis.game = {
    system: { id: "pf2e", title: "pf2e", version: "8.5.1" },
    user: { id: "u", isGM: true, targets: new Set() },
    modules: new Map([["animater", { socket: true }], ["sequencer", { active: true, version: "4.2.3" }], ["jb2a_patreon", { active: true }]]),
    settings: {
      register: (_id, k, d) => settings.set(k, d.default),
      registerMenu: () => {},
      get: (_id, k) => settings.get(k),
      set: async (_id, k, v) => settings.set(k, v),
    },
    keybindings: { register: () => {} },
    users: new Map([["u", { id: "u", isGM: true }]]),
    socket: { on: () => {}, emit: () => {} },
  };
  globalThis.canvas = {
    ready: true, scene: { id: "s", grid: { distance: 5 } }, grid: { size: 100 },
    tokens: { placeables: [source], controlled: [source], get: (id) => (id === "t" ? source : null) },
  };
  const keys = recipe.stages.flatMap((s) => s.assets);
  globalThis.Sequencer = {
    Preloader: { preload: async () => {}, preloadForClients: async () => {} },
    SoundManager: { endSounds: async () => {} },
    Database: { entryExists: () => true, getPathsUnder: () => keys, getAllFileEntries: (key) => [key + ".webm"] },
    EffectManager: { endEffects: async () => {} },
  };
  globalThis.Sequence = class {
    sound() { return this.effect(); }
    effect() {
      const e = new Proxy({}, { get: (_, k) => (...args) => { calls.push([k, ...args]); return e; } });
      return e;
    }
    async play(options) { calls.push(["play", options]); }
  };
  globalThis.ui = { notifications: { warn: () => {} }, controls: { render: () => {} } };
  globalThis.fromUuid = async () => null;
  await import(`../../scripts/main.mjs?integrations=${Date.now()}`);
  for (const name of ["init", "ready"]) for (const fn of hooks.get(name) ?? []) await fn();
  settings.set("recipes", { schema: 1, recipes: [] });
  settings.set("featCatalog", { ...useCatalogFeat({}, feat.id), motion: false });
  const item = { uuid: "Actor.a.Item.i", documentName: "Item", type: "feat", name: feat.name, actor, flags: {}, _stats: { compendiumSource: recipe.itemUuid } };
  const card = { id: "card", documentName: "ChatMessage", author: { id: "u" }, item, isRoll: false, speaker: { token: "t", scene: "s" }, flags: {} };
  const fire = async (name, ...args) => { for (const fn of hooks.get(name) ?? []) await fn(...args); };
  return { hooks, fire, settings, calls, item, card, source, api: game.modules.get("animater").api };
}

test("preDispatch listeners can claim an event; played fires after playback", async () => {
  const played = [];
  const host = {
    enabled: () => true, recipes: () => [], resolveRecipe: () => ({ id: "r", name: "R" }),
    onTrace: () => {},
  };
  const runtime = new AnimaterRuntime(host);
  runtime.play = async (r) => played.push(r.id);
  const previous = globalThis.Hooks;
  const { Hooks } = stubHooks();
  globalThis.Hooks = Hooks;
  try {
    const events = [];
    Hooks.on("animater.played", (event, r) => events.push([event.id, r.id]));
    Hooks.on("animater.preDispatch", (event) => (event.id === "claimed" ? false : undefined));
    await runtime.dispatch({ id: "claimed", type: "use", item: { name: "Fireball" } });
    assert.deepEqual(played, []);
    assert.match(runtime.log[0].detail, /claimed by another module/);
    await runtime.dispatch({ id: "free", type: "use", item: { name: "Fireball" } });
    assert.deepEqual(played, ["r"]);
    assert.deepEqual(events, [["free", "r"]]);
    delete globalThis.Hooks;
    await runtime.dispatch({ id: "no-hooks", type: "use", item: { name: "Fireball" } });
    assert.deepEqual(played, ["r", "r"], "missing Hooks global still plays");
  } finally {
    globalThis.Hooks = previous;
  }
});

test("Automated Animations stops for items Animater animates and keeps customized items", async () => {
  const f = await boot();
  game.modules.set("autoanimations", { active: true, title: "Automated Animations" });
  const workflow = (item) => ({ item, token: f.source, targets: [], workflow: { ...f.card, item } });
  const data = workflow(f.item);
  await f.fire("AutomatedAnimations-WorkflowStart", data, {});
  assert.equal(data.stopWorkflow, true);
  const other = workflow({ ...f.item, name: "Toughness", _stats: {} });
  await f.fire("AutomatedAnimations-WorkflowStart", other, {});
  assert.equal(other.stopWorkflow, undefined, "no Animater recipe: AA plays");
  const customized = { ...f.item, flags: { autoanimations: { isEnabled: true, isCustomized: true } } };
  const kept = workflow(customized);
  await f.fire("AutomatedAnimations-WorkflowStart", kept, {});
  assert.equal(kept.stopWorkflow, undefined, "customized AA item stays with AA");
  await f.fire("createChatMessage", { ...f.card, id: "custom-card", item: customized });
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 0);
  assert.match(f.api.activity()[0].detail, /customized in Automated Animations/);
  f.settings.set("aaTakeover", false);
  const off = workflow(f.item);
  await f.fire("AutomatedAnimations-WorkflowStart", off, {});
  assert.equal(off.stopWorkflow, undefined, "setting disabled");
  assert.equal(aaCustomized({ flags: { autoanimations: { isEnabled: false, isCustomized: true } } }), false);
  assert.equal(aaEvent({ item: f.item, templateData: { uuid: "Scene.s.Region.r", parent: { id: "s" } } }, { systemId: "pf2e" }).type, "template");
});

test("api.handles and api.resolve report without playing", async () => {
  const f = await boot();
  assert.equal(f.api.handles(f.item), true);
  assert.equal(f.api.handles({ ...f.item, name: "Toughness", _stats: {} }), false);
  assert.equal(f.api.handles(f.card), true);
  assert.equal(f.api.resolve(f.card).itemUuid, recipe.itemUuid);
  assert.equal(f.api.resolve({ ...f.card, item: { ...f.item, name: "Toughness", _stats: {} } }), null);
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 0);
});

test("Spell Arsenal claims mapped areas and opted-in damage rules", () => {
  const rules = [
    { enabled: true, kind: "area", spell: "Fireball", effect: "Fire" },
    { enabled: true, kind: "damage", spell: "Ignition", effect: "Fire", animater: true },
    { enabled: true, kind: "damage", spell: "Frostbite", effect: "Frost" },
  ];
  const g = {
    system: { id: "pf2e" },
    modules: new Map([["spell-arsenal", { active: true }], ["tile-arsenal", { active: true }]]),
    users: { activeGM: { id: "gm" } },
    settings: { get: (_id, key) => (key === "enabled" ? true : rules) },
  };
  const spell = (name) => ({ type: "spell", name });
  assert.equal(spellArsenalClaims({ type: "template", item: spell("Fireball") }, g), true);
  assert.equal(spellArsenalClaims({ type: "template", item: spell("x"), template: { flags: { pf2e: { origin: { name: "fireball" } } } } }, g), true);
  assert.equal(spellArsenalClaims({ type: "damage", item: spell("Ignition") }, g), true);
  assert.equal(spellArsenalClaims({ type: "damage", item: spell("Frostbite") }, g), false, "tiles only: Animater keeps its own damage animation");
  assert.equal(spellArsenalClaims({ type: "template", item: spell("Lightning Bolt") }, g), false);
  g.users.activeGM = null;
  assert.equal(spellArsenalClaims({ type: "template", item: spell("Fireball") }, g), false, "no GM to run Spell Arsenal");
});

test("Trigger Engine node plays the recipe with source and target tokens on the active GM", async () => {
  const played = [];
  const previous = globalThis.game;
  const source = { id: "s" }, target = { id: "t" };
  globalThis.game = {
    user: { id: "gm", isGM: true }, users: { activeGM: { id: "gm" } },
    modules: new Map([["animater", { api: { play: async (id, context) => played.push([id, context]) } }]]),
  };
  try {
    class Base { executeNext(out) { return out; } }
    const Node = createAnimaterPlayNode(Base);
    const node = new Node();
    const inputs = { recipe: "ember", source: { token: { object: source } }, targets: [{ token: { object: target } }] };
    node.getInputValue = async (key) => inputs[key];
    assert.equal(Node.type, "animater-play");
    assert.equal(await node._execute(), "out");
    assert.deepEqual(played, [["ember", { source, targets: [target] }]]);
    game.users.activeGM = { id: "other" };
    assert.equal(await node._execute(), false);
    assert.equal(played.length, 1);
  } finally {
    globalThis.game = previous;
  }
});

test('weapon effect size scales weapon hits and residue only', async () => {
  const { withWeaponScale } = await import('../../scripts/engines/playback/runtime.mjs');
  const recipe = { weaponMode: 'melee', stages: [{ kind: 'motion', scale: 1 }, { kind: 'impact', scale: 0.8 }, { kind: 'travel', scale: 1 }, { kind: 'aura', scale: 1 }] };
  assert.deepEqual(withWeaponScale(recipe, 1.5).stages.map(s => s.scale), [1, 1.2000000000000002, 1, 1.5]);
  assert.equal(withWeaponScale({ ...recipe, weaponMode: 'area' }, 1.5).stages[1].scale, 0.8);
  assert.equal(withWeaponScale({ ...recipe, weaponMode: undefined }, 1.5).stages[1].scale, 0.8);
});

test('derived in-memory conditions without a stored item do not tie to a missing document', async () => {
  const { storedStateDocument } = await import('../../scripts/engines/playback/persistent-states.mjs');
  const actor = { items: new Map([['real', {}]]) };
  assert.equal(storedStateDocument({ id: 'real', uuid: 'Actor.a.Item.real', parent: actor }), 'Actor.a.Item.real');
  assert.equal(storedStateDocument({ id: 'derived', uuid: 'Actor.a.Item.derived', parent: actor }), null);
});

test('cold area spells frost caught creatures, falling back to the ice aura preset', async () => {
  const { PF2E_SPELLS, spellRecipe } = await import('../../scripts/catalogs/pf2e/spells/spell-catalog.mjs');
  const spell = PF2E_SPELLS.find(s => s.name === 'Cone of Cold');
  const fxOf = presets => spellRecipe(spell, undefined, { fxCatalog: { tokenReady: true, sceneReady: false, presets: presets.map(name => ({ name, library: 'tokenshade' })) } }).stages.find(s => s.kind === 'tokenfx');
  const rich = fxOf(['Frostbitten', 'pure-ice-aura']);
  assert.equal(rich.fxPreset, 'Frostbitten');
  assert.equal(rich.subject, 'targets');
  assert.equal(fxOf(['pure-ice-aura']).fxPreset, 'pure-ice-aura');
  assert.equal(fxOf([]), undefined);
});

test('Token Magic presets whose sprite images come from an inactive module are not offered', async () => {
  const { presetAssetsAvailable } = await import('../../scripts/engines/playback/optional-fx.mjs');
  const bw = { params: [{ filterType: 'sprite', imagePath: 'modules/baileywiki-maps-premium-towns/maps/fx-tiles/overlay-fx/overlay-cold-ice-01.webp' }] };
  const modules = active => ({ get: id => ({ active: active.includes(id) }) });
  assert.equal(presetAssetsAvailable(bw, modules([])), false);
  assert.equal(presetAssetsAvailable(bw, modules(['baileywiki-maps-premium-towns'])), true);
  assert.equal(presetAssetsAvailable({ params: [{ filterType: 'glow' }] }, modules([])), true);
});

test('valued conditions grow gradually with their value; unvalued states keep full strength', async () => {
  const { conditionLevel, levelIntensity } = await import('../../scripts/engines/playback/persistent-states.mjs');
  const cond = value => ({ type: 'condition', value, system: { value: { isValued: true, value } } });
  assert.deepEqual([1, 2, 3, 4, 7].map(v => conditionLevel(cond(v))), [1, 2, 3, 4, 4]);
  assert.equal(conditionLevel({ type: 'condition', system: { value: { isValued: false } } }), 0);
  assert.equal(conditionLevel({ type: 'effect' }), 0);
  const [one, two, four] = [1, 2, 4].map(levelIntensity);
  assert.ok(one.opacity < two.opacity && two.opacity <= four.opacity);
  assert.ok(one.scale < four.scale && one.rate < four.rate);
  assert.deepEqual(levelIntensity(0), { opacity: 1, scale: 1, rate: 1 });
});

test('device quality routes optional layers per viewer and caps local state layers', async () => {
  const q = await import('../../scripts/core/quality.mjs');
  const stages = [{ kind: 'cast', stageId: 'c' }, { kind: 'travel', stageId: 't' }, { kind: 'impact', stageId: 'i' }, { kind: 'aura', stageId: 'a' }, { kind: 'sprite', stageId: 's' }, { kind: 'aura', stageId: 'a2' }, { kind: 'sound', stageId: 'snd' }];
  const tiers = Object.fromEntries([...q.stageTiers(stages)].map(([s, t]) => [s.stageId, t]));
  assert.deepEqual(tiers, { c: 1, t: 0, i: 0, a: 1, s: 2, a2: 2 });
  const user = (id, quality, active = true) => ({ id, active, getFlag: () => quality });
  const users = [user('gm', 'full'), user('p1', 'low'), user('p2', 'balanced'), user('away', 'off', false)];
  assert.equal(q.usersForTier(users, 0), null);
  assert.deepEqual(q.usersForTier(users, 1), ['gm', 'p2']);
  assert.deepEqual(q.usersForTier(users, 2), ['gm']);
  assert.deepEqual(q.usersForTier([user('x', 'off')], 0), []);
  assert.ok(q.allowsMotion('low') && !q.allowsMotion('off'));
  assert.ok(q.allowsTokenFx('full') && !q.allowsTokenFx('balanced'));
  assert.deepEqual(q.stateBudget('low'), { states: 1, layers: 1, pips: false });
  assert.equal(q.stateBudget('full').states, Infinity);
});



test('stage start modes link to the neighbouring stage and survive reordering', async () => {
  const { linkStartModes, reorderStages } = await import('../../scripts/engines/playback/choreography.mjs');
  const { validateRecipe } = await import('../../scripts/core/model.mjs');
  const { timedStages } = await import('../../scripts/engines/playback/composition.mjs');
  const st = (stageId, extra) => ({ stageId, kind: 'impact', assets: ['jb2a.impact'], duration: 1000, delay: 0, ...extra });
  const stages = linkStartModes([st('a'), st('b', { startMode: 'after' }), st('c', { startMode: 'with' }), st('d', { startMode: 'after', startOffset: 250 })]);
  const at = list => Object.fromEntries(timedStages(validateRecipe({ id: 't', name: 't', trigger: 'manual', stages: list })).map(s => [s.stageId, Math.round(s.delay)]));
  assert.deepEqual(at(stages), { a: 0, b: 1000, c: 1000, d: 2250 });
  const moved = reorderStages(stages, 3, 1); // d becomes second: after a, then b after d
  assert.deepEqual(moved.map(s => [s.stageId, s.afterStage ?? '']), [['a', ''], ['d', 'a'], ['b', 'd'], ['c', 'b']]);
  assert.equal(validateRecipe({ id: 't', name: 't', trigger: 'manual', stages: moved }).stages[1].startMode, 'after');
  const first = linkStartModes([st('x', { startMode: 'after' })]);
  assert.equal(first[0].startMode, undefined, 'the first stage has nothing to follow');
});

test('a stage can start with or after a specific stage, kept through reordering', async () => {
  const { linkStartModes, reorderStages } = await import('../../scripts/engines/playback/choreography.mjs');
  const { validateRecipe } = await import('../../scripts/core/model.mjs');
  const { timedStages } = await import('../../scripts/engines/playback/composition.mjs');
  const st = (stageId, extra) => ({ stageId, kind: 'impact', assets: ['jb2a.impact'], duration: 1000, delay: 0, ...extra });
  const recipe = list => validateRecipe({ id: 't', name: 't', trigger: 'manual', stages: list });
  const at = list => Object.fromEntries(timedStages(recipe(list)).map(s => [s.stageId, Math.round(s.delay)]));
  // Stage 3 starts with stage 1, not with stage 2.
  const stages = linkStartModes([st('a'), st('b', { startMode: 'after' }), st('c', { startMode: 'with', startRef: 'a' })]);
  assert.deepEqual(at(stages), { a: 0, b: 1000, c: 0 });
  assert.equal(recipe(stages).stages[2].startRef, 'a');
  // Moving c to the front keeps it attached to a; b still follows its new previous stage.
  const moved = reorderStages(stages, 2, 0);
  assert.equal(moved[0].afterStage, 'a');
  assert.deepEqual(at(moved), { c: 0, a: 0, b: 1000 });
  // A missing reference falls back to the previous stage.
  const orphan = linkStartModes([st('a'), st('b', { startMode: 'after', startRef: 'gone' })]);
  assert.equal(orphan[1].afterStage, 'a');
  // A loop cannot be resolved.
  assert.throws(() => timedStages(recipe(linkStartModes([st('a', { startMode: 'after', startRef: 'b' }), st('b', { startMode: 'after', startRef: 'a' })]))));
});
