import test from "node:test";
import assert from "node:assert/strict";
import { flashScreens } from "../../../scripts/engines/flash/flash-combat.mjs";
import { FLASH_EVENTS, MOMENT_EVENTS, validateFlash } from "../../../scripts/engines/flash/flash-model.mjs";

const ID = "animater";
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));

// A world with one GM client: hooks are captured, flash screens go out over the socket.
function world({ defaults = {}, gm = true, pick, host = {} } = {}) {
  const hooks = {}, sent = [];
  const screens = [validateFlash({ id: "roll", name: "Roll for Initiative", event: "initiated" }), validateFlash({ id: "ambush", name: "Ambush!", event: "initiated" }), validateFlash({ id: "go", name: "Combat Started", event: "start" }), validateFlash({ id: "boss", name: "Boss Battle", event: "start" }), validateFlash({ id: "duel", name: "Face Off", event: "any" })];
  const settings = { flashScreens: { schema: 1, screens }, flashDefaults: { start: "none", end: "none", ...defaults } };
  globalThis.Hooks = { on: (name, fn) => (hooks[name] ??= []).push(fn) };
  globalThis.canvas = { scene: { name: "Crypt" } };
  globalThis.ui = {};
  globalThis.game = {
    system: { id: "pf2e" },
    user: { id: "gm", isGM: gm },
    users: { activeGM: { isSelf: gm } },
    combats: [],
    settings: { get: (_, key) => settings[key], set: async (_, key, value) => { settings[key] = value; } },
    socket: { emit: (_, data) => sent.push(data) },
  };
  const api = flashScreens({ ID, clientId: "gm", quietHere: () => true, resolveMedia: (s) => s, trace: () => {}, ...(pick ? { pickFlash: pick } : {}), ...host });
  const fire = (name, ...args) => (hooks[name] ?? []).forEach((fn) => fn(...args));
  return { fire, api, played: () => sent.filter((d) => d.type === "flash").map((d) => d.screen.id) };
}
function encounter({ started = false } = {}) {
  const flags = {}, combatants = [];
  const combat = { id: "c1", started, round: started ? 1 : 0, combatants, getFlag: (_, k) => flags[k], setFlag: async (_, k, v) => { flags[k] = v; } };
  const add = (name = "Goblin") => { const c = { name, combat, token: { disposition: -1, texture: { src: "" } }, actor: { name } }; combatants.push(c); return c; };
  return { combat, add };
}

test("combat initiated is its own moment, off by default", () => {
  assert.equal(FLASH_EVENTS.initiated, "Combat initiated");
  assert.ok(MOMENT_EVENTS.includes("initiated"));
});

test("combat initiated plays once when combatants are added, before Begin Combat", async () => {
  const w = world({ defaults: { initiated: "roll", start: "go" } }), { combat, add } = encounter();
  for (const name of ["Goblin", "Orc", "Ogre"]) w.fire("createCombatant", add(name));
  await wait();
  assert.deepEqual(w.played(), ["roll"], "one screen for the burst of adds");
  w.fire("createCombatant", add("Late"));
  await wait();
  assert.deepEqual(w.played(), ["roll"], "not again on a later add");
  combat.started = true;
  w.fire("combatStart", combat);
  assert.deepEqual(w.played(), ["roll", "go"], "Begin Combat still plays the opening");
});

test("combat initiated stays quiet when off, when the combat is already started, and for players", async () => {
  const off = world({ defaults: { start: "go" } });
  off.fire("createCombatant", encounter().add());
  await wait();
  assert.deepEqual(off.played(), []);
  const started = world({ defaults: { initiated: "roll" } });
  started.fire("createCombatant", encounter({ started: true }).add());
  await wait();
  assert.deepEqual(started.played(), []);
  const player = world({ defaults: { initiated: "roll" }, gm: false });
  player.fire("createCombatant", encounter().add());
  await wait();
  assert.deepEqual(player.played(), []);
});

