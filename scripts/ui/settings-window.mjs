// Animater settings: one window (Configure Settings > Animater settings) with a tab per topic. Each row is one
// feature: the GM's switch for everyone in the world beside each player's "on my screen" switch, with the feature's
// extra choices (lifetime, strength, a second switch) under it. Players see only what they can set themselves.
// Names and hints are read from the registered settings, so the registration stays the one place they are written.
// "Reset to defaults" (the footer, or one tab's) puts only these rows' settings back to their registered defaults.

import { canDistort } from "../engines/distortion/distortion-host.mjs";
import { canShake } from "../engines/camera/camera-shake.mjs";

const PF2E = (env) => env.systemId === "pf2e";
const TWOE = (env) => ["pf2e", "sf2e"].includes(env.systemId);
const MODULE = (id) => (env) => env.modules.has(id);
// Features this screen draws only at some animation qualities (the "quality" setting): `quality` on a row is
// [whether this screen's quality draws it, the note shown when it does not].
const FULL_ONLY = [(q) => canDistort(q, true), "Needs Full animation quality on this screen"];
const FULL_OR_LIGHT = [(q) => canShake(q, true), "Needs Full or Light animation quality on this screen"];

// Each row: `world` (the GM's setting), `local` (this screen's), `extras` (more settings under it), `when` (only
// where it applies: a system or an active module, as its registration listed it), `gmOnly` (a client setting only
// a GM has a use for), `menu` (a button opening another settings menu), `quality` (see FULL_ONLY), `extrasWhen` (an
// extra shown only while its test on the settings' values holds; saving the row's own setting redraws the window),
// `preview` (a Preview button that plays the feature on this screen as now set; the window's `preview(key)` option),
// `noReset` (left alone by Reset to defaults).
export const SETTINGS_TABS = Object.freeze([
  { id: "look", label: "Look & light", icon: "fa-solid fa-palette", rows: [
    { local: "quality" },
    { world: "conditionLooks", extras: ["conditionTransitions"] },
    { world: "subtleLasting" },
    { world: "auraStyle", extras: ["auraAccentUnder"], extrasWhen: { auraAccentUnder: (read) => read("auraStyle") === "tokenshade" } },
    { world: "tokenshadeLive", extras: ["tokenshadeLightWeather"] },
    { world: "weatherOnCreatures" },
    { world: "conditionValueLooks" },
    { world: "regionLooks", local: "regionLooksLocal" },
    { world: "natureLooks", local: "natureLooksLocal" },
    { world: "litBySurroundings", local: "litBySurroundingsLocal" },
    { world: "fireHaze", local: "fireHazeLocal" },
    { world: "fireSmoke", local: "fireSmokeLocal", extras: ["fireSmokeAmount"] },
    { world: "heldTorches", local: "heldTorchesLocal" },
    { world: "lightOrbs", local: "lightOrbsLocal" },
    { world: "hideLightIcons" },
    { world: "sustainThreads", local: "sustainThreadsLocal" },
    { local: "tokenshadeBlend" },
    { world: "aurasOutsideCombat" },
    { world: "catalogTokenFx" },
    { world: "catalogSceneFx" },
    { world: "effectLighting", local: "effectLightingLocal", extras: ["effectLightingDaylight", "effectLightAnimation"] },
    { world: "screenTint", local: "screenTintLocal", extras: ["screenTintStrength"] },
    { world: "weaponScale" },
    { world: "weaponRuneFlourishes", when: PF2E },
    { world: "woundedLooks", local: "woundedLooksLocal" },
    { world: "defeatedLook" },
    { world: "damageReactions" },
    { world: "dramaticDeaths" },
  ] },
  { id: "motion", label: "Motion", icon: "fa-solid fa-person-running", rows: [
    { world: "motionPriority" },
    { world: "afterimages", local: "afterimagesLocal" },
    { world: "idleLife", local: "idleLifeLocal", extras: ["idleLifeStrength", "breathVapor"] },
    { world: "idleBreathing", local: "idleBreathingLocal" },
    { world: "idleHover", local: "idleHoverLocal" },
    { world: "teleportTokens", extras: ["teleportDissolve"] },
    { world: "newCreatureArrival" },
    { world: "cameraShake", local: "cameraShakeLocal", extras: ["cameraShakeStrength", "footfallTremor"], quality: FULL_OR_LIGHT },
    { world: "killCam", local: "killCamLocal", extras: ["killCamSeconds"], preview: "killCam" },
    { world: "mapDistortion", local: "mapDistortionLocal", extras: ["shockwaveReach"], quality: FULL_ONLY },
  ] },
  { id: "floor", label: "Floor & world", icon: "fa-solid fa-mountain-sun", rows: [
    // Eighty-odd rows in one list is a scroll, not a choice. The `section` on each row heads the run it belongs to,
    // so the tab reads as eight short lists, none of them longer than a screen or two. It is written on every row,
    // not only the first of a run: a row left out here (a system, a module, a GM-only setting) must not take its
    // heading with it. The runs are what a GM is looking for when they come here — the ground underfoot, the light
    // and shadow on it, the weather over it, the water, what a cave has, what a room has, what lives around it, and
    // what breaks on it — not how the code is laid out.
    { section: "Ground & movement", menu: "immersionMenu" },
    { section: "Ground & movement", world: "immersionForPlayers" },
    { section: "Ground & movement", world: "groundMarks", local: "groundMarksLocal", extras: ["groundMarkMinutes"] },
    { section: "Ground & movement", world: "elementReactions", local: "elementReactionsLocal" },
    { section: "Ground & movement", world: "marksChangeFloor" },
    { section: "Ground & movement", world: "movementFeel", local: "movementFeelLocal", extras: ["movementFootprintSandSeconds", "movementFootprintMudSeconds", "movementFootprintSnowSeconds", "movementFootprintDirtSeconds", "movementFootprintGrassSeconds", "movementFootprintStoneSeconds", "movementFootprintWoodSeconds", "movementFootprintWaterSeconds", "movementFootprintIceSeconds", "swimWakeSeconds", "underwaterBubbleSeconds", "underwaterLooks", "underwaterOpacity", "swimOutOnLand", "burrowTrailSeconds", "burrowTrailDepth", "movementStealth", "burrowHoles", "burrowHolesStay", "burrowSink", "stepKickAmount", "trackedPrints", "bloodTrail", "bloodDrops", "floorBloodSeconds", "floorBloodForever", "floorBloodAmount", "bloodDripAmount", "woundBloodAmount", "bloodWashes", "bloodInWater", "bloodFootprints", "weatherOnGround", "walkedPathHighlight", "flightDust", "dripAfterSwimming"] },
    { section: "Ground & movement", local: "movementGmPerception", gmOnly: true },
    { section: "Ground & movement", world: "quietSneaking" },
    { section: "Ground & movement", world: "oldTracks", local: "oldTracksLocal" },
    { section: "Ground & movement", world: "regionSteps", local: "regionStepsLocal" },
    // Both of this button's switches in one place: the world's experimental tick, and each screen's "show it".
    // They used to sit a tab and a settings window apart — a GM turned one off, saw the other still on, and read the
    // two as unrelated (Discord, 2026-11-20). GM-only: the button itself is the GM's, so a player has nothing here.
    { section: "Ground & movement", world: "experimentalWaterRegions", extras: ["toolDetectWater"], gmOnly: true },
    { section: "Shadows & sunlight", world: "groundShadows", local: "groundShadowsLocal" },
    { section: "Shadows & sunlight", world: "shadowsOverTokens", local: "shadowsOverTokensLocal" },
    { section: "Shadows & sunlight", world: "shadowShapes", local: "shadowShapesLocal" },
    { section: "Shadows & sunlight", world: "lightShadows", local: "lightShadowsLocal" },
    { section: "Shadows & sunlight", world: "wallShadows", local: "wallShadowsLocal", extras: ["wallShadowHeight"] },
    { section: "Shadows & sunlight", world: "windowLight", local: "windowLightLocal" },
    { section: "Shadows & sunlight", world: "canopyLight", local: "canopyLightLocal" },
    { section: "Shadows & sunlight", world: "roofLight", local: "roofLightLocal" },
    { section: "Shadows & sunlight", world: "cloudShadows", local: "cloudShadowsLocal" },
    { section: "Shadows & sunlight", world: "surfaceGlints", local: "surfaceGlintsLocal" },
    { section: "Shadows & sunlight", world: "heatShimmer", local: "heatShimmerLocal" },
    { section: "Shadows & sunlight", world: "windowGlow", local: "windowGlowLocal" },
    { section: "Shadows & sunlight", world: "lightFlames", local: "lightFlamesLocal" },
    { section: "Shadows & sunlight", world: "windFlames", local: "windFlamesLocal" },
    { section: "Shadows & sunlight", menu: "sunMenu" },
    { section: "Shadows & sunlight", world: "sunColor", local: "sunColorLocal", extras: ["sunColorStrength", "timeOfDayColor", "darknessBySun", "moonLight"] },
    { section: "Weather & seasons", world: "lightningFlashes", local: "lightningFlashesLocal", extras: ["lightningFlashStrength"] },
    { section: "Weather & seasons", world: "fallingLeaves", local: "fallingLeavesLocal" },
    { section: "Weather & seasons", world: "morningMist", local: "morningMistLocal" },
    { section: "Weather & seasons", world: "wetGround", local: "wetGroundLocal", extras: ["wetMinutes", "dryHours"] },
    { section: "Weather & seasons", world: "snowCover", local: "snowCoverLocal", extras: ["thawHours"] },
    { section: "Weather & seasons", world: "tileSnow", local: "tileSnowLocal" },
    { section: "Weather & seasons", world: "frozenWater", local: "frozenWaterLocal", extras: ["iceHoursLeast", "iceHoursMost"] },
    { section: "Weather & seasons", world: "treeSway", local: "treeSwayLocal" },
    { section: "Weather & seasons", world: "seasonGround", local: "seasonGroundLocal" },
    { section: "Weather & seasons", world: "rainbows", local: "rainbowsLocal" },
    { section: "Weather & seasons", world: "weatherLight", local: "weatherLightLocal", extras: ["cloudDarkness", "stormSceneDarkness"] },
    { section: "Weather & seasons", world: "weatherOnMap", local: "weatherOnMapLocal", extras: ["weatherFallsDown", "weatherFade", "weatherBurstPlayers"] },
    { section: "Weather & seasons", world: "weatherClouds", local: "weatherCloudsLocal" },
    { section: "Weather & seasons", world: "weatherSounds", local: "weatherSoundsLocal", extras: ["weatherVolume", "thunderPanning"] },
    { section: "Weather & seasons", world: "rainRings", local: "rainRingsLocal" },
    { section: "Water & shore", world: "coast", local: "coastLocal" },
    { section: "Water & shore", world: "waterfalls", local: "waterfallsLocal", extras: ["waterfallVolume"] },
    { section: "Water & shore", world: "waterMirror", local: "waterMirrorLocal", extras: ["waterMirrorRings"] },
    { section: "Water & shore", world: "movingWater", local: "movingWaterLocal" },
    { section: "Water & shore", world: "shipRocking", local: "shipRockingLocal" },
    { section: "Water & shore", world: "riverSounds", local: "riverSoundsLocal", extras: ["riverVolume"] },
    { section: "Caves", world: "caveMist", local: "caveMistLocal" },
    { section: "Caves", world: "caveFungus", local: "caveFungusLocal" },
    { section: "Caves", world: "caveCrystals", local: "caveCrystalsLocal" },
    { section: "Caves", world: "caveLava", local: "caveLavaLocal" },
    { section: "Caves", world: "caveWebs", local: "caveWebsLocal" },
    { section: "Caves", world: "caveWet", local: "caveWetLocal" },
    { section: "Caves", world: "caveSteam", local: "caveSteamLocal" },
    { section: "Caves", world: "caveFoul", local: "caveFoulLocal" },
    { section: "Caves", world: "caveSoot", local: "caveSootLocal" },
    { section: "Caves", world: "caveEyes", local: "caveEyesLocal" },
    { section: "Caves", world: "caveMoths", local: "caveMothsLocal" },
    { section: "Caves", world: "cavePebbles", local: "cavePebblesLocal" },
    { section: "Caves", world: "caveRubble", local: "caveRubbleLocal" },
    { section: "Caves", world: "caveSkylight", local: "caveSkylightLocal" },
    { section: "Indoors & air", world: "lampEmbers", local: "lampEmbersLocal" },
    { section: "Indoors & air", world: "lampMotes", local: "lampMotesLocal" },
    { section: "Indoors & air", world: "ceilingDust", local: "ceilingDustLocal" },
    { section: "Indoors & air", world: "drips", local: "dripsLocal" },
    { section: "Indoors & air", world: "drafts", local: "draftsLocal" },
    { section: "Indoors & air", world: "torchDraft", local: "torchDraftLocal" },
    { section: "Indoors & air", world: "roomSmoke", local: "roomSmokeLocal" },
    { section: "Indoors & air", world: "fireSounds", local: "fireSoundsLocal", extras: ["fireVolume", "heldFireSounds"] },
    { section: "Life around the map", world: "vermin", local: "verminLocal" },
    { section: "Life around the map", world: "verminSounds", local: "verminSoundsLocal" },
    { section: "Life around the map", local: "wildlifeLocal" },
    { section: "Life around the map", world: "wildlifeSounds", local: "wildlifeSoundsLocal" },
    { section: "Life around the map", local: "firefliesLocal" },
    { section: "Life around the map", local: "dawnChorusLocal" },
    { section: "Life around the map", local: "carrionLocal" },
    { section: "Life around the map", world: "townLife", local: "townLifeLocal" },
    { section: "Life around the map", world: "tavernMurmur", local: "tavernMurmurLocal" },
    { section: "Impacts & breakage", world: "energyBlast", local: "energyBlastLocal", extras: ["blastReactions", "blastReactionSeconds", "blastPush", "blastBreaks"] },
    { section: "Impacts & breakage", world: "doorBurst", local: "doorBurstLocal" },
    { section: "Impacts & breakage", world: "projectileWalls" },
    { section: "Impacts & breakage", world: "dispelShatter", local: "dispelShatterLocal" },
    { section: "Impacts & breakage", world: "stuckShots", local: "stuckShotsLocal" },
  ] },
  { id: "sound", label: "Sound", icon: "fa-solid fa-volume-high", rows: [
    { world: "animaterSounds", local: "animaterSoundsLocal" },
    { world: "roomAcoustics", local: "roomReverbLocal" },
    { local: "muffleWalls" },
    { world: "footstepSounds", local: "footstepSoundsLocal" },
    { world: "footstepAcoustics" },
    { world: "footstepRange" },
    { world: "footstepsOutsideCombat" },
    { world: "creatureIdleSounds" },
    { world: "creatureVoices", local: "creatureVoicesLocal" },
    { world: "creatureVoiceFolder" },
    { menu: "hitSoundsMenu" },
  ] },
  { id: "drama", label: "Combat drama", icon: "fa-solid fa-bolt", rows: [
    { world: "momentum" },
    { world: "heroPointGlow", local: "heroPointGlowLocal", extras: ["mythicPointGlow"], when: TWOE },
    { world: "inspirationGlow", local: "heroPointGlowLocal", when: (env) => env.systemId === "dnd5e" },
    { world: "hopeGlow", local: "heroPointGlowLocal", when: (env) => env.systemId === "daggerheart" },
    { world: "victoryGlow", local: "heroPointGlowLocal", when: (env) => env.systemId === "draw-steel" },
    { world: "lensBlood", local: "lensBloodLocal", extras: ["lensBloodAmount", "lensTunnel", "lensHeartbeat", "lensWounded", "lensFriendHit"] },
    { world: "lensEffects", local: "lensEffectsLocal" },
    { world: "lensReach" },
    { world: "lensWho", local: "lensWhoLocal" },
    { world: "bloodOnPortraits" },
    { world: "lensDuration", local: "lensDurationLocal" },
    { menu: "bloodColorsMenu" },
    { local: "flashTrackerMenus", gmOnly: true },
    { world: "hidePrivateResults" },
    { local: "waitForDice", when: MODULE("dice-so-nice") },
    { world: "daggerheartDualityAccent", when: (env) => env.systemId === "daggerheart" },
  ] },
  { id: "automation", label: "Automation & catalogs", icon: "fa-solid fa-wand-magic-sparkles", rows: [
    // Off by default: a reset would quietly stop every saved recipe playing, so it never resets this one.
    { world: "automatic", noReset: true },
    // Off by default: a reset would take the other system's catalogs away from a world using them, so it is exempt too.
    { world: "crossoverCatalog", when: TWOE, noReset: true },
    { local: "originalNames", when: (env) => env.systemId === "dnd5e" },
    { world: "npcAbilities", when: PF2E },
    { world: "npcAbilityGuess", when: PF2E },
    { world: "npcStrikeGuess", when: PF2E },
    { local: "lastingMode" },
    { world: "areaLoopMode" },
  ] },
  { id: "interface", label: "Interface & performance", icon: "fa-solid fa-gauge-high", rows: [
    { local: "showControlButton" },
    { world: "mapMaking" },
    { local: "toolCaveIn" },
    { local: "toolEnergyBlast" },
    { local: "toolDecorate" },
    { local: "toolClearRubble" },
    { local: "toolRepairProps", gmOnly: true },
    { local: "toolMoments", gmOnly: true },
    { local: "toolClearBlood" },
    { local: "toolSplatBlood", gmOnly: true },
    { local: "toolBakeBlood", gmOnly: true },
    { local: "toolClearGroundMarks", gmOnly: true },
    { local: "toolClouds" },
    { local: "toolFlames" },
    { world: "carriers", extras: ["carrierVolume"] },
    { local: "toolCarry" },
    { local: "tuckDuringPlayback" },
    { local: "hoverExplain" },
    { world: "playerAccess" },
    { world: "windowIcons" },
    { local: "regionPanelOpens", gmOnly: true },
    { world: "sceneArrival", local: "sceneArrivalLocal" },
    { world: "handoutArrival", local: "handoutArrivalLocal" },
    { world: "interfaceBleed", local: "interfaceBleedLocal", extras: ["interfaceBleedStrength", "bleedChatReadable", "bleedEdge", "bleedGlass", "bleedDrain", "bleedBeat", "bleedTunnel", "bleedShudder"] },
    { local: "sequencerSpeedups", extras: ["sequencerSpeedupRefresh"] },
  ] },
  { id: "integrations", label: "Integrations", icon: "fa-solid fa-puzzle-piece", rows: [
    { world: "effectLightsReveal", when: MODULE("pf2e-visioner") },
    { world: "splatterSync", when: MODULE("splatter") },
    { world: "aaTakeover", when: MODULE("autoanimations") },
    { world: "aaFillGaps", when: MODULE("autoanimations") },
    { world: "taTakeover", when: MODULE("trigger-animations") },
    { world: "taFillGaps", when: MODULE("trigger-animations") },
  ] },
]);

