import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { settingsModel, settingsWindowHTML, searchRows, parseSettingValue, SETTINGS_TABS, WINDOW_SETTING_KEYS } from "../../scripts/ui/settings-window.mjs";

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
