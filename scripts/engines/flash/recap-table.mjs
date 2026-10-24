// Combat recap at the table: the active GM's client records each combat's highlight moments from the chat
// messages and HP changes that reach it (one moment per strike), saves the top three when the combat ends and,
// after the ending screen, plays the replay reel (recap-reel.mjs) here and on every screen. Each screen plays it
// locally: its own camera, local previews of the animations, local ghost sprites, its own DOM overlay.
import { createRecap, awarenessLevel, rollFacts, rollMoment, attackFacts, damageFacts, damageDealt, publicName, topMoments, whenClear, RECAP_MODES, RECAP_SCREEN_ID } from "./recap.mjs";
import { planReel, createReelPlayer } from "./recap-reel.mjs";
import { killCamEffects, slowEffects } from "../camera/kill-cam.mjs";
import { hpState, hpChange } from "../../systems/hp-state.mjs";
import { recallAttribution, recallDamage } from "../playback/damage-moments.mjs";
import { daggerheartRollEvent } from "../../systems/daggerheart.mjs";

export const RECAP_SETTING = "combatRecap", RECAP_SAVED = "lastRecap", RECAP_LOCAL = "combatRecapLocal";
export const RECAP_SOCKET = "recap-reel";
// Whether this screen shows the recap (its Highlights flash screen id is kept for old saved screens).
export const recapHere = (ID, screen) => { if (screen?.id !== RECAP_SCREEN_ID) return true; try { return game.settings.get(ID, RECAP_LOCAL) !== false; } catch { return true; } };
export function registerRecapSettings(ID) {
  game.settings.register(ID, RECAP_SETTING, {
    name: "Combat recap",
    hint: "When a combat ends, after its ending screen, a short replay reel shows its three best moments: the camera frames each one, its animation replays in slow motion at the impact, and a caption says what happened (killing blows, critical hits, natural 20s and 1s, the biggest hit). GM only plays it on the GM's screen.",
    scope: "world", config: true, type: String, choices: { ...RECAP_MODES }, default: "everyone",
  });
  // This screen only: the recap is still recorded, saved and sent to everyone else.
  game.settings.register(ID, RECAP_LOCAL, {
    name: "Combat recap on my screen",
    hint: "Turn off to never play the combat recap reel on this screen.",
    scope: "client", config: false, type: Boolean, default: true,
  });
  // The last combat's top moments, so the recap can be replayed after a reload.
  game.settings.register(ID, RECAP_SAVED, { scope: "world", config: false, type: Object, default: {} });
}

const RING_MS = 30000;
const DEFAULT_ART = /mystery-man|default-icons/;
const esc = (s) => String(s ?? "");

