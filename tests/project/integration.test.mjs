import test from "node:test";
import assert from "node:assert/strict";
import {
  PF2E_SPELLS,
  spellRecipe,
  useCatalogSpell,
} from "../../scripts/catalogs/pf2e/spells/spell-catalog.mjs";
import { SOUND_PROFILES } from "../../scripts/engines/sound/spell-sounds.mjs";
import {
  PF2E_FEATS,
  featRecipe,
  useCatalogFeat,
} from "../../scripts/catalogs/pf2e/feats/feat-catalog.mjs";
import { PF2E_WEAPONS, weaponRecipe, useCatalogWeapon } from "../../scripts/catalogs/pf2e/weapons/weapon-catalog.mjs";
import { ABILITY_SOUND_PROFILES } from "../../data/ability-sounds.mjs";
import { PF2E_CONDITIONS, PF2E_EFFECTS, useStateEntry, stateRecipe } from "../../scripts/catalogs/pf2e/state-catalog.mjs";
import {dndEntries,dndRecipe,useDndEntry} from '../../scripts/catalogs/dnd5e/dnd5e-catalog.mjs';
import {sfEntries,sfRecipe,useSfEntry} from '../../scripts/catalogs/sf2e/sf2e-catalog.mjs';
import {Workspace} from '../../scripts/ui/workspace.mjs';
import {previewFilters} from '../../scripts/engines/preview/token-fx-preview.mjs';
import {tokenFx} from '../../scripts/engines/tokenshade/api.mjs';
import {MediaLibrary} from '../../scripts/ui/media-library.mjs';
import { rollMessage, dualityRoll, adversaryRoll, damageRoll, useHook, target as dhTarget } from "../fixtures/daggerheart-messages.mjs";
import { dhEntries, dhRecipe as dhCatalogRecipe, useDhEntry } from "../../scripts/catalogs/daggerheart/daggerheart-catalog.mjs";
globalThis.requestAnimationFrame = (fn) =>
  setTimeout(() => fn(performance.now()), 5);
globalThis.cancelAnimationFrame = clearTimeout;
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
function assertAttenuatedAudio(calls,profiles,userVolume){
 const candidates=Object.values(profiles).flatMap(cues=>cues.flatMap(cue=>cue.candidates));
 let file,checked=0;
 for(const call of calls){
  if(call[0]==='file')file=call[1];
  if(call[0]!=='volume')continue;
  const candidate=candidates.find(c=>c.file===file);assert.ok(candidate,`Installed candidate ${file}`);
  assert.ok(Math.abs(call[1]-userVolume*(candidate.gain??1))<1e-8,`${file}: user volume times measured gain`);checked++;
 }
 assert.ok(checked>0,'Audible optional cues were compiled');
}
async function boot(system, extraKeys = [], { version } = {}) {
  let renderedApp;
  const hooks = new Map(),
    settings = new Map(),
    menus = [],
    bindings = [],
    calls = [],
    sockets = new Map();
  const register = (name, fn) => {
    hooks.set(name, [...(hooks.get(name) ?? []), fn]);
  };
  globalThis.Hooks = { on: register, once: register };
  class App {
    async _onRender() {}
    async close() {
      calls.push("close");
    }
    render() {
      calls.push("open");
      renderedApp = this;
      return this;
    }
  }
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2: App,
        HandlebarsApplicationMixin: (base) => class extends base {},
        DialogV2: { confirm: async () => true },
      },
    },
    utils: {
      saveDataToFile: () => {}, randomID: () => "previewtemplate1",
      hasProperty: (object, path) => path.split(".").reduce((o, k) => (o && typeof o === "object" && k in o ? o[k] : undefined), object) !== undefined,
    },
  };
  const actor = { id: "a", documentName: "Actor" };
  const source = { id: "t", actor, isOwner: true, controlled: true };
  const target = { id: "target" };
  const point = (x, y) => ({
    x,
    y,
    set(x, y) {
      this.x = x;
      this.y = y;
    },
  });
  for (const [i, token] of [source, target].entries()) {
    token.visible = true;
    token.center = { x: 100 + i * 200, y: 100 };
    token.document = { x: 50 + i * 200, y: 50, testUserPermission: () => true };
    token.mesh = {
      position: point(100 + i * 200, 100),
      rotation: 0,
      scale: point(1, 1),
    };
  }
  globalThis.game = {
    system: {
      id: system,
      title: system,
      version: version ?? ({ sf2e: "1.5.1", pf2e: "8.5.1", daggerheart: "2.10.12" }[system] ?? "6.0.5"),
    },
    user: { id: "u", isGM: true, targets: new Set([target]) },
    modules: new Map([
      ["animater", { socket: true }],
      ["sequencer", { active: true, version: "4.2.3" }],
      ["jb2a_patreon", { active: true }],
    ]),
    settings: {
      register: (_id, k, d) => settings.set(k, d.default),
      registerMenu: (_id, _k, m) => menus.push(m),
      get: (_id, k) => settings.get(k),
      set: async (_id, k, v) => settings.set(k, v),
    },
    keybindings: { register: (_id, _k, d) => bindings.push(d) },
    users: new Map([["u", { id: "u", isGM: true }]]),
    socket: {
      on: (channel, fn) => sockets.set(channel, fn),
      emit: (channel, data) => calls.push(["socket", channel, data]),
    },
  };
  globalThis.canvas = {
    ready: true,
    scene: { id: "s", grid: { distance: 5 } },
    grid: { size: 100 },
    templates: {
      addChild(object) {
        calls.push(["preview-template", object.document]);
        object.parent = this;
      },
      removeChild() {
        calls.push(["remove-preview-template"]);
      },
    },
    tokens: {
      placeables: [source],
      controlled: [source],
      get: (id) => (id === "t" ? source : id === "target" ? target : null),
    },
  };
  globalThis.CONFIG = {
    MeasuredTemplate: {
      documentClass: class {
        constructor(data, options) {
          Object.assign(this, data);
          this.parent = options.parent;
        }
      },
      objectClass: class {
        constructor(document) {
          this.document = document;
        }
        async draw() {}
        destroy() {
          this.destroyed = true;
          calls.push(["destroy-preview-template"]);
        }
      },
    },
  };
  const keys = [
    "jb2a.impact.001.orange",
    "jb2a.fire_bolt.orange",
    "jb2a.fireball.explosion.orange",
    ...extraKeys,
  ];
  globalThis.Sequencer = {
    Preloader: {
      preload: async (files,showProgress)=>calls.push(['preload',files,showProgress]),
      preloadForClients: async (files,showProgress)=>calls.push(['preloadForClients',files,showProgress]),
    },
    SoundManager: { endSounds: async () => calls.push("stopSounds") },
    Database: {
      entryExists: () => true,
      getPathsUnder: () => keys,
      getAllFileEntries: (key) => [key + ".webm"],
    },
    EffectManager: {
      endEffects: async () => {
        calls.push("stop");
      },
    },
  };
  globalThis.Sequence = class {
    sound() {
      calls.push(["sound"]);
      return this.effect();
    }
    effect() {
      const e = new Proxy(
        {},
        {
          get:
            (_, k) =>
            (...args) => {
              calls.push([k, ...args]);
              return e;
            },
        },
      );
      return e;
    }
    async play(options) {
      calls.push(["play", options]);
    }
  };
  globalThis.ui = {
    notifications: { warn: (message) => calls.push(["warning", message]) },
    controls: { render: () => calls.push("controls") },
  };
  const item = {
    uuid: "Actor.a.Item.i",
    documentName: "Item",
    name: "Ignition",
    actor,
  };
  globalThis.fromUuid = async (uuid) =>
    uuid === item.uuid
      ? item
      : uuid === "Scene.s.Token.target"
        ? { object: target }
        : null;
  await import(`../../scripts/main.mjs?system=${system}&test=${Date.now()}`);
  const fire = async (name, ...args) => {
    for (const fn of hooks.get(name) ?? []) await fn(...args);
  };
  await fire("init");
  await fire("ready");
  return {
    fire,
    hooks,
    settings,
    menus,
    bindings,
    calls,
    source,
    target,
    actor,
    item,
    api: game.modules.get("animater").api,
    sockets,
    app: () => renderedApp,
  };
}

