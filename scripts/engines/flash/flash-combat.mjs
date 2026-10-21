// Flash screens at the table: world settings, the full-screen overlay on every
// client, and the combat hooks. The active GM decides which screen plays (the
// combat's own pick from the Combat Tracker, else the world default) and sends it
// to everyone, so all clients show the same screen once. Any client may notice a
// moment (a crit it rolled, a creature it dropped) and ask the active GM to play it.
import { STARTER_FLASHES, MOMENT_EVENTS, flashesOn, validateFlashes, validateFlash, chooseFlash, FLASH_EVENTS, manualPrompts } from "./flash-model.mjs";
import { createFlash } from "./flash-render.mjs";
import { pickFlash } from "./flash-picker.mjs";
import { hpState, isKillTransition } from "../../systems/hp-state.mjs";

export const FLASH_SETTING = "flashScreens", FLASH_DEFAULTS = "flashDefaults", FLASH_TRACKER = "flashTrackerMenus";
const FRIENDLY = 1, HOSTILE = -1;
const sideOf = (actor, token) => (actor?.hasPlayerOwner || token?.disposition === FRIENDLY ? "party" : token?.disposition === HOSTILE ? "enemies" : "other");
const levelOf = (actor) => Number(actor?.level ?? actor?.system?.details?.level?.value ?? actor?.system?.details?.cr ?? 0) || 0;
// Standing: the system's HP track is readable and not down (PF2e/SF2e/D&D above 0 HP; Daggerheart
// short of its last hit point, a companion of its last stress).
const systemOf = () => globalThis.game?.system?.id;
const standingUp = (actor, systemId = systemOf()) => hpState(actor, systemId)?.down === false;
// The encounter's visible combatants, as the portraits layer shows them: player-owned or
// friendly tokens are the party, hostile ones the enemies. Hidden combatants never appear.
export function encounterPeople(combat) {
  return Array.from(combat?.combatants ?? []).flatMap((c) => {
    const token = c.token, actor = c.actor;
    if (c.hidden || token?.hidden) return [];
    return [{ name: c.name ?? token?.name ?? actor?.name ?? "", img: token?.texture?.src ?? "", portrait: actor?.img ?? "", side: sideOf(actor, token), level: levelOf(actor) }];
  });
}
// A creature dropping to 0 HP in combat: which moment it is (or none).
export function downMoment(combat, actor, systemId = systemOf()) {
  const combatant = Array.from(combat?.combatants ?? []).find((c) => c.actor?.id === actor?.id);
  if (!combatant || !combat?.started) return null;
  const side = sideOf(actor, combatant.token);
  if (side === "party") return "partyDown";
  if (side !== "enemies") return null;
  const standing = Array.from(combat.combatants).filter((c) => sideOf(c.actor, c.token) === "enemies" && !c.defeated && standingUp(c.actor, systemId));
  // The last one dropping is its own moment (Finish Him!); the combat's ending plays later, when it is closed.
  return standing.length === 1 ? "lastEnemy" : standing.length ? "enemyDown" : "finalEnemy";
}
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// The Combat Tracker's own header. Popped out, the tracker is a whole window whose title bar is
// also a <header> and comes first, so a plain "header" lookup put the menus over its buttons.
export function trackerHeader(root) {
  return root?.querySelector(".combat-tracker-header") ?? root?.querySelector("header:not(.window-header)") ?? null;
}
// The party's name: PF2e's Party actor, D&D 5e's primary party, else a party folder's actor, else "The Party".
export function partyName() {
  const pf2e = globalThis.game?.actors?.party, dnd = (() => { try { return game.settings.get("dnd5e", "primaryParty")?.actor; } catch { return null; } })();
  const group = game?.actors?.find?.((a) => ["party", "group"].includes(a.type));
  return (pf2e ?? dnd ?? group)?.name ?? "The Party";
}
export function registerFlashSettings(ID) {
  game.settings.register(ID, FLASH_SETTING, { scope: "world", config: false, type: Object, default: { schema: 1, screens: STARTER_FLASHES },
    onChange: () => ui.combat?.render() });
  game.settings.register(ID, FLASH_DEFAULTS, { scope: "world", config: false, type: Object, default: { start: "none", end: "none" },
    onChange: () => ui.combat?.render() });
  // Each GM may hide the menus from their tracker; combats still play the world's default screens.
  game.settings.register(ID, FLASH_TRACKER, { name: "Show flash screen menus in the Combat Tracker",
    hint: "The ⚡ Opening and Ending menus in the Encounter tab, its popout and PF2e HUD's tracker. Hidden, combats still play the default flash screens.",
    scope: "client", config: true, type: Boolean, default: true, onChange: () => { ui.combat?.render(); for (const app of foundry.applications.instances?.values?.() ?? []) if (app.id === "pf2e-hud-tracker") app.render(); } });
}

