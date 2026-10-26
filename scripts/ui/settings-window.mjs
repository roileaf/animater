// Animater settings: one window (Configure Settings > Animater settings) with a tab per topic. Each row is one
// feature: the GM's switch for everyone in the world beside each player's "on my screen" switch, with the feature's
// extra choices (lifetime, strength, a second switch) under it. Players see only what they can set themselves.
// Names and hints are read from the registered settings, so the registration stays the one place they are written.

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
// a GM has a use for), `menu` (a button opening another settings menu), `quality` (see FULL_ONLY).
export const SETTINGS_TABS = Object.freeze([
  { id: "look", label: "Look & light", icon: "fa-solid fa-palette", rows: [
    { local: "quality" },
    { world: "conditionLooks" },
    { world: "catalogTokenFx" },
    { world: "catalogSceneFx" },
    { world: "effectLighting", local: "effectLightingLocal", extras: ["effectLightingDaylight", "effectLightAnimation"] },
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
    { world: "teleportTokens" },
    { world: "cameraShake", local: "cameraShakeLocal", extras: ["cameraShakeStrength", "footfallTremor"], quality: FULL_OR_LIGHT },
    { world: "killCam", local: "killCamLocal" },
    { world: "mapDistortion", local: "mapDistortionLocal", extras: ["shockwaveReach"], quality: FULL_ONLY },
  ] },
  { id: "floor", label: "Floor & world", icon: "fa-solid fa-mountain-sun", rows: [
    { world: "groundMarks", local: "groundMarksLocal", extras: ["groundMarkMinutes"] },
    { world: "elementReactions", local: "elementReactionsLocal" },
    { world: "movementFeel", local: "movementFeelLocal", extras: ["movementFootprintSandSeconds", "movementFootprintMudSeconds", "movementFootprintSnowSeconds", "movementFootprintDirtSeconds", "movementFootprintGrassSeconds", "movementFootprintStoneSeconds", "movementFootprintWoodSeconds", "movementFootprintWaterSeconds", "movementFootprintIceSeconds", "swimWakeSeconds", "underwaterBubbleSeconds", "underwaterLooks", "underwaterOpacity", "burrowTrailSeconds", "burrowTrailDepth", "movementStealth", "burrowHoles", "burrowSink", "trackedPrints", "bloodTrail", "weatherOnGround", "walkedPathHighlight"] },
    { local: "movementGmPerception", gmOnly: true },
    { world: "quietSneaking" },
    { world: "projectileWalls" },
    { world: "dispelShatter", local: "dispelShatterLocal" },
  ] },
  { id: "sound", label: "Sound", icon: "fa-solid fa-volume-high", rows: [
    { world: "roomAcoustics", local: "roomReverbLocal" },
    { local: "muffleWalls" },
    { world: "footstepSounds", local: "footstepSoundsLocal" },
    { world: "footstepAcoustics" },
    { world: "footstepRange" },
    { world: "creatureIdleSounds" },
    { menu: "hitSoundsMenu" },
  ] },
  { id: "drama", label: "Combat drama", icon: "fa-solid fa-bolt", rows: [
    { world: "momentum" },
    { world: "lensBlood", local: "lensBloodLocal", extras: ["lensBloodAmount", "lensTunnel", "lensHeartbeat", "lensWounded"] },
    { world: "lensEffects", local: "lensEffectsLocal" },
    { world: "lensWho", local: "lensWhoLocal" },
    { world: "lensDuration", local: "lensDurationLocal" },
    { menu: "bloodColorsMenu" },
    { local: "flashTrackerMenus", gmOnly: true },
    { world: "hidePrivateResults" },
    { local: "waitForDice", when: MODULE("dice-so-nice") },
    { world: "daggerheartDualityAccent", when: (env) => env.systemId === "daggerheart" },
  ] },
  { id: "automation", label: "Automation & catalogs", icon: "fa-solid fa-wand-magic-sparkles", rows: [
    { world: "automatic" },
    { world: "crossoverCatalog", when: TWOE },
    { world: "npcAbilities", when: PF2E },
    { world: "npcAbilityGuess", when: PF2E },
    { world: "npcStrikeGuess", when: PF2E },
    { local: "lastingMode" },
  ] },
  { id: "interface", label: "Interface & performance", icon: "fa-solid fa-gauge-high", rows: [
    { local: "showControlButton" },
    { local: "tuckDuringPlayback" },
    { local: "hoverExplain" },
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
        rows.push({ id: row.menu, menu: row.menu, name: String(menu.name ?? ""), hint: String(menu.hint ?? ""), label: String(menu.label ?? menu.name ?? ""), icon: menu.icon ?? "", world: null, local: null, extras: [], worldOff: false });
        continue;
      }
      const worldC = control(row.world), localC = control(row.local);
      const lead = worldC ?? localC;
      if (!lead) continue;
      const world = mine(worldC) ? worldC : null, local = mine(localC) ? localC : null;
      const extras = (row.extras ?? []).map(control).filter(mine);
      if (!world && !local && !extras.length) continue;
      rows.push({
        id: row.world ?? row.local, name: lead.name, hint: lead.hint, world, local, extras,
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
  const extras = row.extras.map((e) => `<div class="an-set-extra" title="${esc(e.hint)}"><span>${esc(e.name)}${e.scope === "client" ? " <small>(this screen)</small>" : ""}</span>${input(e, e.name)}</div>`).join("");
  return `<div class="an-set-row" data-row="${esc(row.id)}" data-tab="${esc(tab)}">${head}<div class="an-set-controls">${controls}</div>${extras ? `<div class="an-set-extras">${extras}</div>` : ""}</div>`;
}
// The whole window: search, tab buttons, then each tab's rows (only the active tab shows until a search).
export function settingsWindowHTML(model, { active } = {}) {
  const current = model.tabs.some((t) => t.id === active) ? active : model.tabs[0]?.id;
  const nav = model.tabs.map((t) => `<button type="button" class="an-set-tab${t.id === current ? " active" : ""}" data-tab-button="${esc(t.id)}"><i class="${esc(t.icon)}"></i> ${esc(t.label)}</button>`).join("");
  const panels = model.tabs.map((t) => `<section class="an-set-panel${t.id === current ? " active" : ""}" data-panel="${esc(t.id)}"><h3>${esc(t.label)}</h3>${t.rows.map((r) => rowHTML(r, t.id)).join("")}</section>`).join("");
  const note = model.isGM ? "Everyone: the whole world (GM only). My screen: what you see on this device." : "These settings change only what you see and hear on this device.";
  return `<div class="an-root an-settings">
<header class="an-set-top"><input type="search" class="an-set-search" placeholder="Search Animater settings" aria-label="Search Animater settings"><p class="an-set-note">${esc(note)}</p></header>
<div class="an-set-body"><nav class="an-set-nav">${nav}</nav><div class="an-set-panels">${panels}<p class="an-set-empty" hidden>No setting matches.</p></div></div>
</div>`;
}

// The settings window, built on Foundry's ApplicationV2. Changes save as they are made (no Save button);
// settings.set runs each setting's own onChange, and a setting that needs a reload asks for one.
export function settingsWindow(ApplicationV2, {
  id, settings = () => globalThis.game.settings, isGM = () => globalThis.game.user?.isGM === true,
  systemId = () => globalThis.game.system?.id ?? "", modules = () => [...(globalThis.game.modules ?? [])].filter((m) => m.active).map((m) => m.id),
  reloadConfirm = (options) => globalThis.foundry?.applications?.settings?.SettingsConfig?.reloadConfirm?.(options),
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
      if (search) { search.value = this.query; search.addEventListener("input", () => { this.query = search.value; this.filter(); }); }
      root.querySelectorAll("[data-tab-button]").forEach((b) => b.addEventListener("click", () => this.show(b.dataset.tabButton)));
      root.querySelectorAll("[data-menu]").forEach((b) => b.addEventListener("click", () => {
        const menu = settings().menus.get(`${id}.${b.dataset.menu}`);
        if (menu?.type) new menu.type().render({ force: true });
      }));
      // The window's element outlives each render: one listener for every control, added once.
      if (!this._wired) { this._wired = true; root.addEventListener("change", (event) => void this.save(event.target?.closest?.("[data-setting]"))); }
      if (this.query) this.filter();
    }
    show(tab) {
      this.activeTab = tab;
      if (this.query) { this.query = ""; const s = this.element.querySelector(".an-set-search"); if (s) s.value = ""; }
      for (const b of this.element.querySelectorAll("[data-tab-button]")) b.classList.toggle("active", b.dataset.tabButton === tab);
      for (const p of this.element.querySelectorAll("[data-panel]")) p.classList.toggle("active", p.dataset.panel === tab);
      this.filter();
    }
    // A search shows the matching rows of every tab; clearing it goes back to the open tab.
    filter() {
      const root = this.element, model = this._model ?? this.model();
      const hits = new Set(searchRows(model, this.query).map((h) => `${h.tab}:${h.row}`));
      root.classList.toggle("an-set-searching", !!this.query.trim());
      for (const row of root.querySelectorAll("[data-row]")) row.hidden = !hits.has(`${row.dataset.tab}:${row.dataset.row}`);
      for (const panel of root.querySelectorAll("[data-panel]")) panel.classList.toggle("an-set-has-hits", !!panel.querySelector("[data-row]:not([hidden])"));
      const empty = root.querySelector(".an-set-empty");
      if (empty) empty.hidden = hits.size > 0;
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
        // The quality decides which features this screen draws: their notes are redrawn.
        if (key === "quality") this.render?.();
        if (control.reload) await reloadConfirm({ world: control.scope === "world" });
      } catch (error) {
        globalThis.ui?.notifications?.error(`Animater: could not save ${control.name}: ${error.message}`);
      }
    }
  };
}