test('workspace token FX preview uses the built-in engine with its own clock',async t=>{
 const f=await boot('pf2e');
 class Filter {constructor(vertex,fragment,uniforms){this.uniforms=uniforms;this.enabled=true;}destroy(){}}
 t.mock.method(Workspace.prototype,'render',()=>{});
 t.mock.method(Workspace.prototype,'syncPreviewTokens',()=>{});
 const previous={PIXI:globalThis.PIXI};
 Object.assign(globalThis,{PIXI:{Filter,Texture:{EMPTY:{}}}});
 t.after(()=>{for(const [key,value] of Object.entries(previous)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 const root={addEventListener(){},querySelector:()=>null,querySelectorAll:()=>[]};
 f.api.open();f.app().element={querySelector:()=>root};await f.app()._onRender({},{});
 const scene={dataset:{},querySelectorAll:()=>[]};
 const preview=await f.app().workspace.host.createTokenFxPreview(scene,{stages:[]});
 assert.equal(preview.tokenFx,tokenFx);
 const [filter]=previewFilters({name:'t',params:[{filterType:'fire',time:0,animated:{time:{animType:'move',speed:-.0024}}}]},{},{PIXI:globalThis.PIXI});
 filter.update(1000,0);assert.ok(Math.abs(filter.uniforms.uTime-1)<1e-9,'one second of natural flame motion per second');
 preview.stop();await f.app().close();
});

test('optional provider bootstrap previews token filters locally and transports only authorized token stages',async()=>{
  const f=await boot('pf2e'),events=[],engine={apply:tokenFx.apply,ready:tokenFx.ready};
  try {
    f.source.document.object=f.source;f.target.document.object=f.target;
    game.i18n={localize:key=>key};
    game.modules.set('fxmaster',{active:true,version:'8.4.1'});
    tokenFx.ready=()=>true;
    tokenFx.apply=(token,p)=>{events.push(['token',token.id,p.name,'add']);return ()=>events.push(['token',token.id,p.name,'remove']);};
    globalThis.FXMASTER={api:{effects:{play:async data=>events.push(['scene','add',data]),stop:async data=>events.push(['scene','remove',data])}}};
    CONFIG.fxmaster={particleEffects:{embers:{label:'Embers',parameters:{density:{type:'range',min:0,max:1,value:.2}}}},filterEffects:{}};
    canvas.scene.getFlag=()=>({});
    const r=f.api.recipes()[0];r.stages=[{kind:'tokenfx',fxPreset:'glow',subject:'targets',duration:100},
      {kind:'scenefx',fxType:'embers',duration:100}, {kind:'cast',duration:100,assets:['jb2a.impact.001.orange']}];
    f.settings.set('recipes',{schema:1,recipes:[r]});
    await f.api.preview(r.id);
    assert.equal(f.calls.filter(c=>c[0]==='socket').length,0);
    assert.deepEqual(events.filter(e=>e[0]==='token').map(e=>[e[1],e[3]]),[['target','add'],['target','remove']]);
    assert.equal(events.filter(e=>e[0]==='scene').length,0);
    events.length=0;
    await f.api.play(r.id,{source:f.source,targets:[f.target]});
    const payload=f.calls.find(c=>c[0]==='socket'&&c[2].type==='tokenfx')[2];
    assert.equal(payload.sceneId,'s');assert.equal(payload.tokenId,'target');
    assert.equal(payload.stage.destination,undefined);assert.doesNotThrow(()=>JSON.stringify(payload));
    assert.equal(events.filter(e=>e[0]==='scene'&&e[1]==='add').length,1);
    assert.equal(events.filter(e=>e[0]==='scene'&&e[1]==='remove').length,1);
    const receive=f.sockets.get('module.animater'),before=events.length;
    receive({...payload,sender:'remote',sceneId:'other'});
    game.users.set('denied',{id:'denied',isGM:false});f.source.document.testUserPermission=()=>false;
    receive({...payload,sender:'remote',userId:'denied'});await settle();
    assert.equal(events.length,before);
    receive({...payload,sender:'remote'});await settle();
    assert.equal(events.at(-1)[3],'add');
    receive({type:'stop',userId:'u',sender:'remote'});await settle();
    assert.equal(events.at(-1)[3],'remove');
    tokenFx.ready=()=>false;game.modules.get('fxmaster').active=false;
    const plays=f.calls.filter(c=>c[0]==='play').length;
    await f.api.play(r.id,{source:f.source,targets:[f.target]});
    assert.ok(f.calls.filter(c=>c[0]==='play').length>plays);
    assert.ok(f.api.activity().some(e=>e.status==='Skipped' && /unavailable/.test(e.detail)));
    await f.api.stop();
  } finally {Object.assign(tokenFx,engine);delete globalThis.FXMASTER;}
});

test("compiled path motion resolves links before transport and preserves selected target", async () => {
  const f = await boot("pf2e");
  const recipe = { id: "linked-path", name: "Linked path", trigger: "manual", stages: [
    { kind: "motion", stageId: "ready", motion: "pulse", subject: "source", duration: 100, delay: 0 },
    { kind: "motion", stageId: "rush", motion: "rush", subject: "source", afterStage: "ready", timingAnchor: "end", startOffset: 20, duration: 100, distance: 8, perSquare: 50, targetSelection: "last" },
  ] };
  f.settings.set("recipes", { schema: 1, recipes: [recipe] });
  await f.api.play(recipe.id, { source: f.source, targets: [f.target] });
  const payload = f.calls.filter(c => c[0] === "socket" && c[2].type === "motion").at(-1)[2];
  assert.equal(payload.targetId, f.target.id);
  assert.equal(payload.stage.afterStage, "");
  assert.equal(payload.stage.delay, 120);
  assert.equal(payload.stage.duration, 200);
  assert.equal(payload.stage.motionTarget, undefined);
  assert.doesNotThrow(() => JSON.stringify(payload));
  assert.equal(f.source.mesh.position.x, 100);
});

test("cached pre-socket server manifest explains blocked PF2e attacks while private motion preview works", async () => {
  const f = await boot("pf2e");
  Object.assign(game.modules.get("animater"), {
    socket: false,
    version: "0.1.0",
  });
  const r = f.api.recipes().find((r) => r.id === "casting-flourish");
  Object.assign(r, { trigger: "attack", match: "ignition", enabled: true });
  r.stages = [{ ...r.stages[0], duration: 100, delay: 0 }];
  f.settings.set("recipes", { schema: 1, recipes: [r] });
  f.settings.set("automatic", true);
  await f.fire("createChatMessage", {
    id: "stale-manifest-attack",
    author: { id: "u" },
    item: f.item,
    speaker: { token: "t", scene: "s" },
    flags: { pf2e: { context: { type: "attack-roll" } } },
  });
  await settle();
  assert.equal(f.api.activity()[0].status, "Blocked");
  assert.match(
    f.api.activity()[0].detail,
    /Stop and start the Foundry server instance/,
  );
  assert.equal(
    f.calls.filter((c) => c[0] === "play" || c[0] === "socket").length,
    0,
  );
  await f.api.preview(r.id);
  assert.equal(f.calls.filter((c) => c[0] === "socket").length, 0);
  assert.equal(f.source.mesh.position.y, 100);
  // A newly launched server sends its new manifest to reloaded clients.
  Object.assign(game.modules.get("animater"), {
    socket: true,
    version: "0.2.0",
  });
  await f.api.play(r.id, { source: f.source, targets: [] });
  assert.equal(f.calls.find((c) => c[0] === "socket")[2].type, "motion");
  assert.equal(f.source.mesh.position.y, 100);
});
test("PF2e bootstrap: GM-only settings, source-token safety, effect/region hooks", async () => {
  const f = await boot("pf2e");
  assert.equal(f.settings.get("automatic"), false);
  assert.equal(f.menus[0].restricted, true);
  // Players open their own Studio (recipes pending GM approval); configuration stays GM-only.
  assert.equal(f.bindings[0].restricted, false);
  const controls = { tokens: { tools: {} } };
  await f.fire("getSceneControlButtons", controls);
  assert.equal(controls.tokens.tools.animater.visible, true);
  game.user.isGM = false;
  const playerControls = { tokens: { tools: {} } };
  await f.fire("getSceneControlButtons", playerControls);
  assert.equal(playerControls.tokens.tools.animater.visible, true);
  game.user.isGM = true;
  const ember = f.api.recipes()[0];
  ember.stages.forEach((s) => (s.delay = 0));
  f.settings.set("recipes", { schema: 1, recipes: [ember] });
  const message = {
    id: "m",
    author: { id: "u" },
    item: f.item,
    speaker: { token: "t", scene: "s" },
    flags: { pf2e: { context: { type: "attack-roll" } } },
  };
  await f.fire("createChatMessage", message);
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 0);
  f.settings.set("automatic", true);
  // Native PF2e records the roll target in context; current targeting may have
  // been cleared by the time createChatMessage fires.
  game.user.targets.clear();
  message.flags.pf2e.context.target = { token: "Scene.s.Token.target" };
  await f.fire("createChatMessage", message);
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
  await f.fire("createChatMessage", message);
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
  await f.fire("createChatMessage", {
    ...message,
    id: "wrong-scene",
    speaker: { token: "t", scene: "other" },
  });
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
  assert.ok(f.hooks.has("createItem"));
  assert.ok(f.hooks.has("createRegion"));
  f.api.open();
  game.user.isGM = false;
  // A player saving their own recipes updates their user: the Studio stays open.
  await f.fire("updateUser", game.user, { flags: { animater: { playerRecipes: { schema: 1, recipes: [] } } } });
  assert.ok(!f.calls.includes("close"));
  // Losing the GM role re-renders the window for its new permissions.
  await f.fire("updateUser", game.user, { role: 1 });
  assert.ok(f.calls.includes("close"));
});
test("PF2e 8.5 placed circle Region triggers the saved area recipe at its native size", async () => {
  const f = await boot("pf2e");
  f.item.name = "Fireball";
  f.item.type = "spell";
  f.item.system = { area: { type: "burst", value: 20 } };
  const recipe = f.api.recipes().find((r) => r.id === "nova");
  f.settings.set("recipes", { schema: 1, recipes: [recipe] });
  f.settings.set("automatic", true);
  // shapeDataFromEffectArea / placeRegionFromItem in installed PF2e 8.5.1.
  const region = {
    uuid: "Scene.s.Region.fireball",
    documentName: "Region",
    parent: { id: "s" },
    flags: { pf2e: { areaShape: "burst", origin: { uuid: f.item.uuid } } },
    shapes: [{ type: "circle", x: 600, y: 300, radius: 400 }],
  };
  await f.fire("createRegion", region, {}, "other");
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 0);
  await f.fire("createRegion", region, {}, "u");
  await settle();
  assert.equal(
    f.calls.filter((c) => c[0] === "play").length,
    1,
    JSON.stringify(f.api.activity()),
  );
  assert.deepEqual(f.calls.find((c) => c[0] === "atLocation")[1], {
    x: 600,
    y: 300,
  });
  assert.deepEqual(f.calls.find((c) => c[0] === "size")[1], {
    width: 800,
    height: "auto",
  });
  await f.fire("createRegion", region, {}, "u");
  await f.fire(
    "createRegion",
    { ...region, uuid: "Scene.other.Region.fireball", parent: { id: "other" } },
    {},
    "u",
  );
  await f.fire(
    "createRegion",
    { ...region, uuid: "Scene.s.Region.manual", flags: {} },
    {},
    "u",
  );
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
});

test("PF2e 8.5 placed line Region triggers plug-and-play without saved automation", async () => {
  const record = PF2E_SPELLS.find((s) => s.name === "Lightning Bolt");
  const recipe = spellRecipe(record);
  const f = await boot("pf2e", recipe.stages.flatMap((s) => s.assets));
  Object.assign(f.item, {
    type: "spell",
    name: record.name,
    system: { area: record.area },
    _stats: { compendiumSource: recipe.itemUuid },
  });
  f.settings.set("recipes", { schema: 1, recipes: [] });
  f.settings.set("spellCatalog", useCatalogSpell({}, record.id));
  assert.equal(f.settings.get("automatic"), false);
  const region = {
    uuid: "Scene.s.Region.lightning",
    documentName: "Region",
    parent: { id: "s" },
    flags: { pf2e: { areaShape: "line", origin: { uuid: f.item.uuid } } },
    shapes: [
      { type: "line", x: 150, y: 200, length: 2400, width: 100, rotation: 90 },
    ],
  };
  await f.fire("createRegion", region, {}, "u");
  await settle();
  assert.ok(
    f.calls.some((c) => c[0] === "play"),
    JSON.stringify(f.api.activity()),
  );
  const endpoint = f.calls.find((c) => c[0] === "stretchTo")[1];
  assert.ok(Math.abs(endpoint.x - 150) < 1e-8);
  assert.equal(endpoint.y, 2600);
  await f.api.stop();
});
async function grimTendrilsPlacement() {
  const record = PF2E_SPELLS.find((spell) => spell.name === "Grim Tendrils");
  const recipe = spellRecipe(record);
  const f = await boot("pf2e", recipe.stages.flatMap((stage) => stage.assets));
  Object.assign(f.item, {
    type: "spell", name: record.name, rank: 3,
    system: { area: record.area },
    _stats: { compendiumSource: recipe.itemUuid },
  });
  f.settings.set("recipes", { schema: 1, recipes: [] });
  f.settings.set("spellCatalog", useCatalogSpell({}, record.id));
  const region = {
    uuid: "Scene.s.Region.grim", documentName: "Region", parent: { id: "s" },
    flags: { pf2e: { messageId: "grim-card", areaShape: "line", origin: {
      uuid: f.item.uuid, actor: "Actor.a", castRank: 3,
    } } },
    shapes: [{ type: "line", x: 100, y: 100, length: 600, width: 100, rotation: 45 }],
  };
  return { ...f, region };
}

function assertGrimTendrilsPlayed(f, source = f.source) {
  assert.equal(f.calls.filter((call) => call[0] === "play").length, 1,
    JSON.stringify(f.api.activity()));
  assert.equal(f.calls.find((call) => call[0] === "atLocation")[1], source);
  const endpoint = f.calls.find((call) => call[0] === "stretchTo")[1];
  assert.ok(Math.abs(endpoint.x - (100 + 600 / Math.SQRT2)) < 1e-8);
  assert.ok(Math.abs(endpoint.y - (100 + 600 / Math.SQRT2)) < 1e-8);
  assert.ok(f.calls.some((call) => call[0] === "file" &&
    call[1] === "jb2a.energy_strands.range.multiple.dark_purple02.01"));
  assert.ok(f.calls.some((call) => call[0] === "file" &&
    call[1] === "jb2a.energy_strands.range.standard.dark_purple02.01"));
  assert.equal(f.calls.filter((call) => call[0] === "stretchTo").length, 2);
  // Sequencer duration uses media time; slowed wall-clock time is longer.
  assert.ok(f.calls.some((call) => call[0] === "duration" && call[1] >= 3333));
}

test("Grim Tendrils native line placement plays the complete catalog recipe without targets", async () => {
  const f = await grimTendrilsPlacement();
  game.user.targets.clear();
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assertGrimTendrilsPlayed(f);
  await f.api.stop();
});

test("Grim Tendrils chat-card placement recovers an embedded spell absent from actor items", async () => {
  const f = await grimTendrilsPlacement();
  // Native scroll/wand cards reconstruct casting.embeddedSpell. Its temporary
  // Actor Item UUID need not resolve after the consumable has been used.
  globalThis.fromUuid = async () => null;
  game.messages = new Map([["grim-card", {
    item: f.item, speakerActor: f.actor, speaker: { token: "t", scene: "s" },
  }]]);
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assertGrimTendrilsPlayed(f);
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assert.equal(f.calls.filter((call) => call[0] === "play").length, 1);
  await f.api.stop();
});

test("Grim Tendrils chat-card placement uses the recorded caster among unselected actor tokens", async () => {
  const f = await grimTendrilsPlacement();
  f.source.controlled = false;
  canvas.tokens.controlled = [];
  canvas.tokens.placeables.push({ ...f.source, id: "another-caster", center: { x: 900, y: 900 } });
  game.messages = new Map([["grim-card", {
    item: f.item, speakerActor: f.actor, speaker: { token: "t", scene: "s" },
  }]]);
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assertGrimTendrilsPlayed(f);
  await f.api.stop();
});

test("Grim Tendrils placement ignores a chat card's token from a different scene", async () => {
  const f = await grimTendrilsPlacement();
  f.source.controlled = false;
  const wrongSource = { ...f.source, actor: { id: "wrong-actor" } };
  canvas.tokens.get = () => wrongSource;
  game.messages = new Map([["grim-card", {
    item: f.item, speakerActor: f.actor, speaker: { token: "other-token", scene: "other-scene" },
  }]]);
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assertGrimTendrilsPlayed(f);
  await f.api.stop();
});

test("Grim Tendrils placement resolves the native origin actor for an unowned source spell", async () => {
  const f = await grimTendrilsPlacement();
  delete f.item.actor;
  const resolve = globalThis.fromUuid;
  globalThis.fromUuid = async (uuid) => uuid === "Actor.a" ? f.actor : resolve(uuid);
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assertGrimTendrilsPlayed(f);
  await f.api.stop();
});

test("a native spell area with an unresolved source reports the failure in Activity", async () => {
  const f = await grimTendrilsPlacement();
  f.region.name = "Grim Tendrils";
  globalThis.fromUuid = async () => null;
  await f.fire("createRegion", { ...f.region, parent: { id: "other-scene" } }, {}, "u");
  await settle();
  assert.equal(f.api.activity().length, 0);
  await f.fire("createRegion", f.region, {}, "u");
  await settle();
  assert.equal(f.calls.filter((call) => call[0] === "play").length, 0);
  assert.ok(f.api.activity().some((entry) => entry.status === "Skipped" &&
    entry.detail === "Grim Tendrils: source item could not be resolved."));
});

test("PF2e placed cone Region triggers directional footage with portable native clipping", async () => {
  const key = "jb2a.breath_weapons.fire.cone.orange.01", f = await boot("pf2e", [key]);
  Object.assign(f.item, { type: "spell", name: "Cone QA", system: { area: { type: "cone", value: 30 } } });
  f.settings.set("recipes", { schema: 1, recipes: [{ id: "cone-qa", name: "Cone QA", trigger: "template", enabled: true, match: "Cone QA", stages: [{ kind: "template", assets: [key], duration: 100 }] }] });
  f.settings.set("automatic", true);
  const polygons = [{ points: [300, 400, 300, 1000, 100, 800] }];
  globalThis.PIXI = { Polygon: class { constructor(points) { this.points = points; } } };
  const region = { uuid: "Scene.s.Region.cone-qa", documentName: "Region", parent: { id: "s" }, flags: { pf2e: { origin: { uuid: f.item.uuid } } }, shapes: [{ type: "cone", x: 300, y: 400, radius: 600, angle: 90, rotation: 90, polygons }] };
  await f.fire("createRegion", region, {}, "u");
  await settle();
  assert.ok(f.calls.some(c => c[0] === "play"), JSON.stringify(f.api.activity()));
  assert.ok(Math.abs(f.calls.find(c => c[0] === "stretchTo")[1].x - 300) < 1e-8);
  assert.equal(f.calls.find(c => c[0] === "stretchTo")[1].y, 1000);
  assert.deepEqual(f.calls.find(c => c[0] === "mask")[1][0].points, polygons[0].points);
  await f.api.stop();
});

test("D&D 5e bootstrap: native V2 activity hooks, no chat duplication, circular area geometry", async () => {
  const f = await boot("dnd5e");
  assert.ok(f.hooks.has("dnd5e.rollAttackV2"));
  // createChatMessage is hooked only to log the attacker for finishers; it plays nothing (no chat duplication).
  assert.ok(f.hooks.has("createChatMessage"));
  assert.ok(f.hooks.has("createActiveEffect"));
  const ember = f.api.recipes()[0];
  ember.stages.forEach((s) => (s.delay = 0));
  const nova = f.api.recipes().find((r) => r.id === "nova");
  f.settings.set("recipes", { schema: 1, recipes: [ember, nova] });
  f.settings.set("automatic", true);
  await f.fire("dnd5e.rollAttackV2", [{ total: 12 }], {
    subject: { item: f.item, actor: f.actor, name: "Attack" },
  });
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
  await f.fire("dnd5e.rollAttackV2", [{ total: 12 }], { subject: null });
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
  const activity = { item: { ...f.item, name: "Fireball" }, actor: f.actor };
  globalThis.fromUuid = async () => activity;
  const region = {
    uuid: "Scene.s.Region.r",
    documentName: "Region",
    parent: { id: "s" },
    flags: { dnd5e: { activity: "Actor.a.Item.i.Activity.nova" } },
    shapes: [{ type: "ellipse", x: 200, y: 300, radiusX: 100, radiusY: 100 }],
  };
  await f.fire("createRegion", region, {}, "other");
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 1);
  await f.fire("createRegion", region, {}, "u");
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 2);
  assert.deepEqual(f.calls.filter((c) => c[0] === "size").at(-1)[1], {
    width: 200,
    height: "auto",
  });
  await f.fire(
    "createRegion",
    {
      ...region,
      uuid: "Scene.s.Region.oval",
      shapes: [{ type: "ellipse", radiusX: 100, radiusY: 200 }],
    },
    {},
    "u",
  );
  await settle();
  assert.equal(f.calls.filter((c) => c[0] === "play").length, 2);
  assert.match(f.api.activity()[0].detail, /circular/);
});