// Every setting the window edits, so main.mjs can check none is left listed in Configure Settings.
export const WINDOW_SETTING_KEYS = Object.freeze([...new Set(SETTINGS_TABS.flatMap((t) => t.rows.flatMap((r) => [r.world, r.local, ...(r.extras ?? [])].filter(Boolean))))]);

const isWorld = (scope) => scope === "world";
// What kind of control a setting takes, from its registration.
function controlOf(config, value) {
  const { key, scope, name = "", hint = "", choices, range, type } = config;
  const base = { key, scope: isWorld(scope) ? "world" : "client", name: String(name), hint: String(hint), value, reload: config.requiresReload === true };
  if (choices && typeof choices === "object") return { ...base, kind: "select", choices: Object.entries(choices).map(([k, label]) => ({ value: k, label: String(label) })) };
  if (type === Boolean) return { ...base, kind: "boolean", value: value === true };
  if (type === Number && range) return { ...base, kind: "range", min: range.min, max: range.max, step: range.step ?? 1 };
  if (type === Number) return { ...base, kind: "number" };
  return { ...base, kind: "text", value: value ?? "" };
}

// The window's content for this user: tabs and their rows, only the ones that apply here.
// registry: game.settings.settings (a Map of `${id}.${key}` -> registration); get(key) -> the current value;
// menus: game.settings.menus; modules: the ids of the active modules.
export function settingsModel({ id = "animater", registry, get, menus = new Map(), isGM = false, systemId = "", modules = [] }) {
  const env = { isGM, systemId, modules: modules instanceof Set ? modules : new Set(modules) };
  const config = (key) => (key ? registry.get(`${id}.${key}`) ?? null : null);
  const read = (key) => { try { return get(key); } catch { return undefined; } };
  const control = (key) => { const c = config(key); return c ? controlOf({ ...c, key }, read(key)) : null; };
  const mine = (c) => c && (isGM || c.scope === "client");
  const quality = config("quality") ? read("quality") : undefined;
  const tabs = [];
  for (const tab of SETTINGS_TABS) {
    const rows = [];
    for (const row of tab.rows) {
      if (row.when && !row.when(env)) continue;
      if (row.gmOnly && !isGM) continue;
      if (row.menu) {
        const menu = menus.get(`${id}.${row.menu}`);
        if (!menu || (menu.restricted && !isGM)) continue;
        rows.push({ id: row.menu, menu: row.menu, section: row.section ?? null, name: String(menu.name ?? ""), hint: String(menu.hint ?? ""), label: String(menu.label ?? menu.name ?? ""), icon: menu.icon ?? "", world: null, local: null, extras: [], worldOff: false });
        continue;
      }
      const worldC = control(row.world), localC = control(row.local);
      const lead = worldC ?? localC;
      if (!lead) continue;
      const world = mine(worldC) ? worldC : null, local = mine(localC) ? localC : null;
      const extras = (row.extras ?? []).filter((key) => row.extrasWhen?.[key]?.(read) ?? true).map(control).filter(mine);
      if (!world && !local && !extras.length) continue;
      rows.push({
        id: row.world ?? row.local, section: row.section ?? null, name: lead.name, hint: lead.hint, world, local, extras, preview: row.preview ?? null,
        // A player whose GM turned the feature off for everyone: their own switch changes nothing for now.
        worldOff: !isGM && !!local && (worldC?.value === false || (worldC?.kind === "select" && worldC.value === "off")),
        // This screen's animation quality never draws it, whatever the switches say.
        qualityNote: row.quality && typeof quality === "string" && !row.quality[0](quality) ? row.quality[1] : null,
      });
    }
    if (rows.length) tabs.push({ id: tab.id, label: tab.label, icon: tab.icon, rows });
  }
  return { isGM, tabs };
}