test("the opening no longer plays on add; it waits for Begin Combat", async () => {
  const w = world({ defaults: { start: "go", startWhen: "add" } }), { combat, add } = encounter();
  w.fire("createCombatant", add());
  await wait();
  assert.deepEqual(w.played(), [], "an old world's startWhen is ignored");
  combat.started = true;
  w.fire("combatStart", combat);
  assert.deepEqual(w.played(), ["go"]);
});

test("several combat initiated screens can be on; toggling adds and removes one", async () => {
  const { flashesOn, flashOn, toggleFlashOn } = await import("../../../scripts/engines/flash/flash-model.mjs");
  assert.deepEqual(toggleFlashOn({ initiated: "roll" }, "initiated", "ambush"), ["roll", "ambush"], "an old single pick is kept");
  assert.deepEqual(toggleFlashOn({ initiated: ["roll", "ambush"] }, "initiated", "roll"), ["ambush"]);
  assert.equal(toggleFlashOn({ crit: "a" }, "crit", "b"), "b", "other moments stay one at a time");
  assert.equal(toggleFlashOn({ crit: "a" }, "crit", "a"), "none");
  assert.deepEqual(flashesOn("none"), []);
  assert.ok(flashOn({ initiated: ["roll", "ambush"] }, "initiated", "ambush"));
});

test("with several on, the GM picks which plays for everyone, once", async () => {
  const asked = [];
  const w = world({ defaults: { initiated: ["roll", "ambush"] }, pick: async (options) => { asked.push(options.map((s) => s.id)); return "ambush"; } }), { add } = encounter();
  for (const name of ["Goblin", "Orc"]) w.fire("createCombatant", add(name));
  await wait();
  assert.deepEqual(asked, [["roll", "ambush"]], "one picker for the burst");
  assert.deepEqual(w.played(), ["ambush"]);
  w.fire("createCombatant", add("Late"));
  await wait();
  assert.equal(asked.length, 1, "not asked again");
});

test("the picker's None, a closed window or Begin Combat while choosing play nothing; one on plays without asking", async () => {
  for (const answer of ["none", null]) {
    const w = world({ defaults: { initiated: ["roll", "ambush"] }, pick: async () => answer });
    w.fire("createCombatant", encounter().add());
    await wait();
    assert.deepEqual(w.played(), [], String(answer));
  }
  const { combat, add } = encounter();
  const begun = world({ defaults: { initiated: ["roll", "ambush"] }, pick: async () => { combat.started = true; return "roll"; } });
  begun.fire("createCombatant", add());
  await wait();
  assert.deepEqual(begun.played(), []);
  const single = world({ defaults: { initiated: ["ambush"] }, pick: () => assert.fail("asked with one on") });
  single.fire("createCombatant", encounter().add());
  await wait();
  assert.deepEqual(single.played(), ["ambush"]);
});

test("with several openings on, the GM picks one at Begin Combat; one on or a tracker pick plays without asking", async () => {
  const asked = [];
  const w = world({ defaults: { start: ["go", "boss", "duel"] }, pick: async (options, _combat, event) => { asked.push([event, options.map((s) => s.id)]); return "boss"; } });
  const { combat } = encounter({ started: true });
  w.fire("combatStart", combat);
  await wait(10);
  assert.deepEqual(asked, [["start", ["go", "boss", "duel"]]]);
  assert.deepEqual(w.played(), ["boss"]);
  w.fire("combatStart", combat);
  await wait(10);
  assert.equal(asked.length, 1, "once per combat");
  const one = world({ defaults: { start: ["go"] }, pick: () => assert.fail("asked with one on") });
  one.fire("combatStart", encounter({ started: true }).combat);
  assert.deepEqual(one.played(), ["go"]);
  const tracker = world({ defaults: { start: ["go", "boss"] }, pick: () => assert.fail("asked despite the tracker pick") }), picked = encounter({ started: true }).combat;
  await picked.setFlag("animater", "flashStart", "duel");
  tracker.fire("combatStart", picked);
  assert.deepEqual(tracker.played(), ["duel"]);
  const none = world({ defaults: { start: ["go", "boss"] }, pick: async () => "none" });
  none.fire("combatStart", encounter({ started: true }).combat);
  await wait(10);
  assert.deepEqual(none.played(), []);
});

