import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settingsModel, settingsWindowHTML, searchRows, searchedTabs, parseSettingValue, SETTINGS_TABS, WINDOW_SETTING_KEYS, resettableSettings, resetChanges, settingsBackup, backupFileName, resetDialogHTML } from "../../scripts/ui/settings-window.mjs";

const reg = (key, scope, type, extra = {}) => [`animater.${key}`, { key, namespace: "animater", scope, type, name: extra.name ?? key, hint: extra.hint ?? `${key} hint`, ...extra }];
const registry = new Map([
  reg("quality", "client", String, { name: "Animation quality (this device)", choices: { full: "Full", low: "Low" } }),
  reg("groundMarks", "world", Boolean, { name: "Ground marks" }),
  reg("groundMarksLocal", "client", Boolean, { name: "Ground marks on my screen" }),
  reg("groundMarkMinutes", "world", Number, { name: "Ground mark lifetime (minutes)", range: { min: 0, max: 60, step: 1 } }),
  reg("cameraShake", "world", Boolean, { name: "Camera shake" }),
  reg("cameraShakeLocal", "client", Boolean, { name: "Camera shake on my screen" }),
  reg("cameraShakeStrength", "client", Number, { name: "Camera shake strength", range: { min: 0.25, max: 2, step: 0.25 } }),
  reg("projectileWalls", "world", Boolean, { name: "Projectiles stop at walls" }),
  reg("weaponRuneFlourishes", "world", Boolean, { name: "Weapon rune flourishes" }),
  reg("splatterSync", "world", Boolean, { name: "Splatter: blood follows the damage" }),
  reg("waitForDice", "client", Boolean, { name: "Wait for Dice So Nice" }),
  reg("flashTrackerMenus", "client", Boolean, { name: "Show flash screen menus in the Combat Tracker" }),
]);
const values = { quality: "full", groundMarks: false, groundMarksLocal: true, groundMarkMinutes: 5, cameraShake: true, cameraShakeLocal: true, cameraShakeStrength: 1,
  projectileWalls: true, weaponRuneFlourishes: true, splatterSync: true, waitForDice: true, flashTrackerMenus: true };
const menus = new Map([["animater.hitSoundsMenu", { name: "Hit sounds", label: "Hit sounds", hint: "Hits hint", icon: "fa-solid fa-volume-high", restricted: false }]]);
const model = (options = {}) => settingsModel({ registry, get: (k) => values[k], menus, systemId: "pf2e", modules: [], ...options });
const rowsOf = (m) => Object.fromEntries(m.tabs.flatMap((t) => t.rows.map((r) => [r.id, { ...r, tab: t.id }])));

test("the GM sees each feature's world switch beside its on-my-screen switch, with its extras under it", () => {
  const rows = rowsOf(model({ isGM: true }));
  assert.equal(rows.groundMarks.name, "Ground marks");
  assert.equal(rows.groundMarks.world.key, "groundMarks");
  assert.equal(rows.groundMarks.local.key, "groundMarksLocal");
  assert.deepEqual(rows.groundMarks.extras.map((e) => e.key), ["groundMarkMinutes"]);
  assert.equal(rows.groundMarks.extras[0].kind, "range");
  assert.equal(rows.cameraShake.tab, "motion");
  assert.ok(rows.projectileWalls.world && !rows.projectileWalls.local);
  assert.ok(rows.flashTrackerMenus, "a GM's own tracker menus");
  assert.equal(rows.groundMarks.worldOff, false, "the GM sees the switch itself");
});

test("players see only their own switches: no world switch, world extras or world-only rows", () => {
  const rows = rowsOf(model({ isGM: false }));
  assert.equal(rows.groundMarks.world, null);
  assert.equal(rows.groundMarks.local.key, "groundMarksLocal");
  assert.deepEqual(rows.groundMarks.extras, [], "the lifetime is the GM's");
  assert.equal(rows.groundMarks.worldOff, true, "the GM turned ground marks off for everyone");
  assert.deepEqual(rows.cameraShake.extras.map((e) => e.key), ["cameraShakeStrength"]);
  assert.equal(rows.projectileWalls, undefined);
  assert.equal(rows.weaponRuneFlourishes, undefined);
  assert.equal(rows.flashTrackerMenus, undefined, "only a GM has tracker menus");
  assert.ok(rows.quality, "the animation quality is listed here too");
  assert.ok(rows.hitSoundsMenu, "the Hit sounds menu opens from the Sound tab");
});