// The text a row is found by: its own name and hint, and each of its switches' and extras'.
export const rowSearchText = (row) => [row.name, row.hint, row.world?.name, row.local?.name, ...row.extras.flatMap((e) => [e.name, e.hint])]
  .filter(Boolean).join(" ").toLowerCase();
// The rows a search shows, across every tab: each word of the query in the row's text. An empty query shows all.
export function searchRows(model, query = "") {
  const words = String(query).toLowerCase().split(/\s+/).filter(Boolean);
  return model.tabs.flatMap((tab) => tab.rows.filter((row) => { const text = rowSearchText(row); return words.every((w) => text.includes(w)); }).map((row) => ({ tab: tab.id, row: row.id })));
}

// A changed control's value, as the setting stores it: unchecked boxes are off, numbers stay in range, a choice
// must be one offered. Undefined: nothing to save.
export function parseSettingValue(control, raw) {
  if (!control) return undefined;
  if (control.kind === "boolean") return raw === true || raw === "on" || raw === "true";
  if (control.kind === "select") return control.choices.some((c) => c.value === String(raw)) ? String(raw) : undefined;
  if (control.kind === "range" || control.kind === "number") {
    const n = Number(raw);
    if (raw === "" || raw === null || !Number.isFinite(n)) return undefined;
    return control.kind === "range" ? Math.min(control.max, Math.max(control.min, n)) : n;
  }
  return String(raw ?? "");
}