test("a trimmed sound layer stops at its trimmed length with a short fade; an untrimmed one plays out", async (t) => {
  const stops = [], played = [];
  const sound = { stop: (opts) => stops.push(opts) };
  const prev = globalThis.foundry;
  globalThis.foundry = { audio: { AudioHelper: { play: async (data) => { played.push(data.src); return sound; } } } };
  t.after(() => { globalThis.foundry = prev; });
  globalThis.Hooks = { on: () => {} };
  globalThis.game = { system: { id: "pf2e" }, user: { id: "gm", isGM: true }, users: { activeGM: { isSelf: true } }, combats: [], settings: { get: () => ({}) } };
  const api = flashScreens({ ID, clientId: "gm", quietHere: () => false, resolveMedia: (s) => s, trace: () => {} });
  api.playSound("door.ogg", 0.7, 120);
  api.playSound("door.ogg", 0.7, 0);
  await wait(250);
  assert.deepEqual(played, ["door.ogg", "door.ogg"]);
  assert.deepEqual(stops, [{ fade: 150 }], "only the trimmed one is stopped");
});

test("the tracker's flash menus go in its own header, never a popped-out window's title bar", async () => {
  const { trackerHeader } = await import("../../../scripts/engines/flash/flash-combat.mjs");
  const titleBar = { name: "window title bar" }, own = { name: "tracker header" };
  // A popped-out tracker is a whole window: its title bar comes first in the page.
  const popout = { querySelector: (sel) => ({ ".combat-tracker-header": own, "header:not(.window-header)": own, ".combat-tracker-header, header": titleBar })[sel] ?? null };
  assert.equal(trackerHeader(popout), own);
  const sidebar = { querySelector: (sel) => (sel === ".combat-tracker-header" ? own : null) };
  assert.equal(trackerHeader(sidebar), own);
  const plain = { querySelector: (sel) => (sel === "header:not(.window-header)" ? own : null) };
  assert.equal(trackerHeader(plain), own, "a tracker without the usual class still uses its own header");
  assert.equal(trackerHeader({ querySelector: () => null }), null);
});

test("a screen with {manual} names asks the GM once, sends the answers to everyone, and the combat remembers them", async () => {
  const w = world({ defaults: { start: "named" } }), { combat } = encounter({ started: true });
  const named = validateFlash({ id: "named", name: "Showdown", event: "start", layers: [{ kind: "text", text: "{party} vs {manual:Enemy side}" }, { kind: "text", text: "{manual}" }] });
  game.settings.set(ID, "flashScreens", { schema: 1, screens: [named] });
  game.actors = { party: { name: "The Lantern Bearers" } };
  const sent = [], asked = [];
  game.socket.emit = (_, data) => sent.push(data);
  globalThis.foundry = { utils: { escapeHTML: (s) => s }, applications: { api: { DialogV2: { prompt: async (o) => {
    asked.push(o.content);
    const values = { m0: "The Red Mantis", m1: "Ambush" };
    return o.ok.callback(null, { form: { elements: Object.fromEntries(Object.entries(values).map(([k, value]) => [k, { value }])) } });
  } } } } };
  await w.api.play(named, { everyone: true, combat });
  assert.equal(asked.length, 1, "one popup with every name");
  assert.match(asked[0], /Enemy side/);
  assert.deepEqual(sent.at(-1).vars.manual, { "Enemy side": "The Red Mantis", "": "Ambush" });
  assert.equal(sent.at(-1).vars.party, "The Lantern Bearers");
  assert.deepEqual(combat.getFlag(ID, "flashManual"), { "Enemy side": "The Red Mantis", "": "Ambush" });
  // The next time, the popup starts from this combat's answers.
  await w.api.play(named, { everyone: true, combat });
  assert.match(asked[1], /value="The Red Mantis"/);
  delete globalThis.foundry; delete game.actors;
});