test("PF2e: a use finisher plays on a successful attack with its item, not on a miss", async () => {
  const f = await boot("pf2e");
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [{ id: "fling", name: "Fling", trigger: "manual", match: "Ignition", finisher: { on: "use" }, stages: [{ kind: "motion", motion: "shake", subject: "targets", duration: 600, assets: [] }] }] });
  const message = (id, outcome) => ({ id, author: { id: "u" }, item: f.item, actor: f.actor, isRoll: true, flags: { pf2e: { context: { type: "attack-roll", outcome, target: { token: "Scene.s.Token.target" } }, origin: { uuid: f.item.uuid } } }, speaker: { scene: "s", token: "t" } });
  await f.fire("createChatMessage", message("miss", "failure"));
  await settle();
  assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 0);
  await f.fire("createChatMessage", message("hit", "success"));
  await settle();
  assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 1);
});

// A killing blow on an NPC: a damage roll from "Ignition" aimed at the target token, then the
// actor's HP drops to 0 through preUpdateActor/updateActor as Foundry fires them.
async function killTarget(f, { finishers = [], defaultFinisher = "", crit = false, damage = {} } = {}) {
  foundry.utils.hasProperty ??= (object, path) => path.split(".").reduce((o, k) => (o && k in o ? o[k] : undefined), object) !== undefined;
  const npc = { id: "npc", type: "npc", system: { attributes: { hp: { value: 5 } } }, getActiveTokens: () => [f.target] };
  Object.assign(f.target, { name: "Orc", actor: npc, w: 100, h: 100 });
  Object.assign(f.target.document, { parent: { id: "s" }, hidden: false, width: 1, height: 1, rotation: 0, texture: {} });
  f.settings.set("automatic", true);
  f.settings.set("defaultFinisher", defaultFinisher);
  f.settings.set("recipes", { schema: 1, recipes: finishers });
  await f.fire("createChatMessage", { id: "dmg", author: { id: "u" }, item: f.item, actor: f.actor, isRoll: true, rolls: [{ instances: [{ type: "fire", total: 9 }] }],
    flags: { pf2e: { context: { type: "damage-roll", ...(crit ? { outcome: "criticalSuccess" } : {}), target: { token: "Scene.s.Token.target", actor: "Actor.npc" } }, origin: { uuid: f.item.uuid } } }, speaker: { scene: "s", token: "t" } , ...damage });
  const changes = { system: { attributes: { hp: { value: 0 } } } }, options = {};
  await f.fire("preUpdateActor", npc, changes, options);
  npc.system.attributes.hp.value = 0;
  await f.fire("updateActor", npc, changes, options, "u");
  await settle();
  return f.api.activity().filter((e) => e.status === "Finisher");
}
const killFin = (id, name, match) => ({ id, name, trigger: "manual", match, finisher: { on: "kill", knockback: 0, ending: "body" }, stages: [{ kind: "motion", motion: "shake", subject: "targets", duration: 100, assets: [] }] });

test("finishers are part of the module: there is no setting to turn them on or off", async () => {
  const f = await boot("pf2e");
  assert.equal(f.settings.has("finishers"), false, "no Finishers setting is registered");
  const entries = await killTarget(f, { finishers: [killFin("burn", "Burn up", "Ignition")] });
  assert.deepEqual(entries.map((e) => e.detail), ["Burn up: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("kill path: the killing item's kill finisher plays on the NPC", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { finishers: [killFin("burn", "Burn up", "Ignition")] });
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Burn up: Orc/);
  await f.api.stop();
});

test("kill path: with no assigned finisher the default finisher plays", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { finishers: [killFin("other", "Other", "Dagger"), killFin("def", "Default drop", "")], defaultFinisher: "def" });
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Default drop/);
  await f.api.stop();
});

test("kill path: neither an assigned nor a default finisher keeps the old collapse", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { finishers: [killFin("other", "Other", "Dagger")] });
  assert.equal(entries.length, 0, JSON.stringify(f.api.activity()));
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.notEqual(f.target.mesh.rotation, 0, "the old collapse tips the token");
  await f.api.stop();
});

test("kill path: a knockback finisher with no travel of its own shoves the NPC away and writes it where it lands", async (t) => {
  const f = await boot("pf2e");
  const writes = [];
  f.target.document.update = async (data) => { writes.push(data); Object.assign(f.target.document, { x: data.x ?? f.target.document.x, y: data.y ?? f.target.document.y }); };
  const wallAt = 520;
  stubGlobal(t, "CONFIG", { ...CONFIG, Canvas: { polygonBackends: { move: { testCollision: (a, b) => Math.max(a.x, b.x) >= wallAt } } } });
  canvas.dimensions = { sceneRect: { x: 0, y: 0, width: 3000, height: 3000 } };
  const shove = { ...killFin("shove", "Shove", "Ignition"), finisher: { on: "kill", knockback: 3, ending: "body" } };
  const entries = await killTarget(f, { finishers: [shove] });
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  await new Promise((resolve) => setTimeout(resolve, 600));
  const moved = writes.find((w) => w.x !== undefined);
  assert.ok(moved, JSON.stringify(f.api.activity()));
  assert.deepEqual([moved.x, moved.y], [450, 50], "two squares away from the attacker, stopped short of the wall");
  assert.deepEqual(moved["flags.animater.displaced"], { fromX: 250, fromY: 50, finisher: "shove" });
  await f.api.stop();
});