test("rows only where their system or module applies; tabs without rows are left out", () => {
  const pf2e = rowsOf(model({ isGM: true })), dnd = rowsOf(model({ isGM: true, systemId: "dnd5e" }));
  assert.ok(pf2e.weaponRuneFlourishes && !dnd.weaponRuneFlourishes);
  assert.equal(pf2e.splatterSync, undefined);
  assert.equal(pf2e.waitForDice, undefined);
  const withModules = rowsOf(model({ isGM: true, modules: ["splatter", "dice-so-nice"] }));
  assert.equal(withModules.splatterSync.tab, "integrations");
  assert.ok(withModules.waitForDice);
  assert.ok(!model({ isGM: true }).tabs.some((t) => t.id === "integrations"));
  // A setting this world never registered is never shown.
  assert.equal(rowsOf(model({ isGM: true })).momentum, undefined);
});

test("the search finds rows in every tab by name, hint and extras", () => {
  const m = model({ isGM: true });
  assert.deepEqual(searchRows(m, "shake").map((h) => h.row), ["cameraShake"]);
  assert.deepEqual(searchRows(m, "LIFETIME").map((h) => h.row), ["groundMarks"]);
  assert.deepEqual(searchRows(m, "ground hint").map((h) => h.row), ["groundMarks"]);
  assert.equal(searchRows(m, "").length, m.tabs.reduce((n, t) => n + t.rows.length, 0));
});
test('legacy Combat recap registrations no longer appear in either settings view',()=>{
 const records=new Map([...registry,reg('combatRecap','world',String),reg('combatRecapLocal','client',Boolean)]);
 for(const isGM of [true,false]){
  const m=settingsModel({registry:records,get:()=>true,isGM});assert.equal(searchRows(m,'recap').length,0);
  assert.doesNotMatch(settingsWindowHTML(m),/combatRecap/);
 }
});

test("the window's controls carry their setting key; the active tab shows first", () => {
  const html = settingsWindowHTML(model({ isGM: true }), { active: "motion" });
  assert.match(html, /data-setting="groundMarks"/);
  assert.match(html, /data-setting="groundMarksLocal" aria-label="[^"]*" checked/);
  assert.match(html, /<range-picker data-setting="groundMarkMinutes"[^>]*value="5"/);
  assert.match(html, /<option value="full" selected>/);
  assert.match(html, /class="an-set-tab active" data-tab-button="motion"/);
  assert.match(html, /data-menu="hitSoundsMenu"/);
  assert.match(html, /Everyone/);
  const player = settingsWindowHTML(model({ isGM: false }));
  assert.doesNotMatch(player, /data-setting="groundMarks"[ >]/);
  assert.match(player, /Off in this world/);
});