// The reel's overlay: letterbox bars, a soft vignette, the lower-third caption, the art card, the summary and the
// Skip button. Text is set as text; the stylesheet wraps and clamps it.
function reelOverlay() {
  let root = null, onKey = null, removeTimer = null;
  const el = (tag, cls, parent) => { const n = document.createElement(tag); if (cls) n.className = cls; parent?.append(n); return n; };
  const img = (src, cls, parent) => { const n = el("img", cls, parent); n.alt = ""; n.decoding = "async"; if (src) n.src = src; else n.hidden = true; return n; };
  const badgesInto = (parent, badges) => { const row = el("div", "an-reel-badges", parent); for (const b of badges ?? []) el("span", "an-reel-badge", row).textContent = b; return row; };
  const part = (sel) => root?.querySelector(sel) ?? null;
  return {
    open({ onSkip }) {
      if (removeTimer) { clearTimeout(removeTimer); removeTimer = null; }
      for (const old of document.querySelectorAll(".animater-recap-reel")) old.remove();
      root = el("div", "animater-recap-reel");
      root.id = "animater-recap-reel";
      root.setAttribute("aria-live", "polite");
      el("div", "an-reel-bar an-reel-top", root);
      el("div", "an-reel-bar an-reel-bottom", root);
      el("div", "an-reel-vignette", root);
      el("div", "an-reel-card", root);
      el("div", "an-reel-caption", root);
      el("div", "an-reel-summary", root);
      const skip = el("button", "an-reel-skip", root);
      skip.type = "button";
      skip.innerHTML = 'Skip <kbd>Esc</kbd>';
      skip.addEventListener("click", (e) => { e.preventDefault(); onSkip(); });
      onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); onSkip(); } };
      window.addEventListener("keydown", onKey, true);
      document.body.append(root);
      void root.offsetWidth;
      root.classList.add("is-open");
    },
    caption(c) {
      const box = part(".an-reel-caption");
      if (!box) return;
      if (!c) { box.classList.remove("is-shown"); return; }
      box.replaceChildren();
      box.dataset.kind = esc(c.kind);
      img(c.img, "an-reel-chip", box);
      const text = el("div", "an-reel-text", box);
      const top = el("div", "an-reel-line", text);
      el("span", "an-reel-who", top).textContent = c.who;
      el("span", "an-reel-headline", top).textContent = c.headline;
      if (c.detail) el("div", "an-reel-detail", text).textContent = c.detail;
      if (c.item) el("div", "an-reel-item", text).textContent = c.item;
      badgesInto(text, c.badges);
      if (c.number) el("div", "an-reel-number", box).textContent = c.number;
      void box.offsetWidth;
      box.classList.add("is-shown");
    },
    // A moment that cannot replay here: its two creatures' art, face to face.
    card(step) {
      const box = part(".an-reel-card");
      if (!box) return;
      if (!step) { box.classList.remove("is-shown"); return; }
      box.replaceChildren();
      box.dataset.kind = esc(step.caption.kind);
      img(step.caption.img, "an-reel-art", box);
      if (step.caption.targetImg) { el("span", "an-reel-vs", box).textContent = "VS"; img(step.caption.targetImg, "an-reel-art", box); }
      void box.offsetWidth;
      box.classList.add("is-shown");
    },
    summary(cards) {
      const box = part(".an-reel-summary");
      if (!box) return;
      if (!cards) { box.classList.remove("is-shown"); return; }
      box.replaceChildren();
      el("div", "an-reel-summary-title", box).textContent = "Highlights";
      const row = el("div", "an-reel-summary-row", box);
      for (const card of cards) {
        const c = el("div", "an-reel-summary-card", row);
        c.dataset.kind = esc(card.caption.kind);
        img(card.img, "an-reel-summary-art", c);
        el("div", "an-reel-summary-who", c).textContent = card.caption.who;
        el("div", "an-reel-summary-what", c).textContent = [card.caption.headline, card.caption.detail].filter(Boolean).join(" — ");
        badgesInto(c, card.badges);
      }
      void box.offsetWidth;
      box.classList.add("is-shown");
    },
    close(ms = 0) {
      if (onKey) window.removeEventListener("keydown", onKey, true);
      onKey = null;
      const node = root;
      root = null;
      if (!node) return;
      node.classList.remove("is-open");
      node.style.setProperty("--an-reel-out", `${Math.max(0, ms)}ms`);
      if (!ms) { node.remove(); return; }
      node.id = "";
      node.classList.add("is-closing");
      removeTimer = setTimeout(() => { node.remove(); removeTimer = null; }, ms + 50);
    },
  };
}

// A local stand-in for a token that is gone: its recorded art at its recorded place, on this canvas only (never a
// document), and a token-like object the replay can aim at.
function ghostOf(g) {
  const PIXI = globalThis.PIXI, primary = canvas?.primary;
  if (!PIXI || !primary || !g?.src) return null;
  const sprite = PIXI.Sprite.from(g.src);
  sprite.anchor?.set?.(0.5, 0.5);
  sprite.width = g.w; sprite.height = g.h;
  sprite.position.set(g.x + g.w / 2, g.y + g.h / 2);
  sprite.alpha = 0.9;
  sprite.eventMode = "none";
  sprite.elevation = g.elevation ?? 0;
  sprite.sortLayer = 700;
  primary.addChild(sprite);
  const grid = canvas.grid?.size ?? 100, center = { x: g.x + g.w / 2, y: g.y + g.h / 2 };
  const token = {
    id: `animater-ghost-${g.tokenId || g.role}`, isAnimaterGhost: true, x: center.x, y: center.y, w: g.w, h: g.h, width: g.w, height: g.h,
    center, visible: true, controlled: false, destroyed: false, mesh: sprite, name: g.name,
    actor: game.actors?.get(g.actorId) ?? null,
    document: { id: g.tokenId, name: g.name, x: g.x, y: g.y, width: g.w / grid, height: g.h / grid, elevation: g.elevation ?? 0, hidden: false,
      texture: { src: g.src, scaleX: 1, scaleY: 1 }, parent: canvas.scene, documentName: "Token" },
  };
  return { sprite, token, center, w: g.w, h: g.h };
}