test("displace-commit: the GM writes for the sender who owns the attacker, never for a forged or unrelated user", async () => {
  const f = await boot("pf2e");
  const updates = [], scene = { id: "s" };
  const orc = { uuid: "Scene.s.Token.orc", documentName: "Token", parent: scene, x: 100, y: 100, width: 1, height: 1, hidden: false,
    actor: { system: { attributes: { hp: { value: 5 } } } }, testUserPermission: () => false, update: async (data) => updates.push(data) };
  const hero = { uuid: "Scene.s.Token.hero", documentName: "Token", parent: scene, testUserPermission: (user) => user.id === "p1" };
  globalThis.fromUuid = async (uuid) => ({ [orc.uuid]: orc, [hero.uuid]: hero })[uuid] ?? null;
  game.users.set("p1", { id: "p1", isGM: false });
  game.users.set("p2", { id: "p2", isGM: false });
  game.users.activeGM = { isSelf: true };
  canvas.dimensions = { sceneRect: { x: 0, y: 0, width: 3000, height: 3000 } };
  const receive = f.sockets.get("module.animater");
  const request = { type: "displace-commit", sender: "remote", uuid: orc.uuid, attackerUuid: hero.uuid, x: 300, y: 100, fromX: 100, fromY: 100, finisher: "fling" };
  receive({ ...request, userId: "p1" }, "p2");
  receive({ ...request, userId: "u" }, "p2");
  receive({ ...request, userId: "p1" });
  receive({ ...request, x: 2000 }, "p1");   // 19 squares: past the longest landing (17 + size)
  await settle();
  assert.equal(updates.length, 0, "unrelated sender (even claiming the GM), no sender, and an out-of-reach move are ignored");
  receive({ ...request, fromX: "evil", finisher: "x".repeat(200) }, "p1");
  await settle();
  assert.equal(updates.length, 1);
  assert.equal(updates[0].x, 300);
  assert.deepEqual(updates[0]["flags.animater.displaced"], { finisher: "x".repeat(80) }, "the flag keeps only finite origins and a short name");
});

// Players' picks: user u1 (not a GM) owns the actor; the item's animater.finisher flag names the pick.
// Stubbed globals are put back when the test ends.
function stubGlobal(t, name, value) {
  const had = Object.hasOwn(globalThis, name), before = globalThis[name];
  globalThis[name] = value;
  t.after(() => { if (had) globalThis[name] = before; else delete globalThis[name]; });
}
function playerOwns(t, f, { choice = "pick" } = {}) {
  game.users.set("u1", { id: "u1", isGM: false });
  f.actor.testUserPermission = (user, level) => user?.id === "u1" && level === "OWNER";
  const flags = choice ? { finisher: choice } : {};
  Object.assign(f.item, {
    isOwner: true,
    getFlag: (scope, key) => (scope === "animater" ? flags[key] : undefined),
    setFlag: async (scope, key, value) => { flags[key] = value; },
    unsetFlag: async (scope, key) => { delete flags[key]; },
  });
  stubGlobal(t, "fromUuidSync", (uuid) => (uuid === f.item.uuid ? f.item : null));
  return flags;
}
const pickFin = (on, players = ["u1"], extra = {}) => ({ id: "pick", name: "Pick", trigger: "manual", match: "Ignition", finisher: { on, players, knockback: 0, ending: "body", ...extra }, stages: [{ kind: "motion", motion: "shake", subject: "targets", duration: 100, assets: [] }] });
const strikeMessage = (f, id, outcome) => ({ id, author: { id: "u" }, item: f.item, actor: f.actor, isRoll: true, flags: { pf2e: { context: { type: "attack-roll", outcome, target: { token: "Scene.s.Token.target" } }, origin: { uuid: f.item.uuid } } }, speaker: { scene: "s", token: "t" } });
// The surviving target records every write a finisher would make on it.
function watchTarget(f) {
  const writes = [];
  f.target.name = "Orc";
  f.target.actor = { id: "npc", type: "npc", system: { attributes: { hp: { value: 5 } } } };
  f.target.document.update = async (data) => writes.push(["update", data]);
  f.target.document.actor = { toggleStatusEffect: async (...args) => writes.push(["status", ...args]) };
  return writes;
}

test("player pick: a crit plays the player's critical finisher on the surviving target, writing nothing", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  const writes = watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("critical")] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = f.api.activity().filter((e) => e.status === "Finisher");
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Pick: Orc/);
  assert.deepEqual(writes, [], "a survivor is neither hidden nor Defeated");
  await f.api.stop();
});

test("player pick: a plain hit does not play a critical pick", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("critical")] });
  await f.fire("createChatMessage", strikeMessage(f, "hit", "success"));
  await settle();
  assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 0);
});

test("GM crit finisher: an NPC's item (no player owners) plays its name-matched critical finisher", async () => {
  const f = await boot("pf2e");
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [{ ...pickFin("criticalOrKill", []), id: "gmcrit", name: "GM crit" }] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await settle();
  const entries = f.api.activity().filter((e) => e.status === "Finisher");
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /GM crit: Orc/);
  await f.api.stop();
});

test("player pick: a kill pick beats the GM's name-matched kill finisher", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition"), pickFin("kill")] });
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Pick: Orc/);
  await f.api.stop();
});