test("values are saved as each setting stores them", () => {
  const range = { kind: "range", min: 0, max: 60 }, select = { kind: "select", choices: [{ value: "a" }, { value: "b" }] };
  assert.equal(parseSettingValue({ kind: "boolean" }, false), false);
  assert.equal(parseSettingValue({ kind: "boolean" }, true), true);
  assert.equal(parseSettingValue(range, "90"), 60);
  assert.equal(parseSettingValue(range, "12"), 12);
  assert.equal(parseSettingValue(range, ""), undefined);
  assert.equal(parseSettingValue(select, "b"), "b");
  assert.equal(parseSettingValue(select, "z"), undefined);
});
test('all nine ground footprint lifetimes are editable world-only controls under Movement effects',()=>{
 const keys=['Sand','Mud','Snow','Dirt','Grass','Stone','Wood','Water','Ice'].map(f=>`movementFootprint${f}Seconds`);
 const records=new Map([reg('movementFeel','world',Boolean),reg('movementFeelLocal','client',Boolean),...keys.map(key=>reg(key,'world',Number,{range:{min:0,max:3600,step:1}}))]);
 const gm=settingsModel({registry:records,get:()=>0,isGM:true}),row=gm.tabs.find(t=>t.id==='floor').rows.find(r=>r.id==='movementFeel');
 assert.deepEqual(row.extras.map(c=>c.key),keys);
 const html=settingsWindowHTML(gm);for(const key of keys)assert.ok(html.includes(`data-setting="${key}"`),key);
 const player=settingsModel({registry:records,get:()=>0,isGM:false});assert.ok(player.tabs.flatMap(t=>t.rows).every(r=>r.extras.length===0));
});
test('swimming and burrow path controls accept independent lifetimes and a negative relative cutoff',()=>{
 const records=new Map([reg('movementFeel','world',Boolean),...['swimWakeSeconds','underwaterBubbleSeconds','burrowTrailSeconds'].map(key=>reg(key,'world',Number,{range:{min:0,max:3600,step:.1}})),reg('burrowTrailDepth','world',Number,{range:{min:-1000,max:0,step:1}})]);
 const m=settingsModel({registry:records,get:k=>k==='burrowTrailDepth'?-10:0,isGM:true}),extras=m.tabs[0].rows[0].extras;
 assert.equal(extras.length,4);const depth=extras.find(e=>e.key==='burrowTrailDepth');assert.equal(depth.value,-10);
 assert.equal(parseSettingValue(depth,'-20'),-20);assert.equal(parseSettingValue(depth,'0'),0);assert.equal(parseSettingValue(depth,'5'),0);
});
test('river and waterfall volume are each player\'s own sliders, under their features',()=>{
 const volume=(key)=>reg(key,'client',Number,{range:{min:0,max:2,step:.05}});
 const records=new Map([reg('riverSounds','world',Boolean),reg('riverSoundsLocal','client',Boolean),volume('riverVolume'),reg('waterfalls','world',Boolean),reg('waterfallsLocal','client',Boolean),volume('waterfallVolume')]);
 const rows=settingsModel({registry:records,get:()=>1,isGM:false}).tabs.flatMap(t=>t.rows),extra=(id)=>rows.find(r=>r.id===id).extras[0];
 assert.equal(extra('riverSounds').key,'riverVolume');assert.equal(extra('riverSounds').kind,'range');
 assert.equal(extra('waterfalls').key,'waterfallVolume');assert.equal(extra('waterfalls').kind,'range');
});

test("the aura's on-token checkbox shows only under the Tokenshade aura style", () => {
  const records = new Map([
    reg("auraStyle", "world", String, { name: "Aura style", choices: { jb2a: "JB2A", tokenshade: "Tokenshade" } }),
    reg("auraAccentUnder", "world", Boolean, { name: "On-token effect under the token" }),
  ]);
  const row = (auraStyle, isGM = true) => rowsOf(settingsModel({ registry: records, get: (k) => (k === "auraStyle" ? auraStyle : false), isGM })).auraStyle;
  assert.deepEqual(row("jb2a").extras, []);
  const extra = row("tokenshade").extras[0];
  assert.equal(extra.key, "auraAccentUnder");
  assert.equal(extra.kind, "boolean");
  assert.equal(extra.value, false);
  assert.match(settingsWindowHTML(settingsModel({ registry: records, get: (k) => (k === "auraStyle" ? "tokenshade" : false), isGM: true })), /type="checkbox" data-setting="auraAccentUnder"/);
  assert.ok(WINDOW_SETTING_KEYS.includes("auraAccentUnder"), "Configure Settings leaves it to this window");
  assert.equal(row("tokenshade", false), undefined, "a player sees neither");
});