// host: { ID, clientId, quietHere(), resolveMedia(src), trace(status, detail) }
export function flashScreens(host) {
  const { ID } = host;
  const screens = () => validateFlashes(game.settings.get(ID, FLASH_SETTING)?.screens);
  const defaults = () => ({ start: "none", end: "none", ...Object.fromEntries(MOMENT_EVENTS.map((e) => [e, "none"])), ...game.settings.get(ID, FLASH_DEFAULTS) });
  const vars = (combat = game.combat, extra = {}) => ({ scene: canvas.scene?.name ?? "", round: String(combat?.round ?? ""), party: partyName(), combatants: encounterPeople(combat), ...extra });
  // The GM types each {manual} name as the screen plays, once for everyone; this combat remembers the answers.
  async function askManual(screen, combat) {
    const labels = manualPrompts(screen);
    if (!labels.length) return null;
    const remembered = { ...(combat?.getFlag?.(ID, "flashManual") ?? lastManual) };
    if (!game.user.isGM) return remembered;
    const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
    const content = labels.map((label, i) => `<div class="form-group"><label>${esc(label || "Name")}</label><div class="form-fields"><input name="m${i}" value="${esc(remembered[label] ?? "")}" autocomplete="off"${i ? "" : " autofocus"}></div></div>`).join("");
    const answer = await foundry.applications.api.DialogV2.prompt({ window: { title: `Flash screen: ${screen.name ?? "names"}` }, content,
      ok: { label: "Play", callback: (_event, button) => Object.fromEntries(labels.map((label, i) => [label, button.form.elements[`m${i}`].value.trim()])) },
      rejectClose: false }).catch(() => null);
    const names = { ...remembered, ...(answer ?? {}) };
    lastManual = names;
    if (answer && combat?.setFlag) await combat.setFlag(ID, "flashManual", names).catch(() => {});
    return names;
  }
  let showing = null, lastManual = {};
  const trackerMenus = () => game.settings.get(ID, FLASH_TRACKER) !== false;
  // ms > 0: a sound layer trimmed in the editor stops there, with a short fade.
  const playSound = (src, volume, ms = 0) => {
    if (!src || host.quietHere()) return;
    const playing = foundry.audio.AudioHelper.play({ src, volume, loop: false }, false);
    if (ms > 0) void Promise.resolve(playing).then((sound) => setTimeout(() => sound?.stop?.({ fade: 150 }), ms)).catch(() => {});
  };
  function sound(screen) { playSound(screen.sound.file, screen.sound.volume); }
  // Playing music dips while a screen shows, then comes back.
  function duck() {
    const restore = [];
    for (const playlist of game.playlists?.playing ?? []) for (const ps of playlist.sounds ?? []) {
      const snd = ps.playing ? ps.sound : null, volume = snd?.volume;
      if (!snd?.fade || !(volume > 0)) continue;
      void snd.fade(volume * 0.3, { duration: 250 });
      restore.push(() => void snd.fade(volume, { duration: 700 }));
    }
    return () => restore.forEach((r) => r());
  }
  // The scene behind the card: frozen (Foundry's canvas stops drawing) and tinted, until the card is gone.
  const LOOKS = { grey: "grayscale(1) brightness(0.8) contrast(1.1)", dark: "brightness(0.45)", sepia: "sepia(0.9) brightness(0.75)" };
  function freeze(look) {
    if (!LOOKS[look]) return () => {};
    const board = document.getElementById("board"), ticker = canvas?.app?.ticker, was = board?.style.filter ?? "";
    const running = ticker?.started;
    if (board) { board.style.transition = "filter 0.25s"; board.style.filter = LOOKS[look]; }
    if (running) ticker.stop();
    return () => { if (board) board.style.filter = was; if (running) ticker.start(); };
  }
  // Draw it full screen on this client.
  async function show(screen, v = vars()) {
    if (host.quietHere()) return;
    showing?.stop();
    const layer = document.createElement("div");
    layer.className = "an-flash-overlay";
    document.body.append(layer);
    const valid = validateFlash(screen);
    const run = createFlash(layer, valid, { resolveMedia: host.resolveMedia, vars: v, playSound });
    showing = run;
    const unduck = valid.duck ? duck() : () => {}, thaw = freeze(valid.backdrop.freeze);
    sound(valid);
    try { await run.play(); } finally { run.stop(); layer.remove(); unduck(); thaw(); if (showing === run) showing = null; }
  }
  // A screen that asks for names waits for the GM's answer; any other plays at once.
  function play(screen, options = {}) {
    if (!screen) return;
    if (!manualPrompts(screen).length) return send(screen, options);
    return askManual(screen, options.combat ?? game.combat).then((manual) => send(screen, options, manual))
      .catch((error) => host.trace("Blocked", `Flash screen: ${error.message}`));
  }
  function send(screen, { everyone = false, combat, extra } = {}, manual = null) {
    const v = { ...vars(combat, extra), ...(manual ? { manual } : {}) };
    if (everyone) game.socket.emit(`module.${ID}`, { type: "flash", sender: host.clientId, screen, vars: v });
    void show(screen, v).catch((error) => host.trace("Blocked", `Flash screen: ${error.message}`));
  }
  const activeGM = () => game.user.isGM && (game.users.activeGM ? game.users.activeGM.isSelf : true);
  const flagKey = (event) => (event === "start" ? "flashStart" : "flashEnd");
  // The screens a combat may open with: its own Combat Tracker pick, else the world default, which
  // may be several switched-on screens (the GM picks one at Begin Combat).
  function openingChoices(combat) {
    const all = screens(), pick = combat?.getFlag?.(ID, "flashStart"), d = defaults().start;
    if (pick === "none") return [];
    if (pick && (pick === "random" || all.some((s) => s.id === pick))) return [chooseFlash(all, "start", pick)].filter(Boolean);
    if (!Array.isArray(d)) return [chooseFlash(all, "start", undefined, d)].filter(Boolean);
    return flashesOn(d).map((id) => all.find((s) => s.id === id && (s.event === "start" || s.event === "any"))).filter(Boolean);
  }
  function forCombat(combat, event) {
    if (event === "start") return openingChoices(combat)[0] ?? null;
    const pick = ["start", "end"].includes(event) ? combat?.getFlag?.(ID, flagKey(event)) : undefined;
    return chooseFlash(screens(), event, pick, defaults()[event]);
  }
  // A moment during combat: the active GM plays it; anyone else asks the active GM to.
  // Moments never interrupt a screen that is already showing.
  // The combat a moment belongs to: the one given, else a started combat on this scene (an
  // unstarted encounter may be the "current" one), else the current one.
  const runningCombat = (actor) => game.combats?.find((c) => c.started && (actor ? Array.from(c.combatants).some((cb) => cb.actor?.id === actor.id) : c.scene?.id === canvas.scene?.id)) ?? game.combat;
  // The last enemy falls once per combat (dropping to 0 HP, then being marked defeated, is one fall).
  const finales = new Set();
  function moment(event, extra = {}, combat = runningCombat()) {
    if (!combat?.started) return;
    if (event === "finalEnemy" && activeGM()) { if (finales.has(combat.id)) return; finales.add(combat.id); }
    if (!activeGM()) return void game.socket.emit(`module.${ID}`, { type: "flash-moment", sender: host.clientId, event, extra, combatId: combat.id });
    if (showing) return;
    play(forCombat(combat, event), { everyone: true, combat, extra });
  }
  // How long a kill finisher waits for the last enemy's screen (Finish Him!): its length when this drop is the
  // last enemy falling and that screen is on, else 0. The screen itself plays from this drop (the updateActor hook).
  function finaleLength(actor) {
    const combat = runningCombat(actor);
    if (!combat?.started || downMoment(combat, actor) !== "finalEnemy") return 0;
    const screen = forCombat(combat, "finalEnemy");
    return screen ? validateFlash(screen).duration : 0;
  }
  function receive(data) {
    if (data?.type === "flash" && data.screen) void show(data.screen, data.vars ?? {}).catch(() => {});
    if (data?.type === "flash-moment" && MOMENT_EVENTS.includes(data.event) && data.event !== "initiated" && activeGM()) moment(data.event, { name: String(data.extra?.name ?? "").slice(0, 80) }, game.combats?.get(data.combatId) ?? runningCombat());
  }
  // The opening plays when the GM begins combat. Once per combat.
  const opened = (combat) => combat?.getFlag?.(ID, "flashOpened");
  async function open(combat) {
    if (!activeGM() || opened(combat)) return;
    const options = openingChoices(combat);
    if (!options.length) return;
    void combat.setFlag?.(ID, "flashOpened", true);
    const screen = options.length > 1 ? await choose(options, combat, "start") : options[0];
    if (screen) play(screen, { everyone: true, combat });
  }
  Hooks.on("combatStart", (combat) => void open(combat).catch((error) => host.trace("Blocked", `Flash screen: ${error.message}`)));
  // Combat initiated: the encounter has its first visible combatants and waits for Begin Combat
  // ("Roll for Initiative!"). Once per combat.
  const initiated = (combat) => combat?.getFlag?.(ID, "flashInitiated");
  // With several switched on, the GM watches them play and picks one (or None); closing the window plays nothing.
  const pickOne = host.pickFlash ?? ((options, combat, event) => pickFlash(options, { event, resolveMedia: host.resolveMedia, vars: vars(combat) }));
  const choose = async (options, combat, event) => {
    const id = await Promise.resolve(pickOne(options, combat, event)).catch(() => null);
    return options.find((s) => s.id === id) ?? null;
  };
  async function initiate(combat) {
    if (!activeGM() || initiated(combat)) return;
    const all = screens(), options = flashesOn(defaults().initiated).map((id) => all.find((s) => s.id === id && s.event === "initiated")).filter(Boolean);
    if (!options.length) return;
    void combat.setFlag?.(ID, "flashInitiated", true);
    let screen = options[0];
    if (options.length > 1) {
      screen = await choose(options, combat, "initiated");
      // Begun while the GM was choosing: the opening plays instead.
      if (!screen || combat.started) return;
    }
    play(screen, { everyone: true, combat });
  }
  // Adding everyone arrives as a burst of combatants: wait for it to settle, then play once.
  const adding = new Map();
  Hooks.on("createCombatant", (combatant) => {
    const combat = combatant.combat ?? combatant.parent;
    if (!activeGM() || !combat || combat.started || !flashesOn(defaults().initiated).length || initiated(combat)) return;
    clearTimeout(adding.get(combat.id));
    adding.set(combat.id, setTimeout(() => {
      adding.delete(combat.id);
      if (!combat.started && encounterPeople(combat).length) void initiate(combat).catch((error) => host.trace("Blocked", `Flash screen: ${error.message}`));
    }, 300));
  });
  Hooks.on("deleteCombat", (combat) => { if (activeGM() && combat.started) play(forCombat(combat, "end"), { everyone: true, combat }); });
  // A new round (round 1 is the opening).
  Hooks.on("updateCombat", (combat, changes) => { if (activeGM() && "round" in changes && combat.round > 1 && combat.started) moment("round", {}, combat); });
  // A creature dropping to 0 HP (marking its last hit point in Daggerheart): told by the client that
  // changed its HP. main.mjs's preUpdateActor leaves the hp-state before the change in options.
  Hooks.on("updateActor", (actor, changes, options, userId) => {
    if (userId !== game.user.id || !isKillTransition(options.animaterHpBefore, hpState(actor, game.system.id))) return;
    const combat = runningCombat(actor), event = downMoment(combat, actor);
    if (event) moment(event, { name: actor.name }, combat);
  });
  // A creature marked defeated (dead) without dropping to 0 HP first: told by the client that marked it.
  Hooks.on("updateCombatant", (combatant, changes, options, userId) => {
    if (userId !== game.user.id || changes.defeated !== true || !standingUp(combatant.actor)) return;
    const event = downMoment(combatant.combat, combatant.actor);
    if (event) moment(event, { name: combatant.name ?? combatant.actor?.name ?? "" }, combatant.combat);
  });
  // A critical hit: told by the client that rolled it.
  if (["pf2e", "sf2e"].includes(game.system.id)) Hooks.on("createChatMessage", (message) => {
    const context = message.flags?.[game.system.id]?.context;
    if ((message.author?.id ?? message.user?.id) === game.user.id && /attack-roll/.test(context?.type ?? "") && context?.outcome === "criticalSuccess")
      moment("crit", { name: message.speaker?.alias ?? message.actor?.name ?? "" });
  });
  if (game.system.id === "dnd5e") Hooks.on("dnd5e.rollAttackV2", (rolls, data) => {
    if (rolls?.[0]?.isCritical) moment("crit", { name: data?.subject?.actor?.name ?? data?.subject?.item?.actor?.name ?? "" });
  });

  // The GM picks a combat's opening and ending screens in two small menus, plus a preview.
  let showDefaults = false;
  function picker(combat) {
    const all = screens(), d = defaults();
    const fitting = (event) => all.filter((s) => s.event === event || s.event === "any");
    const menu = (event) => {
      const fits = all.filter((s) => s.event === event || s.event === "any");
      const on = flashesOn(d[event]);
      const fallback = d[event] === "random" ? "Random" : on.length > 1 ? `GM picks of ${on.length}` : all.find((s) => s.id === on[0])?.name ?? "None";
      const value = combat.getFlag(ID, flagKey(event)) ?? "";
      const opts = [["", `Default (${fallback})`], ["random", "Random"], ["none", "None"], ...fits.map((s) => [s.id, s.name])];
      return `<label title="${event === "start" ? "Flash screen when this combat starts" : "Flash screen when this combat ends"}">${event === "start" ? "Opening" : "Ending"}<select data-animater-flash="${event}">${opts.map(([k, v]) => `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
    };
    const bar = document.createElement("div");
    bar.className = "animater-flash-pick";
    // The world defaults (used when a combat picks nothing), behind the ⚙.
    // Several switched-on openings show as one entry; picking another replaces them.
    const defaultMenu = (event) => {
      const on = flashesOn(d[event]), value = on.length > 1 ? "several" : d[event] === "random" ? "random" : on[0] ?? "none";
      const opts = [...(on.length > 1 ? [["several", `Several on: GM picks (${on.length})`]] : []), ["none", "None"], ["random", "Random"], ...fitting(event).map((s) => [s.id, s.name])];
      return `<label>${event === "start" ? "Default opening" : "Default ending"}<select data-animater-flash-default="${event}">${opts.map(([k, v]) => `<option value="${esc(k)}" ${k === value ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
    };
    bar.innerHTML = `<span aria-hidden="true">⚡</span>${menu("start")}${menu("end")}<span class="animater-flash-tools"><button type="button" data-animater-flash-defaults class="${showDefaults ? "active" : ""}" title="Defaults for every combat" aria-label="Defaults for every combat" aria-expanded="${showDefaults}"><i class="fa-solid fa-gear"></i></button><button type="button" data-animater-flash-test title="Preview this combat's opening on your screen" aria-label="Preview opening flash screen">▶</button></span>${showDefaults ? `<span class="animater-flash-defaults">${defaultMenu("start")}${defaultMenu("end")}<span class="animater-flash-moments-title">During combat</span>${MOMENT_EVENTS.filter((ev) => ev !== "initiated").map((ev) => `<label>${esc(FLASH_EVENTS[ev])}<select data-animater-flash-default="${ev}">${[["none", "Off"], ...fitting(ev).filter((s) => s.event === ev).map((s) => [s.id, s.name])].map(([k, v]) => `<option value="${esc(k)}" ${k === (d[ev] ?? "none") ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`).join("")}</span>` : ""}`;
    bar.querySelector("[data-animater-flash-defaults]").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); showDefaults = !showDefaults; bar.replaceWith(Object.assign(picker(combat), { className: bar.className })); });
    bar.addEventListener("change", (e) => {
      const world = e.target.dataset.animaterFlashDefault;
      if (world) return void (e.target.value === "several" || game.settings.set(ID, FLASH_DEFAULTS, { ...defaults(), [world]: e.target.value }));
      const event = e.target.dataset.animaterFlash;
      if (event) void (e.target.value ? combat.setFlag(ID, flagKey(event), e.target.value) : combat.unsetFlag(ID, flagKey(event)));
    });
    bar.querySelector("[data-animater-flash-test]").addEventListener("click", () => play(forCombat(combat, "start"), { combat }));
    return bar;
  }
  // Foundry's Combat Tracker: the menus sit in its header.
  Hooks.on("renderCombatTracker", (app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    const combat = app.viewed ?? game.combat;
    root?.querySelector(".animater-flash-pick")?.remove();
    if (!game.user.isGM || !root || !combat || !trackerMenus()) return;
    const bar = picker(combat), header = trackerHeader(root);
    if (header) header.append(bar); else root.prepend(bar);
  });
  // PF2e HUD's tracker: a ⚡ button in its header (its footer has no room) opens the same menus.
  let hudOpen = false;
  Hooks.on("renderApplicationV2", (app, element) => {
    if (app.id !== "pf2e-hud-tracker" || !game.user.isGM) return;
    const root = element instanceof HTMLElement ? element : app.element, combat = app.viewed ?? app.combat ?? game.combat;
    if (!trackerMenus()) { root?.querySelector(".animater-flash-hud")?.remove(); root?.querySelector(".animater-flash-pick")?.remove(); return; }
    const header = root?.querySelector(":scope > header, header"), footer = root?.querySelector("footer");
    if (!(header || footer) || !combat) return;
    root.querySelector(".animater-flash-hud")?.remove();
    root.querySelector(".animater-flash-pick")?.remove();
    const toggle = document.createElement("a");
    toggle.className = `combat-control animater-flash-hud${hudOpen ? " active" : ""}`;
    toggle.dataset.tooltip = "Flash screens: this combat's opening and ending";
    toggle.setAttribute("aria-label", "Flash screens");
    toggle.innerHTML = `<i class="fa-solid fa-bolt"></i>`;
    const place = () => {
      root.querySelector(".animater-flash-pick")?.remove();
      const panel = Object.assign(picker(combat), { className: "animater-flash-pick is-hud" });
      if (hudOpen) { if (header) header.after(panel); else footer.before(panel); }
    };
    toggle.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); hudOpen = !hudOpen; toggle.classList.toggle("active", hudOpen); place(); });
    if (header) header.append(toggle);
    else { const settings = footer.querySelector(".settings"); if (settings) settings.before(toggle); else footer.append(toggle); }
    place();
  });

  // Before an animation: the recipe's screen plays for everyone, and the animation waits until it starts fading.
  async function before(recipe, context = {}) {
    const screen = screens().find((s) => s.id === recipe.flash);
    if (!screen) return;
    const actor = context.actor ?? context.source?.actor ?? context.source?.document?.actor;
    const token = context.source?.document ?? context.source;
    // Who is acting, for a cut-in portrait.
    const who = actor || token ? { name: context.source?.name ?? actor?.name ?? "", img: token?.texture?.src ?? actor?.prototypeToken?.texture?.src ?? "", portrait: actor?.img ?? "" } : null;
    play(screen, { everyone: true, extra: { name: context.source?.name ?? actor?.name ?? "", action: context.item?.name ?? recipe.name, ...(who ? { actor: who } : {}) } });
    await new Promise((r) => setTimeout(r, Math.max(0, screen.duration - 400)));
  }
  return {
    screens, defaults, vars, play, receive, sound, playSound, before, finaleLength,
    save: (list) => game.settings.set(ID, FLASH_SETTING, { schema: 1, screens: validateFlashes(list) }),
    setDefault: (event, id) => game.settings.set(ID, FLASH_DEFAULTS, { ...defaults(), [event]: id }),
    events: FLASH_EVENTS,
  };
}