test("player pick: a pick whose player was removed from Available to falls back to the GM's finisher", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition"), pickFin("kill", ["u2"])] });
  assert.deepEqual(entries.map((e) => e.detail), ["GM drop: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

// Available to only decides what a player may pick (pf2e-combater's item sheet, api.finishers):
// a player's item with no pick plays the GM's Applies-to finishers and the default, like an NPC's.
test("player item with no pick: a finisher linked to it by the GM plays, though no player is given it", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f, { choice: null });
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition")] });
  assert.deepEqual(entries.map((e) => e.detail), ["GM drop: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("player item with no pick: the default finisher plays", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f, { choice: null });
  const entries = await killTarget(f, { finishers: [killFin("other", "Other", "Dagger"), killFin("def", "Default drop", "")], defaultFinisher: "def" });
  assert.deepEqual(entries.map((e) => e.detail), ["Default drop: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("player item with no pick: a crit plays the GM's critical finisher", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f, { choice: null });
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [{ ...pickFin("criticalOrKill", []), id: "gmcrit", name: "GM crit" }] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["GM crit: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("player pick: a crit with a kill pick plays no GM critical finisher", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("kill"), { ...pickFin("critical", []), id: "gmcrit", name: "GM crit" }] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await settle();
  assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 0, JSON.stringify(f.api.activity()));
});

test("player pick: a use pick plays on a successful use, and the GM's name-matched use finisher does not", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [{ ...pickFin("use", []), id: "gmuse", name: "GM use" }, pickFin("use")] });
  await f.fire("createChatMessage", strikeMessage(f, "miss", "failure"));
  await settle();
  assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 0, "a miss plays nothing");
  await f.fire("createChatMessage", strikeMessage(f, "hit", "success"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["Pick: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("NPC item: a kill keeps GM name matching, and a stray pick flag is ignored", async (t) => {
  const f = await boot("pf2e");
  Object.assign(f.item, { getFlag: (scope, key) => (scope === "animater" && key === "finisher" ? "pick" : undefined) });
  stubGlobal(t, "fromUuidSync", (uuid) => (uuid === f.item.uuid ? f.item : null));
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition"), pickFin("kill", ["*"])] });
  assert.deepEqual(entries.map((e) => e.detail), ["GM drop: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("player pick: a crit that then kills with critical damage plays the travel once and only adds the ending", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  const writes = watchTarget(f);
  f.target.actor.getActiveTokens = () => [f.target];
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("criticalOrKill")] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(writes, []);
  const entries = await killTarget(f, { finishers: [pickFin("criticalOrKill")], crit: true });
  assert.equal(entries.filter((e) => /^Pick: Orc$/.test(e.detail)).length, 1, JSON.stringify(f.api.activity()));
  assert.equal(entries.filter((e) => /^Pick: Orc \(ending\)$/.test(e.detail)).length, 1);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(writes.filter((w) => w[0] === "status").length, 1, "the body ending marks it Defeated");
  await f.api.stop();
});

test("api.finishers: a player's choices, and setting or clearing an item's pick", async (t) => {
  const f = await boot("pf2e");
  const flags = playerOwns(t, f);
  const changed = [];
  stubGlobal(t, "Hooks", { ...globalThis.Hooks, callAll: (name, ...args) => changed.push([name, ...args]) });
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("critical"), { ...pickFin("kill", ["u2"]), id: "theirs", name: "Theirs" }] });
  assert.deepEqual(f.api.finishers.choices(f.item, { id: "u1" }), [{ id: "pick", name: "Pick", description: "", on: "critical" }]);
  assert.equal(f.api.finishers.getChoice(f.item), "pick");
  await assert.rejects(f.api.finishers.setChoice(f.item, "other-not-allowed"));
  assert.equal(flags.finisher, "pick");
  await f.api.finishers.setChoice(f.item, null);
  assert.equal(f.api.finishers.getChoice(f.item), null);
  assert.deepEqual(changed, [["animater.finisherChoiceChanged", f.item, null]]);
});

const finishedEmits = (f) => f.calls.filter((c) => c[0] === "socket" && c[2]?.type === "finisher-played").map((c) => c[2]);
const pickRuns = (f) => f.api.activity().filter((e) => e.status === "Finisher" && /^Pick: Orc/.test(e.detail)).map((e) => e.detail);
// Client A strikes the crit; client B applies the killing damage.
async function critOnClientA(t) {
  const a = await boot("pf2e");
  playerOwns(t, a);
  watchTarget(a);
  a.settings.set("automatic", true);
  a.settings.set("recipes", { schema: 1, recipes: [pickFin("criticalOrKill")] });
  await a.fire("createChatMessage", strikeMessage(a, "crit", "criticalSuccess"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  await a.api.stop();
  return finishedEmits(a);
}
async function killOnClientB(t, emits, { crit }) {
  const b = await boot("pf2e");
  playerOwns(t, b);
  watchTarget(b);
  b.target.actor.getActiveTokens = () => [b.target];
  const receive = b.sockets.get("module.animater");
  for (const data of emits) receive(data, "u1");
  await killTarget(b, { finishers: [pickFin("criticalOrKill")], crit });
  await new Promise((resolve) => setTimeout(resolve, 100));
  await b.api.stop();
  return b;
}

test("two clients: the crit's mark reaches the killing client, whose critical blow plays only the ending", async (t) => {
  const emits = await critOnClientA(t);
  assert.deepEqual(emits.map((e) => [e.key, e.played]), [["t:target:Actor.a.Item.i:pick", true]], "the attacker's client broadcasts the mark");
  const b = await killOnClientB(t, emits, { crit: true });
  assert.deepEqual(pickRuns(b), ["Pick: Orc (ending)"], JSON.stringify(b.api.activity()));
});

test("two clients: a non-critical killing blow inside the window plays the full travel", async (t) => {
  const emits = await critOnClientA(t);
  const b = await killOnClientB(t, emits, { crit: false });
  assert.deepEqual(pickRuns(b), ["Pick: Orc"], JSON.stringify(b.api.activity()));
});

test("finished marks: a malformed broadcast is ignored, and a mark is used once", async (t) => {
  const key = "t:target:Actor.a.Item.i:pick";
  const b = await killOnClientB(t, [{ type: "finisher-played", sender: "x", key: 42 }, { type: "finisher-played", sender: "x", key: "x".repeat(500) }], { crit: true });
  assert.deepEqual(pickRuns(b), ["Pick: Orc"], "no valid mark: full travel");
  const c = await killOnClientB(t, [{ type: "finisher-played", sender: "x", key, played: true }], { crit: true });
  assert.deepEqual(pickRuns(c), ["Pick: Orc (ending)"]);
  // The same client's next critical kill with that item: the mark is spent.
  c.target.actor.system.attributes.hp.value = 5;
  const again = await killTarget(c, { finishers: [pickFin("criticalOrKill")], crit: true });
  assert.deepEqual(again.filter((e) => /^Pick: Orc/.test(e.detail)).map((e) => e.detail).sort(), ["Pick: Orc", "Pick: Orc (ending)"]);
  await c.api.stop();
});

test("finished marks: a crit whose play never starts takes its mark back", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  watchTarget(f);
  f.settings.set("automatic", true);
  // No stage can play (its artwork is not installed), so nothing starts.
  f.settings.set("recipes", { schema: 1, recipes: [{ ...pickFin("critical"), stages: [{ kind: "cast", assets: [] }] }] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(finishedEmits(f).map((e) => e.played), [true, false], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("crit finisher and GM use finisher on the same target: only the crit finisher moves it", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("critical"), { ...pickFin("use", []), id: "gmuse", name: "GM use" }] });
  await f.fire("createChatMessage", strikeMessage(f, "crit", "criticalSuccess"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail);
  assert.deepEqual(entries, ["Pick: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

// A saving throw against Ignition, rolled by the saver (as PF2e's Check.roll writes it): the caster's
// token in context.origin, the saver in context.target and the speaker, the spell in flags.pf2e.origin.
const saveMessage = (f, id, outcome, saver = "target") => ({ id, author: { id: "u" }, isRoll: true, speaker: { scene: "s", token: saver },
  flags: { pf2e: { context: { type: "saving-throw", outcome, origin: { actor: "Actor.a", token: "Scene.s.Token.t" }, target: { actor: `Actor.${saver}`, token: `Scene.s.Token.${saver}` } }, origin: { actor: "Actor.a", uuid: f.item.uuid, type: "spell" } } } });
const gmCrit = () => ({ ...pickFin("criticalOrKill", []), id: "gmcrit", name: "GM crit" });
function saveSetup(f, finishers) {
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: finishers });
}

test("save: a critically failed save plays the caster's crit finisher on the saver, the caster as attacker", async () => {
  const f = await boot("pf2e");
  saveSetup(f, [gmCrit()]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["GM crit: Orc"], JSON.stringify(f.api.activity()));
  assert.deepEqual(finishedEmits(f).map((e) => [e.key, e.played]), [["t:target:Actor.a.Item.i:gmcrit:save", true]], "marked as struck by the caster's token");
  await f.api.stop();
});

for (const outcome of ["criticalSuccess", "success", "failure"]) {
  test(`save: a ${outcome} save plays no crit finisher`, async () => {
    const f = await boot("pf2e");
    saveSetup(f, [gmCrit()]);
    await f.fire("createChatMessage", saveMessage(f, "sv", outcome));
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 0, JSON.stringify(f.api.activity()));
  });
}

test("save: the pick on the caster's (player-owned) spell plays, the GM's crit finisher does not", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  saveSetup(f, [gmCrit(), pickFin("critical")]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["Pick: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

// A second creature in the area: a goblin token beside the orc.
function addGoblin(t, f) {
  const gob = { id: "gob", name: "Gob", visible: true, center: { x: 500, y: 100 }, w: 100, h: 100,
    actor: { id: "gob", type: "npc", system: { attributes: { hp: { value: 5 } } } },
    document: { x: 450, y: 50, parent: { id: "s" }, hidden: false, width: 1, height: 1, rotation: 0, texture: {}, testUserPermission: () => true, update: async () => {} },
    mesh: { position: { x: 500, y: 100, set() {} }, rotation: 0, scale: { x: 1, y: 1, set() {} } } };
  gob.actor.getActiveTokens = () => [gob];
  const get = canvas.tokens.get, from = globalThis.fromUuid;
  canvas.tokens.get = (id) => (id === "gob" ? gob : get(id));
  stubGlobal(t, "fromUuid", async (uuid) => (uuid === "Scene.s.Token.gob" ? { object: gob } : from(uuid)));
  return gob;
}

test("save: an area spell's saves play the crit finisher only on the creatures that critically failed", async (t) => {
  const f = await boot("pf2e");
  addGoblin(t, f);
  saveSetup(f, [gmCrit()]);
  game.user.targets = new Set([f.target, canvas.tokens.get("gob")]);
  await f.fire("createChatMessage", saveMessage(f, "sv-orc", "criticalFailure", "target"));
  await f.fire("createChatMessage", saveMessage(f, "sv-gob", "failure", "gob"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["GM crit: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("kill path: one area spell that kills two creatures plays a finisher on each", async (t) => {
  const f = await boot("pf2e");
  const gob = addGoblin(t, f);
  foundry.utils.hasProperty ??= (object, path) => path.split(".").reduce((o, k) => (o && k in o ? o[k] : undefined), object) !== undefined;
  const npc = { id: "npc", type: "npc", system: { attributes: { hp: { value: 5 } } }, getActiveTokens: () => [f.target] };
  Object.assign(f.target, { name: "Orc", actor: npc, w: 100, h: 100 });
  Object.assign(f.target.document, { parent: { id: "s" }, hidden: false, width: 1, height: 1, rotation: 0, texture: {} });
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [killFin("burn", "Burn up", "Ignition")] });
  // An area's damage roll is aimed at nobody in particular.
  await f.fire("createChatMessage", { id: "dmg", author: { id: "u" }, item: f.item, actor: f.actor, isRoll: true, rolls: [{ instances: [{ type: "fire", total: 9 }] }],
    flags: { pf2e: { context: { type: "damage-roll" }, origin: { uuid: f.item.uuid } } }, speaker: { scene: "s", token: "t" } });
  for (const actor of [npc, gob.actor]) {
    const changes = { system: { attributes: { hp: { value: 0 } } } }, options = {};
    await f.fire("preUpdateActor", actor, changes, options);
    actor.system.attributes.hp.value = 0;
    await f.fire("updateActor", actor, changes, options, "u");
  }
  await settle();
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail).sort(), ["Burn up: Gob", "Burn up: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("save: a crit-failed save that the spell's (non-critical) damage then kills plays only the ending", async () => {
  const f = await boot("pf2e");
  saveSetup(f, [gmCrit()]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = await killTarget(f, { finishers: [gmCrit()] });
  assert.deepEqual(entries.map((e) => e.detail).sort(), ["GM crit: Orc", "GM crit: Orc (ending)"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

// A save reaction is logged once its motion (up to 1.1 s) has played out.
const saveReactions = (f) => f.api.activity().filter((e) => /^Saving throw/.test(e.recipe ?? ""));
const reactionWindow = () => new Promise((resolve) => setTimeout(resolve, 1500));
test("save: a crit finisher on the saver skips its save reaction (one animation per token)", async () => {
  const f = await boot("pf2e");
  saveSetup(f, [gmCrit()]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await reactionWindow();
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["GM crit: Orc"], JSON.stringify(f.api.activity()));
  assert.deepEqual(saveReactions(f), [], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("save: a crit-failed save with no crit finisher still plays its save reaction", async () => {
  const f = await boot("pf2e");
  saveSetup(f, [killFin("burn", "Burn up", "Ignition")]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await reactionWindow();
  assert.equal(saveReactions(f).length, 1, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("save: a player's crit-or-kill pick that needs a critical ends the crit-failed saver on the spell's plain damage", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  const pick = pickFin("criticalOrKill", ["u1"], { success: "critical" });
  saveSetup(f, [pick]);
  f.target.actor.getActiveTokens = () => [f.target];
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = await killTarget(f, { finishers: [pick] });
  assert.deepEqual(entries.map((e) => e.detail).sort(), ["Pick: Orc", "Pick: Orc (ending)"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("save: an NPC's crit finisher that needs a critical ends the saver on plain damage, and the default does not replay a travel", async () => {
  const f = await boot("pf2e");
  const crit = { ...gmCrit(), finisher: { ...gmCrit().finisher, success: "critical" } };
  saveSetup(f, [crit]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = await killTarget(f, { finishers: [crit, killFin("def", "Default drop", "")], defaultFinisher: "def" });
  assert.deepEqual(entries.map((e) => e.detail).sort(), ["GM crit: Orc", "GM crit: Orc (ending)"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("save: a GM critical-only finisher's travel is not replayed by the default finisher on the kill", async () => {
  const f = await boot("pf2e");
  const crit = { ...gmCrit(), finisher: { ...gmCrit().finisher, on: "critical" } };
  saveSetup(f, [crit]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = await killTarget(f, { finishers: [crit, killFin("def", "Default drop", "")], defaultFinisher: "def" });
  assert.deepEqual(entries.map((e) => e.detail).sort(), ["Default drop: Orc (ending)", "GM crit: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("save: a player caster's spell that cannot be found plays the GM's crit finisher", async (t) => {
  const f = await boot("pf2e");
  game.users.set("u1", { id: "u1", isGM: false });
  f.actor.testUserPermission = (user, level) => user?.id === "u1" && level === "OWNER";
  stubGlobal(t, "fromUuid", async (uuid) => (uuid === "Scene.s.Token.target" ? { object: f.target } : null));
  saveSetup(f, [{ ...gmCrit(), itemUuid: f.item.uuid }]);
  await f.fire("createChatMessage", saveMessage(f, "sv", "criticalFailure"));
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 1, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("kill path: an unknown killing item from a player's token plays the default finisher", async (t) => {
  const f = await boot("pf2e");
  game.users.set("u1", { id: "u1", isGM: false });
  f.actor.testUserPermission = (user, level) => user?.id === "u1" && level === "OWNER";
  stubGlobal(t, "fromUuidSync", () => null);
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition")], defaultFinisher: "gm", damage: { item: null, flags: { pf2e: { context: { type: "damage-roll", target: { token: "Scene.s.Token.target", actor: "Actor.npc" } }, origin: { uuid: "Actor.a.Item.gone" } } } } });
  assert.deepEqual(entries.map((e) => e.detail), ["GM drop: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("kill path: an unknown killing item and an unknown attacker keep the default finisher", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition")], defaultFinisher: "gm", damage: { item: null, speaker: { scene: "s" }, flags: { pf2e: { context: { type: "damage-roll", target: { token: "Scene.s.Token.target", actor: "Actor.npc" } } } } } });
  assert.deepEqual(entries.map((e) => e.detail), ["GM drop: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("player pick: a kill pick that needs a critical does not play on a plain kill", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f);
  const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Ignition"), pickFin("kill", ["u1"], { success: "critical" })] });
  assert.deepEqual(entries.map((e) => e.detail), [], JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("api.finishers: even a GM cannot pick a finisher that does not apply to the item", async (t) => {
  const f = await boot("pf2e");
  const flags = playerOwns(t, f);
  stubGlobal(t, "Hooks", { ...globalThis.Hooks, callAll: () => {} });
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("critical"), { ...pickFin("kill", []), id: "dagger", name: "Dagger only", match: "Dagger" }, { ...pickFin("kill", []), id: "gmonly", name: "GM only" }, { ...pickFin("kill", ["u1"]), id: "theirs", name: "Theirs" }] });
  assert.equal(game.user.isGM, true);
  await assert.rejects(f.api.finishers.setChoice(f.item, "dagger"), /isn't available/);
  assert.equal(flags.finisher, "pick");
  await f.api.finishers.setChoice(f.item, "theirs");
  assert.equal(flags.finisher, "theirs", "a GM may pick any finisher given to an owner");
});

test("api.finishers: a GM cannot pick, on a player-owned item, a finisher no owner has", async (t) => {
  const f = await boot("pf2e");
  const flags = playerOwns(t, f);
  stubGlobal(t, "Hooks", { ...globalThis.Hooks, callAll: () => {} });
  f.settings.set("recipes", { schema: 1, recipes: [pickFin("critical"), { ...pickFin("kill", []), id: "gmonly", name: "GM only" }, { ...pickFin("kill", ["u", "u2"]), id: "others", name: "Others" }] });
  assert.equal(game.user.isGM, true);
  await assert.rejects(f.api.finishers.setChoice(f.item, "gmonly"), (error) => error instanceof Error && /isn't available/.test(error.message));
  await assert.rejects(f.api.finishers.setChoice(f.item, "others"), /isn't available/);
  assert.equal(flags.finisher, "pick");
});

// Synthetic strikes (PF2e's basic unarmed, Fist): no Item document; the pick lives on the actor.
function strikeOwner(t, f, { pick = "pick" } = {}) {
  game.users.set("u1", { id: "u1", isGM: false });
  const flags = { strikeFinishers: pick ? { fist: pick } : {} };
  Object.assign(f.actor, {
    isOwner: true,
    items: { get: () => undefined },
    testUserPermission: (user, level) => user?.id === "u1" && level === "OWNER",
    getFlag: (scope, key) => (scope === "animater" ? flags[key] : undefined),
    setFlag: async (scope, key, value) => { flags[key] = { ...flags[key], ...value }; },
    unsetFlag: async (scope, path) => { const [key, sub] = path.split("."); delete flags[key]?.[sub]; },
  });
  const fist = { id: "xxxxxxFISTxxxxxx", uuid: "Actor.a.Item.xxxxxxFISTxxxxxx", documentName: "Item", name: "Fist", slug: "fist", actor: f.actor, getFlag: () => undefined };
  stubGlobal(t, "fromUuidSync", () => null);
  return { flags, fist };
}
const fistPick = (on, extra = {}) => ({ ...pickFin(on, ["u1"], extra), match: "Fist" });

test("api.finishers: a strike descriptor's choices, and its pick set and cleared on the actor", async (t) => {
  const f = await boot("pf2e");
  const { flags, fist } = strikeOwner(t, f, { pick: null });
  const changed = [];
  stubGlobal(t, "Hooks", { ...globalThis.Hooks, callAll: (name, ...args) => changed.push([name, ...args]) });
  f.settings.set("recipes", { schema: 1, recipes: [fistPick("critical"), { ...fistPick("kill"), id: "sword", name: "Sword", match: "Longsword" }, { ...pickFin("kill", ["u2"]), id: "theirs", name: "Theirs", match: "Fist" }] });
  const strike = { actor: f.actor, name: "Fist", slug: "fist" };
  assert.deepEqual(f.api.finishers.choices(strike, { id: "u1" }).map((c) => c.id), ["pick"]);
  assert.equal(f.api.finishers.getChoice(strike), null);
  await f.api.finishers.setChoice(strike, "pick");
  assert.deepEqual(flags.strikeFinishers, { fist: "pick" }, "stored on the actor by strike slug");
  assert.equal(f.api.finishers.getChoice(strike), "pick");
  assert.equal(f.api.finishers.getChoice(fist), "pick", "the synthetic Fist item reads the same pick");
  await assert.rejects(f.api.finishers.setChoice(strike, "sword"), /isn't available/, "a finisher for another strike");
  await assert.rejects(f.api.finishers.setChoice(strike, "theirs"), /isn't available/, "a finisher no owner has");
  await f.api.finishers.setChoice(fist, null);
  assert.equal(f.api.finishers.getChoice(strike), null);
  assert.deepEqual(changed.map((c) => c.slice(0, 1).concat(c.slice(2))), [["animater.finisherChoiceChanged", "pick"], ["animater.finisherChoiceChanged", null]]);
  const before = game.user;
  game.user = { id: "u2", isGM: false };
  f.actor.isOwner = false;
  await assert.rejects(f.api.finishers.setChoice(strike, "pick"), /owner or a GM/);
  game.user = before;
});

test("synthetic strike: a Fist crit plays the actor's pick", async (t) => {
  const f = await boot("pf2e");
  const { fist } = strikeOwner(t, f);
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [fistPick("critical")] });
  await f.fire("createChatMessage", { ...strikeMessage(f, "crit", "criticalSuccess"), item: fist, flags: { pf2e: { context: { type: "attack-roll", outcome: "criticalSuccess", target: { token: "Scene.s.Token.target" } }, origin: { uuid: fist.uuid, actor: "Actor.a" } } } });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const entries = f.api.activity().filter((e) => e.status === "Finisher");
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Pick: Orc/);
  await f.api.stop();
});

test("synthetic strike: a Fist kill plays the actor's pick, even when the message's item is gone", async (t) => {
  for (const item of ["fist", null]) {
    const f = await boot("pf2e");
    const { fist } = strikeOwner(t, f);
    const entries = await killTarget(f, { finishers: [killFin("gm", "GM drop", "Fist"), fistPick("kill")], defaultFinisher: "gm",
      damage: { item: item && fist, flags: { pf2e: { context: { type: "damage-roll", options: ["item:slug:fist"], target: { token: "Scene.s.Token.target", actor: "Actor.npc" } }, origin: { uuid: fist.uuid, actor: "Actor.a" } } } } });
    assert.deepEqual(entries.map((e) => e.detail), ["Pick: Orc"], JSON.stringify(f.api.activity()));
    await f.api.stop();
  }
});

test("synthetic strike: a player's Fist with no pick plays the GM's Fist finishers on a crit and a kill", async (t) => {
  const f = await boot("pf2e");
  const { fist } = strikeOwner(t, f, { pick: null });
  watchTarget(f);
  f.settings.set("automatic", true);
  f.settings.set("recipes", { schema: 1, recipes: [{ ...pickFin("critical", []), id: "gmcrit", name: "GM crit", match: "Fist" }] });
  await f.fire("createChatMessage", { ...strikeMessage(f, "crit", "criticalSuccess"), item: fist });
  await new Promise((resolve) => setTimeout(resolve, 250));
  assert.deepEqual(f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail), ["GM crit: Orc"], JSON.stringify(f.api.activity()));
  await f.api.stop();
  const k = await boot("pf2e");
  const { fist: kfist } = strikeOwner(t, k, { pick: null });
  const entries = await killTarget(k, { finishers: [killFin("gm", "GM drop", "Fist")],
    damage: { id: "dmg2", item: kfist, flags: { pf2e: { context: { type: "damage-roll", target: { token: "Scene.s.Token.target", actor: "Actor.npc" } }, origin: { uuid: kfist.uuid, actor: "Actor.a" } } } } });
  assert.deepEqual(entries.map((e) => e.detail), ["GM drop: Orc"], JSON.stringify(k.api.activity()));
  await k.api.stop();
});

test("Defeated look: the finisher body ending marks Defeated without the overlay unless the look is Foundry's", async () => {
  for (const [look, overlay] of [["overlay", true], ["icon", false], ["effect", false]]) {
    const f = await boot("pf2e");
    assert.equal(f.settings.get("defeatedLook"), "overlay", "registered with Foundry's look as the default");
    f.settings.set("defeatedLook", look);
    const writes = watchTarget(f);
    await killTarget(f, { finishers: [killFin("burn", "Burn up", "Ignition")] });
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.deepEqual(writes.filter((w) => w[0] === "status").map((w) => w.slice(1)), [["dead", { active: true, overlay }]], look);
    // Any other source (combat tracker, system) creating the status goes through the same rule.
    const effect = { statuses: new Set(["dead"]), flags: { core: { overlay: true } }, updateSource(c) { this.flags.core.overlay = c["flags.core.overlay"]; } };
    await f.fire("preCreateActiveEffect", effect, { statuses: ["dead"], flags: { core: { overlay: true } } }, {}, "u");
    assert.equal(effect.flags.core.overlay, overlay, `${look}: tracker toggle`);
    await f.api.stop();
  }
});

// The "By damage type" default: the killing blow's damage type picks a built-in finisher.
const damageOf = (type) => ({ rolls: [{ instances: [{ type, total: 9 }] }] });
test("kill path, by damage type: a piercing kill plays Perforated, a fire kill Cinders", async () => {
  for (const [type, name] of [["piercing", "Perforated"], ["fire", "Cinders"]]) {
    const f = await boot("pf2e");
    const entries = await killTarget(f, { finishers: [killFin("other", "Other", "Dagger")], defaultFinisher: "by-damage-type", damage: damageOf(type) });
    assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
    assert.match(entries[0].detail, new RegExp(`^${name}: Orc`));
    await f.api.stop();
  }
});

test("kill path, by damage type: an unknown type keeps the old collapse", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { defaultFinisher: "by-damage-type", damage: damageOf("untyped") });
  assert.equal(entries.length, 0, JSON.stringify(f.api.activity()));
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.notEqual(f.target.mesh.rotation, 0, "the old collapse tips the token");
  await f.api.stop();
});

// Review focus: HP set to 0 by hand, or a roll with no typed damage, leaves nothing in the damage log.
test("kill path, by damage type: no damage type remembered keeps the old collapse", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { defaultFinisher: "by-damage-type", damage: { rolls: [] } });
  assert.equal(entries.length, 0, JSON.stringify(f.api.activity()));
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.notEqual(f.target.mesh.rotation, 0, "the old collapse tips the token");
  await f.api.stop();
});

test("kill path, by damage type: the killing item's own kill finisher still wins", async () => {
  const f = await boot("pf2e");
  const entries = await killTarget(f, { finishers: [killFin("burn", "Burn up", "Ignition")], defaultFinisher: "by-damage-type" });
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Burn up: Orc/);
  await f.api.stop();
});

test("kill path, by damage type: a player's item with no pick plays the built-in", async (t) => {
  const f = await boot("pf2e");
  playerOwns(t, f, { choice: null });
  const entries = await killTarget(f, { defaultFinisher: "by-damage-type" });
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /^Cinders: Orc/);
  await f.api.stop();
});

// Daggerheart: an adversary's hit points are marked up to the maximum; the last mark is the kill.
async function killDaggerheart(f, { type = "adversary", track = "hitPoints", before = 3, after = 4, max = 4, finishers = [killFin("def", "Default drop", "")], defaultFinisher = "def", owners = [] } = {}) {
  const npc = { id: "npc", type, system: { resources: { [track]: { value: before, max } } }, getActiveTokens: () => [f.target],
    testUserPermission: (user, level) => owners.includes(user?.id) && level === "OWNER" };
  for (const id of owners) game.users.set(id, { id, isGM: false });
  Object.assign(f.target, { name: "Bandit", actor: npc, w: 100, h: 100 });
  Object.assign(f.target.document, { parent: { id: "s" }, hidden: false, width: 1, height: 1, rotation: 0, texture: {} });
  f.settings.set("automatic", true);
  f.settings.set("defaultFinisher", defaultFinisher);
  f.settings.set("recipes", { schema: 1, recipes: finishers });
  const changes = { system: { resources: { [track]: { value: after } } } }, options = {};
  await f.fire("preUpdateActor", npc, changes, options);
  npc.system.resources[track].value = after;
  await f.fire("updateActor", npc, changes, options, "u");
  await settle();
  return f.api.activity().filter((e) => e.status === "Finisher");
}

test("Daggerheart kill: the adversary's last hit point marked plays the default finisher", async () => {
  const f = await boot("daggerheart");
  const entries = await killDaggerheart(f);
  assert.equal(entries.length, 1, JSON.stringify(f.api.activity()));
  assert.match(entries[0].detail, /Default drop: Bandit/);
  await f.api.stop();
});

test("Daggerheart kill: an adversary already at max, or one whose marks are cleared, plays nothing", async () => {
  for (const [before, after] of [[4, 4], [3, 1]]) {
    const f = await boot("daggerheart");
    const entries = await killDaggerheart(f, { before, after });
    assert.equal(entries.length, 0, `${before}→${after}: ${JSON.stringify(f.api.activity())}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(f.target.mesh.rotation, 0, "no collapse either");
    await f.api.stop();
  }
});

test("Daggerheart kill: a companion goes down on its stress track; a player's character is not an NPC", async () => {
  const companion = await boot("daggerheart");
  assert.equal((await killDaggerheart(companion, { type: "companion", track: "stress", before: 2, after: 3, max: 3 })).length, 1, JSON.stringify(companion.api.activity()));
  await companion.api.stop();
  const pc = await boot("daggerheart");
  assert.equal((await killDaggerheart(pc, { type: "character", owners: ["u1"] })).length, 0, "a player-owned character plays no kill finisher");
  game.users.delete("u1");
  await pc.api.stop();
});

test("PF2e kill path is unchanged: a heal or an NPC already at 0 plays nothing", async () => {
  for (const [before, after] of [[0, -2], [3, 5]]) {
    const f = await boot("pf2e");
    const npc = { id: "npc", type: "npc", system: { attributes: { hp: { value: before } } }, getActiveTokens: () => [f.target] };
    Object.assign(f.target, { name: "Orc", actor: npc, w: 100, h: 100 });
    Object.assign(f.target.document, { parent: { id: "s" }, hidden: false, width: 1, height: 1, rotation: 0, texture: {} });
    f.settings.set("automatic", true); f.settings.set("defaultFinisher", "def");
    f.settings.set("recipes", { schema: 1, recipes: [killFin("def", "Default drop", "")] });
    const changes = { system: { attributes: { hp: { value: after } } } }, options = {};
    await f.fire("preUpdateActor", npc, changes, options);
    npc.system.attributes.hp.value = after;
    await f.fire("updateActor", npc, changes, options, "u");
    await settle();
    assert.equal(f.api.activity().filter((e) => e.status === "Finisher").length, 0, `${before}→${after}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
    assert.equal(f.target.mesh.rotation, 0, "no collapse");
    await f.api.stop();
  }
});

// Daggerheart mode: a GM client with automatic playback on; the target token sits on scene "s".
async function bootDaggerheart(extraKeys = [], options) {
  const f = await boot("daggerheart", extraKeys, options);
  f.settings.set("automatic", true);
  f.target.document.parent = { id: "s" };
  Object.assign(f.item, { id: "i", type: "weapon", name: "Longsword", system: { attack: { range: "melee", damage: { main: { type: ["physical"] } } } } });
  return f;
}
const dhSaved = (trigger, match, id = `dh-${trigger}`) => ({ id, name: `DH ${trigger}`, enabled: true, trigger, match, stages: [{ kind: "cast", assets: ["jb2a.impact.001.orange"], duration: 600 }] });
const played = (f, name) => f.api.activity().filter((e) => e.status === "Played" && e.recipe === name).length;

test("Daggerheart: an attack roll plays its item's recipe once; the action's use hook does not repeat it", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("attack", "Longsword"), dhSaved("use", "Longsword")] });
  await f.fire("createChatMessage", rollMessage({ item: f.item, actor: f.actor }));
  await settle();
  assert.equal(played(f, "DH attack"), 1, JSON.stringify(f.api.activity()));
  const [action, config] = useHook({ item: f.item, actor: f.actor, action: { name: "Attack", roll: { type: "attack" } }, config: { hasRoll: true } });
  await f.fire("daggerheart.postUseAction", action, config);
  await settle();
  assert.equal(played(f, "DH attack"), 1);
  assert.equal(played(f, "DH use"), 0, "the rolled action never plays as a use");
  await f.api.stop();
});

test("Daggerheart: an ability used without a roll plays its use recipe", async () => {
  const f = await bootDaggerheart();
  Object.assign(f.item, { type: "domainCard", name: "A Soldier's Bond", system: { domain: "blade", level: 2, type: "ability" } });
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("use", "A Soldier's Bond")] });
  await f.fire("daggerheart.postUseAction", ...useHook({ item: f.item, actor: f.actor }));
  await settle();
  assert.equal(played(f, "DH use"), 1, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("Daggerheart: whispered, blind and other users' rolls play nothing here", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("attack", "Longsword")] });
  await f.fire("createChatMessage", rollMessage({ id: "w", item: f.item, actor: f.actor, whisper: ["gm"] }));
  await f.fire("createChatMessage", rollMessage({ id: "b", item: f.item, actor: f.actor, blind: true }));
  await f.fire("createChatMessage", rollMessage({ id: "o", item: f.item, actor: f.actor, author: "other" }));
  await settle();
  assert.equal(played(f, "DH attack"), 0, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("Daggerheart: an attack with no target still plays", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("attack", "Longsword")] });
  await f.fire("createChatMessage", rollMessage({ item: f.item, actor: f.actor, targets: [] }));
  await settle();
  assert.equal(played(f, "DH attack"), 1, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("Daggerheart: damage written onto the card plays once, however often the card is updated", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("damage", "Longsword")] });
  const message = rollMessage({ id: "card", item: f.item, actor: f.actor, damage: damageRoll() });
  await f.fire("updateChatMessage", message, { system: { damage: {} } }, {}, "u");
  await f.fire("updateChatMessage", message, { system: { damage: {} } }, {}, "u");
  await f.fire("updateChatMessage", message, { flavor: "edited" }, {}, "u");
  await settle();
  assert.equal(played(f, "DH damage"), 1, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

// Anyone who owns the speaker's actor may roll damage onto a player's card (the GM, a co-owner):
// the client that writes it plays it, once, whoever authored the card.
test("Daggerheart: damage the GM rolls onto another player's card plays once, on the GM's client", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("damage", "Longsword")] });
  const message = rollMessage({ id: "theirs", item: f.item, actor: f.actor, author: "other", damage: damageRoll() });
  await f.fire("updateChatMessage", message, { system: { damage: {} } }, {}, "u");
  await f.fire("updateChatMessage", message, { system: { damage: {} } }, {}, "u");
  await f.fire("updateChatMessage", message, { system: { damage: {} } }, {}, "other");
  await settle();
  assert.equal(played(f, "DH damage"), 1, JSON.stringify(f.api.activity()));
  await f.fire("updateChatMessage", rollMessage({ id: "hidden", item: f.item, actor: f.actor, author: "other", whisper: ["gm"], damage: damageRoll() }), { system: { damage: {} } }, {}, "u");
  await settle();
  assert.equal(played(f, "DH damage"), 1, "a whispered card still plays nothing");
  await f.api.stop();
});

test("Daggerheart: damage present when its message is created plays once, on the author's client", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("damage", "Longsword")] });
  await f.fire("createChatMessage", rollMessage({ id: "mine", item: f.item, actor: f.actor, damage: damageRoll() }));
  await f.fire("createChatMessage", rollMessage({ id: "theirs", item: f.item, actor: f.actor, author: "other", damage: damageRoll() }));
  await settle();
  assert.equal(played(f, "DH damage"), 1, JSON.stringify(f.api.activity()));
  await f.api.stop();
});

// An attack roll whose item is gone and whose action has no name. (With the action gone too, the
// adapter cannot tell an attack from any other roll and returns null: nothing to trace.)
test("Daggerheart: an attack roll whose item and action name are gone is an Activity Skipped row, not an error", async () => {
  const f = await bootDaggerheart();
  f.settings.set("recipes", { schema: 1, recipes: [] });
  await f.fire("createChatMessage", rollMessage({ item: null, action: { roll: { type: "attack" } }, actor: f.actor }));
  await settle();
  assert.ok(f.api.activity().some((e) => e.status === "Skipped" && /could not be found/.test(e.detail)), JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("Daggerheart: api.resolve reads a roll message; an older system version warns once", async (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const f = await bootDaggerheart([], { version: "2.9.0" });
  assert.equal(warn.mock.calls.filter((c) => /Daggerheart 2\.9\.0/.test(String(c.arguments[0]))).length, 1);
  f.settings.set("recipes", { schema: 1, recipes: [dhSaved("attack", "Longsword")] });
  const chat = (options) => ({ ...rollMessage(options), documentName: "ChatMessage" });
  assert.equal(f.api.resolve(chat({ item: f.item, actor: f.actor }))?.id, "dh-attack");
  assert.equal(f.api.resolve(chat({ item: f.item, actor: f.actor, roll: adversaryRoll({ type: "trait" }), action: { name: "Act", roll: { type: "trait" } } })), null);
  await f.api.stop();
});

// Flash moments read each system's HP track (hp-state.mjs): PF2e counts down to 0, Daggerheart marks
// hit points up to their maximum. A non-GM client asks the active GM to play the moment.
test("flash moments: a creature dropping, or marked defeated, asks for its moment in PF2e and Daggerheart", async () => {
  const tracks = {
    pf2e: { type: "npc", alive: () => ({ attributes: { hp: { value: 5, max: 10 } } }), down: () => ({ attributes: { hp: { value: 0, max: 10 } } }), changes: { system: { attributes: { hp: { value: 0 } } } } },
    daggerheart: { type: "adversary", alive: () => ({ resources: { hitPoints: { value: 2, max: 6 } } }), down: () => ({ resources: { hitPoints: { value: 6, max: 6 } } }), changes: { system: { resources: { hitPoints: { value: 6 } } } } },
  };
  for (const [system, track] of Object.entries(tracks)) {
    const f = await boot(system);
    game.user.isGM = false;
    const orc = Object.assign(f.actor, { name: "Orc", type: track.type, system: track.alive() });
    const ogre = { id: "b", name: "Ogre", type: track.type, system: track.alive() };
    const combat = { id: "c", started: true, combatants: [{ actor: orc, token: { disposition: -1 }, defeated: false }, { actor: ogre, token: { disposition: -1 }, defeated: false }] };
    game.combats = [combat];
    const asked = () => f.calls.filter((c) => c[0] === "socket" && c[2]?.type === "flash-moment").map((c) => c[2].event);
    const options = {};
    await f.fire("preUpdateActor", orc, track.changes, options);
    orc.system = track.down();
    await f.fire("updateActor", orc, track.changes, options, "u");
    assert.deepEqual(asked(), ["lastEnemy"], `${system}: dropping to its last hit point`);
    await f.fire("updateCombatant", { actor: ogre, name: "Ogre", combat }, { defeated: true }, {}, "u");
    assert.deepEqual(asked(), ["lastEnemy", "lastEnemy"], `${system}: marked defeated while standing`);
    await f.fire("updateCombatant", { actor: orc, name: "Orc", combat }, { defeated: true }, {}, "u");
    assert.equal(asked().length, 2, `${system}: one already down is not a second fall`);
    delete game.combats;
    await f.api.stop();
  }
});

test("Daggerheart catalog: a card's spellcast roll plays its domain animation with the catalog on; the API lists the library", async () => {
  const card = dhEntries("card").find((e) => e.name === "Blink Out");
  const keys = card.variants.flatMap((v) => dhCatalogRecipe(card, v.id).stages.flatMap((s) => s.assets));
  const f = await bootDaggerheart(keys);
  f.settings.set("automatic", false);
  f.settings.set("recipes", { schema: 1, recipes: [] });
  f.settings.set("daggerheartCardCatalog", useDhEntry({}, card.id));
  Object.assign(f.item, { type: "domainCard", name: card.name, system: { domain: card.domain, level: card.level, type: card.cardType } });
  await f.fire("createChatMessage", rollMessage({ item: f.item, actor: f.actor, roll: dualityRoll({ type: "spellcast" }), action: { name: "Cast", roll: { type: "spellcast" } } }));
  // "Played" is traced once the last delayed stage has started.
  const last = Math.max(...card.variants.flatMap((v) => dhCatalogRecipe(card, v.id).stages.map((s) => s.delay ?? 0)));
  await new Promise((resolve) => setTimeout(resolve, last + 400));
  assert.equal(played(f, card.name), 1, JSON.stringify(f.api.activity()));
  assert.equal(f.api.spells().spells.length, 210);
  assert.ok(f.api.spells().spells.every((e) => e.systemId === "daggerheart"));
  assert.ok(f.api.weapons().weapons.every((e) => e.systemId === "daggerheart"));
  assert.equal(f.api.conditions().conditions.length, 7);
  assert.equal(f.api.feats().feats.length, 0);
  await f.api.stop();
});

test("Daggerheart: Hope plays a gold accent on the roller, Fear a purple one, a critical none; the setting turns it off", async () => {
  const f = await bootDaggerheart(["jb2a.particle_burst.01.star.yellow", "jb2a.energy_strands.overlay.dark_purple.01"]);
  f.settings.set("recipes", { schema: 1, recipes: [] });
  await f.fire("createChatMessage", rollMessage({ id: "h", item: f.item, actor: f.actor, roll: dualityRoll({ hope: 9, fear: 3 }) }));
  await f.fire("createChatMessage", rollMessage({ id: "f", item: f.item, actor: f.actor, roll: dualityRoll({ hope: 3, fear: 9 }) }));
  await f.fire("createChatMessage", rollMessage({ id: "c", item: f.item, actor: f.actor, roll: dualityRoll({ hope: 6, fear: 6 }) }));
  await settle();
  assert.equal(played(f, "Hope"), 1, JSON.stringify(f.api.activity()));
  assert.equal(played(f, "Fear"), 1);
  assert.ok(f.calls.some((c) => c[0] === "file" && c[1] === "jb2a.particle_burst.01.star.yellow"));
  f.settings.set("daggerheartDualityAccent", false);
  await f.fire("createChatMessage", rollMessage({ id: "h2", item: f.item, actor: f.actor, roll: dualityRoll({ hope: 9, fear: 3 }) }));
  await settle();
  assert.equal(played(f, "Hope"), 1, "off: no accent");
  await f.api.stop();
});

test("Daggerheart: a Death move plays its moment; Vulnerable shows a lasting layer while the condition catalog is on", async (t) => {
  // Earlier tests can leave a fromUuidSync stub behind; the token and its effect exist here.
  stubGlobal(t, "fromUuidSync", (uuid) => ({ uuid }));
  const death = dhEntries("condition").find((e) => e.statusId === "deathMove"), vulnerable = dhEntries("condition").find((e) => e.statusId === "vulnerable");
  const keys = [death, vulnerable].flatMap((e) => dhCatalogRecipe(e).stages.flatMap((s) => s.assets));
  const f = await bootDaggerheart(keys);
  f.settings.set("recipes", { schema: 1, recipes: [] });
  f.settings.set("daggerheartConditionCatalog", { ...useDhEntry(useDhEntry({}, death.id), vulnerable.id), scope: "all" });
  const effect = { id: "dm", uuid: "Actor.a.ActiveEffect.dm", name: "Death Move", statuses: new Set(["deathMove"]), parent: f.actor };
  await f.fire("createActiveEffect", effect, {}, "u");
  // "Played" is traced once the delayed smoke stage (0.9 s) has started.
  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal(played(f, "Death move"), 1, JSON.stringify(f.api.activity()));
  const mark = { id: "vu", uuid: "Actor.a.ActiveEffect.vu", name: "Vulnerable", statuses: new Set(["vulnerable"]), active: true, parent: f.actor };
  Object.assign(f.actor, { uuid: "Actor.a", appliedEffects: [mark], statuses: new Set(["vulnerable"]), effects: [mark] });
  f.source.document.uuid = "Scene.s.Token.t";
  await f.api.refreshPersistent();
  await settle();
  assert.ok(f.calls.some((c) => c[0] === "persist"), "a lasting layer");
  await f.fire("canvasTearDown");
});

// Daggerheart: damage written onto the card, then the adversary's last hit point marked.
async function dhDamageThenKill(f, { item, damage, defaultFinisher = "by-damage-type", finishers = [] }) {
  Object.assign(f.item, item);
  const npc = { id: "npc", type: "adversary", system: { resources: { hitPoints: { value: 3, max: 4 } } }, getActiveTokens: () => [f.target] };
  Object.assign(f.target, { name: "Bandit", actor: npc, w: 100, h: 100 });
  Object.assign(f.target.document, { parent: { id: "s" }, hidden: false, width: 1, height: 1, rotation: 0, texture: {} });
  f.settings.set("defaultFinisher", defaultFinisher);
  f.settings.set("recipes", { schema: 1, recipes: finishers });
  await f.fire("updateChatMessage", rollMessage({ id: "dmg", item: f.item, actor: f.actor, damage, targets: [dhTarget("target", { actorId: "Actor.npc" })] }), { system: { damage: {} } }, {}, "u");
  const changes = { system: { resources: { hitPoints: { value: 4 } } } }, options = {};
  await f.fire("preUpdateActor", npc, changes, options);
  npc.system.resources.hitPoints.value = 4;
  await f.fire("updateActor", npc, changes, options, "u");
  await settle();
  return f.api.activity().filter((e) => e.status === "Finisher");
}

test("Daggerheart kill by damage type: a Longsword carves, a Shortbow perforates, Arcana blows apart, Midnight consumes", async () => {
  const cases = [
    [{ type: "weapon", name: "Longsword", system: { attack: { range: "melee" } } }, damageRoll(), "Carved"],
    [{ type: "weapon", name: "Shortbow", system: { attack: { range: "far" } } }, damageRoll(), "Perforated"],
    [{ type: "domainCard", name: "Blink Out", system: { domain: "arcana", level: 4, type: "spell" } }, damageRoll({ types: ["magical"] }), "Blown apart"],
    [{ type: "domainCard", name: "Dark Whispers", system: { domain: "midnight", level: 6, type: "spell" } }, damageRoll({ types: ["magical"] }), "Consumed"],
  ];
  for (const [item, damage, name] of cases) {
    const f = await bootDaggerheart();
    const entries = await dhDamageThenKill(f, { item, damage });
    assert.equal(entries.length, 1, `${item.name}: ${JSON.stringify(f.api.activity())}`);
    assert.match(entries[0].detail, new RegExp(`^${name}: Bandit`), item.name);
    await f.api.stop();
  }
});

test("Daggerheart kill: the killing item's own kill finisher wins, for a player's item with no pick too", async (t) => {
  const own = await bootDaggerheart();
  const mine = await dhDamageThenKill(own, { item: { type: "weapon", name: "Longsword" }, damage: damageRoll(), finishers: [killFin("cut", "Clean cut", "Longsword")] });
  assert.equal(mine.length, 1, JSON.stringify(own.api.activity()));
  assert.match(mine[0].detail, /Clean cut: Bandit/);
  await own.api.stop();
  const pc = await bootDaggerheart();
  playerOwns(t, pc, { choice: null });
  const theirs = await dhDamageThenKill(pc, { item: { type: "weapon", name: "Longsword" }, damage: damageRoll(), finishers: [killFin("cut", "Clean cut", "Longsword")] });
  assert.equal(theirs.length, 1, JSON.stringify(pc.api.activity()));
  assert.match(theirs[0].detail, /Clean cut: Bandit/, "a player's item with no pick plays the GM's finisher for it");
  await pc.api.stop();
});

test("Daggerheart finishers: a use finisher plays on a hit, not a miss or an untargeted roll; a critical plays the critical finisher", async () => {
  const f = await bootDaggerheart();
  const fling = { id: "fling", name: "Fling", trigger: "manual", match: "Longsword", finisher: { on: "use" }, stages: [{ kind: "motion", motion: "shake", subject: "targets", duration: 600, assets: [] }] };
  const crit = { id: "crit", name: "Crit", trigger: "manual", match: "Longsword", finisher: { on: "critical" }, stages: [{ kind: "motion", motion: "shake", subject: "targets", duration: 600, assets: [] }] };
  f.settings.set("recipes", { schema: 1, recipes: [fling, crit] });
  const finishers = () => f.api.activity().filter((e) => e.status === "Finisher");
  await f.fire("createChatMessage", rollMessage({ id: "miss", item: f.item, actor: f.actor, roll: dualityRoll({ hope: 3, fear: 2, modifier: 0 }) }));
  await f.fire("createChatMessage", rollMessage({ id: "none", item: f.item, actor: f.actor, targets: [] }));
  await settle();
  assert.equal(finishers().length, 0, JSON.stringify(f.api.activity()));
  await f.fire("createChatMessage", rollMessage({ id: "hit", item: f.item, actor: f.actor }));
  await settle();
  assert.equal(finishers().length, 1);
  assert.match(finishers()[0].detail, /Fling/);
  await f.fire("createChatMessage", rollMessage({ id: "crit", item: f.item, actor: f.actor, roll: dualityRoll({ hope: 6, fear: 6 }) }));
  await settle();
  assert.ok(finishers().some((e) => /Crit/.test(e.detail)), JSON.stringify(f.api.activity()));
  await f.api.stop();
});

test("Daggerheart finishers: one roll at two targets plays the use finisher only on the target it hit", async (t) => {
  const f = await bootDaggerheart();
  addGoblin(t, f);
  f.target.name = "Bandit";
  const fling = { id: "fling", name: "Fling", trigger: "manual", match: "Longsword", finisher: { on: "use" }, stages: [{ kind: "motion", motion: "shake", subject: "targets", duration: 600, assets: [] }] };
  f.settings.set("recipes", { schema: 1, recipes: [fling] });
  await f.fire("createChatMessage", rollMessage({ id: "two", item: f.item, actor: f.actor, targets: [dhTarget("target", { evasion: 10 }), dhTarget("gob", { evasion: 30 })] }));
  await settle();
  const details = f.api.activity().filter((e) => e.status === "Finisher").map((e) => e.detail);
  assert.equal(details.length, 1, JSON.stringify(f.api.activity()));
  assert.match(details[0], /Bandit/);
  await f.api.stop();
});