test("every setting the window lists is registered by Animater, and Configure Settings keeps only the quality", () => {
  const sources = ["scripts/main.mjs", "scripts/engines/flash/flash-combat.mjs",
    "scripts/engines/playback/defeated-look.mjs", "scripts/integrations/sequencer-turbo/index.mjs", "scripts/systems/twoe-crossover.mjs",
    "scripts/catalogs/pf2e/weapons/weapon-runes.mjs", "scripts/integrations/automated-animations.mjs", "scripts/integrations/trigger-animations.mjs",
    "scripts/integrations/sequencer-motions.mjs", "scripts/integrations/splatter.mjs"]
    .map((f) => readFileSync(new URL(`../../${f}`, import.meta.url), "utf8")).join("\n");
  for (const key of WINDOW_SETTING_KEYS) assert.ok(sources.includes(`"${key}"`) || sources.includes(`'${key}'`), `${key} is registered`);
  const main = readFileSync(new URL("../../scripts/main.mjs", import.meta.url), "utf8");
  assert.match(main, /for \(const key of WINDOW_SETTING_KEYS\)[\s\S]{0,200}key === "quality"/);
  assert.match(main, /registerMenu\(ID,'settingsWindow'/);
  // Each row's lead setting is one key, in one tab.
  const leads = SETTINGS_TABS.flatMap((t) => t.rows.map((r) => r.world ?? r.local ?? r.menu));
  assert.equal(new Set(leads).size, leads.length);
});

// Reported on D&D 5e: map distortion and camera shake seemed to do nothing. A screen whose animation quality never
// draws a feature says so on its row, whatever its switches say.
test("a feature this screen's quality never draws says which quality it needs", () => {
  const extra = new Map([...registry,
    reg("mapDistortion", "world", Boolean, { name: "Map distortion" }),
    reg("mapDistortionLocal", "client", Boolean, { name: "Map distortion on my screen" })]);
  const at = (quality) => rowsOf(settingsModel({ registry: extra, get: (k) => (k === "quality" ? quality : values[k] ?? true), menus, systemId: "dnd5e", isGM: true }));
  assert.equal(at("full").mapDistortion.qualityNote, null);
  assert.equal(at("full").cameraShake.qualityNote, null);
  assert.match(at("light").mapDistortion.qualityNote, /Full animation quality/);
  assert.equal(at("light").cameraShake.qualityNote, null, "Light still shakes");
  assert.match(at("balanced").cameraShake.qualityNote, /Full or Light/);
  assert.match(at("low").mapDistortion.qualityNote, /Full/);
  assert.equal(at("low").groundMarks.qualityNote, null, "rows without a quality need show nothing");
  const html = settingsWindowHTML(settingsModel({ registry: extra, get: (k) => (k === "quality" ? "balanced" : values[k] ?? true), menus, isGM: true }), { active: "motion" });
  assert.match(html, /Needs Full or Light animation quality on this screen/);
  assert.match(html, /Needs Full animation quality on this screen/);
});

test("the Blood colours menu sits beside lens blood in Combat drama, for the GM only", () => {
  const withBlood = new Map([...menus, ["animater.bloodColorsMenu", { name: "Blood colours", label: "Blood colours", hint: "Blood hint", icon: "fa-solid fa-droplet", restricted: true }]]);
  const gm = model({ isGM: true, menus: withBlood });
  const drama = gm.tabs.find((t) => t.id === "drama");
  assert.ok(drama, "the Combat drama tab");
  assert.equal(drama.rows.find((r) => r.id === "bloodColorsMenu")?.menu, "bloodColorsMenu");
  assert.equal(rowsOf(model({ isGM: false, menus: withBlood })).bloodColorsMenu, undefined, "restricted to the GM");
});

test("a search shows every tab with a match, or only the tab picked", () => {
  const hits = [{ tab: "look", row: "a" }, { tab: "sound", row: "b" }, { tab: "sound", row: "c" }];
  assert.deepEqual([...searchedTabs(hits)], ["look", "sound"]);
  assert.deepEqual([...searchedTabs(hits, "sound")], ["sound"]);
  assert.deepEqual([...searchedTabs(hits, "motion")], [], "nothing there: the empty note shows, and the words stay");
  assert.deepEqual([...searchedTabs([])], []);
});

// Reset to defaults: only the window's own rows, by scope and tab, as this user may set them.
const resetTabs = Object.freeze([
  { id: "a", label: "A", rows: [
    { world: "groundMarks", local: "groundMarksLocal", extras: ["groundMarkMinutes"] },
    { world: "cameraShake", local: "cameraShakeLocal", extras: ["cameraShakeStrength"] },
    { menu: "hitSoundsMenu" },
    { local: "flashTrackerMenus", gmOnly: true },
  ] },
  { id: "b", label: "B", rows: [
    { local: "quality" },
    { world: "weaponRuneFlourishes", when: (env) => env.systemId === "pf2e" },
    { local: "waitForDice", when: (env) => env.modules.has("dice-so-nice") },
  ] },
]);
const resetRegistry = new Map([...registry,
  reg("hitSoundsMenu", "world", Boolean), reg("spellCatalog", "world", Object), reg("recipes", "world", Array)]);
const resettable = (options) => resettableSettings(resetTabs, { registry: resetRegistry, systemId: "pf2e", ...options });

test("a reset touches world settings only for a GM who asks, and this screen's only when asked", () => {
  assert.deepEqual(resettable({ isGM: true, world: true }), ["groundMarks", "groundMarkMinutes", "cameraShake", "weaponRuneFlourishes"]);
  assert.deepEqual(resettable({ isGM: true, client: true }), ["groundMarksLocal", "cameraShakeLocal", "cameraShakeStrength", "flashTrackerMenus", "quality"]);
  assert.deepEqual(resettable({ isGM: false, world: true, client: true }), ["groundMarksLocal", "cameraShakeLocal", "cameraShakeStrength", "quality"], "a player never resets the world's, nor a GM-only row");
  assert.deepEqual(resettable({ isGM: false, world: true }), []);
  assert.deepEqual(resettable({ isGM: true }), [], "nothing ticked, nothing reset");
});

test("a reset keeps to its tab and to rows that apply here, never a menu or a setting the window does not list", () => {
  assert.deepEqual(resettable({ isGM: true, world: true, client: true, tab: "b" }), ["quality", "weaponRuneFlourishes"]);
  assert.deepEqual(resettable({ isGM: true, world: true, client: true, tab: "b", systemId: "dnd5e", modules: ["dice-so-nice"] }), ["quality", "waitForDice"]);
  const all = resettable({ isGM: true, world: true, client: true });
  for (const key of ["hitSoundsMenu", "spellCatalog", "recipes", "projectileWalls", "splatterSync"]) assert.ok(!all.includes(key), key);
  assert.ok(all.includes("groundMarkMinutes") && all.includes("cameraShakeStrength"), "extras are reset with their row");
  // The real tabs: no catalog, recipe or menu setting is ever in reach.
  const real = resettableSettings(SETTINGS_TABS, { registry: new Map(WINDOW_SETTING_KEYS.map((k) => reg(k, "world", Boolean))), isGM: true, world: true, systemId: "pf2e" });
  assert.ok(real.length > 0 && real.every((k) => WINDOW_SETTING_KEYS.includes(k)));
  for (const key of ["spellCatalog", "featCatalog", "effectCatalog", "recipes", "hitSoundsMenu", "bloodColorsMenu"]) assert.ok(!real.includes(key), key);
});

test("a reset changes only what differs from its default, and backs up those values first", () => {
  const withDefaults = new Map([...registry].map(([k, c]) => [k, { ...c, default: c.type === Boolean ? true : c.type === Number ? 1 : "full" }]));
  const changes = resetChanges(["groundMarks", "groundMarksLocal", "groundMarkMinutes", "cameraShakeStrength", "quality"], { registry: withDefaults, get: (k) => values[k] });
  assert.deepEqual(changes.map((c) => [c.key, c.value, c.default]), [["groundMarks", false, true], ["groundMarkMinutes", 5, 1]]);
  const date = new Date("2026-11-01T10:20:30.400Z");
  assert.deepEqual(settingsBackup(changes, { date }), { module: "animater", saved: "2026-11-01T10:20:30.400Z", world: { groundMarks: false, groundMarkMinutes: 5 }, client: {} });
  assert.equal(backupFileName("animater", date), "animater-settings-backup-2026-11-01T10-20-30-400Z.json");
});

test("the window offers a reset for everything and for each tab; only a GM is asked about the world's", () => {
  const html = settingsWindowHTML(model({ isGM: true }));
  assert.match(html, /<footer[^>]*><button type="button" data-reset-all>.*Reset to defaults/);
  assert.match(html, /data-reset-tab="motion"/);
  const gm = resetDialogHTML({ isGM: true, tabLabel: "Motion" }), player = resetDialogHTML({ isGM: false });
  assert.match(gm, /the Motion tab's settings/);
  assert.match(gm, /name="world" checked> World settings \(everyone\)/);
  assert.match(gm, /name="client" checked> This screen&#39;s settings/);
  assert.match(gm, /burst of redraws/, "a GM is warned that a world reset redraws every screen");
  assert.doesNotMatch(player, /name="world"|burst of redraws/);
  assert.match(player, /name="client" checked/);
});

test("a reset never turns off the switch that plays the GM's own recipes", () => {
  const records = new Map(WINDOW_SETTING_KEYS.map((k) => reg(k, "world", Boolean)));
  for (const tab of [null, "automation"]) {
    const keys = resettableSettings(SETTINGS_TABS, { registry: records, tab, isGM: true, world: true, client: true, systemId: "pf2e" });
    assert.ok(keys.length > 0, `${tab ?? "every tab"} still resets something`);
    assert.ok(!keys.includes("automatic"), tab ?? "every tab");
  }
});