test("a kill finisher on the last enemy waits for Finish Him!: as long as the screen, only for the last one", () => {
  const w = world({ defaults: { finalEnemy: "finish" } });
  const finish = validateFlash({ id: "finish", name: "Finish Him!", event: "finalEnemy", duration: 2600 });
  game.settings.set(ID, "flashScreens", { schema: 1, screens: [finish] });
  const who = (id, disposition, hp) => ({ actor: { id, hasPlayerOwner: disposition > 0, system: { attributes: { hp: { value: hp } } } }, token: { disposition }, defeated: false });
  const orc = who("orc", -1, 0), ogre = who("ogre", -1, 9), hero = who("hero", 1, 12);
  const fight = { id: "f", started: true, combatants: [orc, ogre, hero], scene: { id: "s" } };
  game.combats = [fight];
  assert.equal(w.api.finaleLength(orc.actor), 0, "another enemy still stands");
  fight.combatants = [orc, hero];
  assert.equal(w.api.finaleLength(orc.actor), 2600, "the last enemy: the screen plays first");
  assert.equal(w.api.finaleLength(hero.actor), 0, "a hero falling is not the finale");
  game.settings.set(ID, "flashDefaults", { start: "none", end: "none", finalEnemy: "none" });
  assert.equal(w.api.finaleLength(orc.actor), 0, "screen off: no wait");
});

// Last One Standing (and any other drop's screen) comes after the kill's finisher, never over it.
test("a drop's screen waits for the kill finisher playing on that creature", async () => {
  let finished;
  const playing = new Map([["goblin", new Promise((r) => { finished = r; })]]);
  const w = world({ defaults: { lastEnemy: "duel", enemyDown: "duel" }, host: { killFinishing: (actor) => playing.get(actor.id) ?? null } });
  const who = (id, hp) => ({ actor: { id, name: id, hasPlayerOwner: false, system: { attributes: { hp: { value: hp, max: 10 } } } }, token: { disposition: -1 }, defeated: false });
  const goblin = who("goblin", 0), ogre = who("ogre", 9);
  game.combats = [{ id: "f", started: true, combatants: [goblin, ogre], scene: { id: "s" } }];
  const before = { animaterHpBefore: { value: 4, max: 10, down: false, dead: false } };
  w.fire("updateActor", goblin.actor, {}, before, "gm");
  await wait(50);
  assert.deepEqual(w.played(), [], "not over the finisher");
  finished();
  await wait(10);
  assert.deepEqual(w.played(), ["duel"], "right after it");
  // No finisher on this kill: the screen plays at once.
  const orc = who("orc", 0);
  game.combats = [{ id: "g", started: true, combatants: [orc, ogre], scene: { id: "s" } }];
  w.fire("updateActor", orc.actor, {}, before, "gm");
  await wait(10);
  assert.deepEqual(w.played(), ["duel", "duel"]);
});

test("on load the active GM drops copies a 1.6.3 import made and keeps defaults pointing at the kept screen", async () => {
  const { api } = world({ defaults: { start: "boss-copy", initiated: ["roll", "roll-copy"] } });
  const settings = { ...game.settings };
  const [roll, , , boss] = api.screens();
  game.settings.set(ID, "flashScreens", { schema: 1, screens: [...api.screens(), { ...roll, id: "roll-copy" }, { ...boss, id: "boss-copy" }] });
  assert.equal(await api.tidy(), 2);
  assert.deepEqual(api.screens().map((s) => s.id).filter((id) => id.endsWith("-copy")), []);
  assert.equal(api.defaults().start, "boss");
  assert.deepEqual(api.defaults().initiated, ["roll"]);
  assert.equal(await api.tidy(), 0, "nothing left to tidy");
  game.settings = settings;
});