// Reset to defaults: the settings a reset may change, only ever ones the window's rows list (never a menu's, a
// catalog's, the saved recipes or a `noReset` row's). `tab`: one tab's id, else every tab; `world`/`client`: which
// scopes to reset. A player never resets a world setting, and rows that do not apply here (`when`, `gmOnly`) are
// left as they are.
export function resettableSettings(tabs = SETTINGS_TABS, { id = "animater", registry, tab = null, world = false, client = false, isGM = false, systemId = "", modules = [] } = {}) {
  const env = { isGM, systemId, modules: modules instanceof Set ? modules : new Set(modules) };
  const keys = new Set();
  for (const t of tabs) {
    if (tab && t.id !== tab) continue;
    for (const row of t.rows) {
      if (row.menu || row.noReset || (row.when && !row.when(env)) || (row.gmOnly && !isGM)) continue;
      for (const key of [row.world, row.local, ...(row.extras ?? [])]) {
        const scope = key ? registry.get(`${id}.${key}`)?.scope : null;
        if (scope === "world" ? world && isGM : scope === "client" && client) keys.add(key);
      }
    }
  }
  return [...keys];
}
// What a reset changes: each setting's current value beside its registered default, leaving out any already there.
export function resetChanges(keys, { id = "animater", registry, get }) {
  const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);
  return keys.flatMap((key) => {
    const config = registry.get(`${id}.${key}`);
    if (!config || config.default === undefined) return [];
    let value;
    try { value = get(key); } catch { return []; }
    return same(value, config.default) ? [] : [{ key, name: String(config.name || key), scope: config.scope, value, default: config.default, reload: config.requiresReload === true }];
  });
}
// The backup a reset downloads first: the values it is about to change, by scope, as a file named for the moment.
export function settingsBackup(changes, { id = "animater", date = new Date() } = {}) {
  const by = (scope) => Object.fromEntries(changes.filter((c) => c.scope === scope).map((c) => [c.key, c.value]));
  return { module: id, saved: date.toISOString(), world: by("world"), client: by("client") };
}
export const backupFileName = (id = "animater", date = new Date()) => `${id}-settings-backup-${date.toISOString().replace(/[:.]/g, "-")}.json`;

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function input(c, label) {
  const attrs = `data-setting="${esc(c.key)}" aria-label="${esc(label)}"`;
  if (c.kind === "boolean") return `<input type="checkbox" ${attrs}${c.value ? " checked" : ""}>`;
  if (c.kind === "select") return `<select ${attrs}>${c.choices.map((o) => `<option value="${esc(o.value)}"${o.value === String(c.value) ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  if (c.kind === "range") return `<range-picker ${attrs} value="${esc(c.value)}" min="${esc(c.min)}" max="${esc(c.max)}" step="${esc(c.step)}"></range-picker>`;
  if (c.kind === "number") return `<input type="number" ${attrs} value="${esc(c.value)}">`;
  return `<input type="text" ${attrs} value="${esc(c.value)}">`;
}
const cell = (c, caption, cls) => `<label class="an-set-switch ${cls}" title="${esc(c.hint)}"><span>${esc(caption)}</span>${input(c, `${c.name}: ${caption}`)}</label>`;
function rowHTML(row, tab) {
  const head = `<div class="an-set-text"><strong>${esc(row.name)}</strong>${row.worldOff ? ` <em class="an-set-off">Off in this world</em>` : ""}${row.qualityNote ? ` <em class="an-set-off">${esc(row.qualityNote)}</em>` : ""}<p>${esc(row.hint)}</p></div>`;
  if (row.menu) return `<div class="an-set-row" data-row="${esc(row.id)}" data-tab="${esc(tab)}">${head}<div class="an-set-controls"><button type="button" data-menu="${esc(row.menu)}">${row.icon ? `<i class="${esc(row.icon)}"></i> ` : ""}${esc(row.label)}</button></div></div>`;
  // A feature with a world switch and its own screen's: "Everyone" and "My screen"; a lone setting needs no caption.
  const both = row.world && row.local;
  const controls = [row.world && cell(row.world, both || row.world.kind === "boolean" ? "Everyone" : "", "an-set-world"),
    row.local && cell(row.local, both || row.local.kind === "boolean" ? "My screen" : "", "an-set-local")].filter(Boolean).join("");
  const preview = row.preview ? `<div class="an-set-extra"><span>See it on this screen, at the length set</span><button type="button" data-preview="${esc(row.preview)}"><i class="fa-solid fa-play"></i> Preview</button></div>` : "";
  const extras = row.extras.map((e) => `<div class="an-set-extra" title="${esc(e.hint)}"><span>${esc(e.name)}${e.scope === "client" ? " <small>(this screen)</small>" : ""}</span>${input(e, e.name)}</div>`).join("") + preview;
  return `<div class="an-set-row" data-row="${esc(row.id)}" data-tab="${esc(tab)}">${head}<div class="an-set-controls">${controls}</div>${extras ? `<div class="an-set-extras">${extras}</div>` : ""}</div>`;
}
// The tabs a search shows (pure): every tab with a match, or only `tab` once one has been picked.
export function searchedTabs(hits = [], tab = null) {
  const tabs = new Set(hits.map((h) => h.tab));
  return tab ? new Set(tabs.has(tab) ? [tab] : []) : tabs;
}
// The whole window: search, tab buttons, then each tab's rows (only the active tab shows until a search).
export function settingsWindowHTML(model, { active } = {}) {
  const current = model.tabs.some((t) => t.id === active) ? active : model.tabs[0]?.id;
  const nav = model.tabs.map((t) => `<button type="button" class="an-set-tab${t.id === current ? " active" : ""}" data-tab-button="${esc(t.id)}"><i class="${esc(t.icon)}"></i> ${esc(t.label)}</button>`).join("");
  const resetTab = (t) => `<button type="button" class="an-set-reset-tab" data-reset-tab="${esc(t.id)}" title="Put this tab's settings back to their defaults"><i class="fa-solid fa-rotate-left"></i> Reset this tab</button>`;
  // A heading before each run of rows that share a section, so a long tab reads as several short lists. The heading
  // is drawn from the rows that are actually here, so one left out for this system or user takes no heading with it.
  const inner = (t) => t.rows.map((r, i) => `${r.section && r.section !== t.rows[i - 1]?.section ? `<h4 class="an-set-section" data-section="${esc(r.section)}" data-section-tab="${esc(t.id)}">${esc(r.section)}</h4>` : ""}${rowHTML(r, t.id)}`).join("");
  const panels = model.tabs.map((t) => `<section class="an-set-panel${t.id === current ? " active" : ""}" data-panel="${esc(t.id)}"><header class="an-set-panel-head"><h3>${esc(t.label)}</h3>${resetTab(t)}</header>${inner(t)}</section>`).join("");
  const note = model.isGM ? "Everyone: the whole world (GM only). My screen: what you see on this device." : "These settings change only what you see and hear on this device.";
  return `<div class="an-root an-settings">
<header class="an-set-top"><input type="search" class="an-set-search" placeholder="Search Animater settings" aria-label="Search Animater settings"><p class="an-set-note">${esc(note)}</p></header>
<div class="an-set-body"><nav class="an-set-nav">${nav}</nav><div class="an-set-panels">${panels}<p class="an-set-empty" hidden>No setting matches.</p></div></div>
<footer class="form-footer an-set-foot"><button type="button" data-reset-all><i class="fa-solid fa-rotate-left"></i> Reset to defaults&hellip;</button></footer>
</div>`;
}
// The reset's question: which settings go back to their defaults. Only a GM is offered the world's.
export function resetDialogHTML({ isGM = false, tabLabel = "" } = {}) {
  const what = tabLabel ? `the ${esc(tabLabel)} tab's settings` : "Animater's settings";
  const box = (name, label) => `<label class="checkbox"><input type="checkbox" name="${name}" checked> ${esc(label)}</label>`;
  const burst = isGM ? `<p class="hint">Each world setting that changes is applied on every connected screen as it goes, so mid-session everyone may see a short burst of redraws.</p>` : "";
  return `<p>Put ${what} back to their defaults? A backup of the values that change downloads first.</p>${burst}${isGM ? box("world", "World settings (everyone)") : ""}${box("client", "This screen's settings")}`;
}

// The settings window, built on Foundry's ApplicationV2. Changes save as they are made (no Save button);
// settings.set runs each setting's own onChange, and a setting that needs a reload asks for one.
export function settingsWindow(ApplicationV2, {
  id, settings = () => globalThis.game.settings, isGM = () => globalThis.game.user?.isGM === true,
  systemId = () => globalThis.game.system?.id ?? "", modules = () => [...(globalThis.game.modules ?? [])].filter((m) => m.active).map((m) => m.id),
  preview = () => false,
  reloadConfirm = (options) => globalThis.foundry?.applications?.settings?.SettingsConfig?.reloadConfirm?.(options),
  // The reset's question: { world, client } as ticked, or nothing when cancelled.
  askReset = (content) => globalThis.foundry?.applications?.api?.DialogV2?.confirm({
    window: { title: "Reset Animater settings" }, content, rejectClose: false, no: { default: true },
    yes: { label: "Reset", icon: "fa-solid fa-rotate-left", callback: (_event, button) => ({ world: !!button.form?.elements.world?.checked, client: !!button.form?.elements.client?.checked }) },
  }),
  saveFile = (text, name) => globalThis.foundry?.utils?.saveDataToFile?.(text, "application/json", name),
} = {}) {
  return class AnimaterSettings extends ApplicationV2 {
    static DEFAULT_OPTIONS = {
      id: `${id}-settings`, classes: ["animater", "animater-settings"],
      window: { title: "Animater settings", icon: "fa-solid fa-sliders", resizable: true }, position: { width: 820, height: 680 },
    };
    activeTab = null;
    query = "";
    model() {
      const s = settings();
      return settingsModel({ id, registry: s.settings, get: (key) => s.get(id, key), menus: s.menus, isGM: isGM(), systemId: systemId(), modules: modules() });
    }
    async _renderHTML() { this._model = this.model(); return settingsWindowHTML(this._model, { active: this.activeTab }); }
    _replaceHTML(html, content) { content.innerHTML = html; }
    _onRender(context, options) {
      super._onRender?.(context, options);
      const root = this.element;
      const search = root.querySelector(".an-set-search");
      if (search) { search.value = this.query; search.addEventListener("input", () => { this.query = search.value; this.searchTab = null; this.filter(); }); }
      root.querySelectorAll("[data-tab-button]").forEach((b) => b.addEventListener("click", () => this.show(b.dataset.tabButton)));
      root.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => {
        const menu = settings().menus.get(`${id}.${b.dataset.menu}`);
        if (menu?.type) new menu.type().render({ force: true });
      }));
      root.querySelectorAll("[data-preview]").forEach((b) => b.addEventListener("click", () => {
        if (!preview(b.dataset.preview)) globalThis.ui?.notifications?.info("Animater: open a scene to preview this.");
      }));
      root.querySelector("[data-reset-all]")?.addEventListener("click", () => void this.reset());
      root.querySelectorAll("[data-reset-tab]").forEach((b) => b.addEventListener("click", () => void this.reset(b.dataset.resetTab)));
      // The window's element outlives each render: one listener for every control, added once.
      if (!this._wired) { this._wired = true; root.addEventListener("change", (event) => void this.save(event.target?.closest?.("[data-setting]"))); }
      if (this.query) this.filter();
    }
    show(tab) {
      this.activeTab = tab;
      // In a search, a tab narrows it to that tab's matches and keeps the words; typing again looks everywhere.
      this.searchTab = this.query?.trim() ? tab : null;
      for (const b of this.element.querySelectorAll("[data-tab-button]")) b.classList.toggle("active", b.dataset.tabButton === tab);
      for (const p of this.element.querySelectorAll("[data-panel]")) p.classList.toggle("active", p.dataset.panel === tab);
      this.filter();
    }
    // A search shows the matching rows of every tab; clearing it goes back to the open tab.
    filter() {
      const root = this.element, model = this._model ?? this.model();
      const found = searchRows(model, this.query), hits = new Set(found.map((h) => `${h.tab}:${h.row}`)), shown = searchedTabs(found, this.searchTab);
      root.classList.toggle("an-set-searching", !!this.query.trim());
      root.classList.toggle("an-set-search-tab", !!this.searchTab);
      for (const row of root.querySelectorAll("[data-row]")) row.hidden = !hits.has(`${row.dataset.tab}:${row.dataset.row}`);
      // A section heading goes with its rows: a search that matches none of them leaves no heading behind.
      for (const head of root.querySelectorAll("[data-section]")) {
        let next = head.nextElementSibling, any = false;
        while (next && !next.hasAttribute?.("data-section")) { if (next.hasAttribute?.("data-row") && !next.hidden) { any = true; break; } next = next.nextElementSibling; }
        head.hidden = !any;
      }
      for (const panel of root.querySelectorAll("[data-panel]")) panel.classList.toggle("an-set-has-hits", shown.has(panel.dataset.panel));
      const empty = root.querySelector(".an-set-empty");
      if (empty) empty.hidden = shown.size > 0;
    }
    async save(el) {
      const key = el?.dataset?.setting;
      if (!key) return;
      const control = (this._model ?? this.model()).tabs.flatMap((t) => t.rows.flatMap((r) => [r.world, r.local, ...r.extras])).find((c) => c?.key === key);
      // Players never write a world setting (the row does not show it to them, and Foundry would refuse).
      if (!control || (control.scope === "world" && !isGM())) return;
      const raw = control.kind === "boolean" ? el.checked : el.value;      const value = parseSettingValue(control, raw);
      if (value === undefined || value === settings().get(id, key)) return;
      try {
        await settings().set(id, key, value);
        control.value = value;
        // The quality decides which features this screen draws: their notes are redrawn. The aura style shows or
        // hides its extra.
        if (key === "quality" || key === "auraStyle") this.render?.();
        if (control.reload) await reloadConfirm({ world: control.scope === "world" });
      } catch (error) {
        globalThis.ui?.notifications?.error(`Animater: could not save ${control.name}: ${error.message}`);
      }
    }
    // Reset to defaults, for every tab or one: asks first, downloads a backup of what changes, then resets it.
    async reset(tab = null) {
      const gm = isGM(), notes = globalThis.ui?.notifications;
      const choice = await askReset(resetDialogHTML({ isGM: gm, tabLabel: tab ? SETTINGS_TABS.find((t) => t.id === tab)?.label : "" }));
      if (!choice || (!choice.world && !choice.client)) return;
      const s = settings();
      const keys = resettableSettings(SETTINGS_TABS, { id, registry: s.settings, tab, world: choice.world, client: choice.client, isGM: gm, systemId: systemId(), modules: modules() });
      const changes = resetChanges(keys, { id, registry: s.settings, get: (key) => s.get(id, key) });
      if (!changes.length) { notes?.info("Animater: those settings are already at their defaults."); return; }
      const date = new Date();
      await saveFile(JSON.stringify(settingsBackup(changes, { id, date }), null, 2), backupFileName(id, date));
      const done = [];
      for (const change of changes) {
        try { await s.set(id, change.key, structuredClone(change.default)); done.push(change); }
        catch (error) { notes?.error(`Animater: could not reset ${change.name}: ${error.message}`); }
      }
      this.render?.();
      notes?.info(`Animater: ${done.length} setting${done.length === 1 ? "" : "s"} reset to default.`);
      // Only a setting that did reset asks for the reload it needs.
      const reload = done.filter((c) => c.reload);
      if (reload.length) await reloadConfirm({ world: reload.some((c) => c.scope === "world") });
    }
  };
}