// host: { ID, clientId, flash, damageLog, quality(), replay(moment, { source, targets }) → Promise, trace(status, detail) }
export function combatRecaps(host) {
  const { ID, flash, damageLog } = host;
  const systemId = game.system.id;
  const mode = () => { try { return game.settings.get(ID, RECAP_SETTING); } catch { return "everyone"; } };
  const local = () => { try { return game.settings.get(ID, RECAP_LOCAL) !== false; } catch { return true; } };
  const recorder = () => game.user.isGM && (game.users.activeGM ? game.users.activeGM.isSelf : true);
  const recording = () => recorder() && mode() !== "off";
  const trace = (error) => host.trace?.("Blocked", `Combat recap: ${error?.message ?? error}`);
  const recaps = new Map(), hp = new Map(), attacks = [], damages = [];
  const recapFor = (combat) => { if (!recaps.has(combat.id)) recaps.set(combat.id, createRecap()); return recaps.get(combat.id); };
  const combatOf = (actor) => (actor ? game.combats?.find((c) => c.started && Array.from(c.combatants ?? []).some((cb) => cb.actor?.uuid === actor.uuid)) ?? null : null);
  const ring = (list, entry) => { list.push({ ...entry, at: Date.now() }); while (list.length > 30) list.shift(); };
  const fresh = (list) => list.filter((e) => Date.now() - e.at <= RING_MS).sort((a, b) => b.at - a.at);
  // Whether players see this world's NPC names: PF2e/SF2e can let each nameplate decide; Anonymous hides them.
  const nameplatesDecide = () => { try { return ["pf2e", "sf2e"].includes(systemId) && game.settings.get(systemId, "metagame_tokenSetsNameVisibility") === true; } catch { return false; } };
  const anonymous = () => game.modules?.get("anonymous")?.active === true;
  // Who, as the reel shows them: the name players see (and the real one for GMs), a portrait (an NPC's token art,
  // which is what the players saw), and the token as it stood, for the replay and its ghost.
  const person = (actor, token) => {
    const trueName = token?.name ?? actor?.name ?? "";
    if (!trueName) return null;
    const playerOwned = actor?.hasPlayerOwner === true;
    const name = publicName({ name: trueName, playerOwned, displayName: token?.displayName, nameplatesDecide: nameplatesDecide(), anonymous: anonymous() && !playerOwned });
    const src = token?.texture?.src || actor?.prototypeToken?.texture?.src || "";
    const portrait = playerOwned && actor?.img && !DEFAULT_ART.test(actor.img) ? actor.img : "";
    const grid = token?.parent?.grid?.size ?? canvas?.grid?.size ?? 100;
    const p = { name, trueName, img: portrait || src || actor?.img || "", src, actorId: actor?.id, hidden: token?.hidden === true };
    if (token) Object.assign(p, { tokenId: token.id, x: token.x, y: token.y, w: (token.width ?? 1) * grid, h: (token.height ?? 1) * grid, elevation: token.elevation ?? 0 });
    return p;
  };
  // What each player knew of each creature in a moment, at the time (recap.mjs awarenessLevel): PF2e Visioner's
  // state from each of their tokens on the scene, else the creature's conditions. Played back per player
  // (momentForViewer) while Movement respects stealth is on.
  const awarenessFor = (sceneId, people) => {
    const scene = game.scenes?.get(sceneId) ?? canvas?.scene ?? null;
    const users = (game.users ?? []).filter((u) => !u.isGM);
    if (!scene || !users.length) return undefined;
    const visioner = game.modules?.get("pf2e-visioner");
    const api = visioner?.active ? visioner.api : null;
    const owned = (doc, user) => { try { return doc.actor?.testUserPermission?.(user, "OWNER") === true; } catch { return false; } };
    const out = {};
    for (const p of people) {
      const doc = p?.tokenId ? scene.tokens?.get(p.tokenId) : null;
      if (!doc || out[doc.id]) continue;
      const conditions = [...Array.from(doc.actor?.statuses ?? []), ...(doc.actor?.itemTypes?.condition?.map((c) => c.slug) ?? [])];
      const row = {};
      for (const user of users) {
        if (owned(doc, user)) { row[user.id] = "seen"; continue; }
        const states = [];
        if (api?.getVisibility) for (const o of scene.tokens ?? []) {
          if (o.id === doc.id || !owned(o, user)) continue;
          try { const s = api.getVisibility(o.id, doc.id); if (typeof s === "string") states.push(s); } catch { /* skip */ }
        }
        row[user.id] = awarenessLevel({ docHidden: doc.hidden === true, states, conditions });
      }
      out[doc.id] = row;
    }
    return Object.keys(out).length ? out : undefined;
  };
  const sync = (uuid) => { try { return uuid ? globalThis.fromUuidSync?.(uuid, { strict: false }) ?? null : null; } catch { return null; } };
  const tokenDoc = (speaker) => game.scenes?.get(speaker?.scene)?.tokens?.get(speaker?.token) ?? canvas.scene?.tokens?.get(speaker?.token) ?? null;
  // A token or actor uuid, as the moment's target. A hidden token is no moment.
  const targetOf = (uuid, name) => {
    const doc = sync(uuid);
    if (doc?.hidden) return undefined;
    if (doc?.documentName === "Token") return person(doc.actor, doc);
    if (doc?.documentName === "Actor") return person(doc, doc.getActiveTokens?.()?.[0]?.document ?? null);
    return name ? { name, img: "" } : null;
  };
  // Every combatant's HP, so the GM knows what each change took (the client that changed it knows too).
  const seed = (combat) => { for (const c of combat?.combatants ?? []) { const s = c.actor && hpState(c.actor, systemId); if (s) hp.set(c.actor.uuid, s); } };
  for (const combat of game.combats ?? []) if (combat.started) seed(combat);
  Hooks.on("combatStart", (combat) => { if (recorder()) seed(combat); });
  Hooks.on("createCombatant", (combatant) => { const a = combatant.actor, s = a && hpState(a, systemId); if (recorder() && s) hp.set(a.uuid, s); });

  // Every attack and damage roll (to link a later HP change to its strike), and critical hits and natural 20s and 1s.
  Hooks.on("createChatMessage", (message) => {
    try {
      if (!recording()) return;
      const attack = attackFacts(message, systemId);
      if (attack) ring(attacks, attack);
      const damage = damageFacts(message, systemId);
      if (damage) ring(damages, damage);
      let facts = rollFacts(message, systemId);
      if (systemId === "daggerheart") {
        const event = daggerheartRollEvent(message, message.author?.id ?? message.user?.id);
        if (event && !event.skipped && !event.private && (event.outcome === "criticalSuccess" || event.duality === "critical"))
          facts = { crit: true, natural: null, targetUuid: event.targetUuids?.[0] ?? null, targetName: null, key: String(message.id ?? ""), outcome: "criticalSuccess", check: "attack" };
      }
      if (!facts) return;
      const token = tokenDoc(message.speaker), actor = token?.actor ?? message.speakerActor ?? message.actor ?? null;
      const combat = combatOf(actor);
      if (!combat || token?.hidden) return;
      const target = targetOf(facts.targetUuid, facts.targetName);
      if (target === undefined) return;
      const item = message.item ?? null;
      const moment = rollMoment(facts, { actor: person(actor, token), targets: target ? [target] : [], item: item?.name ?? "", itemUuid: item?.uuid ?? "",
        sceneId: token?.parent?.id ?? message.speaker?.scene ?? "", at: Date.now() });
      if (moment) recapFor(combat).record({ ...moment, awareness: awarenessFor(moment.sceneId, [moment.actor, ...moment.targets]) });
    } catch (error) { trace(error); }
  });
  // Damage dealt and killing blows, from HP changes, with the attacker the damage roll named. The strike's damage
  // and attack messages join it to the moment its roll started.
  Hooks.on("updateActor", (actor, changes, options) => {
    try {
      if (!recording()) return;
      const after = hpState(actor, systemId), before = options?.animaterHpBefore ?? hp.get(actor.uuid);
      if (after) hp.set(actor.uuid, after);
      const change = hpChange(before, after);
      if (!change) return;
      const combat = combatOf(actor), token = actor.token ?? actor.getActiveTokens?.()?.[0]?.document ?? null;
      if (!combat || token?.hidden) return;
      const ids = { actorId: actor.id, tokenId: token?.id };
      const by = recallAttribution(damageLog, ids) ?? recallDamage(damageLog, ids);
      const striker = by?.sourceTokenId ? (token?.parent?.tokens?.get(by.sourceTokenId) ?? canvas.scene?.tokens?.get(by.sourceTokenId) ?? null) : null;
      if (!striker || striker.hidden) return;
      const attacker = person(striker.actor, striker);
      if (!attacker) return;
      const aimedHere = (e) => (!e.tokenIds?.length && !e.actorIds?.length) || e.tokenIds?.includes(ids.tokenId) || e.actorIds?.includes(ids.actorId);
      const damage = fresh(damages).find((d) => d.tokenId === striker.id && aimedHere(d)) ?? null;
      const attack = fresh(attacks).find((a) => a.tokenId === striker.id && (!a.targetUuid || a.targetUuid.includes(ids.tokenId ?? "~") || a.targetUuid.includes(ids.actorId ?? "~"))) ?? null;
      const hpLost = after.marked ? after.value - before.value : before.value - after.value;
      const amount = damageDealt({ rolled: damage?.total, taken: options?.damageTaken, hpLost, dropped: change.dropped === true });
      const kill = change.dropped && !actor.hasPlayerOwner;
      const struck = person(actor, token);
      recapFor(combat).record({
        awareness: awarenessFor(token?.parent?.id ?? "", [attacker, struck]),
        badges: kill ? ["kill"] : [], actor: attacker, targets: [struck], item: by?.itemName ?? "", itemUuid: by?.itemUuid ?? "",
        amount, crit: by?.crit === true, outcome: attack?.outcome || (by?.crit ? "criticalSuccess" : "success"), eventType: "attack",
        sceneId: token?.parent?.id ?? "", attackMessageId: attack?.messageId ?? "", damageMessageId: damage?.messageId ?? "", at: Date.now(),
      });
    } catch (error) { trace(error); }
  });
  // The combat ends: its top three are saved, then play after the ending screen.
  Hooks.on("deleteCombat", (combat) => {
    const recap = recaps.get(combat.id);
    recaps.delete(combat.id);
    if (!recorder() || !combat.started || mode() === "off") return;
    const moments = recap?.top(3) ?? [];
    if (!moments.length) return;
    const saved = { version: 2, combatId: combat.id, scene: combat.scene?.name ?? "", sceneId: combat.scene?.id ?? "", at: Date.now(), moments };
    void game.settings.set(ID, RECAP_SAVED, saved).catch(trace);
    const endMs = Number(flash?.endLength?.(combat)) || 0;
    void whenClear({ endMs, busy: () => flash?.busy?.() === true, sleep: (ms) => new Promise((r) => setTimeout(r, ms)) })
      .then(() => play({ everyone: mode() === "everyone", quiet: true }, saved)).catch(trace);
  });

  // The reel on this screen.
  const overlay = reelOverlay();
  const reel = createReelPlayer({
    overlay,
    pan: (to) => void Promise.resolve(canvas?.animatePan?.({ x: to.x, y: to.y, scale: to.scale, duration: Math.max(40, Number(to.duration) || 0) })).catch(() => {}),
    ghosts: {
      add: (g) => { try { const h = ghostOf(g); return h ? Object.assign(h, { role: g.role, tokenId: g.tokenId }) : null; } catch { return null; } },
      remove: (h) => { try { h?.sprite?.destroy?.(); if (h?.token) h.token.destroyed = true; } catch { /* canvas gone */ } },
    },
    replay: async (step, handles) => {
      const live = (id) => (id ? canvas?.tokens?.get(id) ?? null : null);
      const ghost = (role, tokenId) => handles.find((h) => h.role === role && (!tokenId || h.tokenId === tokenId))?.token ?? null;
      const source = live(step.live.find((l) => l.role === "source")?.tokenId) ?? ghost("source");
      const targets = step.moment.targets.map((t) => live(t.tokenId) ?? ghost("target", t.tokenId)).filter(Boolean);
      if (!source) throw Error("no attacker to replay from");
      return host.replay(step.moment, { source, targets });
    },
    // Slow motion: Animater's effects on or near the framed tokens (kill-cam's slowing), and any that start meanwhile.
    slow: (slow) => {
      const effects = () => globalThis.Sequencer?.EffectManager?.effects ?? [];
      const near = (list) => {
        const out = new Set();
        for (const p of slow.points ?? []) for (const e of killCamEffects(list, { center: { x: p.x, y: p.y }, radius: Math.max(p.w ?? 0, p.h ?? 0) * 1.5 })) out.add(e);
        return [...out];
      };
      const restores = [slowEffects(near(effects()), slow.rate)];
      const hook = Hooks.on("createSequencerEffect", (effect) => setTimeout(() => { if (restores.length) restores.push(slowEffects(near([effect]), slow.rate)); }, 0));
      return () => { Hooks.off("createSequencerEffect", hook); for (const r of restores.splice(0)) r(); };
    },
    schedule: (fn, ms) => setTimeout(fn, ms),
    cancel: (h) => clearTimeout(h),
    trace: (status, detail) => host.trace?.(status, detail),
  });
  Hooks.on("canvasTearDown", () => reel.clear());

  // Plays moments on this screen, as this viewer may see them. False when nothing shows here.
  function playHere(moments) {
    if (reel.playing) return false;
    const quality = (() => { try { return host.quality?.() ?? "full"; } catch { return "full"; } })();
    const stage = canvas?.ready ? canvas.stage : null;
    const plan = planReel({
      moments,
      viewer: { sceneId: canvas?.scene?.id ?? "", gm: game.user.isGM, quality, local: local(), userId: game.user.id,
        stealth: (() => { try { return game.settings.get(ID, "movementStealth") !== false; } catch { return true; } })() },
      tokens: (id) => {
        const t = canvas?.ready ? canvas.tokens?.get(id) : null;
        return t ? { center: t.center, w: t.w, h: t.h, hidden: t.document?.hidden === true } : null;
      },
      view: stage ? { x: stage.pivot.x, y: stage.pivot.y, scale: stage.scale.x } : null,
      screen: { w: window.innerWidth, h: window.innerHeight },
      maxZoom: canvas?.dimensions?.scale?.max ?? CONFIG.Canvas?.maxZoom,
    });
    if (!plan) return false;
    void reel.play(plan);
    return true;
  }
  // The last recap, on this screen (everyone: every screen, GM only). False when there is none.
  function play({ everyone = false, quiet = false } = {}, saved = game.settings.get(ID, RECAP_SAVED)) {
    const moments = topMoments(saved?.moments ?? [], 3);
    if (!moments.length) {
      if (!quiet) globalThis.ui?.notifications?.info("Animater: no combat recap yet. One is made when a combat with highlights ends.");
      return false;
    }
    if (everyone === true && game.user.isGM) game.socket?.emit(`module.${ID}`, { type: RECAP_SOCKET, sender: host.clientId, userId: game.user.id, moments });
    const shown = playHere(moments);
    if (!shown && !quiet && !everyone) globalThis.ui?.notifications?.info("Animater: the combat recap is turned off on this screen (quality Off or Combat recap on my screen).");
    return true;
  }
  // A GM played the recap to everyone.
  function receive(data, senderId) {
    if (data?.type !== RECAP_SOCKET || !Array.isArray(data.moments)) return;
    if (!game.users?.get(senderId ?? data.userId)?.isGM) return;
    playHere(data.moments.slice(0, 3));
  }
  return { play, receive, skip: () => reel.skip(), last: () => game.settings.get(ID, RECAP_SAVED) ?? null, mode };
}
